import type { Env } from "@fixiyi/config";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { ENV } from "../env.token.js";

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({ uri: env.DATABASE_URL }),
    }),
  ],
})
export class DatabaseModule {}
