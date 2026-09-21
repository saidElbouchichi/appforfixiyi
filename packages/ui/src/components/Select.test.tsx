import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Select } from "./Select.js";

const OPTIONS = [
  { value: "elec", label: "Electricite" },
  { value: "plomb", label: "Plomberie" },
];

describe("Select", () => {
  it("associates the label with the control (clicking the label focuses it)", async () => {
    const user = userEvent.setup();
    render(<Select label="Domaine" value="" onChange={vi.fn()} options={OPTIONS} />);

    await user.click(screen.getByText("Domaine"));
    expect(screen.getByLabelText("Domaine")).toBe(document.activeElement);
  });

  it("reports the chosen value to the caller", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Select label="Domaine" value="" onChange={onChange} options={OPTIONS} />);

    await user.selectOptions(screen.getByLabelText("Domaine"), "plomb");
    expect(onChange).toHaveBeenCalledWith("plomb");
  });

  it("renders a placeholder row so 'nothing chosen' is representable", () => {
    render(<Select label="Domaine" value="" onChange={vi.fn()} options={OPTIONS} placeholder="Choisir…" />);
    expect(screen.getByRole("option", { name: "Choisir…" }).getAttribute("value")).toBe("");
  });

  it("disables itself when there is nothing to choose, without being asked to", () => {
    render(<Select label="Categorie" value="" onChange={vi.fn()} options={[]} />);
    expect(screen.getByLabelText<HTMLSelectElement>("Categorie").disabled).toBe(true);
  });

  it("stays enabled when it has options", () => {
    render(<Select label="Domaine" value="" onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByLabelText<HTMLSelectElement>("Domaine").disabled).toBe(false);
  });

  it("links its error message with aria-describedby and marks itself invalid (WCAG 3.3.1)", () => {
    render(<Select label="Domaine" value="" onChange={vi.fn()} options={OPTIONS} error="Choisissez un domaine." />);
    const control = screen.getByLabelText("Domaine");

    expect(control.getAttribute("aria-invalid")).toBe("true");
    const describedBy = control.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe("Choisissez un domaine.");
  });

  it("links its hint with aria-describedby", () => {
    render(<Select label="Domaine" value="" onChange={vi.fn()} options={OPTIONS} hint="Commencez par le domaine." />);
    const describedBy = screen.getByLabelText("Domaine").getAttribute("aria-describedby");
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe("Commencez par le domaine.");
  });

  it("is not marked invalid when it has no error", () => {
    render(<Select label="Domaine" value="" onChange={vi.fn()} options={OPTIONS} />);
    expect(screen.getByLabelText("Domaine").getAttribute("aria-invalid")).toBe("false");
  });

  it("generates a unique id per instance so two selects on a page stay independently labelled", () => {
    render(
      <>
        <Select label="Domaine" value="" onChange={vi.fn()} options={OPTIONS} />
        <Select label="Categorie" value="" onChange={vi.fn()} options={OPTIONS} />
      </>,
    );
    expect(screen.getByLabelText("Domaine").id).not.toBe(screen.getByLabelText("Categorie").id);
  });
});
