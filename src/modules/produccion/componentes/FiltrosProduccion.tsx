import Link from "next/link";
import { FormField } from "@/components/comunes/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReferenciaOrden } from "@/modules/ordenes/tipos";

type Consulta = { area?: string; responsable?: string; estado?: "PENDIENTE" | "EN_CURSO"; q?: string };
const estiloSeleccion = "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring";

export function FiltrosProduccion({ consulta, opciones }: { consulta: Consulta;
  opciones: { areas: ReferenciaOrden[]; responsables: ReferenciaOrden[] };
}) {
  return <form method="get" action="/produccion" aria-label="Filtrar producción" className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <FormField id="filtro-area" etiqueta="Área">{(atributos) => <select {...atributos} name="area" defaultValue={consulta.area ?? ""} className={estiloSeleccion}>
      <option value="">Todas las áreas</option>{opciones.areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}
    </select>}</FormField>
    <FormField id="filtro-responsable" etiqueta="Responsable">{(atributos) => <select {...atributos} name="responsable" defaultValue={consulta.responsable ?? ""} className={estiloSeleccion}>
      <option value="">Todos los responsables</option>{opciones.responsables.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nombre}</option>)}
    </select>}</FormField>
    <FormField id="filtro-estado" etiqueta="Estado">{(atributos) => <select {...atributos} name="estado" defaultValue={consulta.estado ?? ""} className={estiloSeleccion}>
      <option value="">Todos los estados abiertos</option><option value="PENDIENTE">Pendiente</option><option value="EN_CURSO">En curso</option>
    </select>}</FormField>
    <FormField id="filtro-orden" etiqueta="Buscar orden">{(atributos) => <Input {...atributos} name="q" defaultValue={consulta.q ?? ""} placeholder="Número de orden" maxLength={120} />}</FormField>
    <div className="flex flex-wrap gap-3 sm:col-span-2 xl:col-span-4"><Button type="submit">Filtrar</Button>
      <Button variant="outline" asChild><Link href="/produccion">Limpiar filtros</Link></Button></div>
  </form>;
}
