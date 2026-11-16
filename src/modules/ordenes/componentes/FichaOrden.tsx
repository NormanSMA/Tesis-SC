"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Propiedades = {
  cliente?: ReactNode; especificaciones: ReactNode; consumo?: ReactNode;
  /** Se omite para el personal de Producción: la trazabilidad no le corresponde. */
  historial?: ReactNode;
  /** Se omite si el actor no puede ver inventario. */
  materiales?: ReactNode;
};

const DISPARADOR = "h-10 flex-none px-4 text-foreground data-[state=active]:font-semibold";

/** Datos secundarios de la ficha en pestañas. */
export function FichaOrden({ cliente, especificaciones, consumo, historial, materiales }: Propiedades) {
  return <Tabs defaultValue="especificaciones" className="min-w-0 gap-4">
    <TabsList tabIndex={0} aria-label="Secciones de la orden" className="w-full justify-start overflow-x-auto group-data-[orientation=horizontal]/tabs:h-auto">
      <TabsTrigger value="especificaciones" className={DISPARADOR}>Especificaciones</TabsTrigger>
      {cliente ? <TabsTrigger value="cliente" className={DISPARADOR}>Cliente y cotización</TabsTrigger> : null}
      {consumo ? <TabsTrigger value="consumo" className={DISPARADOR}>Consumo estimado</TabsTrigger> : null}
      {materiales ? <TabsTrigger value="materiales" className={DISPARADOR}>Materiales consumidos</TabsTrigger> : null}
      {historial ? <TabsTrigger value="historial" className={DISPARADOR}>Historial</TabsTrigger> : null}
    </TabsList>
    <TabsContent value="especificaciones" className="min-w-0 space-y-6">{especificaciones}</TabsContent>
    {cliente ? <TabsContent value="cliente" className="min-w-0">{cliente}</TabsContent> : null}
    {consumo ? <TabsContent value="consumo" className="min-w-0">{consumo}</TabsContent> : null}
    {materiales ? <TabsContent value="materiales" className="min-w-0">{materiales}</TabsContent> : null}
    {historial ? <TabsContent value="historial" className="min-w-0">{historial}</TabsContent> : null}
  </Tabs>;
}
