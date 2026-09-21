import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Chip } from "./Chip.js";
import { FilterBar, type FilterOption } from "./FilterBar.js";
import { SearchBar } from "./SearchBar.js";

describe("Chip", () => {
  it("is a toggle button announcing its pressed state, with a check when selected", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(<Chip label="Plomberie" onToggle={onToggle} />);
    const chip = screen.getByRole("button", { name: "Plomberie" });
    expect(chip.getAttribute("aria-pressed")).toBe("false");

    await userEvent.click(chip);
    expect(onToggle).toHaveBeenCalledWith(true);

    rerender(<Chip label="Plomberie" onToggle={onToggle} selected />);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button").querySelector('[data-icon="check"]')).not.toBeNull();
  });

  it("offers a remove button named after the chip", async () => {
    const onRemove = vi.fn();
    render(<Chip label="Casablanca" onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: "Retirer Casablanca" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("is plain text when it has no action", () => {
    render(<Chip label="Marrakech" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("SearchBar", () => {
  function Controlled({ onSubmit }: { onSubmit?: (value: string) => void }): React.JSX.Element {
    const [value, setValue] = useState("");
    return <SearchBar label="Rechercher un service" value={value} onChange={setValue} onSubmit={onSubmit} />;
  }

  it("is a search landmark whose field is named for assistive tech", () => {
    render(<Controlled />);
    expect(within(screen.getByRole("search")).getByRole("searchbox", { name: "Rechercher un service" })).not.toBeNull();
  });

  it("submits the typed query on Enter", async () => {
    const onSubmit = vi.fn();
    render(<Controlled onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole("searchbox"), "plombier{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("plombier");
  });

  it("clears the query and returns focus to the field", async () => {
    render(<Controlled />);
    const field = screen.getByRole("searchbox");
    expect(screen.queryByRole("button", { name: "Effacer la recherche" })).toBeNull();

    await userEvent.type(field, "peintre");
    await userEvent.click(screen.getByRole("button", { name: "Effacer la recherche" }));
    expect((field as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(field);
  });
});

describe("FilterBar", () => {
  const options: FilterOption[] = [
    { value: "plumbing", label: "Plomberie" },
    { value: "electricity", label: "Electricite" },
  ];

  function Controlled({ multiple = true }: { multiple?: boolean }): React.JSX.Element {
    const [selected, setSelected] = useState<string[]>([]);
    return <FilterBar label="Filtrer par metier" options={options} selected={selected} onChange={setSelected} multiple={multiple} />;
  }

  it("is a named group of toggle chips", () => {
    render(<Controlled />);
    const group = screen.getByRole("group", { name: "Filtrer par metier" });
    expect(within(group).getAllByRole("button")).toHaveLength(2);
  });

  it("accumulates filters, and resets them all", async () => {
    render(<Controlled />);
    await userEvent.click(screen.getByRole("button", { name: "Plomberie" }));
    await userEvent.click(screen.getByRole("button", { name: "Electricite" }));
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(2);

    await userEvent.click(screen.getByRole("button", { name: "Tout effacer" }));
    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Tout effacer" })).toBeNull();
  });

  it("keeps a single filter when multiple is off", async () => {
    render(<Controlled multiple={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Plomberie" }));
    await userEvent.click(screen.getByRole("button", { name: "Electricite" }));
    expect(screen.getAllByRole("button", { pressed: true }).map((chip) => chip.textContent)).toEqual(["Electricite"]);
  });
});
