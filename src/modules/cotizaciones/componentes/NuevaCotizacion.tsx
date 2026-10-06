"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { esquemaCrearCotizacion } from "../schema";
import { enfocarError, erroresEsquema, useSolicitudCotizacion } from "../useSolicitudCotizacion";
import { AvisoGuardado } from "./AvisoGuardado";
import { CampoArea, CampoSeleccion, CampoTexto } from "./CamposEditor";

export function NuevaCotizacion({ clientes, condiciones }: { clientes: { id: string; nombre: string }[]; condiciones: string }) {
  const [entrada, setEntrada] = useState({ clienteId: "", asunto: "", condiciones });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const solicitud = useSolicitudCotizacion("nueva-cotizacion");
  const campos = { ...errores, ...solicitud.campos };
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const validacion = erroresEsquema(esquemaCrearCotizacion, entrada);
    setErrores(validacion);
    if (Object.keys(validacion).length) { enfocarError("nueva-cotizacion"); return; }
    await solicitud.enviar({ url: "/api/v1/cotizaciones", metodo: "POST", cuerpo: entrada, destino: "editar" });
  }
  return <form id="nueva-cotizacion" onSubmit={guardar} noValidate aria-label="Nueva cotización" className="max-w-3xl space-y-5">
    <AvisoGuardado {...solicitud} />
    <Card className="px-5"><fieldset disabled={solicitud.enviando} className="space-y-5">
      <CampoSeleccion id="clienteId" etiqueta="Cliente" valor={entrada.clienteId} opciones={clientes} requerido error={campos.clienteId}
        alCambiar={(clienteId) => setEntrada({ ...entrada, clienteId })} />
      <CampoTexto id="asunto" etiqueta="Asunto" valor={entrada.asunto} requerido error={campos.asunto}
        alCambiar={(asunto) => setEntrada({ ...entrada, asunto })} />
      <CampoArea id="condiciones" etiqueta="Condiciones comerciales" valor={entrada.condiciones} error={campos.condiciones}
        alCambiar={(texto) => setEntrada({ ...entrada, condiciones: texto })} />
    </fieldset></Card>
    <div className="flex gap-3"><Button type="submit" disabled={solicitud.enviando || !clientes.length}>Crear cotización</Button>
      <Button asChild variant="outline"><Link href="/cotizaciones">Cancelar</Link></Button></div>
    {!clientes.length ? <p role="status">Registre un cliente activo para crear una cotización.</p> : null}
  </form>;
}
