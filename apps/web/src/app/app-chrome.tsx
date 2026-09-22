"use client";

import { AppShell, BottomNavigation, Footer, Header, Logo, Navbar } from "@fixiyi/ui";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useAuthHydrated, useAuthStore } from "../lib/auth-store";
import { CONVERSATIONS_KEY, listConversations } from "../lib/chat-api";
import { activeNavHref, navigationFor, totalUnread } from "../lib/navigation";

import { useUnreadRefresh } from "./use-unread-refresh";

const NAV_LABEL = "Navigation principale";

/**
 * The frame around every screen, and the one place that decides what the
 * navigation offers: destinations come from the signed-in user's roles
 * (`navigationFor`), never from the screen being rendered. It is a client
 * component because the session lives in the store — `layout.tsx` stays on
 * the server.
 */
export function AppChrome({ children, legal }: { children: ReactNode; legal: string }): React.JSX.Element {
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthHydrated();
  const pathname = usePathname();

  // The badge counts what the API reports; a signed-out visitor asks nothing.
  const conversationsQuery = useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: listConversations,
    enabled: hydrated && user !== null,
  });
  useUnreadRefresh(hydrated && user !== null);

  const items = navigationFor(hydrated ? user : null, conversationsQuery.data ? totalUnread(conversationsQuery.data) : 0);
  const active = activeNavHref(pathname, items);
  const hasNavigation = items.length > 0;

  return (
    <AppShell
      header={<Header brand={<Logo />} navigation={hasNavigation ? <Navbar label={NAV_LABEL} items={items} activeHref={active} testId="navbar" /> : undefined} />}
      bottomNavigation={
        hasNavigation ? <BottomNavigation label={NAV_LABEL} items={items} activeHref={active} testId="bottom-nav" /> : undefined
      }
      footer={<Footer brand={<Logo />} tagline="Plus qu'une application, une solution de confiance." legal={legal} />}
    >
      {children}
    </AppShell>
  );
}
