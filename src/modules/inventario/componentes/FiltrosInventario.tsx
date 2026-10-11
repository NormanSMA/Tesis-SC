import { AccionesFiltros, CampoFiltro, FiltrosLista, SelectFiltro } from "@/components/comunes/FiltrosLista";
import { ETIQUETA_MOVIMIENTO, etiquetar } from "../etiquetas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TIPOS_MOVIMIENTO, type ConsultaMateriales, type ConsultaMovimientos } from "../schema";

export function FiltrosMateriales({ consulta }: { consulta: ConsultaMateriales }) {
  return <FiltrosLista action="/inventario" etiqueta="Filtrar materiales">
    <CampoFiltro id="q" etiqueta="Buscar material" className="sm:min-w-56 sm:flex-[2]">{(atributos) => <Input {...atributos} name="q" defaultValue={consulta.q} placeholder="Nombre o código" />}</CampoFiltro>
    <CampoFiltro id="activo" etiqueta="Estado" className="sm:max-w-48">{(atributos) => <SelectFiltro {...atributos} name="activo" defaultValue={consulta.activo}>
      <option value="true">Activos</option><option value="false">Archivados</option><option value="todos">Todos</option></SelectFiltro>}</CampoFiltro>
    <CampoFiltro id="bajoMinimo" etiqueta="Existencia" className="sm:max-w-48">{(atributos) => <SelectFiltro {...atributos} name="bajoMinimo" defaultValue={consulta.bajoMinimo}>
      <option value="false">Todas</option><option value="true">En alerta</option></SelectFiltro>}</CampoFiltro>
    <AccionesFiltros><Button type="submit">Filtrar materiales</Button></AccionesFiltros>
  </FiltrosLista>;
}
type OpcionesLibro = { materiales: { id: string; codigo: string; nombre: string }[];
  usuarios: { id: string; nombre: string }[]; ordenes: { id: string; numero: string }[] };
export function FiltrosMovimientos({ consulta, materialId, opciones }: { consulta: ConsultaMovimientos; materialId?: string; opciones: OpcionesLibro }) {
  return <FiltrosLista etiqueta="Filtrar movimientos">
    <input type="hidden" name="pestana" value="movimientos" />
    <CampoFiltro id="tipo" etiqueta="Tipo">{(atributos) => <SelectFiltro {...atributos} name="tipo" defaultValue={consulta.tipo ?? ""}>
      <option value="">Todos</option>{TIPOS_MOVIMIENTO.map((tipo) => <option key={tipo} value={tipo}>{etiquetar(ETIQUETA_MOVIMIENTO, tipo)}</option>)}</SelectFiltro>}</CampoFiltro>
    {!materialId ? <CampoFiltro id="material" etiqueta="Material">{(atributos) => <SelectFiltro {...atributos} name="material"
      defaultValue={consulta.material ?? ""}><option value="">Todos</option>
      {opciones.materiales.map((material) => <option key={material.id} value={material.id}>{material.codigo} · {material.nombre}</option>)}
    </SelectFiltro>}</CampoFiltro> : null}
    <CampoFiltro id="orden" etiqueta="Orden">{(atributos) => <SelectFiltro {...atributos} name="orden"
      defaultValue={consulta.orden ?? ""}><option value="">Todas</option>
      {opciones.ordenes.map((orden) => <option key={orden.id} value={orden.id}>{orden.numero}</option>)}</SelectFiltro>}</CampoFiltro>
    <CampoFiltro id="usuario" etiqueta="Usuario">{(atributos) => <SelectFiltro {...atributos} name="usuario"
      defaultValue={consulta.usuario ?? ""}><option value="">Todos</option>
      {opciones.usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.nombre}</option>)}</SelectFiltro>}</CampoFiltro>
    <CampoFiltro id="desde" etiqueta="Desde (Managua)">{(atributos) => <Input {...atributos} name="desde" type="date" defaultValue={consulta.desde} />}</CampoFiltro>
    <CampoFiltro id="hasta" etiqueta="Hasta (Managua)">{(atributos) => <Input {...atributos} name="hasta" type="date" defaultValue={consulta.hasta} />}</CampoFiltro>
    <AccionesFiltros><Button type="submit">Filtrar movimientos</Button></AccionesFiltros>
  </FiltrosLista>;
}
