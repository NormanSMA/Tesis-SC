"use client";

import { useId, useState } from "react";
import { SelectorBuscable } from "@/components/comunes/SelectorBuscable";
import { Button } from "@/components/ui/button";
import { peticionAdministracion } from "./peticion";

type Usuario = { id: string; nombre: string; correo: string; perfiles: string[]; heredados: string[]; adicionales: string[]; version: string };
type Permiso = { permiso: string; descripcion: string | null };

export function PermisosIndividuales({ usuarios, catalogo }: { usuarios: Usuario[]; catalogo: Permiso[] }) {
  const [id, setId] = useState("");
  const [vigentes, setVigentes] = useState(usuarios);
  const idSelector = useId();
  const usuario = vigentes.find(u => u.id === id);
  const opciones = usuarios.map(u => ({ id: u.id, nombre: u.nombre, detalle: u.correo }));
  if (usuario) opciones.unshift({ id: "", nombre: "Quitar selección", detalle: "" });
  return <section className="space-y-4 rounded-lg border p-4" aria-label="Permisos por usuario">
    <h2 className="text-xl font-semibold">Permisos por usuario</h2>
    <p>Agregue funciones a una persona además de las que recibe de sus perfiles.</p>
    <div className="max-w-xl space-y-2">
      <label htmlFor={idSelector} className="block text-sm font-medium">Usuario</label>
      <SelectorBuscable id={idSelector} valor={id} opciones={opciones} alCambiar={setId}
        marcador="Buscar por nombre o correo" vacio="Seleccione un usuario" className="h-11" />
      {usuario ? <div className="text-sm text-muted-foreground">
        <p className="wrap-anywhere">{usuario.correo}</p>
        <p>{usuario.perfiles.join(" · ")}</p>
      </div> : null}
    </div>
    {usuario ? <Editor key={id} usuario={usuario} catalogo={catalogo}
      alGuardar={datos => setVigentes(actuales => actuales.map(u => u.id === id ? { ...u, ...datos } : u))} /> : null}
  </section>;
}

function Editor({ usuario, catalogo, alGuardar }: { usuario: Usuario; catalogo: Permiso[];
  alGuardar: (datos: { adicionales: string[]; version: string }) => void }) {
  const [seleccion, setSeleccion] = useState(usuario.adicionales);
  const [version, setVersion] = useState(usuario.version);
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function guardar() {
    setEnviando(true);
    const respuesta = await peticionAdministracion<{ adicionales: string[]; version: string }>(`/api/v1/permisos/usuarios/${usuario.id}`,
      { metodo: "PUT", cuerpo: { permisos: seleccion, version } });
    setEnviando(false);
    if (respuesta.error) { setMensaje(respuesta.error.mensaje); return; }
    alGuardar(respuesta.datos);
    setVersion(respuesta.datos.version);
    setMensaje("Permisos adicionales guardados.");
  }
  return <div className="space-y-4">
    <fieldset disabled={enviando} className="grid gap-3 md:grid-cols-2">
      <legend className="mb-3 font-medium">Funciones de {usuario.nombre}</legend>
      {catalogo.map(p => <label key={p.permiso} className="flex items-start gap-2">
        <input type="checkbox" className="mt-1" disabled={usuario.heredados.includes(p.permiso)}
          checked={usuario.heredados.includes(p.permiso) || seleccion.includes(p.permiso)}
          onChange={e => setSeleccion(actual => e.target.checked ? [...actual, p.permiso] : actual.filter(c => c !== p.permiso))} />
        <span>{p.descripcion || p.permiso}{usuario.heredados.includes(p.permiso) ? " (por perfil)" : ""}</span>
      </label>)}
    </fieldset>
    <p role="status">{mensaje}</p>
    <Button disabled={enviando} onClick={guardar}>Guardar permisos del usuario</Button>
  </div>;
}
