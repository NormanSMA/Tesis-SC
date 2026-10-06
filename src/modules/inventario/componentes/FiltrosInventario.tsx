import { FormField } from "@/components/comunes/FormField";
import { ETIQUETA_MOVIMIENTO, etiquetar } from "../etiquetas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TIPOS_MOVIMIENTO, type ConsultaMateriales, type ConsultaMovimientos } from "../schema";

const ESTILO_SELECT = "h-11 w-full min-w-0 max-w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
export function FiltrosMateriales({ consulta }: { consulta: ConsultaMateriales }) {
  return <form action="/inventario" className="mb-5 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtrar materiales">
    <FormField id="q" etiqueta="Buscar material">{(atributos) => <Input {...atributos} name="q" defaultValue={consulta.q} placeholder="Nombre o código" />}</FormField>
    <FormField id="activo" etiqueta="Estado">{(atributos) => <select {...atributos} name="activo" defaultValue={consulta.activo} className={ESTILO_SELECT}>
      <option value="true">Activos</option><option value="false">Archivados</option><option value="todos">Todos</option></select>}</FormField>
    <FormField id="bajoMinimo" etiqueta="Existencia">{(atributos) => <select {...atributos} name="bajoMinimo" defaultValue={consulta.bajoMinimo} className={ESTILO_SELECT}>
      <option value="false">Todas</option><option value="true">En alerta</option></select>}</FormField>
    <Button className="self-end" type="submit">Filtrar materiales</Button>
  </form>;
}
type OpcionesLibro = { materiales: { id: string; codigo: string; nombre: string }[];
  usuarios: { id: string; nombre: string }[]; ordenes: { id: string; numero: string }[] };
export function FiltrosMovimientos({ consulta, materialId, opciones }: { consulta: ConsultaMovimientos; materialId?: string; opciones: OpcionesLibro }) {
  return <form className="mb-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Filtrar movimientos">
    <input type="hidden" name="pestana" value="movimientos" />
    <FormField id="tipo" etiqueta="Tipo">{(atributos) => <select {...atributos} name="tipo" defaultValue={consulta.tipo ?? ""} className={ESTILO_SELECT}>
      <option value="">Todos</option>{TIPOS_MOVIMIENTO.map((tipo) => <option key={tipo} value={tipo}>{etiquetar(ETIQUETA_MOVIMIENTO, tipo)}</option>)}</select>}</FormField>
    {!materialId ? <FormField id="material" etiqueta="Material">{(atributos) => <select {...atributos} name="material"
      defaultValue={consulta.material ?? ""} className={ESTILO_SELECT}><option value="">Todos</option>
      {opciones.materiales.map((material) => <option key={material.id} value={material.id}>{material.codigo} · {material.nombre}</option>)}
    </select>}</FormField> : null}
    <FormField id="orden" etiqueta="Orden">{(atributos) => <select {...atributos} name="orden"
      defaultValue={consulta.orden ?? ""} className={ESTILO_SELECT}><option value="">Todas</option>
      {opciones.ordenes.map((orden) => <option key={orden.id} value={orden.id}>{orden.numero}</option>)}</select>}</FormField>
    <FormField id="usuario" etiqueta="Usuario">{(atributos) => <select {...atributos} name="usuario"
      defaultValue={consulta.usuario ?? ""} className={ESTILO_SELECT}><option value="">Todos</option>
      {opciones.usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nombre}</option>)}</select>}</FormField>
    <FormField id="desde" etiqueta="Desde (Managua)">{(atributos) => <Input {...atributos} name="desde" type="date" defaultValue={consulta.desde} />}</FormField>
    <FormField id="hasta" etiqueta="Hasta (Managua)">{(atributos) => <Input {...atributos} name="hasta" type="date" defaultValue={consulta.hasta} />}</FormField>
    <Button className="self-end" type="submit">Filtrar movimientos</Button>
  </form>;
}
