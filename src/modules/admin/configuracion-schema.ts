import { z } from "zod";

import { CIEN, CERO, comparar, leerDecimal } from "@/core/decimal";
import type { TipoValorConfig } from "@/generated/prisma/client";
import { AppError } from "@/lib/errores";

export const esquemaEditarConfiguracion = z.strictObject({
  clave: z.string().trim().min(1).max(60),
  valor: z.string(),
  version: z.iso.datetime({ offset: true, error: "Indique la versión del parámetro." }),
});

export type EntradaEditarConfiguracion = z.output<typeof esquemaEditarConfiguracion>;

const valoresPorTipo = {
  DECIMAL: z.string().regex(/^-?\d+(\.\d+)?$/, "Ingrese una cadena decimal."),
  ENTERO: z.string().regex(/^-?\d+$/, "Ingrese una cadena entera."),
  TEXTO: z.string(),
};

const valoresPorClave = new Map<string, z.ZodType<string, string>>([
  ["iva_porcentaje", valoresPorTipo.DECIMAL.pipe(z.string().refine((valor) => {
    const decimal = leerDecimal(valor);
    return /^-?\d+(\.\d{1,2})?$/.test(valor) && decimal !== null &&
      comparar(decimal, CERO) >= 0 && comparar(decimal, CIEN) <= 0;
  }, "Indique un IVA entre 0 y 100, con hasta 2 decimales."))],
  ["cotizacion_vigencia_dias", valoresPorTipo.ENTERO.pipe(z.string().refine((valor) => {
    const dias = BigInt(valor);
    return dias >= BigInt(1) && dias <= BigInt(365);
  }, "Indique una vigencia entre 1 y 365 días."))],
  ["moneda", z.string().regex(/^[A-Z]{3}$/, "Indique tres letras mayúsculas.")],
  ["empresa_nombre", z.string().trim().min(1, "Ingrese el nombre de empresa.").max(120)],
]);

export function esquemaValorPorClaveConfiguracion(clave: string): z.ZodType<string, string> | undefined {
  return valoresPorClave.get(clave);
}

export function validarValorConfiguracion(datos: { clave: string; tipo: TipoValorConfig; valor: string }): string {
  if (datos.clave === "zona_horaria") {
    throw new AppError({
      codigo: "CONFIGURACION_NO_EDITABLE", mensaje: "La zona horaria no se puede editar.",
      status: 422, campos: { clave: "La zona horaria no se puede editar." },
    });
  }
  const esquemaTipo = (valoresPorTipo as Partial<Record<TipoValorConfig, z.ZodType<string>>>)[datos.tipo];
  if (!esquemaTipo) {
    throw new AppError({ codigo: "VALIDACION", mensaje: "El tipo del parámetro no es editable.", status: 422 });
  }
  const tipado = esquemaTipo.safeParse(datos.valor);
  const resultado = tipado.success
    ? (esquemaValorPorClaveConfiguracion(datos.clave) ?? esquemaTipo).safeParse(tipado.data)
    : tipado;
  if (resultado.success) return resultado.data;
  throw new AppError({
    codigo: "VALIDACION", mensaje: "Hay campos con errores.", status: 422,
    campos: { valor: resultado.error.issues[0].message },
  });
}

export function validarVersionConfiguracion(actualizadoEn: Date, version: string): void {
  if (actualizadoEn.getTime() === new Date(version).getTime()) return;
  throw new AppError({
    codigo: "CONFLICTO_EDICION", mensaje: "El parámetro cambió. Recargue los datos.", status: 409,
  });
}
