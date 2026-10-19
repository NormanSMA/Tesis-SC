import type { Actor } from "@/core/autorizacion";
import { registrarEvento } from "@/lib/bitacora";
import { prisma, type Tx } from "@/lib/db";
import { AppError } from "@/lib/errores";

import {
  bloquearClienteParaLogo,
  borrarLogoCliente,
  buscarLogoCliente,
  buscarVersionLogo,
  guardarLogoCliente,
} from "./repo";

export const LIMITE_LOGO_BYTES = 524288;

function exigirTamano(tamano: number): void {
  if (tamano <= LIMITE_LOGO_BYTES) return;
  throw new AppError({
    codigo: "LOGO_DEMASIADO_GRANDE",
    mensaje: "El logo no puede superar los 512 KB.",
    status: 413,
  });
}

export function validarLogo(contenido: Uint8Array): string {
  exigirTamano(contenido.byteLength);
  const empiezaCon = (firma: number[]) => firma.every((byte, indice) => contenido[indice] === byte);
  if (empiezaCon([0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (empiezaCon([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (
    contenido.length >= 12 && empiezaCon([0x52, 0x49, 0x46, 0x46]) &&
    [0x57, 0x45, 0x42, 0x50].every((byte, indice) => contenido[indice + 8] === byte)
  ) return "image/webp";
  throw new AppError({
    codigo: "TIPO_LOGO_INVALIDO",
    mensaje: "El logo debe ser una imagen PNG, JPEG o WebP.",
    status: 415,
  });
}

export async function leerContenidoLogo(req: Request): Promise<Uint8Array<ArrayBuffer>> {
  exigirTamano(Number(req.headers.get("content-length") ?? 0));
  const lector = req.body?.getReader();
  if (!lector) return new Uint8Array();
  const partes: Uint8Array[] = [];
  let tamano = 0;
  try {
    while (true) {
      const { done, value } = await lector.read();
      if (done) break;
      tamano += value.byteLength;
      if (tamano > LIMITE_LOGO_BYTES) {
        await lector.cancel();
        exigirTamano(tamano);
      }
      partes.push(value);
    }
  } finally {
    lector.releaseLock();
  }
  const contenido = new Uint8Array(tamano);
  let posicion = 0;
  for (const parte of partes) {
    contenido.set(parte, posicion);
    posicion += parte.byteLength;
  }
  return contenido;
}

function clienteNoEncontrado(): AppError {
  return new AppError({ codigo: "NO_ENCONTRADO", mensaje: "El cliente no existe.", status: 404 });
}

async function exigirClienteEditable(tx: Tx, id: string): Promise<void> {
  const cliente = await bloquearClienteParaLogo(tx, id);
  if (!cliente) throw clienteNoEncontrado();
  if (!cliente.activo) {
    throw new AppError({
      codigo: "CLIENTE_ARCHIVADO",
      mensaje: "Un cliente archivado no se puede editar. Reactívelo primero.",
      status: 409,
    });
  }
}

export async function obtenerLogo(id: string) {
  const cliente = await buscarLogoCliente(prisma, id);
  if (!cliente) throw clienteNoEncontrado();
  if (!cliente.logo) {
    throw new AppError({ codigo: "NO_ENCONTRADO", mensaje: "El cliente no tiene logo.", status: 404 });
  }
  return cliente.logo;
}

type EdicionLogo = { id: string; actor: Actor; anterior: string | null; nuevo: string | null };

function registrarEdicion(tx: Tx, { id, actor, anterior, nuevo }: EdicionLogo) {
  return registrarEvento(tx, {
    entidad: "CLIENTE",
    entidadId: id,
    accion: "EDITAR",
    actorId: actor.id,
    detalle: { cambios: { logoVersion: { anterior, nuevo } } },
  });
}

export async function subirLogo(id: string, contenido: Uint8Array, actor: Actor) {
  const tipo = validarLogo(contenido);
  return prisma.$transaction(async (tx) => {
    await exigirClienteEditable(tx, id);
    const anterior = (await buscarVersionLogo(tx, id))?.actualizadoEn.toISOString() ?? null;
    const logoVersion = (await guardarLogoCliente(tx, { id, contenido, tipo })).toISOString();
    await registrarEdicion(tx, { id, actor, anterior, nuevo: logoVersion });
    return { logoVersion };
  });
}

export async function quitarLogo(id: string, actor: Actor): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await exigirClienteEditable(tx, id);
    const anterior = await buscarVersionLogo(tx, id);
    if (!anterior) return;
    await borrarLogoCliente(tx, id);
    await registrarEdicion(tx, { id, actor, anterior: anterior.actualizadoEn.toISOString(), nuevo: null });
  });
}
