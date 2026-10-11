import { Boxes, History, Receipt } from "lucide-react";
import Image from "next/image";

const beneficios = [
  { Icono: Receipt, texto: "Cotizaciones que se convierten en órdenes sin volver a escribir datos" },
  { Icono: Boxes, texto: "Inventario con saldo controlado por trabajo" },
  { Icono: History, texto: "Historial completo de cada orden" },
];

const ESTELAS = [
  { derecha: 6, arriba: 4, retraso: 0, duracion: 4.5 },
  { derecha: 22, arriba: 0, retraso: 1.2, duracion: 5.2 },
  { derecha: 38, arriba: 6, retraso: 2.6, duracion: 4.8 },
  { derecha: 54, arriba: 2, retraso: 0.6, duracion: 5.6 },
  { derecha: 14, arriba: 24, retraso: 3.4, duracion: 4.4 },
  { derecha: 70, arriba: 8, retraso: 1.9, duracion: 5 },
  { derecha: 30, arriba: 30, retraso: 4.1, duracion: 5.4 },
];

export function PanelInformativo() {
  return (
    <aside aria-labelledby="titulo-plataforma" className="relative m-3 hidden min-w-0 flex-col justify-end overflow-hidden rounded-[16px] bg-foreground p-8 text-background lg:flex xl:p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ maskImage: "radial-gradient(ellipse at top right, black, transparent 75%)" }}
      >
        <div className="cascada-puntos absolute inset-0" />
        <div className="cascada-puntos-grandes absolute inset-0" />
        {ESTELAS.map(({ derecha, arriba, retraso, duracion }) => (
          <span
            key={`${derecha}-${arriba}`}
            className="cascada-estela"
            style={{ right: `${derecha}%`, top: `${arriba}%`, animationDelay: `${retraso}s`, animationDuration: `${duracion}s` }}
          />
        ))}
      </div>
      <div className="relative pt-16">
        <div className="mb-8 flex size-16 items-center justify-center rounded-2xl bg-card">
          <Image src="/brand/isotipo.png" alt="Soluciones Creativas" width={544} height={512} className="h-10 w-auto" />
        </div>
        <h2 id="titulo-plataforma" className="text-4xl leading-tight font-semibold tracking-tight">
          Cotice, produzca y controle en un solo lugar
        </h2>
        <p className="mt-5 text-base leading-relaxed text-border">
          Clientes, cotizaciones, órdenes de trabajo, inventario y trazabilidad de Soluciones Creativas conectados en una sola plataforma.
        </p>
        <ul className="mt-8 space-y-4 text-sm leading-relaxed text-border">
          {beneficios.map(({ Icono, texto }) => (
            <li key={texto} className="flex items-start gap-3">
              <Icono aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <span>{texto}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
