"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { validarCotizacion } from "@/core/costeo";
import { descuentoParaGuardar, montoDePorcentajeEscrito, porcentajeDeMonto, type ModoDescuento } from "../calculo";
import { esquemaEditarCotizacion } from "../schema";
import { monedaDe } from "../moneda";
import type { CotizacionDto } from "../tipos";
import { enfocarError, erroresEsquema, useSolicitudCotizacion } from "../useSolicitudCotizacion";
import { AvisoGuardado } from "./AvisoGuardado";
import { CampoDescuento } from "./CampoDescuento";
import { CampoArea, CampoTexto } from "./CamposEditor";

export function EditorCabecera({ cotizacion }: { cotizacion: CotizacionDto }) {
  const moneda = monedaDe(cotizacion.moneda);
  const [entrada, setEntrada] = useState({ asunto: cotizacion.asunto ?? "", condiciones: cotizacion.condiciones ?? "",
    descuento: cotizacion.descuento, descuentoPct: cotizacion.descuentoPct ?? "", vigenciaDias: String(cotizacion.vigenciaDias) });
  const [modo, setModo] = useState<ModoDescuento>(cotizacion.descuentoPct === null ? "MONTO" : "PORCENTAJE");
  const [errores, setErrores] = useState<Record<string, string>>({});
  const solicitud = useSolicitudCotizacion("cabecera-cotizacion");
  const campos = { ...errores, ...solicitud.campos };
  const actualizar = (campo: keyof typeof entrada, valor: string) => setEntrada({ ...entrada, [campo]: valor });
  // Con porcentaje, el monto sale del subtotal vigente; el servidor lo recalcula al guardar los ítems.
  const montoCalculado = modo === "PORCENTAJE" ? montoDePorcentajeEscrito(cotizacion.subtotal, entrada.descuentoPct) : null;
  function cambiarModo(nuevo: string) {
    if (nuevo === modo) return;
    const aPorcentaje = nuevo === "PORCENTAJE";
    setEntrada(aPorcentaje ? { ...entrada, descuentoPct: porcentajeDeMonto(cotizacion.subtotal, entrada.descuento) ?? entrada.descuentoPct }
      : { ...entrada, descuento: montoCalculado ?? entrada.descuento });
    setModo(aPorcentaje ? "PORCENTAJE" : "MONTO"); setErrores({});
  }
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const { descuento, descuentoPct, ...resto } = entrada;
    const cuerpo = { ...resto, vigenciaDias: Number(entrada.vigenciaDias), version: cotizacion.actualizadoEn,
      ...descuentoParaGuardar(modo, descuento, descuentoPct) };
    const validacion = { ...erroresEsquema(esquemaEditarCotizacion, cuerpo),
      ...validarCotizacion({ items: cotizacion.items, descuento: modo === "PORCENTAJE" ? montoCalculado ?? "0" : descuento,
        tasaImpuesto: cotizacion.tasaImpuesto }) };
    if (modo === "PORCENTAJE") delete validacion.descuento;
    setErrores(validacion);
    if (Object.keys(validacion).length) { enfocarError("cabecera-cotizacion"); return; }
    await solicitud.enviar({ url: `/api/v1/cotizaciones/${cotizacion.id}`, metodo: "PATCH", cuerpo });
  }
  return <form id="cabecera-cotizacion" aria-label="Datos de cotización" onSubmit={guardar} noValidate className="space-y-4">
    <AvisoGuardado {...solicitud} />
    <fieldset disabled={solicitud.enviando} className="min-w-0 space-y-4">
      <legend className="sr-only">Datos de cotización</legend>
      <CampoTexto id="cabecera-asunto" etiqueta="Asunto" requerido valor={entrada.asunto} error={campos.asunto} alCambiar={(valor) => actualizar("asunto", valor)} />
      <CampoArea id="cabecera-condiciones" etiqueta="Condiciones comerciales" valor={entrada.condiciones} error={campos.condiciones} alCambiar={(valor) => actualizar("condiciones", valor)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoDescuento moneda={moneda} modo={modo} monto={entrada.descuento} porcentaje={entrada.descuentoPct}
          montoCalculado={montoCalculado} errorMonto={campos.descuento} errorPorcentaje={campos.descuentoPct ?? campos.descuento}
          alCambiarModo={cambiarModo} alCambiarMonto={(valor) => actualizar("descuento", valor)}
          alCambiarPorcentaje={(valor) => actualizar("descuentoPct", valor)} />
        <CampoTexto id="cabecera-vigencia" etiqueta="Vigencia (días)" decimal valor={entrada.vigenciaDias} error={campos.vigenciaDias} alCambiar={(valor) => actualizar("vigenciaDias", valor)} />
      </div>
      <p className="text-sm text-muted-foreground">{modo === "PORCENTAJE"
        ? "El monto se calcula sobre el subtotal vigente y se recalcula solo al guardar los ítems."
        : "Guarde los ítems antes de aplicar un descuento sobre su nuevo subtotal."}</p>
      <Button type="submit" disabled={solicitud.enviando} className="max-sm:w-full">Guardar datos</Button>
    </fieldset>
  </form>;
}
