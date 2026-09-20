import type { Env } from "@fixiyi/config";
import { Module } from "@nestjs/common";

import { ConfigurationModule } from "../configuration/configuration.module.js";
import { ConfigurationService } from "../configuration/configuration.service.js";
import { ENV } from "../infrastructure/env.token.js";

import { GeoService } from "./geo.service.js";
import { DevMapProvider } from "./map/dev-map.provider.js";
import { MAP_PROVIDER, type MapProvider } from "./map/map.provider.js";
import { TransportPricingService } from "./transport-pricing.service.js";

/**
 * `MAP_PROVIDER=dev`/`fake` selects the estimating adapter. Any other value
 * fails fast at bootstrap rather than silently returning estimates from a
 * configuration that claims a real routing provider (same rule as
 * `SmsModule`/`EmailModule`, 03_AGENT_PROTOCOL.md #2).
 */
@Module({
  imports: [ConfigurationModule],
  providers: [
    {
      provide: MAP_PROVIDER,
      inject: [ENV, ConfigurationService],
      useFactory: (env: Env, configuration: ConfigurationService): MapProvider => {
        if (env.MAP_PROVIDER === "dev" || env.MAP_PROVIDER === "fake") {
          return new DevMapProvider(configuration);
        }
        throw new Error(`Unsupported MAP_PROVIDER "${env.MAP_PROVIDER}" — no real routing adapter implemented yet.`);
      },
    },
    GeoService,
    TransportPricingService,
  ],
  exports: [GeoService, TransportPricingService],
})
export class GeoModule {}
