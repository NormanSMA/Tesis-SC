"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { aplicarCambioLogo, type CambioLogo } from "./logoCliente";
import { CAMPOS_EDITABLES, esquemaCrearCliente, type EntradaCrearCliente } from "./schema";
import type { ClienteDto } from "./tipos";

export type ValoresFormulario = z.input<typeof esquemaCrearCliente>;
export type FormularioCliente = UseFormReturn<ValoresFormulario, unknown, EntradaCrearCliente>;

export type ModoFormulario = { modo: "crear" } | { modo: "editar"; cliente: ClienteDto };

type CuerpoRespuesta = {
  datos?: ClienteDto;
  error?: { codigo?: string; mensaje?: string; campos?: Record<string, string> };
};

const MENSAJE_RED = "No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.";

// Orden visual del formulario: el foco va al primer campo con error en este orden.
const ORDEN_CAMPOS = ["nombre", "tipo", "ruc", "contactoPrincipal", "telefono", "correo", "direccion", "notas"] as const;

function valoresIniciales(modo: ModoFormulario): ValoresFormulario {
  if (modo.modo === "crear") {
    return { nombre: "", tipo: "EMPRESA", ruc: "", contactoPrincipal: "", telefono: "", correo: "", direccion: "", notas: "" };
  }
  const { cliente } = modo;
  return {
    nombre: cliente.nombre,
    tipo: cliente.tipo,
    ruc: cliente.ruc ?? "",
    contactoPrincipal: cliente.contactoPrincipal ?? "",
    telefono: cliente.telefono ?? "",
    correo: cliente.correo ?? "",
    direccion: cliente.direccion ?? "",
    notas: cliente.notas ?? "",
  };
}

function peticionDe(modo: ModoFormulario, valores: EntradaCrearCliente): { url: string; metodo: string; cuerpo: object } {
  if (modo.modo === "crear") return { url: "/api/v1/clientes", metodo: "POST", cuerpo: valores };
  return {
    url: `/api/v1/clientes/${modo.cliente.id}`,
    metodo: "PATCH",
    cuerpo: { ...valores, version: modo.cliente.actualizadoEn },
  };
}

function enfocarPrimerError(formulario: FormularioCliente, campos: readonly string[]): void {
  const primero = ORDEN_CAMPOS.find((campo) => campos.includes(campo));
  if (primero) formulario.setFocus(primero);
}

function erroresDeCampos(error: NonNullable<CuerpoRespuesta["error"]>): [string, string][] {
  return Object.entries(error.campos ?? {}).filter(([campo]) => (CAMPOS_EDITABLES as readonly string[]).includes(campo));
}

type ResultadoGuardado = { id: string } | { error: NonNullable<CuerpoRespuesta["error"]> };

async function guardarCliente(modo: ModoFormulario, valores: EntradaCrearCliente): Promise<ResultadoGuardado> {
  const { url, metodo, cuerpo } = peticionDe(modo, valores);
  try {
    const respuesta = await fetch(url, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const resultado = (await respuesta.json().catch(() => ({}))) as CuerpoRespuesta;
    if (respuesta.ok && resultado.datos) return { id: resultado.datos.id };
    return { error: resultado.error ?? {} };
  } catch {
    return { error: { mensaje: MENSAJE_RED } };
  }
}

export function useFormularioCliente(modo: ModoFormulario) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [conflicto, setConflicto] = useState(false);
  const [cambioLogo, setCambioLogo] = useState<CambioLogo>(null);
  const formulario: FormularioCliente = useForm<ValoresFormulario, unknown, EntradaCrearCliente>({
    resolver: zodResolver(esquemaCrearCliente),
    defaultValues: valoresIniciales(modo),
    shouldFocusError: false,
  });

  function mostrarErrorServidor(error: NonNullable<CuerpoRespuesta["error"]>): void {
    if (error.codigo === "CONFLICTO_EDICION") {
      setConflicto(true);
      return;
    }
    const campos = erroresDeCampos(error);
    for (const [campo, message] of campos) {
      formulario.setError(campo as keyof ValoresFormulario, { type: "server", message });
    }
    enfocarPrimerError(formulario, campos.map(([campo]) => campo));
    if (campos.length === 0) setErrorGeneral(error.mensaje ?? "No se pudo guardar el cliente. Intente de nuevo.");
  }

  async function enviar(valores: EntradaCrearCliente): Promise<void> {
    if (enviando) return;
    setEnviando(true);
    setErrorGeneral(null);
    setConflicto(false);
    const resultado = await guardarCliente(modo, valores);
    if ("id" in resultado) {
      // El logo se guarda después del cliente: en un alta todavía no existía el id.
      const falloLogo = await aplicarCambioLogo(resultado.id, cambioLogo);
      toast.success(modo.modo === "crear" ? "Cliente creado." : "Cambios guardados.");
      if (falloLogo) toast.error(`El cliente se guardó, pero el logo no: ${falloLogo}`);
      router.push(`/clientes/${resultado.id}`);
      return;
    }
    mostrarErrorServidor(resultado.error);
    setEnviando(false);
  }

  function recargar(): void {
    setConflicto(false);
    router.refresh();
  }

  return {
    formulario, enviando, errorGeneral, conflicto, recargar, cambioLogo, setCambioLogo,
    enviar: formulario.handleSubmit(enviar, (errores) => enfocarPrimerError(formulario, Object.keys(errores))),
  };
}
