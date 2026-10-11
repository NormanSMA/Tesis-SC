"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Propiedades = {
  cliente: ReactNode; especificaciones: ReactNode; consumo: ReactNode; historial: ReactNode;
  /** Se omite si el actor no puede ver inventario. */
  materiales?: ReactNode;
};

const DISPARADOR = "h-10 flex-none px-4 text-foreground data-[state=active]:font-semibold";

/** Datos secundarios de la ficha en pestañas. */
export function FichaOrden({ cliente, especificaciones, consumo, historial, materiales }: Propiedades) {
  return <Tabs defaultValue="especificaciones" className="min-w-0 gap-4">
    <TabsList aria-label="Secciones de la orden" className="h-auto w-full flex-wrap justify-start">
      <TabsTrigger value="especificaciones" className={DISPARADOR}>Especificaciones</TabsTrigger>
      <TabsTrigger value="cliente" className={DISPARADOR}>Cliente y cotización</TabsTrigger>
      <TabsTrigger value="consumo" className={DISPARADOR}>Consumo estimado</TabsTrigger>
      {materiales ? <TabsTrigger value="materiales" className={DISPARADOR}>Materiales consumidos</TabsTrigger> : null}
      <TabsTrigger value="historial" className={DISPARADOR}>Historial</TabsTrigger>
    </TabsList>
    <TabsContent value="especificaciones" className="min-w-0 space-y-6">{especificaciones}</TabsContent>
    <TabsContent value="cliente" className="min-w-0">{cliente}</TabsContent>
    <TabsContent value="consumo" className="min-w-0">{consumo}</TabsContent>
    {materiales ? <TabsContent value="materiales" className="min-w-0">{materiales}</TabsContent> : null}
    <TabsContent value="historial" className="min-w-0">{historial}</TabsContent>
  </Tabs>;
}
