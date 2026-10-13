#!/usr/bin/env node
// Comprueba RNF-04: TLS 1.2 o superior, rechazo de TLS 1.0 y 1.1, HSTS y redirección de http a https.
// Requiere el proxy en marcha (docker compose --profile proxy up -d proxy) y su certificado raíz:
//   docker compose cp proxy:/data/caddy/pki/authorities/local/root.crt ./respaldos/caddy-raiz.crt
// Uso: node scripts/verificar-tls.mjs   (variables opcionales: TRACORE_CA, TRACORE_HOST, TRACORE_PUERTO_TLS, TRACORE_PUERTO_HTTP)
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tls from "node:tls";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rutaCa = process.env.TRACORE_CA ?? path.join(raiz, "respaldos", "caddy-raiz.crt");
const nombre = process.env.TRACORE_HOST ?? "tracore.localhost";
const puertoTls = Number(process.env.TRACORE_PUERTO_TLS ?? 8443);
const puertoHttp = Number(process.env.TRACORE_PUERTO_HTTP ?? 8080);
const ca = readFileSync(rutaCa);

function intentar(version) {
  return new Promise((resolve) => {
    const antigua = version === "TLSv1" || version === "TLSv1.1";
    const opciones = { host: "127.0.0.1", port: puertoTls, servername: nombre, ca, minVersion: version, maxVersion: version };
    // Sin bajar el nivel de seguridad del cliente, OpenSSL 3 rechaza TLS 1.0 y 1.1 sin llegar al servidor (falso positivo).
    if (antigua) opciones.ciphers = "DEFAULT@SECLEVEL=0";
    const socket = tls.connect(opciones, () => {
      resolve({ version, aceptada: true, autorizada: socket.authorized, error: null });
      socket.end();
    });
    socket.on("error", (error) => resolve({ version, aceptada: false, autorizada: false, error: error.code ?? error.message }));
    socket.setTimeout(8000, () => { socket.destroy(); resolve({ version, aceptada: false, autorizada: false, error: "TIMEOUT" }); });
  });
}

function cabeceraHsts() {
  return new Promise((resolve) => {
    const peticion = https.get({ host: "127.0.0.1", port: puertoTls, servername: nombre, ca, path: "/login",
      headers: { Host: `${nombre}:${puertoTls}` } }, (respuesta) => {
      respuesta.resume();
      resolve({ estado: respuesta.statusCode, hsts: respuesta.headers["strict-transport-security"] ?? null });
    });
    peticion.on("error", (error) => resolve({ estado: null, hsts: null, error: error.code ?? error.message }));
  });
}

function redireccion() {
  return new Promise((resolve) => {
    const peticion = http.get({ host: "127.0.0.1", port: puertoHttp, path: "/", headers: { Host: `${nombre}:${puertoHttp}` } }, (respuesta) => {
      respuesta.resume();
      resolve({ estado: respuesta.statusCode, ubicacion: respuesta.headers.location ?? null });
    });
    peticion.on("error", (error) => resolve({ estado: null, ubicacion: null, error: error.code ?? error.message }));
  });
}

const filas = [];
for (const version of ["TLSv1", "TLSv1.1", "TLSv1.2", "TLSv1.3"]) {
  const r = await intentar(version);
  const antigua = version === "TLSv1" || version === "TLSv1.1";
  // Un rechazo válido es la alerta del servidor, no el rechazo del propio cliente.
  const ok = antigua ? !r.aceptada && /ALERT_PROTOCOL_VERSION|ALERT_HANDSHAKE_FAILURE/.test(String(r.error)) : r.aceptada && r.autorizada;
  filas.push({ prueba: `${version} ${antigua ? "debe rechazarse" : "debe aceptarse"}`, resultado: r.aceptada ? `aceptada (certificado ${r.autorizada ? "verificado" : "NO verificado"})` : `rechazada (${r.error})`, ok });
}
const hsts = await cabeceraHsts();
filas.push({ prueba: "HSTS presente en /login", resultado: hsts.hsts ?? `ausente (${hsts.error ?? hsts.estado})`, ok: Boolean(hsts.hsts) && hsts.estado === 200 });
const redir = await redireccion();
filas.push({ prueba: `http :${puertoHttp} redirige 308 a https`, resultado: `${redir.estado ?? redir.error} ${redir.ubicacion ?? ""}`.trim(),
  ok: redir.estado === 308 && String(redir.ubicacion).startsWith(`https://${nombre}:${puertoTls}`) });

console.log("Verificación TLS de TRACORE (RNF-04)");
for (const fila of filas) console.log(`${fila.ok ? "OK    " : "FALLA "} ${fila.prueba}: ${fila.resultado}`);
const fallas = filas.filter((f) => !f.ok).length;
console.log(fallas ? `\n${fallas} comprobaciones fallaron.` : "\nRNF-04 cumple: TLS 1.2 o superior, versiones antiguas rechazadas, HSTS y redirección activos.");
process.exit(fallas ? 1 : 0);
