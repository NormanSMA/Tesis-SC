import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { CabeceraFicha, MarcaIcono } from "@/components/comunes/CabeceraFicha";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { AppError } from "@/lib/errores";
import { CadenaTrabajo } from "@/modules/trazabilidad/componentes/CadenaTrabajo";
import { DetalleTrabajo } from "@/modules/trazabilidad/componentes/DetalleTrabajo";
import { leerId } from "@/modules/trazabilidad/schema";
import { obtenerTrazabilidad } from "@/modules/trazabilidad/service";

export const metadata: Metadata = { title: "Trazabilidad completa" };
export default async function PaginaTrabajo({ params }: { params: Promise<{ id: string }> }) {
  const actor = await exigirPermisoPagina("orden:ver");
  const trazabilidad = await obtenerTrazabilidad(leerId((await params).id), actor).catch((error: unknown) => {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  });
  return <><CabeceraFicha titulo={`Trazabilidad completa: ${trazabilidad.cadena.orden.numero}`}
    marca={<MarcaIcono><ClipboardList /></MarcaIcono>} volver={{ href: "/trazabilidad", etiqueta: "Trazabilidad" }}
    meta={<span>Consulte la cadena vinculada, los materiales y todos los eventos del trabajo.</span>} />
    <div className="min-w-0 space-y-6"><CadenaTrabajo cadena={trazabilidad.cadena} /><DetalleTrabajo trazabilidad={trazabilidad} /></div></>;
}
