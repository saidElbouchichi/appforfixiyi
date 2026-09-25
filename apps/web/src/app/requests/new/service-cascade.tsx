"use client";

import type { CatalogTreeNode } from "@fixiyi/contracts";
import { Card, Select, Skeleton } from "@fixiyi/ui";

/** The five levels the request form asks for, outermost first. */
export interface CascadeSelection {
  domainId: string;
  categoryId: string;
  serviceId: string;
  interventionTypeId: string;
  complexityId: string;
}

const EMPTY_BELOW: Record<keyof CascadeSelection, Partial<CascadeSelection>> = {
  domainId: { categoryId: "", serviceId: "", interventionTypeId: "", complexityId: "" },
  categoryId: { serviceId: "", interventionTypeId: "", complexityId: "" },
  serviceId: { interventionTypeId: "", complexityId: "" },
  interventionTypeId: { complexityId: "" },
  complexityId: {},
};

function toOptions(nodes: readonly CatalogTreeNode[]): { value: string; label: string }[] {
  return nodes.map((node) => ({ value: node.id, label: node.name }));
}

function childrenOf(nodes: readonly CatalogTreeNode[], parentId: string): CatalogTreeNode[] {
  return nodes.find((node) => node.id === parentId)?.children ?? [];
}

/**
 * Domain > Category > Service > InterventionType > Complexity, from the real
 * catalogue (Decision 78, extracted from the 379-line form).
 *
 * Choosing a level clears every level below it — `EMPTY_BELOW` states that
 * once instead of repeating four hand-written reset lists, which is where a
 * stale child selection used to be one forgotten line away.
 */
export function ServiceCascade({
  domains,
  selection,
  onChange,
  loading,
}: {
  domains: readonly CatalogTreeNode[];
  selection: CascadeSelection;
  onChange: (next: CascadeSelection) => void;
  loading: boolean;
}): React.JSX.Element {
  const categories = childrenOf(domains, selection.domainId);
  const services = childrenOf(categories, selection.categoryId);
  const interventionTypes = childrenOf(services, selection.serviceId);
  const complexities = childrenOf(interventionTypes, selection.interventionTypeId);

  const pick = (level: keyof CascadeSelection) => (value: string) => {
    onChange({ ...selection, [level]: value, ...EMPTY_BELOW[level] });
  };

  return (
    <Card title="Quel service vous faut-il ?" headingLevel={2}>
      {loading ? (
        <Skeleton lines={5} label="Chargement du catalogue…" />
      ) : (
        <div className="fx-animate-fade-in grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select testId="domain-select" label="Domaine" value={selection.domainId} options={toOptions(domains)} onChange={pick("domainId")} />
          <Select
            testId="category-select"
            label="Categorie"
            value={selection.categoryId}
            options={toOptions(categories)}
            onChange={pick("categoryId")}
          />
          <Select testId="service-select" label="Service" value={selection.serviceId} options={toOptions(services)} onChange={pick("serviceId")} />
          <Select
            testId="intervention-type-select"
            label="Type d'intervention"
            value={selection.interventionTypeId}
            options={toOptions(interventionTypes)}
            onChange={pick("interventionTypeId")}
          />
          <Select
            testId="complexity-select"
            label="Complexite"
            value={selection.complexityId}
            options={toOptions(complexities)}
            onChange={pick("complexityId")}
          />
        </div>
      )}
    </Card>
  );
}
