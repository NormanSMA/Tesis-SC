"use client";

import Link from "next/link";
import { Search } from "lucide-react";

import { AccionesFiltros, CampoFiltro, FiltrosLista } from "@/components/comunes/FiltrosLista";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ConsultaProductos } from "../schema";
import type { CategoriaDto } from "../tipos";
import { SelectorCatalogo } from "./SelectorCatalogo";

export function FiltrosCatalogo({ consulta, categorias }: { consulta: ConsultaProductos; categorias: CategoriaDto[] }) {
  const opciones = [{ valor: "todas", etiqueta: "Todas" }, ...categorias.map((categoria) => ({ valor: categoria.id, etiqueta: categoria.nombre, categoria: categoria.nombre }))];
  return <FiltrosLista action="/catalogo" role="search" etiqueta="Buscar productos" className="mb-6">
    <CampoFiltro id="filtro-q" etiqueta="Buscar" className="sm:min-w-56 sm:flex-[2]">
      {(atributos) => <Input {...atributos} name="q" type="search" defaultValue={consulta.q ?? ""} placeholder="Código, nombre o descripción" />}
    </CampoFiltro>
    <CampoFiltro id="filtro-categoria" etiqueta="Categoría" className="sm:max-w-72">
      {(atributos) => <SelectorCatalogo {...atributos} nombre="categoriaId" inicial={consulta.categoriaId ?? "todas"} opciones={opciones} />}
    </CampoFiltro>
    <CampoFiltro id="filtro-activo" etiqueta="Estado" className="sm:max-w-48">
      {(atributos) => <SelectorCatalogo {...atributos} nombre="activo" inicial={String(consulta.activo)} opciones={[
        { valor: "true", etiqueta: "Activos" }, { valor: "false", etiqueta: "Archivados" },
      ]} />}
    </CampoFiltro>
    <AccionesFiltros>
      <Button type="submit"><Search aria-hidden="true" />Buscar</Button>
      {consulta.q || consulta.categoriaId || !consulta.activo ? <Button asChild variant="outline"><Link href="/catalogo">Limpiar</Link></Button> : null}
    </AccionesFiltros>
  </FiltrosLista>;
}
