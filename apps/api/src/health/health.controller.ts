import { Controller, Get, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import type { FastifyReply } from "fastify";

import { HealthService } from "./health.service.js";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({
    summary: "Liveness/readiness probe. Actively verifies MongoDB and Redis connectivity.",
  })
  @ApiOkResponse({ description: "All dependencies are reachable." })
  @ApiServiceUnavailableResponse({ description: "At least one dependency is unreachable." })
  async check(@Res() reply: FastifyReply): Promise<void> {
    const result = await this.health.check();
    reply.status(result.status === "ok" ? 200 : 503).send(result);
  }
}
