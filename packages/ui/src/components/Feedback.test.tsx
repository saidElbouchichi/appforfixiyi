import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Alert } from "./Alert.js";
import { ProgressBar, ProgressCircle } from "./Progress.js";
import { Stepper } from "./Stepper.js";
import { ToastProvider, useToast, type ToastOptions } from "./Toast.js";

describe("Alert", () => {
  it("is silent by default: a message present from the start is read in page order", () => {
    render(<Alert title="Information">Texte</Alert>);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces errors and warnings as alerts, the rest politely, when asked", () => {
    render(
      <>
        <Alert variant="error" announce title="Echec" />
        <Alert variant="success" announce title="Envoye" />
      </>,
    );
    expect(screen.getByRole("alert").textContent).toContain("Echec");
    expect(screen.getByRole("status").textContent).toContain("Envoye");
  });

  it("carries an icon matching its variant, and a named dismiss button", async () => {
    const onDismiss = vi.fn();
    const { container } = render(
      <Alert variant="warning" title="Attention" onDismiss={onDismiss}>
        Texte
      </Alert>,
    );
    expect(container.querySelector('[data-icon="warning"]')).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Fermer le message" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders as a banner on request", () => {
    const { container } = render(<Alert layout="banner" title="Maintenance" />);
    expect(container.firstElementChild?.className).toContain("fx-alert--banner");
  });
});

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function Trigger({ toast }: { toast: ToastOptions }): React.JSX.Element {
    const { show } = useToast();
    return (
      <button
        type="button"
        onClick={() => {
          show(toast);
        }}
      >
        Declencher
      </button>
    );
  }

  const renderWith = (toast: ToastOptions, max?: number): void => {
    render(
      <ToastProvider {...(max === undefined ? {} : { max })}>
        <Trigger toast={toast} />
      </ToastProvider>,
    );
  };

  const fire = (): void => {
    fireEvent.click(screen.getByRole("button", { name: "Declencher" }));
  };

  it("keeps a polite live region in the page before any toast", () => {
    renderWith({ title: "Enregistre" });
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region.querySelector("[aria-live='polite']")).not.toBeNull();
  });

  it("shows a toast, then removes it after its duration", () => {
    renderWith({ title: "Demande envoyee", variant: "success" });
    fire();
    expect(screen.getByText("Demande envoyee")).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText("Demande envoyee")).toBeNull();
  });

  it("pauses the countdown while hovered, and resumes with the time left (WCAG 2.2.1)", () => {
    renderWith({ title: "Photo envoyee", duration: 4000 });
    fire();
    const toast = screen.getByText("Photo envoyee").closest("li");
    if (!toast) throw new Error("toast not rendered");

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    fireEvent.pointerEnter(toast);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText("Photo envoyee")).not.toBeNull();

    fireEvent.pointerLeave(toast);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByText("Photo envoyee")).toBeNull();
  });

  it("keeps an error until dismissed, and makes it interrupt (role=alert)", () => {
    renderWith({ title: "Envoi impossible", variant: "error" });
    fire();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    const toast = screen.getByRole("alert");
    expect(toast.textContent).toContain("Envoi impossible");

    fireEvent.click(within(toast).getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("runs the action, then leaves", () => {
    const onClick = vi.fn();
    renderWith({ title: "Message supprime", action: { label: "Annuler", onClick } });
    fire();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Message supprime")).toBeNull();
  });

  it("drops the oldest beyond the maximum", () => {
    renderWith({ title: "Notification" }, 2);
    fire();
    fire();
    fire();
    expect(screen.getAllByText("Notification")).toHaveLength(2);
  });

  it("refuses to be used outside its provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Trigger toast={{ title: "x" }} />)).toThrow(/ToastProvider/);
  });
});

describe("ProgressBar", () => {
  it("exposes a named progressbar with its value and a readable value text", () => {
    render(<ProgressBar label="Envoi des photos" value={30} max={120} showValue />);
    const bar = screen.getByRole("progressbar", { name: "Envoi des photos" });
    expect(bar.getAttribute("aria-valuenow")).toBe("30");
    expect(bar.getAttribute("aria-valuemax")).toBe("120");
    expect(bar.getAttribute("aria-valuetext")).toBe("25 %");
    expect(screen.getByText("25 %")).not.toBeNull();
  });

  it("is indeterminate without a value: no valuenow, animated bar", () => {
    render(<ProgressBar label="Chargement" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBeNull();
    expect(bar.className).toContain("fx-progress__track--indeterminate");
  });
});

describe("ProgressCircle", () => {
  it("draws the share as a dash offset and names itself", () => {
    const { container } = render(<ProgressCircle label="Profil complete" value={50} />);
    expect(screen.getByRole("progressbar", { name: "Profil complete" }).getAttribute("aria-valuetext")).toBe("50 %");
    const bar = container.querySelector(".fx-progress-circle__bar");
    const circumference = Number(bar?.getAttribute("stroke-dasharray"));
    expect(Number(bar?.getAttribute("stroke-dashoffset"))).toBeCloseTo(circumference / 2);
  });
});

describe("Stepper", () => {
  const steps = [{ label: "Service" }, { label: "Adresse" }, { label: "Photos" }];

  it("is a named ordered list marking the current step", () => {
    render(<Stepper label="Etapes de la demande" steps={steps} current={1} />);
    const list = screen.getByRole("list", { name: "Etapes de la demande" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((item) => item.getAttribute("aria-current"))).toEqual([null, "step", null]);
  });

  it("says a completed step is done, in words, and draws a check", () => {
    render(<Stepper label="Etapes" steps={steps} current={2} />);
    const first = screen.getAllByRole("listitem")[0];
    expect(first?.textContent).toContain("(terminee)");
    expect(first?.querySelector('[data-icon="check"]')).not.toBeNull();
  });
});
