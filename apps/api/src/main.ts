import "reflect-metadata";

import { loadEnv } from "@fixiyi/config";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module.js";
import { configureRealtime } from "./chat/realtime.adapter.js";
import { ProblemDetailsFilter } from "./common/filters/problem-details.filter.js";
import { logLevelsFor } from "./common/log-levels.js";

async function bootstrap(): Promise<void> {
  // Loaded first, outside of Nest's DI graph: dotenv must populate process.env
  // before anything else runs, and a bad config must fail loudly right here.
  const env = loadEnv();

  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(env), new FastifyAdapter(), {
    bufferLogs: true,
  });

  // The reason `bufferLogs` is on: nothing is written until the configured
  // level is known, so start-up lines obey LOG_LEVEL like every other line.
  app.useLogger(logLevelsFor(env.LOG_LEVEL));

  app.setGlobalPrefix("api/v1", { exclude: ["health"] });
  app.useGlobalFilters(new ProblemDetailsFilter());
  // Explicit methods: Fastify/@fastify/cors's automatic method detection was
  // only ever advertising GET/HEAD/POST in its preflight response, silently
  // blocking every real-browser PATCH/DELETE call (found via Phase 4's
  // Playwright test hitting PATCH /requests/:id — see Decision 35's report).
  app.enableCors({ methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE"] });
  // Socket.IO on the same HTTP server, behind the Redis adapter (chat, Phase 6).
  await configureRealtime(app, env);

  const swaggerConfig = new DocumentBuilder()
    .setTitle(env.APP_NAME)
    .setDescription("Fixiyi API")
    .setVersion(env.API_VERSION)
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const apiUrl = new URL(env.API_URL);
  const port = apiUrl.port ? Number(apiUrl.port) : 4000;
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
