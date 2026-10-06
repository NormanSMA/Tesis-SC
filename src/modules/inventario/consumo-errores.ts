import { AppError } from "@/lib/errores";
import type { OperacionLibro } from "./consumo-calculo";

export type TipoErrorLinea = "inexistente" | "archivado" | "insuficiente" | "excede";

// limite: disponible (consumo) o máximo devolvible (devolución), exacto con 3 decimales.
export type ErrorLinea = { indice: number; tipo: TipoErrorLinea; campo: string; mensaje: string; limite?: string };

// Orden de prioridad del código cuando hay errores de varios tipos; los campos llevan todos.
const CODIGO_POR_TIPO: { tipo: TipoErrorLinea; codigo: string; status: number }[] = [
  { tipo: "inexistente", codigo: "VALIDACION", status: 422 },
  { tipo: "archivado", codigo: "MATERIAL_ARCHIVADO", status: 409 },
  { tipo: "insuficiente", codigo: "EXISTENCIA_INSUFICIENTE", status: 409 },
  { tipo: "excede", codigo: "DEVOLUCION_EXCEDE_CONSUMO", status: 409 },
];

export function errorDeLineas(errores: ErrorLinea[]): AppError | null {
  const principal = CODIGO_POR_TIPO.find(({ tipo }) => errores.some((error) => error.tipo === tipo));
  if (!principal) return null;
  const campos = Object.fromEntries(errores.map((error) => [error.campo, error.mensaje]));
  const mensaje = principal.status === 422 ? "Hay campos con errores."
    : errores.filter((error) => error.tipo === principal.tipo).map((error) => error.mensaje).join(" ");
  return new AppError({ codigo: principal.codigo, status: principal.status, mensaje, campos });
}

const ESTADO_LEGIBLE: Record<string, string> = {
  PENDIENTE: "pendiente", EN_PRODUCCION: "en producción", LISTA: "lista", ENTREGADA: "entregada",
  CERRADA: "cerrada", CANCELADA: "cancelada",
};

export function ordenNoAdmite(operacion: OperacionLibro, estado: string): AppError {
  const accion = operacion === "consumo" ? "consumos" : "devoluciones";
  return new AppError({ codigo: "ORDEN_NO_ADMITE_CONSUMO", status: 409,
    mensaje: `La orden está ${ESTADO_LEGIBLE[estado] ?? estado} y no admite ${accion} de material.` });
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

// Misma lectura que src/lib/errores.ts: el SQLSTATE viaja en la causa del adaptador, no en error.code.
function leerCausa(error: unknown): { codigo: string; mensaje: string } | null {
  if (!esObjeto(error)) return null;
  const causa = esObjeto(error.meta) && esObjeto(error.meta.driverAdapterError) ? error.meta.driverAdapterError.cause
    : error.name === "DriverAdapterError" ? error.cause : undefined;
  if (!esObjeto(causa) || typeof causa.originalCode !== "string") return null;
  return { codigo: causa.originalCode, mensaje: typeof causa.originalMessage === "string" ? causa.originalMessage : "" };
}

const RESTRICCIONES_SALDO = ["material_existencia_no_negativa", "movimiento_valores_no_negativos"];

/**
 * Respaldo: la validación bajo bloqueo ya da el error exacto, pero si la base dispara su CHECK de saldo
 * o SC005 se responde con el código del módulo y no con el genérico VALOR_FUERA_DE_RANGO.
 */
export function traducirErrorLibro(error: unknown, operacion: OperacionLibro): unknown {
  if (error instanceof AppError) return error;
  const causa = leerCausa(error);
  if (!causa) return error;
  const restriccion = /constraint "([^"]+)"/.exec(causa.mensaje)?.[1] ?? "";
  if (causa.codigo === "23514" && RESTRICCIONES_SALDO.includes(restriccion)) {
    return new AppError({ codigo: "EXISTENCIA_INSUFICIENTE", status: 409,
      mensaje: "La existencia del material no alcanza para la operación. Recargue los datos y vuelva a intentar." });
  }
  if (causa.codigo === "SC005" && operacion === "devolucion") {
    return new AppError({ codigo: "DEVOLUCION_EXCEDE_CONSUMO", status: 409,
      mensaje: "La devolución supera lo consumido por la orden. Recargue los datos y vuelva a intentar." });
  }
  // El orden fijo de bloqueos evita el interbloqueo; si aun así ocurre, la solicitud completa se revirtió y es segura de repetir.
  if (causa.codigo === "40P01" || causa.codigo === "40001") {
    return new AppError({ codigo: "CONFLICTO_CONCURRENCIA", status: 409,
      mensaje: "Otra operación coincidió con esta. No se registró nada: vuelva a intentar." });
  }
  return error;
}
