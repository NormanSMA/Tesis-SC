"use client";

import Link from "next/link";
import { useState } from "react";

import { CuerpoFormulario, PieFormulario, SeccionFormulario } from "@/components/comunes/SeccionFormulario";
import { TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { Button } from "@/components/ui/button";
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
    <form onSubmit={enviar} noValidate className="min-w-0" aria-label={props.usuario ? "Editar usuario" : "Nuevo usuario"}>
      {error ? <AvisoAdmin mensaje={error.mensaje} alRecargar={conflicto ? props.alRecargar : undefined} /> : null}
      <fieldset disabled={!hidratado || enviando || conflicto} className="min-w-0">
        <legend className="sr-only">Datos del usuario</legend>
        {props.usuario ? <TarjetaSeccion titulo="Editar usuario" descripcion="Nombre, correo y perfiles de la cuenta.">
          <div className="space-y-5">
            <CamposUsuario formulario={formulario} />
            <PerfilesUsuario formulario={formulario} />
            <div className="flex justify-end border-t border-slate-100 pt-4 max-sm:[&>*]:flex-1">
              <Button className="min-h-10" type="submit">{enviando ? "Guardando…" : "Guardar cambios"}</Button>
            </div>
          </div>
        </TarjetaSeccion> : <>
          <CuerpoFormulario>
            <SeccionFormulario titulo="Datos de la cuenta" descripcion="El correo es el usuario para ingresar.">
              <CamposUsuario formulario={formulario} />
            </SeccionFormulario>
            <SeccionFormulario titulo="Perfiles" descripcion="Definen qué secciones ve y qué acciones puede realizar.">
              <PerfilesUsuario formulario={formulario} />
            </SeccionFormulario>
          </CuerpoFormulario>
          <PieFormulario>
            <Button className="min-h-10" asChild variant="outline"><Link href="/admin/usuarios">Volver a usuarios</Link></Button>
            <Button className="min-h-10" type="submit">{enviando ? "Guardando…" : "Crear usuario"}</Button>
          </PieFormulario>
        </>}
      </fieldset>
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
    <div className="mx-auto max-w-2xl space-y-5">
      <p role="status" className="text-sm font-medium text-success">Usuario creado: {usuario.nombre}.</p>
      {clave ? <ClaveTemporal clave={clave} alCerrar={() => setClave(null)} /> : null}
      <Button className="min-h-10" asChild><Link href={`/admin/usuarios/${usuario.id}`}>Ver usuario</Link></Button>
    </div>
  );
}
