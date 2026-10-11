import Link from "next/link";
import { AccionesFiltros, CampoFiltro, FiltrosLista } from "@/components/comunes/FiltrosLista";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ESTADOS, type ConsultaCotizaciones } from "../schema";

function FiltroSeleccion({ nombre, etiqueta, valor, opciones }: {
  nombre: string; etiqueta: string; valor?: string; opciones: { id: string; nombre: string }[];
}) {
  return <CampoFiltro id={`filtro-${nombre}`} etiqueta={etiqueta} className="sm:min-w-44">
    {(atributos) => <Select name={nombre} defaultValue={valor ?? "__todos__"}>
      <SelectTrigger {...atributos}><SelectValue /></SelectTrigger>
      <SelectContent>{opciones.map((opcion) => <SelectItem key={opcion.id} value={opcion.id}>{opcion.nombre}</SelectItem>)}</SelectContent>
    </Select>}
  </CampoFiltro>;
}

export function FiltrosCotizaciones({ consulta, clientes }: {
  consulta: ConsultaCotizaciones; clientes: { id: string; nombre: string }[];
}) {
  return <FiltrosLista action="/cotizaciones" role="search" etiqueta="Buscar cotizaciones">
    <CampoFiltro id="filtro-q" etiqueta="Buscar" className="sm:min-w-48 sm:flex-[2]">
      {(atributos) => <Input {...atributos} name="q" type="search" defaultValue={consulta.q ?? ""} placeholder="Número, cliente o asunto" />}
    </CampoFiltro>
    <FiltroSeleccion nombre="estado" etiqueta="Estado" valor={consulta.estado}
      opciones={[{ id: "__todos__", nombre: "Todos" }, ...ESTADOS.map((id) => ({ id,
        nombre: id === "AJUSTE_SOLICITADO" ? "Ajustes solicitados" : id[0] + id.slice(1).toLowerCase() }))]} />
    <FiltroSeleccion nombre="cliente" etiqueta="Cliente" valor={consulta.cliente}
      opciones={[{ id: "__todos__", nombre: "Todos" }, ...clientes]} />
    <FiltroSeleccion nombre="archivadas" etiqueta="Archivo" valor={consulta.archivadas}
      opciones={[{ id: "false", nombre: "Sin archivar" }, { id: "true", nombre: "Archivadas" }, { id: "todas", nombre: "Todas" }]} />
    <AccionesFiltros>
      <Button type="submit">Buscar</Button>
      <Button asChild variant="outline"><Link href="/cotizaciones">Limpiar filtros</Link></Button>
    </AccionesFiltros>
  </FiltrosLista>;
}
