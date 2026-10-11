import Link from "next/link";
import { AccionesFiltros, CampoFiltro, FiltrosLista } from "@/components/comunes/FiltrosLista";
import { ESTADOS as DEFINICIONES } from "@/components/comunes/estados";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ESTADOS, type ConsultaOrdenes } from "../schema";
import type { ReferenciaOrden } from "../tipos";

function FiltroSeleccion({ nombre, etiqueta, valor, opciones }: {
  nombre: string; etiqueta: string; valor?: string; opciones: ReferenciaOrden[];
}) {
  return <CampoFiltro id={`filtro-${nombre}`} etiqueta={etiqueta} className="sm:min-w-48">
    {(atributos) => <Select name={nombre} defaultValue={valor ?? "__todos__"}>
      <SelectTrigger {...atributos}><SelectValue /></SelectTrigger>
      <SelectContent>{opciones.map((opcion) => <SelectItem key={opcion.id} value={opcion.id}>{opcion.nombre}</SelectItem>)}</SelectContent>
    </Select>}
  </CampoFiltro>;
}

function hrefSinResponsable(consulta: ConsultaOrdenes, activo: boolean) {
  const parametros = new URLSearchParams();
  for (const [campo, valor] of Object.entries({ ...consulta, pagina: undefined, responsable: activo ? undefined : "sin-responsable" })) {
    if (valor !== undefined && valor !== "") parametros.set(campo, String(valor));
  }
  return `/ordenes?${parametros}`;
}

export function FiltrosOrdenes({ consulta, responsables }: { consulta: ConsultaOrdenes; responsables: ReferenciaOrden[] }) {
  const sinResponsable = consulta.responsable === "sin-responsable";
  return <FiltrosLista action="/ordenes" role="search" etiqueta="Buscar órdenes">
    {consulta.cliente ? <input type="hidden" name="cliente" value={consulta.cliente} /> : null}
    <CampoFiltro id="filtro-q" etiqueta="Buscar" className="sm:min-w-48 sm:flex-[2]">
      {(atributos) => <Input {...atributos} name="q" type="search" defaultValue={consulta.q ?? ""} placeholder="Número, cliente o asunto" />}
    </CampoFiltro>
    <FiltroSeleccion nombre="estado" etiqueta="Estado" valor={consulta.estado}
      opciones={[{ id: "__todos__", nombre: "Todos" }, ...ESTADOS.map((id) => ({ id, nombre: DEFINICIONES.orden[id].etiqueta }))]} />
    <FiltroSeleccion nombre="responsable" etiqueta="Responsable" valor={consulta.responsable}
      opciones={[{ id: "__todos__", nombre: "Todos" }, { id: "sin-responsable", nombre: "Sin responsable" }, ...responsables]} />
    <FiltroSeleccion nombre="terminales" etiqueta="Órdenes" valor={consulta.terminales}
      opciones={[{ id: "false", nombre: "En proceso" }, { id: "true", nombre: "Terminales" }, { id: "todas", nombre: "Todas" }]} />
    <FiltroSeleccion nombre="vencidas" etiqueta="Atraso" valor={consulta.vencidas}
      opciones={[{ id: "false", nombre: "Todas las fechas" }, { id: "true", nombre: "Atrasadas" }]} />
    <AccionesFiltros>
      <Button type="submit">Buscar</Button>
      <Button asChild variant="outline"><Link href="/ordenes">Limpiar filtros</Link></Button>
      <Button asChild variant={sinResponsable ? "default" : "outline"}>
        <Link href={hrefSinResponsable(consulta, sinResponsable)} aria-current={sinResponsable ? "true" : undefined}>Sin responsable</Link></Button>
    </AccionesFiltros>
  </FiltrosLista>;
}
