import "reflect-metadata";

import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants.js";
import { describe, expect, it } from "vitest";

import { AuthController } from "../auth/auth.controller.js";
import { RATE_LIMIT_KEY, type RateLimitOptions } from "../auth/rate-limit/rate-limit.decorator.js";
import { CatalogController } from "../catalog/catalog.controller.js";
import { ChatController } from "../chat/chat.controller.js";
import { CompanyController } from "../companies/company.controller.js";
import { ConfigurationController } from "../configuration/configuration.controller.js";
import { HealthController } from "../health/health.controller.js";
import { MatchingController } from "../matching/matching.controller.js";
import { ProviderController } from "../providers/provider.controller.js";
import { RequestController } from "../requests/request.controller.js";
import { VerificationController } from "../verification/verification.controller.js";

/**
 * Every write route of the API carries a rate limit, counted per user
 * (Decision 60), except the unauthenticated ones, counted per IP. Checked on
 * the route metadata, so a route added later cannot skip it: the audit of
 * 2026-09-21 found 30 write routes out of 46 without any limit.
 */
const CONTROLLERS = [
  AuthController,
  CatalogController,
  ChatController,
  CompanyController,
  ConfigurationController,
  HealthController,
  MatchingController,
  ProviderController,
  RequestController,
  VerificationController,
];

/** No user yet on these: the quota can only be per IP. */
const UNAUTHENTICATED = new Set(["AuthController.requestOtp", "AuthController.verifyOtp", "AuthController.refresh"]);

interface Route {
  name: string;
  method: RequestMethod;
  limit: RateLimitOptions | undefined;
}

const routes: Route[] = CONTROLLERS.flatMap((controller) => {
  const prototype = controller.prototype as unknown as Record<string, object>;
  return Object.getOwnPropertyNames(controller.prototype)
    .filter((name) => name !== "constructor" && Reflect.getMetadata(PATH_METADATA, prototype[name] ?? {}) !== undefined)
    .map((name) => {
      const handler = prototype[name] ?? {};
      return {
        name: `${controller.name}.${name}`,
        method: Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod,
        limit: Reflect.getMetadata(RATE_LIMIT_KEY, handler) as RateLimitOptions | undefined,
      };
    });
});

const writes = routes.filter((route) => route.method !== RequestMethod.GET);

describe("rate limit coverage", () => {
  it("finds the API's write routes", () => {
    expect(writes.length).toBeGreaterThanOrEqual(46);
  });

  it("limits every write route", () => {
    expect(writes.filter((route) => route.limit === undefined).map((route) => route.name)).toEqual([]);
  });

  it("counts authenticated routes per user, unauthenticated ones per IP", () => {
    const wrongKey = writes.filter((route) => (route.limit?.key === "user") === UNAUTHENTICATED.has(route.name));
    expect(wrongKey.map((route) => route.name)).toEqual([]);
  });

  it("names every quota scope in kebab-case", () => {
    for (const route of writes) {
      expect(route.limit?.scope, route.name).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    }
  });
});
