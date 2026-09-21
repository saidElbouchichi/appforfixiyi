import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IconButton } from "./IconButton.js";

describe("IconButton", () => {
  it("is announced by its label, not as a bare 'button' (WCAG 4.1.2)", () => {
    render(<IconButton label="Repondre" icon="reply" />);
    expect(screen.getByRole("button", { name: "Repondre" })).toBeTruthy();
  });

  it("hides an emoji glyph from assistive tech — the label speaks", () => {
    const { container } = render(<IconButton label="Reagir">🙂</IconButton>);
    expect(container.querySelector("[aria-hidden='true']")?.textContent).toBe("🙂");
  });

  it("never submits a surrounding form when clicked", async () => {
    // A bare <button> defaults to type=submit: an attach or reply icon inside the
    // chat composer's <form> would otherwise send the message.
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <IconButton label="Joindre" icon="attach" />
      </form>,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Joindre" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onClick", async () => {
    const onClick = vi.fn();
    render(<IconButton label="Supprimer" icon="delete" onClick={onClick} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Supprimer" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("exposes toggle and disclosure states", () => {
    render(
      <>
        <IconButton label="Pouce" pressed>
          👍
        </IconButton>
        <IconButton label="Reactions" expanded={false}>
          🙂
        </IconButton>
      </>,
    );
    expect(screen.getByRole("button", { name: "Pouce" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Reactions" }).getAttribute("aria-expanded")).toBe("false");
  });
});
