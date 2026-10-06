"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { validarCotizacion } from "@/core/costeo";
import { esquemaEditarCotizacion } from "../schema";
import type { CotizacionDto } from "../tipos";
import { enfocarError, erroresEsquema, useSolicitudCotizacion } from "../useSolicitudCotizacion";
import { AvisoGuardado } from "./AvisoGuardado";
import { CampoArea, CampoTexto } from "./CamposEditor";

export function EditorCabecera({ cotizacion }: { cotizacion: CotizacionDto }) {
  const [entrada, setEntrada] = useState({ asunto: cotizacion.asunto ?? "", condiciones: cotizacion.condiciones ?? "",
    descuento: cotizacion.descuento, vigenciaDias: String(cotizacion.vigenciaDias) });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const solicitud = useSolicitudCotizacion("cabecera-cotizacion");
  const campos = { ...errores, ...solicitud.campos };
  const actualizar = (campo: keyof typeof entrada, valor: string) => setEntrada({ ...entrada, [campo]: valor });
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const cuerpo = { ...entrada, vigenciaDias: Number(entrada.vigenciaDias), version: cotizacion.actualizadoEn };
    const validacion = { ...erroresEsquema(esquemaEditarCotizacion, cuerpo),
      ...validarCotizacion({ items: cotizacion.items, descuento: entrada.descuento, tasaImpuesto: cotizacion.tasaImpuesto }) };
    setErrores(validacion);
    if (Object.keys(validacion).length) { enfocarError("cabecera-cotizacion"); return; }
    await solicitud.enviar({ url: `/api/v1/cotizaciones/${cotizacion.id}`, metodo: "PATCH", cuerpo });
  }
  return <form id="cabecera-cotizacion" aria-label="Datos de cotización" onSubmit={guardar} noValidate className="space-y-4">
    <AvisoGuardado {...solicitud} />
    <Card className="px-5"><fieldset disabled={solicitud.enviando} className="space-y-4">
      <legend className="mb-4 text-xl font-semibold">Datos de cotización</legend>
      <CampoTexto id="cabecera-asunto" etiqueta="Asunto" requerido valor={entrada.asunto} error={campos.asunto} alCambiar={(valor) => actualizar("asunto", valor)} />
      <CampoArea id="cabecera-condiciones" etiqueta="Condiciones comerciales" valor={entrada.condiciones} error={campos.condiciones} alCambiar={(valor) => actualizar("condiciones", valor)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto id="cabecera-descuento" etiqueta="Descuento global (C$)" decimal valor={entrada.descuento} error={campos.descuento} alCambiar={(valor) => actualizar("descuento", valor)} />
        <CampoTexto id="cabecera-vigencia" etiqueta="Vigencia (días)" decimal valor={entrada.vigenciaDias} error={campos.vigenciaDias} alCambiar={(valor) => actualizar("vigenciaDias", valor)} />
      </div>
      <p className="text-sm text-muted-foreground">Guarde los ítems antes de aplicar un descuento sobre su nuevo subtotal.</p>
      <Button type="submit" disabled={solicitud.enviando}>Guardar datos</Button>
    </fieldset></Card>
  </form>;
}
