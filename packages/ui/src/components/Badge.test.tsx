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

  it("offers neutral and brand variants besides the semantic ones", () => {
    render(
      <>
        <Badge variant="neutral">Brouillon</Badge>
        <Badge variant="brand">Nouveau</Badge>
      </>,
    );
    expect(screen.getByText("Brouillon").className).toContain("fx-badge--neutral");
    expect(screen.getByText("Nouveau").className).toContain("fx-badge--brand");
  });

  it("draws a decorative dot, pulsing only when asked, and keeps the text as the meaning", () => {
    render(
      <>
        <Badge variant="success" dot>
          Disponible
        </Badge>
        <Badge variant="warning" pulse>
          Urgent
        </Badge>
      </>,
    );
    const available = screen.getByText("Disponible").querySelector(".fx-badge__dot");
    expect(available?.getAttribute("aria-hidden")).toBe("true");
    expect(available?.className).not.toContain("fx-badge__dot--pulse");
    expect(screen.getByText("Urgent").querySelector(".fx-badge__dot--pulse")).not.toBeNull();
  });

  it("renders an optional icon, hidden from assistive tech", () => {
    render(
      <Badge variant="info" icon="shield">
        Verifie
      </Badge>,
    );
    expect(screen.getByText("Verifie").querySelector('[data-icon="shield"]')?.getAttribute("aria-hidden")).toBe("true");
  });
});
