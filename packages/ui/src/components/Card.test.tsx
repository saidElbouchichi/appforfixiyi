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
});
