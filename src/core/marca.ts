/** Nombre visible de la plataforma y de la empresa. Fuente única para interfaz, metadatos y reportes. */
export const NOMBRE_PLATAFORMA = "TRACORE";
export const NOMBRE_EMPRESA = "Soluciones Creativas";

export const METADATOS_APP = {
  title: { default: `${NOMBRE_PLATAFORMA} | ${NOMBRE_EMPRESA}`, template: `%s | ${NOMBRE_PLATAFORMA}` },
  description: `${NOMBRE_PLATAFORMA}: plataforma de gestión integrada de ${NOMBRE_EMPRESA}.`,
};
