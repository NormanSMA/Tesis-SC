"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { validarCotizacion } from "@/core/costeo";
import { convertirDesdeCordobas } from "@/core/moneda";
import { descuentoParaGuardar, montoDePorcentajeEscrito, porcentajeDeMonto, type ModoDescuento } from "../calculo";
import { esquemaEditarCotizacion } from "../schema";
import { monedaDe } from "../moneda";
import type { CotizacionDto } from "../tipos";
import type { PorcentajesTarifa } from "../tarifas";
import { enfocarError, erroresEsquema, useSolicitudCotizacion } from "../useSolicitudCotizacion";
import { AvisoGuardado } from "./AvisoGuardado";
import { CampoDescuento } from "./CampoDescuento";
import { CampoMostrarCondiciones, CampoTarifa } from "./CamposComerciales";
import { CamposInstalacion, entradaInstalacion } from "./CamposInstalacion";
import { CampoTexto } from "./CamposEditor";

function useCabecera(cotizacion: CotizacionDto, tarifaInstalacion: string) {
  const [entrada, setEntrada] = useState({ asunto: cotizacion.asunto ?? "", condiciones: cotizacion.condiciones ?? "",
    descuento: cotizacion.descuento, descuentoPct: cotizacion.descuentoPct ?? "", vigenciaDias: String(cotizacion.vigenciaDias) });
  const [modo, setModo] = useState<ModoDescuento>(cotizacion.descuentoPct === null ? "MONTO" : "PORCENTAJE");
  const [tarifa, setTarifa] = useState(cotizacion.tarifa);
  const [manual, setManual] = useState(cotizacion.descuentoManual);
  const [mostrarCondiciones, setMostrarCondiciones] = useState(cotizacion.mostrarCondiciones);
  const [instalacion, setInstalacion] = useState({ manoObra: cotizacion.instalacion?.manoObra ?? "",
    fuera: Boolean(cotizacion.instalacion?.km), destino: cotizacion.instalacion?.destino ?? "", km: cotizacion.instalacion?.km ?? "", tarifa: cotizacion.instalacion?.tarifa ?? convertirDesdeCordobas(tarifaInstalacion, cotizacion.tipoCambio, 2), idaVuelta: cotizacion.instalacion?.idaVuelta ?? !cotizacion.instalacion?.km });
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
      tarifa, mostrarCondiciones, descuentoManual: manual, instalacion: entradaInstalacion(instalacion),
      ...(manual ? descuentoParaGuardar(modo, descuento, descuentoPct) : {}) };
    const validacion = { ...erroresEsquema(esquemaEditarCotizacion, cuerpo),
      ...validarCotizacion({ items: cotizacion.items, descuento: !manual ? "0" : modo === "PORCENTAJE" ? montoCalculado ?? "0" : descuento,
        tasaImpuesto: "0" }) };
    if (modo === "PORCENTAJE") delete validacion.descuento;
    setErrores(validacion);
    if (Object.keys(validacion).length) { enfocarError("cabecera-cotizacion"); return; }
    await solicitud.enviar({ url: `/api/v1/cotizaciones/${cotizacion.id}`, metodo: "PATCH", cuerpo });
  }
  return { entrada, actualizar, modo, cambiarModo, montoCalculado, tarifa, setTarifa, manual, setManual,
    mostrarCondiciones, setMostrarCondiciones, solicitud, campos, guardar, instalacion, setInstalacion };
}

export function EditorCabecera({ cotizacion, tarifas, tarifaInstalacion }: {
  cotizacion: CotizacionDto; tarifas: PorcentajesTarifa; tarifaInstalacion: string;
}) {
  const moneda = monedaDe(cotizacion.moneda);
  const { entrada, actualizar, modo, cambiarModo, montoCalculado, tarifa, setTarifa, manual, setManual,
    mostrarCondiciones, setMostrarCondiciones, solicitud, campos, guardar, instalacion, setInstalacion } = useCabecera(cotizacion, tarifaInstalacion);
  return <form id="cabecera-cotizacion" aria-label="Datos de cotización" onSubmit={guardar} noValidate className="space-y-4">
    <AvisoGuardado {...solicitud} />
    <fieldset disabled={solicitud.enviando} className="min-w-0 space-y-4">
      <legend className="sr-only">Datos de cotización</legend>
      <CampoTexto id="cabecera-asunto" etiqueta="Asunto" requerido valor={entrada.asunto} error={campos.asunto} alCambiar={(valor) => actualizar("asunto", valor)} />
      <CampoTarifa tarifa={tarifa} porcentajes={{ ...tarifas, [cotizacion.tarifa]: cotizacion.tarifaPct ?? tarifas[cotizacion.tarifa] }}
        alCambiar={setTarifa} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-primary" checked={manual} onChange={(evento) => setManual(evento.currentTarget.checked)} />
        Aplicar descuento manual en lugar de la tarifa
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {manual ? <CampoDescuento moneda={moneda} modo={modo} monto={entrada.descuento} porcentaje={entrada.descuentoPct}
          montoCalculado={montoCalculado} errorMonto={campos.descuento} errorPorcentaje={campos.descuentoPct ?? campos.descuento}
          alCambiarModo={cambiarModo} alCambiarMonto={(valor) => actualizar("descuento", valor)}
          alCambiarPorcentaje={(valor) => actualizar("descuentoPct", valor)} /> : null}
        <CampoTexto id="cabecera-vigencia" etiqueta="Vigencia (días)" decimal valor={entrada.vigenciaDias} error={campos.vigenciaDias} alCambiar={(valor) => actualizar("vigenciaDias", valor)} />
      </div>
      {manual ? <p className="text-sm text-muted-foreground">{modo === "PORCENTAJE"
        ? "El monto se calcula sobre el subtotal vigente y se recalcula solo al guardar los productos."
        : "Guarde los productos antes de aplicar un descuento sobre su nuevo subtotal."}</p> : null}
      <CampoMostrarCondiciones mostrar={mostrarCondiciones} condiciones={entrada.condiciones} error={campos.condiciones}
        alMostrar={setMostrarCondiciones} alCambiar={(valor) => actualizar("condiciones", valor)} />
      <div className="space-y-3 border-t pt-3">
        <h3 className="font-semibold">Instalación</h3>
        <CamposInstalacion valores={instalacion} alCambiar={setInstalacion} moneda={moneda} errores={campos}
          tarifa={cotizacion.instalacion?.tarifa ?? convertirDesdeCordobas(tarifaInstalacion, cotizacion.tipoCambio, 2)} />
      </div>
      <Button type="submit" disabled={solicitud.enviando} className="max-sm:w-full">Guardar datos</Button>
    </fieldset>
  </form>;
}
