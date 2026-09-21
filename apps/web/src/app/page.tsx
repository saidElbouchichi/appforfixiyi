"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuthStore } from "../lib/auth-store";
import { startRouteFor } from "../lib/start-route";

export default function HomePage(): null {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    router.replace(startRouteFor(user));
  }, [user, router]);

  return null;
}
