import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Soluciones Creativas | Plataforma de Gestión",
  description: "Plataforma de gestión integrada",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
