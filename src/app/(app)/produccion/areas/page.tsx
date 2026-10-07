import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { AdministracionAreas } from "@/modules/produccion/componentes/AdministracionAreas";
import { listarAreas } from "@/modules/produccion/service";

export const metadata: Metadata = { title: "Áreas de producción" };

export default async function PaginaAreas() {
  const actor = await exigirPermisoPagina("produccion:ver");
  const areas = await listarAreas(actor);
  return <><PageHeader titulo="Áreas de producción" descripcion="Consulte las áreas activas y archivadas." acciones={<>
    <Button asChild variant="outline"><Link href="/produccion">Ver tablero</Link></Button>
    <Button asChild variant="outline"><Link href="/produccion/plantillas">Ver plantillas</Link></Button></>} />
    <AdministracionAreas key={areas.map((area) => area.actualizadoEn).join("|")} areas={areas}
      gestionar={can(actor, "catalogo:gestionar")} />
  </>;
}
