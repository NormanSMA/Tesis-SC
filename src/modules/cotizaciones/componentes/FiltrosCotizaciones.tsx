import Link from "next/link";
import { FormField } from "@/components/comunes/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ESTADOS, type ConsultaCotizaciones } from "../schema";

function FiltroSeleccion({ nombre, etiqueta, valor, opciones }: {
  nombre: string; etiqueta: string; valor?: string; opciones: { id: string; nombre: string }[];
}) {
  return <FormField id={`filtro-${nombre}`} etiqueta={etiqueta} className="min-w-40 flex-1">
    {(atributos) => <Select name={nombre} defaultValue={valor ?? "__todos__"}>
      <SelectTrigger {...atributos}><SelectValue /></SelectTrigger>
      <SelectContent>{opciones.map((opcion) => <SelectItem key={opcion.id} value={opcion.id}>{opcion.nombre}</SelectItem>)}</SelectContent>
    </Select>}
  </FormField>;
}

export function FiltrosCotizaciones({ consulta, clientes }: {
  consulta: ConsultaCotizaciones; clientes: { id: string; nombre: string }[];
}) {
  return <form action="/cotizaciones" method="get" role="search" aria-label="Buscar cotizaciones"
    className="mb-5 flex flex-wrap items-end gap-3">
    <FormField id="filtro-q" etiqueta="Buscar" className="min-w-48 flex-[2]">
      {(atributos) => <Input {...atributos} name="q" type="search" defaultValue={consulta.q ?? ""} placeholder="Número, cliente o asunto" />}
    </FormField>
    <FiltroSeleccion nombre="estado" etiqueta="Estado" valor={consulta.estado}
      opciones={[{ id: "__todos__", nombre: "Todos" }, ...ESTADOS.map((id) => ({ id,
        nombre: id === "AJUSTE_SOLICITADO" ? "Ajustes solicitados" : id[0] + id.slice(1).toLowerCase() }))]} />
    <FiltroSeleccion nombre="cliente" etiqueta="Cliente" valor={consulta.cliente}
      opciones={[{ id: "__todos__", nombre: "Todos" }, ...clientes]} />
    <FiltroSeleccion nombre="archivadas" etiqueta="Archivo" valor={consulta.archivadas}
      opciones={[{ id: "false", nombre: "Sin archivar" }, { id: "true", nombre: "Archivadas" }, { id: "todas", nombre: "Todas" }]} />
    <Button type="submit">Buscar</Button>
    <Button asChild variant="outline"><Link href="/cotizaciones">Limpiar filtros</Link></Button>
  </form>;
}
