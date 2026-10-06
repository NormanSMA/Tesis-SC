import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errores";
import { admiteOperacion, cantidadConSigno, normalizarLineas, resumirTotales } from "@/modules/inventario/consumo-calculo";
import { errorDeLineas, traducirErrorLibro } from "@/modules/inventario/consumo-errores";
import { validarLineas, type MaterialBloqueado } from "@/modules/inventario/consumo-validacion";
import { aMovimientoOrdenDto } from "@/modules/inventario/movimientos-orden-dto";

const A = "0a000000-0000-4000-8000-000000000001";
const B = "0b000000-0000-4000-8000-000000000002";
const C = "c0000000-0000-4000-8000-000000000003";

function material(id: string, extra: Partial<MaterialBloqueado> = {}): MaterialBloqueado {
  return { id, codigo: `M-${id.slice(0, 2)}`, nombre: "Vinil", unidad: "M2", existencia: "5.000", activo: true, ...extra };
}

describe("normalizarLineas", () => {
  it("ordena por id con comparación de cadenas, en minúsculas y conserva el índice original", () => {
    const lineas = normalizarLineas({ lineas: [
      { materialId: C.toUpperCase(), cantidad: "1" }, { materialId: A, cantidad: "2.5" }, { materialId: B, cantidad: "0.125" },
    ] });
    expect(lineas).toEqual([
      { indice: 1, materialId: A, cantidad: "2.500" }, { indice: 2, materialId: B, cantidad: "0.125" },
      { indice: 0, materialId: C, cantidad: "1.000" },
    ]);
  });

  it("da el mismo orden sin importar el orden de entrada", () => {
    const ida = normalizarLineas({ lineas: [{ materialId: A, cantidad: "1" }, { materialId: B, cantidad: "1" }] });
    const vuelta = normalizarLineas({ lineas: [{ materialId: B, cantidad: "1" }, { materialId: A, cantidad: "1" }] });
    expect(ida.map((l) => l.materialId)).toEqual(vuelta.map((l) => l.materialId));
  });

  it("rechaza el mismo UUID con otra capitalización", () => {
    expect(() => normalizarLineas({ lineas: [{ materialId: C, cantidad: "1" }, { materialId: C.toUpperCase(), cantidad: "1" }] }))
      .toThrow(expect.objectContaining({ status: 422, campos: { "lineas.1.materialId": "El material está repetido." } }));
  });
});

describe("signo y estados", () => {
  it("pone el signo según la operación", () => {
    expect(cantidadConSigno("consumo", "2.000")).toBe("-2.000");
    expect(cantidadConSigno("devolucion", "2.000")).toBe("2.000");
  });

  it("admite consumo y devolución según el estado de la orden", () => {
    expect(["PENDIENTE", "EN_PRODUCCION", "LISTA"].every((e) => admiteOperacion("consumo", e))).toBe(true);
    expect(["ENTREGADA", "CERRADA", "CANCELADA"].some((e) => admiteOperacion("consumo", e))).toBe(false);
    expect(["PENDIENTE", "EN_PRODUCCION", "LISTA", "ENTREGADA", "CANCELADA"].every((e) => admiteOperacion("devolucion", e))).toBe(true);
    expect(admiteOperacion("devolucion", "CERRADA")).toBe(false);
  });
});

describe("resumirTotales", () => {
  it("calcula el neto exacto y compara contra el estimado", () => {
    expect(resumirTotales({ estimado: "3.750", consumido: "4.001", devuelto: "0.251" }))
      .toEqual({ estimado: "3.750", consumido: "4.001", devuelto: "0.251", neto: "3.750", excedeEstimado: false });
    expect(resumirTotales({ estimado: "3.750", consumido: "3.751", devuelto: "0" }).excedeEstimado).toBe(true);
  });

  it("marca exceso cuando hay neto sin estimado", () => {
    expect(resumirTotales({ estimado: null, consumido: "0.001", devuelto: "0" })).toMatchObject({ estimado: "0.000", excedeEstimado: true });
    expect(resumirTotales({ estimado: null, consumido: "1", devuelto: "1" }).excedeEstimado).toBe(false);
  });
});

describe("validarLineas", () => {
  const materiales = new Map([[A, material(A, { activo: false })], [B, material(B, { existencia: "1.500" })]]);

  it("reúne todos los errores y elige el código por prioridad", () => {
    const lineas = normalizarLineas({ lineas: [
      { materialId: B, cantidad: "1.501" }, { materialId: A, cantidad: "1" }, { materialId: C, cantidad: "1" },
    ] });
    const errores = validarLineas({ operacion: "consumo", lineas, materiales, netos: new Map() });
    expect(errores.map((e) => [e.indice, e.tipo])).toEqual([[0, "insuficiente"], [1, "archivado"], [2, "inexistente"]]);
    expect(errores[0].limite).toBe("1.500");
    expect(errorDeLineas(errores)).toMatchObject({ codigo: "VALIDACION", status: 422 });
    expect(errorDeLineas(errores.slice(0, 2))).toMatchObject({ codigo: "MATERIAL_ARCHIVADO", status: 409 });
    expect(errorDeLineas(errores.slice(0, 1))).toMatchObject({ codigo: "EXISTENCIA_INSUFICIENTE",
      campos: { "lineas.0.cantidad": expect.stringContaining("solicitado 1.501, disponible 1.500") } });
  });

  it("acepta la existencia exacta y limita la devolución al neto, incluso si el material está archivado", () => {
    const exacta = normalizarLineas({ lineas: [{ materialId: B, cantidad: "1.5" }] });
    expect(validarLineas({ operacion: "consumo", lineas: exacta, materiales, netos: new Map() })).toEqual([]);
    const devolucion = normalizarLineas({ lineas: [{ materialId: A, cantidad: "2" }, { materialId: B, cantidad: "0.001" }] });
    const errores = validarLineas({ operacion: "devolucion", lineas: devolucion, materiales, netos: new Map([[A, "2.000"]]) });
    expect(errores).toMatchObject([{ indice: 1, tipo: "excede", limite: "0.000" }]);
    expect(errorDeLineas(errores)).toMatchObject({ codigo: "DEVOLUCION_EXCEDE_CONSUMO", status: 409 });
  });
});

describe("traducirErrorLibro", () => {
  function errorAdaptador(originalCode: string, originalMessage: string) {
    return Object.assign(new Error("fallo"), { meta: { driverAdapterError: { cause: { originalCode, originalMessage } } } });
  }

  it("traduce el CHECK de saldo y SC005 a los códigos del módulo", () => {
    const saldo = errorAdaptador("23514", 'new row for relation "material" violates check constraint "material_existencia_no_negativa"');
    expect(traducirErrorLibro(saldo, "consumo")).toMatchObject({ codigo: "EXISTENCIA_INSUFICIENTE", status: 409 });
    const tope = Object.assign(new Error("commit"), { name: "DriverAdapterError", cause: { originalCode: "SC005", originalMessage: "supera" } });
    expect(traducirErrorLibro(tope, "devolucion")).toMatchObject({ codigo: "DEVOLUCION_EXCEDE_CONSUMO", status: 409 });
  });

  it("traduce interbloqueo y fallo de serialización a un 409 seguro de repetir", () => {
    for (const codigo of ["40P01", "40001"]) {
      expect(traducirErrorLibro(errorAdaptador(codigo, "deadlock detected"), "consumo"))
        .toMatchObject({ codigo: "CONFLICTO_CONCURRENCIA", status: 409 });
    }
  });

  it("deja pasar los demás errores sin cambiarlos", () => {
    const otro = errorAdaptador("23514", 'violates check constraint "otro_check"');
    expect(traducirErrorLibro(otro, "consumo")).toBe(otro);
    const propio = new AppError({ codigo: "X", status: 409, mensaje: "x" });
    expect(traducirErrorLibro(propio, "consumo")).toBe(propio);
  });
});

describe("aMovimientoOrdenDto", () => {
  const guardado = { id: A, tipo: "CONSUMO", cantidad: new Prisma.Decimal("-2.5"), costoUnitario: new Prisma.Decimal("12.5"),
    existenciaResultante: new Prisma.Decimal("7.5"), costoPromedioResultante: new Prisma.Decimal("12.5"),
    creadoEn: new Date("2026-10-06T12:00:00Z"), material: { id: B, codigo: "M-1", nombre: "Vinil", unidad: "M2" }, usuario: { nombre: "Ana" } };

  it("devuelve la cantidad positiva y omite los costos sin permiso", () => {
    const dto = aMovimientoOrdenDto(guardado, false);
    expect(dto).toEqual({ id: A, tipo: "CONSUMO", material: guardado.material, cantidad: "2.500", existenciaResultante: "7.500",
      usuario: "Ana", creadoEn: "2026-10-06T12:00:00.000Z" });
    expect(Object.keys(dto)).not.toContain("costoUnitario");
  });

  it("incluye los costos con cotizacion:ver", () => {
    expect(aMovimientoOrdenDto(guardado, true)).toMatchObject({ costoUnitario: "12.5000", costoPromedioResultante: "12.5000" });
  });
});
