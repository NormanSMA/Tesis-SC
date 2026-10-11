import Link from "next/link";
import { Search } from "lucide-react";

import { AccionesFiltros, CampoFiltro, FiltrosLista, SelectFiltro } from "@/components/comunes/FiltrosLista";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ETIQUETA_TIPO, TIPOS_CLIENTE, type ConsultaClientes } from "../schema";

export function hayFiltrosActivos({ q, tipo, activo }: ConsultaClientes): boolean {
  return Boolean(q) || Boolean(tipo) || !activo;
}

// Formulario GET sin JavaScript: la URL conserva la búsqueda y se puede compartir o recargar.
export function FiltrosClientes({ consulta }: { consulta: ConsultaClientes }) {
  return (
    <FiltrosLista action="/clientes" role="search" etiqueta="Buscar clientes">
      <CampoFiltro id="filtro-q" etiqueta="Buscar" className="sm:min-w-56 sm:flex-[2]">
        {(atributos) => (
          <Input
            {...atributos}
            name="q"
            type="search"
            defaultValue={consulta.q ?? ""}
            placeholder="Nombre, RUC, contacto o correo"
            autoComplete="off"
          />
        )}
      </CampoFiltro>
      <CampoFiltro id="filtro-tipo" etiqueta="Tipo" className="sm:max-w-48">
        {(atributos) => (
          <SelectFiltro {...atributos} name="tipo" defaultValue={consulta.tipo ?? ""}>
            <option value="">Todos</option>
            {TIPOS_CLIENTE.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ETIQUETA_TIPO[tipo]}
              </option>
            ))}
          </SelectFiltro>
        )}
      </CampoFiltro>
      <CampoFiltro id="filtro-activo" etiqueta="Estado" className="sm:max-w-48">
        {(atributos) => (
          <SelectFiltro {...atributos} name="activo" defaultValue={consulta.activo ? "true" : "false"}>
            <option value="true">Activos</option>
            <option value="false">Archivados</option>
          </SelectFiltro>
        )}
      </CampoFiltro>
      <AccionesFiltros>
        <Button type="submit">
          <Search aria-hidden="true" />
          Buscar
        </Button>
        {hayFiltrosActivos(consulta) ? (
          <Button asChild variant="outline">
            <Link href="/clientes">Limpiar filtros</Link>
          </Button>
        ) : null}
      </AccionesFiltros>
    </FiltrosLista>
  );
}
