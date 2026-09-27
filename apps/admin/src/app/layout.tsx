import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppChrome } from "./app-chrome";
import { fontVariableClasses } from "./fonts";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  // Every segment names its page (lib/segment-layout.tsx); this covers the redirecting root.
  title: "Fixiyi Admin",
  description: "Fixiyi Admin — socle technique (Phase 1, Foundation)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={fontVariableClasses}>
      <body>
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
