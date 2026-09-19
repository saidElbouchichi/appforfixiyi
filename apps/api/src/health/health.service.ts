import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import type { Connection } from "mongoose";

import { RedisService } from "../infrastructure/redis/redis.service.js";

export interface DependencyHealth {
  status: "up" | "down";
  message?: string;
}

export interface HealthCheckResult {
  status: "ok" | "degraded";
  checks: {
    mongo: DependencyHealth;
    redis: DependencyHealth;
  };
}

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private readonly mongoConnection: Connection,
    private readonly redis: RedisService,
  ) {}

  async check(): Promise<HealthCheckResult> {
    const [mongo, redis] = await Promise.all([this.checkMongo(), this.checkRedis()]);
    const status = mongo.status === "up" && redis.status === "up" ? "ok" : "degraded";
    return { status, checks: { mongo, redis } };
  }

  private async checkMongo(): Promise<DependencyHealth> {
    try {
      if (!this.mongoConnection.db) {
        throw new Error("no active database handle");
      }
      await this.mongoConnection.db.admin().command({ ping: 1 });
      return { status: "up" };
    } catch (error) {
      return { status: "down", message: toMessage(error) };
    }
  }

  private async checkRedis(): Promise<DependencyHealth> {
    try {
      const alive = await this.redis.ping();
      return alive ? { status: "up" } : { status: "down", message: "unexpected PING reply" };
    } catch (error) {
      return { status: "down", message: toMessage(error) };
    }
  }
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}
