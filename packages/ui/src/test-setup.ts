import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Testing Library only auto-registers its cleanup when Vitest runs with
 * `globals: true`. This package keeps `globals: false` (the convention in
 * the other packages), so the unmount between tests is registered here
 * explicitly — without it every render leaks into the next test and
 * `getByRole` starts finding several matches.
 */
afterEach(() => {
  cleanup();
});
