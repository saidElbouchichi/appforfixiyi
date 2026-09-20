import { z } from "zod";

import { IdSchema, IsoDateTimeSchema, PhoneE164Schema } from "./common.js";

export const CompanyStatusSchema = z.enum(["ACTIVE", "SUSPENDED"]);
export type CompanyStatus = z.infer<typeof CompanyStatusSchema>;

/** 01_SPEC_PRODUCT.md #25 — Company > Members/Technicians. */
export const CompanyMemberRoleSchema = z.enum(["OWNER", "MEMBER", "TECHNICIAN"]);
export type CompanyMemberRole = z.infer<typeof CompanyMemberRoleSchema>;

export const CompanyMemberStatusSchema = z.enum(["INVITED", "ACTIVE", "REMOVED"]);
export type CompanyMemberStatus = z.infer<typeof CompanyMemberStatusSchema>;

export const CompanySchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  legalName: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  representativeUserId: IdSchema,
  status: CompanyStatusSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Company = z.infer<typeof CompanySchema>;

export const CompanyMemberSchema = z.object({
  id: IdSchema,
  companyId: IdSchema,
  userId: IdSchema,
  role: CompanyMemberRoleSchema,
  status: CompanyMemberStatusSchema,
  invitedAt: IsoDateTimeSchema,
  joinedAt: IsoDateTimeSchema.nullable(),
});
export type CompanyMember = z.infer<typeof CompanyMemberSchema>;

export const CreateCompanyInputSchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().max(200).nullable().optional(),
  registrationNumber: z.string().max(100).nullable().optional(),
});
export type CreateCompanyInput = z.infer<typeof CreateCompanyInputSchema>;

/** The invited phone must already belong to a registered user (01_SPEC_PRODUCT.md #6) — no invite-a-stranger flow in Phase 3. */
export const InviteCompanyMemberInputSchema = z.object({
  phone: PhoneE164Schema,
  role: z.enum(["MEMBER", "TECHNICIAN"]),
});
export type InviteCompanyMemberInput = z.infer<typeof InviteCompanyMemberInputSchema>;
