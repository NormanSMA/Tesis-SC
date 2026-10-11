import { randomUUID } from "node:crypto";

import type { Tx } from "../../src/lib/db";
import type { DatosSiembra } from "./cargar-datos";
import type { Catalogos, UnidadCobro } from "./tipos";

// Valores que copian las cotizaciones al crearse (snapshot). Viven también en la tabla configuracion.
export const TASA_IVA_PCT = "15.00";
export const MONEDA = "NIO";
export const CLAVE_MARCADOR = "siembra_version";
export const VERSION_SIEMBRA = "1";

const CONFIGURACION = [
  { clave: "iva_porcentaje", tipo: "DECIMAL", valor: TASA_IVA_PCT, descripcion: "IVA vigente en porcentaje" },
  { clave: "cotizacion_vigencia_dias", tipo: "ENTERO", valor: "15", descripcion: "Días de vigencia de una cotización" },
  { clave: "moneda", tipo: "TEXTO", valor: MONEDA, descripcion: "Moneda de los documentos (ISO 4217)" },
  { clave: "empresa_nombre", tipo: "TEXTO", valor: "Soluciones Creativas", descripcion: "Nombre impreso en las proformas" },
  { clave: "zona_horaria", tipo: "TEXTO", valor: "America/Managua", descripcion: "Zona horaria de las fechas de calendario" },
] as const;

export async function sembrarConfiguracion(db: Tx): Promise<void> {
  await db.configuracion.createMany({ data: CONFIGURACION.map((fila) => ({ ...fila })) });
}

export type OpcionesCatalogos = {
  datos: DatosSiembra;
  hashes: Map<string, string>;
  creadoEn: Date;
};

type Entrada = OpcionesCatalogos & { db: Tx };

async function sembrarAreasYCategorias({ db, datos }: Entrada) {
  const areas = new Map(datos.areas.map((a) => [a.nombre, randomUUID()]));
  const categorias = new Map(datos.categorias.map((c) => [c.nombre, randomUUID()]));
  await db.area.createMany({ data: datos.areas.map((a) => ({ id: areas.get(a.nombre), nombre: a.nombre })) });
  await db.categoria.createMany({
    data: datos.categorias.map((c) => ({ id: categorias.get(c.nombre), nombre: c.nombre, descripcion: c.descripcion })),
  });
  return { areas, categorias };
}

async function sembrarPlantillas(entrada: Entrada, areas: Map<string, string>, categorias: Map<string, string>) {
  const plantillas: Catalogos["plantillas"] = new Map();
  const filas = entrada.datos.plantillas.flatMap(({ categoria, etapas }) =>
    etapas.map((etapa) => ({
      id: randomUUID(),
      categoriaId: categorias.get(categoria) as string,
      areaId: areas.get(etapa.area) as string,
      secuencia: etapa.secuencia,
      nombre: etapa.nombre,
    })),
  );
  await entrada.db.etapaPlantilla.createMany({ data: filas });
  for (const { categoria, etapas } of entrada.datos.plantillas) {
    const idCategoria = categorias.get(categoria) as string;
    const propias = filas.filter((fila) => fila.categoriaId === idCategoria);
    plantillas.set(
      categoria,
      etapas.map((etapa) => {
        const fila = propias.find((f) => f.secuencia === etapa.secuencia) as (typeof filas)[number];
        return { id: fila.id, nombre: fila.nombre, areaId: fila.areaId, secuencia: fila.secuencia };
      }),
    );
  }
  return plantillas;
}

async function sembrarUsuarios({ db, datos, hashes, creadoEn }: Entrada) {
  const perfiles = await db.perfil.findMany({ select: { id: true, codigo: true } });
  const idPerfil = new Map(perfiles.map((p) => [p.codigo as string, p.id]));
  const usuarios: Catalogos["usuarios"] = new Map();
  const filas = datos.usuarios.map((u) => {
    const id = randomUUID();
    usuarios.set(u.clave, { id, nombre: u.nombre, perfil: u.perfil });
    return {
      id,
      nombre: u.nombre,
      correo: u.correo.toLowerCase(),
      hashContrasena: hashes.get(u.correo) as string,
      creadoEn,
    };
  });
  await db.usuario.createMany({ data: filas });
  await db.usuarioPerfil.createMany({
    data: datos.usuarios.map((u) => ({
      usuarioId: usuarios.get(u.clave)!.id,
      perfilId: idPerfil.get(u.perfil) as string,
      creadoEn,
    })),
  });
  return usuarios;
}

// Los materiales nacen con existencia 0. El costo promedio inicial es solo un precio de referencia
// y la base lo permite mientras no haya existencia. La existencia llega por el libro de inventario.
async function sembrarMateriales({ db, datos, creadoEn }: Entrada) {
  const materiales: Catalogos["materiales"] = new Map();
  const filas = datos.materiales.map((m) => {
    const id = randomUUID();
    const costoUnitario = String(m.costoUnitario);
    materiales.set(m.codigo, { id, codigo: m.codigo, nombre: m.nombre, unidad: m.unidad, costoUnitario });
    return {
      id,
      codigo: m.codigo,
      nombre: m.nombre,
      unidad: m.unidad,
      costoPromedio: costoUnitario,
      stockMinimo: String(m.stockMinimo),
      creadoEn,
    };
  });
  await db.material.createMany({ data: filas });
  return materiales;
}

async function sembrarProductosYRecetas(entrada: Entrada, categorias: Map<string, string>, materiales: Catalogos["materiales"]) {
  const { db, datos, creadoEn } = entrada;
  const productos: Catalogos["productos"] = new Map();
  const filas = datos.productos.map((p) => {
    const id = randomUUID();
    const categoriaId = categorias.get(p.categoria) as string;
    const precioBase = String(p.precioBase);
    productos.set(p.codigo, { id, codigo: p.codigo, nombre: p.nombre, categoriaId, unidadCobro: p.unidadCobro as UnidadCobro, precioBase });
    return { id, codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion, categoriaId, unidadCobro: p.unidadCobro, precioBase, creadoEn };
  });
  await db.producto.createMany({ data: filas });

  const recetas: Catalogos["recetas"] = new Map();
  const filasReceta = datos.recetas.flatMap((receta) => {
    const productoId = (productos.get(receta.producto) as { id: string }).id;
    const lineas = receta.materiales.map((l) => ({ materialId: (materiales.get(l.material) as { id: string }).id, cantidad: l.cantidad }));
    recetas.set(receta.producto, lineas);
    return lineas.map((l) => ({ productoId, materialId: l.materialId, cantidad: String(l.cantidad) }));
  });
  await db.recetaProducto.createMany({ data: filasReceta });
  return { productos, recetas };
}

async function sembrarClientes({ db, datos, creadoEn }: Entrada) {
  const clientes: Catalogos["clientes"] = new Map();
  const filas = datos.clientes.map((c) => {
    const id = randomUUID();
    clientes.set(c.nombre, id);
    return { id, ...c, creadoEn };
  });
  await db.cliente.createMany({ data: filas });
  return clientes;
}

export async function sembrarCatalogos(db: Tx, opciones: OpcionesCatalogos): Promise<Catalogos> {
  const entrada = { db, ...opciones };
  const { areas, categorias } = await sembrarAreasYCategorias(entrada);
  const plantillas = await sembrarPlantillas(entrada, areas, categorias);
  const usuarios = await sembrarUsuarios(entrada);
  const materiales = await sembrarMateriales(entrada);
  const { productos, recetas } = await sembrarProductosYRecetas(entrada, categorias, materiales);
  const clientes = await sembrarClientes(entrada);
  return { usuarios, clientes, categorias, areas, materiales, productos, plantillas, recetas };
}
