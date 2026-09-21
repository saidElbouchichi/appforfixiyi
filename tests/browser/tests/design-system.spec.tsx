/** @jsxImportSource react */
import { expect, test, type Page } from "@playwright/test";
import { Alert, Avatar, Badge, Button, Card, Checkbox, ProgressBar, ProgressCircle, Rating, RatingInput, Stepper, Tooltip, IconButton, Chip, FilterBar, Icon, ICON_NAMES, Input, SearchBar, Select, Skeleton, Slider, Switch, Textarea } from "@fixiyi/ui";

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

const controlsGallery = (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <SearchBar label="Rechercher un service" value="plombier" onChange={noop} placeholder="Que recherchez-vous ?" />
    <FilterBar
      label="Filtrer par metier"
      options={[
        { value: "electricity", label: "Electricite", icon: "bolt" },
        { value: "plumbing", label: "Plomberie", icon: "droplet" },
        { value: "hvac", label: "Climatisation", icon: "snowflake" },
        { value: "locksmith", label: "Serrurerie", icon: "key" },
      ]}
      selected={["plumbing"]}
      onChange={noop}
    />
    <div style={{ display: "flex", gap: 8 }}>
      <Chip label="Casablanca" onRemove={noop} testId="chip-removable" />
      <Chip label="Selectionne" onToggle={noop} selected testId="chip-selected" />
    </div>
    <Checkbox label="J'accepte les conditions" checked onChange={noop} description="Obligatoire pour envoyer la demande" />
    <Checkbox label="Tous les metiers" checked={false} indeterminate onChange={noop} />
    <Checkbox label="Non coche" checked={false} onChange={noop} />
    <Switch label="Notifications par SMS" checked onChange={noop} testId="switch-on" />
    <Switch label="Disponible le week-end" checked={false} onChange={noop} testId="switch-off" />
    <Slider label="Rayon de recherche" value={15} min={1} max={50} onChange={noop} formatValue={(km) => `${km.toString()} km`} testId="slider" />
  </div>
);

test.describe("form controls", () => {
  test("render the batch C gallery, readable", async ({ page }) => {
    await renderUi(page, controlsGallery);
    expect(await textContrast(page, "chip-selected")).toBeGreaterThanOrEqual(4.5);
    expect((await page.getByTestId("slider").boundingBox())?.height).toBeGreaterThanOrEqual(44);
    // Icons take the colour their component gives them (white check on the orange box, muted search glyph).
    const markColor = await page.locator(".fx-checkbox__mark").first().evaluate((mark) => getComputedStyle(mark).color);
    expect(markColor).toBe("rgb(255, 255, 255)");
    expect(await page.locator(".fx-search__icon").evaluate((icon) => getComputedStyle(icon).color)).toBe("rgb(87, 83, 78)");
    await page.screenshot({ path: "screenshots/ds-04-controls.png", fullPage: true, animations: "disabled" });
  });

  test("slides the switch thumb to the inline end, in LTR and in RTL", async ({ page }) => {
    for (const dir of ["ltr", "rtl"] as const) {
      await renderUi(page, controlsGallery, { dir });
      const track = await page.getByTestId("switch-on").boundingBox();
      const thumb = await page.getByTestId("switch-on").locator(".fx-switch__thumb").boundingBox();
      const thumbCentre = (thumb?.x ?? 0) + (thumb?.width ?? 0) / 2;
      const trackCentre = (track?.x ?? 0) + (track?.width ?? 0) / 2;
      if (dir === "ltr") expect(thumbCentre, dir).toBeGreaterThan(trackCentre);
      else expect(thumbCentre, dir).toBeLessThan(trackCentre);
    }
    await page.screenshot({ path: "screenshots/ds-05-controls-rtl.png", fullPage: true, animations: "disabled" });
  });
});

test.describe("form controls on a touch screen", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("give filter chips and chip remove buttons the 44px touch target", async ({ page }) => {
    await renderUi(page, controlsGallery);
    expect((await page.getByRole("button", { name: "Plomberie" }).boundingBox())?.height).toBeCloseTo(44, 0);
    expect((await page.getByRole("button", { name: "Retirer Casablanca" }).boundingBox())?.height).toBeCloseTo(44, 0);
  });
});

const TRADES = ["electrician", "plumber", "hvac", "locksmith", "painter", "carpenter"] as const;

const feedbackGallery = (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {(["info", "success", "warning", "error"] as const).map((variant) => (
      <Alert key={variant} variant={variant} title={`Titre ${variant}`} onDismiss={noop} testId={`alert-${variant}`}>
        Message de l'alerte, sur deux lignes si besoin pour verifier le retour a la ligne.
      </Alert>
    ))}
    <ProgressBar label="Envoi des photos" value={60} showValue />
    <ProgressBar label="Recherche d'un artisan" />
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <ProgressCircle label="Profil" value={25} size="sm" />
      <ProgressCircle label="Profil" value={50} />
      <ProgressCircle label="Profil" value={75} size="lg" />
    </div>
    <Stepper label="Etapes" steps={[{ label: "Service" }, { label: "Adresse" }, { label: "Photos" }, { label: "Envoi" }]} current={2} />
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      {TRADES.map((trade, index) => (
        <Avatar key={trade} name={`Artisan ${trade}`} trade={trade} status={index === 0 ? "online" : undefined} testId={`avatar-${trade}`} />
      ))}
      <Avatar name="Karim Benali" size="lg" status="busy" />
    </div>
    <Rating value={4.3} count={12} />
    <RatingInput label="Votre note" value={3} onChange={noop} />
    <div style={{ paddingBlockStart: 40 }}>
      <Tooltip content="Visible par le client apres acceptation">{(describedBy) => <IconButton label="Aide" icon="info" describedBy={describedBy} />}</Tooltip>
    </div>
  </div>
);

test.describe("feedback and identity", () => {
  test("render the batch D gallery with readable alerts and avatars", async ({ page }) => {
    await renderUi(page, feedbackGallery);
    for (const variant of ["info", "success", "warning", "error"]) {
      expect(await textContrast(page, `alert-${variant}`), variant).toBeGreaterThanOrEqual(4.5);
    }
    for (const trade of TRADES) {
      const [color, background] = await page.getByTestId(`avatar-${trade}`).evaluate((avatar) => [getComputedStyle(avatar).color, getComputedStyle(avatar).backgroundColor]);
      expect(contrastRatio(color ?? "", background ?? ""), trade).toBeGreaterThanOrEqual(4.5);
    }
    // Show the tooltip as focus would, for the capture.
    await page.locator(".fx-tooltip__bubble").evaluate((bubble) => {
      bubble.setAttribute("data-open", "true");
    });
    await page.screenshot({ path: "screenshots/ds-06-feedback-identity.png", fullPage: true, animations: "disabled" });
  });

  test("keeps the horizontal stepper inside a 360px phone", async ({ page }) => {
    await renderUi(page, <Stepper label="Etapes" steps={[{ label: "Service" }, { label: "Adresse" }, { label: "Photos" }, { label: "Envoi" }]} current={1} />, { width: 360 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});
