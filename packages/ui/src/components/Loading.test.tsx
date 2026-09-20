import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Loading, Skeleton, Spinner } from "./Loading.js";

describe("Loading", () => {
  it("announces the busy state politely with a visible label", () => {
    render(<Loading />);

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Chargement");
  });

  it("accepts a custom label", () => {
    render(<Loading label="Recherche de fournisseurs…" />);
    expect(screen.getByRole("status").textContent).toContain("Recherche de fournisseurs…");
  });

  it("hides the decorative spinner from assistive tech", () => {
    const { container } = render(<Loading />);
    expect(container.querySelector(".fx-spinner")?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Spinner", () => {
  it("is decorative on its own — it exposes no accessible name", () => {
    const { container } = render(<Spinner />);

    expect(screen.queryByRole("status")).toBeNull();
    expect(container.querySelector(".fx-spinner")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("supports a large size", () => {
    const { container } = render(<Spinner size="lg" />);
    expect(container.querySelector(".fx-spinner")?.className).toContain("fx-spinner--lg");
  });
});

describe("Skeleton", () => {
  it("renders the requested number of placeholder lines, all hidden from assistive tech", () => {
    const { container } = render(<Skeleton lines={4} />);

    const lines = container.querySelectorAll(".fx-skeleton");
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(line.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("still announces that something is loading, via visually hidden text", () => {
    render(<Skeleton />);
    expect(screen.getByRole("status").textContent).toContain("Chargement");
  });

  it("never renders fewer than one line", () => {
    const { container } = render(<Skeleton lines={0} />);
    expect(container.querySelectorAll(".fx-skeleton")).toHaveLength(1);
  });
});
