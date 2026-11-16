"use client";

import { useState } from "react";

import { AvatarIniciales } from "@/components/comunes/AvatarIniciales";
import { CabeceraFicha } from "@/components/comunes/CabeceraFicha";
import { ListaDatos, TarjetaSeccion } from "@/components/comunes/TarjetaSeccion";
import { Badge } from "@/components/ui/badge";
import { ETIQUETA_PERFIL } from "@/core/permisos";
import type { UsuarioDto } from "@/modules/admin/tipos";

import { AccionesUsuario } from "./AccionesUsuario";
import { AvisoAdmin } from "./AvisoAdmin";
import { ClaveTemporal } from "./ClaveTemporal";
import { FormularioUsuario } from "./FormularioUsuario";
import { EstadoUsuarioBadge } from "./ListaUsuarios";
import { estadoUsuario, fechaAdministracion } from "./interfaz";
import { peticionAdministracion } from "./peticion";
import estilos from "./ResponsividadUsuarios.module.css";

// Nombre, correo y perfiles ya están en la cabecera y en el formulario: aquí solo los datos de acceso.
function DatosAcceso({ usuario, ahora }: { usuario: UsuarioDto; ahora: number }) {
  return <ListaDatos columnas={2} className={estilos.acceso} datos={[
    { etiqueta: "Estado", valor: <EstadoUsuarioBadge estado={estadoUsuario(usuario, ahora)} /> },
    { etiqueta: "Intentos fallidos", valor: usuario.intentosFallidos },
    { etiqueta: "Último acceso", valor: fechaAdministracion(usuario.ultimoAcceso) },
    { etiqueta: "Última edición", valor: fechaAdministracion(usuario.actualizadoEn) },
    { etiqueta: "Bloqueado hasta", valor: fechaAdministracion(usuario.bloqueadoHasta) },
  ]} />;
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
    <div className={`min-w-0 ${estilos.ficha}`}>
      <CabeceraFicha titulo={usuario.nombre} volver={{ href: "/admin/usuarios", etiqueta: "Usuarios" }}
        marca={<AvatarIniciales nombre={usuario.nombre} className="size-12 text-sm" />}
        meta={<>
          <span className="break-all">{usuario.correo}</span>
          {usuario.perfiles.map((perfil) => <Badge key={perfil} variant="neutro" className="whitespace-normal">{ETIQUETA_PERFIL[perfil]}</Badge>)}
        </>} />
      <p role="status" className="sr-only">{mensaje}</p>
      {mensaje ? <p aria-hidden="true" className="mb-4 text-sm text-success">{mensaje}</p> : null}
      {error ? <AvisoAdmin mensaje={error} /> : null}
      <div className={estilos.distribucion}>
        <div className="min-w-0">
          <FormularioUsuario key={usuario.actualizadoEn} usuario={usuario} alGuardar={(datos) => actualizar(datos.usuario)} alRecargar={recargar} />
        </div>
        <TarjetaSeccion titulo="Acceso" descripcion="Bloqueos, estado de la cuenta y clave.">
          <div className="space-y-5">
            <DatosAcceso usuario={usuario} ahora={ahora} />
            <AccionesUsuario usuario={usuario} alActualizar={actualizar} alMostrarClave={setClave} />
            {clave ? <ClaveTemporal key={clave} clave={clave} alCerrar={() => setClave(null)} /> : null}
          </div>
        </TarjetaSeccion>
      </div>
    </div>
  );
}
