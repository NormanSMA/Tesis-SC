"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CuerpoFormulario, PieFormulario, SeccionFormulario } from "@/components/comunes/SeccionFormulario";
import { Card } from "@/components/ui/card";
import { enfocarError, erroresEsquema } from "@/modules/cotizaciones/useSolicitudCotizacion";
import { permiteCambiarFechaEntrega } from "../reglas";
import { esquemaCrearOrden, esquemaEditarOrden } from "../schema";
import type { OpcionesOrden, OrdenDto, PropuestaOrden } from "../tipos";
import { useSolicitudOrden } from "../useSolicitudOrden";
import { AvisoGuardado } from "./AvisoGuardado";
import { AreasOrden, type EtapasSeleccionadas } from "./AreasOrden";
import { CamposOrden, type ValoresOrden } from "./CamposOrden";

type DatosFormulario = { opciones: OpcionesOrden; hoy: string; soloResponsable?: boolean } &
  ({ orden: OrdenDto; propuesta?: never } | { propuesta: PropuestaOrden; orden?: never });

export function FormularioOrden({ opciones, hoy, orden, propuesta, soloResponsable = false }: DatosFormulario) {
  const [entrada, setEntrada] = useState<ValoresOrden>({ categoriaId: orden?.categoria.id ?? propuesta!.categoriaId,
    responsableId: orden?.responsable?.id ?? "", fechaEntrega: orden?.fechaEntrega ?? hoy,
    especificaciones: orden?.especificaciones ?? propuesta?.especificaciones ?? "" });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [etapas, setEtapas] = useState<EtapasSeleccionadas>([]);
  const solicitud = useSolicitudOrden("formulario-orden");
  const campos = { ...errores, ...solicitud.campos };
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const esquema = orden ? esquemaEditarOrden : esquemaCrearOrden;
    const responsableId = entrada.responsableId || null;
    const cuerpo = orden
      ? { ...(soloResponsable ? {} : entrada), responsableId, version: orden.actualizadoEn }
      : { ...entrada, responsableId, cotizacionId: propuesta!.cotizacionId, etapas };
    const validacion = erroresEsquema(esquema, cuerpo);
    setErrores(validacion);
    if (Object.keys(validacion).length) { enfocarError("formulario-orden"); return; }
    await solicitud.enviar({ url: orden ? `/api/v1/ordenes/${orden.id}` : "/api/v1/ordenes",
      metodo: orden ? "PATCH" : "POST", cuerpo });
  }
  const responsableActual = orden?.responsable;
  const responsables = responsableActual && !opciones.responsables.some((responsable) => responsable.id === responsableActual.id)
    ? [...opciones.responsables, { ...responsableActual, nombre: `${responsableActual.nombre} (responsable actual)` }] : opciones.responsables;
  const campo = <CamposOrden entrada={entrada} opciones={{ ...opciones, responsables }} errores={campos} hoy={hoy} convertir={!orden} soloResponsable={soloResponsable}
    fechaBloqueada={Boolean(orden && !permiteCambiarFechaEntrega(orden.estado))}
    alCambiar={(nombre, valor) => { setErrores({}); setEntrada({ ...entrada, [nombre]: valor }); }} />;
  return <form id="formulario-orden" onSubmit={guardar} noValidate aria-label={orden ? "Editar orden" : "Convertir cotización en orden"}
    className={orden ? "mx-auto w-full max-w-2xl space-y-5" : undefined}>
    {orden ? <>
      <AvisoGuardado {...solicitud} />
      <Card className="min-w-0 px-5"><fieldset disabled={solicitud.enviando} className="min-w-0 space-y-5">{campo}</fieldset></Card>
    </> : <CuerpoFormulario>
      <AvisoGuardado {...solicitud} />
      <SeccionFormulario titulo="Datos de la orden" descripcion="Indique la fecha de entrega y las especificaciones generales.">
        <fieldset disabled={solicitud.enviando} className="min-w-0 space-y-5">{campo}</fieldset>
      </SeccionFormulario>
      <SeccionFormulario titulo="Áreas de producción" descripcion="Seleccione las áreas en el orden en que deben participar y asigne una persona e instrucciones a cada una.">
        <fieldset disabled={solicitud.enviando}>
          <AreasOrden opciones={opciones} etapas={etapas} errores={campos} alCambiar={(nuevas) => { setEtapas(nuevas); setErrores({}); }} />
        </fieldset>
      </SeccionFormulario>
    </CuerpoFormulario>}
    <PieFormulario>
      <Button asChild variant="outline"><Link href={orden ? `/ordenes/${orden.id}` : "/ordenes"}>Cancelar</Link></Button>
      <Button type="submit" disabled={solicitud.enviando}>{orden ? "Guardar cambios" : "Convertir en orden"}</Button>
    </PieFormulario>
  </form>;
}
