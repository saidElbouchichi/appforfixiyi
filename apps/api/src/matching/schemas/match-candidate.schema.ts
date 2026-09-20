import type { MatchCandidateStatus, ScoreBreakdown } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import type { HydratedDocument } from "mongoose";

/**
 * A provider that was actually dispatched to. Candidates are only written
 * when a batch is sent — providers merely considered and not selected are
 * never stored, so ranking is recomputed fresh for each batch (availability
 * and radius change between batches).
 *
 * These rows are also the real history behind the `exploration` signal:
 * counting a provider's past candidacies is how "has this provider had
 * enough exposure?" is answered without inventing a metric.
 */
@Schema({ collection: "match_candidates", timestamps: true, versionKey: false })
export class MatchCandidateEntity {
  @Prop({ type: String, default: () => generateId() })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  matchId!: string;

  @Prop({ type: String, required: true, index: true })
  providerId!: string;

  @Prop({ type: String, required: true })
  providerUserId!: string;

  @Prop({ type: String, required: true })
  requestId!: string;

  @Prop({ type: Number, required: true })
  batchIndex!: number;

  @Prop({ type: String, required: true, default: "NOTIFIED" })
  status!: MatchCandidateStatus;

  @Prop({ type: Number, required: true })
  score!: number;

  @Prop({ type: Object, required: true })
  scoreBreakdown!: ScoreBreakdown;

  @Prop({ type: Number, required: true })
  distanceKm!: number;

  @Prop({ type: String, default: null })
  declineReason!: string | null;

  @Prop({ type: Date, required: true })
  dispatchedAt!: Date;

  @Prop({ type: Date, required: true })
  expiresAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type MatchCandidateDocument = HydratedDocument<MatchCandidateEntity>;
export const MatchCandidateEntitySchema = SchemaFactory.createForClass(MatchCandidateEntity);
/** A provider is contacted at most once per match — guards against a re-dispatch bug spamming them (01_SPEC_PRODUCT.md #15). */
MatchCandidateEntitySchema.index({ matchId: 1, providerId: 1 }, { unique: true });
MatchCandidateEntitySchema.index({ providerUserId: 1, status: 1 });
