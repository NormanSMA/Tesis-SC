import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { ProveedorLista } from "@/lib/listas/contexto-lista";
import { AdministracionAreas } from "@/modules/produccion/componentes/AdministracionAreas";
import { filtrarCatalogo } from "@/modules/produccion/componentes/filtrarCatalogo";
import { listarAreas } from "@/modules/produccion/service";

export const metadata: Metadata = { title: "Áreas de producción" };

type Parametros = Record<string, string | string[] | undefined>;

export default async function PaginaAreas({ searchParams }: { searchParams: Promise<Parametros> }) {
  const actor = await exigirPermisoPagina("produccion:ver");
  const [areas, parametros] = await Promise.all([listarAreas(actor), searchParams]);
  const { filtradas, conteos } = filtrarCatalogo(areas, parametros, (area) => area.nombre);
  return <><PageHeader titulo="Áreas de producción" tituloVisible={false} descripcion="Consulte las áreas activas y archivadas." acciones={<>
    <Button asChild variant="outline"><Link href="/produccion">Ver tablero</Link></Button>
    <Button asChild variant="outline"><Link href="/produccion/plantillas">Ver plantillas</Link></Button></>} />
    <ProveedorLista>
      <AdministracionAreas key={areas.map((area) => area.actualizadoEn).join("|")} areas={filtradas} conteos={conteos}
        gestionar={can(actor, "catalogo:gestionar")} />
    </ProveedorLista>
  </>;
}
