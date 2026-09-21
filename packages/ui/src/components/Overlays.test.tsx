import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Accordion } from "./Accordion.js";
import { BottomSheet } from "./BottomSheet.js";
import { CommandPalette, filterCommands, normalizeSearch, useCommandPaletteShortcut, type Command } from "./CommandPalette.js";
import { Menu, type MenuItem } from "./Menu.js";
import { Tabs } from "./Tabs.js";

describe("BottomSheet", () => {
  function Harness(): React.JSX.Element {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
        >
          Filtres
        </button>
        <BottomSheet
          open={open}
          title="Filtrer"
          onClose={() => {
            setOpen(false);
          }}
          footer={<button type="button">Appliquer</button>}
        >
          contenu
        </BottomSheet>
      </>
    );
  }

  it("is a modal dialog named by its title, taking focus and locking the page scroll", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Filtres" }));

    const sheet = screen.getByRole("dialog", { name: "Filtrer" });
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(sheet);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("closes on Escape, restores the scroll and returns focus to its trigger", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Filtres" }));
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Filtres" }));
  });

  it("keeps Tab inside the sheet", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Filtres" }));
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });
});

describe("Menu", () => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  const items: MenuItem[] = [
    { id: "edit", label: "Modifier", icon: "edit", onSelect: onEdit },
    { id: "copy", label: "Copier", onSelect: vi.fn(), disabled: true },
    { id: "delete", label: "Supprimer", icon: "delete", onSelect: onDelete, danger: true },
  ];

  it("is a named menu button, collapsed until opened", () => {
    render(<Menu label="Actions sur le message" items={items} />);
    const trigger = screen.getByRole("button", { name: "Actions sur le message" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens on click with focus on the first item, and arrows skip disabled items and wrap", async () => {
    render(<Menu label="Actions" items={items} />);
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Modifier" }));

    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Supprimer" }));

    await userEvent.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Modifier" }));
  });

  it("opens on ArrowUp at the last item, and jumps by first letter", async () => {
    render(<Menu label="Actions" items={items} />);
    screen.getByRole("button", { name: "Actions" }).focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Supprimer" }));

    await userEvent.keyboard("m");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Modifier" }));
  });

  it("runs an item, closes and returns focus to the trigger", async () => {
    render(<Menu label="Actions" items={items} />);
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.keyboard("{Enter}");

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Actions" }));
  });

  it("closes on Escape and on a click outside", async () => {
    render(
      <>
        <Menu label="Actions" items={items} />
        <p>ailleurs</p>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.pointerDown(screen.getByText("ailleurs"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("ignores a disabled item", async () => {
    const copy = items[1];
    render(<Menu label="Actions" items={items} />);
    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Copier" }));
    expect(copy?.onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).not.toBeNull();
  });
});

describe("Tabs", () => {
  function Controlled(): React.JSX.Element {
    const [value, setValue] = useState("services");
    return (
      <Tabs
        label="Profil"
        value={value}
        onChange={setValue}
        tabs={[
          { id: "services", label: "Services", content: <p>Liste des services</p> },
          { id: "about", label: "A propos", content: <p>Presentation</p> },
          { id: "zones", label: "Zones", content: <p>Zones couvertes</p> },
        ]}
      />
    );
  }

  it("wires tabs to panels, one tab stop, only the selected panel shown", () => {
    render(<Controlled />);
    const tabs = within(screen.getByRole("tablist", { name: "Profil" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    const panel = screen.getByRole("tabpanel", { name: "Services" });
    expect(tabs[0]?.getAttribute("aria-controls")).toBe(panel.id);
    expect(screen.getByText("Presentation").closest<HTMLElement>("[role=tabpanel]")?.hidden).toBe(true);
  });

  it("moves and selects with the arrow keys, wrapping, and with Home/End", async () => {
    render(<Controlled />);
    screen.getByRole("tab", { name: "Services" }).focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "A propos" }).getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "A propos" }));

    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Zones" }).getAttribute("aria-selected")).toBe("true");

    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Services" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Liste des services")).not.toBeNull();
  });
});

describe("Tabs in RTL", () => {
  it("swaps the arrow keys: ArrowLeft goes to the next tab in Arabic", async () => {
    function Controlled(): React.JSX.Element {
      const [value, setValue] = useState("one");
      return (
        <div dir="rtl" style={{ direction: "rtl" }}>
          <Tabs
            label="Onglets"
            value={value}
            onChange={setValue}
            tabs={[
              { id: "one", label: "Un", content: "1" },
              { id: "two", label: "Deux", content: "2" },
            ]}
          />
        </div>
      );
    }
    render(<Controlled />);
    screen.getByRole("tab", { name: "Un" }).focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Deux" }).getAttribute("aria-selected")).toBe("true");
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Un" }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("Accordion", () => {
  const items = [
    { id: "a", title: "Comment payer ?", content: <p>Reponse A</p> },
    { id: "b", title: "Puis-je annuler ?", content: <p>Reponse B</p> },
  ];

  it("uses headings around buttons that control named regions", () => {
    render(<Accordion items={items} headingLevel={2} />);
    const trigger = screen.getByRole("button", { name: "Comment payer ?" });
    expect(trigger.closest("h2")).not.toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("opens one section at a time by default", async () => {
    render(<Accordion items={items} />);
    await userEvent.click(screen.getByRole("button", { name: "Comment payer ?" }));
    expect(screen.getByRole("region", { name: "Comment payer ?" }).textContent).toBe("Reponse A");

    await userEvent.click(screen.getByRole("button", { name: "Puis-je annuler ?" }));
    expect(screen.queryByRole("region", { name: "Comment payer ?" })).toBeNull();
    expect(screen.getByRole("region", { name: "Puis-je annuler ?" })).not.toBeNull();
  });

  it("keeps several open when multiple is on", async () => {
    render(<Accordion items={items} multiple defaultExpanded={["a"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Puis-je annuler ?" }));
    expect(screen.getAllByRole("region")).toHaveLength(2);
  });
});

describe("CommandPalette", () => {
  const goRequests = vi.fn();
  const commands: Command[] = [
    { id: "requests", label: "Mes demandes", group: "Navigation", onRun: goRequests },
    { id: "new", label: "Nouvelle demande", group: "Actions", keywords: ["devis"], onRun: vi.fn() },
    { id: "chat", label: "Messages", group: "Navigation", onRun: vi.fn() },
  ];

  it("normalises accents and case, and matches every word, keywords included", () => {
    expect(normalizeSearch("  Électricité ")).toBe("electricite");
    expect(filterCommands(commands, "DEMANDE").map((command) => command.id)).toEqual(["requests", "new"]);
    expect(filterCommands(commands, "devis").map((command) => command.id)).toEqual(["new"]);
    expect(filterCommands(commands, "")).toHaveLength(3);
  });

  function Harness(): React.JSX.Element {
    const [open, setOpen] = useState(false);
    useCommandPaletteShortcut(() => {
      setOpen(true);
    });
    return (
      <CommandPalette
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        commands={commands}
      />
    );
  }

  it("opens on Ctrl+K with focus in a combobox over a listbox", async () => {
    render(<Harness />);
    await userEvent.keyboard("{Control>}k{/Control}");
    const field = screen.getByRole("combobox", { name: "Palette de commandes" });
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute("aria-controls")).toBe(screen.getByRole("listbox").id);
  });

  it("lists in on-screen order, moves the active option, runs it with Enter and closes", async () => {
    render(<Harness />);
    await userEvent.keyboard("{Control>}k{/Control}");
    const field = screen.getByRole("combobox");
    // Grouped: both Navigation entries first, then Actions.
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Mes demandes", "Messages", "Nouvelle demande"]);
    expect(field.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option", { name: "Mes demandes" }).id);

    await userEvent.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    expect(goRequests).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("filters as you type, announces the count, and shows an empty state", async () => {
    render(<Harness />);
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox"), "mess");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("1 resultat");

    await userEvent.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByText("Aucun resultat")).not.toBeNull();
  });

  it("starts empty again after closing", async () => {
    render(<Harness />);
    await userEvent.keyboard("{Control>}k{/Control}");
    await userEvent.type(screen.getByRole("combobox"), "mess");
    await userEvent.keyboard("{Escape}");
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole<HTMLInputElement>("combobox").value).toBe("");
  });
});
