import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button.js";
import { EmptyState } from "./EmptyState.js";

describe("EmptyState", () => {
  it("renders a heading, a message and an action", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Aucune demande"
        message="Vos demandes apparaitront ici."
        action={<Button onClick={onClick}>Creer une demande</Button>}
      />,
    );

    expect(screen.getByRole("heading", { level: 3, name: "Aucune demande" })).not.toBeNull();
    expect(screen.getByText("Vos demandes apparaitront ici.")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Creer une demande" })).not.toBeNull();
  });

  it("runs the action when it is activated", async () => {
    const onClick = vi.fn();
    render(<EmptyState title="Aucune demande" action={<Button onClick={onClick}>Creer</Button>} />);

    await userEvent.click(screen.getByRole("button", { name: "Creer" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("hides the decorative icon from assistive tech", () => {
    const { container } = render(<EmptyState title="Aucune demande" />);
    expect(container.querySelector(".fx-state__icon")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("omits the message paragraph entirely when none is given", () => {
    const { container } = render(<EmptyState title="Aucune demande" />);
    expect(container.querySelector(".fx-state__message")).toBeNull();
  });
});
