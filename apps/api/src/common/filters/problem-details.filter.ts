import type { ProblemDetails } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import { Catch, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import { DomainHttpException } from "../exceptions/domain-http.exception.js";

const TRACE_ID_HEADER = "x-trace-id";
// Widened to `number` so the comparison below isn't enum-vs-number (@typescript-eslint/no-unsafe-enum-comparison).
const SERVER_ERROR_THRESHOLD: number = HttpStatus.INTERNAL_SERVER_ERROR;

/**
 * Converts every thrown exception into the Problem Details envelope
 * (02_SPEC_ENGINEERING.md #62). Never leaks a stack trace to the client.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const status: number =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const { title, code } = describe(exception);
    const traceId = extractTraceId(request);

    if (status >= SERVER_ERROR_THRESHOLD) {
      this.logger.error(
        `[${traceId}] ${title}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const problem: ProblemDetails = {
      type: `https://fixiyi.app/errors/${code.toLowerCase().replace(/_/g, "-")}`,
      title,
      status,
      code,
      traceId,
    };
    reply.status(status).send(problem);
  }
}

function describe(exception: unknown): { title: string; code: string } {
  if (exception instanceof DomainHttpException) {
    return { title: exception.message, code: exception.code };
  }
  if (exception instanceof HttpException) {
    const response = exception.getResponse();
    const title =
      typeof response === "string" ? response : (extractMessage(response) ?? exception.message);
    return { title, code: HttpStatus[exception.getStatus()] ?? "HTTP_ERROR" };
  }
  // Never surface the raw internal error message to the client.
  return { title: "Internal server error", code: "INTERNAL_SERVER_ERROR" };
}

function extractMessage(response: unknown): string | undefined {
  if (typeof response === "object" && response !== null && "message" in response) {
    const { message } = response;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.map(String).join("; ");
  }
  return undefined;
}

/**
 * An incoming trace id is reused only if it looks like one: it is written to
 * the logs, and a client-chosen value with a line break or 10 kB of text
 * could forge or flood log lines (audit 2026-09-21).
 */
const SAFE_TRACE_ID = /^[\w-]{1,64}$/;

function extractTraceId(request: FastifyRequest): string {
  const header = request.headers[TRACE_ID_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  return value !== undefined && SAFE_TRACE_ID.test(value) ? value : generateId();
}
