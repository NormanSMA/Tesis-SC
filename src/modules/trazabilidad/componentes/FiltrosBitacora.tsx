import Link from "next/link";
import { FormField } from "@/components/comunes/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACCION_TEXTO, ENTIDAD_TEXTO } from "../etiquetas";
import { ACCIONES, ENTIDADES, type ConsultaBitacora } from "../schema";

function Seleccion({ nombre, etiqueta, valor, opciones }: {
  nombre: string; etiqueta: string; valor?: string; opciones: { id: string; nombre: string }[];
}) {
  return <FormField id={`filtro-${nombre}`} etiqueta={etiqueta} className="min-w-0">
    {(atributos) => <Select name={nombre} defaultValue={valor ?? "__todos__"}>
      <SelectTrigger {...atributos} className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="__todos__">Todos</SelectItem>
        {opciones.map((opcion) => <SelectItem key={opcion.id} value={opcion.id}>{opcion.nombre}</SelectItem>)}
      </SelectContent></Select>}
  </FormField>;
}
const REJILLA = "grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4";
function CampoFiltro({ campo, etiqueta, consulta }: { campo: "orden" | "cotizacion" | "desde" | "hasta" | "texto"; etiqueta: string; consulta: ConsultaBitacora }) {
  const fecha = campo === "desde" || campo === "hasta";
  return <FormField id={`filtro-${campo}`} etiqueta={etiqueta}>
    {(atributos) => <Input {...atributos} name={campo} type={fecha ? "date" : "search"} lang={fecha ? "es" : undefined}
      defaultValue={consulta[campo]} />}</FormField>;
}
export function FiltrosBitacora({ consulta, usuarios }: { consulta: ConsultaBitacora; usuarios: { id: string; nombre: string }[] }) {
  const hayFiltroAvanzado = Boolean(consulta.entidad || consulta.accion || consulta.usuario || consulta.texto || consulta.cotizacion);
  return <form action="/trazabilidad" method="get" role="search" aria-label="Filtrar bitácora" className="mb-5 min-w-0 space-y-3">
    <div className={REJILLA}>
      <CampoFiltro campo="orden" etiqueta="Número de orden" consulta={consulta} />
      <CampoFiltro campo="desde" etiqueta="Desde" consulta={consulta} />
      <CampoFiltro campo="hasta" etiqueta="Hasta" consulta={consulta} />
    </div>
    <details open={hayFiltroAvanzado} className="rounded-lg border bg-card px-4 py-2">
      <summary className="min-h-10 cursor-pointer text-sm font-medium">Más filtros</summary>
      <div className={`${REJILLA} pt-3 pb-2`}>
        <Seleccion nombre="entidad" etiqueta="Entidad" valor={consulta.entidad}
          opciones={ENTIDADES.map((id) => ({ id, nombre: ENTIDAD_TEXTO[id] }))} />
        <Seleccion nombre="accion" etiqueta="Acción" valor={consulta.accion}
          opciones={ACCIONES.map((id) => ({ id, nombre: ACCION_TEXTO[id] }))} />
        <Seleccion nombre="usuario" etiqueta="Usuario" valor={consulta.usuario} opciones={usuarios} />
        <CampoFiltro campo="cotizacion" etiqueta="Número de cotización" consulta={consulta} />
        <CampoFiltro campo="texto" etiqueta="Texto" consulta={consulta} />
      </div>
    </details>
    <div className="flex flex-wrap gap-3">
      <Button type="submit">Filtrar</Button><Button asChild variant="outline"><Link href="/trazabilidad">Limpiar filtros</Link></Button>
    </div>
  </form>;
}
export function BuscarTrabajo() {
  return <form action="/trazabilidad" method="get" role="search" aria-label="Buscar trazabilidad completa"
    className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
    <FormField id="buscar-trabajo" etiqueta="Número de orden o cotización" className="min-w-0 flex-1">
      {(atributos) => <Input {...atributos} name="trabajo" type="search" required maxLength={20} placeholder="OT-2026-0001 o COT-2026-0001" />}
    </FormField><Button type="submit">Abrir trazabilidad completa</Button>
  </form>;
}
