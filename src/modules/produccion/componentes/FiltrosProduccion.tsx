import Link from "next/link";
import { AccionesFiltros, CampoFiltro, FiltrosLista, SelectFiltro } from "@/components/comunes/FiltrosLista";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReferenciaOrden } from "@/modules/ordenes/tipos";

type Consulta = { area?: string; responsable?: string; estado?: "PENDIENTE" | "EN_CURSO"; q?: string };

export function FiltrosProduccion({ consulta, opciones }: { consulta: Consulta;
  opciones: { areas: ReferenciaOrden[]; responsables: ReferenciaOrden[] };
}) {
  return <FiltrosLista action="/produccion" etiqueta="Filtrar producción" className="mb-0">
    <CampoFiltro id="filtro-area" etiqueta="Área">{(atributos) => <SelectFiltro {...atributos} name="area" defaultValue={consulta.area ?? ""}>
      <option value="">Todas las áreas</option>{opciones.areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}
    </SelectFiltro>}</CampoFiltro>
    <CampoFiltro id="filtro-responsable" etiqueta="Responsable">{(atributos) => <SelectFiltro {...atributos} name="responsable" defaultValue={consulta.responsable ?? ""}>
      <option value="">Todos los responsables</option>{opciones.responsables.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nombre}</option>)}
    </SelectFiltro>}</CampoFiltro>
    <CampoFiltro id="filtro-estado" etiqueta="Estado">{(atributos) => <SelectFiltro {...atributos} name="estado" defaultValue={consulta.estado ?? ""}>
      <option value="">Todos los estados abiertos</option><option value="PENDIENTE">Pendiente</option><option value="EN_CURSO">En curso</option>
    </SelectFiltro>}</CampoFiltro>
    <CampoFiltro id="filtro-orden" etiqueta="Buscar orden">{(atributos) => <Input {...atributos} name="q" defaultValue={consulta.q ?? ""} placeholder="Número de orden" maxLength={120} />}</CampoFiltro>
    <AccionesFiltros><Button type="submit">Filtrar</Button>
      <Button variant="outline" asChild><Link href="/produccion">Limpiar filtros</Link></Button></AccionesFiltros>
  </FiltrosLista>;
}
