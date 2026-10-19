"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { PerfilCodigo } from "@/core/permisos";
import type { PermisosPerfilDto } from "@/modules/admin/permisos-dto";

import { AvisoAdmin } from "./AvisoAdmin";
import { ConfirmacionAdmin } from "./ConfirmacionAdmin";
import { diferenciasPermisos, permisoProtegido } from "./interfaz";
import { peticionAdministracion } from "./peticion";
import { TablaPermisos, type MatrizDto } from "./TablaPermisos";

type CambioPerfil = { codigo: PerfilCodigo; nombre: string; altas: string[]; bajas: string[] };

/** Marca o desmarca varios permisos de un perfil; los protegidos no cambian. */
function aplicarGrupo(actual: Record<string, string[]>, { codigo, permisos, marcar }: { codigo: PerfilCodigo; permisos: string[]; marcar: boolean }) {
  const editables = permisos.filter((permiso) => !permisoProtegido(codigo, permiso));
  const vigentes = actual[codigo] ?? [];
  return { ...actual, [codigo]: marcar
    ? [...vigentes, ...editables.filter((permiso) => !vigentes.includes(permiso))]
    : vigentes.filter((permiso) => !editables.includes(permiso)) };
}

function useMatrizPermisos(datos: MatrizDto) {
  const inicial = Object.fromEntries(datos.matriz.map(({ perfil, permisos }) => [perfil, permisos]));
  const [seleccion, setSeleccion] = useState<Record<string, string[]>>(inicial);
  const [guardados, setGuardados] = useState<Record<string, string[]>>(inicial);
  const [versiones, setVersiones] = useState<Record<string, string>>(
    Object.fromEntries(datos.matriz.map(({ perfil, version }) => [perfil, version])),
  );
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [conflicto, setConflicto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const cambios: CambioPerfil[] = datos.perfiles.flatMap((perfil) => {
    const { altas, bajas } = diferenciasPermisos(guardados[perfil.codigo] ?? [], seleccion[perfil.codigo] ?? []);
    return altas.length + bajas.length ? [{ codigo: perfil.codigo, nombre: perfil.nombre, altas, bajas }] : [];
  });
  function cambiar(codigo: PerfilCodigo, permiso: string) {
    if (permisoProtegido(codigo, permiso)) return;
    setSeleccion((actual) => ({ ...actual, [codigo]: (actual[codigo] ?? []).includes(permiso)
      ? actual[codigo].filter((valor) => valor !== permiso) : [...(actual[codigo] ?? []), permiso] }));
  }
  function cambiarGrupo(codigo: PerfilCodigo, permisos: string[], marcar: boolean) { setSeleccion((actual) => aplicarGrupo(actual, { codigo, permisos, marcar })); }
  async function confirmar() {
    if (!cambios.length || enviando) return;
    setEnviando(true);
    setError("");
    setConflicto(false);
    setMensaje("");
    const exitosos: string[] = [];
    for (const { codigo } of cambios) {
      const resultado = await peticionAdministracion<PermisosPerfilDto>(`/api/v1/permisos/${codigo}`, {
        metodo: "PUT", cuerpo: { permisos: seleccion[codigo] ?? [], version: versiones[codigo] },
      });
      if (resultado.error) {
        setError(resultado.error.mensaje);
        setConflicto(resultado.error.codigo === "CONFLICTO_EDICION");
        break;
      }
      setVersiones((actual) => ({ ...actual, [codigo]: resultado.datos.version }));
      setGuardados((actual) => ({ ...actual, [codigo]: resultado.datos.permisos }));
      setSeleccion((actual) => ({ ...actual, [codigo]: resultado.datos.permisos }));
      exitosos.push(codigo);
    }
    if (exitosos.length) setMensaje(`Permisos de ${exitosos.join(", ")} guardados.`);
    setConfirmando(false);
    setEnviando(false);
  }
  return { seleccion, cambios, confirmando, setConfirmando, enviando, error, conflicto, mensaje, cambiar, cambiarGrupo, confirmar };
}

export function MatrizPermisos({ datos }: { datos: MatrizDto }) {
  const matriz = useMatrizPermisos(datos);
  const total = matriz.cambios.reduce((suma, cambio) => suma + cambio.altas.length + cambio.bajas.length, 0);
  return (
    <div className="w-full min-w-0 max-w-full space-y-5 pb-4">
      <p id="permisos-protegidos" className="text-sm text-muted-foreground">
        ADMIN conserva sus permisos de administración (usuarios, permisos y configuración).
      </p>
      {matriz.error ? <AvisoAdmin mensaje={matriz.error}
        alRecargar={matriz.conflicto ? () => window.location.reload() : undefined} /> : null}
      <p role="status">{matriz.mensaje}</p>
      <TablaPermisos datos={datos} seleccion={matriz.seleccion} enviando={matriz.enviando} alCambiar={matriz.cambiar} alCambiarGrupo={matriz.cambiarGrupo} />
      <div className="sticky bottom-0 z-30 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background px-4 py-3 xl:-mx-6 xl:px-6">
        <p role="status" className="text-sm font-medium">{total ? `${total} ${total === 1 ? "cambio" : "cambios"} sin guardar` : "Sin cambios pendientes"}</p>
        <Button type="button" className="min-h-10" disabled={matriz.enviando || !total} onClick={() => matriz.setConfirmando(true)}>Guardar cambios</Button>
      </div>
      <ConfirmacionAdmin abierto={matriz.confirmando} alCerrar={() => matriz.setConfirmando(false)} alConfirmar={matriz.confirmar}
        titulo="Guardar cambios de permisos" descripcion="Los cambios regirán desde la siguiente petición."
        etiqueta="Guardar cambios" enviando={matriz.enviando}>
        {matriz.cambios.map((cambio) => <ResumenPermisos key={cambio.codigo} {...cambio} />)}
      </ConfirmacionAdmin>
    </div>
  );
}

function ResumenPermisos({ nombre, altas, bajas }: CambioPerfil) {
  return (
    <section className="space-y-2 text-sm" aria-label={`Cambios de ${nombre}`}>
      <h3 className="font-semibold">{nombre}</h3>
      <div><h4 className="font-medium">Altas: {altas.length}</h4>{altas.length ? <ul className="list-inside list-disc">{altas.map((permiso) => <li className="break-all" key={permiso}>{permiso}</li>)}</ul> : <p>Sin altas.</p>}</div>
      <div><h4 className="font-medium">Bajas: {bajas.length}</h4>{bajas.length ? <ul className="list-inside list-disc">{bajas.map((permiso) => <li className="break-all" key={permiso}>{permiso}</li>)}</ul> : <p>Sin bajas.</p>}</div>
    </section>
  );
}
