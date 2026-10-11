import { Download, Loader2, Plus, Trash2 } from "lucide-react";

import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { ESTADOS, type TipoEstado } from "@/components/comunes/estados";
import { Button } from "@/components/ui/button";

import { COLORES_BASE, COLORES_ESTADO, ESCALA_TIPOGRAFICA, type Muestra } from "./datos";
import { Seccion } from "./Seccion";

function Muestras({ muestras }: { muestras: Muestra[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {muestras.map((muestra) => (
        <li key={muestra.variable} className="flex gap-3 rounded-lg border bg-card p-3">
          <span
            aria-hidden="true"
            className="size-12 shrink-0 rounded-md border"
            style={{ backgroundColor: muestra.hex }}
          />
          <span className="min-w-0 text-sm">
            <span className="block font-semibold">{muestra.nombre}</span>
            <span className="block text-muted-foreground tabular-nums">
              {muestra.hex} · {muestra.variable}
            </span>
            <span className="block text-muted-foreground">{muestra.uso}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SeccionTokens() {
  return (
    <Seccion id="tokens" titulo="Tokens de color" descripcion="Un acento azul marino y un dorado puntual. Neutros slate. Radio de 6 px. Espaciado base de 4 px.">
      <Muestras muestras={COLORES_BASE} />
      <Muestras muestras={COLORES_ESTADO} />
    </Seccion>
  );
}

export function SeccionTipografia() {
  return (
    <Seccion id="tipografia" titulo="Tipografía" descripcion="Inter variable empaquetada. Números tabulares en tablas y montos.">
      <div className="divide-y rounded-lg border bg-card">
        {ESCALA_TIPOGRAFICA.map((fila) => (
          <div key={fila.clase} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
            <p className={`${fila.clase} font-medium`}>Orden de trabajo OT-2026-0018</p>
            <p className="text-sm text-muted-foreground">
              {fila.tamano} · {fila.uso}
            </p>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        Números tabulares: 1,111.11 / 8,888.88 / 0,000.00
      </p>
    </Seccion>
  );
}

export function SeccionBotones() {
  return (
    <Seccion id="botones" titulo="Botones" descripcion="Alto de 40 px por defecto. Foco visible de 2 px.">
      <div className="flex flex-wrap items-center gap-3">
        <Button>Guardar cambios</Button>
        <Button variant="outline">Cancelar</Button>
        <Button variant="secondary">Secundario</Button>
        <Button variant="ghost">Fantasma</Button>
        <Button variant="link">Enlace</Button>
        <Button variant="destructive">
          <Trash2 aria-hidden="true" />
          Eliminar
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button>
          <Plus aria-hidden="true" />
          Nueva cotización
        </Button>
        <Button variant="outline" size="sm">
          <Download aria-hidden="true" />
          Exportar
        </Button>
        <Button aria-disabled="true">
          <Loader2 aria-hidden="true" className="animate-spin" />
          Guardando…
        </Button>
        <Button disabled>Deshabilitado</Button>
        <Button size="lg">Grande</Button>
      </div>
    </Seccion>
  );
}

function GrupoBadges({ tipo, titulo }: { tipo: TipoEstado; titulo: string }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{titulo}</h3>
      <div className="flex flex-wrap gap-2">
        {Object.keys(ESTADOS[tipo]).map((estado) => (
          <EstadoBadge key={estado} tipo={tipo} estado={estado} />
        ))}
      </div>
    </div>
  );
}

export function SeccionBadges() {
  return (
    <Seccion id="badges" titulo="Estados" descripcion="Cada estado combina ícono y texto. El color refuerza, no reemplaza.">
      <div className="grid gap-5 rounded-lg border bg-card p-5 sm:grid-cols-2 xl:grid-cols-4">
        <GrupoBadges tipo="cotizacion" titulo="Cotización" />
        <GrupoBadges tipo="orden" titulo="Orden de trabajo" />
        <GrupoBadges tipo="etapa" titulo="Etapa de producción" />
        <GrupoBadges tipo="stock" titulo="Existencia" />
      </div>
    </Seccion>
  );
}
