"use client";

import Link from "next/link";
import { Search } from "lucide-react";

import { FormField } from "@/components/comunes/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { ConsultaProductos } from "../schema";
import type { CategoriaDto } from "../tipos";
import { SelectorCatalogo } from "./SelectorCatalogo";

export function FiltrosCatalogo({ consulta, categorias }: { consulta: ConsultaProductos; categorias: CategoriaDto[] }) {
  const opciones = [{ valor: "todas", etiqueta: "Todas" }, ...categorias.map((categoria) => ({ valor: categoria.id, etiqueta: categoria.nombre }))];
  return <form method="get" action="/catalogo" role="search" aria-label="Buscar productos" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_18rem_10rem_auto]">
    <FormField id="filtro-q" etiqueta="Buscar">
      {(atributos) => <Input {...atributos} name="q" type="search" defaultValue={consulta.q ?? ""} placeholder="Código, nombre o descripción" />}
    </FormField>
    <FormField id="filtro-categoria" etiqueta="Categoría">
      {(atributos) => <SelectorCatalogo {...atributos} nombre="categoriaId" inicial={consulta.categoriaId ?? "todas"} opciones={opciones} />}
    </FormField>
    <FormField id="filtro-activo" etiqueta="Estado">
      {(atributos) => <SelectorCatalogo {...atributos} nombre="activo" inicial={String(consulta.activo)} opciones={[
        { valor: "true", etiqueta: "Activos" }, { valor: "false", etiqueta: "Archivados" },
      ]} />}
    </FormField>
    <div className="flex flex-wrap items-center gap-2 self-end pb-2">
      <Button type="submit"><Search aria-hidden="true" />Buscar</Button>
      {consulta.q || consulta.categoriaId || !consulta.activo ? <Button asChild variant="outline"><Link href="/catalogo">Limpiar</Link></Button> : null}
    </div>
  </form>;
}
