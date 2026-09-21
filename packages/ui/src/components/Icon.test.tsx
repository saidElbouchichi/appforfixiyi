import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Icon, ICON_NAMES, ICON_SIZES, type IconName } from "./Icon.js";

/** The four categories 01_SPEC_PRODUCT.md's screens actually need. */
const EXPECTED_ICONS: Record<string, IconName[]> = {
  navigation: ["home", "search", "message", "wallet", "profile"],
  actions: ["add", "edit", "delete", "close", "check", "arrow"],
  status: ["success", "warning", "error", "info", "loading"],
  metier: ["wrench", "tools", "calendar", "map", "star", "shield"],
  chat: ["send", "reply", "attach", "check-double"],
};

describe("Icon — coverage", () => {
  for (const [category, names] of Object.entries(EXPECTED_ICONS)) {
    it(`ships every ${category} icon`, () => {
      for (const name of names) {
        expect(ICON_NAMES).toContain(name);
      }
    });
  }

  it("renders every declared icon with at least one path", () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      const paths = container.querySelectorAll("path");
      expect(paths.length, `${name} has no path`).toBeGreaterThan(0);
      for (const path of paths) {
        expect(path.getAttribute("d"), `${name} has an empty path`).toBeTruthy();
      }
      unmount();
    }
  });
});

describe("Icon — sizing", () => {
  it("maps the four sizes to 16/20/24/32 pixels", () => {
    expect(ICON_SIZES).toEqual({ sm: 16, md: 20, lg: 24, xl: 32 });
  });

  it("renders the requested size on both axes", () => {
    const { container } = render(<Icon name="home" size="lg" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
  });

  it("defaults to the md size", () => {
    const { container } = render(<Icon name="home" />);
    expect(container.querySelector("svg")?.getAttribute("width")).toBe("20");
  });

  it("keeps one 24x24 drawing grid whatever the rendered size, so strokes stay optically equal", () => {
    for (const size of Object.keys(ICON_SIZES) as (keyof typeof ICON_SIZES)[]) {
      const { container, unmount } = render(<Icon name="star" size={size} />);
      expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 24 24");
      unmount();
    }
  });
});

describe("Icon — colour", () => {
  it("inherits the parent colour instead of hard-coding one", () => {
    const { container } = render(<Icon name="check" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
    expect(svg?.getAttribute("fill")).toBe("none");
  });

  it("never hard-codes a colour on any icon path", () => {
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      for (const path of container.querySelectorAll("path")) {
        expect(path.getAttribute("fill"), `${name} hard-codes a fill`).toBeNull();
        expect(path.getAttribute("stroke"), `${name} hard-codes a stroke`).toBeNull();
      }
      unmount();
    }
  });
});

describe("Icon — accessibility (WCAG 2.2 AA)", () => {
  it("is hidden from assistive tech when it carries no label", () => {
    const { container } = render(<Icon name="check" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("role")).toBeNull();
  });

  it("is exposed as a labelled image when it carries meaning on its own", () => {
    render(<Icon name="delete" label="Supprimer" />);
    const icon = screen.getByRole("img", { name: "Supprimer" });
    expect(icon.getAttribute("aria-hidden")).toBeNull();
  });

  it("never announces both a label and a hidden state", () => {
    render(<Icon name="star" label="Favori" />);
    expect(screen.getByRole("img", { name: "Favori" }).getAttribute("aria-hidden")).toBeNull();
  });

  it("stays out of the tab order (an icon is never a focus stop)", () => {
    const { container } = render(<Icon name="home" label="Accueil" />);
    expect(container.querySelector("svg")?.getAttribute("focusable")).toBe("false");
  });
});

describe("Icon — RTL", () => {
  // `svg.className` is an SVGAnimatedString, not a string — read the attribute.
  const classesOf = (container: HTMLElement): string => container.querySelector("svg")?.getAttribute("class") ?? "";

  it("marks every direction-dependent icon so dir=rtl can mirror it", () => {
    for (const name of ["arrow", "send", "reply"] as IconName[]) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(classesOf(container), name).toContain("fx-icon--directional");
      unmount();
    }
  });

  it("does not mirror an icon whose meaning is direction-independent", () => {
    for (const name of ["home", "star", "calendar", "check", "shield"] as IconName[]) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(classesOf(container), `${name} should not flip`).not.toContain("fx-icon--directional");
      unmount();
    }
  });

  it("always carries the base fx-icon class", () => {
    const { container } = render(<Icon name="wrench" />);
    expect(classesOf(container)).toContain("fx-icon");
  });
});
