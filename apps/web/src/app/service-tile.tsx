"use client";

import type { CatalogTreeNode } from "@fixiyi/contracts";
import { tradeIconColors } from "@fixiyi/design-tokens";
import { Icon } from "@fixiyi/ui";
import Link from "next/link";

import { tradeFill } from "../lib/catalog";

/**
 * One catalogue node as a tile: the trade icon on a pastille of its colour,
 * the name underneath in ordinary text colour.
 *
 * Why the name is not ON the pastille: an icon is a graphical object (3:1),
 * text is not (4.5:1), and `locksmith` clears neither 4.5:1 with white nor
 * with ink. Keeping the label outside lets every trade keep its colour
 * without an unreadable label — see `tradeIconColors` for the measured pairs.
 *
 * A node with neither icon nor colour (nothing set, nothing inherited) gets a
 * neutral pastille and no icon. Nothing is invented to fill the gap (D2/D3).
 */
export function ServiceTile({ node, href, testId }: { node: CatalogTreeNode; href: string; testId?: string }): React.JSX.Element {
  const fill = tradeFill(node.accentColor);
  const iconColor = node.accentColor === null ? undefined : tradeIconColors[node.accentColor];

  return (
    <li>
      <Link href={href} className="fx-tile" data-testid={testId}>
        <span
          className="fx-tile__pastille"
          style={fill ? { backgroundColor: fill, color: iconColor } : undefined}
          aria-hidden="true"
        >
          {node.icon ? <Icon name={node.icon} size="lg" /> : null}
        </span>
        <span className="fx-tile__label">{node.name}</span>
      </Link>
    </li>
  );
}
