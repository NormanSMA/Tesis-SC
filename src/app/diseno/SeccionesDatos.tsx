import { ClipboardList, Eye, FileText, PackageX, Truck } from "lucide-react";

import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { ErrorState } from "@/components/comunes/ErrorState";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { EsqueletoFilas } from "@/components/comunes/Esqueletos";
import { BandejaMetricas, TarjetaMetrica } from "@/components/comunes/TarjetaMetrica";
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
      <BandejaMetricas>
        <TarjetaMetrica etiqueta="Cotizaciones enviadas" numero={12} texto="12" formato="entero" icono={FileText} pie="Pendientes de respuesta" />
        <TarjetaMetrica etiqueta="Órdenes en producción" numero={7} texto="7" formato="entero" icono={ClipboardList} pie="Con etapa en curso" />
        <TarjetaMetrica etiqueta="Entregas próximas" numero={3} texto="3" formato="entero" icono={Truck} pie="Siguientes 7 días" />
        <TarjetaMetrica etiqueta="Materiales bajo mínimo" numero={null} texto="" formato="entero" icono={PackageX} pie="Sin datos todavía" />
      </BandejaMetricas>
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
        <EsqueletoFilas cantidad={4} />
      </div>
    </Seccion>
  );
}
