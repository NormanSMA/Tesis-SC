"use client";

import Link from "next/link";
import { ETIQUETA_ESTADO_ORDEN, etiquetar } from "../etiquetas";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { enfocarError, erroresEsquema } from "@/modules/cotizaciones/useSolicitudCotizacion";
import { esquemaMovimientosOrden, type ResumenOrdenInventario } from "../contrato-orden";
import { pendienteEstimado } from "../reglas";
import { resumirConsumo } from "../resumen-consumo";
import { useResumenOrden } from "../useResumenOrden";
import { useSolicitudInventario } from "../useSolicitudInventario";
import { AvisoSolicitud } from "./AvisoSolicitud";
import { ConfirmarConsumo } from "./ConfirmarConsumo";
import { LineaMovimientoOrden, type LineaFormulario } from "./LineaMovimientoOrden";

type Tipo = "consumo" | "devolucion";
function proponerLineas(resumen: ResumenOrdenInventario, tipo: Tipo): LineaFormulario[] {
  return resumen.materiales.map((fila) => ({ clave: fila.material.id, materialId: fila.material.id,
    codigo: fila.material.codigo, nombre: fila.material.nombre, cantidad: tipo === "consumo" ? pendienteEstimado(fila.estimado, fila.neto) : fila.neto,
    existencia: fila.existencia, unidad: fila.material.unidad })).filter((fila) => !/^0(\.0+)?$/.test(fila.cantidad));
}
function useMovimientosOrden({ resumen, tipo, recargar }: { resumen: ResumenOrdenInventario; tipo: Tipo; recargar: () => void }) {
  const [lineas, setLineas] = useState<LineaFormulario[]>(() => proponerLineas(resumen, tipo));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [pendientes, setPendientes] = useState<LineaFormulario[] | null>(null);
  const confirmado = useRef(false);
  const solicitud = useSolicitudInventario("formulario-movimientos-orden");
  const admite = tipo === "consumo" ? resumen.admiteConsumo : resumen.admiteDevolucion;
  function cambiar(nuevas: LineaFormulario[]) { setLineas(nuevas); setErrores({}); solicitud.cambiarContenido(); }
  async function enviar(filas: LineaFormulario[]) {
    const cuerpo = { lineas: filas.map(({ materialId, cantidad }) => ({ materialId, cantidad })) };
    const guardado = await solicitud.enviar({ url: `/api/v1/ordenes/${resumen.ordenId}/${tipo === "consumo" ? "consumos" : "devoluciones"}`, cuerpo, libro: true });
    if (guardado) recargar();
  }
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (solicitud.enviando || !admite || pendientes) return;
    const cuerpo = { lineas: lineas.map(({ materialId, cantidad }) => ({ materialId, cantidad })) };
    const campos = erroresEsquema(esquemaMovimientosOrden, cuerpo); setErrores(campos);
    if (Object.keys(campos).length) { enfocarError("formulario-movimientos-orden"); return; }
    if (tipo === "consumo") { confirmado.current = false; setPendientes(lineas); return; }
    await enviar(lineas);
  }
  async function confirmar() {
    if (!pendientes || solicitud.enviando) return;
    confirmado.current = true; setPendientes(null);
    await enviar(pendientes);
  }
  function devolverFoco() { document.getElementById(confirmado.current ? "volver-orden" : "registrar-movimiento")?.focus(); }
  return { lineas, errores, pendientes, solicitud, admite, cambiar, guardar, confirmar, devolverFoco,
    cerrar: () => setPendientes(null) };
}
function EditorMovimientos({ resumen, numeroOrden, tipo, recargar }: { resumen: ResumenOrdenInventario; numeroOrden: string; tipo: Tipo; recargar: () => void }) {
  const movimientos = useMovimientosOrden({ resumen, tipo, recargar });
  const { lineas, errores, solicitud, admite, cambiar, guardar } = movimientos;
  return <form id="formulario-movimientos-orden" className="max-w-3xl space-y-5" onSubmit={guardar} noValidate
    aria-label={tipo === "consumo" ? "Registrar consumo" : "Devolver sobrante"}>
    <p>Estado de la orden: {etiquetar(ETIQUETA_ESTADO_ORDEN, resumen.estadoOrden)}</p>
    <AvisoSolicitud {...solicitud} exito={tipo === "devolucion" && solicitud.exito} />
    {tipo === "consumo" && solicitud.exito ? <p role="status">Consumo registrado</p> : null}
    {!admite ? <p role="alert">El estado de la orden no admite esta operación.</p> : null}
    <fieldset className="min-w-0 space-y-5" disabled={solicitud.enviando || !admite}>
      <legend className="sr-only">Líneas de materiales</legend>
      {lineas.map((linea, indice) => <LineaMovimientoOrden key={linea.clave} linea={linea} indice={indice} resumen={resumen}
        errores={{ ...errores, ...solicitud.campos }} quitar={() => cambiar(lineas.filter((fila) => fila.clave !== linea.clave))}
        cambiar={(valores) => cambiar(lineas.map((fila) => fila.clave === linea.clave ? { ...fila, ...valores } : fila))} />)}
      <Button type="button" variant="outline" disabled={lineas.length >= 50} onClick={() => cambiar([...lineas,
        { clave: crypto.randomUUID(), materialId: "", codigo: "", nombre: "", cantidad: "", existencia: "0.000", unidad: "" }])}>Agregar material</Button>
      {errores.lineas ? <p role="alert">{errores.lineas}</p> : null}
    </fieldset>
    <div className="flex flex-wrap gap-3"><Button id="registrar-movimiento" type="submit" disabled={solicitud.enviando || !admite}>{tipo === "consumo" ? "Registrar consumo" : "Devolver sobrante"}</Button>
      <Button asChild variant="outline"><Link id="volver-orden" href={`/ordenes/${resumen.ordenId}`}>Volver a la orden</Link></Button></div>
    {tipo === "consumo" ? <ConfirmarConsumo abierto={movimientos.pendientes !== null} numeroOrden={numeroOrden}
      lineas={resumirConsumo(movimientos.pendientes ?? [])} cerrar={movimientos.cerrar}
      confirmar={movimientos.confirmar} devolverFoco={movimientos.devolverFoco} /> : null}
  </form>;
}
export function FormularioMovimientosOrden({ ordenId, numeroOrden = "", tipo }: { ordenId: string; numeroOrden?: string; tipo: Tipo }) {
  const { resumen, error, recargar } = useResumenOrden(ordenId);
  if (error) return <div role="alert"><p>{error}</p><Button onClick={recargar}>Reintentar</Button></div>;
  if (!resumen) return <p role="status">Cargando materiales de la orden…</p>;
  return <EditorMovimientos key={`${ordenId}:${tipo}`} resumen={resumen} numeroOrden={numeroOrden} tipo={tipo} recargar={recargar} />;
}
