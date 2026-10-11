import { can, type Actor } from "@/core/autorizacion";
import type { Cliente } from "@/generated/prisma/client";
import { EstadoCotizacion } from "@/generated/prisma/enums";
import { registrarEvento } from "@/lib/bitacora";
import { prisma, type Tx } from "@/lib/db";
import { aErrorHttp, AppError } from "@/lib/errores";

import {
  aClienteDto,
  aClienteFila,
  aCotizacionDeCliente,
  aEventoActividad,
  aTrabajoDeCliente,
} from "./dto";
import {
  actualizarCondicionado,
  agregadoCotizaciones,
  buscarCliente,
  consultarClientes,
  cotizacionesDeCliente,
  eventosDeCliente,
  insertarCliente,
  ordenesDeCliente,
} from "./repo";
import {
  CAMPOS_EDITABLES,
  esquemaIdCliente,
  MENSAJE_SIN_CONTACTO,
  tieneMedioContacto,
  type CampoEditable,
  type ConsultaClientes,
  type EntradaCrearCliente,
  type EntradaEditarCliente,
} from "./schema";
import type {
  CambioCampo,
  ClienteDto,
  CotizacionDeCliente,
  FichaCliente,
  ListaClientes,
  ResumenCotizaciones,
  SeccionLimitada,
  TrabajoDeCliente,
} from "./tipos";

const MENSAJE_RUC = "Ya existe un cliente con ese RUC.";

type CambiosCliente = Partial<Record<CampoEditable, string | null>>;

function noEncontrado(): AppError {
  return new AppError({ codigo: "NO_ENCONTRADO", mensaje: "El cliente no existe.", status: 404 });
}

// Un identificador mal formado no puede existir: se responde igual que uno inexistente.
export function leerIdCliente(valor: string | string[] | undefined): string {
  const resultado = esquemaIdCliente.safeParse(valor);
  if (!resultado.success) throw noEncontrado();
  return resultado.data;
}

function conflictoEdicion(): AppError {
  return new AppError({
    codigo: "CONFLICTO_EDICION",
    mensaje:
      "Otra persona modificó este cliente mientras usted lo editaba. Recargue los datos y vuelva a intentar.",
    status: 409,
  });
}

function clienteArchivado(): AppError {
  return new AppError({
    codigo: "CLIENTE_ARCHIVADO",
    mensaje: "Un cliente archivado no se puede editar. Reactívelo primero.",
    status: 409,
  });
}

function sinMedioContacto(): AppError {
  return new AppError({
    codigo: "VALIDACION",
    mensaje: "Hay campos con errores.",
    status: 422,
    campos: { telefono: MENSAJE_SIN_CONTACTO, correo: MENSAJE_SIN_CONTACTO },
  });
}

// El RUC es el único campo único que puede introducir el usuario.
function traducirDuplicado(error: unknown): unknown {
  if (aErrorHttp(error).cuerpo.error.codigo !== "DUPLICADO") return error;
  return new AppError({ codigo: "DUPLICADO", mensaje: MENSAJE_RUC, status: 409, campos: { ruc: MENSAJE_RUC } });
}

async function exigirCliente(tx: Tx, id: string): Promise<Cliente> {
  const cliente = await buscarCliente(tx, id);
  if (!cliente) throw noEncontrado();
  return cliente;
}

function exigirVersion(cliente: Cliente, version: string): void {
  if (cliente.actualizadoEn.getTime() !== new Date(version).getTime()) throw conflictoEdicion();
}

function calcularCambios(actual: Cliente, entrada: EntradaEditarCliente): CambiosCliente {
  const cambios: CambiosCliente = {};
  for (const campo of CAMPOS_EDITABLES) {
    const nuevo = entrada[campo];
    if (nuevo !== undefined && nuevo !== actual[campo]) cambios[campo] = nuevo;
  }
  return cambios;
}

function detalleDeCambios(actual: Cliente, cambios: CambiosCliente): { cambios: Record<string, CambioCampo> } {
  const detalle: Record<string, CambioCampo> = {};
  for (const campo of Object.keys(cambios) as CampoEditable[]) {
    detalle[campo] = { anterior: actual[campo], nuevo: cambios[campo] ?? null };
  }
  return { cambios: detalle };
}

export async function crearCliente(entrada: EntradaCrearCliente, actor: Actor): Promise<ClienteDto> {
  try {
    return await prisma.$transaction(async (tx) => {
      const cliente = await insertarCliente(tx, entrada);
      await registrarEvento(tx, {
        entidad: "CLIENTE",
        entidadId: cliente.id,
        accion: "CREAR",
        actorId: actor.id,
        estadoNuevo: "ACTIVO",
        detalle: { codigoCliente: cliente.codigoCliente, nombre: cliente.nombre, tipo: cliente.tipo },
      });
      return aClienteDto(cliente);
    });
  } catch (error) {
    throw traducirDuplicado(error);
  }
}

async function aplicarEdicion(tx: Tx, actual: Cliente, cambios: CambiosCliente): Promise<void> {
  const condicion = { id: actual.id, activo: true, version: actual.actualizadoEn.toISOString() };
  if (!(await actualizarCondicionado(tx, condicion, cambios))) throw conflictoEdicion();
}

export async function editarCliente(id: string, entrada: EntradaEditarCliente, actor: Actor): Promise<ClienteDto> {
  try {
    return await prisma.$transaction(async (tx) => {
      const actual = await exigirCliente(tx, id);
      exigirVersion(actual, entrada.version);
      if (!actual.activo) throw clienteArchivado();
      const cambios = calcularCambios(actual, entrada);
      if (Object.keys(cambios).length === 0) return aClienteDto(actual);
      if (!tieneMedioContacto({ ...actual, ...cambios })) throw sinMedioContacto();
      await aplicarEdicion(tx, actual, cambios);
      await registrarEvento(tx, {
        entidad: "CLIENTE",
        entidadId: id,
        accion: "EDITAR",
        actorId: actor.id,
        detalle: detalleDeCambios(actual, cambios),
      });
      return aClienteDto(await exigirCliente(tx, id));
    });
  } catch (error) {
    throw traducirDuplicado(error);
  }
}

type PeticionEstado = { id: string; activo: boolean; version: string; actor: Actor };

function yaEnEstado(activo: boolean): AppError {
  return new AppError({
    codigo: activo ? "CLIENTE_ACTIVO" : "CLIENTE_ARCHIVADO",
    mensaje: activo ? "El cliente ya está activo." : "El cliente ya está archivado.",
    status: 409,
  });
}

function cambiarActivo({ id, activo, version, actor }: PeticionEstado): Promise<ClienteDto> {
  return prisma.$transaction(async (tx) => {
    const actual = await exigirCliente(tx, id);
    exigirVersion(actual, version);
    if (actual.activo === activo) throw yaEnEstado(activo);
    const condicion = { id, activo: !activo, version: actual.actualizadoEn.toISOString() };
    if (!(await actualizarCondicionado(tx, condicion, { activo }))) throw conflictoEdicion();
    await registrarEvento(tx, {
      entidad: "CLIENTE",
      entidadId: id,
      accion: activo ? "REACTIVAR" : "ARCHIVAR",
      actorId: actor.id,
      estadoAnterior: activo ? "ARCHIVADO" : "ACTIVO",
      estadoNuevo: activo ? "ACTIVO" : "ARCHIVADO",
    });
    return aClienteDto(await exigirCliente(tx, id));
  });
}

export function archivarCliente(id: string, version: string, actor: Actor): Promise<ClienteDto> {
  return cambiarActivo({ id, activo: false, version, actor });
}

export function reactivarCliente(id: string, version: string, actor: Actor): Promise<ClienteDto> {
  return cambiarActivo({ id, activo: true, version, actor });
}

export async function listarClientes(consulta: ConsultaClientes, actor: Actor): Promise<ListaClientes> {
  const { filas, total } = await consultarClientes(consulta);
  const conConteo = can(actor, "cotizacion:ver");
  return {
    datos: filas.map((fila) => aClienteFila(fila, conConteo ? fila._count.cotizaciones : undefined)),
    total,
    pagina: consulta.pagina,
    porPagina: consulta.porPagina,
  };
}

export async function obtenerCliente(id: string): Promise<ClienteDto> {
  return aClienteDto(await exigirCliente(prisma, id));
}

async function seccionResumen(clienteId: string): Promise<ResumenCotizaciones> {
  const grupos = await agregadoCotizaciones(clienteId);
  const porEstado: Record<string, number> = Object.fromEntries(Object.values(EstadoCotizacion).map((e) => [e, 0]));
  for (const grupo of grupos) porEstado[grupo.estado] = grupo._count._all;
  const aprobadas = grupos.find((grupo) => grupo.estado === "APROBADA");
  return {
    cotizaciones: grupos.reduce((suma, grupo) => suma + grupo._count._all, 0),
    porEstado,
    totalAprobado: (aprobadas?._sum.total ?? 0).toFixed(2),
  };
}

async function seccionCotizaciones(clienteId: string): Promise<SeccionLimitada<CotizacionDeCliente>> {
  const { filas, total } = await cotizacionesDeCliente(clienteId);
  return { total, items: filas.map(aCotizacionDeCliente) };
}

async function seccionTrabajos(clienteId: string): Promise<SeccionLimitada<TrabajoDeCliente>> {
  const { filas, total } = await ordenesDeCliente(clienteId);
  return { total, items: filas.map(aTrabajoDeCliente) };
}

/**
 * Cada sección del historial exige su propio permiso: sin permiso no se consulta ni se devuelve.
 * La actividad solo exige cliente:ver, que el llamador ya comprobó.
 */
export async function obtenerFicha(id: string, actor: Actor): Promise<FichaCliente> {
  const cliente = await buscarCliente(prisma, id);
  if (!cliente) throw noEncontrado();
  const [resumen, cotizaciones, trabajos, eventos] = await Promise.all([
    can(actor, "cotizacion:ver") ? seccionResumen(id) : undefined,
    can(actor, "cotizacion:ver") ? seccionCotizaciones(id) : undefined,
    can(actor, "orden:ver") ? seccionTrabajos(id) : undefined,
    eventosDeCliente(id),
  ]);
  const ficha: FichaCliente = { ...aClienteDto(cliente), actividad: eventos.map(aEventoActividad) };
  if (resumen) ficha.resumen = resumen;
  if (cotizaciones) ficha.cotizaciones = cotizaciones;
  if (trabajos) ficha.trabajos = trabajos;
  return ficha;
}
