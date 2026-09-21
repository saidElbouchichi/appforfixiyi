import { randomInt } from "node:crypto";

import { loadEnv } from "@fixiyi/config";
import { ProviderMatchSchema, ProviderProfileSchema, ServiceRequestSchema } from "@fixiyi/contracts";
import { getModelToken } from "@nestjs/mongoose";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type { Model } from "mongoose";
import { io, type Socket } from "socket.io-client";
import request from "supertest";
import { expect } from "vitest";

import { AppModule } from "../src/app.module.js";
import { UserEntity } from "../src/auth/schemas/user.schema.js";
import { configureRealtime } from "../src/chat/realtime.adapter.js";
import { ProblemDetailsFilter } from "../src/common/filters/problem-details.filter.js";
import { RedisService } from "../src/infrastructure/redis/redis.service.js";

import { login } from "./otp-test-helper.js";
import { clearRateLimitState } from "./rate-limit-test-helper.js";

/**
 * Shared setup for the chat e2e suites: a REAL listening app (sockets need a
 * port), the same realtime stack as production (`configureRealtime`, Redis
 * adapter included), and helpers that build the genuine prerequisite of any
 * conversation — a submitted request and a provider the matching engine
 * actually dispatched to it. Nothing is inserted behind the API's back.
 */

const CASABLANCA = { lng: -7.589843, lat: 33.573109 };

export interface Party {
  token: string;
  refreshToken: string;
  userId: string;
  phone: string;
}

export interface Dispatch {
  client: Party & { requestId: string };
  provider: Party & { profileId: string; candidateId: string };
}

export class ChatHarness {
  app!: NestFastifyApplication;
  server!: Parameters<typeof request>[0];
  redis!: RedisService;
  baseUrl = "";
  private adminToken = "";
  private categoryId = "";
  private readonly runId = Date.now().toString().slice(-6);
  private counter = 0;
  private readonly sockets: Socket[] = [];

  async start(): Promise<void> {
    const env = loadEnv();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(env)] }).compile();
    this.app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    this.app.setGlobalPrefix("api/v1", { exclude: ["health"] });
    this.app.useGlobalFilters(new ProblemDetailsFilter());
    await configureRealtime(this.app, env);
    await this.app.listen(0, "127.0.0.1");

    const httpServer = this.app.getHttpAdapter().getInstance().server;
    this.server = httpServer;
    const address = httpServer.address();
    if (typeof address !== "object" || address === null) throw new Error("no listening address");
    this.baseUrl = `http://127.0.0.1:${address.port.toString()}`;

    this.redis = this.app.get(RedisService);
    await clearRateLimitState(this.redis);
    await this.prepareCatalog();
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets) socket.disconnect();
    await this.app.close();
  }

  bearer(token: string): [string, string] {
    return ["Authorization", `Bearer ${token}`];
  }

  model<T>(name: string): Model<T> {
    return this.app.get<Model<T>>(getModelToken(name));
  }

  /**
   * A random, VALID Moroccan mobile (+212 66X XXX XXX). Not derived from a
   * counter: a "runId + 2-digit counter" scheme silently produces a number one
   * digit too long once a suite passes 99 logins, and OTP then refuses it with
   * a 400 — which is exactly how this helper first failed.
   */
  async login(): Promise<Party> {
    const phone = `+21266${randomInt(0, 10_000_000).toString().padStart(7, "0")}`;
    const session = await login(this.server, this.redis, phone);
    return { token: session.accessToken, refreshToken: session.refreshToken, userId: session.user.id, phone };
  }

  /** A submitted request and ONE provider the engine really dispatched to it. */
  async dispatch(): Promise<Dispatch> {
    const serviceChain = await this.createChain();
    const provider = await this.createProvider(serviceChain);
    const client = await this.createSubmittedRequest(serviceChain);

    const started = await request(this.server).post(`/api/v1/requests/${client.requestId}/match`).set(...this.bearer(client.token)).send({});
    expect(started.status).toBe(201);

    const mine = await request(this.server).get("/api/v1/matches/mine").set(...this.bearer(provider.token));
    const matches = ProviderMatchSchema.array().parse(mine.body);
    const match = matches.find((entry) => entry.requestId === client.requestId);
    if (!match) throw new Error("the provider was not dispatched to the request");
    return { client, provider: { ...provider, candidateId: match.candidateId } };
  }

  /** A second provider, set up the same way but never dispatched to anything. */
  async undispatchedProvider(): Promise<Party> {
    return this.login();
  }

  async openConversation(party: Party, body: Record<string, unknown>): Promise<request.Response> {
    return request(this.server).post("/api/v1/conversations").set(...this.bearer(party.token)).send(body);
  }

  async send(party: Party, conversationId: string, body: Record<string, unknown>): Promise<request.Response> {
    return request(this.server)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set(...this.bearer(party.token))
      .send({ clientMessageId: crypto.randomUUID(), ...body });
  }

  /** A connected socket.io client, or the connection error it was refused with. */
  async connect(token: string | null): Promise<Socket> {
    const socket = io(this.baseUrl, {
      auth: token === null ? {} : { token },
      transports: ["websocket"],
      reconnection: false,
      forceNew: true,
    });
    this.sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => {
        resolve();
      });
      socket.once("connect_error", (error) => {
        reject(error);
      });
    });
    return socket;
  }

  private async prepareCatalog(): Promise<void> {
    const admin = await this.login();
    await this.model<UserEntity>(UserEntity.name).updateOne({ _id: admin.userId }, { $set: { roles: ["CLIENT", "ADMIN"] } });
    const refreshed = await request(this.server).post("/api/v1/auth/refresh").send({ refreshToken: admin.refreshToken });
    this.adminToken = (refreshed.body as { accessToken: string }).accessToken;
    const domainId = await this.createNode({ level: "DOMAIN", name: this.uniqueName("Chat Domain") });
    this.categoryId = await this.createNode({ level: "CATEGORY", parentId: domainId, name: this.uniqueName("Chat Category") });
  }

  private uniqueName(prefix: string): string {
    this.counter += 1;
    return `${prefix} ${this.runId}-${this.counter.toString()}`;
  }

  private async createNode(body: Record<string, unknown>): Promise<string> {
    const response = await request(this.server).post("/api/v1/catalog/nodes").set(...this.bearer(this.adminToken)).send(body);
    expect(response.status).toBe(201);
    return (response.body as { id: string }).id;
  }

  /** Each dispatch gets its own service, so providers from another test can never be eligible (Decision 46). */
  private async createChain(): Promise<{ serviceId: string; interventionTypeId: string; complexityId: string }> {
    const serviceId = await this.createNode({ level: "SERVICE", parentId: this.categoryId, name: this.uniqueName("Chat Service") });
    const interventionTypeId = await this.createNode({ level: "INTERVENTION_TYPE", parentId: serviceId, name: this.uniqueName("Chat Type") });
    const complexityId = await this.createNode({ level: "COMPLEXITY", parentId: interventionTypeId, name: this.uniqueName("Chat Simple") });
    return { serviceId, interventionTypeId, complexityId };
  }

  private async createProvider(chain: { serviceId: string }): Promise<Party & { profileId: string }> {
    const party = await this.login();
    const adult = new Date();
    adult.setUTCFullYear(adult.getUTCFullYear() - 20);
    await request(this.server).patch("/api/v1/auth/me").set(...this.bearer(party.token)).send({ dateOfBirth: adult.toISOString() });
    await request(this.server).post("/api/v1/auth/roles/provider").set(...this.bearer(party.token));
    const refreshed = await request(this.server).post("/api/v1/auth/refresh").send({ refreshToken: party.refreshToken });
    const tokens = refreshed.body as { accessToken: string; refreshToken: string };

    const created = await request(this.server)
      .post("/api/v1/providers/me")
      .set(...this.bearer(tokens.accessToken))
      .send({ type: "TECHNICIEN", displayName: this.uniqueName("Chat Pro"), experienceYears: 3 });
    expect(created.status).toBe(201);
    const profile = ProviderProfileSchema.parse(created.body);

    await request(this.server)
      .patch("/api/v1/providers/me")
      .set(...this.bearer(tokens.accessToken))
      .send({
        serviceIds: [chain.serviceId],
        serviceAreas: [{ center: { type: "Point", coordinates: [CASABLANCA.lng, CASABLANCA.lat] }, radiusKm: 20 }],
      });
    await request(this.server).patch("/api/v1/providers/me/availability").set(...this.bearer(tokens.accessToken)).send({ status: "AVAILABLE" });

    return { ...party, token: tokens.accessToken, refreshToken: tokens.refreshToken, profileId: profile.id };
  }

  private async createSubmittedRequest(chain: { serviceId: string; interventionTypeId: string; complexityId: string }): Promise<
    Party & { requestId: string }
  > {
    const party = await this.login();
    const created = await request(this.server).post("/api/v1/requests").set(...this.bearer(party.token));
    const requestId = ServiceRequestSchema.parse(created.body).id;
    await request(this.server)
      .patch(`/api/v1/requests/${requestId}`)
      .set(...this.bearer(party.token))
      .send({
        ...chain,
        description: "Prise de courant hors service.",
        urgency: "NORMAL",
        location: { address: "Casablanca", point: { type: "Point", coordinates: [CASABLANCA.lng, CASABLANCA.lat] } },
      });
    const submitted = await request(this.server).post(`/api/v1/requests/${requestId}/submit`).set(...this.bearer(party.token));
    expect(submitted.status).toBe(201);
    return { ...party, requestId };
  }
}

/** Resolves with the next `event` payload, or rejects after `timeoutMs`. */
export function nextEvent<T>(socket: Socket, event: string, timeoutMs = 5_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`no "${event}" within ${timeoutMs.toString()}ms`));
    }, timeoutMs);
    function handler(payload: T): void {
      clearTimeout(timer);
      resolve(payload);
    }
    socket.once(event, handler);
  });
}

/** Collects every `event` payload received during `windowMs` — for asserting that something did NOT arrive. */
export async function eventsDuring<T>(socket: Socket, event: string, windowMs: number): Promise<T[]> {
  const received: T[] = [];
  const handler = (payload: T): void => {
    received.push(payload);
  };
  socket.on(event, handler);
  await new Promise((resolve) => setTimeout(resolve, windowMs));
  socket.off(event, handler);
  return received;
}
