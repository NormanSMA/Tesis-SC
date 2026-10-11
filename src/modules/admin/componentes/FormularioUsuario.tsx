"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { UsuarioConClave, UsuarioDto } from "@/modules/admin/tipos";
import { useHidratado } from "@/modules/clientes/useHidratado";

import { AvisoAdmin } from "./AvisoAdmin";
import { CamposUsuario, PerfilesUsuario } from "./CamposUsuario";
import { ClaveTemporal } from "./ClaveTemporal";
import { useFormularioUsuario } from "./useFormularioUsuario";

type Propiedades = {
  usuario?: UsuarioDto; alGuardar: (resultado: UsuarioConClave | { usuario: UsuarioDto }) => void; alRecargar?: () => void;
};

export function FormularioUsuario(props: Propiedades) {
  const { formulario, error, enviar } = useFormularioUsuario(props);
  const hidratado = useHidratado();
  const enviando = formulario.formState.isSubmitting;
  const conflicto = error?.codigo === "CONFLICTO_EDICION";
  return (
    <form onSubmit={enviar} noValidate className="max-w-3xl space-y-5" aria-label={props.usuario ? "Editar usuario" : "Nuevo usuario"}>
      {error ? <AvisoAdmin mensaje={error.mensaje} alRecargar={conflicto ? props.alRecargar : undefined} /> : null}
      <Card className="p-5">
        <fieldset disabled={!hidratado || enviando || conflicto} className="min-w-0 space-y-5">
          <legend className="sr-only">Datos del usuario</legend>
          <CamposUsuario formulario={formulario} />
          <PerfilesUsuario formulario={formulario} />
          <div className="flex flex-wrap gap-3">
            <Button className="min-h-10" type="submit">{enviando ? "Guardando…" : props.usuario ? "Guardar cambios" : "Crear usuario"}</Button>
            <Button className="min-h-10" asChild variant="outline"><Link href="/admin/usuarios">Volver a usuarios</Link></Button>
          </div>
        </fieldset>
      </Card>
    </form>
  );
}

export function NuevoUsuario() {
  const [usuario, setUsuario] = useState<UsuarioDto | null>(null);
  const [clave, setClave] = useState<string | null>(null);
  function creado(datos: UsuarioConClave | { usuario: UsuarioDto }) {
    if ("claveTemporal" in datos) {
      setUsuario(datos.usuario);
      setClave(datos.claveTemporal);
    }
  }
  if (!usuario) return <FormularioUsuario alGuardar={creado} />;
  return (
    <div className="max-w-3xl space-y-5">
      <p role="status">Usuario creado: {usuario.nombre}.</p>
      {clave ? <ClaveTemporal clave={clave} alCerrar={() => setClave(null)} /> : null}
      <Button className="min-h-10" asChild><Link href={`/admin/usuarios/${usuario.id}`}>Ver usuario</Link></Button>
    </div>
  );
}
