"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function PestanasInventario({ seleccion, children }: { seleccion: "materiales" | "movimientos"; children: ReactNode }) {
  const router = useRouter();
  return <Tabs value={seleccion} onValueChange={(valor) => router.push(`/inventario?pestana=${valor}`)} className="min-w-0">
    <TabsList aria-label="Consultas de inventario"><TabsTrigger value="materiales">Materiales</TabsTrigger>
      <TabsTrigger value="movimientos">Movimientos</TabsTrigger></TabsList>
    <TabsContent value={seleccion} className="min-w-0 space-y-5 pt-3">{children}</TabsContent>
  </Tabs>;
}
