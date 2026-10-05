import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export type PaginacionTabla = {
  pagina: number;
  total: number;
  tamano: number;
  /** Devuelve la URL de una página, por ejemplo con ?pagina=n. */
  hrefPagina: (pagina: number) => string;
};

function ventanaPaginas(actual: number, ultima: number): (number | "salto-inicio" | "salto-fin")[] {
  const cercanas = [actual - 1, actual, actual + 1].filter((n) => n > 1 && n < ultima);
  const resultado: (number | "salto-inicio" | "salto-fin")[] = [1];
  if (cercanas.length > 0 && cercanas[0] > 2) resultado.push("salto-inicio");
  resultado.push(...cercanas);
  if (cercanas.length > 0 && cercanas[cercanas.length - 1] < ultima - 1) resultado.push("salto-fin");
  if (ultima > 1) resultado.push(ultima);
  return resultado;
}

export function Paginacion({ pagina, total, tamano, hrefPagina }: PaginacionTabla) {
  const ultima = Math.max(1, Math.ceil(total / tamano));
  const desde = total === 0 ? 0 : (pagina - 1) * tamano + 1;
  const hasta = Math.min(pagina * tamano, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Mostrando {desde} a {hasta} de {total}
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          {pagina > 1 ? (
            <PaginationItem>
              <PaginationPrevious href={hrefPagina(pagina - 1)} />
            </PaginationItem>
          ) : null}
          {ventanaPaginas(pagina, ultima).map((entrada) =>
            typeof entrada === "number" ? (
              <PaginationItem key={entrada}>
                <PaginationLink href={hrefPagina(entrada)} isActive={entrada === pagina} aria-label={`Página ${entrada}`}>
                  {entrada}
                </PaginationLink>
              </PaginationItem>
            ) : (
              <PaginationItem key={entrada}>
                <PaginationEllipsis />
              </PaginationItem>
            ),
          )}
          {pagina < ultima ? (
            <PaginationItem>
              <PaginationNext href={hrefPagina(pagina + 1)} />
            </PaginationItem>
          ) : null}
        </PaginationContent>
      </Pagination>
    </div>
  );
}
