import { can, type Actor } from "@/core/autorizacion";
import { ETIQUETA_UNIDAD } from "@/modules/inventario/etiquetas";
import type { ResumenMaterialOrden } from "@/modules/inventario/contrato-orden";
import type { CostosReales } from "./costos";
import { filtrarDetalle, resumirDetalle } from "./detalle";
import { ACCION_TEXTO, ENTIDAD_TEXTO, textoEstado, textoValor } from "./etiquetas";
import type { Referencias } from "./referencias";
import type { CadenaGuardada, EventoGuardado, HistorialEtapaGuardado } from "./repo";

function aHistorialEtapaDto(historial: HistorialEtapaGuardado) {
  return { id: historial.id, ordenId: historial.ordenId, etapa: historial.etapa, usuario: historial.usuario,
    estadoAnterior: textoEstado(historial.estadoAnterior), estadoNuevo: textoEstado(historial.estadoNuevo),
    responsable: historial.responsable, creadoEn: historial.creadoEn.toISOString() };
}

function registroEvento(evento: EventoGuardado, referencias: Referencias, actor: Actor) {
  const orden = evento.orden ?? evento.cotizacion?.orden;
  const registro = referencias.registros.get(`${evento.entidad}:${evento.entidadId}`);
  if (orden) return { nombre: evento.entidad === "COTIZACION" ? evento.cotizacion!.numero
    : registro ? `${orden.numero}: ${registro.nombre}` : orden.numero,
    href: can(actor, "orden:ver") ? `/trazabilidad/ordenes/${orden.id}` : null };
  if (evento.cotizacion) return { nombre: evento.cotizacion.numero,
    href: can(actor, "cotizacion:ver") ? `/cotizaciones/${evento.cotizacion.id}` : null };
  return { nombre: registro?.nombre ?? ENTIDAD_TEXTO[evento.entidad],
    href: registro?.ruta && registro.permiso && can(actor, registro.permiso) ? registro.ruta : null };
}

export function aEventoDto(datos: { evento: EventoGuardado; actor: Actor; referencias: Referencias }) {
  const { evento, actor, referencias } = datos;
  const detalle = filtrarDetalle(evento.accion, evento.detalle,
    { dinero: can(actor, "cotizacion:ver"), cliente: can(actor, "cliente:ver"), nombres: referencias.nombres });
  return { id: evento.id, entidadId: evento.entidadId, entidad: ENTIDAD_TEXTO[evento.entidad], accion: ACCION_TEXTO[evento.accion],
    usuario: { id: evento.usuario.id, nombre: evento.usuario.nombre }, creadoEn: evento.creadoEn.toISOString(),
    estadoAnterior: textoEstado(evento.estadoAnterior), estadoNuevo: textoEstado(evento.estadoNuevo),
    detalle, resumen: resumirDetalle(detalle), registro: registroEvento(evento, referencias, actor) };
}

export function aCadenaDto(orden: CadenaGuardada, actor: Actor, historial?: HistorialEtapaGuardado[]) {
  const cotizacion = orden.cotizacion, cliente = cotizacion.cliente;
  return {
    ...(historial ? { historialEtapas: historial.map(aHistorialEtapaDto) } : {}),
    cliente: { id: cliente.id, nombre: cliente.nombre, tipo: textoValor(cliente.tipo), contactoPrincipal: cliente.contactoPrincipal,
      telefono: cliente.telefono, correo: cliente.correo, href: can(actor, "cliente:ver") ? `/clientes/${cliente.id}` : null,
      ...(can(actor, "cliente:ver") ? { ruc: cliente.ruc, direccion: cliente.direccion } : {}) },
    cotizacion: { id: cotizacion.id, numero: cotizacion.numero, asunto: cotizacion.asunto, estado: textoEstado(cotizacion.estado),
      creadoEn: cotizacion.creadoEn.toISOString(), fechaEmision: cotizacion.fechaEmision?.toISOString().slice(0, 10) ?? null,
      fechaVencimiento: cotizacion.fechaVencimiento?.toISOString().slice(0, 10) ?? null,
      fechaRespuesta: cotizacion.fechaRespuesta?.toISOString() ?? null,
      href: can(actor, "cotizacion:ver") ? `/cotizaciones/${cotizacion.id}` : null,
      ...(can(actor, "cotizacion:ver") ? { subtotal: cotizacion.subtotal.toFixed(2), descuento: cotizacion.descuento.toFixed(2),
        impuesto: cotizacion.impuesto.toFixed(2), total: cotizacion.total.toFixed(2) } : {}) },
    orden: { id: orden.id, numero: orden.numero, estado: textoEstado(orden.estado), responsable: orden.responsable,
      especificaciones: orden.especificaciones, fechaEntrega: orden.fechaEntrega.toISOString().slice(0, 10),
      creadoEn: orden.creadoEn.toISOString(), fechaInicioReal: orden.fechaInicioReal?.toISOString() ?? null,
      fechaEntregaReal: orden.fechaEntregaReal?.toISOString() ?? null, fechaCierre: orden.fechaCierre?.toISOString() ?? null },
    etapas: orden.etapas.map((etapa) => ({ id: etapa.id, nombre: etapa.nombre, area: etapa.area, secuencia: etapa.secuencia,
      estado: textoEstado(etapa.estado), responsable: etapa.responsable,
      fechaInicioPlan: etapa.fechaInicioPlan?.toISOString().slice(0, 10) ?? null, fechaFinPlan: etapa.fechaFinPlan?.toISOString().slice(0, 10) ?? null,
      fechaInicioReal: etapa.fechaInicioReal?.toISOString() ?? null, fechaFinReal: etapa.fechaFinReal?.toISOString() ?? null })),
  };
}

export function aMaterialesDto(materiales: ResumenMaterialOrden[], costos?: CostosReales) {
  return materiales.map((fila) => ({ material: { id: fila.material.id, codigo: fila.material.codigo, nombre: fila.material.nombre,
    unidad: ETIQUETA_UNIDAD[fila.material.unidad] ?? "Unidad" }, estimado: fila.estimado, consumido: fila.consumido,
    devuelto: fila.devuelto, neto: fila.neto,
    ...(costos ? { costoReal: costos.porMaterial[fila.material.id] ?? "0.0000000" } : {}) }));
}

type Persona = { id: string; nombre: string };
type PersonasTrabajo = Map<string, Persona & { roles: Set<string> }>;

function agregarPersona(personas: PersonasTrabajo, persona: Persona, rol: string) {
  const fila = personas.get(persona.id) ?? { ...persona, roles: new Set<string>() };
  fila.roles.add(rol);
  personas.set(persona.id, fila);
}

function agregarResponsablesOrden(orden: CadenaGuardada, personas: PersonasTrabajo) {
  if (orden.responsable) agregarPersona(personas, orden.responsable, "Responsable de orden");
  agregarPersona(personas, orden.creadoPor, "Creó la orden");
  for (const etapa of orden.etapas) {
    if (etapa.responsable) agregarPersona(personas, etapa.responsable, `Responsable de ${etapa.nombre}`);
  }
}

function agregarResponsableReferencia(id: unknown, referencias: Referencias, personas: PersonasTrabajo) {
  if (typeof id !== "string" || !referencias.nombres.has(id)) return;
  agregarPersona(personas, { id, nombre: referencias.nombres.get(id)! }, "Responsable anterior o asignado");
}

function agregarResponsablesAsignacion(evento: EventoGuardado, referencias: Referencias, personas: PersonasTrabajo) {
  if (evento.accion !== "ASIGNAR_RESPONSABLE") return;
  const detalle = filtrarDetalle(evento.accion, evento.detalle, { dinero: false, cliente: false });
  const cambio = detalle.responsableId;
  if (!cambio || typeof cambio !== "object" || Array.isArray(cambio)) return;
  for (const id of Object.values(cambio)) agregarResponsableReferencia(id, referencias, personas);
}

export function responsablesTrabajo(datos: { orden: CadenaGuardada; eventos: EventoGuardado[]; referencias: Referencias }) {
  const personas: PersonasTrabajo = new Map();
  agregarResponsablesOrden(datos.orden, personas);
  for (const evento of datos.eventos) {
    agregarPersona(personas, evento.usuario, ACCION_TEXTO[evento.accion]);
    agregarResponsablesAsignacion(evento, datos.referencias, personas);
  }
  return [...personas.values()].map((fila) => ({ id: fila.id, nombre: fila.nombre, roles: [...fila.roles] }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es") || a.id.localeCompare(b.id));
}
