import { randomUUID } from "node:crypto";
import type { z } from "zod";

import { exigir, type Actor } from "@/core/autorizacion";
import type { Permiso } from "@/core/permisos";
import { exigirClaveCambiada } from "@/lib/auth/guardia";
import { obtenerSesionDeRequest } from "@/lib/auth/sesion";
import { AppError, aErrorHttp, type CamposError } from "@/lib/errores";

type Params = Record<string, string | string[] | undefined>;
type Contexto<A> = { req: Request; actor: A; params: Params };
type Handler<A> = (contexto: Contexto<A>) => Promise<Response> | Response;
type ContextoRuta = { params?: Promise<Params> };

export type RutaHandler = (req: Request, contexto?: ContextoRuta) => Promise<Response>;

const METODOS_QUE_MODIFICAN = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// SameSite=Lax ya frena la mayoría de los CSRF. Esta comprobación cubre el resto (defensa en profundidad).
// Sin Origin solo se acepta en pruebas: un navegador siempre lo envía en peticiones que modifican.
function origenPermitido(req: Request): boolean {
  if (!METODOS_QUE_MODIFICAN.has(req.method)) return true;
  const origen = req.headers.get("origin");
  if (!origen) return process.env.NODE_ENV === "test";
  const host = req.headers.get("host") ?? new URL(req.url).host;
  try {
    return new URL(origen).host === host;
  } catch {
    return false;
  }
}

async function cargarActor(req: Request, permiso: Permiso | undefined): Promise<Actor> {
  const actor = await obtenerSesionDeRequest(req);
  if (!actor) {
    throw new AppError({ codigo: "SIN_SESION", mensaje: "Debe iniciar sesión para continuar.", status: 401 });
  }
  exigirClaveCambiada(actor, new URL(req.url).pathname);
  if (permiso) exigir(actor, permiso);
  return actor;
}

function responderError(e: unknown, req: Request): Response {
  const { status, cuerpo } = aErrorHttp(e);
  if (status >= 500) {
    console.error({
      codigo: cuerpo.error.codigo,
      mensaje: cuerpo.error.mensaje,
      ruta: new URL(req.url).pathname,
      metodo: req.method,
      peticionId: randomUUID(),
    });
  }
  return Response.json(cuerpo, { status });
}

/**
 * Envuelve un handler de ruta. Por defecto exige sesión y, si se indica, el permiso.
 * Con `publica: true` no carga la sesión y el actor llega como null (login, logout).
 */
export function manejar(opciones: { publica: true }, handler: Handler<null>): RutaHandler;
export function manejar(opciones: { permiso?: Permiso }, handler: Handler<Actor>): RutaHandler;
export function manejar(
  opciones: { publica?: true; permiso?: Permiso },
  handler: Handler<Actor> | Handler<null>,
): RutaHandler {
  // Los overloads garantizan que el handler coincide con `publica`; aquí solo se unifica el tipo.
  const ejecutar = handler as Handler<Actor | null>;
  return async (req, contexto) => {
    try {
      if (!origenPermitido(req)) {
        throw new AppError({
          codigo: "ORIGEN_NO_PERMITIDO",
          mensaje: "El origen de la solicitud no está permitido.",
          status: 403,
        });
      }
      const params = (await contexto?.params) ?? {};
      const actor = opciones.publica ? null : await cargarActor(req, opciones.permiso);
      return await ejecutar({ req, actor, params });
    } catch (e) {
      return responderError(e, req);
    }
  };
}

export function ok(datos: unknown, status = 200): Response {
  return Response.json({ datos }, { status });
}

function camposDeZod(error: z.ZodError): CamposError {
  const campos: CamposError = {};
  for (const problema of error.issues) {
    const campo = problema.path.join(".") || "cuerpo";
    campos[campo] ??= problema.message;
  }
  return campos;
}

/** Tope del cuerpo JSON. Las cotizaciones más grandes (200 ítems con 100 líneas) caben con holgura. */
export const LIMITE_CUERPO_BYTES = 1_000_000;

function exigirCuerpoPequeno(longitud: number): void {
  if (longitud <= LIMITE_CUERPO_BYTES) return;
  throw new AppError({
    codigo: "CUERPO_DEMASIADO_GRANDE",
    mensaje: "El cuerpo de la solicitud supera el tamaño permitido.",
    status: 413,
  });
}

export async function leerJson<T extends z.ZodType>(req: Request, esquema: T): Promise<z.output<T>> {
  let cuerpo: unknown;
  exigirCuerpoPequeno(Number(req.headers.get("content-length") ?? 0));
  const texto = await req.text();
  exigirCuerpoPequeno(texto.length);
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    throw new AppError({
      codigo: "JSON_INVALIDO",
      mensaje: "El cuerpo de la solicitud no es un JSON válido.",
      status: 400,
    });
  }
  const resultado = esquema.safeParse(cuerpo);
  if (resultado.success) return resultado.data;
  throw new AppError({
    codigo: "VALIDACION",
    mensaje: "Hay campos con errores.",
    status: 422,
    campos: camposDeZod(resultado.error),
  });
}
