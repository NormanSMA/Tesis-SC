"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { listarConfiguracion } from "@/modules/admin/configuracion-service";
import { useHidratado } from "@/modules/clientes/useHidratado";

import { AvisoAdmin } from "./AvisoAdmin";
import { esquemaValorConfiguracion, fechaAdministracion } from "./interfaz";
import { peticionAdministracion } from "./peticion";

export type ParametroDto = Awaited<ReturnType<typeof listarConfiguracion>>[number];

function useParametro(inicial: ParametroDto) {
  const [parametro, setParametro] = useState(inicial);
  const [valor, setValor] = useState(inicial.valor);
  const [error, setError] = useState("");
  const [conflicto, setConflicto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando || conflicto || parametro.clave === "zona_horaria") return;
    setError("");
    setMensaje("");
    const resultado = esquemaValorConfiguracion(parametro).safeParse(valor);
    if (!resultado.success) {
      setError(resultado.error.issues[0].message);
      evento.currentTarget.querySelector<HTMLInputElement>("[name=valor]")?.focus();
      return;
    }
    setEnviando(true);
    const respuesta = await peticionAdministracion<ParametroDto>("/api/v1/configuracion", {
      metodo: "PATCH", cuerpo: { clave: parametro.clave, valor: resultado.data, version: parametro.actualizadoEn },
    });
    if (respuesta.error) {
      setError(respuesta.error.campos?.valor ?? respuesta.error.mensaje);
      setConflicto(respuesta.error.codigo === "CONFLICTO_EDICION");
    } else {
      setParametro(respuesta.datos); setValor(respuesta.datos.valor); setMensaje("Cambios guardados.");
    }
    setEnviando(false);
  }
  async function recargar() {
    const respuesta = await peticionAdministracion<ParametroDto[]>("/api/v1/configuracion", { metodo: "GET" });
    const actual = respuesta.datos?.find(({ clave }) => clave === parametro.clave);
    if (actual) {
      setParametro(actual); setValor(actual.valor); setConflicto(false); setError(""); setMensaje("Datos recargados.");
    } else setError(respuesta.error?.mensaje ?? "El parámetro no existe.");
  }
  return { parametro, valor, setValor, error, conflicto, enviando, mensaje, guardar, recargar };
}

const ETIQUETAS: Record<string, string> = {
  iva_porcentaje: "IVA (%)", cotizacion_vigencia_dias: "Vigencia de cotización (días)",
  cotizacion_condiciones: "Condiciones de cotización", moneda: "Moneda",
  empresa_nombre: "Nombre de empresa", zona_horaria: "Zona horaria",
};

function CampoParametro({ fila }: { fila: ReturnType<typeof useParametro> }) {
  const { parametro, valor, setValor, error } = fila;
  const id = `config-${parametro.clave}`;
  const soloLectura = parametro.clave === "zona_horaria";
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id} className="sr-only">{ETIQUETAS[parametro.clave] ?? parametro.clave}</Label>
      <Input id={id} name="valor" value={valor} onChange={(evento: ChangeEvent<HTMLInputElement>) => setValor(evento.target.value)}
        readOnly={soloLectura} disabled={fila.enviando || fila.conflicto} aria-invalid={Boolean(error)}
        aria-describedby={`${id}-descripcion${error ? ` ${id}-error` : ""}`}
        className={cn("min-h-10 w-full", soloLectura && "cursor-not-allowed bg-muted text-muted-foreground")}
        inputMode={parametro.tipo === "DECIMAL" ? "decimal" : parametro.tipo === "ENTERO" ? "numeric" : "text"} />
      {error ? <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function FilaConfiguracion({ inicial }: { inicial: ParametroDto }) {
  const fila = useParametro(inicial);
  const hidratado = useHidratado();
  const soloLectura = inicial.clave === "zona_horaria";
  const nombre = ETIQUETAS[inicial.clave] ?? inicial.clave;
  const id = `config-${inicial.clave}`;
  return (
    <Card className="min-w-0 p-4">
      <form onSubmit={fila.guardar} noValidate aria-label={`Parámetro ${nombre}`} className="space-y-2">
        <fieldset disabled={!hidratado} className="grid min-w-0 items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)_6rem]">
          <legend className="sr-only">Editar parámetro</legend>
          <div className="min-w-0">
            <p className="font-medium">{nombre}</p>
            <p id={`${id}-descripcion`} className="text-sm text-muted-foreground">{fila.parametro.descripcion}</p>
            <p className="text-xs text-muted-foreground">Última edición: {fechaAdministracion(fila.parametro.actualizadoEn)}</p>
          </div>
          <CampoParametro fila={fila} />
          {soloLectura ? <p className="text-sm text-muted-foreground md:col-span-3">La zona horaria es de solo lectura.</p>
            : <Button type="submit" className="min-h-10" disabled={fila.enviando || fila.conflicto}>{fila.enviando ? "Guardando…" : "Guardar"}</Button>}
        </fieldset>
        {fila.conflicto ? <AvisoAdmin mensaje="Otra persona modificó este parámetro." alRecargar={fila.recargar} /> : null}
        <p role="status" className="text-sm">{fila.mensaje}</p>
      </form>
    </Card>
  );
}
