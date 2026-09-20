import type {
  RequestDocumentUploadInput,
  RequestDocumentUploadOutput,
  SubmitVerificationDecisionInput,
  UserRole,
  VerificationCase,
  VerificationDecision,
  VerificationDecisionOutcome,
  VerificationDocument,
  VerificationStatus,
  VerificationTargetType,
} from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { DomainHttpException } from "../common/exceptions/domain-http.exception.js";
import { CompanyService } from "../companies/company.service.js";
import { StorageService } from "../infrastructure/storage/storage.service.js";
import { ProviderService } from "../providers/provider.service.js";

import { VerificationCaseEntity, type VerificationCaseDocument } from "./schemas/verification-case.schema.js";
import { VerificationDecisionEntity, type VerificationDecisionDocument } from "./schemas/verification-decision.schema.js";
import { VerificationDocumentEntity, type VerificationDocumentDocument } from "./schemas/verification-document.schema.js";

const REVIEWER_ROLES: UserRole[] = ["VERIFICATION_AGENT", "ADMIN", "MODERATOR"];
const SUBMITTABLE_STATUSES: VerificationStatus[] = ["DRAFT", "NEEDS_CORRECTION"];

@Injectable()
export class VerificationService {
  constructor(
    @InjectModel(VerificationCaseEntity.name) private readonly caseModel: Model<VerificationCaseEntity>,
    @InjectModel(VerificationDocumentEntity.name) private readonly documentModel: Model<VerificationDocumentEntity>,
    @InjectModel(VerificationDecisionEntity.name) private readonly decisionModel: Model<VerificationDecisionEntity>,
    private readonly providers: ProviderService,
    private readonly companies: CompanyService,
    private readonly storage: StorageService,
  ) {}

  async getOrCreateCase(targetType: VerificationTargetType, targetId: string, actorUserId: string): Promise<VerificationCase> {
    await this.assertOwnsTarget(targetType, targetId, actorUserId);
    const existing = await this.caseModel.findOne({ targetType, targetId });
    if (existing) {
      return toVerificationCase(existing);
    }
    const created = await this.caseModel.create({ _id: generateId(), targetType, targetId, status: "DRAFT" });
    return toVerificationCase(created);
  }

  async getById(caseId: string, actorUserId: string, actorRoles: UserRole[]): Promise<VerificationCase> {
    const kase = await this.requireCase(caseId);
    await this.assertCanView(kase, actorUserId, actorRoles);
    return toVerificationCase(kase);
  }

  async listDocuments(caseId: string, actorUserId: string, actorRoles: UserRole[]): Promise<VerificationDocument[]> {
    const kase = await this.requireCase(caseId);
    await this.assertCanView(kase, actorUserId, actorRoles);
    const docs = await this.documentModel.find({ caseId }).sort({ createdAt: 1 });
    return docs.map(toVerificationDocument);
  }

  async listDecisions(caseId: string, actorUserId: string, actorRoles: UserRole[]): Promise<VerificationDecision[]> {
    const kase = await this.requireCase(caseId);
    await this.assertCanView(kase, actorUserId, actorRoles);
    const decisions = await this.decisionModel.find({ caseId }).sort({ createdAt: 1 });
    return decisions.map(toVerificationDecision);
  }

  async requestDocumentUpload(caseId: string, actorUserId: string, input: RequestDocumentUploadInput): Promise<RequestDocumentUploadOutput> {
    const kase = await this.getOwnedCaseForEdit(caseId, actorUserId);

    const documentId = generateId();
    const objectKey = `verification/${kase._id}/${documentId}-${sanitizeFileName(input.fileName)}`;
    await this.documentModel.create({ _id: documentId, caseId: kase._id, type: input.type, status: "PENDING_UPLOAD", objectKey });

    const presigned = await this.storage.createPresignedUploadUrl(objectKey, input.contentType);
    return { documentId, uploadUrl: presigned.url, objectKey, expiresInSeconds: presigned.expiresInSeconds };
  }

  async confirmDocumentUpload(documentId: string, actorUserId: string): Promise<VerificationDocument> {
    const doc = await this.documentModel.findById(documentId);
    if (!doc) {
      throw new NotFoundException("Document not found");
    }
    await this.getOwnedCaseForEdit(doc.caseId, actorUserId);

    const exists = await this.storage.objectExists(doc.objectKey);
    if (!exists) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "VERIFICATION_DOCUMENT_NOT_UPLOADED",
        "The file has not actually been uploaded to storage yet — PUT it to the presigned URL first.",
      );
    }
    doc.status = "UPLOADED";
    await doc.save();
    return toVerificationDocument(doc);
  }

  async submit(caseId: string, actorUserId: string): Promise<VerificationCase> {
    const kase = await this.getOwnedCaseForEdit(caseId, actorUserId);

    const uploadedCount = await this.documentModel.countDocuments({ caseId: kase._id, status: "UPLOADED" });
    if (uploadedCount === 0) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "VERIFICATION_NO_DOCUMENTS",
        "At least one uploaded document is required before submitting for review.",
      );
    }

    kase.status = "IN_REVIEW";
    await kase.save();
    return toVerificationCase(kase);
  }

  /** `@Roles("VERIFICATION_AGENT", "ADMIN")` enforced at the controller — this only validates the state transition. */
  async decide(caseId: string, decidedByUserId: string, input: SubmitVerificationDecisionInput): Promise<VerificationCase> {
    const kase = await this.requireCase(caseId);
    const nextStatus = outcomeToStatus(input.outcome);

    const validTransition =
      (input.outcome !== "SUSPENDED" && kase.status === "IN_REVIEW") || (input.outcome === "SUSPENDED" && kase.status === "VERIFIED");
    if (!validTransition) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "VERIFICATION_INVALID_TRANSITION",
        `Cannot apply outcome ${input.outcome} to a case in status ${kase.status}.`,
      );
    }

    await this.decisionModel.create({
      _id: generateId(),
      caseId: kase._id,
      decidedByUserId,
      outcome: input.outcome,
      reason: input.reason ?? null,
    });

    kase.status = nextStatus;
    await kase.save();
    return toVerificationCase(kase);
  }

  private async requireCase(caseId: string): Promise<VerificationCaseDocument> {
    const kase = await this.caseModel.findById(caseId);
    if (!kase) {
      throw new NotFoundException("Verification case not found");
    }
    return kase;
  }

  /** Case must belong to the actor AND still be editable (DRAFT/NEEDS_CORRECTION) — used by every owner-mutation. */
  private async getOwnedCaseForEdit(caseId: string, actorUserId: string): Promise<VerificationCaseDocument> {
    const kase = await this.requireCase(caseId);
    await this.assertOwnsTarget(kase.targetType, kase.targetId, actorUserId);
    if (!SUBMITTABLE_STATUSES.includes(kase.status)) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "VERIFICATION_CASE_NOT_EDITABLE",
        `Cannot edit a case in status ${kase.status}.`,
      );
    }
    return kase;
  }

  private async assertCanView(kase: VerificationCaseDocument, actorUserId: string, actorRoles: UserRole[]): Promise<void> {
    if (actorRoles.some((role) => REVIEWER_ROLES.includes(role))) {
      return;
    }
    const owns = await this.ownsTarget(kase.targetType, kase.targetId, actorUserId);
    if (!owns) {
      throw new ForbiddenException("Not the owner of this verification case.");
    }
  }

  private async assertOwnsTarget(targetType: VerificationTargetType, targetId: string, userId: string): Promise<void> {
    if (!(await this.ownsTarget(targetType, targetId, userId))) {
      throw new ForbiddenException(`Not the owner of this ${targetType.toLowerCase()}.`);
    }
  }

  private async ownsTarget(targetType: VerificationTargetType, targetId: string, userId: string): Promise<boolean> {
    if (targetType === "PROVIDER") {
      const profile = await this.providers.findById(targetId);
      return profile?.userId === userId;
    }
    return this.companies.isActiveOwner(targetId, userId);
  }
}

function outcomeToStatus(outcome: VerificationDecisionOutcome): VerificationStatus {
  switch (outcome) {
    case "APPROVED":
      return "VERIFIED";
    case "REJECTED":
      return "REJECTED";
    case "CORRECTION_REQUESTED":
      return "NEEDS_CORRECTION";
    case "SUSPENDED":
      return "SUSPENDED";
  }
}

/** Keeps the object key readable/debuggable while staying safe for an S3 key. */
function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
}

function toVerificationCase(doc: VerificationCaseDocument): VerificationCase {
  return {
    id: doc._id,
    targetType: doc.targetType,
    targetId: doc.targetId,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toVerificationDocument(doc: VerificationDocumentDocument): VerificationDocument {
  return {
    id: doc._id,
    caseId: doc.caseId,
    type: doc.type,
    status: doc.status,
    objectKey: doc.objectKey,
    createdAt: doc.createdAt.toISOString(),
  };
}

function toVerificationDecision(doc: VerificationDecisionDocument): VerificationDecision {
  return {
    id: doc._id,
    caseId: doc.caseId,
    decidedByUserId: doc.decidedByUserId,
    outcome: doc.outcome,
    reason: doc.reason,
    createdAt: doc.createdAt.toISOString(),
  };
}
