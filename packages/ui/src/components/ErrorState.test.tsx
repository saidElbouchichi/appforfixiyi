import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ErrorState } from "./ErrorState.js";

describe("ErrorState", () => {
  it("is announced as an alert", () => {
    render(<ErrorState message="Le serveur ne repond pas." />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Une erreur est survenue");
    expect(alert.textContent).toContain("Le serveur ne repond pas.");
  });

  it("renders a retry button that calls onRetry", async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    await userEvent.click(screen.getByRole("button", { name: "Reessayer" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders no button when there is nothing to retry", () => {
    render(<ErrorState message="Acces refuse." />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("accepts a custom title and retry label", () => {
    render(<ErrorState title="Matching indisponible" retryLabel="Relancer" onRetry={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Matching indisponible" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Relancer" })).not.toBeNull();
  });
});
