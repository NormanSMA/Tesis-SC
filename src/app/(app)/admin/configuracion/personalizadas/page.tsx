import { PageHeader } from "@/components/comunes/PageHeader";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { prisma } from "@/lib/db";
import { leerPersonalizadas } from "@/modules/personalizadas/service";
import { ConfigurarPersonalizadas } from "@/modules/personalizadas/ConfigurarPersonalizadas";
export const metadata = { title: "Cotizaciones personalizadas" };
export default async function Pagina() {
  await exigirPermisoPagina("tarifa:gestionar");
  const [inicial, materiales] = await Promise.all([leerPersonalizadas(), prisma.material.findMany({ where: { activo: true },
    select: { id: true, nombre: true, codigo: true }, orderBy: { nombre: "asc" } })]);
  return <div className="max-w-5xl"><PageHeader titulo="Cotizaciones personalizadas" descripcion="Categorías, tipos de producto y materiales habituales." />
    <ConfigurarPersonalizadas inicial={inicial} materiales={materiales} /></div>;
}
