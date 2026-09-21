/** Stacking order, spaced by 100 so a layer can be slotted in between later. */
export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  overlay: 1200,
  modal: 1300,
  toast: 1400,
} as const;
