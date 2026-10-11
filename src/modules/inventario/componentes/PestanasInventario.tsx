"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ESTILO_PESTANA = "text-foreground/80 data-[state=active]:font-semibold";

export function PestanasInventario({ seleccion, children }: { seleccion: "materiales" | "movimientos"; children: ReactNode }) {
  const router = useRouter();
  return <Tabs value={seleccion} activationMode="manual" onValueChange={(valor) => router.push(`/inventario?pestana=${valor}`)} className="min-w-0">
    <TabsList aria-label="Consultas de inventario" className="group-data-[orientation=horizontal]/tabs:h-11"><TabsTrigger value="materiales" className={ESTILO_PESTANA}>Materiales</TabsTrigger>
      <TabsTrigger value="movimientos" className={ESTILO_PESTANA}>Movimientos</TabsTrigger></TabsList>
    <TabsContent value={seleccion} className="min-w-0 space-y-5 pt-3">{children}</TabsContent>
  </Tabs>;
}
