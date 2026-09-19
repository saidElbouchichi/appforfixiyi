import type { Env } from "@fixiyi/config";
import { Global, Module, type DynamicModule } from "@nestjs/common";

import { ENV } from "./env.token.js";

/**
 * Makes the already-loaded, already-validated {@link Env} (see
 * `loadEnv()` in main.ts — loaded once, before Nest even starts, to avoid
 * ordering issues between dotenv loading and module bootstrap) available
 * for injection anywhere via `@Inject(ENV)`.
 */
@Global()
@Module({})
export class EnvModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: EnvModule,
      providers: [{ provide: ENV, useValue: env }],
      exports: [ENV],
    };
  }
}
