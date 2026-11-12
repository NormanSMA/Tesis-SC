import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/comunes/PageHeader";
import { obtenerSesion } from "@/lib/auth/sesion";
import { FilaConfiguracion } from "@/modules/admin/componentes/FilaConfiguracion";
import { TarifasMateriales } from "@/modules/admin/componentes/TarifasMateriales";
import { listarConfiguracion } from "@/modules/admin/configuracion-service";
import { puedeGestionarTarifas } from "@/modules/admin/tarifas-configuracion";

export const metadata: Metadata = { title: "Tarifas" };

export default async function PaginaTarifas() {
  const actor = await obtenerSesion();
  if (!actor) redirect("/login");
  if (actor.debeCambiarClave) redirect("/cambiar-clave");
  if (!puedeGestionarTarifas(actor)) redirect("/sin-acceso");
  const filas = await listarConfiguracion(actor);
  const instalacion = filas.find(({ clave }) => clave === "tarifa_instalacion_km");
  return <div className="max-w-5xl space-y-5">
    <PageHeader titulo="Tarifas" descripcion="Precios y descuentos vigentes para las nuevas cotizaciones." />
    <section aria-labelledby="tarifas-comerciales" className="divide-y rounded-xl border bg-card">
      <h2 id="tarifas-comerciales" className="p-5 font-semibold">Tarifas comerciales</h2>
      {filas.filter(({ clave }) => clave.startsWith("tarifa_") && clave !== "tarifa_instalacion_km").map((fila) =>
        <FilaConfiguracion key={fila.clave} inicial={fila} />)}
    </section>
    {instalacion ? <section aria-labelledby="tarifa-instalacion" className="divide-y rounded-xl border bg-card">
      <h2 id="tarifa-instalacion" className="p-5 font-semibold">Traslado para instalaciones</h2>
      <FilaConfiguracion inicial={instalacion} />
    </section> : null}
    <TarifasMateriales filas={filas.filter(({ clave }) => clave.startsWith("material:"))} />
  </div>;
}
