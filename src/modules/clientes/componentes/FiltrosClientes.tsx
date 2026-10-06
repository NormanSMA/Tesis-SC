import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ETIQUETA_TIPO, TIPOS_CLIENTE, type ConsultaClientes } from "../schema";
import { SelectNativo } from "./SelectNativo";

export function hayFiltrosActivos({ q, tipo, activo }: ConsultaClientes): boolean {
  return Boolean(q) || Boolean(tipo) || !activo;
}

// Formulario GET sin JavaScript: la URL conserva la búsqueda y se puede compartir o recargar.
export function FiltrosClientes({ consulta }: { consulta: ConsultaClientes }) {
  return (
    <form method="get" action="/clientes" role="search" aria-label="Buscar clientes" className="mb-4 flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1 space-y-2">
        <Label htmlFor="filtro-q">Buscar</Label>
        <Input
          id="filtro-q"
          name="q"
          type="search"
          defaultValue={consulta.q ?? ""}
          placeholder="Nombre, RUC, contacto o correo"
          autoComplete="off"
        />
      </div>
      <div className="w-40 space-y-2">
        <Label htmlFor="filtro-tipo">Tipo</Label>
        <SelectNativo id="filtro-tipo" name="tipo" defaultValue={consulta.tipo ?? ""}>
          <option value="">Todos</option>
          {TIPOS_CLIENTE.map((tipo) => (
            <option key={tipo} value={tipo}>
              {ETIQUETA_TIPO[tipo]}
            </option>
          ))}
        </SelectNativo>
      </div>
      <div className="w-40 space-y-2">
        <Label htmlFor="filtro-activo">Estado</Label>
        <SelectNativo id="filtro-activo" name="activo" defaultValue={consulta.activo ? "true" : "false"}>
          <option value="true">Activos</option>
          <option value="false">Archivados</option>
        </SelectNativo>
      </div>
      <Button type="submit">
        <Search aria-hidden="true" />
        Buscar
      </Button>
      {hayFiltrosActivos(consulta) ? (
        <Button asChild variant="outline">
          <Link href="/clientes">Limpiar filtros</Link>
        </Button>
      ) : null}
    </form>
  );
}
