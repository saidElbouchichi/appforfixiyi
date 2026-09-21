import type { ContactPolicy } from "@fixiyi/contracts";
import { Injectable } from "@nestjs/common";

import { redactContacts, type RedactionResult } from "./contact-detection.js";

/**
 * 01_SPEC_PRODUCT.md #27 names this service. The detection itself is a pure
 * function (`contact-detection.ts`, tested on its own); this is the one place
 * that decides WHEN it applies.
 *
 * Applied to everything a participant can put in front of the other one
 * while contact is protected: message bodies, edits (otherwise editing an
 * innocent message afterwards becomes the way around the detector) and
 * attachment file names (a file can be called "0612345678.jpg").
 */
@Injectable()
export class ContactDetectionService {
  protect(text: string, policy: ContactPolicy): RedactionResult {
    if (policy === "UNLOCKED") {
      return { text, redactions: [] };
    }
    return redactContacts(text);
  }
}
