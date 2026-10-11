"use client";

import { useState } from "react";

import type { PerfilCodigo } from "@/core/permisos";
import type { PermisosPerfilDto } from "@/modules/admin/permisos-dto";

import { AvisoAdmin } from "./AvisoAdmin";
import { ConfirmacionAdmin } from "./ConfirmacionAdmin";
import { diferenciasPermisos, permisoProtegido } from "./interfaz";
import { peticionAdministracion } from "./peticion";
import { TablaPermisos, type MatrizDto } from "./TablaPermisos";

function useMatrizPermisos(datos: MatrizDto) {
  const inicial = Object.fromEntries(datos.matriz.map(({ perfil, permisos }) => [perfil, permisos]));
  const [seleccion, setSeleccion] = useState<Record<string, string[]>>(inicial);
  const [guardados, setGuardados] = useState<Record<string, string[]>>(inicial);
  const [perfil, setPerfil] = useState<PerfilCodigo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  function cambiar(codigo: PerfilCodigo, permiso: string) {
    if (permisoProtegido(codigo, permiso)) return;
    setSeleccion((actual) => ({ ...actual, [codigo]: (actual[codigo] ?? []).includes(permiso)
      ? actual[codigo].filter((valor) => valor !== permiso) : [...(actual[codigo] ?? []), permiso] }));
  }
  async function confirmar() {
    if (!perfil || enviando) return;
    setEnviando(true);
    setError("");
    setMensaje("");
    const resultado = await peticionAdministracion<PermisosPerfilDto>(`/api/v1/permisos/${perfil}`, {
      metodo: "PUT", cuerpo: { permisos: seleccion[perfil] ?? [] },
    });
    if (resultado.error) setError(resultado.error.mensaje);
    else {
      setGuardados((actual) => ({ ...actual, [perfil]: resultado.datos.permisos }));
      setSeleccion((actual) => ({ ...actual, [perfil]: resultado.datos.permisos }));
      setMensaje(`Permisos de ${perfil} guardados.`);
    }
    setPerfil(null);
    setEnviando(false);
  }
  return { seleccion, guardados, perfil, setPerfil, enviando, error, mensaje, cambiar, confirmar };
}

export function MatrizPermisos({ datos }: { datos: MatrizDto }) {
  const matriz = useMatrizPermisos(datos);
  const diferencias = matriz.perfil ? diferenciasPermisos(matriz.guardados[matriz.perfil] ?? [], matriz.seleccion[matriz.perfil] ?? []) : { altas: [], bajas: [] };
  return (
    <div className="w-full min-w-0 max-w-full space-y-5">
      <p id="permisos-protegidos" className="text-sm text-muted-foreground">
        ADMIN conserva usuario:gestionar, permiso:gestionar y configuracion:gestionar. Estos permisos están protegidos.
      </p>
      <p className="text-sm text-muted-foreground">Desplace la matriz horizontalmente para consultar todos los perfiles.</p>
      {matriz.error ? <AvisoAdmin mensaje={matriz.error} /> : null}
      <p role="status">{matriz.mensaje}</p>
      <TablaPermisos datos={datos} seleccion={matriz.seleccion} guardados={matriz.guardados} enviando={matriz.enviando}
        alCambiar={matriz.cambiar} alGuardar={matriz.setPerfil} />
      <ConfirmacionAdmin abierto={matriz.perfil !== null} alCerrar={() => matriz.setPerfil(null)} alConfirmar={matriz.confirmar}
        titulo={`Guardar permisos de ${matriz.perfil ?? "perfil"}`} descripcion="Los cambios regirán desde la siguiente petición."
        etiqueta="Guardar cambios" enviando={matriz.enviando}>
        <ResumenPermisos altas={diferencias.altas} bajas={diferencias.bajas} />
      </ConfirmacionAdmin>
    </div>
  );
}

function ResumenPermisos({ altas, bajas }: { altas: string[]; bajas: string[] }) {
  return (
    <div className="space-y-3 text-sm">
      <div><h3 className="font-semibold">Altas: {altas.length}</h3>{altas.length ? <ul className="list-inside list-disc">{altas.map((permiso) => <li className="break-all" key={permiso}>{permiso}</li>)}</ul> : <p>Sin altas.</p>}</div>
      <div><h3 className="font-semibold">Bajas: {bajas.length}</h3>{bajas.length ? <ul className="list-inside list-disc">{bajas.map((permiso) => <li className="break-all" key={permiso}>{permiso}</li>)}</ul> : <p>Sin bajas.</p>}</div>
    </div>
  );
}
