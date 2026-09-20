export const EMAIL_PROVIDER = Symbol("EMAIL_PROVIDER");

/** Abstraction over the actual email gateway — swappable per 01_SPEC_PRODUCT.md #118 (dev mode adapters). */
export interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<void>;
}
