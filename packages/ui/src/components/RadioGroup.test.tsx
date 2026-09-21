import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RadioGroup } from "./RadioGroup.js";

const URGENCY = [
  { value: "NORMAL" as const, label: "Normale" },
  { value: "URGENT" as const, label: "Urgente" },
];

describe("RadioGroup", () => {
  it("exposes itself as a labelled group (WCAG 1.3.1)", () => {
    render(<RadioGroup legend="Urgence" value="NORMAL" onChange={vi.fn()} options={URGENCY} />);
    expect(screen.getByRole("group", { name: "Urgence" })).toBeTruthy();
  });

  it("marks exactly the selected option as checked", () => {
    render(<RadioGroup legend="Urgence" value="URGENT" onChange={vi.fn()} options={URGENCY} />);
    expect(screen.getByRole<HTMLInputElement>("radio", { name: "Urgente" }).checked).toBe(true);
    expect(screen.getByRole<HTMLInputElement>("radio", { name: "Normale" }).checked).toBe(false);
  });

  it("reports the newly chosen value to the caller", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RadioGroup legend="Urgence" value="NORMAL" onChange={onChange} options={URGENCY} />);

    await user.click(screen.getByRole("radio", { name: "Urgente" }));
    expect(onChange).toHaveBeenCalledWith("URGENT");
  });

  it("selects an option when its label text is clicked, not only the 16px dot", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RadioGroup legend="Urgence" value="NORMAL" onChange={onChange} options={URGENCY} />);

    await user.click(screen.getByText("Urgente"));
    expect(onChange).toHaveBeenCalledWith("URGENT");
  });

  it("keeps the native radio visible so selection is never conveyed by colour alone (WCAG 1.4.1)", () => {
    const { container } = render(<RadioGroup legend="Urgence" value="NORMAL" onChange={vi.fn()} options={URGENCY} />);
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(2);
  });

  it("groups its radios under one name so the browser enforces single selection", () => {
    render(<RadioGroup legend="Urgence" value="NORMAL" onChange={vi.fn()} options={URGENCY} />);
    const names = screen.getAllByRole<HTMLInputElement>("radio").map((radio) => radio.name);
    expect(new Set(names).size).toBe(1);
  });

  it("keeps two groups on the same page independent", () => {
    render(
      <>
        <RadioGroup legend="Urgence" value="NORMAL" onChange={vi.fn()} options={URGENCY} />
        <RadioGroup legend="Priorite" value="NORMAL" onChange={vi.fn()} options={URGENCY} />
      </>,
    );
    const first = screen.getByRole("group", { name: "Urgence" }).querySelector("input")?.name;
    const second = screen.getByRole("group", { name: "Priorite" }).querySelector("input")?.name;
    expect(first).toBeTruthy();
    expect(first).not.toBe(second);
  });

  it("disables every option when the group is disabled", () => {
    render(<RadioGroup legend="Urgence" value="NORMAL" onChange={vi.fn()} options={URGENCY} disabled />);
    for (const radio of screen.getAllByRole<HTMLInputElement>("radio")) {
      expect(radio.disabled).toBe(true);
    }
  });

  it("suffixes each test id with the option value", () => {
    render(<RadioGroup legend="Urgence" value="NORMAL" onChange={vi.fn()} options={URGENCY} testIdPrefix="urgency" />);
    expect(screen.getByTestId("urgency-NORMAL")).toBeTruthy();
    expect(screen.getByTestId("urgency-URGENT")).toBeTruthy();
  });
});
