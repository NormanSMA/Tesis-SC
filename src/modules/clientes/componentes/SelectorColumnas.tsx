"use client";

import { Columns3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  COLUMNAS_OPCIONALES,
  COLUMNAS_POR_DEFECTO,
  ETIQUETA_COLUMNA,
  columnasPermitidas,
  guardarColumnas,
  type ColumnaOpcional,
} from "../columnas";

type PropiedadesSelector = { visibles: ColumnaOpcional[]; conCotizaciones: boolean };

/** Elige qué datos del cliente se ven en la lista. La elección se recuerda en una cookie. */
export function SelectorColumnas({ visibles, conCotizaciones }: PropiedadesSelector) {
  const router = useRouter();
  // Estado local: varios clics seguidos no deben partir de la lista anterior mientras la página se refresca.
  const [elegidas, setElegidas] = useState<ColumnaOpcional[]>(visibles);
  const ofrecidas = columnasPermitidas(COLUMNAS_OPCIONALES, conCotizaciones);

  function guardar(columnas: ColumnaOpcional[]) {
    setElegidas(columnas);
    guardarColumnas(columnas);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          <Columns3 aria-hidden="true" />
          Columnas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Datos visibles en la lista</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ofrecidas.map((columna) => (
          <DropdownMenuCheckboxItem
            key={columna}
            checked={elegidas.includes(columna)}
            onSelect={(evento) => evento.preventDefault()}
            onCheckedChange={(marcada) =>
              guardar(marcada ? [...elegidas, columna] : elegidas.filter((actual) => actual !== columna))
            }
          >
            {ETIQUETA_COLUMNA[columna]}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => guardar([...COLUMNAS_POR_DEFECTO])}>Restablecer</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
