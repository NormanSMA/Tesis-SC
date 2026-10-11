import { randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TIPOS = ["consulta", "creacion", "actualizacion"];
const UMBRAL_MS = 2000;
const CICLO = ["consulta", "consulta", "consulta", "consulta", "consulta", "consulta", "consulta",
  "creacion", "creacion", "actualizacion"];
const RUTAS_CONSULTA = ["/api/v1/panel", "/api/v1/clientes", "/api/v1/cotizaciones",
  "/api/v1/ordenes", "/api/v1/produccion"];
const VARIABLES_CLAVE = {
  GERENCIA: "SEED_PASSWORD_GERENCIA",
  ATENCION_CLIENTE: "SEED_PASSWORD_ATENCION_CLIENTE",
  OPERACIONES: "SEED_PASSWORD_OPERACIONES",
  ADMINISTRACION: "SEED_PASSWORD_ADMINISTRACION",
  ADMIN: "SEED_PASSWORD_ADMIN",
  PRODUCCION: "SEED_PASSWORD_PRODUCCION",
};
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** @param {number[]} valores @param {number} porcentaje */
export function percentil(valores, porcentaje) {
  if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
    throw new RangeError("El percentil debe estar entre 0 y 100.");
  }
  if (valores.some((valor) => !Number.isFinite(valor) || valor < 0)) {
    throw new RangeError("Las duraciones deben ser números finitos y no negativos.");
  }
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.max(0, Math.ceil((porcentaje / 100) * ordenados.length) - 1);
  return ordenados[indice];
}

/** @param {{ ms: number, respondio: boolean }[]} muestras */
export function resumir(muestras) {
  const duraciones = muestras.map((muestra) => muestra.ms);
  const rapidas = muestras.filter((muestra) => muestra.respondio && muestra.ms <= UMBRAL_MS).length;
  return {
    n: muestras.length,
    p50: percentil(duraciones, 50),
    p95: percentil(duraciones, 95),
    p99: percentil(duraciones, 99),
    maximo: percentil(duraciones, 100),
    porcentajeHasta2000: muestras.length === 0 ? 0 : (rapidas / muestras.length) * 100,
  };
}

/**
 * @param {Record<string, ReturnType<typeof resumir>>} resumenes
 * @param {number} errores5xx
 */
export function decidirCumplimiento(resumenes, errores5xx) {
  return errores5xx === 0 && ["global", ...TIPOS].every((tipo) => {
    const resumen = resumenes[tipo];
    return resumen !== undefined && resumen.n > 0 && resumen.porcentajeHasta2000 >= 95;
  });
}

function leerOpciones(argumentos) {
  const opciones = { base: "http://127.0.0.1:3000", sesiones: 20, duracion: 60,
    salida: "docs/pruebas/resultado-rendimiento.json" };
  const permitidas = new Set(["base", "sesiones", "duracion", "salida"]);
  for (let indice = 0; indice < argumentos.length; indice += 2) {
    const clave = argumentos[indice].replace(/^--/, "");
    const valor = argumentos[indice + 1];
    if (!argumentos[indice].startsWith("--") || !permitidas.has(clave) || !valor) {
      throw new Error("Use --base, --sesiones, --duracion y --salida con sus valores.");
    }
    opciones[clave] = ["sesiones", "duracion"].includes(clave) ? Number(valor) : valor;
  }
  if (!Number.isSafeInteger(opciones.sesiones) || opciones.sesiones < 1 ||
      !Number.isFinite(opciones.duracion) || opciones.duracion <= 0) {
    throw new Error("Exija sesiones enteras positivas y duración positiva en segundos.");
  }
  const base = new URL(opciones.base);
  if (!["http:", "https:"].includes(base.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) ||
      base.username || base.password || base.pathname !== "/" || base.search || base.hash) {
    throw new Error("Use una URL base local, sin credenciales, rutas ni parámetros.");
  }
  return { ...opciones, base: base.origin, salida: resolve(opciones.salida) };
}

async function cargarUsuarios() {
  const archivo = await readFile(resolve(RAIZ, "prisma/seed/datos/usuarios.json"), "utf8");
  const usuarios = JSON.parse(archivo);
  if (!Array.isArray(usuarios) || usuarios.length === 0) throw new Error("Faltan usuarios de siembra.");
  for (const usuario of usuarios) {
    const variable = VARIABLES_CLAVE[usuario.perfil];
    if (!variable || !process.env[variable]) {
      throw new Error(`Defina ${variable ?? "la variable del perfil"} antes de ejecutar.`);
    }
  }
  return usuarios;
}

async function solicitar(sesion, peticion) {
  const inicio = performance.now();
  let estado = null;
  try {
    const respuesta = await fetch(`${sesion.base}${peticion.ruta}`, {
      method: peticion.metodo ?? "GET",
      headers: { Origin: sesion.base, ...(sesion.cookie ? { Cookie: sesion.cookie } : {}),
        ...(peticion.cuerpo ? { "Content-Type": "application/json" } : {}) },
      body: peticion.cuerpo ? JSON.stringify(peticion.cuerpo) : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    estado = respuesta.status;
    const texto = await respuesta.text();
    const ms = performance.now() - inicio;
    let datos = null;
    try { datos = texto ? JSON.parse(texto).datos ?? null : null; } catch { /* Conserva los errores HTTP sin JSON. */ }
    return { estado, ms, respondio: true, datos,
      cookie: (respuesta.headers.get("set-cookie") ?? "").split(";")[0],
      error: respuesta.ok ? null : `HTTP_${estado}` };
  } catch (error) {
    return { estado, ms: performance.now() - inicio, respondio: false, datos: null, cookie: "",
      error: error?.name === "TimeoutError" ? "TIEMPO_AGOTADO" : "ERROR_RED" };
  }
}

function registrarPreparacion(contexto, sesion, ruta, respuesta) {
  contexto.preparacion.push({ sesion: sesion.numero, perfil: sesion.perfil, ruta,
    estado: respuesta.estado, error: respuesta.error });
}

async function abrirSesion(contexto, usuario, numero) {
  const sesion = { numero, perfil: usuario.perfil, base: contexto.opciones.base, cookie: "",
    rutas: [], clientes: [], consultas: 0, ciclos: 0, solicitudes: 0 };
  const ruta = "/api/v1/auth/login";
  const respuesta = await solicitar(sesion, { ruta, metodo: "POST",
    cuerpo: { correo: usuario.correo, contrasena: process.env[VARIABLES_CLAVE[usuario.perfil]] } });
  registrarPreparacion(contexto, sesion, ruta, respuesta);
  if (respuesta.error || !respuesta.cookie) throw new Error(`Login de sesión ${numero}: ${respuesta.error ?? "SIN_COOKIE"}.`);
  sesion.cookie = respuesta.cookie;
  await seleccionarConsultas(contexto, sesion);
  return sesion;
}

async function seleccionarConsultas(contexto, sesion) {
  for (const ruta of RUTAS_CONSULTA) {
    const respuesta = await solicitar(sesion, { ruta });
    registrarPreparacion(contexto, sesion, ruta, respuesta);
    if (!respuesta.error) sesion.rutas.push(ruta);
    else if (![403, 404].includes(respuesta.estado)) {
      throw new Error(`Consulta previa de sesión ${sesion.numero}: ${respuesta.error}.`);
    }
  }
  for (const ruta of ["/api/v1/inventario/materiales", "/api/v1/materiales"]) {
    const respuesta = await solicitar(sesion, { ruta });
    registrarPreparacion(contexto, sesion, ruta, respuesta);
    if (!respuesta.error) { sesion.rutas.push(ruta); break; }
    if (![403, 404].includes(respuesta.estado)) {
      throw new Error(`Materiales de sesión ${sesion.numero}: ${respuesta.error}.`);
    }
  }
  if (sesion.rutas.length === 0) throw new Error(`Sesión ${sesion.numero} sin consultas autorizadas.`);
}

function prepararOperacion(contexto, sesion, tipo) {
  if (tipo === "consulta") {
    const ruta = sesion.rutas[sesion.consultas++ % sesion.rutas.length];
    return { ruta, metodo: "GET" };
  }
  if (tipo === "creacion") {
    const identificador = `RENDIMIENTO-${randomUUID()}`;
    return { ruta: "/api/v1/clientes", metodo: "POST",
      cuerpo: { nombre: identificador, ruc: identificador } };
  }
  const cliente = sesion.clientes.at(-1);
  if (!cliente || !Number.isSafeInteger(cliente.version)) {
    contexto.omitidas.push({ sesion: sesion.numero, tipo, motivo: "SIN_CLIENTE_CON_VERSION" });
    return null;
  }
  return { ruta: `/api/v1/clientes/${encodeURIComponent(cliente.id)}`, metodo: "PATCH",
    cuerpo: { nombre: `${cliente.nombre}-EDITADO`, version: cliente.version } };
}

function guardarCliente(contexto, sesion, peticion, respuesta) {
  const cliente = respuesta.datos;
  if (peticion.metodo === "POST") {
    if (cliente?.id !== undefined && cliente.id !== null && !respuesta.error) {
      sesion.clientes.push({ id: String(cliente.id), version: cliente.version, nombre: peticion.cuerpo.nombre });
    } else if (!respuesta.respondio || !respuesta.error) {
      contexto.creacionesInciertas.push({ sesion: sesion.numero, nombre: peticion.cuerpo.nombre });
    }
  }
  if (peticion.metodo === "PATCH" && !respuesta.error && cliente) {
    sesion.clientes.at(-1).version = cliente.version;
  }
}

async function ejecutarOperacion(contexto, sesion, tipo) {
  const peticion = prepararOperacion(contexto, sesion, tipo);
  if (!peticion) return;
  const respuesta = await solicitar(sesion, peticion);
  guardarCliente(contexto, sesion, peticion, respuesta);
  contexto.muestras.push({ sesion: sesion.numero, perfil: sesion.perfil, tipo,
    ruta: peticion.ruta, metodo: peticion.metodo, ms: respuesta.ms,
    estado: respuesta.estado, respondio: respuesta.respondio, error: respuesta.error });
  sesion.solicitudes++;
}

async function ejecutarSesion(contexto, sesion, fin) {
  while (performance.now() < fin) {
    for (const tipo of CICLO) {
      if (performance.now() >= fin) return;
      await ejecutarOperacion(contexto, sesion, tipo);
    }
    sesion.ciclos++;
  }
}

async function archivarClientes(contexto, sesion) {
  for (const cliente of sesion.clientes) {
    const ruta = `/api/v1/clientes/${encodeURIComponent(cliente.id)}/archivar`;
    const respuesta = await solicitar(sesion, { ruta, metodo: "POST", cuerpo: { version: cliente.version } });
    contexto.limpieza.push({ sesion: sesion.numero, clienteId: cliente.id,
      estado: respuesta.estado, archivado: respuesta.respondio && !respuesta.error,
      error: respuesta.error });
  }
}

function contarErrores(muestras) {
  const estados = {};
  let red = 0;
  let errores5xx = 0;
  for (const muestra of muestras) {
    if (muestra.estado >= 500 && muestra.estado <= 599) errores5xx++;
    if (muestra.estado !== null && (muestra.estado < 200 || muestra.estado >= 300)) {
      estados[muestra.estado] = (estados[muestra.estado] ?? 0) + 1;
    }
    if (!muestra.respondio) red++;
  }
  return { http: Object.values(estados).reduce((total, cantidad) => total + cantidad, 0),
    porEstado: estados, red, errores5xx };
}

function crearResultado(contexto) {
  const resumenes = Object.fromEntries(TIPOS.map((tipo) =>
    [tipo, resumir(contexto.muestras.filter((muestra) => muestra.tipo === tipo))]));
  resumenes.global = resumir(contexto.muestras);
  const errores = contarErrores(contexto.muestras);
  const cumpleCriterioTemporal = decidirCumplimiento(resumenes, errores.errores5xx);
  const completa = contexto.errorEjecucion === null && contexto.omitidas.length === 0 &&
    contexto.creacionesInciertas.length === 0 && contexto.sesiones.length === contexto.opciones.sesiones;
  return {
    requisito: "RNF-01", fechaUTC: new Date().toISOString(), opciones: contexto.opciones,
    entorno: { node: process.version, plataforma: process.platform, cpu: "POR_COMPLETAR",
      memoria: "POR_COMPLETAR", versionAplicacion: "POR_COMPLETAR" },
    metodologia: { modelo: "cerrado", mezclaPrevista: { consulta: 70, creacion: 20, actualizacion: 10 },
      percentiles: "rango más cercano", umbralMs: UMBRAL_MS, tiempoLimitePeticionMs: 30000 },
    inicioUTC: contexto.inicioUTC, duracionMedidaSegundos: contexto.duracionMedidaSegundos,
    sesiones: contexto.sesiones.map((sesion) => ({ numero: sesion.numero, perfil: sesion.perfil,
      rutas: sesion.rutas, solicitudes: sesion.solicitudes, ciclosCompletos: sesion.ciclos })),
    resumenes, mezclaObservada: Object.fromEntries(TIPOS.map((tipo) => [tipo,
      resumenes.global.n ? (resumenes[tipo].n / resumenes.global.n) * 100 : 0])),
    errores, preparacion: contexto.preparacion, omitidas: contexto.omitidas,
    creacionesInciertas: contexto.creacionesInciertas, limpieza: contexto.limpieza,
    ejecucionCompleta: completa, errorEjecucion: contexto.errorEjecucion,
    cumpleCriterioTemporal, decision: completa ? (cumpleCriterioTemporal ? "CUMPLE" : "NO CUMPLE") : "NO EVALUABLE",
    muestras: contexto.muestras,
  };
}

function imprimirResultado(resultado) {
  const etiquetas = { consulta: "Consulta", creacion: "Creación", actualizacion: "Actualización", global: "Global" };
  const decimal = (valor) => valor === null ? "—" : valor.toFixed(2);
  console.log("| Tipo | n | p50 (ms) | p95 (ms) | p99 (ms) | Máximo (ms) | ≤ 2000 ms (%) |");
  console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const tipo of [...TIPOS, "global"]) {
    const resumen = resultado.resumenes[tipo];
    console.log(`| ${etiquetas[tipo]} | ${resumen.n} | ${decimal(resumen.p50)} | ${decimal(resumen.p95)} | ${decimal(resumen.p99)} | ${decimal(resumen.maximo)} | ${decimal(resumen.porcentajeHasta2000)} |`);
  }
  console.log(`Decisión RNF-01: ${resultado.decision}`);
  console.log(`Errores HTTP: ${resultado.errores.http}; 5xx: ${resultado.errores.errores5xx}; red: ${resultado.errores.red}.`);
  console.log(`Estados HTTP: ${JSON.stringify(resultado.errores.porEstado)}`);
  console.log(`Operaciones omitidas: ${resultado.omitidas.length}; creaciones inciertas: ${resultado.creacionesInciertas.length}.`);
  console.log(`Archivados: ${resultado.limpieza.filter((cliente) => cliente.archivado).length}/${resultado.limpieza.length}.`);
  if (resultado.errorEjecucion) console.error(resultado.errorEjecucion);
  console.log(`JSON: ${resultado.opciones.salida}`);
}

async function medir(contexto, usuarios) {
  const aperturas = await Promise.allSettled(Array.from({ length: contexto.opciones.sesiones }, (_, indice) =>
    abrirSesion(contexto, usuarios[indice % usuarios.length], indice + 1)));
  contexto.sesiones = aperturas.filter((apertura) => apertura.status === "fulfilled").map((apertura) => apertura.value);
  const fallo = aperturas.find((apertura) => apertura.status === "rejected");
  if (fallo) throw fallo.reason;
  contexto.inicioUTC = new Date().toISOString();
  const inicio = performance.now();
  const fin = inicio + contexto.opciones.duracion * 1000;
  await Promise.all(contexto.sesiones.map((sesion) => ejecutarSesion(contexto, sesion, fin).catch(() => {
    contexto.errorEjecucion = "Falló una sesión durante la medición.";
  })));
  contexto.duracionMedidaSegundos = (performance.now() - inicio) / 1000;
}

async function principal() {
  const opciones = leerOpciones(process.argv.slice(2));
  const usuarios = await cargarUsuarios();
  const contexto = { opciones, sesiones: [], muestras: [], preparacion: [], limpieza: [],
    omitidas: [], creacionesInciertas: [], errorEjecucion: null, inicioUTC: null, duracionMedidaSegundos: 0 };
  try {
    await medir(contexto, usuarios);
  } catch (error) {
    contexto.errorEjecucion = error.message;
  } finally {
    await Promise.all(contexto.sesiones.map((sesion) => archivarClientes(contexto, sesion)));
  }
  const resultado = crearResultado(contexto);
  await mkdir(dirname(opciones.salida), { recursive: true });
  await writeFile(opciones.salida, `${JSON.stringify(resultado, null, 2)}\n`, "utf8");
  imprimirResultado(resultado);
  if (resultado.decision !== "CUMPLE" || resultado.limpieza.some((cliente) => !cliente.archivado)) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  principal().catch((error) => {
    console.error(`No se pudo preparar o guardar la prueba: ${error.message}`);
    process.exitCode = 1;
  });
}
