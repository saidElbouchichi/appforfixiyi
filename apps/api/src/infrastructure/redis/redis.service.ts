import type { Env } from "@fixiyi/config";
import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";

import { ENV } from "../env.token.js";

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(@Inject(ENV) env: Env) {
    this.client = new Redis(env.REDIS_URL);
  }

  /** Resolves true on a successful round trip; HealthService catches the rejection otherwise. */
  async ping(): Promise<boolean> {
    await this.client.ping();
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
