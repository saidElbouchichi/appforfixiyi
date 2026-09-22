import type { ServiceRequest, User, UserRole } from "@fixiyi/contracts";
import { describe, expect, it } from "vitest";

import { NAV_HREFS, activeNavHref, navigationFor, requestHref, totalUnread } from "./navigation";

function userWith(roles: UserRole[]): User {
  return {
    id: "01930000-0000-7000-8000-000000000001",
    phone: "+212600000001",
    phoneVerifiedAt: "2026-09-22T10:00:00.000Z",
    email: null,
    emailVerifiedAt: null,
    dateOfBirth: null,
    roles,
    status: "ACTIVE",
    createdAt: "2026-09-22T10:00:00.000Z",
    updatedAt: "2026-09-22T10:00:00.000Z",
  };
}

function hrefs(user: User | null, unreadCount = 0): string[] {
  return navigationFor(user, unreadCount).map((item) => item.href);
}

describe("navigationFor", () => {
  it("offers nothing to a signed-out visitor: only the login screen exists", () => {
    expect(navigationFor(null, 0)).toEqual([]);
  });

  it("gives a client their four destinations, in order", () => {
    expect(hrefs(userWith(["CLIENT"]))).toEqual([NAV_HREFS.newRequest, NAV_HREFS.requests, NAV_HREFS.conversations, NAV_HREFS.profile]);
  });

  it("starts a provider on their inbox and still lets them order (Decision 65)", () => {
    expect(hrefs(userWith(["PROVIDER"]))).toEqual([
      NAV_HREFS.providerRequests,
      NAV_HREFS.conversations,
      NAV_HREFS.newRequest,
      NAV_HREFS.requests,
      NAV_HREFS.profile,
    ]);
  });

  it("never exceeds the five items the bottom bar is built for", () => {
    for (const roles of [["CLIENT"], ["PROVIDER"], ["CLIENT", "PROVIDER"], ["ADMIN"]] satisfies UserRole[][]) {
      expect(navigationFor(userWith(roles), 0).length).toBeLessThanOrEqual(5);
    }
  });

  it("gives every item an icon and a label: an icon alone is a guess", () => {
    for (const item of navigationFor(userWith(["PROVIDER"]), 0)) {
      expect(item.icon.length).toBeGreaterThan(0);
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it("carries the unread count on Messages only, and hides it at zero", () => {
    const withUnread = navigationFor(userWith(["CLIENT"]), 3);
    const messages = withUnread.find((item) => item.href === NAV_HREFS.conversations);
    expect(messages?.badge).toBe(3);
    expect(withUnread.filter((item) => item.badge !== undefined)).toHaveLength(1);

    const none = navigationFor(userWith(["CLIENT"]), 0);
    expect(none.find((item) => item.href === NAV_HREFS.conversations)?.badge).toBeUndefined();
  });

  it("speaks the count with its label: 'Messages, 3 non lus'", () => {
    const messages = navigationFor(userWith(["CLIENT"]), 3).find((item) => item.href === NAV_HREFS.conversations);
    expect(messages?.badgeLabel?.(1)).toBe("1 non lu");
    expect(messages?.badgeLabel?.(3)).toBe("3 non lus");
  });
});

describe("activeNavHref", () => {
  const items = navigationFor(userWith(["PROVIDER"]), 0);

  it.each([
    ["/requests/new", NAV_HREFS.newRequest],
    ["/requests", NAV_HREFS.requests],
    ["/provider/requests", NAV_HREFS.providerRequests],
    ["/conversations", NAV_HREFS.conversations],
    ["/profile", NAV_HREFS.profile],
  ])("marks %s as its own entry", (pathname, expected) => {
    expect(activeNavHref(pathname, items)).toBe(expected);
  });

  it("keeps a detail screen under its list", () => {
    expect(activeNavHref("/requests/01930000-0000-7000-8000-000000000009/match", items)).toBe(NAV_HREFS.requests);
    expect(activeNavHref("/conversations/01930000-0000-7000-8000-00000000000a", items)).toBe(NAV_HREFS.conversations);
  });

  it("prefers the longest match: /requests/new is not 'Mes demandes'", () => {
    expect(activeNavHref("/requests/new", items)).not.toBe(NAV_HREFS.requests);
  });

  it("marks nothing on a screen outside the navigation", () => {
    expect(activeNavHref("/login", items)).toBeUndefined();
  });

  it("never marks an entry the user does not have", () => {
    expect(activeNavHref("/provider/requests", navigationFor(userWith(["CLIENT"]), 0))).toBeUndefined();
  });
});

describe("requestHref", () => {
  function request(status: ServiceRequest["status"]): Pick<ServiceRequest, "id" | "status"> {
    return { id: "01930000-0000-7000-8000-00000000000b", status };
  }

  it("resumes a draft in the form, which already picks it up", () => {
    expect(requestHref(request("DRAFT"))).toBe(NAV_HREFS.newRequest);
  });

  it("opens a live request on its matching screen", () => {
    expect(requestHref(request("REQUESTED"))).toBe("/requests/01930000-0000-7000-8000-00000000000b/match");
    expect(requestHref(request("MATCHING"))).toBe("/requests/01930000-0000-7000-8000-00000000000b/match");
  });

  it("offers no link when nothing can be done: a dead link is worse than none", () => {
    expect(requestHref(request("CANCELLED"))).toBeNull();
    expect(requestHref(request("EXPIRED"))).toBeNull();
  });
});

describe("totalUnread", () => {
  it("sums what the API reports, and is zero on an empty inbox", () => {
    expect(totalUnread([{ unreadCount: 2 }, { unreadCount: 0 }, { unreadCount: 5 }])).toBe(7);
    expect(totalUnread([])).toBe(0);
  });
});
