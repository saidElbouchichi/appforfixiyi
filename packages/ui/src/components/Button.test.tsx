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

  it("defaults to the md size and applies the requested one", () => {
    render(
      <>
        <Button>Par defaut</Button>
        <Button size="xl">Grand</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Par defaut" }).className).toContain("fx-button--md");
    expect(screen.getByRole("button", { name: "Grand" }).className).toContain("fx-button--xl");
  });

  it("offers the gradient and pulse variants of part 2B", () => {
    render(
      <>
        <Button variant="gradient">Trouver un artisan</Button>
        <Button variant="pulse">Urgence</Button>
      </>,
    );
    expect(screen.getByRole("button", { name: "Trouver un artisan" }).className).toContain("fx-button--gradient");
    expect(screen.getByRole("button", { name: "Urgence" }).className).toContain("fx-button--pulse");
  });

  it("shows a check in the success state, and keeps the label as the message", () => {
    render(<Button success>Enregistre</Button>);
    const button = screen.getByRole("button", { name: "Enregistre" });
    expect(button.className).toContain("fx-button--success");
    expect(button.querySelector('[data-icon="check"]')).not.toBeNull();
  });

  it("shows the spinner, not the success check, while loading", () => {
    render(
      <Button success loading>
        Envoi
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button.querySelector(".fx-spinner")).not.toBeNull();
    expect(button.querySelector('[data-icon="check"]')).toBeNull();
  });
});
