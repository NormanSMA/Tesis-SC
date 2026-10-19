// Verifica la integridad de sc_carga despues de una prueba de carga. Solo lee.
// Uso: node scripts/carga/verificar-integridad.mjs [--k6 output/carga/concurrencia.json] [--salida output/carga/integridad.json]
// Los eventos "de la prueba" son los posteriores al corte de scripts/carga/estado.json.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { ARCHIVO_CONCURRENCIA, ARCHIVO_ESTADO, RAIZ, conectar, leerJson, leerOpciones } from "./comun.mjs";
import { contador } from "./resumen-k6.mjs";

const revisiones = [];
function registrar(nombre, esperado, obtenido, ok = esperado === obtenido) {
  revisiones.push({ nombre, esperado, obtenido, ok });
}

async function numero(c, sql, parametros = []) {
  return Number((await c.query(sql, parametros)).rows[0].n);
}

async function revisarLibro(c) {
  registrar("Materiales con existencia distinta de la suma del libro", 0, await numero(c, `
    SELECT count(*)::int AS n FROM material m
    WHERE m.existencia <> coalesce((SELECT sum(cantidad) FROM movimiento_inventario WHERE material_id = m.id), 0)`));
  registrar("Materiales con existencia negativa", 0, await numero(c, "SELECT count(*)::int AS n FROM material WHERE existencia < 0"));
  registrar("Movimientos con existencia resultante negativa", 0, await numero(c,
    "SELECT count(*)::int AS n FROM movimiento_inventario WHERE existencia_resultante < 0"));
  registrar("Materiales cuya ultima existencia resultante difiere del saldo", 0, await numero(c, `
    SELECT count(*)::int AS n FROM material m
    WHERE EXISTS (SELECT 1 FROM movimiento_inventario WHERE material_id = m.id)
      AND m.existencia <> (SELECT existencia_resultante FROM movimiento_inventario WHERE material_id = m.id
                           ORDER BY creado_en DESC, existencia_resultante DESC LIMIT 1)`));
}

async function revisarOrdenes(c, corte) {
  registrar("Cotizaciones con mas de una orden", 0, await numero(c,
    "SELECT count(*)::int AS n FROM (SELECT cotizacion_id FROM orden_trabajo GROUP BY 1 HAVING count(*) > 1) x"));
  registrar("Ordenes nuevas sin exactamente un evento CONVERTIR_EN_ORDEN", 0, await numero(c, `
    SELECT count(*)::int AS n FROM orden_trabajo o WHERE o.creado_en > $1
      AND (SELECT count(*) FROM bitacora b WHERE b.orden_id = o.id AND b.accion = 'CONVERTIR_EN_ORDEN') <> 1`, [corte]));
  registrar("Eventos CONVERTIR_EN_ORDEN nuevos sin orden", 0, await numero(c, `
    SELECT count(*)::int AS n FROM bitacora b WHERE b.accion = 'CONVERTIR_EN_ORDEN' AND b.creado_en > $1
      AND NOT EXISTS (SELECT 1 FROM orden_trabajo o WHERE o.id = b.orden_id)`, [corte]));
}

async function revisarMovimientos(c, corte) {
  registrar("Movimientos nuevos de orden sin exactamente un evento de bitacora", 0, await numero(c, `
    SELECT count(*)::int AS n FROM movimiento_inventario m
    WHERE m.creado_en > $1 AND m.tipo IN ('CONSUMO', 'DEVOLUCION')
      AND (SELECT count(*) FROM bitacora b WHERE b.entidad = 'MOVIMIENTO_INVENTARIO' AND b.entidad_id = m.id
             AND b.accion = CASE m.tipo WHEN 'CONSUMO' THEN 'CONSUMIR_MATERIAL' ELSE 'DEVOLVER_MATERIAL' END::accion_bitacora) <> 1`, [corte]));
  registrar("Eventos de consumo o devolucion nuevos sin movimiento", 0, await numero(c, `
    SELECT count(*)::int AS n FROM bitacora b WHERE b.creado_en > $1 AND b.accion IN ('CONSUMIR_MATERIAL', 'DEVOLVER_MATERIAL')
      AND NOT EXISTS (SELECT 1 FROM movimiento_inventario m WHERE m.id = b.entidad_id)`, [corte]));
}

async function revisarClientes(c, corte, fixtures) {
  registrar("Clientes editados sin evento EDITAR posterior al corte", 0, await numero(c, `
    SELECT count(*)::int AS n FROM cliente cl WHERE cl.actualizado_en > $1
      AND NOT EXISTS (SELECT 1 FROM bitacora b WHERE b.entidad = 'CLIENTE' AND b.entidad_id = cl.id AND b.accion = 'EDITAR' AND b.creado_en > $1)`, [corte]));
  if (!fixtures) return;
  const ids = fixtures.clientes;
  registrar("Clientes de disputa con mas de una edicion ganadora", 0, await numero(c, `
    SELECT count(*)::int AS n FROM (SELECT entidad_id FROM bitacora WHERE entidad = 'CLIENTE' AND accion = 'EDITAR'
      AND creado_en > $1 AND entidad_id = ANY($2::uuid[]) GROUP BY 1 HAVING count(*) > 1) x`, [corte, ids]));
  registrar("Clientes de disputa cuya nota no es la del evento ganador", 0, await numero(c, `
    SELECT count(*)::int AS n FROM cliente cl JOIN bitacora b ON b.entidad = 'CLIENTE' AND b.entidad_id = cl.id AND b.accion = 'EDITAR' AND b.creado_en > $1
    WHERE cl.id = ANY($2::uuid[]) AND cl.notas IS DISTINCT FROM b.detalle -> 'cambios' -> 'notas' ->> 'nuevo'`, [corte, ids]));
}

async function revisarRondas(c, corte, fixtures) {
  const porVu = Number(fixtures.consumoPorVu);
  const esperado = Math.floor(Number(fixtures.existenciaDisputa) / porVu);
  const filas = (await c.query(`
    SELECT material_id, count(*)::int AS n FROM movimiento_inventario WHERE creado_en > $1 AND tipo = 'CONSUMO' AND material_id = ANY($2::uuid[])
    GROUP BY 1`, [corte, fixtures.materialesRonda])).rows;
  const conteos = fixtures.materialesRonda.map((id) => filas.find((f) => f.material_id === id)?.n ?? 0);
  registrar("Rondas de consumo que vendieron mas de lo disponible", 0, conteos.filter((n) => n > esperado).length);
  const ejecutadas = conteos.filter((n) => n > 0);
  registrar(`Rondas de consumo con exactamente ${esperado} consumos exitosos (de ${ejecutadas.length} ejecutadas)`, ejecutadas.length,
    ejecutadas.filter((n) => n === esperado).length);
  return { conteos, esperado };
}

async function revisarContraK6(c, corte, fixtures, k6, ronda) {
  const ordenes = await numero(c, `SELECT count(*)::int AS n FROM orden_trabajo o WHERE o.creado_en > $1 AND o.cotizacion_id = ANY($2::uuid[])`,
    [corte, fixtures.cotizaciones.map((x) => x.id)]);
  const ediciones = await numero(c, `SELECT count(*)::int AS n FROM bitacora WHERE entidad = 'CLIENTE' AND accion = 'EDITAR' AND creado_en > $1
    AND entidad_id = ANY($2::uuid[])`, [corte, fixtures.clientes]);
  const consumos = ronda.conteos.reduce((a, b) => a + b, 0);
  registrar("Ordenes creadas en BD vs conversiones 201 de k6", contador(k6, "conversiones_ok"), ordenes);
  registrar("Ediciones del cliente en bitacora vs 200 de k6", contador(k6, "ediciones_ok"), ediciones);
  registrar("Consumos de rondas en BD vs 201 de k6", contador(k6, "consumos_ok"), consumos);
}

async function main() {
  const opciones = leerOpciones(process.argv.slice(2), { k6: "valor", salida: "valor" });
  if (!existsSync(ARCHIVO_ESTADO)) throw new Error("Falta scripts/carga/estado.json. Corra sembrar-masivo.mjs.");
  const { corte } = leerJson(ARCHIVO_ESTADO);
  const fixtures = existsSync(ARCHIVO_CONCURRENCIA) ? leerJson(ARCHIVO_CONCURRENCIA) : null;
  const k6 = opciones.k6 && existsSync(resolve(RAIZ, opciones.k6)) ? leerJson(resolve(RAIZ, opciones.k6)) : null;
  const c = await conectar();
  try {
    await revisarLibro(c);
    await revisarOrdenes(c, corte);
    await revisarMovimientos(c, corte);
    await revisarClientes(c, corte, fixtures);
    if (fixtures) {
      const ronda = await revisarRondas(c, corte, fixtures);
      if (k6) await revisarContraK6(c, corte, fixtures, k6, ronda);
    }
  } finally {
    await c.end();
  }
  for (const r of revisiones) process.stdout.write(`${r.ok ? "OK    " : "FALLA "} ${r.nombre}: esperado ${r.esperado}, obtenido ${r.obtenido}\n`);
  const fallas = revisiones.filter((r) => !r.ok).length;
  process.stdout.write(`Integridad: ${revisiones.length - fallas}/${revisiones.length} revisiones correctas. Corte ${corte}.\n`);
  if (opciones.salida) {
    const ruta = resolve(RAIZ, opciones.salida);
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(ruta, JSON.stringify({ corte, revisiones, fallas }, null, 2));
  }
  process.exit(fallas === 0 ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(`La verificacion fallo: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
});
