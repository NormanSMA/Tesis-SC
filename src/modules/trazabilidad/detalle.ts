import type { AccionBitacora } from "@/generated/prisma/client";
import { textoValor } from "./etiquetas";

type Regla = "valor" | "dinero" | "cliente" | { [campo: string]: Regla } | readonly [Regla];
type Escalar = string | number | boolean | null;
export type DetalleVisible = { [campo: string]: Escalar | DetalleVisible | (Escalar | DetalleVisible)[] };
export type AccesoDetalle = { dinero: boolean; cliente: boolean; nombres?: ReadonlyMap<string, string> };
const cambio: Regla = { anterior: "valor", nuevo: "valor" };
const cambioDinero: Regla = { anterior: "dinero", nuevo: "dinero" };
const material: Regla = { id: "valor", codigo: "valor", nombre: "valor", unidad: "valor" };
const totales: Regla = { subtotal: "dinero", descuento: "dinero", impuesto: "dinero", tasaImpuesto: "dinero",
  total: "dinero", margenPct: "dinero" };
const campos: Record<string, Regla> = {
  nombre: cambio, asunto: cambio, responsableId: cambio, fechaEntrega: cambio, especificaciones: cambio,
  fechaInicioPlan: cambio, fechaFinPlan: cambio, areaId: cambio, descripcion: cambio, activo: cambio,
  contactoPrincipal: cambio, telefono: cambio, correo: cambio, tipo: cambio,
  condiciones: cambio, vigenciaDias: cambio, stockMinimo: cambio, codigo: cambio, unidadCobro: cambio,
  ruc: { anterior: "cliente", nuevo: "cliente" }, direccion: { anterior: "cliente", nuevo: "cliente" },
  costoPromedio: cambioDinero, precioBase: cambioDinero, descuento: cambioDinero, margenPct: cambioDinero,
};
const fichaMaterial: Regla = { ...material, stockMinimo: "valor", costoPromedio: "dinero" };
const linea: Regla = { secuencia: "valor", tipo: "valor", descripcion: "valor", unidad: "valor", cantidad: "valor",
  materialId: "valor", mermaPct: "valor", costoUnitario: "dinero", importe: "dinero" };
const item: Regla = { secuencia: "valor", descripcion: "valor", tipo: "valor", unidadCobro: "valor", cantidad: "valor",
  ancho: "valor", alto: "valor", importe: "dinero", precioUnitario: "dinero", costoTotal: "dinero", margenPct: "dinero", lineas: [linea] };
const movimiento = { motivo: "valor", referencia: "valor", cantidad: "valor", material, materialId: "valor",
  existenciaResultante: "valor", costoUnitario: "dinero", costoPromedioResultante: "dinero" } satisfies Record<string, Regla>;

// Cada nivel se proyecta por su propia lista; nunca se copian objetos del evento.
export const LISTA_DETALLE: Record<AccionBitacora, Record<string, Regla>> = {
  CREAR: { nombre: "valor", codigo: "valor", asunto: "valor", tipo: "valor", secuencia: "valor", areaId: "valor",
    material: fichaMaterial, totales, cotizacionOrigenId: "valor",
    items: [{ secuencia: "valor", descripcion: "valor", importe: "dinero" }] },
  EDITAR: { ...campos, nombre: cambio, motivo: "valor", cambios: campos, antes: fichaMaterial, despues: fichaMaterial,
    totales: { anterior: totales, nuevo: totales },
    items: [{ accion: "valor", secuencia: "valor", descripcion: "valor", anterior: item, nuevo: item }] },
  CAMBIAR_ESTADO: { motivo: "valor", fechaEmision: "valor", fechaVencimiento: "valor" },
  ASIGNAR_RESPONSABLE: { responsableId: cambio },
  CONVERTIR_EN_ORDEN: { cotizacionNumero: "valor", advertencias: [{ itemSecuencia: "valor", lineaSecuencia: "valor", mensaje: "valor" }] },
  REGISTRAR_ENTRADA: movimiento, AJUSTAR_INVENTARIO: movimiento, CONSUMIR_MATERIAL: movimiento, DEVOLVER_MATERIAL: movimiento,
  ARCHIVAR: { motivo: "valor", activo: cambio, archivada: cambio, cambios: { activo: cambio } },
  REACTIVAR: { motivo: "valor", activo: cambio, cambios: { activo: cambio } },
  OTORGAR_PERMISO: { recurso: "valor", accion: "valor", perfil: "valor" },
  REVOCAR_PERMISO: { recurso: "valor", accion: "valor", perfil: "valor" },
};

function permiteDetalle(regla: "valor" | "dinero" | "cliente", acceso: AccesoDetalle): boolean {
  return regla === "valor" || acceso[regla];
}

function proyectarEscalar(valor: unknown, acceso: AccesoDetalle): Escalar | undefined {
  if (valor === null || typeof valor === "number" || typeof valor === "boolean") return valor;
  if (typeof valor === "string") return acceso.nombres?.get(valor) ?? textoValor(valor);
}

function proyectarLista(valor: unknown, regla: Regla, acceso: AccesoDetalle): DetalleVisible[string] | undefined {
  if (!Array.isArray(valor)) return;
  return valor.flatMap((fila) => {
    const visible = proyectar(fila, regla, acceso);
    return visible === undefined ? [] : [visible];
  }) as (Escalar | DetalleVisible)[];
}

function tieneContenido(dato: DetalleVisible[string] | undefined): dato is DetalleVisible[string] {
  return dato !== undefined && (typeof dato !== "object" || dato === null || Object.keys(dato).length > 0);
}

function proyectarObjeto(valor: unknown, regla: Regla, acceso: AccesoDetalle): DetalleVisible | undefined {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return;
  const visible: DetalleVisible = {};
  for (const [campo, permiso] of Object.entries(regla)) {
    const dato = proyectar((valor as Record<string, unknown>)[campo], permiso, acceso);
    if (tieneContenido(dato)) visible[campo] = dato;
  }
  return Object.keys(visible).length ? visible : undefined;
}

function proyectar(valor: unknown, regla: Regla, acceso: AccesoDetalle): DetalleVisible[string] | undefined {
  if (typeof regla === "string") return permiteDetalle(regla, acceso) ? proyectarEscalar(valor, acceso) : undefined;
  if (Array.isArray(regla)) return proyectarLista(valor, regla[0], acceso);
  return proyectarObjeto(valor, regla, acceso);
}

export function filtrarDetalle(accion: AccionBitacora, valor: unknown, acceso: AccesoDetalle): DetalleVisible {
  return proyectar(valor, LISTA_DETALLE[accion] ?? {}, acceso) as DetalleVisible ?? {};
}

const ETIQUETAS: Record<string, string> = { nombre: "Nombre", asunto: "Asunto", responsableId: "Responsable",
  fechaEntrega: "Fecha de entrega", especificaciones: "Especificaciones", fechaInicioPlan: "Inicio planificado",
  fechaFinPlan: "Fin planificado", areaId: "Área", motivo: "Motivo", cantidad: "Cantidad", referencia: "Referencia",
  costoUnitario: "Costo unitario", costoPromedioResultante: "Costo promedio", material: "Material", total: "Total",
  importe: "Importe", subtotal: "Subtotal", descuento: "Descuento", impuesto: "Impuesto", margenPct: "Margen",
  tasaImpuesto: "Tasa de impuesto", precioBase: "Precio base", costoPromedio: "Costo promedio", cotizacionNumero: "Cotización",
  materialId: "Material", existenciaResultante: "Existencia resultante", codigo: "Código", tipo: "Tipo", secuencia: "Secuencia",
  cotizacionOrigenId: "Cotización de origen", itemSecuencia: "Ítem", lineaSecuencia: "Línea", mensaje: "Aviso",
  recurso: "Recurso", accion: "Acción", perfil: "Perfil", descripcion: "Descripción", contactoPrincipal: "Contacto",
  telefono: "Teléfono", correo: "Correo", ruc: "RUC", direccion: "Dirección", condiciones: "Condiciones",
  vigenciaDias: "Vigencia en días", stockMinimo: "Existencia mínima", activo: "Activo", archivada: "Archivada",
  fechaEmision: "Fecha de emisión", fechaVencimiento: "Fecha de vencimiento", unidad: "Unidad", unidadCobro: "Unidad de cobro",
  ancho: "Ancho", alto: "Alto", costoTotal: "Costo total", precioUnitario: "Precio unitario", mermaPct: "Merma" };

function textoDato(dato: DetalleVisible[string] | undefined): string {
  if (dato === null || dato === undefined) return "Sin asignar";
  if (typeof dato === "object") return "Datos actualizados";
  return typeof dato === "boolean" ? dato ? "Sí" : "No" : String(dato);
}
function resumirCampo(campo: string, valor: DetalleVisible[string]): string[] {
  const etiqueta = ETIQUETAS[campo] ?? campo;
  if (valor === null) return [];
  if (typeof valor !== "object") return [`${etiqueta}: ${textoDato(valor)}`];
  if (Array.isArray(valor)) return valor.flatMap((fila) => resumirCampo(campo, fila));
  if ("anterior" in valor || "nuevo" in valor) {
    if (JSON.stringify(valor.anterior) === JSON.stringify(valor.nuevo)) return [];
    return [`${etiqueta}: ${textoDato(valor.anterior)} → ${textoDato(valor.nuevo)}`];
  }
  if (campo === "material" && typeof valor.nombre === "string") return [`Material: ${valor.nombre}`];
  return Object.entries(valor).flatMap(([clave, dato]) => resumirCampo(clave, dato));
}
export function resumirDetalle(detalle: DetalleVisible): string {
  const frases = Object.entries(detalle).flatMap(([campo, valor]) => resumirCampo(campo, valor));
  return [...new Set(frases)].join(". ");
}
