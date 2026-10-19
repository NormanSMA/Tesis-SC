// Lectura del resumen JSON de k6 (--summary-export). Acepta el formato plano de k6 1.x y el anidado en "values".
export function metrica(resumen, nombre) {
  const m = resumen?.metrics?.[nombre];
  return m ? { ...m, ...(m.values ?? {}) } : null;
}

export function contador(resumen, nombre) {
  return metrica(resumen, nombre)?.count ?? 0;
}

export function valor(resumen, nombre, campo) {
  return metrica(resumen, nombre)?.[campo] ?? null;
}
