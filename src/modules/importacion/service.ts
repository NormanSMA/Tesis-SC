import type { z } from "zod";

import { exigir, type Actor } from "@/core/autorizacion";
import { prisma, type Tx } from "@/lib/db";
import { aErrorHttp } from "@/lib/errores";
import type { EntradaCrearCliente } from "@/modules/clientes/schema";
import { crearCliente } from "@/modules/clientes/service";
import type { CrearMaterial } from "@/modules/inventario/schema";
import { crearMaterial } from "@/modules/inventario/service";

import { analizarCsv } from "./csv";
import { esquemaFilaCliente, esquemaFilaMaterial } from "./schema";
import { COLUMNAS, type FilaCsv, type ResultadoImportacion, type TipoImportacion } from "./tipos";

type Preparacion<T> = {
  resultado: ResultadoImportacion;
  nuevas: { fila: FilaCsv; entrada: T }[];
};

function normalizarNombre(nombre: string): string {
  return nombre.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

function validarFilas<T>(texto: string, tipo: TipoImportacion, esquema: z.ZodType<T>): Preparacion<T> {
  const analisis = analizarCsv(texto, COLUMNAS[tipo]);
  const resultado: ResultadoImportacion = { total: analisis.total, validas: [], errores: [...analisis.errores],
    duplicados: [], creadas: 0, omitidasDuplicadas: 0, conError: 0, filas: [], confirmado: false };
  const nuevas: Preparacion<T>["nuevas"] = [];
  for (const fila of analisis.filas) {
    const lectura = esquema.safeParse(fila.datos);
    if (lectura.success) nuevas.push({ fila, entrada: lectura.data });
    else resultado.errores.push({ fila: fila.fila,
      mensaje: [...new Set(lectura.error.issues.map((error) => `${error.path.join(".")}: ${error.message}`))].join(" ") });
  }
  return { resultado, nuevas };
}

function omitirDuplicados<T>(preparacion: Preparacion<T>, duplicado: (entrada: T) => string | null): Preparacion<T> {
  const nuevas = preparacion.nuevas.filter(({ fila, entrada }) => {
    const mensaje = duplicado(entrada);
    if (!mensaje) return true;
    preparacion.resultado.duplicados.push({ fila: fila.fila, mensaje });
    return false;
  });
  preparacion.resultado.validas = nuevas.map(({ fila }) => fila);
  preparacion.resultado.errores.sort((a, b) => a.fila - b.fila);
  return { resultado: preparacion.resultado, nuevas };
}

async function prepararClientes(tx: Tx, texto: string): Promise<Preparacion<EntradaCrearCliente>> {
  const preparacion = validarFilas(texto, "clientes", esquemaFilaCliente);
  if (!preparacion.nuevas.length) return preparacion;
  const existentes = await tx.cliente.findMany({ select: { nombre: true, ruc: true } });
  const nombres = new Set(existentes.map(({ nombre }) => normalizarNombre(nombre)));
  const rucs = new Set(existentes.flatMap(({ ruc }) => ruc ? [ruc.replace(/\s+/g, "").toUpperCase()] : []));
  return omitirDuplicados(preparacion, (entrada) => {
    const nombre = normalizarNombre(entrada.nombre);
    if (entrada.ruc && rucs.has(entrada.ruc)) return "Cliente omitido: RUC duplicado.";
    if (nombres.has(nombre)) return "Cliente omitido: nombre normalizado duplicado.";
    nombres.add(nombre);
    if (entrada.ruc) rucs.add(entrada.ruc);
    return null;
  });
}

async function prepararMateriales(tx: Tx, texto: string): Promise<Preparacion<CrearMaterial>> {
  const preparacion = validarFilas(texto, "materiales", esquemaFilaMaterial);
  if (!preparacion.nuevas.length) return preparacion;
  const existentes = await tx.material.findMany({
    where: { codigo: { in: preparacion.nuevas.map(({ entrada }) => entrada.codigo) } }, select: { codigo: true },
  });
  const codigos = new Set(existentes.map(({ codigo }) => codigo));
  return omitirDuplicados(preparacion, (entrada) => {
    if (codigos.has(entrada.codigo)) return "Material omitido: código duplicado.";
    codigos.add(entrada.codigo);
    return null;
  });
}

export async function validarClientes(texto: string, actor: Actor): Promise<ResultadoImportacion> {
  exigir(actor, "cliente:gestionar");
  return resumir((await prepararClientes(prisma, texto)).resultado);
}

export async function validarMateriales(texto: string, actor: Actor): Promise<ResultadoImportacion> {
  exigir(actor, "material:gestionar");
  return resumir((await prepararMateriales(prisma, texto)).resultado);
}

function resumir(resultado: ResultadoImportacion): ResultadoImportacion {
  const invalidas = new Set([...resultado.errores, ...resultado.duplicados].map(({ fila }) => fila));
  resultado.validas = resultado.validas.filter(({ fila }) => !invalidas.has(fila));
  resultado.omitidasDuplicadas = new Set(resultado.duplicados.map(({ fila }) => fila)).size;
  resultado.conError = new Set(resultado.errores.map(({ fila }) => fila)).size;
  resultado.filas = [
    ...resultado.validas.map(({ fila }) => ({ fila, estado: resultado.confirmado ? "CREADA" as const : "VALIDA" as const })),
    ...resultado.duplicados.map((fila) => ({ ...fila, estado: "DUPLICADA" as const })),
    ...resultado.errores.map((fila) => ({ ...fila, estado: "ERROR" as const })),
  ].sort((a, b) => a.fila - b.fila);
  resultado.errores.sort((a, b) => a.fila - b.fila);
  resultado.duplicados.sort((a, b) => a.fila - b.fila);
  return resultado;
}

async function importarFilas<T>(preparacion: Preparacion<T>, crear: (entrada: T) => Promise<unknown>): Promise<ResultadoImportacion> {
  const { resultado, nuevas } = preparacion;
  resultado.confirmado = true;
  for (const { fila, entrada } of nuevas) {
    try {
      await crear(entrada);
      resultado.creadas += 1;
    } catch (problema) {
      const { cuerpo: { error } } = aErrorHttp(problema);
      const incidencias = error.codigo === "DUPLICADO" ? resultado.duplicados : resultado.errores;
      incidencias.push({ fila: fila.fila, mensaje: error.mensaje });
    }
  }
  return resumir(resultado);
}

export async function importarClientes(texto: string, actor: Actor): Promise<ResultadoImportacion> {
  exigir(actor, "cliente:gestionar");
  return importarFilas(await prepararClientes(prisma, texto), (entrada) => crearCliente(entrada, actor));
}

export async function importarMateriales(texto: string, actor: Actor): Promise<ResultadoImportacion> {
  exigir(actor, "material:gestionar");
  return importarFilas(await prepararMateriales(prisma, texto), (entrada) => crearMaterial(entrada, actor));
}
