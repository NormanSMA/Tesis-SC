import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { env } from "@/env";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Marca } from "@/components/layout/Marca";

import { SeccionFormularios } from "./SeccionFormularios";
import { SeccionInteractiva } from "./SeccionInteractiva";
import { SeccionBadges, SeccionBotones, SeccionTipografia, SeccionTokens } from "./SeccionesBase";
import { SeccionEstadosVista, SeccionTabla, SeccionTarjetas, SeccionTimeline } from "./SeccionesDatos";

export const metadata: Metadata = { title: "Galería de diseño" };

export default function PaginaDiseno() {
  if (env.NODE_ENV === "production") notFound();
  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center border-b bg-card px-4 xl:px-6">
        <Marca />
      </header>
      <main id="contenido" tabIndex={-1} className="mx-auto max-w-6xl space-y-12 px-4 py-8 outline-none xl:px-6">
        <PageHeader
          titulo="Galería de diseño"
          descripcion="Sistema de componentes de la plataforma. Disponible solo en desarrollo."
        />
        <SeccionTokens />
        <SeccionTipografia />
        <SeccionBotones />
        <SeccionFormularios />
        <SeccionBadges />
        <SeccionTabla />
        <SeccionTarjetas />
        <SeccionTimeline />
        <SeccionEstadosVista />
        <SeccionInteractiva />
      </main>
    </div>
  );
}
