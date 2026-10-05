import "@fontsource-variable/inter";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Soluciones Creativas | Plataforma de gestión", template: "%s | Soluciones Creativas" },
  description: "Plataforma de gestión integrada de Soluciones Creativas.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a
          href="#contenido"
          className="sr-only rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
        >
          Saltar al contenido
        </a>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
