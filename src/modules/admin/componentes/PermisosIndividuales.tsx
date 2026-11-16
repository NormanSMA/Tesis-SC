"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { peticionAdministracion } from "./peticion";

type Usuario = { id: string; nombre: string; perfiles: string[]; heredados: string[]; adicionales: string[]; version: string };
type Permiso = { permiso: string; descripcion: string | null };

export function PermisosIndividuales({ usuarios, catalogo }: { usuarios: Usuario[]; catalogo: Permiso[] }) {
  const [id, setId] = useState("");
  const [vigentes, setVigentes] = useState(usuarios);
  const usuario = vigentes.find(u => u.id === id);
  return <section className="space-y-4 rounded-lg border p-4" aria-label="Permisos por usuario">
    <h2 className="text-xl font-semibold">Permisos por usuario</h2>
    <p>Agregue funciones a una persona además de las que recibe de sus perfiles.</p>
    <label className="block">Usuario
      <select className="mt-2 block w-full rounded-md border bg-background p-3" value={id} onChange={e => setId(e.target.value)}>
        <option value="">Seleccione un usuario</option>
        {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre} · {u.perfiles.join(", ")}</option>)}
      </select>
    </label>
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
