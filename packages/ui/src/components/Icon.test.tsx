import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Icon, ICON_ALIASES, ICON_NAMES, ICON_SIZES, resolveIconName, type IconName } from "./Icon.js";

/**
 * The catalogue of master prompt part 2C, category by category, under the
 * names it uses (aliases included). Social icons are deliberately absent:
 * brand marks come from each brand's kit, with real Fixiyi account URLs
 * (design phase 5) — D4 forbids logos that were not provided.
 */
const PART_2C: Record<string, IconName[]> = {
  navigation: ["home", "search", "message", "wallet", "profile", "menu", "close", "arrow-left", "arrow-right", "chevron-down", "chevron-up", "chevron-left"],
  actions: ["add", "edit", "delete", "check", "x", "save", "share", "copy", "download", "upload", "filter", "sort"],
  status: ["success", "warning", "error", "info", "loading", "clock"],
  metier: ["wrench", "tools", "calendar", "map-pin", "star", "shield", "credit-card", "phone", "mail", "bell", "user", "users", "briefcase", "building"],
  chat: ["send", "reply", "attach", "check-double", "image", "file"],
};

/** One glyph per catalogue domain of the partie 2A trade palette. */
const TRADES: IconName[] = ["bolt", "droplet", "snowflake", "key", "paint-roller", "hammer", "washing-machine", "smart-home", "monitor", "sparkles", "leaf"];

describe("Icon — coverage", () => {
  for (const [category, names] of Object.entries(PART_2C)) {
    it(`ships every ${category} icon of part 2C`, () => {
      for (const name of names) {
        expect(ICON_NAMES, name).toContain(resolveIconName(name));
      }
    });
  }

  it("ships one icon per trade", () => {
    for (const name of TRADES) expect(ICON_NAMES, name).toContain(name);
  });

  it("reaches the 55+ target in distinct glyphs, aliases not counted", () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
    expect(ICON_NAMES.length).toBeGreaterThanOrEqual(55);
  });

  it("never draws two names with the same paths (an alias is declared, not copied)", () => {
    // One render for all glyphs: rendering 63 trees one by one is slow for no gain.
    const { container } = render(
      <>
        {ICON_NAMES.map((name) => (
          <Icon key={name} name={name} />
        ))}
      </>,
    );
    const drawings = [...container.querySelectorAll("svg")].map((svg) => [...svg.querySelectorAll("path")].map((path) => path.getAttribute("d")).join("|"));
    expect(drawings).toHaveLength(ICON_NAMES.length);
    expect(new Set(drawings).size).toBe(drawings.length);
  });

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

describe("Icon — aliases", () => {
  it("renders an alias as its glyph", () => {
    for (const [alias, glyph] of Object.entries(ICON_ALIASES)) {
      const { container, unmount } = render(<Icon name={alias as IconName} />);
      expect(container.querySelector("svg")?.getAttribute("data-icon"), alias).toBe(glyph);
      unmount();
    }
  });

  it("only aliases glyphs that exist, and never shadows a glyph name", () => {
    for (const [alias, glyph] of Object.entries(ICON_ALIASES)) {
      expect(ICON_NAMES, alias).toContain(glyph);
      expect(ICON_NAMES, alias).not.toContain(alias);
    }
  });
});

describe("Icon — sizing", () => {
  it("maps the five sizes of part 2C to 16/20/24/32/48 pixels", () => {
    expect(ICON_SIZES).toEqual({ sm: 16, md: 20, lg: 24, xl: 32, "2xl": 48 });
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
    for (const name of ["arrow-back", "arrow-forward", "chevron-start", "chevron-end", "arrow", "arrow-left", "chevron-right", "send", "reply"] as IconName[]) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(classesOf(container), name).toContain("fx-icon--directional");
      unmount();
    }
  });

  it("does not mirror an icon whose meaning is direction-independent", () => {
    for (const name of ["home", "star", "calendar", "check", "shield", "chevron-down", "chevron-up", "download", "share"] as IconName[]) {
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
