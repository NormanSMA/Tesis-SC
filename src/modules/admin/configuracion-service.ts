import { can, exigir, type Actor } from "@/core/autorizacion";
import type { Material } from "@/generated/prisma/client";
import { z } from "zod";
import { registrarEvento } from "@/lib/bitacora";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errores";
import { actualizarCondicionado } from "@/modules/inventario/repo";

import { aConfiguracionDto } from "./configuracion-dto";
import { actualizarConfiguracion, bloquearConfiguracion, consultarConfiguracion } from "./configuracion-repo";
import { esTarifa, puedeGestionarTarifas } from "./tarifas-configuracion";
import {
  validarValorConfiguracion, validarVersionConfiguracion, type EntradaEditarConfiguracion,
} from "./configuracion-schema";

export async function listarConfiguracion(actor: Actor) {
  const tarifas = puedeGestionarTarifas(actor);
  if (!tarifas) exigir(actor, "configuracion:gestionar");
  const general = can(actor, "configuracion:gestionar");
  const [configuracion, materiales] = await Promise.all([consultarConfiguracion(prisma), tarifas
    ? prisma.material.findMany({ where: { activo: true }, orderBy: [{ nombre: "asc" }, { id: "asc" }] }) : []]);
  return [...configuracion.filter(({ clave }) => esTarifa(clave) ? tarifas : general).map(aConfiguracionDto),
    ...materiales.map(aPrecioMaterial)];
}

export async function editarConfiguracion(entrada: EntradaEditarConfiguracion, actor: Actor) {
  if (!esTarifa(entrada.clave)) exigir(actor, "configuracion:gestionar");
  else if (!puedeGestionarTarifas(actor)) throw new AppError({ status: 403, codigo: "SIN_PERMISO",
    mensaje: "Solo Gerencia y Administración pueden editar las tarifas." });
  if (entrada.clave.startsWith("material:")) return editarPrecioMaterial(entrada, actor);
  return prisma.$transaction(async (tx) => {
    const actual = await bloquearConfiguracion(tx, entrada.clave);
    if (!actual) {
      throw new AppError({ codigo: "NO_ENCONTRADO", mensaje: "El parámetro no existe.", status: 404 });
    }
    const valor = validarValorConfiguracion({ clave: actual.clave, tipo: actual.tipo, valor: entrada.valor });
    validarVersionConfiguracion(actual.actualizadoEn, entrada.version);
    if (valor === actual.valor) return aConfiguracionDto(actual);
    const nuevo = await actualizarConfiguracion(tx, { actual, valor, actorId: actor.id });
    await registrarEvento(tx, {
      entidad: "CONFIGURACION", entidadId: actual.id, accion: "EDITAR", actorId: actor.id,
      detalle: { clave: actual.clave, valor: { anterior: actual.valor, nuevo: valor } },
    });
    return aConfiguracionDto(nuevo);
  });
}

function aPrecioMaterial(material: Material) {
  return { clave: `material:${material.id}`, tipo: "TEXTO" as const,
    valor: material.precioCotizacion?.toFixed(4) ?? "", descripcion: `${material.codigo} · ${material.nombre} · C$ por ${material.unidadCotizacion ?? material.unidad}`,
    actualizadoEn: material.actualizadoEn.toISOString(), actualizadoPorId: null };
}

async function editarPrecioMaterial(entrada: EntradaEditarConfiguracion, actor: Actor) {
  const id = z.uuid().safeParse(entrada.clave.slice("material:".length));
  if (!id.success) throw new AppError({ status: 404, codigo: "NO_ENCONTRADO", mensaje: "El material no existe." });
  const precio = validarValorConfiguracion({ clave: entrada.clave, tipo: "TEXTO", valor: entrada.valor.trim() });
  return prisma.$transaction(async (tx) => {
    const material = await tx.material.findFirst({ where: { id: id.data, activo: true } });
    if (!material) throw new AppError({ status: 404, codigo: "NO_ENCONTRADO", mensaje: "El material activo no existe." });
    validarVersionConfiguracion(material.actualizadoEn, entrada.version);
    const anterior = material.precioCotizacion?.toFixed(4) ?? null;
    if (precio === "" ? anterior === null : anterior !== null && Number(precio) === Number(anterior)) return aPrecioMaterial(material);
    const actualizado = await actualizarCondicionado(tx, { id: material.id, version: entrada.version }, { precioCotizacion: precio || null });
    if (!actualizado) throw new AppError({ status: 409, codigo: "CONFLICTO_EDICION", mensaje: "El material cambió. Recargue los datos." });
    const nuevo = await tx.material.findUniqueOrThrow({ where: { id: material.id } });
    await registrarEvento(tx, { entidad: "MATERIAL", entidadId: material.id, accion: "EDITAR", actorId: actor.id,
      detalle: { precioCotizacion: { anterior, nuevo: nuevo.precioCotizacion?.toFixed(4) ?? null } } });
    return aPrecioMaterial(nuevo);
  });
}
