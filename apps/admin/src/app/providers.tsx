"use client";

import { LinkProvider } from "@fixiyi/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Link from "next/link";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {/* @fixiyi/ui layout links navigate client-side through next/link. */}
      <LinkProvider component={Link}>{children}</LinkProvider>
    </QueryClientProvider>
  );
}
