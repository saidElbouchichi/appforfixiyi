import type { Company, CompanyMember, CreateCompanyInput, InviteCompanyMemberInput } from "@fixiyi/contracts";
import { generateId } from "@fixiyi/shared-utils";
import { ForbiddenException, HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import type { Model } from "mongoose";

import { UserEntity } from "../auth/schemas/user.schema.js";
import { DomainHttpException } from "../common/exceptions/domain-http.exception.js";

import { CompanyMemberEntity, type CompanyMemberDocument } from "./schemas/company-member.schema.js";
import { CompanyEntity, type CompanyDocument } from "./schemas/company.schema.js";

@Injectable()
export class CompanyService {
  constructor(
    @InjectModel(CompanyEntity.name) private readonly companyModel: Model<CompanyEntity>,
    @InjectModel(CompanyMemberEntity.name) private readonly memberModel: Model<CompanyMemberEntity>,
    @InjectModel(UserEntity.name) private readonly userModel: Model<UserEntity>,
  ) {}

  async create(userId: string, input: CreateCompanyInput): Promise<Company> {
    const company = await this.companyModel.create({
      _id: generateId(),
      name: input.name,
      legalName: input.legalName ?? null,
      registrationNumber: input.registrationNumber ?? null,
      representativeUserId: userId,
      status: "ACTIVE",
    });

    const now = new Date();
    await this.memberModel.create({
      _id: generateId(),
      companyId: company._id,
      userId,
      role: "OWNER",
      status: "ACTIVE",
      invitedAt: now,
      joinedAt: now,
    });

    return toCompany(company);
  }

  async getById(id: string): Promise<Company> {
    const doc = await this.companyModel.findById(id);
    if (!doc) {
      throw new NotFoundException("Company not found");
    }
    return toCompany(doc);
  }

  async listMine(userId: string): Promise<Company[]> {
    const memberships = await this.memberModel.find({ userId, status: { $in: ["ACTIVE", "INVITED"] } });
    if (memberships.length === 0) {
      return [];
    }
    const companies = await this.companyModel.find({ _id: { $in: memberships.map((m) => m.companyId) } });
    return companies.map(toCompany);
  }

  async listMembers(companyId: string): Promise<CompanyMember[]> {
    const members = await this.memberModel.find({ companyId });
    return members.map(toCompanyMember);
  }

  /** Only an active OWNER can invite (01_SPEC_PRODUCT.md #25 — "l'entreprise reste responsable commercialement"). */
  async invite(companyId: string, actorUserId: string, input: InviteCompanyMemberInput): Promise<CompanyMember> {
    await this.assertIsActiveOwner(companyId, actorUserId);

    const targetUser = await this.userModel.findOne({ phone: input.phone });
    if (!targetUser) {
      throw new DomainHttpException(
        HttpStatus.NOT_FOUND,
        "USER_NOT_FOUND",
        "No registered user with this phone number — they must sign up first (01_SPEC_PRODUCT.md #6).",
      );
    }

    const existing = await this.memberModel.findOne({ companyId, userId: targetUser._id });
    if (existing) {
      throw new DomainHttpException(HttpStatus.CONFLICT, "COMPANY_MEMBER_ALREADY_EXISTS", "This user is already a member of this company.");
    }

    const created = await this.memberModel.create({
      _id: generateId(),
      companyId,
      userId: targetUser._id,
      role: input.role,
      status: "INVITED",
      invitedAt: new Date(),
      joinedAt: null,
    });
    return toCompanyMember(created);
  }

  async acceptInvite(companyId: string, userId: string): Promise<CompanyMember> {
    const member = await this.memberModel.findOne({ companyId, userId });
    if (member?.status !== "INVITED") {
      throw new NotFoundException("No pending invite found for this company");
    }
    member.status = "ACTIVE";
    member.joinedAt = new Date();
    await member.save();
    return toCompanyMember(member);
  }

  async removeMember(companyId: string, actorUserId: string, memberId: string): Promise<void> {
    await this.assertIsActiveOwner(companyId, actorUserId);

    const member = await this.memberModel.findOne({ _id: memberId, companyId });
    if (!member) {
      throw new NotFoundException("Member not found");
    }

    if (member.role === "OWNER") {
      const activeOwners = await this.memberModel.countDocuments({ companyId, role: "OWNER", status: "ACTIVE" });
      if (activeOwners <= 1) {
        throw new DomainHttpException(HttpStatus.BAD_REQUEST, "COMPANY_LAST_OWNER", "Cannot remove the last owner of a company.");
      }
    }

    member.status = "REMOVED";
    await member.save();
  }

  /** Reusable by other modules (e.g. VerificationService checking who may act on a COMPANY verification case). */
  async isActiveOwner(companyId: string, userId: string): Promise<boolean> {
    const membership = await this.memberModel.findOne({ companyId, userId, role: "OWNER", status: "ACTIVE" });
    return membership !== null;
  }

  private async assertIsActiveOwner(companyId: string, userId: string): Promise<void> {
    if (!(await this.isActiveOwner(companyId, userId))) {
      throw new ForbiddenException("Only an active owner of this company can perform this action.");
    }
  }
}

function toCompany(doc: CompanyDocument): Company {
  return {
    id: doc._id,
    name: doc.name,
    legalName: doc.legalName,
    registrationNumber: doc.registrationNumber,
    representativeUserId: doc.representativeUserId,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toCompanyMember(doc: CompanyMemberDocument): CompanyMember {
  return {
    id: doc._id,
    companyId: doc.companyId,
    userId: doc.userId,
    role: doc.role,
    status: doc.status,
    invitedAt: doc.invitedAt.toISOString(),
    joinedAt: doc.joinedAt ? doc.joinedAt.toISOString() : null,
  };
}
