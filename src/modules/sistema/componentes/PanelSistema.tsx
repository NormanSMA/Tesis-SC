import { Activity, Gauge, MemoryStick, OctagonAlert } from "lucide-react";

import { PageHeader } from "@/components/comunes/PageHeader";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { EmptyState } from "@/components/comunes/EmptyState";
import { BandejaMetricas, TarjetaMetrica } from "@/components/comunes/TarjetaMetrica";
import { ListaDatos, TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { Badge } from "@/components/ui/badge";
import { formatearDecimal, formatearFechaHora } from "@/lib/formato";
import type { RutaLenta } from "@/lib/metricas";

import { ETIQUETA_ESTADO, UMBRAL_5XX, UMBRAL_P95_MS, type EstadoGeneral } from "../reglas";
import type { EstadoSistemaDto } from "../service";
import { BotonActualizar } from "./BotonActualizar";

type ErrorReciente = EstadoSistemaDto["erroresRecientes"][number];

const MB = 1024 * 1024;
const TONO_ESTADO = { OPERATIVO: "exito", CON_ALERTAS: "advertencia", CAIDO: "peligro" } as const;
const SIN_BORDE = "rounded-none border-0 shadow-none";

const enMb = (bytes: number) => Math.round(bytes / MB);
const pct = (tasa: number) => `${formatearDecimal(tasa * 100, 1)} %`;

function formatearBytes(bytes: number): string {
  return bytes >= 1024 * MB ? `${formatearDecimal(bytes / (1024 * MB), 2)} GB` : `${formatearDecimal(bytes / MB, 1)} MB`;
}

function formatearActivo(segundos: number): string {
  const dias = Math.floor(segundos / 86_400);
  const horas = Math.floor((segundos % 86_400) / 3_600);
  const minutos = Math.floor((segundos % 3_600) / 60);
  if (dias) return `${dias} d ${horas} h ${minutos} min`;
  return horas ? `${horas} h ${minutos} min` : `${minutos} min ${segundos % 60} s`;
}

/** Misma caja que TarjetaMetrica, para un valor de texto (TarjetaMetrica solo muestra números). */
function TarjetaEstado({ estado }: { estado: EstadoGeneral }) {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Activity aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0 flex-1 text-[15px] leading-snug font-medium text-slate-800">Estado general</span>
      </div>
      <div className="flex flex-1 items-center px-4 py-4">
        <Badge variant={TONO_ESTADO[estado]} className="h-8 px-3 text-base">{ETIQUETA_ESTADO[estado]}</Badge>
      </div>
    </div>
  );
}

const columnasErrores: ColumnaTabla<ErrorReciente>[] = [
  { id: "hora", encabezado: "Hora", celda: (e) => formatearFechaHora(e.hora) },
  { id: "codigo", encabezado: "Código", celda: (e) => e.codigo },
  { id: "ruta", encabezado: "Ruta", celda: (e) => e.ruta },
  { id: "mensaje", encabezado: "Mensaje", celda: (e) => e.mensaje },
  { id: "peticion", encabezado: "Petición", celda: (e) => e.peticionId || "—" },
];

const columnasRutas: ColumnaTabla<RutaLenta>[] = [
  { id: "ruta", encabezado: "Ruta", celda: (r) => `${r.metodo} ${r.ruta}` },
  { id: "peticiones", encabezado: "Peticiones", alinear: "derecha", celda: (r) => formatearDecimal(r.peticiones, 0) },
  { id: "p95", encabezado: "p95 (ms)", alinear: "derecha", celda: (r) => formatearDecimal(r.p95Ms, 1) },
  { id: "promedio", encabezado: "Promedio (ms)", alinear: "derecha", celda: (r) => formatearDecimal(r.promedioMs, 1) },
];

function Vacio({ titulo }: { titulo: string }) {
  return <EmptyState titulo={titulo} className="border-0 py-8" />;
}

function SeccionesDatos({ datos }: { datos: EstadoSistemaDto }) {
  const { rendimiento: r, baseDatos: bd, proceso, accesos24h } = datos;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <TarjetaSeccion titulo="Base de datos">
        <ListaDatos columnas={2} datos={[
          { etiqueta: "Estado", valor: bd.disponible ? "Responde" : "No responde" },
          { etiqueta: "Latencia (SELECT 1)", valor: bd.latenciaMs === null ? null : `${formatearDecimal(bd.latenciaMs, 1)} ms` },
          { etiqueta: "Tamaño", valor: bd.tamanoBytes === null ? null : formatearBytes(bd.tamanoBytes) },
          { etiqueta: "Conexiones", valor: bd.conexiones === null ? null : formatearDecimal(bd.conexiones, 0) },
        ]} />
      </TarjetaSeccion>
      <TarjetaSeccion titulo="Servidor">
        <ListaDatos columnas={2} datos={[
          { etiqueta: "Versión", valor: proceso.version },
          { etiqueta: "Tiempo activo", valor: formatearActivo(proceso.activoSegundos) },
          { etiqueta: "Node", valor: proceso.node },
          { etiqueta: "Peticiones por minuto", valor: formatearDecimal(r.peticionesPorMinuto, 0) },
        ]} />
      </TarjetaSeccion>
      <TarjetaSeccion titulo="Accesos" descripcion="Últimas 24 horas, según la bitácora.">
        <ListaDatos columnas={2} datos={[
          { etiqueta: "Inicios de sesión fallidos", valor: formatearDecimal(accesos24h.iniciosFallidos, 0) },
          { etiqueta: "Usuarios bloqueados", valor: formatearDecimal(accesos24h.usuariosBloqueados, 0) },
        ]} />
      </TarjetaSeccion>
    </div>
  );
}

function TablasSistema({ datos }: { datos: EstadoSistemaDto }) {
  return (
    <>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TarjetaSeccion titulo="Errores recientes" descripcion="Los 20 más nuevos de hasta 100 guardados." sinRelleno>
          <DataTable titulo="Errores recientes" columnas={columnasErrores} filas={datos.erroresRecientes.slice(0, 20)}
            idFila={(e) => `${e.hora}-${e.peticionId}-${e.codigo}`} apilarEnMovil className={SIN_BORDE}
            vacio={<Vacio titulo="Sin errores registrados" />} />
        </TarjetaSeccion>
        <TarjetaSeccion titulo="Rutas más lentas" descripcion="Las 5 con mayor p95 entre las últimas 500 peticiones." sinRelleno>
          <DataTable titulo="Rutas más lentas" columnas={columnasRutas} filas={datos.rendimiento.rutasLentas}
            idFila={(x) => `${x.metodo} ${x.ruta}`} apilarEnMovil className={SIN_BORDE}
            vacio={<Vacio titulo="Sin peticiones medidas" />} />
        </TarjetaSeccion>
      </div>
    </>
  );
}

export function PanelSistema({ datos }: { datos: EstadoSistemaDto }) {
  const { rendimiento: r, proceso } = datos;
  const errores5xx = Math.round(r.tasa5xx * r.peticiones);
  return (
    <div className="min-w-0">
      {/* La barra superior ya nombra la sección y el reloj da la hora: aquí solo desde cuándo hay datos. */}
      <PageHeader titulo="Estado del sistema" tituloVisible={false}
        descripcion={`Datos desde el último reinicio, ${formatearFechaHora(r.desde)}. Se guardan en memoria, sin cuerpos, cookies ni consultas.`}
        acciones={<BotonActualizar />} />
      {datos.alertas.length ? (
        <ul role="status" className="mb-4 space-y-1 rounded-xl border border-warning-soft-border bg-warning-soft px-4 py-3 text-sm text-warning">
          {datos.alertas.map((alerta) => (
            <li key={alerta} className="flex items-center gap-2"><OctagonAlert aria-hidden="true" className="size-4 shrink-0" />{alerta}</li>
          ))}
        </ul>
      ) : null}
      <BandejaMetricas className="mb-6">
        <TarjetaEstado estado={datos.estado} />
        <TarjetaMetrica etiqueta="Respuesta p95 (ms)" icono={Gauge} numero={r.p95Ms === null ? null : Math.round(r.p95Ms)}
          texto={r.p95Ms === null ? "Sin datos" : `${formatearDecimal(r.p95Ms, 1)} ms`} formato="entero"
          alerta={r.p95Ms !== null && r.p95Ms > UMBRAL_P95_MS}
          pie={r.p95Ms === null ? "Aún sin peticiones" : `p50 ${formatearDecimal(r.p50Ms ?? 0, 1)} ms. Umbral ${UMBRAL_P95_MS} ms`} />
        <TarjetaMetrica etiqueta="Errores 5xx" icono={OctagonAlert} numero={errores5xx} texto={`${errores5xx} errores`} formato="entero"
          alerta={r.tasa5xx > UMBRAL_5XX} pie={`${pct(r.tasa5xx)} de ${r.peticiones} peticiones. 4xx: ${pct(r.tasa4xx)}`} />
        <TarjetaMetrica etiqueta="Memoria RSS (MB)" icono={MemoryStick} numero={enMb(proceso.memoriaRssBytes)}
          texto={`${enMb(proceso.memoriaRssBytes)} MB`} formato="entero"
          pie={`Heap ${enMb(proceso.heapUsadoBytes)} de ${enMb(proceso.heapTotalBytes)} MB`} />
      </BandejaMetricas>
      <SeccionesDatos datos={datos} />
      <TablasSistema datos={datos} />
    </div>
  );
}
