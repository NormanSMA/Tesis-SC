import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { AtencionPanel } from "@/modules/panel/tipos";

export function ordenarPorGravedad(atencion: readonly AtencionPanel[]): AtencionPanel[] {
  const prioridad = { alta: 0, media: 1 };
  return [...atencion].sort((primero, segundo) => prioridad[primero.gravedad] - prioridad[segundo.gravedad]);
}

type MensajeVacio = { texto: string; enlace: string; destino: string };

export function ListaAtencion({ atencion, vacio }: { atencion: readonly AtencionPanel[]; vacio?: MensajeVacio }) {
  return (
    <aside aria-label="Requiere atención" className="h-full min-w-0">
      <Card className="h-full gap-0 rounded-2xl px-5 shadow-none">
        <h2 className="text-base font-semibold">Requiere atención</h2>
        <p className="mt-0.5 mb-4 text-sm text-muted-foreground">Lo más urgente, en orden</p>
        {atencion.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {vacio?.texto ?? "Nada requiere atención ahora"}
            {vacio ? <Link href={vacio.destino} className="ml-2 font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">{vacio.enlace}</Link> : null}
          </p>
        ) : (
          <ul>
            {ordenarPorGravedad(atencion).map((elemento) => (
              <li key={elemento.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 border-t py-3 first:border-t-0 first:pt-0 last:pb-0">
                <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${elemento.gravedad === "alta" ? "bg-danger" : "bg-warning"}`} />
                <div className="min-w-0 flex-1 basis-36 [overflow-wrap:anywhere]">
                  <span className={`text-xs font-semibold ${elemento.gravedad === "alta" ? "text-danger" : "text-warning"}`}>
                    {elemento.gravedad === "alta" ? "Gravedad alta" : "Gravedad media"}
                  </span>
                  <strong className="block text-sm font-semibold">{elemento.titulo}</strong>
                  <span className="block text-sm text-muted-foreground">{elemento.detalle}</span>
                </div>
                <Link
                  href={elemento.destino}
                  aria-label={`Abrir: ${elemento.titulo}`}
                  className="ml-auto inline-flex min-h-10 min-w-10 items-center justify-center rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Abrir
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </aside>
  );
}
