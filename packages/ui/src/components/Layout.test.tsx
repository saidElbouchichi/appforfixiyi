import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JSX } from "react";
import { describe, expect, it } from "vitest";

import { AppShell, Footer, Header, Logo, Page } from "./Layout.js";
import { LinkProvider, type UiLinkProps } from "./Link.js";
import { BottomNavigation, Navbar, type NavItem } from "./Navigation.js";

const items: NavItem[] = [
  { href: "/requests/new", label: "Demander", icon: "add" },
  { href: "/conversations", label: "Messages", icon: "message", badge: 3 },
];

describe("LinkProvider", () => {
  it("renders plain anchors by default, and the app's router link once provided", () => {
    function RouterLink({ children, ...props }: UiLinkProps): JSX.Element {
      return (
        <a {...props} data-router="yes">
          {children}
        </a>
      );
    }
    const { rerender } = render(<Logo />);
    expect(screen.getByRole("link", { name: "Fixiyi" }).getAttribute("data-router")).toBeNull();

    rerender(
      <LinkProvider component={RouterLink}>
        <Logo />
      </LinkProvider>,
    );
    expect(screen.getByRole("link", { name: "Fixiyi" }).getAttribute("data-router")).toBe("yes");
  });
});

describe("Logo", () => {
  it("is a text link home (D4 placeholder), with an optional suffix", () => {
    render(<Logo suffix="Admin" />);
    const link = screen.getByRole("link", { name: "Fixiyi Admin" });
    expect(link.getAttribute("href")).toBe("/");
    expect(link.querySelector("img, svg")).toBeNull();
  });
});

describe("Header and Footer", () => {
  it("are the banner and contentinfo landmarks", () => {
    render(
      <>
        <Header brand={<Logo />} actions={<button type="button">Compte</button>} />
        <Footer tagline="Plus qu'une application, une solution de confiance." legal="© 2026 Fixiyi" />
      </>,
    );
    expect(within(screen.getByRole("banner")).getByRole("button", { name: "Compte" })).not.toBeNull();
    expect(screen.getByRole("contentinfo").textContent).toContain("une solution de confiance");
  });

  it("names each footer link group as a navigation landmark", () => {
    render(<Footer groups={[{ title: "Fixiyi", links: [{ href: "/login", label: "Connexion" }] }]} />);
    expect(within(screen.getByRole("navigation", { name: "Fixiyi" })).getByRole("link", { name: "Connexion" })).not.toBeNull();
  });
});

describe("AppShell", () => {
  it("puts a skip link first in the tab order, pointing at the focusable content", async () => {
    render(
      <AppShell header={<Header brand={<Logo />} />}>
        <main>contenu</main>
      </AppShell>,
    );
    await userEvent.tab();
    const skip = screen.getByRole("link", { name: "Aller au contenu" });
    expect(document.activeElement).toBe(skip);

    const target = document.querySelector(skip.getAttribute("href") ?? "");
    expect(target?.getAttribute("tabindex")).toBe("-1");
    expect(target?.textContent).toBe("contenu");
  });

  it("makes room for the bottom bar only when there is one", () => {
    const { container, rerender } = render(<AppShell header={null}>x</AppShell>);
    expect(container.firstElementChild?.className).not.toContain("fx-shell--with-bottom-nav");
    rerender(
      <AppShell header={null} bottomNavigation={<BottomNavigation label="Navigation" items={items} />}>
        x
      </AppShell>,
    );
    expect(container.firstElementChild?.className).toContain("fx-shell--with-bottom-nav");
  });
});

describe("Navbar and BottomNavigation", () => {
  for (const [name, Component] of [
    ["Navbar", Navbar],
    ["BottomNavigation", BottomNavigation],
  ] as const) {
    it(`${name}: a named navigation marking the current page with aria-current`, () => {
      render(<Component label="Navigation principale" items={items} activeHref="/conversations" />);
      const nav = screen.getByRole("navigation", { name: "Navigation principale" });
      const links = within(nav).getAllByRole("link");
      expect(links.map((link) => link.getAttribute("aria-current"))).toEqual([null, "page"]);
    });

    it(`${name}: speaks a real count with the destination, shows none at zero`, () => {
      render(<Component label="Navigation" items={[...items, { href: "/x", label: "Vide", icon: "home", badge: 0 }]} />);
      expect(screen.getByRole("link", { name: /Messages.*3 non lus/ })).not.toBeNull();
      expect(screen.getByRole("link", { name: "Vide" }).querySelector(".fx-nav-badge")).toBeNull();
    });
  }
});

describe("Page", () => {
  it("is the main landmark with the screen's single h1", () => {
    render(
      <Page title="Nouvelle demande" actions={<button type="button">Aide</button>} width="wide">
        corps
      </Page>,
    );
    const main = screen.getByRole("main");
    expect(main.className).toContain("fx-page--wide");
    expect(within(main).getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
