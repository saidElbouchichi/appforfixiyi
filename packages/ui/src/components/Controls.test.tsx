import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "./Checkbox.js";
import { Slider } from "./Slider.js";
import { Switch } from "./Switch.js";

describe("Checkbox", () => {
  it("is a native checkbox named by its label, toggled by a click on the text", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="J'accepte les conditions" checked={false} onChange={onChange} />);

    await userEvent.click(screen.getByText("J'accepte les conditions"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("checkbox", { name: "J'accepte les conditions" })).not.toBeNull();
  });

  it("toggles with the space bar", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Urgent" checked onChange={onChange} />);

    await userEvent.tab();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("exposes the mixed state through the DOM property", () => {
    render(<Checkbox label="Tous les metiers" checked={false} onChange={() => undefined} indeterminate />);
    expect(screen.getByRole<HTMLInputElement>("checkbox").indeterminate).toBe(true);
  });

  it("links its description and error, and marks itself invalid", () => {
    render(<Checkbox label="Conditions" checked={false} onChange={() => undefined} description="Lire avant" error="Obligatoire" />);
    const box = screen.getByRole("checkbox");
    expect(box.getAttribute("aria-invalid")).toBe("true");
    const ids = (box.getAttribute("aria-describedby") ?? "").split(" ");
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual(["Lire avant", "Obligatoire"]);
  });
});

describe("Switch", () => {
  function Controlled(): React.JSX.Element {
    const [on, setOn] = useState(false);
    return <Switch label="Notifications" checked={on} onChange={setOn} description="Par SMS" />;
  }

  it("is a switch named by its visible label and described by its hint", () => {
    render(<Controlled />);
    const control = screen.getByRole("switch", { name: "Notifications" });
    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(document.getElementById(control.getAttribute("aria-describedby") ?? "")?.textContent).toBe("Par SMS");
  });

  it("toggles from the track, the label, and the keyboard", async () => {
    render(<Controlled />);
    const control = screen.getByRole("switch");

    await userEvent.click(control);
    expect(control.getAttribute("aria-checked")).toBe("true");

    await userEvent.click(screen.getByText("Notifications"));
    expect(control.getAttribute("aria-checked")).toBe("false");

    control.focus();
    await userEvent.keyboard("{Enter}");
    expect(control.getAttribute("aria-checked")).toBe("true");
  });

  it("does not toggle when disabled", async () => {
    const onChange = vi.fn();
    render(<Switch label="Notifications" checked={false} onChange={onChange} disabled />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Slider", () => {
  it("is a range named by its label, reading its formatted value", () => {
    render(<Slider label="Rayon" value={10} onChange={() => undefined} min={1} max={50} formatValue={(km) => `${km.toString()} km`} />);
    const range = screen.getByRole("slider", { name: "Rayon" });
    expect(range.getAttribute("aria-valuetext")).toBe("10 km");
    expect(screen.getByText("10 km").tagName).toBe("OUTPUT");
  });

  it("reports numbers, not strings", () => {
    const onChange = vi.fn();
    render(<Slider label="Rayon" value={10} onChange={onChange} />);
    fireEvent.change(screen.getByRole("slider"), { target: { value: "25" } });
    expect(onChange).toHaveBeenCalledWith(25);
  });

  it("feeds the filled share of the track to CSS, clamped to the range", () => {
    const { rerender } = render(<Slider label="Rayon" value={25} onChange={() => undefined} min={0} max={100} />);
    expect(screen.getByRole("slider").style.getPropertyValue("--fx-slider-fill")).toBe("25%");

    rerender(<Slider label="Rayon" value={500} onChange={() => undefined} min={0} max={100} />);
    expect(screen.getByRole("slider").style.getPropertyValue("--fx-slider-fill")).toBe("100%");
  });
});
