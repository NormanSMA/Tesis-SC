export type CamposError = Record<string, string>;

export type CuerpoError = {
  error: { codigo: string; mensaje: string; campos?: CamposError };
};

export type RespuestaError = { status: number; cuerpo: CuerpoError };

type OpcionesAppError = {
  codigo: string;
  mensaje: string;
  status: number;
  campos?: CamposError;
};

export class AppError extends Error {
  readonly codigo: string;
  readonly mensaje: string;
  readonly status: number;
  readonly campos?: CamposError;

  constructor({ codigo, mensaje, status, campos }: OpcionesAppError) {
    super(mensaje);
    this.name = "AppError";
    this.codigo = codigo;
    this.mensaje = mensaje;
    this.status = status;
    this.campos = campos;
  }
}

type ErrorSql = { sqlstate: string; mensajeOriginal: string };

const CODIGOS_REGLA_NEGOCIO = ["SC001", "SC002", "SC003", "SC004", "SC005", "SC006", "SC007"];

// Restricciones cuyo fallo tiene un significado de negocio propio (invariante I-01).
const MENSAJE_POR_RESTRICCION: Record<string, string> = {
  material_existencia_no_negativa: "La existencia del material no alcanza para la operación.",
};

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

// Prisma 7 con @prisma/adapter-pg no pone el SQLSTATE en error.code (ahí va P2002, P2010, etc.).
// Hay dos formas observadas, ambas con { originalCode, originalMessage }:
// - PrismaClientKnownRequestError: error.meta.driverAdapterError.cause.
// - DriverAdapterError sin envolver, cuando falla el COMMIT de una transacción interactiva
//   (restricciones diferidas, como SC005 de CONSUMO sin orden): error.cause.
function leerCausaDelAdaptador(e: unknown): unknown {
  if (!esObjeto(e)) return undefined;
  if (esObjeto(e.meta) && esObjeto(e.meta.driverAdapterError)) return e.meta.driverAdapterError.cause;
  if (e.name === "DriverAdapterError") return e.cause;
  return undefined;
}

function leerErrorSql(e: unknown): ErrorSql | null {
  const causa = leerCausaDelAdaptador(e);
  if (!esObjeto(causa) || typeof causa.originalCode !== "string") return null;
  return {
    sqlstate: causa.originalCode,
    mensajeOriginal: typeof causa.originalMessage === "string" ? causa.originalMessage : "",
  };
}

function leerNombreRestriccion(mensajeOriginal: string): string | undefined {
  return /constraint "([^"]+)"/.exec(mensajeOriginal)?.[1];
}

function respuesta({ status, codigo, mensaje, campos }: OpcionesAppError): RespuestaError {
  return { status, cuerpo: { error: { codigo, mensaje, ...(campos && { campos }) } } };
}

function conflicto(codigo: string, mensaje: string): RespuestaError {
  return respuesta({ status: 409, codigo, mensaje });
}

function traducirRestriccion({ sqlstate, mensajeOriginal }: ErrorSql): RespuestaError | null {
  if (sqlstate === "23505") {
    return conflicto("DUPLICADO", "Ya existe un registro con ese valor único.");
  }
  if (sqlstate === "23503") {
    const alBorrar = mensajeOriginal.startsWith("update or delete on table");
    return alBorrar
      ? conflicto("REGISTROS_RELACIONADOS", "El registro tiene datos relacionados y no se puede eliminar.")
      : conflicto("REFERENCIA_INEXISTENTE", "El registro referenciado no existe.");
  }
  if (sqlstate === "23514") {
    const restriccion = leerNombreRestriccion(mensajeOriginal);
    const mensaje =
      (restriccion && MENSAJE_POR_RESTRICCION[restriccion]) ?? "El valor está fuera del rango permitido.";
    return conflicto("VALOR_FUERA_DE_RANGO", mensaje);
  }
  return null;
}

function traducirErrorSql(e: unknown): RespuestaError | null {
  const errorSql = leerErrorSql(e);
  if (!errorSql) return null;
  if (CODIGOS_REGLA_NEGOCIO.includes(errorSql.sqlstate)) {
    // El mensaje RAISE EXCEPTION de la base ya está en español.
    return conflicto(errorSql.sqlstate, errorSql.mensajeOriginal);
  }
  return traducirRestriccion(errorSql);
}

export function aErrorHttp(e: unknown): RespuestaError {
  if (e instanceof AppError) return respuesta(e);
  return (
    traducirErrorSql(e) ??
    respuesta({ status: 500, codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" })
  );
}
