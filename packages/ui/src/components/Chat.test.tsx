import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeliveryStatus, MessageBubble, ReplyQuote, TypingIndicator } from "./Chat.js";

describe("MessageBubble", () => {
  it("renders the text of the message", () => {
    render(<MessageBubble own={false} body="Bonjour, je passe demain" time="14:05" />);
    expect(screen.getByText("Bonjour, je passe demain")).toBeTruthy();
  });

  it("lets each message pick its own text direction (French inside Arabic, and the reverse)", () => {
    render(<MessageBubble own={false} body="مرحبا" time="14:05" />);
    expect(screen.getByText("مرحبا").getAttribute("dir")).toBe("auto");
  });

  it("aligns the viewer's own messages differently from received ones", () => {
    const { container, rerender } = render(<MessageBubble own body="a" time="1" />);
    expect(container.querySelector(".fx-bubble-row--own")).not.toBeNull();
    rerender(<MessageBubble own={false} body="a" time="1" />);
    expect(container.querySelector(".fx-bubble-row--own")).toBeNull();
  });

  it("shows a placeholder instead of the content once deleted", () => {
    render(<MessageBubble own={false} body={null} deleted time="1" />);
    expect(screen.getByText("Message supprime")).toBeTruthy();
  });

  it("marks an edited message", () => {
    render(<MessageBubble own body="corrige" edited time="1" />);
    expect(screen.getByText("modifie")).toBeTruthy();
  });

  it("does not claim a deleted message was edited", () => {
    render(<MessageBubble own body={null} deleted edited time="1" />);
    expect(screen.queryByText("modifie")).toBeNull();
  });

  it("shows delivery ticks on the viewer's own messages only", () => {
    const { container, rerender } = render(<MessageBubble own body="a" time="1" status="READ" />);
    expect(container.querySelector("[data-status='READ']")).not.toBeNull();
    rerender(<MessageBubble own={false} body="a" time="1" status="READ" />);
    expect(container.querySelector("[data-status]")).toBeNull();
  });

  it("tells the sender, as a note, that part of the message was masked — never silently", () => {
    render(<MessageBubble own body="Appelez [•••]" time="1" notice="Coordonnees masquees" />);
    expect(screen.getByRole("note").textContent).toContain("Coordonnees masquees");
  });

  it("lists reactions with their count, and marks the viewer's own", () => {
    const { container } = render(
      <MessageBubble
        own={false}
        body="a"
        time="1"
        reactions={[
          { emoji: "👍", count: 2, mine: true },
          { emoji: "🙏", count: 1, mine: false },
        ]}
      />,
    );
    expect(screen.getByRole("list", { name: "Reactions" }).children).toHaveLength(2);
    expect(container.querySelectorAll(".fx-reaction--mine")).toHaveLength(1);
  });

  it("renders the reply, attachments and actions it is given", () => {
    render(
      <MessageBubble
        own={false}
        body="a"
        time="1"
        reply={<span>reponse-a</span>}
        attachments={<span>piece-jointe</span>}
        actions={<button type="button">Repondre</button>}
      />,
    );
    expect(screen.getByText("reponse-a")).toBeTruthy();
    expect(screen.getByText("piece-jointe")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Repondre" })).toBeTruthy();
  });
});

describe("DeliveryStatus", () => {
  it("uses one tick for sent and two for delivered and read", () => {
    const { container, rerender } = render(<DeliveryStatus status="SENT" />);
    expect(container.querySelector("[data-icon='check']")).not.toBeNull();
    rerender(<DeliveryStatus status="DELIVERED" />);
    expect(container.querySelector("[data-icon='check-double']")).not.toBeNull();
  });

  it("names the state in text, so 'read' is not conveyed by colour alone (WCAG 1.4.1)", () => {
    render(<DeliveryStatus status="READ" />);
    expect(screen.getByText("Lu")).toBeTruthy();
  });

  it("accepts translated labels", () => {
    render(<DeliveryStatus status="READ" labels={{ READ: "Read" }} />);
    expect(screen.getByText("Read")).toBeTruthy();
  });
});

describe("ReplyQuote", () => {
  it("quotes the author and an excerpt", () => {
    render(<ReplyQuote author="Ahmed" excerpt="Vous venez demain ?" deleted={false} />);
    expect(screen.getByText("Ahmed")).toBeTruthy();
    expect(screen.getByText("Vous venez demain ?")).toBeTruthy();
  });

  it("says the quoted message was deleted instead of showing stale content", () => {
    render(<ReplyQuote author="Ahmed" excerpt={null} deleted />);
    expect(screen.getByText("Message supprime")).toBeTruthy();
  });
});

describe("TypingIndicator", () => {
  it("announces who is typing, politely (WCAG 4.1.3)", () => {
    render(<TypingIndicator label="Ahmed ecrit…" />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Ahmed ecrit…");
  });

  it("hides the decorative dots from assistive tech", () => {
    const { container } = render(<TypingIndicator label="x" />);
    expect(container.querySelector(".fx-typing__dots")?.getAttribute("aria-hidden")).toBe("true");
  });
});
