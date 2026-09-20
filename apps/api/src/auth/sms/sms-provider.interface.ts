export const SMS_PROVIDER = Symbol("SMS_PROVIDER");

/** Abstraction over the actual SMS gateway — swappable per 01_SPEC_PRODUCT.md #118 (dev mode adapters). */
export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}
