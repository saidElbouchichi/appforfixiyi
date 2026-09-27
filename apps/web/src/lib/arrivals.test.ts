import { describe, expect, it } from "vitest";

import { isArrival, settleBaseline } from "./arrivals";

describe("settleBaseline", () => {
  it("stays unset while the thread is loading", () => {
    expect(settleBaseline(null, true, [1, 2])).toBeNull();
  });

  it("settles on the highest seq present when loading ends", () => {
    expect(settleBaseline(null, false, [3, 1, 7])).toBe(7);
  });

  it("settles at zero on an empty thread, so the first message is an arrival", () => {
    expect(settleBaseline(null, false, [])).toBe(0);
  });

  it("never moves once settled: later messages stay arrivals", () => {
    expect(settleBaseline(7, false, [7, 8, 9])).toBe(7);
  });
});

describe("isArrival", () => {
  it("is false before the baseline is known: the first paint is history", () => {
    expect(isArrival(5, null)).toBe(false);
  });

  it("is false for history, including older pages loaded later", () => {
    expect(isArrival(7, 7)).toBe(false);
    expect(isArrival(2, 7)).toBe(false);
  });

  it("is true for a message that came after the thread opened", () => {
    expect(isArrival(8, 7)).toBe(true);
  });
});
