import { ClipboardList, Construction, FileText, PackageX, Truck } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/comunes/EmptyState";
import { KpiCard } from "@/components/comunes/KpiCard";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exigirPermisoPagina } from "@/lib/auth/guardia";

export const metadata: Metadata = { title: "Panel" };

export default async function PaginaPanel() {
  await exigirPermisoPagina("panel:ver");
  return (
    <>
      <PageHeader titulo="Panel" descripcion="Resumen de la operación de Soluciones Creativas." />
      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard etiqueta="Cotizaciones enviadas" icono={FileText} ayuda="Pendientes de respuesta" />
        <KpiCard etiqueta="Órdenes en producción" icono={ClipboardList} ayuda="Con etapa en curso" />
        <KpiCard etiqueta="Entregas próximas" icono={Truck} ayuda="Siguientes 7 días" />
        <KpiCard etiqueta="Materiales bajo mínimo" icono={PackageX} ayuda="Requieren reposición" />
      </section>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState icono={Construction} titulo="Módulo en construcción" descripcion="El resumen de actividad se habilita con los módulos." />
        </CardContent>
      </Card>
    </>
  );
}
