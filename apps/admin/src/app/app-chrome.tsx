"use client";

import { AppShell, Button, Header, Logo, Navbar, type NavItem } from "@fixiyi/ui";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useAuthHydrated, useAuthStore } from "../lib/auth-store";
import { signOut } from "../lib/session";

/** The back-office has one destination today; the admin dashboard is Phase 12. */
const ADMIN_ITEMS: NavItem[] = [{ href: "/catalog", label: "Catalogue", icon: "tools" }];

function SignOutButton(): React.JSX.Element {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="ghost"
      loading={pending}
      onClick={() => {
        setPending(true);
        void signOut().finally(() => {
          setPending(false);
          router.push("/login");
        });
      }}
      testId="sign-out-button"
    >
      Se deconnecter
    </Button>
  );
}

/**
 * The back-office frame. No bottom bar and no footer: an internal tool with a
 * single destination, used on a desktop (phase 5 of the design rework). The
 * sign-out button lives in the header because the admin has no profile page.
 */
export function AppChrome({ children }: { children: ReactNode }): React.JSX.Element {
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthHydrated();
  const pathname = usePathname();
  const signedIn = hydrated && user !== null;
  const active = ADMIN_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.href;

  return (
    <AppShell
      header={
        <Header
          brand={<Logo suffix="Admin" />}
          navigation={signedIn ? <Navbar label="Navigation principale" items={ADMIN_ITEMS} activeHref={active} testId="navbar" /> : undefined}
          actions={signedIn ? <SignOutButton /> : undefined}
        />
      }
    >
      {children}
    </AppShell>
  );
}
