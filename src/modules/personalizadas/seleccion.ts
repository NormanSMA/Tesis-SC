import type { EntradaItem } from "@/modules/cotizaciones/schema";
import type { SelectoresEditor } from "@/modules/cotizaciones/tipos";
import type { TipoPersonalizado } from "./schema";
import { gastosIniciales } from "./gastos-schema";

type Personalizado = Extract<EntradaItem, { tipo: "PERSONALIZADO" }>;
export function aplicarProducto(entrada: { tipo: TipoPersonalizado; item: Personalizado; selectores: SelectoresEditor; moneda: string }): Personalizado {
  const { tipo, item, selectores, moneda } = entrada;
  const sugeridos = new Set(tipo.materiales);
  const anteriores = new Set(item.productoPersonalizado?.materiales ?? []);
  const conservadas = item.lineas.filter(l => l.tipo !== "MATERIAL" || !anteriores.has(l.materialId ?? "") || sugeridos.has(l.materialId ?? ""));
  const presentes = new Set(conservadas.filter(l => l.tipo === "MATERIAL").map(l => l.materialId));
  const nuevas = selectores.materiales.filter(m => sugeridos.has(m.id) && !presentes.has(m.id)).map(m => ({
    tipo: "MATERIAL" as const, materialId: m.id, descripcion: m.nombre, unidad: m.unidadCotizacion ?? m.unidad,
    cantidad: "1", costoUnitario: m.precioCotizacion ?? m.costoPromedio, mermaPct: "0",
  }));
  const t = tipo.tarifas;
  const gastos = t && t.moneda === moneda && !item.gastosPersonalizados ? { ...gastosIniciales(moneda), rentaValor: t.renta,
    tarifaHora: t.hora, tarifaViatico: t.viatico, tarifaHospedaje: t.hospedaje } : item.gastosPersonalizados;
  return { ...item, productoPersonalizado: { id: tipo.id, nombre: tipo.nombre, materiales: tipo.materiales },
    descripcion: !item.descripcion.trim() || item.descripcion === item.productoPersonalizado?.nombre ? tipo.nombre : item.descripcion,
    unidadCobro: tipo.unidadCobro, margenPct: tipo.margenPct, lineas: [...conservadas, ...nuevas],
    ...(gastos ? { gastosPersonalizados: gastos } : {}) };
}
