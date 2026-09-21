import type { ProblemDetails } from "@fixiyi/contracts";
import { BadRequestException, HttpStatus, type ArgumentsHost } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi, type Mock } from "vitest";

import { DomainHttpException } from "../exceptions/domain-http.exception.js";

import { ProblemDetailsFilter } from "./problem-details.filter.js";

interface MockHost {
  host: ArgumentsHost;
  send: Mock<(body: ProblemDetails) => void>;
  status: Mock<(code: number) => FastifyReply>;
}

function createHost(headers: Record<string, string> = {}): MockHost {
  const send = vi.fn<(body: ProblemDetails) => void>();
  const status = vi.fn<(code: number) => FastifyReply>(() => ({ send }) as unknown as FastifyReply);
  const reply = { status } as unknown as FastifyReply;
  const request = { headers } as unknown as FastifyRequest;
  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, send, status };
}

function sentBody(send: Mock<(body: ProblemDetails) => void>): ProblemDetails {
  const call = send.mock.calls[0];
  if (!call) {
    throw new Error("reply.send was never called");
  }
  return call[0];
}

describe("ProblemDetailsFilter", () => {
  it("maps a DomainHttpException to its explicit code", () => {
    const filter = new ProblemDetailsFilter();
    const { host, send, status } = createHost();

    filter.catch(new DomainHttpException(409, "OFFER_ALREADY_ACCEPTED", "Offer already accepted"), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(sentBody(send)).toEqual(
      expect.objectContaining({
        code: "OFFER_ALREADY_ACCEPTED",
        title: "Offer already accepted",
        status: 409,
        type: "https://fixiyi.app/errors/offer-already-accepted",
      }),
    );
  });

  it("derives a generic code from a plain NestJS HttpException", () => {
    const filter = new ProblemDetailsFilter();
    const { host, send } = createHost();

    filter.catch(new BadRequestException("Invalid payload"), host);

    const body = sentBody(send);
    expect(body.status).toBe(HttpStatus.BAD_REQUEST);
    expect(body.code).toBe("BAD_REQUEST");
    expect(body.title).toBe("Invalid payload");
  });

  it("never leaks the internal error message for an unhandled exception", () => {
    const filter = new ProblemDetailsFilter();
    const { host, send, status } = createHost();

    filter.catch(new Error("connection string contains a password"), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = sentBody(send);
    expect(body.title).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("reuses an incoming x-trace-id header instead of generating a new one", () => {
    const filter = new ProblemDetailsFilter();
    const { host, send } = createHost({ "x-trace-id": "given-trace-id" });

    filter.catch(new BadRequestException("bad"), host);

    expect(sentBody(send).traceId).toBe("given-trace-id");
  });

  it("replaces an x-trace-id that could forge log lines or flood them (audit 2026-09-21)", () => {
    for (const hostile of ["abc\n[fake] admin logged in", "x".repeat(200), "id with spaces"]) {
      const filter = new ProblemDetailsFilter();
      const { host, send } = createHost({ "x-trace-id": hostile });

      filter.catch(new BadRequestException("bad"), host);

      expect(sentBody(send).traceId).not.toBe(hostile);
      expect(sentBody(send).traceId).toMatch(/^[\w-]{1,64}$/);
    }
  });

  it("generates a traceId when none is provided", () => {
    const filter = new ProblemDetailsFilter();
    const { host, send } = createHost();

    filter.catch(new BadRequestException("bad"), host);

    const body = sentBody(send);
    expect(typeof body.traceId).toBe("string");
    expect(body.traceId.length).toBeGreaterThan(0);
  });
});
