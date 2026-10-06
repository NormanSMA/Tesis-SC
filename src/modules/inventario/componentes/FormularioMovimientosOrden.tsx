"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { enfocarError, erroresEsquema } from "@/modules/cotizaciones/useSolicitudCotizacion";
import { esquemaMovimientosOrden, type ResumenOrdenInventario } from "../contrato-orden";
import { pendienteEstimado } from "../reglas";
import { useResumenOrden } from "../useResumenOrden";
import { useSolicitudInventario } from "../useSolicitudInventario";
import { AvisoSolicitud } from "./AvisoSolicitud";
import { LineaMovimientoOrden, type LineaFormulario } from "./LineaMovimientoOrden";

type Tipo = "consumo" | "devolucion";
function proponerLineas(resumen: ResumenOrdenInventario, tipo: Tipo): LineaFormulario[] {
  return resumen.materiales.map((fila) => ({ clave: fila.material.id, materialId: fila.material.id,
    nombre: fila.material.nombre, cantidad: tipo === "consumo" ? pendienteEstimado(fila.estimado, fila.neto) : fila.neto,
    existencia: fila.existencia, unidad: fila.material.unidad })).filter((fila) => !/^0(\.0+)?$/.test(fila.cantidad));
}
function EditorMovimientos({ resumen, tipo, recargar }: { resumen: ResumenOrdenInventario; tipo: Tipo; recargar: () => void }) {
  const [lineas, setLineas] = useState<LineaFormulario[]>(() => proponerLineas(resumen, tipo));
  const [errores, setErrores] = useState<Record<string, string>>({});
  const solicitud = useSolicitudInventario("formulario-movimientos-orden");
  const admite = tipo === "consumo" ? resumen.admiteConsumo : resumen.admiteDevolucion;
  function cambiar(nuevas: LineaFormulario[]) { setLineas(nuevas); setErrores({}); solicitud.cambiarContenido(); }
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const cuerpo = { lineas: lineas.map(({ materialId, cantidad }) => ({ materialId, cantidad })) };
    const campos = erroresEsquema(esquemaMovimientosOrden, cuerpo); setErrores(campos);
    if (Object.keys(campos).length) { enfocarError("formulario-movimientos-orden"); return; }
    const guardado = await solicitud.enviar({ url: `/api/v1/ordenes/${resumen.ordenId}/${tipo === "consumo" ? "consumos" : "devoluciones"}`, cuerpo, libro: true });
    if (guardado) recargar();
  }
  return <form id="formulario-movimientos-orden" className="max-w-3xl space-y-5" onSubmit={guardar} noValidate
    aria-label={tipo === "consumo" ? "Registrar consumo" : "Devolver sobrante"}>
    <p>Estado de la orden: {resumen.estadoOrden}</p><AvisoSolicitud {...solicitud} />
    {!admite ? <p role="alert">El estado de la orden no admite esta operación.</p> : null}
    <fieldset className="min-w-0 space-y-5" disabled={solicitud.enviando || !admite}>
      <legend className="sr-only">Líneas de materiales</legend>
      {lineas.map((linea, indice) => <LineaMovimientoOrden key={linea.clave} linea={linea} indice={indice} resumen={resumen}
        errores={{ ...errores, ...solicitud.campos }} quitar={() => cambiar(lineas.filter((fila) => fila.clave !== linea.clave))}
        cambiar={(valores) => cambiar(lineas.map((fila) => fila.clave === linea.clave ? { ...fila, ...valores } : fila))} />)}
      <Button type="button" variant="outline" disabled={lineas.length >= 50} onClick={() => cambiar([...lineas,
        { clave: crypto.randomUUID(), materialId: "", nombre: "", cantidad: "", existencia: "0.000", unidad: "" }])}>Agregar material</Button>
      {errores.lineas ? <p role="alert">{errores.lineas}</p> : null}
    </fieldset>
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={solicitud.enviando || !admite}>{tipo === "consumo" ? "Registrar consumo" : "Devolver sobrante"}</Button>
      <Button asChild variant="outline"><Link href={`/ordenes/${resumen.ordenId}`}>Volver a la orden</Link></Button></div>
  </form>;
}
export function FormularioMovimientosOrden({ ordenId, tipo }: { ordenId: string; tipo: Tipo }) {
  const { resumen, error, recargar } = useResumenOrden(ordenId);
  if (error) return <div role="alert"><p>{error}</p><Button onClick={recargar}>Reintentar</Button></div>;
  if (!resumen) return <p role="status">Cargando materiales de la orden…</p>;
  return <EditorMovimientos key={`${ordenId}:${tipo}`} resumen={resumen} tipo={tipo} recargar={recargar} />;
}
