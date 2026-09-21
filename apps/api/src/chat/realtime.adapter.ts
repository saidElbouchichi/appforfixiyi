import type { Env } from "@fixiyi/config";
import type { INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import type { Server, ServerOptions } from "socket.io";

/**
 * Socket.IO over the Redis adapter.
 *
 * One API instance runs today, but without this adapter a second replica
 * would silently split the users: someone connected to instance A would never
 * receive a message sent through instance B. The adapter relays every
 * room emit through Redis, which is already part of the stack.
 *
 * CORS is restricted to the web app. Authentication is a token in the
 * handshake payload, not a cookie, so there are no ambient credentials a
 * foreign page could ride on — the origin restriction is defence in depth.
 */
export class RealtimeAdapter extends IoAdapter {
  private adapterFactory: ReturnType<typeof createAdapter> | null = null;
  private readonly redisClients: Redis[] = [];

  constructor(
    app: INestApplicationContext,
    private readonly env: Env,
  ) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const publisher = new Redis(this.env.REDIS_URL);
    // Pub/sub needs its own connection: a subscribed ioredis client can issue no other command.
    const subscriber = publisher.duplicate();
    this.redisClients.push(publisher, subscriber);
    await Promise.all([publisher.ping(), subscriber.ping()]);
    this.adapterFactory = createAdapter(publisher, subscriber);
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    // `options ?? {}` rather than spreading an optional: under exactOptionalPropertyTypes a
    // spread of `ServerOptions | undefined` widens every property to `| undefined`.
    const base: ServerOptions = options ?? ({} as ServerOptions);
    const server = super.createIOServer(port, {
      ...base,
      cors: { origin: [this.env.APP_URL], methods: ["GET", "POST"] },
    });
    if (this.adapterFactory) {
      server.adapter(this.adapterFactory);
    }
    return server;
  }

  /** Called by Nest on shutdown — without it, tests and dev restarts leak two open Redis sockets. */
  override async dispose(): Promise<void> {
    await super.dispose();
    await Promise.all(this.redisClients.map((client) => client.quit()));
  }
}

/** Shared by `main.ts` and the e2e tests, so both run the exact same realtime stack. */
export async function configureRealtime(app: INestApplicationContext & { useWebSocketAdapter(adapter: IoAdapter): unknown }, env: Env): Promise<void> {
  const adapter = new RealtimeAdapter(app, env);
  await adapter.connectToRedis();
  app.useWebSocketAdapter(adapter);
}
