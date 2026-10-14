/** Cookie con la preferencia de menú lateral compacto en pantalla grande. No contiene datos personales. */
export const COOKIE_MENU = "tracore-menu";
export const VALOR_MENU_COMPACTO = "compacto";

export function guardarMenuCompacto(compacto: boolean): void {
  const valor = compacto ? VALOR_MENU_COMPACTO : "expandido";
  document.cookie = `${COOKIE_MENU}=${valor}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
