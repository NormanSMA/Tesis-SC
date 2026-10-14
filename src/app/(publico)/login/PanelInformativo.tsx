import { Boxes, History, Receipt } from "lucide-react";
import Image from "next/image";

const beneficios = [
  { Icono: Receipt, texto: "Cotizaciones que se convierten en órdenes sin volver a escribir datos" },
  { Icono: Boxes, texto: "Inventario con saldo controlado por trabajo" },
  { Icono: History, texto: "Historial completo de cada orden" },
];

export function PanelInformativo() {
  return (
    <aside aria-labelledby="titulo-plataforma" className="relative m-3 hidden min-w-0 flex-col overflow-hidden rounded-[16px] bg-foreground p-8 text-background lg:flex xl:p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ maskImage: "radial-gradient(ellipse at top right, black, transparent 75%)" }}
      >
        <div className="cascada-puntos absolute inset-0" />
        <div className="cascada-puntos-grandes absolute inset-0" />
      </div>
      <div className="relative flex flex-1 flex-col justify-center gap-10">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-card">
          <Image src="/brand/isotipo.png" alt="TRACORE" width={544} height={512} className="h-10 w-auto" />
        </div>
        <h2 id="titulo-plataforma" className="text-4xl leading-tight font-semibold tracking-tight">
          Cotice, produzca y controle en un solo lugar
        </h2>
        <ul className="space-y-5 text-base leading-relaxed text-border">
          {beneficios.map(({ Icono, texto }) => (
            <li key={texto} className="flex items-start gap-4">
              <Icono aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
              <span>{texto}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
