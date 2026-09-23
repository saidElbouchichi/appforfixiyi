/**
 * Fixiyi palette — Design System V2 (docs/design/, master prompt part 2A).
 *
 * Two layers:
 * 1. SCALES — the raw palette, exactly as specified.
 * 2. ROLES — what a component is allowed to use for a purpose. Components
 *    consume roles, not scale steps, because the scale steps of the
 *    reference board are not all accessible: white text on the brand orange
 *    `#F97316` is 2.80:1, below every WCAG threshold (D1). A role names the
 *    step that passes for that use, and `tokens.test.ts` MEASURES every
 *    declared text/background pair instead of trusting it.
 *
 * Kept in sync with tokens.css by tokens.test.ts (Decision 48).
 */

export const colors = {
  primary: {
    50: "#FFF7ED",
    100: "#FFEDD5",
    200: "#FED7AA",
    300: "#FDBA74",
    400: "#FB923C",
    500: "#F97316", // brand + decor — never carries text (D1)
    600: "#EA580C", // icons, borders, focus (D1)
    700: "#C2410C", // text and text-bearing buttons, 5.18:1 on white (D1)
    800: "#9A3412",
    900: "#7C2D12",
  },
  accent: {
    50: "#FFFBEB",
    100: "#FEF3C7",
    200: "#FDE68A",
    500: "#FBBF24",
    600: "#F59E0B",
    700: "#B45309",
  },
  neutral: {
    // Pure white: surfaces. Not in the board's 50-900 stone scale, but every
    // card, modal and input sits on it.
    0: "#FFFFFF",
    50: "#FAFAF9",
    100: "#F5F5F4",
    200: "#E7E5E4",
    300: "#D6D3D1",
    400: "#A8A29E",
    500: "#78716C",
    600: "#57534E",
    700: "#44403C",
    800: "#292524",
    900: "#1C1917",
  },
  /**
   * Semantic scales. `50` (tints) and the text-safe `700` of warning and
   * info are NOT in part 2A: they extend D1 to the semantics, because
   * warning 600 (3.19:1) and info 600 (4.10:1) are too light for text.
   */
  success: { 50: "#F0FDF4", 500: "#16A34A", 600: "#15803D" },
  warning: { 50: "#FFFBEB", 500: "#F59E0B", 600: "#D97706", 700: "#B45309" },
  error: { 50: "#FEF2F2", 500: "#DC2626", 600: "#B91C1C" },
  info: { 50: "#F0F9FF", 500: "#0EA5E9", 600: "#0284C7", 700: "#0369A1" },
  /**
   * Trade colours (D3), for category tiles and markers. Domotique is
   * deliberately absent: part 2A gives it `#8B5CF6`, the same value as
   * locksmith, which would make two trades indistinguishable by colour. Its
   * value is awaiting the user's choice (docs/design/PHASE_1_REPORT.md).
   *
   * These are fill colours. Several fail as a bare icon on white
   * (electrician 1.92:1, plumber 2.43:1), so a trade icon is drawn on a tile
   * of its colour, never alone on white — enforced when tiles land (D3).
   */
  trade: {
    electrician: "#EAB308",
    plumber: "#06B6D4",
    hvac: "#3B82F6",
    locksmith: "#8B5CF6",
    painter: "#EC4899",
    carpenter: "#A16207",
    appliance: "#F43F5E",
    it: "#64748B",
    cleaning: "#10B981",
    gardening: "#84CC16",
  },
} as const;

/**
 * Initials avatars (D4: no invented photos). Initials are TEXT, so each pair
 * clears 4.5:1 — measured in tokens.test.ts. Locksmith uses a darker violet:
 * `#8B5CF6` reaches neither 4.5:1 with white (4.23) nor with ink (4.13).
 */
export const avatarColors = {
  electrician: { bg: colors.trade.electrician, fg: colors.neutral[900] },
  plumber: { bg: colors.trade.plumber, fg: colors.neutral[900] },
  hvac: { bg: colors.trade.hvac, fg: colors.neutral[900] },
  locksmith: { bg: "#7C3AED", fg: colors.neutral[0] },
  painter: { bg: colors.trade.painter, fg: colors.neutral[900] },
  carpenter: { bg: colors.trade.carpenter, fg: colors.neutral[0] },
} as const;

/**
 * The icon drawn ON a trade tile (D3: a trade icon is never alone on white —
 * several fills fail against it, electrician at 1.92:1). An icon is a
 * graphical object, so the threshold is 3:1, and every pair below is measured
 * by `tokens.test.ts` through `contrastPairs`.
 *
 * The tile carries the icon only; the category name sits underneath it, on
 * the page background, in ordinary text colour. That is deliberate:
 * `locksmith` reaches 4.23:1 with white and 4.13:1 with ink, so it could
 * never carry TEXT on its own fill — putting names on the tiles would have
 * forced a tenth colour or an unreadable label.
 */
export const tradeIconColors = {
  electrician: colors.neutral[900],
  plumber: colors.neutral[900],
  hvac: colors.neutral[900],
  locksmith: colors.neutral[0],
  painter: colors.neutral[900],
  carpenter: colors.neutral[0],
  appliance: colors.neutral[900],
  it: colors.neutral[0],
  cleaning: colors.neutral[900],
  gardening: colors.neutral[900],
} as const;

/**
 * What components use. Each role points at a scale step; the CSS mirror
 * declares it as `var(--fixiyi-color-<scale>-<step>)`, so re-pointing a role
 * is a one-line change.
 */
export const roles = {
  brand: colors.primary[500],
  action: colors.primary[700],
  actionHover: colors.primary[800],
  actionSubtle: colors.primary[50],
  onAction: colors.neutral[0],
  focus: colors.primary[600],
  iconAccent: colors.primary[600],

  surface: colors.neutral[0],
  surfaceMuted: colors.neutral[50],
  surfaceSunken: colors.neutral[100],

  text: colors.neutral[900],
  textMuted: colors.neutral[600],
  /** Placeholders and meta text — 4.80:1 on white, 4.59:1 on surfaceMuted, NOT on surfaceSunken (4.40:1). */
  textSubtle: colors.neutral[500],

  /** Decorative separators (cards, dividers) — carry no information. */
  border: colors.neutral[200],
  /** The outline that identifies a form control: 3:1 required (WCAG 1.4.11). The v1 border was 1.87:1. */
  borderControl: colors.neutral[500],

  successText: colors.success[600],
  successSurface: colors.success[50],
  warningText: colors.warning[700],
  warningSurface: colors.warning[50],
  errorText: colors.error[600],
  errorSurface: colors.error[50],
  infoText: colors.info[700],
  infoSurface: colors.info[50],

  dangerAction: colors.error[600],
  onDanger: colors.neutral[0],
} as const;

export type ColorRole = keyof typeof roles;

/**
 * Every foreground/background combination the design system relies on, with
 * the WCAG minimum it must meet: 4.5 for text, 3 for icons, borders and
 * focus indicators (1.4.3 / 1.4.11). Asserted by tokens.test.ts — adding a
 * role usage without its pair here leaves it unverified.
 */
export const contrastPairs: readonly { fg: string; bg: string; min: 3 | 4.5; use: string }[] = [
  { fg: roles.onAction, bg: roles.action, min: 4.5, use: "primary button label" },
  { fg: roles.onAction, bg: roles.actionHover, min: 4.5, use: "primary button label, hover" },
  { fg: roles.action, bg: roles.surface, min: 4.5, use: "link / ghost button on white" },
  { fg: roles.action, bg: roles.surfaceMuted, min: 4.5, use: "link on the page background" },
  { fg: roles.action, bg: roles.actionSubtle, min: 4.5, use: "selected choice, ghost hover" },
  { fg: roles.focus, bg: roles.surface, min: 3, use: "focus ring on white" },
  { fg: roles.focus, bg: roles.surfaceMuted, min: 3, use: "focus ring on the page background" },
  { fg: roles.iconAccent, bg: roles.surface, min: 3, use: "accent icon on white" },
  { fg: roles.text, bg: roles.surface, min: 4.5, use: "body text" },
  { fg: roles.text, bg: roles.surfaceSunken, min: 4.5, use: "text on sunken surfaces" },
  { fg: roles.textMuted, bg: roles.surface, min: 4.5, use: "secondary text" },
  { fg: roles.textMuted, bg: roles.surfaceSunken, min: 4.5, use: "secondary text on sunken surfaces" },
  { fg: roles.textSubtle, bg: roles.surface, min: 4.5, use: "placeholder / meta on white" },
  { fg: roles.textSubtle, bg: roles.surfaceMuted, min: 4.5, use: "meta on the page background" },
  { fg: roles.borderControl, bg: roles.surface, min: 3, use: "form control outline" },
  { fg: roles.successText, bg: roles.successSurface, min: 4.5, use: "success badge" },
  { fg: roles.warningText, bg: roles.warningSurface, min: 4.5, use: "warning badge" },
  { fg: roles.errorText, bg: roles.errorSurface, min: 4.5, use: "error badge" },
  { fg: roles.errorText, bg: roles.surface, min: 4.5, use: "field error message" },
  { fg: roles.infoText, bg: roles.infoSurface, min: 4.5, use: "info badge" },
  { fg: roles.onDanger, bg: roles.dangerAction, min: 4.5, use: "danger button label" },
  { fg: colors.primary[100], bg: roles.action, min: 3, use: "read ticks on the viewer's own bubble" },
  { fg: colors.neutral[900], bg: colors.primary[500], min: 4.5, use: "gradient button label, orange end" },
  { fg: colors.neutral[900], bg: colors.accent[500], min: 4.5, use: "gradient button label, yellow end" },
  { fg: roles.action, bg: roles.surfaceMuted, min: 4.5, use: "text logo placeholder (D4)" },
  { fg: tradeIconColors.electrician, bg: colors.trade.electrician, min: 3, use: "trade icon on its electrician tile" },
  { fg: tradeIconColors.plumber, bg: colors.trade.plumber, min: 3, use: "trade icon on its plumber tile" },
  { fg: tradeIconColors.hvac, bg: colors.trade.hvac, min: 3, use: "trade icon on its hvac tile" },
  { fg: tradeIconColors.locksmith, bg: colors.trade.locksmith, min: 3, use: "trade icon on its locksmith tile" },
  { fg: tradeIconColors.painter, bg: colors.trade.painter, min: 3, use: "trade icon on its painter tile" },
  { fg: tradeIconColors.carpenter, bg: colors.trade.carpenter, min: 3, use: "trade icon on its carpenter tile" },
  { fg: tradeIconColors.appliance, bg: colors.trade.appliance, min: 3, use: "trade icon on its appliance tile" },
  { fg: tradeIconColors.it, bg: colors.trade.it, min: 3, use: "trade icon on its it tile" },
  { fg: tradeIconColors.cleaning, bg: colors.trade.cleaning, min: 3, use: "trade icon on its cleaning tile" },
  { fg: tradeIconColors.gardening, bg: colors.trade.gardening, min: 3, use: "trade icon on its gardening tile" },
  { fg: roles.onAction, bg: roles.successText, min: 4.5, use: "button label in its success state" },
  { fg: roles.textMuted, bg: roles.surfaceSunken, min: 4.5, use: "neutral badge / chip" },
  { fg: colors.accent[700], bg: roles.surface, min: 3, use: "rating star outline (the filled state is not colour alone)" },
  { fg: roles.borderControl, bg: roles.surface, min: 3, use: "switch track and checkbox box, off" },
  ...Object.entries(avatarColors).map(([trade, pair]) => ({ fg: pair.fg, bg: pair.bg, min: 4.5 as const, use: `avatar initials, ${trade}` })),
];
