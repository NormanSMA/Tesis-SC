// Piezas compartidas por los escenarios k6. Se monta scripts/carga en /carga (solo lectura).
import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";

export const BASE = __ENV.BASE_URL || "http://host.docker.internal:3100";
export const SESIONES = JSON.parse(open(__ENV.SESIONES || "/carga/sesiones.json"));

// Permisos de lectura por perfil (espejo de PERMISOS_POR_PERFIL en src/core/permisos.ts).
const LECTURA = {
  GERENCIA: ["cliente", "cotizacion", "orden", "catalogo", "produccion", "inventario", "bitacora", "panel"],
  ADMINISTRACION: ["cotizacion", "orden", "catalogo", "produccion", "inventario", "panel"],
  OPERACIONES: ["cliente", "cotizacion", "orden", "catalogo", "produccion", "inventario", "panel"],
  ATENCION_CLIENTE: ["cliente", "cotizacion", "orden", "catalogo", "produccion", "panel"],
  PRODUCCION: ["orden", "catalogo", "produccion", "panel"],
  ADMIN: ["bitacora", "usuario", "configuracion"],
};

// Respuestas esperadas: 2xx mas 409, 422 y 429. Todo lo demas cuenta como fallo de http_req_failed.
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 409, 422, 429));

export const respuestas409 = new Counter("respuestas_409");
export const respuestas422 = new Counter("respuestas_422");
export const respuestas429 = new Counter("respuestas_429");
export const errores5xx = new Counter("errores_5xx");

export function contar(res) {
  if (res.status >= 500) errores5xx.add(1);
  else if (res.status === 409) respuestas409.add(1);
  else if (res.status === 422) respuestas422.add(1);
  else if (res.status === 429) respuestas429.add(1);
}

// Paso coprimo con 1000: los primeros VU ya mezclan los seis perfiles en lugar de tomar un bloque de un perfil.
export function sesionDe(indice) {
  return SESIONES[(indice * 37) % SESIONES.length];
}

export function sesionesDe(perfil) {
  return SESIONES.filter((s) => s.perfil === perfil);
}

export function cabeceras(sesion, extra) {
  return Object.assign({ Cookie: sesion.cookie, Origin: BASE, Accept: "application/json" }, extra || {});
}

function rutaEtiqueta(ruta) {
  return ruta.split("?")[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id");
}

export function get(sesion, ruta, tipo) {
  const res = http.get(`${BASE}/api/v1/${ruta}`, {
    headers: cabeceras(sesion),
    tags: { tipo: tipo || "lectura", ruta: rutaEtiqueta(ruta) },
  });
  contar(res);
  check(res, { "lectura responde 200": (r) => r.status === 200 });
  return res;
}

export function enviar(metodo, sesion, ruta, cuerpo, extra, tipo) {
  const res = http.request(metodo, `${BASE}/api/v1/${ruta}`, JSON.stringify(cuerpo), {
    headers: cabeceras(sesion, Object.assign({ "Content-Type": "application/json" }, extra)),
    tags: { tipo: tipo || "escritura", ruta: rutaEtiqueta(ruta) },
  });
  contar(res);
  return res;
}

export function uuid() {
  const h = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s += "-";
    else if (i === 14) s += "4";
    else if (i === 19) s += h[8 + Math.floor(Math.random() * 4)];
    else s += h[Math.floor(Math.random() * 16)];
  }
  return s;
}

const TERMINOS = ["Hotel", "Rotulos", "Publicidad", "Central", "Norte", "Clinica", "COT-2026", "COT-2025", "OT-2026", "Vinil", "Lona", "Banner", "Letras", "Cliente 1"];
const ORDENES = {
  clientes: ["nombre:asc", "nombre:desc", "creadoEn:desc", "codigo:asc"],
  cotizaciones: ["creadoEn:desc", "total:desc", "numero:asc", "cliente:asc"],
  ordenes: ["creadoEn:desc", "fechaEntrega:asc", "numero:desc", "cliente:asc"],
};
const ESTADOS_COT = ["", "BORRADOR", "ENVIADA", "APROBADA", "RECHAZADA", "VENCIDA"];
const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

// Lista con q, orden y paginacion, y luego la ficha de un registro de la lista.
function listaConFicha(sesion, recurso, extra) {
  const q = `q=${encodeURIComponent(elegir(TERMINOS))}&pagina=${1 + Math.floor(Math.random() * 20)}&porPagina=20&orden=${elegir(ORDENES[recurso])}${extra || ""}`;
  let id = null;
  try {
    const datos = get(sesion, `${recurso}?${q}`).json("datos");
    if (datos && datos.length) id = elegir(datos).id;
  } catch { /* sin JSON: la respuesta ya quedo contada */ }
  if (!id) {
    try { id = elegir(get(sesion, `${recurso}?pagina=1&porPagina=20`).json("datos")).id; } catch { return; }
  }
  get(sesion, `${recurso}/${id}`);
}

// Como BuscadorGlobal.tsx: una consulta por modulo permitido, en paralelo, con porPagina=5.
function buscadorGlobal(sesion, puede) {
  const q = encodeURIComponent(elegir(TERMINOS));
  const rutas = [];
  if (puede.indexOf("cliente") >= 0) rutas.push("clientes");
  if (puede.indexOf("cotizacion") >= 0) rutas.push("cotizaciones");
  if (puede.indexOf("orden") >= 0) rutas.push("ordenes");
  if (puede.indexOf("catalogo") >= 0) rutas.push("productos");
  if (puede.indexOf("inventario") >= 0) rutas.push("materiales");
  if (!rutas.length) return;
  http.batch(rutas.map((r) => ["GET", `${BASE}/api/v1/${r}?q=${q}&porPagina=5`, null,
    { headers: cabeceras(sesion), tags: { tipo: "lectura", ruta: `buscador/${r}` } }])).forEach((res) => {
    contar(res);
    check(res, { "lectura responde 200": (r) => r.status === 200 });
  });
}

// Un paso de navegacion segun los permisos del perfil de la sesion.
export function pasoDeLectura(sesion) {
  const puede = LECTURA[sesion.perfil] || [];
  const acciones = [];
  if (puede.indexOf("cliente") >= 0) acciones.push(() => listaConFicha(sesion, "clientes"));
  if (puede.indexOf("cotizacion") >= 0) acciones.push(() => listaConFicha(sesion, "cotizaciones", `&estado=${elegir(ESTADOS_COT)}`));
  if (puede.indexOf("orden") >= 0) acciones.push(() => listaConFicha(sesion, "ordenes"));
  if (puede.indexOf("catalogo") >= 0) acciones.push(() => get(sesion, `productos?q=${encodeURIComponent(elegir(["ro", "vi", "im", "ca"]))}&porPagina=20`));
  if (puede.indexOf("inventario") >= 0) {
    acciones.push(() => get(sesion, `materiales?q=${encodeURIComponent(elegir(["Vinil", "Lona", "Tinta", "CARGA"]))}&pagina=${1 + Math.floor(Math.random() * 10)}`));
    acciones.push(() => get(sesion, `movimientos?pagina=${1 + Math.floor(Math.random() * 50)}`));
  }
  if (puede.indexOf("produccion") >= 0) acciones.push(() => get(sesion, "produccion/tablero"));
  if (puede.indexOf("panel") >= 0) {
    acciones.push(() => get(sesion, "panel"));
    acciones.push(() => get(sesion, "contadores"));
    acciones.push(() => buscadorGlobal(sesion, puede));
  }
  if (puede.indexOf("bitacora") >= 0) acciones.push(() => get(sesion, `bitacora?pagina=${1 + Math.floor(Math.random() * 20)}`));
  if (puede.indexOf("usuario") >= 0) acciones.push(() => get(sesion, `usuarios?q=carga&pagina=${1 + Math.floor(Math.random() * 20)}`));
  if (puede.indexOf("configuracion") >= 0) acciones.push(() => get(sesion, "configuracion"));
  elegir(acciones)();
}

export const umbralesLectura = {
  "http_req_duration{tipo:lectura}": ["p(95)<2000"],
  errores_5xx: ["count==0"],
  checks: ["rate>0.99"],
};
