import type {
  CreateTargetMediaUploadSessionInput,
  CreateUploadSessionOutput,
  Media,
  RequestStatus,
  ServiceRequest,
  UpdateServiceRequestInput,
} from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { CatalogService } from "../catalog/catalog.service.js";
import { DomainHttpException } from "../common/exceptions/domain-http.exception.js";
import { MediaService } from "../media/media.service.js";

import { ServiceRequestEntity, type ServiceRequestDocument } from "./schemas/service-request.schema.js";

const EDITABLE_STATUSES: RequestStatus[] = ["DRAFT"];
/** 01_SPEC_PRODUCT.md — a client may still pull out while the search is running; the dispatch loop notices and stops. */
const CANCELLABLE_STATUSES: RequestStatus[] = ["DRAFT", "REQUESTED", "MATCHING"];

/**
 * `ServiceRequest` state machine, narrowed for Phase 4 (Decision 35):
 * `DRAFT -> REQUESTED` (+ `CANCELLED` any time before matching). `MATCHING`
 * is a valid, tested contract state but nothing here transitions into it —
 * that's Phase 5's job once a real matching engine exists.
 */
@Injectable()
export class RequestService {
  constructor(
    @InjectModel(ServiceRequestEntity.name) private readonly model: Model<ServiceRequestEntity>,
    private readonly catalog: CatalogService,
    private readonly media: MediaService,
  ) {}

  async create(clientUserId: string): Promise<ServiceRequest> {
    const created = await this.model.create({ _id: generateId(), clientUserId, status: "DRAFT" });
    return this.toServiceRequest(created);
  }

  async listMine(clientUserId: string): Promise<ServiceRequest[]> {
    const docs = await this.model.find({ clientUserId }).sort({ createdAt: -1 });
    return Promise.all(docs.map((doc) => this.toServiceRequest(doc)));
  }

  async getById(id: string, clientUserId: string): Promise<ServiceRequest> {
    const doc = await this.requireOwned(id, clientUserId);
    return this.toServiceRequest(doc);
  }

  /** Reusable by other modules (the matching engine acts for the system, not for an owner) — `null`, not a throw, when absent. */
  async findById(id: string): Promise<ServiceRequest | null> {
    const doc = await this.model.findById(id);
    return doc ? this.toServiceRequest(doc) : null;
  }

  /**
   * `REQUESTED -> MATCHING` — the transition Phase 4 deliberately left
   * unwired (Decision 35). Only the matching engine calls it, and only when
   * it really starts dispatching.
   */
  async markMatching(id: string): Promise<void> {
    const doc = await this.model.findById(id);
    if (!doc) {
      throw new NotFoundException("Request not found");
    }
    if (doc.status !== "REQUESTED") {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "REQUEST_NOT_MATCHABLE",
        `Only a REQUESTED request can enter matching (current status: ${doc.status}).`,
      );
    }
    doc.status = "MATCHING";
    await doc.save();
  }

  async update(id: string, clientUserId: string, input: UpdateServiceRequestInput): Promise<ServiceRequest> {
    const doc = await this.requireEditable(id, clientUserId);

    if (input.serviceId !== undefined || input.interventionTypeId !== undefined || input.complexityId !== undefined) {
      await this.assertValidCatalogChain(
        input.serviceId ?? doc.serviceId,
        input.interventionTypeId ?? doc.interventionTypeId,
        input.complexityId ?? doc.complexityId,
      );
    }

    if (input.serviceId !== undefined) doc.serviceId = input.serviceId;
    if (input.interventionTypeId !== undefined) doc.interventionTypeId = input.interventionTypeId;
    if (input.complexityId !== undefined) doc.complexityId = input.complexityId;
    if (input.description !== undefined) doc.description = input.description;
    if (input.urgency !== undefined) doc.urgency = input.urgency;
    if (input.location !== undefined) {
      doc.location = { address: input.location.address ?? null, point: input.location.point };
    }

    await doc.save();
    return this.toServiceRequest(doc);
  }

  async createMediaUploadSession(
    id: string,
    clientUserId: string,
    input: CreateTargetMediaUploadSessionInput,
  ): Promise<CreateUploadSessionOutput> {
    await this.requireEditable(id, clientUserId);
    return this.media.createUploadSession(clientUserId, { targetType: "REQUEST", targetId: id, ...input });
  }

  async finalizeMedia(id: string, clientUserId: string, mediaId: string): Promise<Media> {
    await this.requireEditable(id, clientUserId);
    return this.media.finalize(mediaId, clientUserId);
  }

  async listMedia(id: string, clientUserId: string): Promise<Media[]> {
    await this.requireOwned(id, clientUserId);
    return this.media.listForTarget("REQUEST", id);
  }

  /** Requires every field a provider will need to evaluate the request — DRAFT -> REQUESTED only (Decision 35). */
  async submit(id: string, clientUserId: string): Promise<ServiceRequest> {
    const doc = await this.requireEditable(id, clientUserId);
    if (!doc.serviceId || !doc.interventionTypeId || !doc.complexityId || !doc.description || !doc.urgency || !doc.location) {
      throw new DomainHttpException(
        HttpStatus.BAD_REQUEST,
        "REQUEST_INCOMPLETE",
        "serviceId, interventionTypeId, complexityId, description, urgency and location are all required before submitting.",
      );
    }
    doc.status = "REQUESTED";
    await doc.save();
    return this.toServiceRequest(doc);
  }

  async cancel(id: string, clientUserId: string): Promise<ServiceRequest> {
    const doc = await this.requireOwned(id, clientUserId);
    if (!CANCELLABLE_STATUSES.includes(doc.status)) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, "REQUEST_NOT_CANCELLABLE", `Cannot cancel a request in status ${doc.status}.`);
    }
    doc.status = "CANCELLED";
    await doc.save();
    return this.toServiceRequest(doc);
  }

  private async requireOwned(id: string, clientUserId: string): Promise<ServiceRequestDocument> {
    const doc = await this.model.findById(id);
    if (!doc) {
      throw new NotFoundException("Request not found");
    }
    if (doc.clientUserId !== clientUserId) {
      throw new ForbiddenException("Not the owner of this request.");
    }
    return doc;
  }

  private async requireEditable(id: string, clientUserId: string): Promise<ServiceRequestDocument> {
    const doc = await this.requireOwned(id, clientUserId);
    if (!EDITABLE_STATUSES.includes(doc.status)) {
      throw new DomainHttpException(HttpStatus.BAD_REQUEST, "REQUEST_NOT_EDITABLE", `Cannot edit a request in status ${doc.status}.`);
    }
    return doc;
  }

  /** Re-validates the WHOLE effective parent chain whenever any of the three is touched — leaving a stale, now-inconsistent child in place would be a silent data bug. */
  private async assertValidCatalogChain(
    serviceId: string | null,
    interventionTypeId: string | null,
    complexityId: string | null,
  ): Promise<void> {
    if (serviceId) {
      const count = await this.catalog.countExisting([serviceId], "SERVICE");
      if (count !== 1) {
        throw new DomainHttpException(HttpStatus.BAD_REQUEST, "REQUEST_SERVICE_INVALID", "serviceId must reference an existing SERVICE node.");
      }
    }

    if (interventionTypeId) {
      if (!serviceId) {
        throw new DomainHttpException(
          HttpStatus.BAD_REQUEST,
          "REQUEST_INTERVENTION_TYPE_REQUIRES_SERVICE",
          "interventionTypeId requires a serviceId.",
        );
      }
      const node = await this.catalog.getById(interventionTypeId);
      if (node?.level !== "INTERVENTION_TYPE" || node.parentId !== serviceId) {
        throw new DomainHttpException(
          HttpStatus.BAD_REQUEST,
          "REQUEST_INTERVENTION_TYPE_INVALID",
          "interventionTypeId must reference an INTERVENTION_TYPE node that is a child of serviceId.",
        );
      }
    }

    if (complexityId) {
      if (!interventionTypeId) {
        throw new DomainHttpException(
          HttpStatus.BAD_REQUEST,
          "REQUEST_COMPLEXITY_REQUIRES_INTERVENTION_TYPE",
          "complexityId requires an interventionTypeId.",
        );
      }
      const node = await this.catalog.getById(complexityId);
      if (node?.level !== "COMPLEXITY" || node.parentId !== interventionTypeId) {
        throw new DomainHttpException(
          HttpStatus.BAD_REQUEST,
          "REQUEST_COMPLEXITY_INVALID",
          "complexityId must reference a COMPLEXITY node that is a child of interventionTypeId.",
        );
      }
    }
  }

  private async toServiceRequest(doc: ServiceRequestDocument): Promise<ServiceRequest> {
    const mediaIds = await this.media.listReadyIdsForTarget("REQUEST", doc._id);
    return {
      id: doc._id,
      clientUserId: doc.clientUserId,
      serviceId: doc.serviceId,
      interventionTypeId: doc.interventionTypeId,
      complexityId: doc.complexityId,
      description: doc.description,
      urgency: doc.urgency,
      location: doc.location
        ? {
            address: doc.location.address,
            point: { type: "Point", coordinates: [doc.location.point.coordinates[0] ?? 0, doc.location.point.coordinates[1] ?? 0] },
          }
        : null,
      mediaIds,
      status: doc.status,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }
}
