import { AppShell, Footer, Header, Logo } from "@fixiyi/ui";
import type { Metadata } from "next";
import type { ReactNode } from "react";

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
          <AppShell
            header={<Header brand={<Logo />} />}
            footer={
              <Footer
                brand={<Logo />}
                tagline="Plus qu'une application, une solution de confiance."
                legal={`© ${new Date().getFullYear().toString()} Fixiyi`}
              />
            }
          >
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
