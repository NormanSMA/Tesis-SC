"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EncabezadoPanel } from "@/components/panel/EncabezadoPanel";
import { GraficoBarrasEstados } from "@/components/panel/GraficoBarrasEstados";
import { ListaAtencion } from "@/components/panel/ListaAtencion";
import { TarjetaIndicador } from "@/components/panel/TarjetaIndicador";
import { BandejaMetricas } from "@/components/comunes/TarjetaMetrica";
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

export function Panel({ inicial, puedeCrearCotizacion = false }: { inicial: PanelDto; puedeCrearCotizacion?: boolean }) {
  const router = useRouter();
  const { datos, actualizando, error, actualizar } = useDatosPanel(inicial);
  return (
    <section aria-label="Panel" aria-busy={actualizando} className="min-w-0 max-w-full [&_.transition-colors]:transition-[opacity,transform]">
      <EncabezadoPanel {...datos} puedeCrearCotizacion={puedeCrearCotizacion} sinDatos={datos.indicadores.length === 0} actualizando={actualizando} onActualizar={actualizar}
        onCambiarPerfil={(perfil) => router.replace(`/panel?perfil=${encodeURIComponent(perfil)}`, { scroll: false })} />
      {error && <p role="alert" aria-live="assertive" className="mb-4 text-sm text-danger [overflow-wrap:anywhere]">{error}</p>}
      <BandejaMetricas>
        {datos.indicadores.map((indicador, indice) => (
          <div key={indicador.id} className="min-w-0">
            <TarjetaIndicador indicador={indicador} destacada={indice === 0} />
          </div>
        ))}
      </BandejaMetricas>
      {/* Orden de Mise: métricas, lista de lo que pide acción a todo el ancho y el gráfico debajo. */}
      <div className="mt-5 flex min-w-0 flex-col gap-5">
        <ListaAtencion atencion={datos.atencion} atencionTotal={datos.atencionTotal} generadoEn={datos.generadoEn}
          vacio={datos.perfil === "OPERACIONES" ? VACIO_OPERACIONES : undefined} />
        {datos.grafico && <GraficoBarrasEstados grafico={datos.grafico} />}
      </div>
    </section>
  );
}
