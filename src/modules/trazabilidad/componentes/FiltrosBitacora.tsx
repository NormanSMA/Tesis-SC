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
export function FiltrosBitacora({ consulta, usuarios }: { consulta: ConsultaBitacora; usuarios: { id: string; nombre: string }[] }) {
  return <form action="/trazabilidad" method="get" role="search" aria-label="Filtrar bitácora"
    className="mb-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <Seleccion nombre="entidad" etiqueta="Entidad" valor={consulta.entidad}
      opciones={ENTIDADES.map((id) => ({ id, nombre: ENTIDAD_TEXTO[id] }))} />
    <Seleccion nombre="accion" etiqueta="Acción" valor={consulta.accion}
      opciones={ACCIONES.map((id) => ({ id, nombre: ACCION_TEXTO[id] }))} />
    <Seleccion nombre="usuario" etiqueta="Usuario" valor={consulta.usuario} opciones={usuarios} />
    <FormField id="filtro-texto" etiqueta="Texto">{(atributos) => <Input {...atributos} name="texto" type="search" defaultValue={consulta.texto} placeholder="Números o nombres" />}</FormField>
    {([['orden', 'Número de orden'], ['cotizacion', 'Número de cotización'], ['desde', 'Desde'], ['hasta', 'Hasta']] as const)
      .map(([campo, etiqueta]) => <FormField key={campo} id={`filtro-${campo}`} etiqueta={etiqueta}>
        {(atributos) => <Input {...atributos} name={campo} type={campo === "desde" || campo === "hasta" ? "date" : "search"}
          defaultValue={consulta[campo]} />}</FormField>)}
    <div className="flex flex-wrap gap-3 sm:col-span-2 xl:col-span-4">
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
