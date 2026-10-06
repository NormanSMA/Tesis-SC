import type { Metadata } from "next";

import { Marca } from "@/components/layout/Marca";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

import { FormularioLogin } from "./FormularioLogin";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function PaginaLogin() {
  return (
    <main id="contenido" tabIndex={-1} className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10 outline-none">
      <Marca grande />
      <Card className="w-full max-w-md gap-6 py-8">
        <CardHeader className="px-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Iniciar sesión</h1>
          <CardDescription className="text-sm">
            Ingrese con su cuenta para acceder a la plataforma de gestión.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8">
          <FormularioLogin />
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Soluciones Creativas, Estelí</p>
    </main>
  );
}
