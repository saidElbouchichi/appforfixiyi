import { CHAT_CLIENT_EVENTS, TypingInputSchema } from "@fixiyi/contracts";
import { Logger, type OnModuleDestroy } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayInit,
} from "@nestjs/websockets";
import type { DefaultEventsMap, Server, Socket } from "socket.io";

import { SessionService } from "../auth/session/session.service.js";
import { TokenService } from "../auth/token/token.service.js";

import { ChatEventsPublisher, userRoom } from "./chat-events.publisher.js";
import { ConversationService, counterpartOf } from "./conversation.service.js";

/**
 * How often live sockets are checked against their session. A remote logout
 * (01_SPEC_PRODUCT.md #70) must cut the socket too, the way `AuthGuard`
 * re-checks the session on every HTTP request. One batched query per sweep
 * for every socket on this instance — not one query per socket.
 */
const SESSION_SWEEP_INTERVAL_MS = 30_000;

export interface ChatSocketData {
  userId: string;
  sessionId: string;
  /** conversationId -> counterpart userId, so typing does not hit the database on every keystroke. */
  counterparts: Map<string, string>;
}

type ChatSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, ChatSocketData>;
type ChatServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, ChatSocketData>;

/** The error a client sees as `connect_error` — its cue to refresh its token and reconnect. */
export const SOCKET_UNAUTHORIZED = "UNAUTHORIZED";

/**
 * The socket NOTIFIES; it never mutates. Every write goes through HTTP and
 * the database (01_SPEC_PRODUCT.md #49). The single client -> server event
 * is `typing`, ephemeral by nature and never stored.
 */
@WebSocketGateway()
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  private readonly logger = new Logger(ChatGateway.name);
  private server: ChatServer | null = null;
  private sweep: NodeJS.Timeout | null = null;

  constructor(
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly conversations: ConversationService,
    private readonly publisher: ChatEventsPublisher,
  ) {}

  afterInit(server: ChatServer): void {
    this.server = server;
    this.publisher.attach(server as Server);
    // Authenticate at the handshake: an unauthenticated socket never exists, so no handler has to remember to check.
    server.use((socket, next) => {
      void this.authenticate(socket).then(
        () => {
          next();
        },
        () => {
          next(new Error(SOCKET_UNAUTHORIZED));
        },
      );
    });
    this.sweep = setInterval(() => {
      void this.sweepRevokedSessions();
    }, SESSION_SWEEP_INTERVAL_MS);
    this.sweep.unref();
  }

  handleConnection(socket: ChatSocket): void {
    // A personal room: the server alone decides what reaches whom, so no client ever asks to join a conversation.
    void socket.join(userRoom(socket.data.userId));
  }

  @SubscribeMessage(CHAT_CLIENT_EVENTS.typing)
  async onTyping(@ConnectedSocket() socket: ChatSocket, @MessageBody() body: unknown): Promise<void> {
    const parsed = TypingInputSchema.safeParse(body);
    if (!parsed.success) {
      return;
    }
    const counterpart = await this.counterpartFor(socket, parsed.data.conversationId);
    if (counterpart) {
      this.publisher.typing(counterpart, { ...parsed.data, userId: socket.data.userId });
    }
  }

  onModuleDestroy(): void {
    if (this.sweep) {
      clearInterval(this.sweep);
    }
  }

  /** Same checks as `AuthGuard`: a valid access token AND a session that is still active. */
  private async authenticate(socket: ChatSocket): Promise<void> {
    const auth: unknown = socket.handshake.auth;
    const token = typeof auth === "object" && auth !== null && "token" in auth ? auth.token : null;
    if (typeof token !== "string" || token.length === 0) {
      throw new Error("missing token");
    }
    const claims = this.tokens.verifyAccessToken(token);
    const session = await this.sessions.findActiveById(claims.sid);
    if (!session) {
      throw new Error("inactive session");
    }
    socket.data = { userId: claims.sub, sessionId: claims.sid, counterparts: new Map() };
  }

  /** Only a participant can signal typing, and only to the other participant. Non-participants are silently ignored. */
  private async counterpartFor(socket: ChatSocket, conversationId: string): Promise<string | null> {
    const cached = socket.data.counterparts.get(conversationId);
    if (cached) {
      return cached;
    }
    try {
      const { conversation, role } = await this.conversations.requireParticipant(conversationId, socket.data.userId);
      const counterpart = counterpartOf(conversation, role);
      socket.data.counterparts.set(conversationId, counterpart);
      return counterpart;
    } catch {
      return null;
    }
  }

  /**
   * Disconnects every local socket whose session is no longer active. Runs on
   * a timer; public so a test can trigger a sweep instead of waiting for it.
   * Local sockets only: with the Redis adapter each instance sweeps its own.
   */
  async sweepRevokedSessions(): Promise<void> {
    if (!this.server) {
      return;
    }
    const sockets = [...this.server.sockets.sockets.values()];
    if (sockets.length === 0) {
      return;
    }
    try {
      const active = await this.sessions.filterActiveIds([...new Set(sockets.map((socket) => socket.data.sessionId))]);
      for (const socket of sockets) {
        if (!active.has(socket.data.sessionId)) {
          socket.disconnect(true);
        }
      }
    } catch (error) {
      this.logger.warn(`Session sweep failed: ${String(error)}`);
    }
  }
}
