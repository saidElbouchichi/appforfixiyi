import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Input, Textarea } from "./Input.js";

describe("Input", () => {
  it("associates the label with the control (clicking the label focuses it)", async () => {
    render(<Input label="Numero de telephone" value="" onChange={vi.fn()} type="tel" />);

    const control = screen.getByLabelText("Numero de telephone");
    await userEvent.click(screen.getByText("Numero de telephone"));
    expect(document.activeElement).toBe(control);
  });

  it("emits the raw value on change", async () => {
    const onChange = vi.fn();
    render(<Input label="Nom" value="" onChange={onChange} />);

    await userEvent.type(screen.getByLabelText("Nom"), "Ka");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith("a");
  });

  it("marks the control invalid and links the error message via aria-describedby", () => {
    render(<Input label="Email" value="nope" onChange={vi.fn()} error="Adresse invalide" />);

    const control = screen.getByLabelText("Email");
    expect(control.getAttribute("aria-invalid")).toBe("true");

    const describedBy = control.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe("Adresse invalide");
  });

  it("is valid and has no description when no error/hint is given", () => {
    render(<Input label="Nom" value="" onChange={vi.fn()} />);

    const control = screen.getByLabelText("Nom");
    expect(control.getAttribute("aria-invalid")).toBe("false");
    expect(control.getAttribute("aria-describedby")).toBeNull();
  });

  it("links a hint when provided", () => {
    render(<Input label="Nom" value="" onChange={vi.fn()} hint="Tel qu'il figure sur la piece d'identite" />);

    const describedBy = screen.getByLabelText("Nom").getAttribute("aria-describedby");
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe("Tel qu'il figure sur la piece d'identite");
  });

  it("renders a textarea in multiline mode, with the same label wiring", () => {
    render(<Input label="Description" value="" onChange={vi.fn()} multiline rows={6} />);

    const control = screen.getByLabelText("Description");
    expect(control.tagName).toBe("TEXTAREA");
    expect(control.getAttribute("rows")).toBe("6");
  });

  it("gives each instance its own ids so two fields never collide", () => {
    render(
      <>
        <Input label="Prenom" value="" onChange={vi.fn()} error="Requis" />
        <Input label="Nom" value="" onChange={vi.fn()} error="Requis" />
      </>,
    );

    const first = screen.getByLabelText("Prenom").getAttribute("aria-describedby");
    const second = screen.getByLabelText("Nom").getAttribute("aria-describedby");
    expect(first).not.toBe(second);
  });

  it("draws a decorative leading icon without changing the accessible name", () => {
    render(<Input label="Telephone" value="" onChange={() => undefined} iconStart="phone" />);
    const field = screen.getByLabelText("Telephone");
    const icon = field.parentElement?.querySelector('[data-icon="phone"]');
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
  });

  it("passes maxLength to the control", () => {
    render(<Input label="Code" value="" onChange={() => undefined} maxLength={6} />);
    expect(screen.getByLabelText("Code").getAttribute("maxlength")).toBe("6");
  });
});

describe("Textarea", () => {
  it("is the multi-line Input, with the same label and error wiring", () => {
    render(<Textarea label="Description" value="" onChange={() => undefined} error="Trop court" />);
    const control = screen.getByLabelText("Description");
    expect(control.tagName).toBe("TEXTAREA");
    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(control.getAttribute("aria-describedby")).toBeTruthy();
  });
});
