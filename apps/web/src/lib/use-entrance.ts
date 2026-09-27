import { useState } from "react";

/**
 * Whether content on this screen ARRIVES, and so may play an entry animation.
 * True only when the screen first showed its loading state: the content then
 * replaces a placeholder, and the motion says so. On a return with the data
 * already cached, the list is simply there — replaying its entry would say
 * something arrived when nothing did (design phase 12, measured on the home
 * tiles). Read once, at mount: a later refetch is not an arrival either.
 */
export function useEntrance(pendingAtMount: boolean): boolean {
  const [sawLoading] = useState(pendingAtMount);
  return sawLoading;
}
