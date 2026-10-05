import Link from "next/link";
import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { gruposNavegacion, itemActivo } from "./navegacion";

type Miga = { etiqueta: string; href?: string };

const SEGMENTO_ID = /^([0-9a-f]{8}-[0-9a-f-]{27}|\d+)$/i;

function etiquetaSegmento(segmento: string): string {
  if (SEGMENTO_ID.test(segmento)) return "Detalle";
  const texto = decodeURIComponent(segmento).replace(/-/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Las migas salen de la navegación y de la ruta: los módulos no deben declararlas.
export function construirMigas(ruta: string): Miga[] {
  const item = itemActivo(gruposNavegacion, ruta);
  if (!item) return [];
  const grupo = gruposNavegacion.find((candidato) => candidato.items.includes(item));
  const migas: Miga[] = [];
  if (grupo?.etiqueta) migas.push({ etiqueta: grupo.etiqueta });
  const resto = ruta.slice(item.href.length).split("/").filter(Boolean);
  migas.push({ etiqueta: item.etiqueta, href: resto.length > 0 ? item.href : undefined });
  resto.forEach((segmento) => migas.push({ etiqueta: etiquetaSegmento(segmento) }));
  return migas;
}

function MigaIntermedia({ miga }: { miga: Miga }) {
  if (miga.href) {
    return (
      <BreadcrumbLink asChild>
        <Link href={miga.href}>{miga.etiqueta}</Link>
      </BreadcrumbLink>
    );
  }
  return <span className="text-muted-foreground">{miga.etiqueta}</span>;
}

export function Migas({ ruta }: { ruta: string }) {
  const migas = construirMigas(ruta);
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap text-sm">
        {migas.map((miga, indice) => {
          const ultima = indice === migas.length - 1;
          return (
            <Fragment key={`${indice}-${miga.etiqueta}`}>
              {indice > 0 ? <BreadcrumbSeparator className={ultima ? "" : "hidden sm:block"} /> : null}
              <BreadcrumbItem className={ultima ? "min-w-0" : "hidden sm:inline-flex"}>
                {ultima ? (
                  <BreadcrumbPage className="truncate text-base font-semibold">{miga.etiqueta}</BreadcrumbPage>
                ) : (
                  <MigaIntermedia miga={miga} />
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
