"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EncabezadoPanel } from "@/components/panel/EncabezadoPanel";
import { GraficoBarras } from "@/components/panel/GraficoBarras";
import { ListaAtencion } from "@/components/panel/ListaAtencion";
import { TarjetaIndicador } from "@/components/panel/TarjetaIndicador";
import { formatearFechaHora } from "@/lib/formato";
import type { PanelDto } from "@/modules/panel/tipos";

const VACIO_OPERACIONES = { texto: "Todas las órdenes activas están al día.", enlace: "Ver órdenes", destino: "/ordenes" };

type RespuestaPanel = { datos?: PanelDto; error?: { mensaje?: string } };

function useDatosPanel(inicial: PanelDto) {
  const [datos, setDatos] = useState(inicial);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const solicitud = useRef<AbortController | null>(null);
  useEffect(() => () => solicitud.current?.abort(), []);

  async function actualizar() {
    if (solicitud.current) return;
    const controlador = new AbortController();
    solicitud.current = controlador;
    setActualizando(true);
    setError(null);
    try {
      const respuesta = await fetch(`/api/v1/panel?perfil=${encodeURIComponent(datos.perfil)}`, {
        cache: "no-store", signal: controlador.signal,
      });
      const contenido: RespuestaPanel = await respuesta.json();
      if (controlador.signal.aborted) return;
      if (!respuesta.ok) {
        setError(contenido.error?.mensaje ?? "No se pudo actualizar el panel.");
        return;
      }
      if (!contenido.datos) throw new Error("Respuesta sin datos.");
      setDatos(contenido.datos);
    } catch {
      if (!controlador.signal.aborted) setError("No se pudo actualizar el panel. Intente nuevamente.");
    } finally {
      solicitud.current = null;
      if (!controlador.signal.aborted) setActualizando(false);
    }
  }

  return { datos, actualizando, error, actualizar };
}

export function Panel({ inicial }: { inicial: PanelDto }) {
  const router = useRouter();
  const { datos, actualizando, error, actualizar } = useDatosPanel(inicial);
  return (
    <section aria-label="Panel" aria-busy={actualizando} className="min-w-0 max-w-full">
      <EncabezadoPanel {...datos} onCambiarPerfil={(perfil) => router.replace(`/panel?perfil=${encodeURIComponent(perfil)}`, { scroll: false })} />
      <div className="mb-6 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <p role="status" aria-atomic="true" className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          Actualizado: <time dateTime={datos.generadoEn}>{formatearFechaHora(datos.generadoEn)}</time>
        </p>
        <button
          type="button"
          onClick={actualizar}
          aria-disabled={actualizando}
          className="min-h-10 rounded-lg border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-disabled:cursor-wait aria-disabled:opacity-60"
        >
          Actualizar
        </button>
      </div>
      {error && <p role="alert" aria-live="assertive" className="mb-4 text-sm text-danger [overflow-wrap:anywhere]">{error}</p>}
      <div className="entrada-escalonada grid min-w-0 grid-cols-1 gap-4 min-[761px]:grid-cols-2 min-[1101px]:grid-cols-12">
        {datos.indicadores.map((indicador) => (
          <div key={indicador.id} className="flex min-w-0 min-[1101px]:col-span-3 [&>*]:flex-1">
            <TarjetaIndicador indicador={indicador} />
          </div>
        ))}
        {datos.grafico && (
          <div className="min-w-0 min-[1101px]:col-span-8">
            <GraficoBarras grafico={datos.grafico} />
          </div>
        )}
        <div className={`min-w-0 ${datos.grafico ? "min-[1101px]:col-span-4" : "min-[761px]:col-span-2 min-[1101px]:col-span-12"}`}>
          <ListaAtencion atencion={datos.atencion} vacio={datos.perfil === "OPERACIONES" ? VACIO_OPERACIONES : undefined} />
        </div>
      </div>
    </section>
  );
}
