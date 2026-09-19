/**
 * Diagnostic-only queue: proves the BullMQ + Redis pipeline works end-to-end
 * (enqueue -> process -> complete). Business queues (notifications, matching,
 * ai, media, search-indexing, risk, analytics, cleanup —
 * 02_SPEC_ENGINEERING.md #58) are added phase by phase, starting Phase 2.
 */
export const SYSTEM_QUEUE_NAME = "system";
