import { describe, expect, it } from "vitest";
import { filtrarDetalle, resumirDetalle } from "@/modules/trazabilidad/detalle";
import type { AccesoDetalle, DetalleVisible } from "@/modules/trazabilidad/detalle";
import { responsablesTrabajo } from "@/modules/trazabilidad/dto";
import type { CadenaGuardada, EventoGuardado } from "@/modules/trazabilidad/repo";
import { ACCIONES } from "@/modules/trazabilidad/schema";

const muestra = {
  nombre: "Nombre", motivo: "Motivo visible", cantidad: "3.000", referencia: "Factura",
  desconocido: "Nunca visible", costoUnitario: "12.1234", costoPromedioResultante: "11.1234",
  responsableId: { anterior: "Ana", nuevo: "Juan", total: "999" },
  material: { nombre: "Vinilo", id: "material", costoPromedio: "900", total: "888" },
  cambios: { nombre: { anterior: "A", nuevo: "B", secreto: "Oculto" },
    precioBase: { anterior: "100", nuevo: "200" }, ruc: { anterior: null, nuevo: "RUC" },
    direccion: { anterior: null, nuevo: "Dirección" }, total: "777" },
  totales: { subtotal: "200", total: "230", secreto: "Oculto", anterior: { total: "100" }, nuevo: { total: "200" } },
  items: [{ secuencia: 1, descripcion: "Trabajo", importe: "230", secreto: "Oculto" }],
  activo: { anterior: true, nuevo: false }, cotizacionNumero: "COT-2026-0001",
  advertencias: [{ mensaje: "Revisar unidad", secreto: "Oculto" }], perfil: "ADMIN", recurso: "orden", accion: "ver",
};
const esperados: Record<(typeof ACCIONES)[number], string[]> = {
  CREAR: ["nombre", "material", "totales", "items"], EDITAR: ["motivo", "cambios", "totales"],
  CAMBIAR_ESTADO: ["motivo"], ASIGNAR_RESPONSABLE: ["responsableId"], CONVERTIR_EN_ORDEN: ["cotizacionNumero", "advertencias"],
  REGISTRAR_ENTRADA: ["cantidad", "material", "costoUnitario"], AJUSTAR_INVENTARIO: ["cantidad", "motivo", "costoUnitario"],
  CONSUMIR_MATERIAL: ["cantidad", "material", "costoUnitario"], DEVOLVER_MATERIAL: ["cantidad", "material", "costoUnitario"],
  ARCHIVAR: ["activo", "motivo"], REACTIVAR: ["activo", "motivo"], OTORGAR_PERMISO: ["perfil", "recurso"], REVOCAR_PERMISO: ["perfil", "recurso"],
};
function sinClavesRestringidas(valor: unknown): void {
  if (!valor || typeof valor !== "object") return;
  for (const [clave, dato] of Object.entries(valor)) {
    expect(clave).not.toMatch(/costo|precio|importe|total|margen|descuento|impuesto|ruc|direccion|desconocido|secreto/i);
    sinClavesRestringidas(dato);
  }
}
describe("lista blanca por acción", () => {
  it.each(ACCIONES)("%s muestra solamente campos definidos con dinero", (accion) => {
    const visible = filtrarDetalle(accion, muestra, { dinero: true, cliente: true });
    for (const campo of esperados[accion]) expect(visible).toHaveProperty(campo);
    expect(JSON.stringify(visible)).not.toMatch(/Nunca visible|Oculto|777|888/);
  });
  it.each(ACCIONES)("%s excluye dinero y cliente en todos los niveles", (accion) => {
    const visible = filtrarDetalle(accion, muestra, { dinero: false, cliente: false });
    sinClavesRestringidas(visible);
    expect(JSON.stringify(visible)).not.toMatch(/999|900|Oculto/);
  });
  it("omite objetos introducidos en campos escalares", () => {
    expect(filtrarDetalle("CONSUMIR_MATERIAL", { cantidad: { total: "999" }, motivo: [{ costo: "8" }] },
      { dinero: true, cliente: true })).toEqual({});
  });
  it.each([null, [], "texto", 7])("rechaza detalle no objeto %s", (detalle) => {
    expect(filtrarDetalle("EDITAR", detalle, { dinero: true, cliente: true })).toEqual({});
  });
  it("resuelve responsables y presenta cambios legibles", () => {
    const detalle = filtrarDetalle("ASIGNAR_RESPONSABLE", { responsableId: { anterior: "a", nuevo: "b" } },
      { dinero: false, cliente: false, nombres: new Map([["a", "Ana"], ["b", "Juan"]]) });
    expect(resumirDetalle(detalle)).toBe("Responsable: Ana → Juan");
  });
  it("restringe RUC y dirección independientemente del dinero", () => {
    const detalle = filtrarDetalle("EDITAR", muestra, { dinero: true, cliente: false });
    expect(JSON.stringify(detalle)).not.toMatch(/ruc|direccion|Dirección/);
    expect(detalle.cambios).toHaveProperty("precioBase");
  });
});
describe("resumen legible", () => {
  const acceso = { dinero: false, cliente: false };
  it("muestra booleanos como Sí y No", () => {
    const detalle = filtrarDetalle("ARCHIVAR", { archivada: { anterior: false, nuevo: true } }, acceso);
    expect(resumirDetalle(detalle)).toBe("Archivada: No → Sí");
  });
  it("omite cambios sin diferencia y repeticiones", () => {
    const detalle = filtrarDetalle("ARCHIVAR", { activo: { anterior: true, nuevo: false },
      cambios: { activo: { anterior: true, nuevo: false } }, motivo: "Cierre" }, acceso);
    expect(resumirDetalle(detalle)).toBe("Motivo: Cierre. Activo: Sí → No");
    expect(resumirDetalle(filtrarDetalle("EDITAR", { nombre: { anterior: "A", nuevo: "A" } }, acceso))).toBe("");
  });
});

describe("proyectores por tipo", () => {
  const acceso: AccesoDetalle = { dinero: true, cliente: true, nombres: new Map([["persona", "Ana"]]) };
  const casos: { tipo: string; accion: (typeof ACCIONES)[number]; entrada: unknown; esperado: DetalleVisible }[] = [
    { tipo: "cadena", accion: "CREAR", entrada: { nombre: "Trabajo" }, esperado: { nombre: "Trabajo" } },
    { tipo: "nombre resuelto", accion: "CREAR", entrada: { nombre: "persona" }, esperado: { nombre: "Ana" } },
    { tipo: "etiqueta", accion: "CREAR", entrada: { tipo: "PERSONA" }, esperado: { tipo: "Persona" } },
    { tipo: "cadena vacía", accion: "CREAR", entrada: { nombre: "" }, esperado: { nombre: "" } },
    { tipo: "número cero", accion: "CREAR", entrada: { secuencia: 0 }, esperado: { secuencia: 0 } },
    { tipo: "booleano falso", accion: "CREAR", entrada: { nombre: false }, esperado: { nombre: false } },
    { tipo: "nulo", accion: "CREAR", entrada: { nombre: null }, esperado: { nombre: null } },
    { tipo: "escalar inválido", accion: "CREAR", entrada: { nombre: {} }, esperado: {} },
    { tipo: "objeto", accion: "CREAR", entrada: { material: { nombre: "Vinilo", secreto: "Oculto" } },
      esperado: { material: { nombre: "Vinilo" } } },
    { tipo: "objeto vacío", accion: "CREAR", entrada: { material: {} }, esperado: {} },
    { tipo: "objeto inválido", accion: "CREAR", entrada: { material: [] }, esperado: {} },
    { tipo: "lista", accion: "CREAR", entrada: { items: [null, 7, [], {}, { secuencia: 0 }, { descripcion: "Trabajo" }] },
      esperado: { items: [{ secuencia: 0 }, { descripcion: "Trabajo" }] } },
    { tipo: "lista vacía", accion: "CREAR", entrada: { items: [] }, esperado: {} },
    { tipo: "lista inválida", accion: "CREAR", entrada: { items: {} }, esperado: {} },
    { tipo: "listas anidadas", accion: "EDITAR", entrada: { items: [{ nuevo: { lineas: [{ cantidad: "2" }, {}] } }] },
      esperado: { items: [{ nuevo: { lineas: [{ cantidad: "2" }] } }] } },
    { tipo: "cambio", accion: "ASIGNAR_RESPONSABLE", entrada: { responsableId: { anterior: null, nuevo: "persona" } },
      esperado: { responsableId: { anterior: null, nuevo: "Ana" } } },
  ];
  it.each(casos)("proyecta $tipo", ({ accion, entrada, esperado }) => {
    expect(filtrarDetalle(accion, entrada, acceso)).toEqual(esperado);
  });
  it.each([
    { dinero: false, cliente: false, esperado: {} },
    { dinero: true, cliente: false, esperado: { precioBase: { anterior: "1", nuevo: "2" } } },
    { dinero: false, cliente: true, esperado: { ruc: { anterior: null, nuevo: "RUC" } } },
    { dinero: true, cliente: true, esperado: { precioBase: { anterior: "1", nuevo: "2" }, ruc: { anterior: null, nuevo: "RUC" } } },
  ])("proyecta permisos dinero=$dinero cliente=$cliente", ({ dinero, cliente, esperado }) => {
    const entrada = { precioBase: { anterior: "1", nuevo: "2" }, ruc: { anterior: null, nuevo: "RUC" } };
    expect(filtrarDetalle("EDITAR", entrada, { dinero, cliente })).toEqual(esperado);
  });
});

type PersonaPrueba = { id: string; nombre: string };
function ordenResponsables(datos: { responsable?: PersonaPrueba; creadoPor?: PersonaPrueba;
  etapas?: { nombre: string; responsable: PersonaPrueba | null }[] } = {}): CadenaGuardada {
  return { responsable: datos.responsable ?? null, creadoPor: datos.creadoPor ?? { id: "autor", nombre: "Autor" },
    etapas: datos.etapas ?? [] } as CadenaGuardada;
}
function eventoResponsables(datos: Partial<EventoGuardado> = {}): EventoGuardado {
  return { id: "evento", entidad: "ORDEN_TRABAJO", entidadId: "orden", ordenId: "orden", cotizacionId: null,
    accion: "ASIGNAR_RESPONSABLE", estadoAnterior: null, estadoNuevo: null, usuarioId: "autor",
    creadoEn: new Date("2026-10-06T12:00:00Z"), detalle: {}, usuario: { id: "autor", nombre: "Autor" },
    orden: null, cotizacion: null, ...datos };
}

describe("responsables por origen", () => {
  const persona = { id: "ana", nombre: "Ana" };
  const referencias = { registros: new Map(), nombres: new Map([["ana", "Ana"], ["juan", "Juan"]]) };
  it.each([
    { origen: "orden", orden: ordenResponsables({ responsable: persona }), eventos: [], rol: "Responsable de orden" },
    { origen: "creación", orden: ordenResponsables({ creadoPor: persona }), eventos: [], rol: "Creó la orden" },
    { origen: "etapa", orden: ordenResponsables({ etapas: [{ nombre: "Impresión", responsable: persona },
      { nombre: "Corte", responsable: null }] }), eventos: [], rol: "Responsable de Impresión" },
    { origen: "evento", orden: ordenResponsables(), eventos: [eventoResponsables({ accion: "EDITAR", usuario: persona })],
      rol: "Editó el registro" },
    { origen: "asignación", orden: ordenResponsables(), eventos: [eventoResponsables({ detalle: { responsableId: { nuevo: "ana" } } })],
      rol: "Responsable anterior o asignado" },
  ])("proyecta responsables de $origen", ({ orden, eventos, rol }) => {
    expect(responsablesTrabajo({ orden, eventos, referencias }).find((fila) => fila.id === "ana"))
      .toEqual({ ...persona, roles: [rol] });
  });
  it.each([null, [], "ana", {}, { nuevo: null }, { nuevo: false }, { nuevo: 7 }, { nuevo: "desconocido" }])
    ("omite cambios sin responsables conocidos: %j", (responsableId) => {
      const eventos = [eventoResponsables({ detalle: { responsableId } })];
      expect(responsablesTrabajo({ orden: ordenResponsables(), eventos, referencias }))
        .toEqual([{ id: "autor", nombre: "Autor", roles: ["Creó la orden", "Asignó el responsable"] }]);
    });
  it("conserva nombres iniciales y roles únicos en orden de aparición", () => {
    const orden = ordenResponsables({ responsable: persona, creadoPor: { ...persona, nombre: "Nombre posterior" },
      etapas: [{ nombre: "Impresión", responsable: persona }] });
    const evento = eventoResponsables({ usuario: persona, detalle: { responsableId: { anterior: "ana", nuevo: "juan" } } });
    expect(responsablesTrabajo({ orden, eventos: [evento, evento], referencias })).toEqual([
      { ...persona, roles: ["Responsable de orden", "Creó la orden", "Responsable de Impresión", "Asignó el responsable",
        "Responsable anterior o asignado"] },
      { id: "juan", nombre: "Juan", roles: ["Responsable anterior o asignado"] },
    ]);
  });
  it("ordena nombres y desempata por identificador", () => {
    const orden = ordenResponsables({ responsable: { id: "b", nombre: "Ana" }, creadoPor: { id: "z", nombre: "Zoe" },
      etapas: [{ nombre: "Corte", responsable: { id: "a", nombre: "Ana" } }] });
    expect(responsablesTrabajo({ orden, eventos: [], referencias }).map((fila) => fila.id)).toEqual(["a", "b", "z"]);
  });
  it("omite referencias de asignación en otras acciones", () => {
    const eventos = [eventoResponsables({ accion: "EDITAR", detalle: { responsableId: { nuevo: "ana" } } })];
    expect(responsablesTrabajo({ orden: ordenResponsables(), eventos, referencias }))
      .toEqual([{ id: "autor", nombre: "Autor", roles: ["Creó la orden", "Editó el registro"] }]);
  });
});
