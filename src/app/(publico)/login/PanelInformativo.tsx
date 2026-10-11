import { Boxes, History, Receipt } from "lucide-react";
import Image from "next/image";

const beneficios = [
  { Icono: Receipt, texto: "Cotizaciones que se convierten en órdenes sin volver a escribir datos" },
  { Icono: Boxes, texto: "Inventario con saldo controlado por trabajo" },
  { Icono: History, texto: "Historial completo de cada orden" },
];

export function PanelInformativo() {
  return (
    <aside aria-labelledby="titulo-plataforma" className="relative m-3 hidden min-w-0 flex-col justify-end overflow-hidden rounded-[16px] bg-foreground p-8 text-background lg:flex xl:p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, var(--input) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          maskImage: "radial-gradient(ellipse at top right, black, transparent 70%)",
        }}
      />
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
