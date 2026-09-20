import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

import { SeedLockService } from "../common/seed/seed-lock.service.js";

import { CatalogService } from "./catalog.service.js";

const SEED_LOCK_KEY = "catalog-seed-v1";

/**
 * Realistic demo data (02_SPEC_ENGINEERING.md #117 — "donnees de demonstration
 * realistes", no sensitive data), following the worked example in
 * 01_SPEC_PRODUCT.md #235/#264 (Electricite -> Panne electrique -> Diagnostic
 * / reparation -> Intervention technique). Idempotent and race-safe via
 * `SeedLockService` — see its doc comment for the concurrency bug this fixes.
 */
@Injectable()
export class CatalogSeedService implements OnModuleInit {
  private readonly logger = new Logger(CatalogSeedService.name);

  constructor(
    private readonly catalog: CatalogService,
    private readonly seedLock: SeedLockService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedLock.runOnce(SEED_LOCK_KEY, () => this.seed());
  }

  private async seed(): Promise<void> {
    const skillIds = await this.seedSkills([
      "Cablage de base",
      "Lecture de plans electriques",
      "Diagnostic electrique",
      "Certification haute tension",
      "Soudure de tuyauterie",
    ]);
    const skill = (name: string): string => {
      const id = skillIds[name];
      if (!id) throw new Error(`Seed inconsistency: skill "${name}" was not created`);
      return id;
    };

    const electricite = await this.catalog.create({ level: "DOMAIN", name: "Electricite", order: 0 });
    const installation = await this.catalog.create({ level: "CATEGORY", parentId: electricite.id, name: "Installation electrique", order: 0 });
    const prise = await this.catalog.create({ level: "SERVICE", parentId: installation.id, name: "Installation de prise", order: 0 });
    const installationNeuve = await this.catalog.create({
      level: "INTERVENTION_TYPE",
      parentId: prise.id,
      name: "Installation neuve",
      order: 0,
    });
    await this.catalog.create({
      level: "COMPLEXITY",
      parentId: installationNeuve.id,
      name: "Simple",
      order: 0,
      requiredSkillIds: [skill("Cablage de base")],
    });
    await this.catalog.create({
      level: "COMPLEXITY",
      parentId: installationNeuve.id,
      name: "Intervention technique",
      order: 1,
      requiredSkillIds: [skill("Cablage de base"), skill("Lecture de plans electriques")],
    });

    const panne = await this.catalog.create({ level: "CATEGORY", parentId: electricite.id, name: "Panne electrique", order: 1 });
    const panneService = await this.catalog.create({ level: "SERVICE", parentId: panne.id, name: "Panne electrique", order: 0 });
    const diagnostic = await this.catalog.create({
      level: "INTERVENTION_TYPE",
      parentId: panneService.id,
      name: "Diagnostic / reparation",
      order: 0,
    });
    await this.catalog.create({ level: "COMPLEXITY", parentId: diagnostic.id, name: "Simple", order: 0 });
    await this.catalog.create({
      level: "COMPLEXITY",
      parentId: diagnostic.id,
      name: "Intervention technique",
      order: 1,
      requiredSkillIds: [skill("Diagnostic electrique")],
    });
    await this.catalog.create({
      level: "COMPLEXITY",
      parentId: diagnostic.id,
      name: "Intervention complexe / expert",
      order: 2,
      requiredSkillIds: [skill("Diagnostic electrique"), skill("Certification haute tension")],
    });

    const plomberie = await this.catalog.create({ level: "DOMAIN", name: "Plomberie", order: 1 });
    const fuite = await this.catalog.create({ level: "CATEGORY", parentId: plomberie.id, name: "Fuite d'eau", order: 0 });
    const reparationFuite = await this.catalog.create({ level: "SERVICE", parentId: fuite.id, name: "Reparation de fuite", order: 0 });
    const diagnosticFuite = await this.catalog.create({
      level: "INTERVENTION_TYPE",
      parentId: reparationFuite.id,
      name: "Diagnostic / reparation",
      order: 0,
    });
    await this.catalog.create({ level: "COMPLEXITY", parentId: diagnosticFuite.id, name: "Simple", order: 0 });
    await this.catalog.create({
      level: "COMPLEXITY",
      parentId: diagnosticFuite.id,
      name: "Intervention technique",
      order: 1,
      requiredSkillIds: [skill("Soudure de tuyauterie")],
    });

    this.logger.log("Catalog seeded (Electricite, Plomberie + 5 skills)");
  }

  private async seedSkills(names: string[]): Promise<Record<string, string>> {
    const ids: Record<string, string> = {};
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      if (!name) continue;
      const skill = await this.catalog.create({ level: "SKILL", name, order: i });
      ids[name] = skill.id;
    }
    return ids;
  }
}
