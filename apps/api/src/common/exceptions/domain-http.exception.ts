import { HttpException, type HttpExceptionOptions } from "@nestjs/common";

/**
 * Base class for exceptions that need an explicit, stable, machine-readable
 * `code` in the Problem Details body — 02_SPEC_ENGINEERING.md #62. Domain
 * modules (auth, offers, wallet, ...) should throw subclasses of this
 * instead of raw NestJS HttpExceptions once they need a specific error code
 * (e.g. `OFFER_ALREADY_ACCEPTED`) rather than a generic HTTP status name.
 */
export class DomainHttpException extends HttpException {
  readonly code: string;

  constructor(status: number, code: string, message: string, options?: HttpExceptionOptions) {
    super(message, status, options);
    this.code = code;
  }
}
