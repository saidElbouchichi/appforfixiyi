import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "./Badge.js";

describe("Badge", () => {
  it("carries its meaning as text, not only as colour (WCAG 1.4.1)", () => {
    render(<Badge variant="success">Verifie</Badge>);
    expect(screen.getByText("Verifie").textContent).toBe("Verifie");
  });

  it("applies the requested variant class", () => {
    render(<Badge variant="warning">En attente</Badge>);
    expect(screen.getByText("En attente").className).toContain("fx-badge--warning");
  });

  it("defaults to the info variant", () => {
    render(<Badge>Brouillon</Badge>);
    expect(screen.getByText("Brouillon").className).toContain("fx-badge--info");
  });
});
