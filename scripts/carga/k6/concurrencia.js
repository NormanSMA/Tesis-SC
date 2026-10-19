// Concurrencia sobre los mismos registros, en rondas sincronizadas. Los ids salen de scripts/carga/concurrencia.json,
// que crea sembrar-masivo.mjs en cada corrida.
//   50 VU consumen el mismo material a la vez (hay existencia para floor(existencia / cantidad) consumos).
//   20 VU convierten la misma cotizacion aprobada (gana una).
//   20 VU editan el mismo cliente con la misma version (gana una).
import { check, sleep } from "k6";
import exec from "k6/execution";
import { Counter } from "k6/metrics";

import { enviar, get, sesionesDe, uuid } from "./comun.js";

const F = JSON.parse(open(__ENV.FIXTURES || "/carga/concurrencia.json"));
const RONDAS = F.rondas;
const PERIODO_S = Number(__ENV.PERIODO_RONDA || 5);
const ESPERADO_CONSUMOS = Math.floor(Number(F.existenciaDisputa) / Number(F.consumoPorVu));
const ALMACEN = sesionesDe("ADMINISTRACION");
const OPERACIONES = sesionesDe("OPERACIONES");
const ATENCION = sesionesDe("ATENCION_CLIENTE");

const consumosOk = new Counter("consumos_ok");
const conversionesOk = new Counter("conversiones_ok");
const edicionesOk = new Counter("ediciones_ok");

function escenario(exec_, vus) {
  return { executor: "per-vu-iterations", vus, iterations: RONDAS, exec: exec_, maxDuration: `${RONDAS * PERIODO_S + 60}s` };
}

export const options = {
  scenarios: {
    consumo: escenario("consumo", 50),
    conversion: escenario("conversion", 20),
    edicion: escenario("edicion", 20),
  },
  thresholds: {
    errores_5xx: ["count==0"],
    checks: ["rate>0.99"],
    // Resultado exacto: cualquier desviacion es una carrera o un bloqueo perdido.
    consumos_ok: [`count==${RONDAS * ESPERADO_CONSUMOS}`],
    conversiones_ok: [`count==${RONDAS}`],
    ediciones_ok: [`count==${RONDAS}`],
  },
};

// Lee la version actual de cada cliente de disputa. Todos los VU de una ronda usan esa misma version.
export function setup() {
  const sesion = ATENCION[0];
  const versiones = F.clientes.map((id) => get(sesion, `clientes/${id}`).json("datos.actualizadoEn"));
  return { inicio: Date.now() / 1000 + 5, versiones };
}

function esperarRonda(datos) {
  const ronda = exec.vu.iterationInScenario;
  const espera = datos.inicio + ronda * PERIODO_S - Date.now() / 1000;
  if (espera > 0) sleep(espera);
  return ronda;
}

// Registra en el log toda respuesta fuera de lo esperado, con su código, para poder explicarla.
function registrarInesperada(tipo, res, esperada) {
  if (esperada) return;
  let codigo = "";
  try { codigo = res.json("error.codigo") ?? ""; } catch { codigo = "sin JSON"; }
  console.warn(`INESPERADA ${tipo}: estado ${res.status} ${codigo}`);
}

export function consumo(datos) {
  const ronda = esperarRonda(datos);
  const vu = exec.vu.idInTest;
  const sesion = ALMACEN[vu % ALMACEN.length];
  const orden = F.ordenes[vu % F.ordenes.length];
  const res = enviar("POST", sesion, `ordenes/${orden}/consumos`,
    { lineas: [{ materialId: F.materialesRonda[ronda], cantidad: F.consumoPorVu }] }, { "Idempotency-Key": uuid() });
  if (res.status === 201) consumosOk.add(1);
  check(res, {
    "consumo 201 o 409 por existencia": (r) => r.status === 201 || (r.status === 409 && r.json("error.codigo") === "EXISTENCIA_INSUFICIENTE"),
  });
  registrarInesperada("consumo", res, res.status === 201 || (res.status === 409 && res.json("error.codigo") === "EXISTENCIA_INSUFICIENTE"));
}

export function conversion(datos) {
  const ronda = esperarRonda(datos);
  const vu = exec.vu.idInTest;
  const sesion = OPERACIONES[vu % OPERACIONES.length];
  const entrega = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const res = enviar("POST", sesion, "ordenes",
    { cotizacionId: F.cotizaciones[ronda].id, categoriaId: F.cotizaciones[ronda].categoriaId, fechaEntrega: entrega });
  if (res.status === 201) conversionesOk.add(1);
  check(res, {
    "conversion 201 o 409 ORDEN_EXISTENTE": (r) => r.status === 201 || (r.status === 409 && r.json("error.codigo") === "ORDEN_EXISTENTE"),
  });
  registrarInesperada("conversion", res, res.status === 201 || (res.status === 409 && res.json("error.codigo") === "ORDEN_EXISTENTE"));
}

export function edicion(datos) {
  const ronda = esperarRonda(datos);
  const vu = exec.vu.idInTest;
  const sesion = ATENCION[vu % ATENCION.length];
  const res = enviar("PATCH", sesion, `clientes/${F.clientes[ronda]}`,
    { version: datos.versiones[ronda], notas: `Edicion k6 vu ${vu} ronda ${ronda + 1}` });
  if (res.status === 200) edicionesOk.add(1);
  check(res, {
    "edicion 200 o 409 CONFLICTO_EDICION": (r) => r.status === 200 || (r.status === 409 && r.json("error.codigo") === "CONFLICTO_EDICION"),
  });
  registrarInesperada("edicion", res, res.status === 200 || (res.status === 409 && res.json("error.codigo") === "CONFLICTO_EDICION"));
}
