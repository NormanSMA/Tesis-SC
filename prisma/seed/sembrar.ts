import type { PrismaClient } from "../../src/generated/prisma/client";
import { hashearContrasena } from "../../src/lib/auth/password";
import type { Tx } from "../../src/lib/db";
import { cargarDatos, type DatosSiembra } from "./cargar-datos";
import { CLAVE_MARCADOR, sembrarCatalogos, sembrarConfiguracion, VERSION_SIEMBRA } from "./catalogos";
import { sembrarCotizacion } from "./cotizaciones";
import { leerClaves, type ClavesSiembra, type EntornoLeido } from "./entorno";
import { crearReloj, instante, type Reloj } from "./fechas";
import { ejecutarLibro, planificarLibro } from "./inventario";
import { sembrarOrden, type OrdenSembrada } from "./ordenes";
import { sembrarReferencia } from "./referencia";
import { escribir } from "./salida";
import type { Contexto } from "./tipos";

export type OpcionesSiembra = {
  env: EntornoLeido;
  // Instante de referencia de "hoy". Por defecto, el momento de la ejecución.
  ahora?: Date;
  silenciosa?: boolean;
};

export type DocumentoSembrado = {
  escenario: string;
  cotizacion: string;
  estadoCotizacion: string;
  orden: string | null;
  estadoOrden: string | null;
};

export type ResultadoSiembra = { omitida: boolean; documentos: DocumentoSembrado[] };

// Cada usuario lleva su propio hash: argon2id genera una sal distinta aunque la clave se comparta.
async function hashearUsuarios(datos: DatosSiembra, claves: ClavesSiembra): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  for (const usuario of datos.usuarios) {
    hashes.set(usuario.correo, await hashearContrasena(claves[usuario.perfil]));
  }
  return hashes;
}

// Orden cronológico de creación: así la numeración sigue la antigüedad de cada documento.
async function sembrarDocumentos(ctx: Contexto, datos: DatosSiembra): Promise<DocumentoSembrado[]> {
  const escenarios = datos.escenarios
    .map((escenario, posicion) => ({ escenario, posicion }))
    .sort((a, b) => b.escenario.diasAtras - a.escenario.diasAtras || a.posicion - b.posicion);
  const ordenes = new Map<string, OrdenSembrada>();
  const documentos: DocumentoSembrado[] = [];
  for (const [indice, { escenario }] of escenarios.entries()) {
    const cotizacion = await sembrarCotizacion(ctx, { escenario, indice });
    if (escenario.orden && escenario.estadoFinal !== "APROBADA") {
      throw new Error(`${escenario.clave}: solo una cotización APROBADA puede tener orden`);
    }
    const orden = escenario.orden ? await sembrarOrden(ctx, cotizacion) : null;
    if (orden) ordenes.set(escenario.clave, orden);
    documentos.push({
      escenario: escenario.clave,
      cotizacion: cotizacion.numero,
      estadoCotizacion: escenario.estadoFinal,
      orden: orden?.numero ?? null,
      estadoOrden: orden?.estado ?? null,
    });
  }
  await ejecutarLibro(ctx, planificarLibro({ datos, contexto: ctx, ordenes }));
  return documentos;
}

async function sembrarTodo(
  tx: Tx,
  entrada: { datos: DatosSiembra; hashes: Map<string, string>; reloj: Reloj },
): Promise<DocumentoSembrado[]> {
  const { datos, hashes, reloj } = entrada;
  await sembrarReferencia(tx);
  await sembrarConfiguracion(tx);
  // Los catálogos nacen antes que el primer movimiento de inventario.
  const catalogos = await sembrarCatalogos(tx, { datos, hashes, creadoEn: instante(reloj, 65, 8) });
  const ctx: Contexto = { db: tx, reloj, catalogos, bitacora: { eventos: [] } };
  const documentos = await sembrarDocumentos(ctx, datos);
  await tx.bitacora.createMany({ data: ctx.bitacora.eventos });
  // El marcador se escribe al final: si algo falla antes, la transacción entera se revierte.
  await tx.configuracion.create({
    data: { clave: CLAVE_MARCADOR, tipo: "ENTERO", valor: VERSION_SIEMBRA, descripcion: "Versión de la siembra de datos de demostración" },
  });
  return documentos;
}

// Idempotente: si el marcador existe no toca nada. Una sola transacción: un fallo no deja datos a medias.
export async function sembrar(db: PrismaClient, opciones: OpcionesSiembra): Promise<ResultadoSiembra> {
  const salida = opciones.silenciosa ? () => undefined : escribir;
  const marcador = await db.configuracion.findUnique({ where: { clave: CLAVE_MARCADOR } });
  if (marcador) {
    salida(`La base ya está sembrada (${CLAVE_MARCADOR} = ${marcador.valor}). No se cambia nada.`);
    return { omitida: true, documentos: [] };
  }
  const claves = leerClaves(opciones.env);
  const datos = cargarDatos();
  salida("Sembrando datos de demostración...");
  const hashes = await hashearUsuarios(datos, claves);
  const reloj = crearReloj(opciones.ahora);
  const documentos = await db.$transaction((tx) => sembrarTodo(tx, { datos, hashes, reloj }), {
    maxWait: 10_000,
    timeout: 300_000,
  });
  salida(`Siembra completada: ${documentos.length} escenarios.`);
  return { omitida: false, documentos };
}
