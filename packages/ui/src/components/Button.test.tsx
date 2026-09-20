import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button.js";

/** Plain DOM assertions rather than `@testing-library/jest-dom` — the extra dependency + setup file buys very little here. */
describe("Button", () => {
  it("defaults to type=button so it never submits a surrounding form by accident", () => {
    render(<Button>Envoyer</Button>);
    expect(screen.getByRole("button", { name: "Envoyer" }).getAttribute("type")).toBe("button");
  });

  it("applies the requested variant class", () => {
    render(<Button variant="danger">Supprimer</Button>);
    expect(screen.getByRole("button").className).toContain("fx-button--danger");
  });

  it("calls onClick when pressed", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Valider</Button>);

    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and announces aria-busy while loading, and ignores clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Envoi
      </Button>,
    );

    const button = screen.getByRole<HTMLButtonElement>("button");
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not call onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Valider
      </Button>,
    );

    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is reachable and activatable by keyboard", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Valider</Button>);

    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button"));

    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
