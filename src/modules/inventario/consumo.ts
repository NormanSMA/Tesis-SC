// Consumo y devolución de materiales por orden (docs/modulos/05-inventario.md, uso 2b: concurrencia).
import { can, exigir, type Actor } from "@/core/autorizacion";
import { registrarEvento } from "@/lib/bitacora";
import { prisma, type Tx } from "@/lib/db";
import { bloquearMateriales, bloquearOrden, leerNetos } from "./consumo-bloqueo";
import { admiteOperacion, cantidadConSigno, normalizarLineas, type LineaNormalizada, type OperacionLibro } from "./consumo-calculo";
import { ordenNoAdmite, traducirErrorLibro } from "./consumo-errores";
import { exigirLineasValidas, type MaterialBloqueado } from "./consumo-validacion";
import type { EntradaMovimientosOrden, MovimientoOrdenDto, RespuestaMovimientosOrden } from "./contrato-orden";
import { ejecutarIdempotente } from "./idempotencia";
import { aMovimientoOrdenDto } from "./movimientos-orden-dto";
import { leerResumenMateriales } from "./resumen-orden";

export type SolicitudMovimientosOrden = {
  ordenId: string;
  entrada: EntradaMovimientosOrden;
  clave: string;
  actor: Actor;
};

type Aplicacion = { ordenId: string; actor: Actor; operacion: OperacionLibro; lineas: LineaNormalizada[] };
type Insercion = { aplicacion: Aplicacion; linea: LineaNormalizada; material: MaterialBloqueado };

export function registrarConsumo(solicitud: SolicitudMovimientosOrden): Promise<RespuestaMovimientosOrden> {
  return registrar(solicitud, "consumo");
}

export function registrarDevolucion(solicitud: SolicitudMovimientosOrden): Promise<RespuestaMovimientosOrden> {
  return registrar(solicitud, "devolucion");
}

async function registrar(solicitud: SolicitudMovimientosOrden, operacion: OperacionLibro): Promise<RespuestaMovimientosOrden> {
  const { actor, ordenId, clave } = solicitud;
  exigir(actor, "inventario:consumir");
  const lineas = normalizarLineas(solicitud.entrada);
  // La huella usa las líneas normalizadas: "2" y "2.000", o las mismas líneas en otro orden, son la misma solicitud.
  const cuerpo = { ordenId, lineas: lineas.map(({ materialId, cantidad }) => ({ materialId, cantidad })) };
  try {
    return await prisma.$transaction(async (tx) => {
      const { resultado, repetida } = await ejecutarIdempotente(tx, { clave, usuarioId: actor.id, operacion, cuerpo },
        () => aplicar(tx, { ordenId, actor, operacion, lineas }));
      return { ...resultado, repetida };
    });
  } catch (error) {
    throw traducirErrorLibro(error, operacion);
  }
}

async function aplicar(tx: Tx, aplicacion: Aplicacion): Promise<RespuestaMovimientosOrden> {
  const { ordenId, operacion, lineas } = aplicacion;
  const estado = await bloquearOrden(tx, ordenId);
  if (!admiteOperacion(operacion, estado)) throw ordenNoAdmite(operacion, estado);
  const materiales = await bloquearMateriales(tx, lineas);
  const materialIds = lineas.map((linea) => linea.materialId);
  const netos = operacion === "devolucion" ? await leerNetos(tx, ordenId, materialIds) : new Map<string, string>();
  exigirLineasValidas({ operacion, lineas, materiales, netos });
  const movimientos: MovimientoOrdenDto[] = [];
  // Mismo orden ascendente que los bloqueos.
  for (const linea of lineas) {
    movimientos.push(await insertarMovimiento(tx, { aplicacion, linea, material: materiales.get(linea.materialId)! }));
  }
  return { movimientos, resumen: await leerResumenMateriales(tx, ordenId, materialIds), repetida: false };
}

async function insertarMovimiento(tx: Tx, { aplicacion, linea, material }: Insercion): Promise<MovimientoOrdenDto> {
  const { ordenId, actor, operacion } = aplicacion;
  // Sin costo: la base lo fija al costo promedio vigente (SD-20).
  const movimiento = await tx.movimientoInventario.create({ data: {
    materialId: linea.materialId, tipo: operacion === "consumo" ? "CONSUMO" : "DEVOLUCION",
    cantidad: cantidadConSigno(operacion, linea.cantidad), usuarioId: actor.id,
  } });
  // El trigger diferido SC005 exige este enlace antes del COMMIT.
  await tx.consumoOrden.create({ data: { ordenId, materialId: linea.materialId, movimientoId: movimiento.id } });
  await registrarEvento(tx, { entidad: "MOVIMIENTO_INVENTARIO", entidadId: movimiento.id, ordenId, actorId: actor.id,
    accion: operacion === "consumo" ? "CONSUMIR_MATERIAL" : "DEVOLVER_MATERIAL",
    detalle: { materialId: linea.materialId, cantidad: linea.cantidad, costoUnitario: movimiento.costoUnitario.toFixed(4),
      existenciaResultante: movimiento.existenciaResultante.toFixed(3) } });
  return aMovimientoOrdenDto({ ...movimiento, usuario: { nombre: actor.nombre },
    material: { id: material.id, codigo: material.codigo, nombre: material.nombre, unidad: material.unidad } },
  can(actor, "cotizacion:ver"));
}
