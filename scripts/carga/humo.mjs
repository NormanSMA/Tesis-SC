// Prueba de humo del backend contra la app local: node scripts/carga/humo.mjs [base]
// Salud, estado del sistema por permisos y validaciones del logo de cliente.
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3000";
const claves = Object.fromEntries(readFileSync(".env.example", "utf8").split(/\r?\n/)
  .filter((linea) => linea.startsWith("SEED_PASSWORD_")).map((linea) => linea.split("=").map((parte) => parte.trim().replace(/^"|"$/g, ""))));
let fallos = 0;
const revisar = (nombre, ok, detalle = "") => { if (!ok) fallos += 1; console.log(`${ok ? "OK   " : "FALLA"} ${nombre}${detalle ? ` (${detalle})` : ""}`); };

async function entrar(correo, clave) {
  const respuesta = await fetch(`${BASE}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ correo: `${correo}@solucionescreativas.test`, contrasena: claves[clave] }) });
  return respuesta.headers.getSetCookie().map((galleta) => galleta.split(";")[0]).join("; ");
}
const pedir = (ruta, galleta, opciones = {}) => fetch(`${BASE}${ruta}`, { ...opciones, headers: { Origin: BASE, Cookie: galleta, ...(opciones.headers ?? {}) } });

const salud = await fetch(`${BASE}/api/v1/salud`);
revisar("salud responde 200", salud.status === 200);
const admin = await entrar("roberto.diaz", "SEED_PASSWORD_ADMIN");
const gerencia = await entrar("gerardo.jimenez", "SEED_PASSWORD_GERENCIA");
const atencion = await entrar("valentina.castro", "SEED_PASSWORD_ATENCION_CLIENTE");
const produccion = await entrar("marco.lopez", "SEED_PASSWORD_PRODUCCION");
const sistema = await pedir("/api/v1/sistema", admin);
const datos = sistema.ok ? (await sistema.json()).datos : null;
revisar("estado del sistema para Administración técnica", sistema.status === 200, datos ? `p95 ${datos.rendimiento?.p95Ms ?? "?"} ms, BD ${datos.baseDatos?.latenciaMs ?? "?"} ms` : String(sistema.status));
revisar("estado del sistema niega a Gerencia", (await pedir("/api/v1/sistema", gerencia)).status === 403);

const clientes = await (await pedir("/api/v1/clientes?porPagina=1", atencion)).json();
const id = clientes.datos[0].id;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const subir = (cuerpo, galleta = atencion) => pedir(`/api/v1/clientes/${id}/logo`, galleta, { method: "PUT", body: cuerpo, headers: { "Content-Type": "application/octet-stream" } });
const valido = await subir(png);
revisar("logo PNG válido se guarda", valido.status === 200, String(valido.status));
const falso = await subir(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"));
revisar("SVG con script se rechaza con 415", falso.status === 415, String(falso.status));
const grande = await subir(Buffer.concat([png, Buffer.alloc(600 * 1024)]));
revisar("logo de más de 512 KB se rechaza con 413", grande.status === 413, String(grande.status));
revisar("Producción no puede subir logo (403)", (await subir(png, produccion)).status === 403);
const leer = await pedir(`/api/v1/clientes/${id}/logo`, gerencia);
revisar("Gerencia ve el logo con nosniff", leer.status === 200 && leer.headers.get("x-content-type-options") === "nosniff", leer.headers.get("content-type") ?? "");
revisar("quitar logo responde 204", (await pedir(`/api/v1/clientes/${id}/logo`, atencion, { method: "DELETE" })).status === 204);
revisar("sin logo responde 404", (await pedir(`/api/v1/clientes/${id}/logo`, gerencia)).status === 404);

console.log(fallos ? `\n${fallos} comprobaciones fallaron.` : "\nTodas las comprobaciones pasan.");
process.exit(fallos ? 1 : 0);
