"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { esquemaCrearUsuario, type EntradaCrearUsuario } from "@/modules/admin/schema";
import type { UsuarioConClave, UsuarioDto } from "@/modules/admin/tipos";

import { peticionAdministracion, type ErrorAdministracion } from "./peticion";

type Propiedades = {
  usuario?: UsuarioDto; alGuardar: (resultado: UsuarioConClave | { usuario: UsuarioDto }) => void;
};

export function useFormularioUsuario({ usuario, alGuardar }: Propiedades) {
  const [error, setError] = useState<ErrorAdministracion | null>(null);
  const formulario = useForm<EntradaCrearUsuario>({
    resolver: zodResolver(esquemaCrearUsuario),
    defaultValues: { nombre: usuario?.nombre ?? "", correo: usuario?.correo ?? "", perfiles: usuario?.perfiles ?? [] },
  });
  async function guardar(valores: EntradaCrearUsuario) {
    setError(null);
    const resultado = usuario
      ? await peticionAdministracion<UsuarioDto>(`/api/v1/usuarios/${usuario.id}`, {
        metodo: "PATCH", cuerpo: { ...valores, version: usuario.actualizadoEn },
      })
      : await peticionAdministracion<UsuarioConClave>("/api/v1/usuarios", { metodo: "POST", cuerpo: valores });
    if (resultado.error) {
      setError(resultado.error);
      const campos = Object.entries(resultado.error.campos ?? {});
      for (const [campo, message] of campos) {
        if (["nombre", "correo", "perfiles"].includes(campo)) {
          formulario.setError(campo as keyof EntradaCrearUsuario, { type: "server", message });
        }
      }
      const primero = ["nombre", "correo", "perfiles"].find((campo) => campos.some(([nombre]) => nombre === campo));
      if (primero) formulario.setFocus(primero as keyof EntradaCrearUsuario);
      return;
    }
    if ("usuario" in resultado.datos) alGuardar(resultado.datos);
    else alGuardar({ usuario: resultado.datos });
  }
  return { formulario, error, enviar: formulario.handleSubmit(guardar) };
}
