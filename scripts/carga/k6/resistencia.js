// Resistencia: 100 VU durante 10 minutos con lecturas y una minoria de escrituras sobre registros distintos.
// Las escrituras usan el material y los clientes de resistencia de scripts/carga/concurrencia.json.
import { check, sleep } from "k6";

import { enviar, get, pasoDeLectura, sesionDe, umbralesLectura, uuid } from "./comun.js";

const F = JSON.parse(open(__ENV.FIXTURES || "/carga/concurrencia.json"));

export const options = {
  scenarios: {
    resistencia: { executor: "constant-vus", vus: 100, duration: "10m", gracefulStop: "15s" },
  },
  thresholds: umbralesLectura,
};

const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

function consumir(sesion) {
  const res = enviar("POST", sesion, `ordenes/${elegir(F.ordenes)}/consumos`,
    { lineas: [{ materialId: F.materialResistencia, cantidad: "1.000" }] }, { "Idempotency-Key": uuid() });
  check(res, { "consumo 201": (r) => r.status === 201 });
}

function editar(sesion) {
  const id = elegir(F.clientesResistencia);
  const version = get(sesion, `clientes/${id}`).json("datos.actualizadoEn");
  const res = enviar("PATCH", sesion, `clientes/${id}`, { version, notas: `Resistencia k6 ${Date.now()}` });
  // 409 es esperado si otro VU edito el mismo cliente entre la lectura y la escritura.
  check(res, { "edicion 200 o 409": (r) => r.status === 200 || r.status === 409 });
}

export default function escenario() {
  const sesion = sesionDe(__VU - 1);
  const azar = Math.random();
  if (sesion.perfil === "ADMINISTRACION" && azar < 0.2) consumir(sesion);
  else if (sesion.perfil === "ATENCION_CLIENTE" && azar < 0.1) editar(sesion);
  else pasoDeLectura(sesion);
  sleep(0.5 + Math.random());
}
