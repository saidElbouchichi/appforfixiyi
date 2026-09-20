import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type JSX } from "react";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button.js";
import { Modal } from "./Modal.js";

describe("Modal", () => {
  it("renders nothing while closed", () => {
    render(
      <Modal open={false} title="Confirmer" onClose={vi.fn()}>
        contenu
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("exposes a modal dialog labelled by its own title", () => {
    render(
      <Modal open title="Confirmer la suppression" onClose={vi.fn()}>
        contenu
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Confirmer la suppression" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("moves focus into the dialog on open", () => {
    render(
      <Modal open title="Confirmer" onClose={vi.fn()}>
        contenu
      </Modal>,
    );
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Confirmer" onClose={onClose}>
        contenu
      </Modal>,
    );

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the close button", async () => {
    const onClose = vi.fn();
    render(
      <Modal open title="Confirmer" onClose={onClose}>
        contenu
      </Modal>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a click outside, but not on a click inside the dialog", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open title="Confirmer" onClose={onClose}>
        <p>contenu</p>
      </Modal>,
    );

    await userEvent.click(screen.getByText("contenu"));
    expect(onClose).not.toHaveBeenCalled();

    const overlay = container.querySelector(".fx-modal__overlay");
    if (!overlay) {
      throw new Error("overlay was not rendered");
    }
    await userEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("traps Tab inside the dialog", async () => {
    render(
      <Modal open title="Confirmer" onClose={vi.fn()} footer={<Button>Valider</Button>}>
        contenu
      </Modal>,
    );

    const close = screen.getByRole("button", { name: "Fermer" });
    const confirm = screen.getByRole("button", { name: "Valider" });

    await userEvent.tab();
    expect(document.activeElement).toBe(close);
    await userEvent.tab();
    expect(document.activeElement).toBe(confirm);

    // Past the last focusable element, focus wraps back inside instead of escaping to the page.
    await userEvent.tab();
    expect(document.activeElement).toBe(close);
  });

  it("returns focus to the trigger when it closes", async () => {
    function Harness(): JSX.Element {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button
            onClick={() => {
              setOpen(true);
            }}
          >
            Ouvrir
          </Button>
          <Modal
            open={open}
            title="Confirmer"
            onClose={() => {
              setOpen(false);
            }}
          >
            contenu
          </Modal>
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Ouvrir" });

    await userEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole("dialog"));

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
