import { describe, expect, it } from "vitest";
import { filtrarDetalle, resumirDetalle } from "@/modules/trazabilidad/detalle";
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
