import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card } from "./Card.js";

describe("Card", () => {
  it("renders its children", () => {
    render(
      <Card>
        <p>Contenu</p>
      </Card>,
    );
    expect(screen.getByText("Contenu")).not.toBeNull();
  });

  it("renders the title at the requested heading level", () => {
    render(
      <Card title="Demande #12" headingLevel={2}>
        <p>Contenu</p>
      </Card>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Demande #12" })).not.toBeNull();
  });

  it("defaults to level 3 and renders no heading at all without a title", () => {
    const { rerender } = render(<Card title="Titre">contenu</Card>);
    expect(screen.getByRole("heading", { level: 3 })).not.toBeNull();

    rerender(<Card>contenu</Card>);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders as an article when it is an item of a list", () => {
    render(<Card as="article">contenu</Card>);
    expect(screen.getByRole("article")).not.toBeNull();
  });

  it("keeps a single primary action to stretch, and other controls usable, when interactive", () => {
    render(
      <Card interactive title="Demande #12" testId="card">
        <a className="fx-card__primary-action" href="/requests/12">
          Voir la demande
        </a>
        <button type="button">Refuser</button>
      </Card>,
    );
    expect(screen.getByTestId("card").className).toContain("fx-card--interactive");
    expect(screen.getByRole("link", { name: "Voir la demande" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Refuser" })).not.toBeNull();
  });

  it("places media before the body, the footer after it, and the corner badge on top", () => {
    const { container } = render(
      <Card media={<span>photo</span>} footer={<span>pied</span>} cornerBadge={<span>Nouveau</span>} highlight="brand" gradientBorder>
        corps
      </Card>,
    );
    const card = container.firstElementChild;
    expect([...(card?.children ?? [])].map((child) => child.className)).toEqual(["fx-card__media", "fx-card__body", "fx-card__footer", "fx-card__corner"]);
    expect(card?.className).toContain("fx-card--highlight-brand");
    expect(card?.className).toContain("fx-card--gradient-border");
  });
});
