/** @jsxImportSource react */
import { expect, test, type Page } from "@playwright/test";
import { Badge, Button, Card, Icon, ICON_NAMES, Input, Select, Skeleton, Textarea } from "@fixiyi/ui";

import { contrastRatio, renderUi } from "../support/ui-harness";

/**
 * @fixiyi/ui primitives in a real browser (design phase 4), through the
 * harness: real stylesheet, real layout, measured — see support/ui-harness.ts.
 * Captures land in screenshots/ds-*.png for review.
 */

const noop = (): void => undefined;

/** Computed text colour against the nearest opaque background behind the element. */
async function textContrast(page: Page, testId: string): Promise<number> {
  const [color, background] = await page.getByTestId(testId).evaluate((element) => {
    let node: Element | null = element;
    let fill = "rgb(255, 255, 255)";
    while (node) {
      const candidate = getComputedStyle(node).backgroundColor;
      if (!candidate.startsWith("rgba(0, 0, 0, 0)") && candidate !== "transparent") {
        fill = candidate;
        break;
      }
      node = node.parentElement;
    }
    return [getComputedStyle(element).color, fill];
  });
  return contrastRatio(color, background);
}

test.describe("icons", () => {
  test("every glyph renders inside its box", async ({ page }) => {
    await renderUi(
      page,
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 40px)", gap: 8 }}>
        {ICON_NAMES.map((name) => (
          <span key={name} title={name} style={{ display: "grid", placeItems: "center", blockSize: 40, background: "white" }}>
            <Icon name={name} size="lg" />
          </span>
        ))}
      </div>,
    );
    const boxes = await page.locator("svg.fx-icon").evaluateAll((icons) =>
      icons.map((icon) => {
        const box = icon.getBoundingClientRect();
        return { name: icon.getAttribute("data-icon"), width: box.width, height: box.height };
      }),
    );
    expect(boxes).toHaveLength(ICON_NAMES.length);
    for (const box of boxes) expect(box, box.name ?? "").toMatchObject({ width: 24, height: 24 });
    await page.screenshot({ path: "screenshots/ds-01-icons.png", fullPage: true, animations: "disabled" });
  });

  test("directional glyphs mirror in RTL, others do not", async ({ page }) => {
    await renderUi(
      page,
      <p>
        <Icon name="arrow-forward" testId="forward" /> <Icon name="home" testId="home" />
      </p>,
      { dir: "rtl" },
    );
    expect(await page.getByTestId("forward").evaluate((icon) => getComputedStyle(icon).transform)).toBe("matrix(-1, 0, 0, 1, 0, 0)");
    expect(await page.getByTestId("home").evaluate((icon) => getComputedStyle(icon).transform)).toBe("none");
  });
});

const BUTTON_VARIANTS = ["primary", "secondary", "danger", "ghost", "gradient", "pulse"] as const;
const BUTTON_SIZES = { sm: 32, md: 40, lg: 48, xl: 56 } as const;

const buttonGallery = (
  <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
    {BUTTON_VARIANTS.map((variant) => (
      <Button key={variant} variant={variant} testId={`button-${variant}`}>
        <Icon name="arrow-forward" size="sm" /> {variant}
      </Button>
    ))}
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {Object.keys(BUTTON_SIZES).map((size) => (
        <Button key={size} size={size as keyof typeof BUTTON_SIZES} variant="secondary" testId={`button-size-${size}`}>
          {size}
        </Button>
      ))}
    </div>
    <div style={{ display: "flex", gap: 8 }}>
      <Button loading>Envoi</Button>
      <Button success testId="button-success">
        Enregistre
      </Button>
      <Button disabled>Indisponible</Button>
    </div>
  </div>
);

test.describe("button", () => {
  test("renders the four heights of part 2B with a pointer", async ({ page }) => {
    await renderUi(page, buttonGallery);
    for (const [size, height] of Object.entries(BUTTON_SIZES)) {
      expect((await page.getByTestId(`button-size-${size}`).boundingBox())?.height, size).toBe(height);
    }
    await page.screenshot({ path: "screenshots/ds-02-buttons.png", fullPage: true, animations: "disabled" });
  });

  test("keeps every label readable: measured contrast of each variant", async ({ page }) => {
    await renderUi(page, buttonGallery);
    for (const variant of ["primary", "secondary", "danger", "ghost", "pulse"]) {
      expect(await textContrast(page, `button-${variant}`), variant).toBeGreaterThanOrEqual(4.5);
    }
    expect(await textContrast(page, "button-success")).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe("button on a touch screen", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("grows sm and md to the 44px touch target", async ({ page }) => {
    await renderUi(page, buttonGallery);
    // Device pixel ratio rounding: compare to the pixel, not to the float.
    expect((await page.getByTestId("button-size-sm").boundingBox())?.height).toBeCloseTo(44, 0);
    expect((await page.getByTestId("button-size-md").boundingBox())?.height).toBeCloseTo(44, 0);
    expect((await page.getByTestId("button-size-xl").boundingBox())?.height).toBeCloseTo(56, 0);
  });
});

test.describe("badges, cards, fields", () => {
  test("render the batch B gallery with readable badges", async ({ page }) => {
    await renderUi(
      page,
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(["neutral", "brand", "info", "success", "warning", "error"] as const).map((variant) => (
            <Badge key={variant} variant={variant} dot={variant === "success"} testId={`badge-${variant}`}>
              {variant}
            </Badge>
          ))}
          <Badge variant="info" icon="shield">
            Verifie
          </Badge>
        </div>
        <Card title="Carte interactive" interactive highlight="brand" cornerBadge={<Badge variant="brand">Nouveau</Badge>} footer={<span>Pied de carte</span>} testId="card">
          <a className="fx-card__primary-action fx-link" href="#demande">
            Voir la demande
          </a>
        </Card>
        <Card title="Bordure degradee" gradientBorder>
          Contenu
        </Card>
        <Input label="Recherche" value="" onChange={noop} iconStart="search" placeholder="Plombier, electricien..." />
        <Select label="Ville" value="" onChange={noop} options={[{ value: "casa", label: "Casablanca" }]} />
        <Textarea label="Description" value="" onChange={noop} error="Decrivez le probleme." />
        <Skeleton lines={3} />
      </div>,
    );
    for (const variant of ["neutral", "brand", "info", "success", "warning", "error"]) {
      expect(await textContrast(page, `badge-${variant}`), variant).toBeGreaterThanOrEqual(4.5);
    }
    await page.screenshot({ path: "screenshots/ds-03-badges-cards-fields.png", fullPage: true, animations: "disabled" });
  });

  test("an interactive card follows its primary action from anywhere", async ({ page }) => {
    await renderUi(
      page,
      <Card title="Demande" interactive testId="card">
        <a className="fx-card__primary-action" href="#demande-12">
          Voir la demande
        </a>
      </Card>,
    );
    const card = page.getByTestId("card");
    const box = await card.boundingBox();
    await page.mouse.click((box?.x ?? 0) + (box?.width ?? 0) - 12, (box?.y ?? 0) + (box?.height ?? 0) - 12);
    await expect(page).toHaveURL(/#demande-12$/);
  });

  test("an interactive card shows the focus ring of its primary action", async ({ page }) => {
    await renderUi(
      page,
      <Card title="Demande" interactive testId="card">
        <a className="fx-card__primary-action" href="#demande-12">
          Voir la demande
        </a>
      </Card>,
    );
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Voir la demande" })).toBeFocused();
    expect(await page.getByTestId("card").evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
  });
});
