import { ClipboardList, Eye, FileText, PackageX, Truck } from "lucide-react";

import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { ErrorState } from "@/components/comunes/ErrorState";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { KpiCard } from "@/components/comunes/KpiCard";
import { LoadingState } from "@/components/comunes/LoadingState";
import { Timeline } from "@/components/comunes/Timeline";
import { Fecha, Money } from "@/components/comunes/ValorFormateado";
import { Button } from "@/components/ui/button";

import { COTIZACIONES, EVENTOS_BITACORA, type FilaCotizacion } from "./datos";
import { Seccion } from "./Seccion";

const COLUMNAS: ColumnaTabla<FilaCotizacion>[] = [
  { id: "numero", encabezado: "Número", principal: true, celda: (fila) => <span className="font-medium">{fila.numero}</span> },
  { id: "cliente", encabezado: "Cliente", celda: (fila) => fila.cliente },
  { id: "emision", encabezado: "Emisión", celda: (fila) => <Fecha valor={fila.emision} /> },
  { id: "vence", encabezado: "Vence", celda: (fila) => <Fecha valor={fila.vence} /> },
  { id: "estado", encabezado: "Estado", celda: (fila) => <EstadoBadge tipo="cotizacion" estado={fila.estado} /> },
  { id: "total", encabezado: "Total", alinear: "derecha", celda: (fila) => <Money valor={fila.total} /> },
];

export function SeccionTabla() {
  return (
    <Seccion id="tabla" titulo="Tabla de datos" descripcion="Encabezado fijo, primera columna fija, desplazamiento horizontal y paginación.">
      <DataTable
        titulo="Cotizaciones de ejemplo"
        columnas={COLUMNAS}
        filas={COTIZACIONES}
        idFila={(fila) => fila.id}
        acciones={(fila) => (
          <Button variant="ghost" size="icon-sm" aria-label={`Ver ${fila.numero}`}>
            <Eye aria-hidden="true" />
          </Button>
        )}
        paginacion={{ pagina: 2, total: 48, tamano: 5, hrefPagina: (pagina) => `/diseno?pagina=${pagina}` }}
      />
    </Seccion>
  );
}

export function SeccionTarjetas() {
  return (
    <Seccion id="tarjetas" titulo="Indicadores" descripcion="Valor con guion cuando aún no hay dato.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard etiqueta="Cotizaciones enviadas" valor={12} icono={FileText} ayuda="Pendientes de respuesta" />
        <KpiCard etiqueta="Órdenes en producción" valor={7} icono={ClipboardList} ayuda="Con etapa en curso" />
        <KpiCard etiqueta="Entregas próximas" valor={3} icono={Truck} ayuda="Siguientes 7 días" />
        <KpiCard etiqueta="Materiales bajo mínimo" icono={PackageX} ayuda="Sin datos todavía" />
      </div>
    </Seccion>
  );
}

export function SeccionTimeline() {
  return (
    <Seccion id="timeline" titulo="Línea de tiempo" descripcion="Bitácora: fecha, actor, acción y detalle. Hora de Managua.">
      <div className="rounded-lg border bg-card p-5">
        <Timeline titulo="Bitácora de ejemplo" eventos={EVENTOS_BITACORA} />
      </div>
    </Seccion>
  );
}

export function SeccionEstadosVista() {
  return (
    <Seccion id="estados-vista" titulo="Vacío, error y carga">
      <div className="grid gap-4 lg:grid-cols-3">
        <EmptyState
          titulo="Aún no hay clientes"
          descripcion="Registre el primer cliente para empezar a cotizar."
          accion={<Button size="sm">Nuevo cliente</Button>}
        />
        <ErrorState
          accion={
            <Button variant="outline" size="sm">
              Reintentar
            </Button>
          }
        />
        <LoadingState filas={4} />
      </div>
    </Seccion>
  );
}
