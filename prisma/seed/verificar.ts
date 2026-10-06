import { Prisma, type PrismaClient } from "../../src/generated/prisma/client";
import { crearCliente } from "../../src/lib/db";
import { cargarDatos, type DatosSiembra } from "./cargar-datos";
import { CLAVE_MARCADOR, VERSION_SIEMBRA } from "./catalogos";
import { cargarArchivosDeEntorno } from "./entorno";
import { AJUSTES_COMPLEMENTARIOS, DEVOLUCIONES_COMPLEMENTARIAS } from "./inventario-complementario";
import { escribir, tabla } from "./salida";

export type Comprobacion = { nombre: string; esperado: string; obtenido: string; ok: boolean };
export type ResultadoVerificacion = { comprobaciones: Comprobacion[]; resumen: string[]; ok: boolean };

type Lector = Pick<PrismaClient, "$queryRaw">;

const ESTADOS_COTIZACION = ["BORRADOR", "ENVIADA", "APROBADA", "RECHAZADA", "VENCIDA"];
const ESTADOS_ORDEN = ["PENDIENTE", "EN_PRODUCCION", "LISTA", "ENTREGADA", "CERRADA", "CANCELADA"];

async function numero(db: Lector, consulta: Prisma.Sql): Promise<number> {
  const filas = await db.$queryRaw<{ valor: bigint | number | string }[]>(consulta);
  return Number(filas[0].valor);
}

function igual(nombre: string, esperado: number | string, obtenido: number | string): Comprobacion {
  return { nombre, esperado: String(esperado), obtenido: String(obtenido), ok: String(esperado) === String(obtenido) };
}

function minimo(nombre: string, esperado: number, obtenido: number): Comprobacion {
  return { nombre, esperado: `>= ${esperado}`, obtenido: String(obtenido), ok: obtenido >= esperado };
}

// Debe reflejar lo que planifica inventario.ts: existencia inicial, compras, consumos, devoluciones y ajustes.
export function movimientosEsperados(datos: DatosSiembra): number {
  const iniciales = datos.materiales.filter((m) => m.existenciaInicial > 0).length;
  const consumos = datos.escenarios.reduce((suma, e) => suma + (e.orden?.consumos.length ?? 0), 0);
  const devolucionesPorCancelacion = datos.escenarios
    .filter((e) => e.orden?.estadoFinal === "CANCELADA")
    .reduce((suma, e) => suma + new Set(e.orden?.consumos.map((c) => c.material)).size, 0);
  return (
    iniciales +
    datos.entradas.length +
    consumos +
    devolucionesPorCancelacion +
    AJUSTES_COMPLEMENTARIOS.length +
    DEVOLUCIONES_COMPLEMENTARIAS.length
  );
}

async function contarFilas(db: Lector, tabla: string): Promise<number> {
  return numero(db, Prisma.sql`SELECT count(*) AS valor FROM ${Prisma.raw(tabla)}`);
}

async function comprobarConteos(db: Lector, datos: DatosSiembra): Promise<Comprobacion[]> {
  const esperados: [string, string, number][] = [
    ["Clientes", "cliente", datos.clientes.length],
    ["Usuarios", "usuario", datos.usuarios.length],
    ["Materiales", "material", datos.materiales.length],
    ["Productos", "producto", datos.productos.length],
    ["Líneas de receta", "receta_producto", datos.recetas.reduce((suma, r) => suma + r.materiales.length, 0)],
    ["Áreas", "area", datos.areas.length],
    ["Categorías", "categoria", datos.categorias.length],
    ["Etapas de plantilla", "etapa_plantilla", datos.plantillas.reduce((suma, p) => suma + p.etapas.length, 0)],
    ["Cotizaciones", "cotizacion", datos.escenarios.length],
    ["Órdenes de trabajo", "orden_trabajo", datos.escenarios.filter((e) => e.orden).length],
    ["Movimientos de inventario", "movimiento_inventario", movimientosEsperados(datos)],
  ];
  const comprobaciones: Comprobacion[] = [];
  for (const [nombre, tabla, esperado] of esperados) {
    comprobaciones.push(igual(nombre, esperado, await contarFilas(db, tabla)));
  }
  const marcador = await numero(
    db,
    Prisma.sql`SELECT count(*) AS valor FROM configuracion WHERE clave = ${CLAVE_MARCADOR} AND valor = ${VERSION_SIEMBRA}`,
  );
  comprobaciones.push(igual(`Marcador ${CLAVE_MARCADOR} = ${VERSION_SIEMBRA}`, 1, marcador));
  return comprobaciones;
}

async function comprobarInventario(db: Lector): Promise<Comprobacion[]> {
  const descuadrados = Prisma.sql`
    SELECT count(*) AS valor FROM material m
     WHERE m.existencia <> coalesce((SELECT sum(cantidad) FROM movimiento_inventario WHERE material_id = m.id), 0)`;
  const sinSaldoFinal = Prisma.sql`
    SELECT count(*) AS valor FROM material m
     WHERE EXISTS (SELECT 1 FROM movimiento_inventario WHERE material_id = m.id)
       AND m.existencia <> (SELECT existencia_resultante FROM movimiento_inventario
                             WHERE material_id = m.id ORDER BY creado_en DESC, id DESC LIMIT 1)`;
  const sinEnlace = Prisma.sql`
    SELECT count(*) AS valor FROM movimiento_inventario mv
     WHERE mv.tipo IN ('CONSUMO', 'DEVOLUCION')
       AND NOT EXISTS (SELECT 1 FROM consumo_orden c WHERE c.movimiento_id = mv.id)`;
  const enlacesAjenos = Prisma.sql`
    SELECT count(*) AS valor FROM consumo_orden c
      JOIN movimiento_inventario mv ON mv.id = c.movimiento_id
     WHERE mv.tipo NOT IN ('CONSUMO', 'DEVOLUCION') OR mv.material_id <> c.material_id`;
  const bajoMinimo = Prisma.sql`SELECT count(*) AS valor FROM material WHERE existencia < stock_minimo`;
  const agotados = Prisma.sql`SELECT count(*) AS valor FROM material WHERE existencia = 0 AND activo`;
  return [
    igual("Materiales con existencia distinta de la suma del libro", 0, await numero(db, descuadrados)),
    igual("Materiales con saldo distinto al último movimiento", 0, await numero(db, sinSaldoFinal)),
    igual("Consumos y devoluciones sin orden", 0, await numero(db, sinEnlace)),
    igual("Enlaces consumo_orden con tipo o material incorrecto", 0, await numero(db, enlacesAjenos)),
    minimo("Materiales bajo el stock mínimo", 4, await numero(db, bajoMinimo)),
    minimo("Materiales agotados", 1, await numero(db, agotados)),
  ];
}

// Por cada tipo y año: números 1..N sin huecos ni repetidos y contador igual al último número.
async function comprobarNumeracion(db: Lector): Promise<Comprobacion[]> {
  const consulta = (tabla: string, tipo: string) =>
    db.$queryRaw<{ anio: string; total: bigint; maximo: number; ultimo: number | null }[]>(Prisma.sql`
      SELECT g.anio, g.total, g.maximo, c.ultimo
        FROM (SELECT split_part(numero, '-', 2) AS anio, count(*) AS total,
                     max(split_part(numero, '-', 3)::int) AS maximo
                FROM ${Prisma.raw(tabla)} GROUP BY 1) g
        LEFT JOIN contador c ON c.tipo = ${tipo}::tipo_documento AND c.anio = g.anio::int
       ORDER BY g.anio`);
  const comprobaciones: Comprobacion[] = [];
  for (const [tabla, tipo, etiqueta] of [
    ["cotizacion", "COTIZACION", "cotizaciones"],
    ["orden_trabajo", "ORDEN_TRABAJO", "órdenes"],
  ]) {
    for (const fila of await consulta(tabla, tipo)) {
      const total = Number(fila.total);
      const sinHuecos = total === fila.maximo && fila.ultimo === fila.maximo;
      comprobaciones.push(igual(`Numeración de ${etiqueta} ${fila.anio} sin huecos (1 a ${fila.maximo})`, "sí", sinHuecos ? "sí" : "no"));
    }
  }
  return comprobaciones;
}

async function estadosPresentes(db: Lector, tabla: "cotizacion" | "orden_trabajo"): Promise<string[]> {
  const filas = await db.$queryRaw<{ estado: string }[]>(
    Prisma.sql`SELECT DISTINCT estado::text AS estado FROM ${Prisma.raw(tabla)}`,
  );
  return filas.map((f) => f.estado);
}

async function comprobarEstadosYOrdenes(db: Lector): Promise<Comprobacion[]> {
  const cotizaciones = await estadosPresentes(db, "cotizacion");
  const ordenes = await estadosPresentes(db, "orden_trabajo");
  const aprobadasSinUnaOrden = Prisma.sql`
    SELECT count(*) AS valor FROM cotizacion c
     WHERE c.estado = 'APROBADA' AND (SELECT count(*) FROM orden_trabajo o WHERE o.cotizacion_id = c.id) <> 1`;
  const etapasAbiertasEnOrdenCerrada = Prisma.sql`
    SELECT count(*) AS valor FROM orden_trabajo o
     WHERE o.estado IN ('LISTA', 'ENTREGADA', 'CERRADA')
       AND EXISTS (SELECT 1 FROM etapa_orden e WHERE e.orden_id = o.id AND e.estado IN ('PENDIENTE', 'EN_CURSO'))`;
  return [
    igual("Estados de cotización cubiertos", ESTADOS_COTIZACION.length, ESTADOS_COTIZACION.filter((e) => cotizaciones.includes(e)).length),
    igual("Estados de orden cubiertos", ESTADOS_ORDEN.length, ESTADOS_ORDEN.filter((e) => ordenes.includes(e)).length),
    igual("Cotizaciones APROBADA sin exactamente una orden", 0, await numero(db, aprobadasSinUnaOrden)),
    igual("Órdenes LISTA, ENTREGADA o CERRADA con etapas abiertas", 0, await numero(db, etapasAbiertasEnOrdenCerrada)),
  ];
}

async function comprobarTrazabilidad(db: Lector): Promise<Comprobacion[]> {
  const cotizacionesSinEvento = Prisma.sql`
    SELECT count(*) AS valor FROM cotizacion c
     WHERE NOT EXISTS (SELECT 1 FROM bitacora b WHERE b.cotizacion_id = c.id)`;
  const ordenesSinEvento = Prisma.sql`
    SELECT count(*) AS valor FROM orden_trabajo o
     WHERE NOT EXISTS (SELECT 1 FROM bitacora b WHERE b.orden_id = o.id)`;
  const eventosFuturos = Prisma.sql`SELECT count(*) AS valor FROM bitacora WHERE creado_en > now()`;
  const subtotalIncorrecto = Prisma.sql`
    SELECT count(*) AS valor FROM cotizacion c
     WHERE c.subtotal <> coalesce((SELECT sum(importe) FROM item_cotizacion WHERE cotizacion_id = c.id), 0)`;
  const costoIncorrecto = Prisma.sql`
    SELECT count(*) AS valor FROM item_cotizacion i
     WHERE i.tipo = 'PERSONALIZADO'
       AND i.costo_total <> coalesce((SELECT sum(importe) FROM linea_costo WHERE item_id = i.id), 0)`;
  return [
    igual("Cotizaciones sin evento en la bitácora", 0, await numero(db, cotizacionesSinEvento)),
    igual("Órdenes sin evento en la bitácora", 0, await numero(db, ordenesSinEvento)),
    igual("Eventos de bitácora con fecha futura", 0, await numero(db, eventosFuturos)),
    igual("Cotizaciones con subtotal distinto de la suma de ítems", 0, await numero(db, subtotalIncorrecto)),
    igual("Ítems personalizados con costo distinto de la suma de líneas", 0, await numero(db, costoIncorrecto)),
  ];
}

async function resumirConteos(db: Lector): Promise<string[]> {
  const contar = (tabla: "cotizacion" | "orden_trabajo", estados: string[]) =>
    Promise.all(
      estados.map(async (estado) => {
        const n = await numero(db, Prisma.sql`SELECT count(*) AS valor FROM ${Prisma.raw(tabla)} WHERE estado::text = ${estado}`);
        return `${estado}=${n}`;
      }),
    );
  const tiposMovimiento = await db.$queryRaw<{ tipo: string; n: bigint }[]>(
    Prisma.sql`SELECT tipo::text AS tipo, count(*) AS n FROM movimiento_inventario GROUP BY 1 ORDER BY 1`,
  );
  return [
    `Cotizaciones por estado: ${(await contar("cotizacion", ESTADOS_COTIZACION)).join(", ")}`,
    `Órdenes por estado: ${(await contar("orden_trabajo", ESTADOS_ORDEN)).join(", ")}`,
    `Movimientos por tipo: ${tiposMovimiento.map((t) => `${t.tipo}=${t.n}`).join(", ")}`,
    `Eventos de bitácora: ${await numero(db, Prisma.sql`SELECT count(*) AS valor FROM bitacora`)}`,
  ];
}

export async function verificarSiembra(db: Lector, datos: DatosSiembra = cargarDatos()): Promise<ResultadoVerificacion> {
  const comprobaciones = [
    ...(await comprobarConteos(db, datos)),
    ...(await comprobarInventario(db)),
    ...(await comprobarNumeracion(db)),
    ...(await comprobarEstadosYOrdenes(db)),
    ...(await comprobarTrazabilidad(db)),
  ];
  return { comprobaciones, resumen: await resumirConteos(db), ok: comprobaciones.every((c) => c.ok) };
}

export function imprimirVerificacion(resultado: ResultadoVerificacion): void {
  const filas = [
    ["Comprobación", "Esperado", "Obtenido", "Resultado"],
    ...resultado.comprobaciones.map((c) => [c.nombre, c.esperado, c.obtenido, c.ok ? "OK" : "FALLA"]),
  ];
  for (const linea of tabla(filas)) escribir(linea);
  escribir();
  for (const linea of resultado.resumen) escribir(linea);
  escribir(resultado.ok ? "Verificación de la siembra: correcta." : "Verificación de la siembra: HAY FALLAS.");
}

async function ejecutarDesdeConsola(): Promise<number> {
  cargarArchivosDeEntorno();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable de entorno DATABASE_URL.");
  const db = crearCliente(url);
  try {
    const resultado = await verificarSiembra(db);
    imprimirVerificacion(resultado);
    return resultado.ok ? 0 : 1;
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1]?.endsWith("verificar.ts")) {
  ejecutarDesdeConsola().then(
    (codigo) => process.exit(codigo),
    (error: unknown) => {
      process.stderr.write(`La verificación falló: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    },
  );
}
