import { esquemaTarifasProducto } from "./gastos-schema";
import { z } from "zod";
const nombre = z.string().trim().min(1).max(80);
export const esquemaTipo = z.object({ id: z.uuid(), nombre, unidadCobro: z.enum(["UNIDAD", "M2"]),
  tarifas: esquemaTarifasProducto.optional(), margenPct: z.string().regex(/^\d{1,2}(\.\d{1,2})?$/), materiales: z.array(z.uuid()).max(100) });
export const esquemaCategorias = z.array(z.object({ id: z.uuid(), nombre, tipos: z.array(esquemaTipo).max(50) })).max(30)
  .superRefine((categorias, ctx) => {
    const ids = new Set<string>(); const nombres = new Set<string>();
    for (const [i,c] of categorias.entries()) {
      const clave = c.nombre.toLocaleLowerCase("es");
      if (nombres.has(clave)) ctx.addIssue({ code: "custom", path: [i,"nombre"], message: "Categoría repetida." });
      nombres.add(clave);
      const tipos = new Set<string>();
      for (const [j,t] of c.tipos.entries()) {
        if (ids.has(t.id) || tipos.has(t.nombre.toLocaleLowerCase("es"))) ctx.addIssue({ code: "custom", path: [i,"tipos",j], message: "Tipo repetido." });
        ids.add(t.id); tipos.add(t.nombre.toLocaleLowerCase("es"));
        if (new Set(t.materiales).size !== t.materiales.length) ctx.addIssue({ code: "custom", path: [i,"tipos",j,"materiales"], message: "Material repetido." });
      }
    }
  });
export const esquemaGuardar = z.object({ version: z.iso.datetime({ offset: true }).nullable(), categorias: esquemaCategorias });
export type CategoriaPersonalizada = z.infer<typeof esquemaCategorias>[number];
export type TipoPersonalizado = z.infer<typeof esquemaTipo>;
export type RegistroPersonalizadas = { categorias: CategoriaPersonalizada[]; version: string | null };
