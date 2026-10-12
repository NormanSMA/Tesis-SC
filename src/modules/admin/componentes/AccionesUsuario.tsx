"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { UsuarioConClave, UsuarioDto } from "@/modules/admin/tipos";

import { AvisoAdmin } from "./AvisoAdmin";
import { ConfirmacionAdmin } from "./ConfirmacionAdmin";
import { peticionAdministracion } from "./peticion";

const ACCIONES = {
  desbloquear: { etiqueta: "Desbloquear", descripcion: "Se limpiarán los intentos fallidos y el bloqueo." },
  desactivar: { etiqueta: "Desactivar", descripcion: "Se revocarán las sesiones. El usuario no podrá iniciar sesión." },
  reactivar: { etiqueta: "Reactivar", descripcion: "El usuario podrá iniciar sesión nuevamente." },
  "reiniciar-clave": { etiqueta: "Reiniciar clave", descripcion: "Se revocarán las sesiones. Copie la nueva clave temporal al confirmar." },
};
type Accion = keyof typeof ACCIONES;
type Propiedades = { usuario: UsuarioDto; alActualizar: (datos: UsuarioDto) => void; alMostrarClave: (clave: string) => void };

export function AccionesUsuario(props: Propiedades) {
  const [accion, setAccion] = useState<Accion | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  async function confirmar() {
    if (!accion || enviando) return;
    setEnviando(true);
    setError("");
    const cuerpo = accion === "reactivar" || accion === "desactivar"
      ? { version: props.usuario.actualizadoEn } : undefined;
    const resultado = await peticionAdministracion<UsuarioDto | UsuarioConClave>(
      `/api/v1/usuarios/${props.usuario.id}/${accion}`, { metodo: "POST", cuerpo },
    );
    if (resultado.error) setError(resultado.error.mensaje);
    else {
      const datos = resultado.datos;
      props.alActualizar("usuario" in datos ? datos.usuario : datos);
      if ("claveTemporal" in datos) props.alMostrarClave(datos.claveTemporal);
    }
    setEnviando(false);
    setAccion(null);
  }
  return (
    <section aria-label="Acciones del usuario" className="space-y-4">
      {error ? <AvisoAdmin mensaje={error} /> : null}
      <div className="flex flex-wrap gap-3">
        <Button className="min-h-10" variant="outline" disabled={enviando} onClick={() => setAccion("desbloquear")}>Desbloquear</Button>
        <Button className="min-h-10" variant="outline" disabled={enviando} onClick={() => setAccion(props.usuario.activo ? "desactivar" : "reactivar")}>
          {props.usuario.activo ? "Desactivar" : "Reactivar"}
        </Button>
        <Button className="min-h-10" variant="outline" disabled={enviando} onClick={() => setAccion("reiniciar-clave")}>Reiniciar clave</Button>
      </div>
      <ConfirmacionAdmin abierto={accion !== null} alCerrar={() => setAccion(null)} alConfirmar={confirmar}
        titulo={`${accion ? ACCIONES[accion].etiqueta : "Confirmar"} usuario`}
        descripcion={`${props.usuario.nombre}. ${accion ? ACCIONES[accion].descripcion : ""} Los cambios sin guardar se perderán.`}
        etiqueta={accion ? ACCIONES[accion].etiqueta : "Confirmar"} enviando={enviando} />
    </section>
  );
}
