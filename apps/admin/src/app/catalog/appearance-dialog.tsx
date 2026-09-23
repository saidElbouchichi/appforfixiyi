"use client";

import {
  CATALOG_ICONS,
  TRADE_ACCENT_COLORS,
  type CatalogAccentColor,
  type CatalogIcon,
  type CatalogTreeNode,
} from "@fixiyi/contracts";
import { Button, Icon, Modal, Select } from "@fixiyi/ui";
import { useState } from "react";

/** What the back-office sends back; `null` on either field means "inherit from the ancestor again". */
export interface AppearanceValue {
  icon: CatalogIcon | null;
  accentColor: CatalogAccentColor | null;
}

const INHERIT = "";

/**
 * Icon and colour of a catalogue node (Decision 62 / D3). Both lists are
 * closed in `@fixiyi/contracts`, so this screen can only offer values the API
 * accepts and the Design System can draw.
 *
 * The dialog reads the node's RAW value (the page asks the tree for
 * `rawDisplay=true`): an empty field means the node inherits, and leaving it
 * empty keeps that inheritance rather than freezing a copy of today's
 * ancestor value.
 */
export function AppearanceDialog({
  node,
  onClose,
  onSubmit,
  saving,
}: {
  node: CatalogTreeNode | null;
  onClose: () => void;
  onSubmit: (value: AppearanceValue) => void;
  saving: boolean;
}): React.JSX.Element {
  const [icon, setIcon] = useState<string>(node?.icon ?? INHERIT);
  const [accentColor, setAccentColor] = useState<string>(node?.accentColor ?? INHERIT);

  return (
    <Modal
      open={node !== null}
      title={node === null ? "" : `Apparence — ${node.name}`}
      onClose={onClose}
      testId="appearance-modal"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            loading={saving}
            testId="appearance-submit"
            onClick={() => {
              onSubmit({
                icon: icon === INHERIT ? null : (icon as CatalogIcon),
                accentColor: accentColor === INHERIT ? null : (accentColor as CatalogAccentColor),
              });
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <p className="text-[var(--fixiyi-color-text-subtle)]">
        Laissez vide pour heriter du noeud parent. L&apos;icone et la couleur choisies ici s&apos;appliquent aussi a tous les noeuds en dessous qui
        n&apos;ont pas la leur.
      </p>
      <Select
        label="Icone"
        value={icon}
        onChange={setIcon}
        testId="appearance-icon"
        placeholder="Heriter du parent"
        options={CATALOG_ICONS.map((name) => ({ value: name, label: name }))}
      />
      <Select
        label="Couleur de metier"
        value={accentColor}
        onChange={setAccentColor}
        testId="appearance-accent"
        placeholder="Heriter du parent"
        options={TRADE_ACCENT_COLORS.map((name) => ({ value: name, label: name }))}
      />
      {icon === INHERIT ? null : (
        <p className="fx-row">
          <span>Apercu :</span>
          <Icon name={icon as CatalogIcon} size="lg" />
        </p>
      )}
    </Modal>
  );
}
