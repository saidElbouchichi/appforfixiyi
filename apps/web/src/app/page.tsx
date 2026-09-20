"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuthStore } from "../lib/auth-store";

export default function HomePage(): null {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    router.replace(user ? "/requests/new" : "/login");
  }, [user, router]);

  return null;
}
