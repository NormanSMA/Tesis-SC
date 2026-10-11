import { randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const TIPOS = ["consulta", "creacion", "actualizacion"];
const UMBRAL_MS = 2000;
const CICLO = ["consulta", "consulta", "consulta", "consulta", "consulta", "consulta", "consulta",
  "creacion", "creacion", "actualizacion"];
// Las rutas sin permiso para el perfil responden 403 en la preparación y se descartan.
// usuarios y configuracion solo las consulta el perfil ADMIN.
const RUTAS_CONSULTA = ["/api/v1/panel", "/api/v1/clientes", "/api/v1/cotizaciones",
  "/api/v1/ordenes", "/api/v1/produccion/tablero", "/api/v1/usuarios", "/api/v1/configuracion"];
// Solo Atención al cliente crea y edita clientes (cliente:gestionar). Los demás perfiles solo consultan.
const PERFILES_CON_ESCRITURA = new Set(["ATENCION_CLIENTE"]);
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
 * @param {{ duracionAlcanzada: boolean, errores4xxInesperados: number }} condiciones
 */
export function decidirCumplimiento(resumenes, errores5xx, condiciones) {
  return condiciones.duracionAlcanzada && condiciones.errores4xxInesperados === 0 &&
    errores5xx === 0 && ["global", ...TIPOS].every((tipo) => {
      const resumen = resumenes[tipo];
      return resumen !== undefined && resumen.n > 0 && resumen.p95 !== null &&
        resumen.p95 <= UMBRAL_MS && resumen.porcentajeHasta2000 >= 95;
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
    let cuerpo = null;
    try { cuerpo = texto ? JSON.parse(texto) : null; } catch { /* Conserva los errores HTTP sin JSON. */ }
    return { estado, ms, respondio: true, datos: cuerpo?.datos ?? null,
      cuerpo422: estado === 422 ? cuerpo : null,
      cookie: (respuesta.headers.get("set-cookie") ?? "").split(";")[0],
      error: respuesta.ok ? null : `HTTP_${estado}` };
  } catch (error) {
    return { estado, ms: performance.now() - inicio, respondio: false, datos: null, cookie: "",
      error: error?.name === "TimeoutError" ? "TIEMPO_AGOTADO" : "ERROR_RED" };
  }
}

function registrar422(contexto, tipo, { ruta, metodo = "GET", respuesta }) {
  if (respuesta.estado !== 422) return;
  const rutaNormalizada = ruta.replace(/\/clientes\/[^/]+/, "/clientes/:id");
  if (contexto.primeros422.some((error) => error.tipo === tipo && error.ruta === rutaNormalizada)) return;
  const error = respuesta.cuerpo422?.error;
  const camposPermitidos = new Set(["nombre", "tipo", "ruc", "telefono", "correo", "notas", "version",
    "contactoPrincipal", "direccion", "q", "activo", "pagina", "porPagina"]);
  // Conserve únicamente mensajes de validación conocidos; nunca valores enviados ni textos arbitrarios.
  const mensajes = /^(Hay (campos|parámetros) con errores\.|Falta la versión del cliente\. Recargue la página\.|El (nombre|RUC|contacto principal|teléfono|correo) admite hasta \d+ caracteres\.|Ingrese el nombre del cliente\.|Debe ser texto\.|Seleccione el tipo de cliente\.|Ingrese un correo electrónico válido\.|Indique un teléfono o un correo electrónico\.|Este campo no se puede modificar\.)$/;
  const sanear = (mensaje) => typeof mensaje === "string" && mensajes.test(mensaje) ? mensaje : "[Texto omitido]";
  const campos = Object.entries(error?.campos ?? {}).filter(([campo]) => camposPermitidos.has(campo));
  contexto.primeros422.push({ tipo, ruta: rutaNormalizada, metodo,
    cuerpo: { error: { codigo: error?.codigo === "VALIDACION" ? "VALIDACION" : "[Código omitido]",
      mensaje: sanear(error?.mensaje), campos: Object.fromEntries(campos.map(([campo, mensaje]) => [campo, sanear(mensaje)])) } } });
}

function registrarPreparacion(contexto, sesion, ruta, respuesta) {
  registrar422(contexto, "preparacion", { ruta, respuesta });
  contexto.preparacion.push({ sesion: sesion.numero, perfil: sesion.perfil, ruta,
    estado: respuesta.estado, respondio: respuesta.respondio, error: respuesta.error });
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
  for (const ruta of ["/api/v1/materiales"]) {
    const respuesta = await solicitar(sesion, { ruta });
    registrarPreparacion(contexto, sesion, ruta, respuesta);
    if (!respuesta.error) { sesion.rutas.push(ruta); break; }
    if (![403, 404].includes(respuesta.estado)) {
      throw new Error(`Materiales de sesión ${sesion.numero}: ${respuesta.error}.`);
    }
  }
  if (sesion.rutas.length === 0) throw new Error(`Sesión ${sesion.numero} sin consultas autorizadas.`);
}

function prepararOperacion(contexto, sesion, tipoSolicitado) {
  const tipo = PERFILES_CON_ESCRITURA.has(sesion.perfil) ? tipoSolicitado : "consulta";
  if (tipo === "consulta") {
    const ruta = sesion.rutas[sesion.consultas++ % sesion.rutas.length];
    return { tipo, ruta, metodo: "GET" };
  }
  if (tipo === "creacion") {
    const identificador = randomUUID();
    return { tipo, ruta: "/api/v1/clientes", metodo: "POST",
      cuerpo: { nombre: `RENDIMIENTO-${identificador}`, tipo: "EMPRESA",
        ruc: identificador.replaceAll("-", "").slice(0, 20), telefono: "8888 0000" } };
  }
  const cliente = sesion.clientes.at(-1);
  if (!cliente || typeof cliente.version !== "string" || !Number.isFinite(Date.parse(cliente.version))) {
    contexto.omitidas.push({ sesion: sesion.numero, tipo, motivo: "SIN_CLIENTE_CON_VERSION" });
    return null;
  }
  return { tipo, ruta: `/api/v1/clientes/${encodeURIComponent(cliente.id)}`, metodo: "PATCH",
    cuerpo: { notas: `Edición ${++cliente.ediciones}`, version: cliente.version } };
}

function guardarCliente(contexto, sesion, peticion, respuesta) {
  const cliente = respuesta.datos;
  if (peticion.metodo === "POST") {
    if (cliente?.id !== undefined && cliente.id !== null && !respuesta.error) {
      sesion.clientes.push({ id: String(cliente.id), version: cliente.actualizadoEn, ediciones: 0 });
    } else if (!respuesta.respondio || !respuesta.error) {
      contexto.creacionesInciertas.push({ sesion: sesion.numero, nombre: peticion.cuerpo.nombre });
    }
  }
  if (peticion.metodo === "PATCH" && !respuesta.error) {
    sesion.clientes.at(-1).version = cliente?.actualizadoEn;
  }
}

async function ejecutarOperacion(contexto, sesion, tipo) {
  const peticion = prepararOperacion(contexto, sesion, tipo);
  if (!peticion) return;
  const respuesta = await solicitar(sesion, peticion);
  registrar422(contexto, peticion.tipo, { ...peticion, respuesta });
  guardarCliente(contexto, sesion, peticion, respuesta);
  contexto.muestras.push({ sesion: sesion.numero, perfil: sesion.perfil, tipo: peticion.tipo,
    ruta: peticion.ruta, metodo: peticion.metodo, ms: respuesta.ms,
    estado: respuesta.estado, respondio: respuesta.respondio, error: respuesta.error });
  sesion.solicitudes++;
}

async function ejecutarSesion(contexto, sesion, fin) {
  while (performance.now() < fin) {
    for (const tipo of CICLO) {
      if (performance.now() >= fin) { sesion.duracionAlcanzada = true; return; }
      await ejecutarOperacion(contexto, sesion, tipo);
    }
    sesion.ciclos++;
  }
  sesion.duracionAlcanzada = performance.now() >= fin;
}

async function archivarClientes(contexto, sesion) {
  for (const cliente of sesion.clientes) {
    const ruta = `/api/v1/clientes/${encodeURIComponent(cliente.id)}/archivar`;
    const respuesta = await solicitar(sesion, { ruta, metodo: "POST", cuerpo: { version: cliente.version } });
    registrar422(contexto, "limpieza", { ruta, metodo: "POST", respuesta });
    contexto.limpieza.push({ sesion: sesion.numero, clienteId: cliente.id,
      estado: respuesta.estado, respondio: respuesta.respondio, archivado: respuesta.respondio && !respuesta.error,
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

function causasResultado(contexto, resumenes, errores) {
  const causas = [];
  if (contexto.errorEjecucion) causas.push(contexto.errorEjecucion);
  if (contexto.sesiones.length !== contexto.opciones.sesiones) causas.push("Faltan sesiones solicitadas.");
  if (contexto.duracionMedidaSegundos < contexto.opciones.duracion ||
      contexto.sesiones.some((sesion) => !sesion.duracionAlcanzada)) causas.push("No se alcanzó la duración solicitada.");
  if (errores.errores5xx) causas.push(`Respuestas 5xx: ${errores.errores5xx}.`);
  if (errores.errores4xxInesperados) causas.push(`Respuestas 4xx inesperadas: ${errores.errores4xxInesperados}.`);
  if (errores.red || errores.http > errores.errores5xx + errores.errores4xxInesperados) causas.push("Hubo errores de red u otros estados HTTP inesperados.");
  if (contexto.omitidas.length) causas.push(`Operaciones omitidas: ${contexto.omitidas.length}.`);
  if (contexto.creacionesInciertas.length) causas.push(`Creaciones inciertas: ${contexto.creacionesInciertas.length}.`);
  const pendientes = contexto.limpieza.filter((cliente) => !cliente.archivado).length;
  if (pendientes) causas.push(`Archivados fallidos: ${pendientes}. Consulte limpieza.`);
  for (const tipo of ["global", ...TIPOS]) {
    const resumen = resumenes[tipo];
    if (resumen.n === 0) causas.push(`Sin muestras de ${tipo}.`);
    else if (resumen.p95 > UMBRAL_MS || resumen.porcentajeHasta2000 < 95) causas.push(`Umbral temporal incumplido en ${tipo}.`);
  }
  return causas;
}

function crearResultado(contexto) {
  const resumenes = Object.fromEntries(TIPOS.map((tipo) =>
    [tipo, resumir(contexto.muestras.filter((muestra) => muestra.tipo === tipo))]));
  resumenes.global = resumir(contexto.muestras);
  const errores = contarErrores(contexto.muestras);
  const previos = contexto.preparacion.filter((peticion) => peticion.estado !== 403 || peticion.ruta === "/api/v1/auth/login");
  const erroresTotales = contarErrores([...contexto.muestras, ...previos, ...contexto.limpieza]);
  erroresTotales.errores4xxInesperados = [...contexto.muestras, ...previos, ...contexto.limpieza]
    .filter((peticion) => peticion.estado >= 400 && peticion.estado <= 499).length;
  const duracionAlcanzada = contexto.duracionMedidaSegundos >= contexto.opciones.duracion &&
    contexto.sesiones.length > 0 && contexto.sesiones.every((sesion) => sesion.duracionAlcanzada);
  const cumpleCriterioTemporal = decidirCumplimiento(resumenes, 0,
    { duracionAlcanzada: true, errores4xxInesperados: 0 });
  const causas = causasResultado(contexto, resumenes, erroresTotales);
  const completa = contexto.errorEjecucion === null && contexto.omitidas.length === 0 &&
    contexto.creacionesInciertas.length === 0 && contexto.sesiones.length === contexto.opciones.sesiones && duracionAlcanzada;
  const totalClientes = contexto.sesiones.reduce((total, sesion) => total + sesion.clientes.length, 0);
  const archivados = contexto.limpieza.filter((cliente) => cliente.archivado).length;
  return {
    requisito: "RNF-01", fechaUTC: new Date().toISOString(), opciones: contexto.opciones,
    entorno: { node: process.version, plataforma: process.platform, cpu: "POR_COMPLETAR",
      memoria: "POR_COMPLETAR", versionAplicacion: "POR_COMPLETAR" },
    metodologia: { modelo: "cerrado", mezclaPrevista: { consulta: 70, creacion: 20, actualizacion: 10 },
      percentiles: "rango más cercano", umbralMs: UMBRAL_MS, tiempoLimitePeticionMs: 30000 },
    inicioUTC: contexto.inicioUTC, duracionMedidaSegundos: contexto.duracionMedidaSegundos,
    sesiones: contexto.sesiones.map((sesion) => ({ numero: sesion.numero, perfil: sesion.perfil,
      rutas: sesion.rutas, solicitudes: sesion.solicitudes, ciclosCompletos: sesion.ciclos,
      duracionAlcanzada: sesion.duracionAlcanzada ?? false })),
    resumenes, mezclaObservada: Object.fromEntries(TIPOS.map((tipo) => [tipo,
      resumenes.global.n ? (resumenes[tipo].n / resumenes.global.n) * 100 : 0])),
    errores, erroresTotales, primeros422: contexto.primeros422, causas,
    preparacion: contexto.preparacion, omitidas: contexto.omitidas,
    creacionesInciertas: contexto.creacionesInciertas, limpieza: contexto.limpieza,
    resumenLimpieza: { archivados, total: totalClientes, pendientes: totalClientes - archivados },
    ejecucionCompleta: completa, errorEjecucion: contexto.errorEjecucion,
    cumpleCriterioTemporal, decision: completa ? (causas.length === 0 && decidirCumplimiento(resumenes,
      erroresTotales.errores5xx, { duracionAlcanzada, errores4xxInesperados: erroresTotales.errores4xxInesperados })
      ? "CUMPLE" : "NO CUMPLE") : "NO EVALUABLE",
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
  console.log(`Archivados: ${resultado.resumenLimpieza.archivados}/${resultado.resumenLimpieza.total}.`);
  for (const causa of resultado.causas) console.error(`Causa: ${causa}`);
  for (const cliente of resultado.limpieza.filter((cliente) => !cliente.archivado)) {
    console.error(`Archivado fallido: ${cliente.clienteId}; ${cliente.error ?? cliente.estado}.`);
  }
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
  const contexto = { opciones, sesiones: [], muestras: [], preparacion: [], limpieza: [], primeros422: [],
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
