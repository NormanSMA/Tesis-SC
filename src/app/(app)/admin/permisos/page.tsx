import type { Metadata } from "next";

import { PageHeader } from "@/components/comunes/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { exigirPermisoPagina } from "@/lib/auth/guardia";
import { MatrizPermisos } from "@/modules/admin/componentes/MatrizPermisos";
import { PermisosIndividuales } from "@/modules/admin/componentes/PermisosIndividuales";
import { listarPermisos } from "@/modules/admin/permisos-service";
import { listarAccesosIndividuales } from "@/modules/admin/permisos-usuario";

export const metadata: Metadata = { title: "Perfiles y permisos" };

const LISTA_PESTANAS = "h-auto w-full flex-wrap justify-start group-data-[orientation=horizontal]/tabs:h-auto";
const PESTANA = "h-10 min-h-10 flex-none px-4";

// Dos vistas separadas: la matriz por perfil y las funciones adicionales de cada persona no compiten en pantalla.
export default async function Pagina() {
  const actor = await exigirPermisoPagina("permiso:gestionar");
  const [datos, usuarios] = await Promise.all([listarPermisos(actor), listarAccesosIndividuales(actor)]);
  const catalogo = datos.permisos.flatMap(g => g.permisos.map(p => ({ permiso: p.codigo, descripcion: p.descripcion })));
  return (
    <div className="w-full min-w-0 max-w-full">
      <PageHeader titulo="Perfiles y permisos" tituloVisible={false} descripcion="Asigne permisos por perfil y funciones adicionales por usuario. Revise los cambios antes de guardar." />
      <Tabs defaultValue="perfiles">
        <TabsList variant="line" className={LISTA_PESTANAS} aria-label="Tipo de permisos">
          <TabsTrigger value="perfiles" className={PESTANA}>Permisos por perfil</TabsTrigger>
          <TabsTrigger value="usuarios" className={PESTANA}>Permisos por usuario</TabsTrigger>
        </TabsList>
        <TabsContent value="perfiles" className="pt-4"><MatrizPermisos datos={datos} /></TabsContent>
        <TabsContent value="usuarios" className="pt-4"><PermisosIndividuales usuarios={usuarios} catalogo={catalogo} /></TabsContent>
      </Tabs>
    </div>
  );
}
