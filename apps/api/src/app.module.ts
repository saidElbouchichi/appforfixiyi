import type { Env } from "@fixiyi/config";
import { Module, type DynamicModule } from "@nestjs/common";

import { AuthModule } from "./auth/auth.module.js";
import { CatalogModule } from "./catalog/catalog.module.js";
import { ChatModule } from "./chat/chat.module.js";
import { CompanyModule } from "./companies/company.module.js";
import { ConfigurationModule } from "./configuration/configuration.module.js";
import { GeoModule } from "./geo/geo.module.js";
import { HealthModule } from "./health/health.module.js";
import { DatabaseModule } from "./infrastructure/database/database.module.js";
import { EnvModule } from "./infrastructure/env.module.js";
import { RedisModule } from "./infrastructure/redis/redis.module.js";
import { MatchingModule } from "./matching/matching.module.js";
import { MediaModule } from "./media/media.module.js";
import { ProviderModule } from "./providers/provider.module.js";
import { PublicProviderModule } from "./providers/public/public-provider.module.js";
import { RequestModule } from "./requests/request.module.js";
import { VerificationModule } from "./verification/verification.module.js";

@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      imports: [
        EnvModule.forRoot(env),
        DatabaseModule,
        RedisModule,
        HealthModule,
        AuthModule,
        CatalogModule,
        ProviderModule,
        PublicProviderModule,
        CompanyModule,
        VerificationModule,
        MediaModule,
        RequestModule,
        ConfigurationModule,
        GeoModule,
        MatchingModule,
        ChatModule,
      ],
    };
  }
}
