"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LISTA_PESTANAS = "h-auto w-full flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto";
const PESTANA = "h-10 min-h-10 flex-none px-4";

export function PestanasInventario({ seleccion, children }: { seleccion: "materiales" | "movimientos"; children: ReactNode }) {
  const router = useRouter();
  return <Tabs value={seleccion} activationMode="manual" onValueChange={(valor) => router.push(`/inventario?pestana=${valor}`)} className="min-w-0">
    <TabsList variant="line" aria-label="Consultas de inventario" className={LISTA_PESTANAS}>
      <TabsTrigger value="materiales" className={PESTANA}>Materiales</TabsTrigger>
      <TabsTrigger value="movimientos" className={PESTANA}>Movimientos</TabsTrigger>
    </TabsList>
    <TabsContent value={seleccion} className="min-w-0 space-y-4 pt-4">{children}</TabsContent>
  </Tabs>;
}
