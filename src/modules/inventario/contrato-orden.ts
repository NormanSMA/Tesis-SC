// Contrato compartido del consumo y la devolución por orden (docs/modulos/05-inventario.md).
// El servicio lo implementa (consumo.ts, resumen-orden.ts) y la interfaz lo consume por la API REST.
import { z } from "zod";

const cantidad = z.string({ error: "Ingrese la cantidad como cadena decimal." })
  .regex(/^\d{1,11}(\.\d{1,3})?$/, "Ingrese una cantidad positiva con hasta 3 decimales.")
  .refine((valor) => Number(valor) > 0, "La cantidad debe ser mayor que cero.");

export const esquemaMovimientosOrden = z.strictObject({
  lineas: z.array(z.strictObject({
    materialId: z.uuid({ error: "Seleccione un material válido." }),
    cantidad,
  })).min(1, "Agregue al menos una línea.").max(50, "Admite hasta 50 líneas por solicitud."),
}).superRefine((entrada, contexto) => {
  const vistos = new Set<string>();
  entrada.lineas.forEach((linea, indice) => {
    if (vistos.has(linea.materialId)) {
      contexto.addIssue({ code: "custom", path: ["lineas", indice, "materialId"], message: "El material está repetido." });
    }
    vistos.add(linea.materialId);
  });
});

export type EntradaMovimientosOrden = z.output<typeof esquemaMovimientosOrden>;

export type MaterialResumenDto = { id: string; codigo: string; nombre: string; unidad: string };

// Cantidades siempre positivas; el tipo indica la dirección. Los costos solo viajan con cotizacion:ver.
export type MovimientoOrdenDto = {
  id: string;
  tipo: "CONSUMO" | "DEVOLUCION";
  material: MaterialResumenDto;
  cantidad: string;
  existenciaResultante: string;
  usuario: string;
  creadoEn: string;
  costoUnitario?: string;
  costoPromedioResultante?: string;
};

export type ResumenMaterialOrden = {
  material: MaterialResumenDto;
  estimado: string;
  consumido: string;
  devuelto: string;
  neto: string;
  existencia: string;
  excedeEstimado: boolean;
};

export type RespuestaMovimientosOrden = {
  movimientos: MovimientoOrdenDto[];
  resumen: ResumenMaterialOrden[];
  repetida: boolean;
};

export type ResumenOrdenInventario = {
  ordenId: string;
  estadoOrden: string;
  admiteConsumo: boolean;
  admiteDevolucion: boolean;
  materiales: ResumenMaterialOrden[];
  movimientos: MovimientoOrdenDto[];
};
