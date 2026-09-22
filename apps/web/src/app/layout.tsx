import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppChrome } from "./app-chrome";
import { fontVariableClasses } from "./fonts";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Fixiyi",
  description: "Fixiyi — trouvez un professionnel de confiance pres de chez vous",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={fontVariableClasses}>
      <body>
        <Providers>
          <AppChrome legal={`© ${new Date().getFullYear().toString()} Fixiyi`}>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
