import type { CotizacionDto } from "../tipos";

export type PermisosCotizacion = { gestionar: boolean; enviar: boolean; responder: boolean };
type CotizacionAcciones = Pick<CotizacionDto, "estado" | "archivada"> & {
  items: readonly unknown[]; cliente: Pick<CotizacionDto["cliente"], "activo">;
};

function pasoBorrador(cotizacion: CotizacionAcciones, permisos: PermisosCotizacion) {
  if (!permisos.enviar) return "Corresponde a un usuario con permiso de envío.";
  if (cotizacion.items.length) return "Envíe la cotización al cliente.";
  return permisos.gestionar ? "Agregue ítems para poder enviar la cotización." : "Corresponde a un usuario con permiso de gestión.";
}

function siguientePaso(cotizacion: CotizacionAcciones, permisos: PermisosCotizacion) {
  if (cotizacion.archivada) return "La cotización está archivada. Solo consulta.";
  switch (cotizacion.estado) {
    case "BORRADOR": return pasoBorrador(cotizacion, permisos);
    case "ENVIADA":
      return permisos.responder ? "Registre la respuesta del cliente: aprobación, rechazo o ajustes." : "Corresponde a un usuario con permiso de respuesta.";
    case "AJUSTE_SOLICITADO":
      return permisos.gestionar ? "Cree la versión corregida con los ajustes pedidos." : "Corresponde a un usuario con permiso de gestión.";
    case "APROBADA": return "Cotización aprobada. Continúe en la orden de producción.";
    default:
      return permisos.gestionar ? "Cotización cerrada. Puede duplicarla para preparar una nueva." : "Cotización cerrada. Solo consulta.";
  }
}

export function accionesDisponibles({ cotizacion, permisos }: {
  cotizacion: CotizacionAcciones; permisos: PermisosCotizacion;
}) {
  const activa = !cotizacion.archivada;
  return {
    enviar: permisos.enviar && cotizacion.estado === "BORRADOR" && activa,
    responder: permisos.responder && cotizacion.estado === "ENVIADA" && activa,
    versionCorregida: permisos.gestionar && cotizacion.estado === "AJUSTE_SOLICITADO" && activa,
    editar: permisos.gestionar && cotizacion.estado === "BORRADOR" && activa,
    duplicar: permisos.gestionar,
    archivar: permisos.gestionar && activa,
    envioDeshabilitado: !cotizacion.items.length,
    borradorDeshabilitado: !cotizacion.cliente.activo,
    siguientePaso: siguientePaso(cotizacion, permisos),
  };
}
