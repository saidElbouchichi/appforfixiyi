import { imageSize } from "image-size";

/**
 * Real metadata extraction (PHASE_4_PLAN.md "Process" step) — reads
 * dimensions from actual image bytes. Best-effort: a failure here doesn't
 * reject the file (that's Scan's job) — it just leaves width/height `null`.
 * Video/audio duration extraction would need a heavier dependency
 * (ffprobe) — out of scope for Phase 4 (documented limitation).
 */
export function extractImageDimensions(bytes: Buffer): { width: number; height: number } | null {
  try {
    const { width, height } = imageSize(bytes);
    return width > 0 && height > 0 ? { width, height } : null;
  } catch {
    return null;
  }
}
