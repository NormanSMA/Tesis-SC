import { ESTADOS } from "@/components/comunes/estados";
import { ETIQUETA_UNIDAD } from "@/modules/inventario/etiquetas";
import type { AccionBitacora, EntidadBitacora } from "@/generated/prisma/client";

export const ACCION_TEXTO: Record<AccionBitacora, string> = {
  CREAR: "Creó el registro", EDITAR: "Editó el registro", CAMBIAR_ESTADO: "Cambió el estado",
  ASIGNAR_RESPONSABLE: "Asignó el responsable", CONVERTIR_EN_ORDEN: "Convirtió la cotización en orden",
  REGISTRAR_ENTRADA: "Registró una entrada", AJUSTAR_INVENTARIO: "Ajustó el inventario",
  CONSUMIR_MATERIAL: "Registró un consumo de material", DEVOLVER_MATERIAL: "Registró una devolución de material",
  ARCHIVAR: "Archivó el registro", REACTIVAR: "Reactivó el registro",
  OTORGAR_PERMISO: "Otorgó un permiso", REVOCAR_PERMISO: "Revocó un permiso",
};
export const ENTIDAD_TEXTO: Record<EntidadBitacora, string> = {
  CLIENTE: "Cliente", CATEGORIA: "Categoría", AREA: "Área", PRODUCTO: "Producto", MATERIAL: "Material",
  COTIZACION: "Cotización", ORDEN_TRABAJO: "Orden de trabajo", ETAPA_ORDEN: "Etapa de producción",
  MOVIMIENTO_INVENTARIO: "Movimiento de inventario", USUARIO: "Usuario", PERFIL_PERMISO: "Permiso de perfil",
  CONFIGURACION: "Configuración",
};
const OTROS: Record<string, string> = { ACTIVO: "Activo", ARCHIVADO: "Archivado", INACTIVO: "Inactivo",
  EMPRESA: "Empresa", PERSONA: "Persona", INSTITUCION: "Institución", GERENCIA: "Gerencia", VENTAS: "Ventas", ATENCION_CLIENTE: "Atención al cliente", ADMINISTRACION: "Administración",
  OPERACIONES: "Operaciones",
  PRODUCCION: "Producción", ADMIN: "Administración técnica", ENTRADA: "Entrada", CONSUMO: "Consumo",
  DEVOLUCION: "Devolución", AJUSTE: "Ajuste", CATALOGO: "Catálogo", PERSONALIZADO: "Personalizado",
  MATERIAL: "Material", MANO_OBRA: "Mano de obra", TERCERO: "Tercero" };

export function textoEstado(estado: string | null): string | null {
  if (!estado) return null;
  return ESTADOS.cotizacion[estado]?.etiqueta ?? ESTADOS.orden[estado]?.etiqueta
    ?? ESTADOS.etapa[estado]?.etiqueta ?? OTROS[estado] ?? "Estado no disponible";
}
export function textoValor(valor: string): string {
  return OTROS[valor] ?? ETIQUETA_UNIDAD[valor] ?? valor;
}

export function textoCambioEstado(anterior: string | null, nuevo: string | null): string | null {
  if (!nuevo || anterior === nuevo) return null;
  return `${anterior ?? "Creación"} → ${nuevo}`;
}
