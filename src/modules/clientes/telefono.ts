/**
 * Un teléfono admite dígitos, espacios, guiones, puntos y paréntesis, con un «+» inicial opcional
 * (código de país). La longitud se mide en dígitos: de 7 a 15, el máximo del plan internacional (E.164).
 */
const CARACTERES_PERMITIDOS = /^\+?[0-9\s().-]+$/;
const DIGITOS_MINIMOS = 7;
const DIGITOS_MAXIMOS = 15;

export const MENSAJE_TELEFONO =
  "Escriba solo números, espacios, guiones o paréntesis. Use el código de país si es extranjero (de 7 a 15 dígitos).";

export function esTelefonoValido(valor: string): boolean {
  if (!CARACTERES_PERMITIDOS.test(valor)) return false;
  const digitos = valor.replace(/\D/g, "").length;
  return digitos >= DIGITOS_MINIMOS && digitos <= DIGITOS_MAXIMOS;
}
