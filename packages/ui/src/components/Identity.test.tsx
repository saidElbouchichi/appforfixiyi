import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Avatar, initialsOf } from "./Avatar.js";
import { IconButton } from "./IconButton.js";
import { Rating, RatingInput } from "./Rating.js";
import { Tooltip } from "./Tooltip.js";

describe("Avatar", () => {
  it("draws initials from the real name, code-point safe", () => {
    expect(initialsOf("Ahmed El Idrissi")).toBe("AE");
    expect(initialsOf("  karim  ")).toBe("K");
    expect(initialsOf("سعيد البوشيشي")).toBe("سا");
  });

  it("is one image named after the person and their real status", () => {
    render(<Avatar name="Ahmed El Idrissi" trade="electrician" status="online" />);
    const avatar = screen.getByRole("img", { name: "Ahmed El Idrissi, en ligne" });
    expect(avatar.className).toContain("fx-avatar--trade-electrician");
    expect(avatar.querySelector(".fx-avatar__initials")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("has no status dot unless a status is given", () => {
    const { container } = render(<Avatar name="Karim" />);
    expect(container.querySelector(".fx-avatar__status")).toBeNull();
    expect(screen.getByRole("img", { name: "Karim" })).not.toBeNull();
  });
});

describe("Rating", () => {
  it("is one image whose name says the value, the scale and the review count", () => {
    render(<Rating value={4.8} count={124} />);
    expect(screen.getByRole("img", { name: "Note 4,8 sur 5, 124 avis" })).not.toBeNull();
  });

  it("clips the filled stars to the share of the average", () => {
    const { container } = render(<Rating value={4.3} />);
    const stars = container.querySelector<HTMLElement>(".fx-rating__stars");
    expect(stars?.style.getPropertyValue("--fx-rating-share")).toBe("86%");
  });
});

describe("RatingInput", () => {
  function Controlled(): React.JSX.Element {
    const [value, setValue] = useState(0);
    return <RatingInput label="Votre note" value={value} onChange={setValue} />;
  }

  it("is a named group of five radios, one per star count", () => {
    render(<Controlled />);
    expect(screen.getByRole("group", { name: "Votre note" })).not.toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("radio", { name: "1 etoile" })).not.toBeNull();
    expect(screen.getByRole("radio", { name: "5 etoiles" })).not.toBeNull();
  });

  it("selects by click and by arrow keys", async () => {
    render(<Controlled />);
    await userEvent.click(screen.getByRole("radio", { name: "3 etoiles" }));
    expect(screen.getByRole<HTMLInputElement>("radio", { name: "3 etoiles" }).checked).toBe(true);

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole<HTMLInputElement>("radio", { name: "4 etoiles" }).checked).toBe(true);
  });

  it("lights the stars up to the chosen value", async () => {
    const { container } = render(<Controlled />);
    await userEvent.click(screen.getByRole("radio", { name: "2 etoiles" }));
    expect(container.querySelectorAll(".fx-rating-input__star--on")).toHaveLength(2);
  });
});

describe("Tooltip", () => {
  const renderTooltip = (): void => {
    render(<Tooltip content="Visible par le client">{(describedBy) => <IconButton label="Aide" icon="info" describedBy={describedBy} />}</Tooltip>);
  };

  it("describes its trigger, even while hidden", () => {
    renderTooltip();
    const trigger = screen.getByRole("button", { name: "Aide" });
    const tooltip = document.getElementById(trigger.getAttribute("aria-describedby") ?? "");
    expect(tooltip?.getAttribute("role")).toBe("tooltip");
    expect(tooltip?.textContent).toBe("Visible par le client");
    expect(tooltip?.getAttribute("data-open")).toBe("false");
  });

  it("opens on keyboard focus and on hover, and Escape closes it without moving focus (WCAG 1.4.13)", async () => {
    renderTooltip();
    const tooltip = screen.getByRole("tooltip", { hidden: true });

    await userEvent.tab();
    expect(tooltip.getAttribute("data-open")).toBe("true");

    await userEvent.keyboard("{Escape}");
    expect(tooltip.getAttribute("data-open")).toBe("false");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Aide" }));

    await userEvent.tab();
    fireEvent.pointerEnter(tooltip.parentElement as Element);
    expect(tooltip.getAttribute("data-open")).toBe("true");
  });
});
