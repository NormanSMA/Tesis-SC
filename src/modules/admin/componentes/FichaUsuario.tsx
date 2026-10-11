"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ETIQUETA_PERFIL } from "@/core/permisos";
import type { UsuarioDto } from "@/modules/admin/tipos";

import { AccionesUsuario } from "./AccionesUsuario";
import { AvisoAdmin } from "./AvisoAdmin";
import { ClaveTemporal } from "./ClaveTemporal";
import { FormularioUsuario } from "./FormularioUsuario";
import { estadoUsuario, fechaAdministracion } from "./interfaz";
import { peticionAdministracion } from "./peticion";

function DatosUsuario({ usuario, ahora }: { usuario: UsuarioDto; ahora: number }) {
  return (
    <Card className="p-5">
      <h2 className="font-semibold">Datos del usuario</h2>
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Nombre</dt><dd className="break-words">{usuario.nombre}</dd></div>
        <div><dt className="text-muted-foreground">Correo</dt><dd className="break-all">{usuario.correo}</dd></div>
        <div><dt className="text-muted-foreground">Estado</dt><dd>{estadoUsuario(usuario, ahora)}</dd></div>
        <div><dt className="text-muted-foreground">Perfiles</dt><dd className="flex flex-wrap gap-2">{usuario.perfiles.map((perfil) => <Badge key={perfil} variant="neutro" className="whitespace-normal">{ETIQUETA_PERFIL[perfil]}</Badge>)}</dd></div>
        <div><dt className="text-muted-foreground">Último acceso</dt><dd>{fechaAdministracion(usuario.ultimoAcceso)}</dd></div>
        <div><dt className="text-muted-foreground">Última edición</dt><dd>{fechaAdministracion(usuario.actualizadoEn)}</dd></div>
        <div><dt className="text-muted-foreground">Bloqueado hasta</dt><dd>{fechaAdministracion(usuario.bloqueadoHasta)}</dd></div>
        <div><dt className="text-muted-foreground">Intentos fallidos</dt><dd>{usuario.intentosFallidos}</dd></div>
      </dl>
    </Card>
  );
}

export function FichaUsuario({ inicial, ahora }: { inicial: UsuarioDto; ahora: number }) {
  const [usuario, setUsuario] = useState(inicial);
  const [clave, setClave] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  async function recargar() {
    const resultado = await peticionAdministracion<UsuarioDto>(`/api/v1/usuarios/${usuario.id}`, { metodo: "GET" });
    if (resultado.error) setError(resultado.error.mensaje);
    else { setUsuario(resultado.datos); setError(""); setMensaje("Datos recargados."); }
  }
  function actualizar(datos: UsuarioDto) {
    setUsuario(datos);
    setMensaje("Cambios guardados.");
  }
  return (
    <div className="max-w-3xl space-y-5">
      <DatosUsuario usuario={usuario} ahora={ahora} />
      <AccionesUsuario usuario={usuario} alActualizar={actualizar} alMostrarClave={setClave} />
      {clave ? <ClaveTemporal key={clave} clave={clave} alCerrar={() => setClave(null)} /> : null}
      <p role="status">{mensaje}</p>
      {error ? <AvisoAdmin mensaje={error} /> : null}
      <h2 className="text-lg font-semibold">Editar usuario</h2>
      <FormularioUsuario key={usuario.actualizadoEn} usuario={usuario} alGuardar={(datos) => actualizar(datos.usuario)} alRecargar={recargar} />
    </div>
  );
}
