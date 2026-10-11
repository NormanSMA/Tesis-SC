import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import type { Tx } from "@/lib/db";
import { aErrorHttp } from "@/lib/errores";
import { crearClientePropietario, describeConBase } from "../helpers/db";

type Datos = {
  usuarioId: string;
  clienteId: string;
  categoriaId: string;
  cotizacionAprobadaId: string;
  cotizacionBorradorId: string;
  ordenId: string;
  materialId: string;
  eventoBitacoraId: string;
};

async function numeroNuevo(cliente: Tx | PrismaClient, tipo: "COTIZACION" | "ORDEN_TRABAJO"): Promise<string> {
  const filas = await cliente.$queryRaw<{ numero: string }[]>`SELECT siguiente_numero(${tipo}::tipo_documento) AS numero`;
  return filas[0].numero;
}

async function capturar(accion: () => Promise<unknown>): Promise<unknown> {
  try {
    await accion();
  } catch (e) {
    return e;
  }
  throw new Error("La operacion debio fallar y termino sin error");
}

// Con triggers apagados solo en esta transaccion: permite sembrar estados que la base no deja alcanzar.
async function sembrarDatos(bd: PrismaClient): Promise<Datos> {
  const sufijo = randomUUID().slice(0, 8);
  const d: Datos = {
    usuarioId: randomUUID(),
    clienteId: randomUUID(),
    categoriaId: randomUUID(),
    cotizacionAprobadaId: randomUUID(),
    cotizacionBorradorId: randomUUID(),
    ordenId: randomUUID(),
    materialId: randomUUID(),
    eventoBitacoraId: randomUUID(),
  };
  const perfil = await bd.perfil.upsert({
    where: { codigo: "GERENCIA" },
    update: {},
    create: { codigo: "GERENCIA", nombre: "Gerencia" },
  });

  await bd.$transaction(async (tx) => {
    const numeros = [await numeroNuevo(tx, "COTIZACION"), await numeroNuevo(tx, "COTIZACION"), await numeroNuevo(tx, "ORDEN_TRABAJO")];
    await tx.$executeRaw`SET LOCAL session_replication_role = replica`;
    await tx.$executeRaw`INSERT INTO usuario (id, nombre, correo, hash_contrasena, actualizado_en)
      VALUES (${d.usuarioId}::uuid, 'Prueba', ${`u-${sufijo}@example.com`}, 'hash', now())`;
    await tx.$executeRaw`INSERT INTO usuario_perfil (usuario_id, perfil_id) VALUES (${d.usuarioId}::uuid, ${perfil.id}::uuid)`;
    await tx.$executeRaw`INSERT INTO cliente (id, nombre, tipo, telefono, actualizado_en)
      VALUES (${d.clienteId}::uuid, 'Cliente de prueba', 'PERSONA', '8888-0000', now())`;
    await tx.$executeRaw`INSERT INTO categoria (id, nombre) VALUES (${d.categoriaId}::uuid, ${`Categoria ${sufijo}`})`;
    await tx.$executeRaw`INSERT INTO cotizacion (id, numero, cliente_id, estado, tasa_impuesto, vigencia_dias,
        fecha_emision, fecha_vencimiento, fecha_respuesta, creado_por_id, actualizado_en,
        usuario_aprobacion_id, referencia_aprobacion)
      VALUES (${d.cotizacionAprobadaId}::uuid, ${numeros[0]}, ${d.clienteId}::uuid, 'APROBADA', 15, 10,
        current_date, current_date + 10, now(), ${d.usuarioId}::uuid, now(),
        ${d.usuarioId}::uuid, 'Correo del cliente')`;
    await tx.$executeRaw`INSERT INTO cotizacion (id, numero, cliente_id, estado, tasa_impuesto, vigencia_dias,
        creado_por_id, actualizado_en)
      VALUES (${d.cotizacionBorradorId}::uuid, ${numeros[1]}, ${d.clienteId}::uuid, 'BORRADOR', 15, 10,
        ${d.usuarioId}::uuid, now())`;
    await tx.$executeRaw`INSERT INTO orden_trabajo (id, numero, cotizacion_id, cliente_id, categoria_id, responsable_id,
        fecha_entrega, creado_por_id, actualizado_en)
      VALUES (${d.ordenId}::uuid, ${numeros[2]}, ${d.cotizacionAprobadaId}::uuid, ${d.clienteId}::uuid, ${d.categoriaId}::uuid,
        ${d.usuarioId}::uuid, current_date + 5, ${d.usuarioId}::uuid, now())`;
    await tx.$executeRaw`INSERT INTO material (id, codigo, nombre, unidad, actualizado_en)
      VALUES (${d.materialId}::uuid, ${`MAT-${sufijo}`}, 'Material de prueba', 'METRO', now())`;
    await tx.$executeRaw`INSERT INTO bitacora (id, entidad, entidad_id, accion, usuario_id)
      VALUES (${d.eventoBitacoraId}::uuid, 'CLIENTE', ${d.clienteId}::uuid, 'CREAR', ${d.usuarioId}::uuid)`;
  });
  return d;
}

function esperarConflicto(e: unknown, codigo: string): string {
  const { status, cuerpo } = aErrorHttp(e);
  expect(status).toBe(409);
  expect(cuerpo.error.codigo).toBe(codigo);
  return cuerpo.error.mensaje;
}

describeConBase("traduccion de errores contra PostgreSQL real", () => {
  const bd = crearClientePropietario();
  let d: Datos;

  beforeAll(async () => {
    d = await sembrarDatos(bd);
  });

  afterAll(async () => {
    await bd.$disconnect();
  });

  it("SC001: UPDATE de bitacora conserva el mensaje de la base", async () => {
    const e = await capturar(
      () => bd.$executeRaw`UPDATE bitacora SET detalle = '{}' WHERE id = ${d.eventoBitacoraId}::uuid`,
    );
    expect(esperarConflicto(e, "SC001")).toBe("La tabla bitacora es de solo insercion: UPDATE no permitido");
  });

  it("SC001: TRUNCATE de bitacora", async () => {
    const e = await capturar(() => bd.$executeRawUnsafe("TRUNCATE bitacora"));
    expect(esperarConflicto(e, "SC001")).toBe("La tabla bitacora es de solo insercion: TRUNCATE no permitido");
  });

  it("SC002: transicion de orden invalida", async () => {
    const e = await capturar(() => bd.ordenTrabajo.update({ where: { id: d.ordenId }, data: { estado: "ENTREGADA" } }));
    expect(esperarConflicto(e, "SC002")).toMatch(/^Transicion invalida/);
  });

  it("SC003: cotizacion aprobada no admite cambios", async () => {
    const e = await capturar(() =>
      bd.cotizacion.update({ where: { id: d.cotizacionAprobadaId }, data: { asunto: "cambio" } }),
    );
    expect(esperarConflicto(e, "SC003")).toMatch(/solo admite cambio de estado o archivado/);
  });

  it("SC004: orden sin cotizacion aprobada", async () => {
    const numero = await numeroNuevo(bd, "ORDEN_TRABAJO");
    const e = await capturar(() =>
      bd.ordenTrabajo.create({
        data: {
          numero,
          cotizacionId: d.cotizacionBorradorId,
          clienteId: d.clienteId,
          categoriaId: d.categoriaId,
          responsableId: d.usuarioId,
          creadoPorId: d.usuarioId,
          fechaEntrega: new Date("2030-01-01"),
        },
      }),
    );
    expect(esperarConflicto(e, "SC004")).toMatch(/^La orden requiere cotizacion APROBADA/);
  });

  it("SC005: consumo ligado a un movimiento que no es consumo", async () => {
    const e = await capturar(() =>
      bd.$transaction(async (tx) => {
        const entrada = await tx.movimientoInventario.create({
          data: { materialId: d.materialId, tipo: "ENTRADA", cantidad: "10", costoUnitario: "5", usuarioId: d.usuarioId },
        });
        await tx.consumoOrden.create({
          data: { ordenId: d.ordenId, materialId: d.materialId, movimientoId: entrada.id },
        });
      }),
    );
    expect(esperarConflicto(e, "SC005")).toMatch(/consumo_orden solo admite movimientos CONSUMO o DEVOLUCION/);
  });

  it("SC005: consumo directo sobre una orden cancelada, rechazado por el trigger", async () => {
    const e = await capturar(() =>
      bd.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL session_replication_role = replica`;
        await tx.$executeRaw`UPDATE orden_trabajo SET estado = 'CANCELADA', motivo_cancelacion = 'Prueba de trigger'
          WHERE id = ${d.ordenId}::uuid`;
        await tx.$executeRaw`SET LOCAL session_replication_role = origin`;
        await tx.movimientoInventario.create({
          data: { materialId: d.materialId, tipo: "ENTRADA", cantidad: "10", costoUnitario: "5", usuarioId: d.usuarioId },
        });
        const consumo = await tx.movimientoInventario.create({
          data: { materialId: d.materialId, tipo: "CONSUMO", cantidad: "-1", usuarioId: d.usuarioId },
        });
        await tx.consumoOrden.create({
          data: { ordenId: d.ordenId, materialId: d.materialId, movimientoId: consumo.id },
        });
      }),
    );
    expect(esperarConflicto(e, "SC005")).toMatch(/La orden en estado CANCELADA no admite consumo de material/);
  });

  it("SC005: consumo sin orden, detectado al confirmar la transaccion", async () => {
    const e = await capturar(() =>
      bd.$transaction(async (tx) => {
        await tx.movimientoInventario.create({
          data: { materialId: d.materialId, tipo: "ENTRADA", cantidad: "10", costoUnitario: "5", usuarioId: d.usuarioId },
        });
        await tx.movimientoInventario.create({
          data: { materialId: d.materialId, tipo: "CONSUMO", cantidad: "-1", usuarioId: d.usuarioId },
        });
      }),
    );
    expect(esperarConflicto(e, "SC005")).toMatch(/de tipo CONSUMO sin consumo_orden asociado/);
  });

  it("SC006: existencia escrita fuera del libro", async () => {
    const e = await capturar(() => bd.material.update({ where: { id: d.materialId }, data: { existencia: "99" } }));
    expect(esperarConflicto(e, "SC006")).toBe("material.existencia solo cambia mediante movimiento_inventario");
  });

  it("SC007: columna inmutable de la orden", async () => {
    const e = await capturar(() =>
      bd.ordenTrabajo.update({ where: { id: d.ordenId }, data: { cotizacionId: d.cotizacionBorradorId } }),
    );
    expect(esperarConflicto(e, "SC007")).toBe("La columna orden_trabajo.cotizacion_id es inmutable");
  });

  it("23505: valor unico duplicado", async () => {
    const datos = { nombre: "Duplicado", tipo: "EMPRESA", ruc: `J${randomUUID().slice(0, 10)}`, telefono: "1" } as const;
    await bd.cliente.create({ data: datos });
    const e = await capturar(() => bd.cliente.create({ data: datos }));
    expect(esperarConflicto(e, "DUPLICADO")).toBe("Ya existe un registro con ese valor único.");
  });

  it("23503: referencia inexistente al insertar", async () => {
    const e = await capturar(() =>
      bd.bitacora.create({
        data: { entidad: "CLIENTE", entidadId: d.clienteId, accion: "CREAR", usuarioId: randomUUID() },
      }),
    );
    expect(esperarConflicto(e, "REFERENCIA_INEXISTENTE")).toBe("El registro referenciado no existe.");
  });

  it("23503: registros relacionados al borrar", async () => {
    const e = await capturar(() => bd.cliente.delete({ where: { id: d.clienteId } }));
    expect(esperarConflicto(e, "REGISTROS_RELACIONADOS")).toBe(
      "El registro tiene datos relacionados y no se puede eliminar.",
    );
  });

  it("23514: existencia negativa", async () => {
    const e = await capturar(() =>
      bd.movimientoInventario.create({
        data: { materialId: d.materialId, tipo: "AJUSTE", cantidad: "-500", usuarioId: d.usuarioId },
      }),
    );
    expect(esperarConflicto(e, "VALOR_FUERA_DE_RANGO")).toBe("La existencia del material no alcanza para la operación.");
  });

  it("23514: otro CHECK da el mensaje generico de rango", async () => {
    const e = await capturar(() => bd.permiso.create({ data: { recurso: "MAL", accion: "x" } }));
    expect(esperarConflicto(e, "VALOR_FUERA_DE_RANGO")).toBe("El valor está fuera del rango permitido.");
  });
});
