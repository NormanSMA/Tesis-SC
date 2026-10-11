import { describe, expect, it } from "vitest";
import type { EstadoEtapa, EstadoOrden } from "@/generated/prisma/enums";
import { accionesDisponibles } from "@/modules/ordenes/componentes/accionesDisponibles";

const permisos = { gestionar: true, entregar: true, cerrar: true, cancelar: true };
const permisosEtapas = { planificar: true, ejecutar: true, avanzar: true };
const estados: EstadoOrden[] = ["PENDIENTE", "EN_PRODUCCION", "LISTA", "ENTREGADA", "CERRADA", "CANCELADA"];
const esperadas = [
  [true, false, false, false, true, true],
  [false, true, false, false, true, true],
  [false, false, true, false, true, true],
  [false, false, false, true, false, false],
  [false, false, false, false, false, false],
  [false, false, false, false, false, false],
];

describe("acciones de orden: estados y permisos", () => {
  it.each(estados)("disponibilidad en %s", (estado) => {
    const acciones = accionesDisponibles({ orden: { estado, etapas: [] }, permisos, permisosEtapas });
    expect([acciones.iniciarProduccion, acciones.lista, acciones.entregar, acciones.cerrar, acciones.editar, acciones.cancelar])
      .toEqual(esperadas[estados.indexOf(estado)]);
  });
  it.each(estados)("oculta acciones sin permisos en %s", (estado) => {
    const acciones = accionesDisponibles({ orden: { estado, etapas: [{ estado: "COMPLETADA" }] },
      permisos: { gestionar: false, entregar: false, cerrar: false, cancelar: false },
      permisosEtapas: { planificar: false, ejecutar: false, avanzar: false } });
    expect(acciones).toEqual({ iniciarProduccion: false, lista: false, listaHabilitada: false,
      avisoLista: null, entregar: false, cerrar: false, editar: false, cancelar: false });
  });
  it.each(["gestionar", "entregar", "cerrar", "cancelar"] as const)("respeta permiso %s independiente", (permiso) => {
    for (const estado of estados) {
      const acciones = accionesDisponibles({ orden: { estado, etapas: [] }, permisos: { ...permisos, [permiso]: false }, permisosEtapas });
      const esperada = [...esperadas[estados.indexOf(estado)]];
      const indices = { gestionar: [4], entregar: [2], cerrar: [3], cancelar: [5] };
      for (const indice of indices[permiso]) esperada[indice] = false;
      expect([acciones.iniciarProduccion, acciones.lista, acciones.entregar, acciones.cerrar, acciones.editar, acciones.cancelar]).toEqual(esperada);
    }
  });
});

describe("acciones de orden: producción y cierre de etapas", () => {
  it.each(["planificar", "ejecutar", "avanzar"] as const)("permite iniciar con %s", (permiso) => {
    const entrada = { orden: { estado: "PENDIENTE" as const, etapas: [] }, permisos,
      permisosEtapas: { planificar: false, ejecutar: false, avanzar: false, [permiso]: true } };
    expect(accionesDisponibles(entrada).iniciarProduccion).toBe(true);
    expect(accionesDisponibles({ ...entrada, orden: { estado: "EN_PRODUCCION", etapas: [] } }).lista).toBe(permiso === "avanzar");
  });
  const casos: { etapas: EstadoEtapa[]; habilitada: boolean }[] = [
    { etapas: [], habilitada: false }, { etapas: ["OMITIDA"], habilitada: false },
    { etapas: ["PENDIENTE"], habilitada: false }, { etapas: ["EN_CURSO"], habilitada: false },
    { etapas: ["COMPLETADA", "PENDIENTE"], habilitada: false },
    { etapas: ["COMPLETADA", "EN_CURSO"], habilitada: false },
    { etapas: ["COMPLETADA"], habilitada: true }, { etapas: ["COMPLETADA", "OMITIDA"], habilitada: true },
  ];
  it.each(casos)("etapas $etapas: lista habilitada $habilitada", ({ etapas, habilitada }) => {
    const orden = Object.freeze({ estado: "EN_PRODUCCION" as const,
      etapas: Object.freeze(etapas.map((estado) => Object.freeze({ estado }))) });
    const acciones = accionesDisponibles({ orden, permisos: Object.freeze(permisos), permisosEtapas: Object.freeze(permisosEtapas) });
    expect(acciones.lista).toBe(true);
    expect(acciones.listaHabilitada).toBe(habilitada);
    expect(acciones.avisoLista).toEqual(habilitada
      ? { clase: "text-sm", texto: "Todas las etapas están cerradas. Puede marcar la orden lista." }
      : { clase: "text-sm text-muted-foreground", texto: "Cierre todas las etapas y complete al menos una para marcar la orden lista." });
  });
});
