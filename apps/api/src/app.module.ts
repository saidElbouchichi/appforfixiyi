import type { Env } from "@fixiyi/config";
import { Module, type DynamicModule } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module.js";
import { HealthModule } from "./health/health.module.js";
import { DatabaseModule } from "./infrastructure/database/database.module.js";
import { EnvModule } from "./infrastructure/env.module.js";
import { RedisModule } from "./infrastructure/redis/redis.module.js";

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [EnvModule.forRoot(env), DatabaseModule, RedisModule, HealthModule, AuthModule],
    };
  }
}
