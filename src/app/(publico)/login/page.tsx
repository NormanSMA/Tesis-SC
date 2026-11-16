import type { Metadata } from "next";
import Image from "next/image";
import { AlternarTema } from "@/components/layout/AlternarTema";

import { FormularioLogin } from "./FormularioLogin";

export const metadata: Metadata = { title: "Iniciar sesión" };

function PresentacionMarca() {
  return <div className="relative flex min-h-56 flex-col justify-between overflow-hidden bg-brand-indigo p-7 text-white sm:p-10 lg:min-h-[34rem]">
    <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-24 size-80 rotate-45 rounded-[3rem] border-[2rem] border-brand-gold/25" />
    <div className="relative w-fit rounded-xl bg-white p-3 sm:p-4">
      <Image src="/brand/soluciones-creativas.png" alt="Soluciones Creativas" width={375} height={213} priority
        className="h-auto w-32 sm:w-40" />
    </div>
    <div className="relative mt-10 max-w-xs">
      <p className="text-xs font-semibold tracking-[0.18em] text-brand-gold">PLATAFORMA INTERNA</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">TRACORE</p>
      <p className="mt-3 text-sm text-white/80">Cotizaciones, órdenes de trabajo e inventario de Soluciones Creativas.</p>
    </div>
  </div>;
}

export default function PaginaLogin() {
  return <main id="contenido" tabIndex={-1} className="grid min-h-dvh place-items-center bg-background p-4 sm:p-8">
    <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[2fr_3fr]">
      <PresentacionMarca />
      <section aria-labelledby="titulo-acceso" className="relative flex items-center justify-center px-6 py-14 sm:px-12 lg:px-16">
        <div className="absolute top-4 right-4"><AlternarTema /></div>
        <div className="w-full max-w-sm">
          <h1 id="titulo-acceso" className="text-3xl font-semibold tracking-tight text-foreground">Iniciar sesión</h1>
          <p className="mt-2 mb-7 text-sm text-muted-foreground">Ingrese con su cuenta para acceder a TRACORE.</p>
          <FormularioLogin />
          <p className="mt-8 border-t pt-4 text-xs text-muted-foreground">© {new Date().getFullYear()} Soluciones Creativas</p>
        </div>
      </section>
    </div>
  </main>;
}
