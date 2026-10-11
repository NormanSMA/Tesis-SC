import Link from "next/link";
import { FormField } from "@/components/comunes/FormField";
import { ESTADOS as DEFINICIONES } from "@/components/comunes/estados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ESTADOS, type ConsultaOrdenes } from "../schema";
import type { ReferenciaOrden } from "../tipos";

function FiltroSeleccion({ nombre, etiqueta, valor, opciones }: {
  nombre: string; etiqueta: string; valor?: string; opciones: ReferenciaOrden[];
}) {
  return <FormField id={`filtro-${nombre}`} etiqueta={etiqueta} className="min-w-40 flex-1">
    {(atributos) => <Select name={nombre} defaultValue={valor ?? "__todos__"}>
      <SelectTrigger {...atributos}><SelectValue /></SelectTrigger>
      <SelectContent>{opciones.map((opcion) => <SelectItem key={opcion.id} value={opcion.id}>{opcion.nombre}</SelectItem>)}</SelectContent>
    </Select>}
  </FormField>;
}

export function FiltrosOrdenes({ consulta, responsables }: { consulta: ConsultaOrdenes; responsables: ReferenciaOrden[] }) {
  return <form action="/ordenes" method="get" role="search" aria-label="Buscar órdenes" className="mb-5 flex flex-wrap items-end gap-3">
    {consulta.cliente ? <input type="hidden" name="cliente" value={consulta.cliente} /> : null}
    <FormField id="filtro-q" etiqueta="Buscar" className="min-w-48 flex-[2]">
      {(atributos) => <Input {...atributos} name="q" type="search" defaultValue={consulta.q ?? ""} placeholder="Número, cliente o asunto" />}
    </FormField>
    <FiltroSeleccion nombre="estado" etiqueta="Estado" valor={consulta.estado}
      opciones={[{ id: "__todos__", nombre: "Todos" }, ...ESTADOS.map((id) => ({ id, nombre: DEFINICIONES.orden[id].etiqueta }))]} />
    <FiltroSeleccion nombre="responsable" etiqueta="Responsable" valor={consulta.responsable}
      opciones={[{ id: "__todos__", nombre: "Todos" }, { id: "sin-responsable", nombre: "Sin responsable" }, ...responsables]} />
    <FiltroSeleccion nombre="terminales" etiqueta="Órdenes" valor={consulta.terminales}
      opciones={[{ id: "false", nombre: "En proceso" }, { id: "true", nombre: "Terminales" }, { id: "todas", nombre: "Todas" }]} />
    <FiltroSeleccion nombre="vencidas" etiqueta="Atraso" valor={consulta.vencidas}
      opciones={[{ id: "false", nombre: "Todas las fechas" }, { id: "true", nombre: "Atrasadas" }]} />
    <Button type="submit">Buscar</Button><Button asChild variant="outline"><Link href="/ordenes">Limpiar filtros</Link></Button>
  </form>;
}
