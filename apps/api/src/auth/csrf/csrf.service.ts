import { randomBytes, timingSafeEqual } from "node:crypto";

import { Injectable } from "@nestjs/common";

/**
 * Double-submit cookie CSRF defense (01_SPEC_PRODUCT.md #69) — no server
 * secret needed: the security property comes from the Same-Origin Policy
 * preventing a third-party page from reading the non-HttpOnly CSRF cookie to
 * replay it in a header, not from the token's own cryptographic strength.
 */
@Injectable()
export class CsrfService {
  generateToken(): string {
    return randomBytes(32).toString("hex");
  }

  matches(cookieValue: string | undefined, headerValue: string | undefined): boolean {
    if (!cookieValue || !headerValue) {
      return false;
    }
    const a = Buffer.from(cookieValue);
    const b = Buffer.from(headerValue);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
