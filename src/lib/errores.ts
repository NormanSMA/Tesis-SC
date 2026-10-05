export class AppError extends Error {
  constructor(
    public codigo: string,
    public mensaje: string,
    public status: number,
    public campos?: Record<string, string>
  ) {
    super(mensaje);
    this.name = "AppError";
  }
}

export function aErrorHttp(e: unknown): {
  status: number;
  cuerpo: { error: { codigo: string; mensaje: string; campos?: Record<string, string> } };
} {
  if (e instanceof AppError) {
    return {
      status: e.status,
      cuerpo: {
        error: {
          codigo: e.codigo,
          mensaje: e.mensaje,
          ...(e.campos && { campos: e.campos }),
        },
      },
    };
  }

  if (e instanceof Error) {
    const errorRecord = e as unknown as Record<string, unknown>;
    const code = String(errorRecord.code ?? "");
    const metaCode = String(
      (errorRecord.meta as Record<string, unknown> | undefined)?.code ?? ""
    );
    const sqlState = code || metaCode;

    if (["SC001", "SC002", "SC003", "SC004", "SC005", "SC006", "SC007"].includes(sqlState)) {
      return {
        status: 409,
        cuerpo: {
          error: {
            codigo: sqlState,
            mensaje: "Conflicto de regla de negocio",
          },
        },
      };
    }

    if (["23505", "23503", "23514"].includes(sqlState)) {
      return {
        status: 409,
        cuerpo: {
          error: {
            codigo: "CONFLICTO",
            mensaje: "Violación de restricción de datos",
          },
        },
      };
    }
  }

  return {
    status: 500,
    cuerpo: {
      error: {
        codigo: "ERROR_INTERNO",
        mensaje: "Error interno del servidor",
      },
    },
  };
}
