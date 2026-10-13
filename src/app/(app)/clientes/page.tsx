import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { PageHeader } from "@/components/comunes/PageHeader";
import { Button } from "@/components/ui/button";
import { can } from "@/core/autorizacion";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { FiltrosClientes } from "@/modules/clientes/componentes/FiltrosClientes";
import { TablaClientes } from "@/modules/clientes/componentes/TablaClientes";
import { esquemaConsultaClientes, objetoDeParametros } from "@/modules/clientes/schema";
import { listarClientes } from "@/modules/clientes/service";

export const metadata: Metadata = { title: "Clientes" };

type PropiedadesPagina = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Un parámetro inválido en la URL no debe romper la pantalla: se vuelve a la consulta por defecto.
function leerConsulta(parametros: Record<string, string | string[] | undefined>) {
  const lectura = esquemaConsultaClientes.safeParse(objetoDeParametros(parametros));
  return lectura.success ? lectura.data : esquemaConsultaClientes.parse({});
}

export default async function PaginaClientes({ searchParams }: PropiedadesPagina) {
  const actor = await exigirPermisoPagina("cliente:ver");
  const consulta = leerConsulta(await searchParams);
  const lista = await listarClientes(consulta, actor);
  const puedeGestionar = can(actor, "cliente:gestionar");
  return (
    <>
      <PageHeader
        titulo="Clientes"
        descripcion="Personas y empresas que solicitan trabajos."
        acciones={
          puedeGestionar ? (
            <>
            <Button asChild variant="outline"><Link href="/importar?tipo=clientes">Importar CSV</Link></Button>
            <Button asChild>
              <Link href="/clientes/nuevo">
                <Plus aria-hidden="true" />
                Nuevo cliente
              </Link>
            </Button>
            </>
          ) : null
        }
      />
      <FiltrosClientes consulta={consulta} />
      <TablaClientes
        lista={lista}
        consulta={consulta}
        puedeGestionar={puedeGestionar}
        conCotizaciones={can(actor, "cotizacion:ver")}
      />
    </>
  );
}
