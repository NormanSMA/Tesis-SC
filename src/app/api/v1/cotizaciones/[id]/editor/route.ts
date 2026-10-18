import { AppError } from "@/lib/errores";
import { manejar, ok } from "@/lib/http";
import { consultarSelectores } from "@/modules/cotizaciones/repo";
import { leerIdCotizacion, obtenerCotizacion } from "@/modules/cotizaciones/service";

// Datos del editor de ítems para el paso 2 del drawer: los mismos que carga /cotizaciones/[id]/editar.
export const GET = manejar({ permiso: "cotizacion:gestionar" }, async ({ params }) => {
  const cotizacion = await obtenerCotizacion(leerIdCotizacion(params.id));
  if (cotizacion.estado !== "BORRADOR" || cotizacion.archivada) {
    throw new AppError({ codigo: "NO_EDITABLE", mensaje: "Solo se editan borradores sin archivar.", status: 409 });
  }
  return ok({ cotizacion, selectores: await consultarSelectores() });
});
