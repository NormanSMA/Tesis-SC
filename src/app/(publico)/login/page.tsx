import type { Metadata } from "next";
import Image from "next/image";

import { FormularioLogin } from "./FormularioLogin";
import { PanelInformativo } from "./PanelInformativo";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function PaginaLogin() {
  return (
    <main id="contenido" tabIndex={-1} className="flex min-h-dvh items-center justify-center bg-background px-4 py-6 sm:px-8 sm:py-10">
      <div className="grid w-full max-w-lg overflow-hidden rounded-[24px] border border-border bg-card shadow-[0_30px_70px_-20px_rgba(15,23,42,0.35),0_8px_24px_-8px_rgba(15,23,42,0.18)] lg:min-h-[640px] lg:max-w-[1120px] lg:grid-cols-2">
        <div className="flex min-w-0 flex-col px-6 py-8 sm:px-12 lg:py-10">
          <Image
            src="/brand/isotipo.png"
            alt="TRACORE"
            width={544}
            height={512}
            priority
            className="h-12 w-auto self-start lg:hidden"
          />
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="w-full max-w-sm">
              <h1 className="text-3xl leading-tight font-semibold tracking-tight text-foreground sm:text-4xl">Iniciar sesión</h1>
              <p className="mt-4 mb-8 text-base text-muted-foreground">
                Ingrese con su cuenta para acceder a TRACORE.
              </p>
              <FormularioLogin />
              <p className="mt-10 border-t border-border pt-4 text-sm text-muted-foreground">
                © {new Date().getFullYear()} TRACORE · Soluciones Creativas
              </p>
            </div>
          </div>
        </div>
        <PanelInformativo />
      </div>
    </main>
  );
}
