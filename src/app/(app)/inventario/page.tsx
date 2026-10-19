import { Boxes, PackageX, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/comunes/PageHeader";
import { BandejaMetricas, TarjetaMetrica } from "@/components/comunes/TarjetaMetrica";
import { Button } from "@/components/ui/button";
import { can, type Actor } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { formatearCantidad } from "@/lib/formato";
import { ProveedorLista } from "@/lib/listas/contexto-lista";
import { FiltrosMateriales, FiltrosMovimientos } from "@/modules/inventario/componentes/FiltrosInventario";
import { PestanasInventario } from "@/modules/inventario/componentes/PestanasInventario";
import { TablaMateriales, TablaMovimientos } from "@/modules/inventario/componentes/TablasInventario";
import { consultaPagina } from "@/modules/inventario/paginas";
import { esquemaConsultaMateriales, esquemaConsultaMovimientos } from "@/modules/inventario/schema";
import { listarMateriales, listarMovimientos, opcionesLibro } from "@/modules/inventario/service";

export const metadata: Metadata = { title: "Inventario" };

type Parametros = Record<string, string | string[] | undefined>;
const metrica = (valor: number) => ({ numero: valor, texto: formatearCantidad(valor, 0), formato: "entero" as const });

/** Enlaces viejos (/inventario?bajoMinimo=true, ?activo=false) pasan a ?estado= para que la pastilla activa coincida. */
function rutaConEstado(parametros: Parametros): string | null {
  if (parametros.estado !== undefined) return null;
  const estado = parametros.bajoMinimo === "true" ? "bajo" : parametros.activo === "false" ? "archivados" : null;
  if (!estado) return null;
  const nuevos = new URLSearchParams({ estado });
  for (const [clave, valor] of Object.entries(parametros)) {
    if (typeof valor === "string" && clave !== "activo" && clave !== "bajoMinimo") nuevos.set(clave, valor);
  }
  return `/inventario?${nuevos}`;
}
/** La pastilla de estado vive en ?estado=; el servicio sigue leyendo activo y bajoMinimo. */
function parametrosMateriales(parametros: Parametros): { entrada: Parametros; estado?: string } {
  const estado = parametros.estado === "bajo" || parametros.estado === "archivados" ? parametros.estado : undefined;
  if (!estado) return { entrada: parametros };
  return { entrada: { ...parametros, activo: estado === "archivados" ? "false" : "true", bajoMinimo: estado === "bajo" ? "true" : "false" }, estado };
}
async function Materiales({ parametros, actor }: { parametros: Parametros; actor: Actor }) {
  const { entrada, estado } = parametrosMateriales(parametros);
  const { consulta, error } = consultaPagina(entrada, esquemaConsultaMateriales);
  const lista = await listarMateriales(consulta, actor);
  const { resumen } = lista;
  return <>{error ? <p role="alert">{error}</p> : null}
    <BandejaMetricas className="grid-cols-2 md:grid-cols-3 lg:grid-cols-3 max-md:[&>*:last-child]:col-span-2">
      <TarjetaMetrica etiqueta="Materiales" icono={Boxes} destacada destino="/inventario" {...metrica(resumen.materiales)} />
      <TarjetaMetrica etiqueta="En alerta" icono={TriangleAlert} alerta={resumen.enAlerta > 0} destino="/inventario?estado=bajo" {...metrica(resumen.enAlerta)} />
      <TarjetaMetrica etiqueta="Sin existencia" icono={PackageX} alerta={resumen.sinExistencia > 0} {...metrica(resumen.sinExistencia)} />
    </BandejaMetricas>
    <ProveedorLista>
      <div className="space-y-4">
        <FiltrosMateriales resumen={resumen} />
        <TablaMateriales lista={lista} consulta={{ q: consulta.q, estado, porPagina: consulta.porPagina }} />
      </div>
    </ProveedorLista></>;
}
async function Movimientos({ parametros, actor }: { parametros: Parametros; actor: Actor }) {
  const { consulta, error } = consultaPagina(parametros, esquemaConsultaMovimientos);
  const [lista, opciones] = await Promise.all([listarMovimientos(consulta, actor), opcionesLibro(actor, consulta)]);
  return <>{error ? <p role="alert">{error}</p> : null}
    <ProveedorLista>
      <div className="space-y-4">
        <FiltrosMovimientos opciones={opciones} />
        <TablaMovimientos lista={lista} consulta={consulta} />
      </div>
    </ProveedorLista></>;
}
export default async function PaginaInventario({ searchParams }: { searchParams: Promise<Parametros> }) {
  const actor = await exigirPermisoPagina("inventario:ver");
  const parametros = await searchParams;
  const seleccion = parametros.pestana === "movimientos" ? "movimientos" : "materiales";
  const ruta = seleccion === "materiales" ? rutaConEstado(parametros) : null;
  if (ruta) redirect(ruta);
  return <><PageHeader titulo="Inventario" tituloVisible={false} descripcion="Consulte materiales, existencias y movimientos." acciones={<>
    {seleccion === "materiales" && can(actor, "material:gestionar") ? <Button asChild variant="outline">
      <Link href="/importar?tipo=materiales">Importar CSV</Link></Button> : null}
    {can(actor, "material:gestionar") ? <Button asChild><Link href="/inventario/nuevo">Nuevo material</Link></Button> : null}
    {can(actor, "inventario:entrada") ? <Button asChild variant="outline"><Link href="/inventario/entrada">Registrar entrada</Link></Button> : null}
    {can(actor, "inventario:ajustar") ? <Button asChild variant="outline"><Link href="/inventario/ajuste">Ajustar</Link></Button> : null}</>} />
    <PestanasInventario seleccion={seleccion}>{seleccion === "materiales"
      ? <Materiales parametros={parametros} actor={actor} /> : <Movimientos parametros={parametros} actor={actor} />}</PestanasInventario></>;
}
