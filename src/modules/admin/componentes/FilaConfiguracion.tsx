"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
      evento.currentTarget.querySelector<HTMLTextAreaElement | HTMLInputElement>("[name=valor]")?.focus();
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
  const propiedades = {
    id, name: "valor", value: valor, onChange: (evento: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValor(evento.target.value),
    readOnly: parametro.clave === "zona_horaria", disabled: fila.enviando || fila.conflicto,
    "aria-invalid": Boolean(error), "aria-describedby": `${id}-descripcion${error ? ` ${id}-error` : ""}`,
  };
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <Label htmlFor={id}>{ETIQUETAS[parametro.clave] ?? parametro.clave}</Label>
      {parametro.tipo === "TEXTO" && parametro.clave !== "zona_horaria"
        ? <Textarea {...propiedades} className="min-h-20" />
        : <Input {...propiedades} className="min-h-10" inputMode={parametro.tipo === "DECIMAL" ? "decimal" : parametro.tipo === "ENTERO" ? "numeric" : "text"} />}
      <p id={`${id}-descripcion`} className="text-sm text-muted-foreground">{parametro.descripcion}</p>
      {error ? <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function FilaConfiguracion({ inicial }: { inicial: ParametroDto }) {
  const fila = useParametro(inicial);
  const hidratado = useHidratado();
  const soloLectura = inicial.clave === "zona_horaria";
  return (
    <Card className="min-w-0 p-5">
      <form onSubmit={fila.guardar} noValidate aria-label={`Parámetro ${ETIQUETAS[inicial.clave] ?? inicial.clave}`} className="space-y-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div className="min-w-0 basis-full"><dt className="text-muted-foreground">Valor actual</dt><dd className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{fila.parametro.valor || "Sin valor"}</dd></div>
          <div><dt className="text-muted-foreground">Tipo</dt><dd>{fila.parametro.tipo}</dd></div>
          <div><dt className="text-muted-foreground">Última edición</dt><dd>{fechaAdministracion(fila.parametro.actualizadoEn)}</dd></div>
        </dl>
        <fieldset disabled={!hidratado} className="min-w-0 space-y-4">
        <legend className="sr-only">Editar parámetro</legend>
        <CampoParametro fila={fila} />
        {fila.conflicto ? <AvisoAdmin mensaje="Otra persona modificó este parámetro." alRecargar={fila.recargar} /> : null}
        {soloLectura ? <p className="text-sm text-muted-foreground">La zona horaria es de solo lectura.</p>
          : <Button type="submit" className="min-h-10" disabled={fila.enviando || fila.conflicto}>{fila.enviando ? "Guardando…" : "Guardar"}</Button>}
        </fieldset>
        <p role="status" className="text-sm">{fila.mensaje}</p>
      </form>
    </Card>
  );
}
