import { aDecimal, comparar, sumar } from "./calculos";
import { registrar } from "./bitacora";
import type { DatosSiembra } from "./cargar-datos";
import { AJUSTES_COMPLEMENTARIOS, DEVOLUCIONES_COMPLEMENTARIAS } from "./inventario-complementario";
import { instante, desplazarMinutos } from "./fechas";
import type { OrdenSembrada } from "./ordenes";
import { usuarioPorClave, type Contexto } from "./tipos";

export type TipoMovimiento = "ENTRADA" | "CONSUMO" | "DEVOLUCION" | "AJUSTE";

export type OperacionLibro = {
  instante: Date;
  tipo: TipoMovimiento;
  materialCodigo: string;
  // Con signo: negativa para consumos y ajustes de salida.
  cantidad: string;
  costoUnitario: string | null;
  usuarioId: string;
  referencia: string | null;
  motivo: string | null;
  orden: { id: string; numero: string } | null;
};

const ACCION_POR_TIPO = {
  ENTRADA: "REGISTRAR_ENTRADA",
  CONSUMO: "CONSUMIR_MATERIAL",
  DEVOLUCION: "DEVOLVER_MATERIAL",
  AJUSTE: "AJUSTAR_INVENTARIO",
} as const;

export type EntradaLibro = { datos: DatosSiembra; contexto: Contexto; ordenes: Map<string, OrdenSembrada> };

function existenciaInicial({ datos, contexto }: EntradaLibro): OperacionLibro[] {
  const masAntiguo = Math.max(60, ...datos.entradas.map((e) => e.diasAtras));
  const jefe = usuarioPorClave(contexto.catalogos, "jefe-prod").id;
  return datos.materiales
    .filter((m) => m.existenciaInicial > 0)
    .map((m) => ({
      instante: instante(contexto.reloj, masAntiguo, 7),
      tipo: "ENTRADA",
      materialCodigo: m.codigo,
      cantidad: aDecimal(m.existenciaInicial, 3),
      costoUnitario: aDecimal(m.costoUnitario, 4),
      usuarioId: jefe,
      referencia: "EXISTENCIA-INICIAL",
      motivo: "Existencia inicial al implantar el sistema.",
      orden: null,
    }));
}

function entradasDeCompra({ datos, contexto }: EntradaLibro): OperacionLibro[] {
  const jefe = usuarioPorClave(contexto.catalogos, "jefe-prod").id;
  return datos.entradas.map((e) => ({
    instante: instante(contexto.reloj, e.diasAtras, 10),
    tipo: "ENTRADA",
    materialCodigo: e.material,
    cantidad: aDecimal(e.cantidad, 3),
    costoUnitario: aDecimal(e.costoUnitario, 4),
    usuarioId: jefe,
    referencia: e.referencia,
    motivo: null,
    orden: null,
  }));
}

function consumosDeOrdenes({ contexto, ordenes }: EntradaLibro): OperacionLibro[] {
  return [...ordenes.values()].flatMap((orden) =>
    (orden.cotizacion.escenario.orden?.consumos ?? []).map((c) => {
      const cuando = instante(contexto.reloj, c.diasAtras, 14);
      if (cuando < orden.plan.creadaEn) {
        throw new Error(`${orden.cotizacion.escenario.clave}: consume ${c.material} antes de crear la orden`);
      }
      return {
        instante: cuando,
        tipo: "CONSUMO" as const,
        materialCodigo: c.material,
        cantidad: `-${aDecimal(c.cantidad, 3)}`,
        costoUnitario: null,
        usuarioId: orden.responsableId,
        referencia: orden.numero,
        motivo: null,
        orden: { id: orden.id, numero: orden.numero },
      };
    }),
  );
}

// Una orden cancelada devuelve a bodega lo que consumió.
function devolucionesPorCancelacion(consumos: OperacionLibro[], { contexto, ordenes }: EntradaLibro): OperacionLibro[] {
  return [...ordenes.values()]
    .filter((orden) => orden.plan.canceladaEn)
    .flatMap((orden) => {
      const propios = consumos.filter((c) => c.orden?.id === orden.id);
      const materiales = [...new Set(propios.map((c) => c.materialCodigo))];
      return materiales.map((codigo) => ({
        instante: desplazarMinutos(contexto.reloj, orden.plan.canceladaEn as Date, 1),
        tipo: "DEVOLUCION" as const,
        materialCodigo: codigo,
        cantidad: sumar(propios.filter((c) => c.materialCodigo === codigo).map((c) => c.cantidad.slice(1)), 3),
        costoUnitario: null,
        usuarioId: orden.responsableId,
        referencia: orden.numero,
        motivo: "Devolución del sobrante por cancelación de la orden.",
        orden: { id: orden.id, numero: orden.numero },
      }));
    });
}

function devolucionesComplementarias({ contexto, ordenes }: EntradaLibro): OperacionLibro[] {
  return DEVOLUCIONES_COMPLEMENTARIAS.map((d) => {
    const orden = [...ordenes.values()].find((o) => o.cotizacion.escenario.clave === d.escenario);
    if (!orden) throw new Error(`Devolución complementaria sin orden: ${d.escenario}`);
    return {
      instante: instante(contexto.reloj, d.diasAtras, d.hora),
      tipo: "DEVOLUCION" as const,
      materialCodigo: d.material,
      cantidad: aDecimal(d.cantidad, 3),
      costoUnitario: null,
      usuarioId: orden.responsableId,
      referencia: orden.numero,
      motivo: "Devolución del sobrante a bodega.",
      orden: { id: orden.id, numero: orden.numero },
    };
  });
}

function ajustesComplementarios({ contexto }: EntradaLibro): OperacionLibro[] {
  const gerencia = usuarioPorClave(contexto.catalogos, "gerente").id;
  return AJUSTES_COMPLEMENTARIOS.map((a) => ({
    instante: instante(contexto.reloj, a.diasAtras, 16),
    tipo: "AJUSTE" as const,
    materialCodigo: a.material,
    cantidad: aDecimal(a.cantidad, 3),
    costoUnitario: null,
    usuarioId: gerencia,
    referencia: null,
    motivo: a.motivo,
    orden: null,
  }));
}

// Verifica con aritmética exacta que el libro no deje ningún material en negativo y que lo devuelto
// no supere lo consumido. Así un dato incoherente falla con un mensaje claro y no con un error de la base.
function validarLibro(operaciones: OperacionLibro[]): void {
  const saldos = new Map<string, string>();
  const netos = new Map<string, string>();
  for (const op of operaciones) {
    const saldo = sumar([saldos.get(op.materialCodigo) ?? "0", op.cantidad], 3);
    if (comparar(saldo, 0) < 0) {
      throw new Error(`El material ${op.materialCodigo} queda con existencia negativa (${saldo}) el ${op.instante.toISOString()}`);
    }
    saldos.set(op.materialCodigo, saldo);
    if (op.orden) {
      const clave = `${op.orden.id}|${op.materialCodigo}`;
      const neto = sumar([netos.get(clave) ?? "0", op.cantidad], 3);
      if (comparar(neto, 0) > 0) throw new Error(`La orden ${op.orden.numero} devuelve más ${op.materialCodigo} del que consumió`);
      netos.set(clave, neto);
    }
  }
}

// Orden cronológico global: el costo promedio ponderado evoluciona igual que en producción.
export function planificarLibro(entrada: EntradaLibro): OperacionLibro[] {
  const consumos = consumosDeOrdenes(entrada);
  const operaciones = [
    ...existenciaInicial(entrada),
    ...entradasDeCompra(entrada),
    ...consumos,
    ...devolucionesPorCancelacion(consumos, entrada),
    ...devolucionesComplementarias(entrada),
    ...ajustesComplementarios(entrada),
  ].sort((a, b) => a.instante.getTime() - b.instante.getTime());
  validarLibro(operaciones);
  return operaciones;
}

async function insertarOperacion(ctx: Contexto, operacion: OperacionLibro): Promise<void> {
  const material = ctx.catalogos.materiales.get(operacion.materialCodigo);
  if (!material) throw new Error(`Material inexistente en el libro: ${operacion.materialCodigo}`);
  const movimiento = await ctx.db.movimientoInventario.create({
    data: {
      materialId: material.id,
      tipo: operacion.tipo,
      cantidad: operacion.cantidad,
      costoUnitario: operacion.costoUnitario ?? "0",
      motivo: operacion.motivo,
      referencia: operacion.referencia,
      usuarioId: operacion.usuarioId,
      creadoEn: operacion.instante,
    },
  });
  // El constraint trigger diferido exige este enlace antes del COMMIT.
  if (operacion.orden) {
    await ctx.db.consumoOrden.create({
      data: { ordenId: operacion.orden.id, materialId: material.id, movimientoId: movimiento.id },
    });
  }
  registrar(ctx.bitacora, {
    entidad: "MOVIMIENTO_INVENTARIO",
    entidadId: movimiento.id,
    ordenId: operacion.orden?.id,
    accion: ACCION_POR_TIPO[operacion.tipo],
    usuarioId: operacion.usuarioId,
    creadoEn: operacion.instante,
    detalle: {
      material: material.codigo,
      cantidad: movimiento.cantidad.toString(),
      costoUnitario: movimiento.costoUnitario.toString(),
      existenciaResultante: movimiento.existenciaResultante.toString(),
      referencia: operacion.referencia,
      motivo: operacion.motivo,
    },
  });
}

// Un INSERT por movimiento y en orden: el trigger toma el bloqueo del material y recalcula el saldo en cada uno.
export async function ejecutarLibro(ctx: Contexto, operaciones: OperacionLibro[]): Promise<void> {
  for (const operacion of operaciones) await insertarOperacion(ctx, operacion);
}
