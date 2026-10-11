import { describe, expect, it } from "vitest";
import type { EstadoCotizacion } from "@/modules/cotizaciones/tipos";
import { accionesDisponibles, type PermisosCotizacion } from "@/modules/cotizaciones/componentes/accionesDisponibles";

const estados: EstadoCotizacion[] = ["BORRADOR", "ENVIADA", "AJUSTE_SOLICITADO", "APROBADA", "RECHAZADA", "VENCIDA"];
const gestion = [["editar", "duplicar", "archivar"], ["duplicar", "archivar"],
  ["versionCorregida", "duplicar", "archivar"], ["duplicar", "archivar"], ["duplicar", "archivar"], ["duplicar", "archivar"]];
const permisos: PermisosCotizacion[] = Array.from({ length: 8 }, (_, mascara) => ({
  gestionar: Boolean(mascara & 1), enviar: Boolean(mascara & 2), responder: Boolean(mascara & 4),
}));
const casos = estados.flatMap((estado) => permisos.flatMap((permiso) => [false, true].map((archivada) => ({
  cotizacion: { estado, archivada, items: Object.freeze([]), cliente: Object.freeze({ activo: true }) }, permisos: permiso,
}))));

describe("acciones de cotización: estados, permisos y archivo", () => {
  it.each(casos)("$cotizacion.estado archivada $cotizacion.archivada con $permisos", (entrada) => {
    const esperadas = new Set<string>();
    if (entrada.permisos.gestionar) {
      for (const accion of gestion[estados.indexOf(entrada.cotizacion.estado)]) esperadas.add(accion);
    }
    if (entrada.permisos.enviar && entrada.cotizacion.estado === "BORRADOR") esperadas.add("enviar");
    if (entrada.permisos.responder && entrada.cotizacion.estado === "ENVIADA") esperadas.add("responder");
    if (entrada.cotizacion.archivada) {
      for (const accion of ["enviar", "responder", "versionCorregida", "editar", "archivar"]) esperadas.delete(accion);
    }
    const acciones = accionesDisponibles({ cotizacion: Object.freeze(entrada.cotizacion), permisos: Object.freeze(entrada.permisos) });
    const { envioDeshabilitado, borradorDeshabilitado, siguientePaso, ...visibles } = acciones;
    expect(Object.entries(visibles).filter(([, visible]) => visible).map(([accion]) => accion).sort()).toEqual([...esperadas].sort());
    expect(envioDeshabilitado).toBe(true);
    expect(borradorDeshabilitado).toBe(false);
    expect(siguientePaso).toBeTypeOf("string");
  });
  it.each([false, true])("deshabilita borradores para cliente activo %s", (activo) => {
    const acciones = accionesDisponibles({ cotizacion: { estado: "BORRADOR", archivada: false, items: [{}], cliente: { activo } },
      permisos: { gestionar: true, enviar: true, responder: true } });
    expect(acciones.borradorDeshabilitado).toBe(!activo);
    expect(acciones.envioDeshabilitado).toBe(false);
    expect(acciones.enviar).toBe(true);
    expect(acciones.duplicar).toBe(true);
  });
});

const pasos: { estado: EstadoCotizacion; items?: unknown[];
  permisos: PermisosCotizacion; texto: string }[] = [
  { estado: "BORRADOR", permisos: permisos[0], texto: "Corresponde a un usuario con permiso de envío." },
  { estado: "BORRADOR", permisos: permisos[2], texto: "Corresponde a un usuario con permiso de gestión." },
  { estado: "BORRADOR", permisos: permisos[3], texto: "Agregue ítems para poder enviar la cotización." },
  { estado: "BORRADOR", items: [{}], permisos: permisos[2], texto: "Envíe la cotización al cliente." },
  { estado: "ENVIADA", permisos: permisos[0], texto: "Corresponde a un usuario con permiso de respuesta." },
  { estado: "ENVIADA", permisos: permisos[4], texto: "Registre la respuesta del cliente: aprobación, rechazo o ajustes." },
  { estado: "AJUSTE_SOLICITADO", permisos: permisos[0], texto: "Corresponde a un usuario con permiso de gestión." },
  { estado: "AJUSTE_SOLICITADO", permisos: permisos[1], texto: "Cree la versión corregida con los ajustes pedidos." },
  { estado: "APROBADA", permisos: permisos[0], texto: "Cotización aprobada. Continúe en la orden de producción." },
  { estado: "RECHAZADA", permisos: permisos[1], texto: "Cotización cerrada. Puede duplicarla para preparar una nueva." },
  { estado: "VENCIDA", permisos: permisos[0], texto: "Cotización cerrada. Solo consulta." },
];

describe("acciones de cotización: siguiente paso", () => {
  it.each(pasos)("conserva texto en $estado: $texto", ({ estado, permisos, texto, items = [] }) => {
    expect(accionesDisponibles({ cotizacion: { estado, archivada: false, items, cliente: { activo: true } }, permisos }).siguientePaso).toBe(texto);
  });
  it.each(estados)("prioriza archivo en %s", (estado) => {
    expect(accionesDisponibles({ cotizacion: { estado, archivada: true, items: [{}], cliente: { activo: true } }, permisos: permisos[7] })
      .siguientePaso).toBe("La cotización está archivada. Solo consulta.");
  });
});
