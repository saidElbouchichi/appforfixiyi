import type { Metadata } from "next";
import type { ReactNode } from "react";

import { fontVariableClasses } from "./fonts";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Fixiyi Admin",
  description: "Fixiyi Admin — socle technique (Phase 1, Foundation)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={fontVariableClasses}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
