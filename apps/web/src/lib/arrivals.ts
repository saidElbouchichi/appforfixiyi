/**
 * Which chat messages are news. A message that arrives while the thread is
 * open — sent, or pushed by the other side — plays an entry animation: it
 * shows where the new content landed. The history the thread opened on does
 * not: replaying fifty entries at once on every visit says nothing (design
 * phase 12, measured: every message animated again on each reopen).
 *
 * The baseline is the highest `seq` present when the first load settles.
 * `seq` only grows, so older pages loaded later sit below it and stay still.
 */
export function settleBaseline(current: number | null, loading: boolean, seqs: readonly number[]): number | null {
  if (current !== null || loading) return current;
  return Math.max(0, ...seqs);
}

export function isArrival(seq: number, baseline: number | null): boolean {
  return baseline !== null && seq > baseline;
}
