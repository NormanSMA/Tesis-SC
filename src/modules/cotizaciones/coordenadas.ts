export type PuntoInstalacion = [latitud: number, longitud: number];
const numero = "([-+]?\\d{1,3}(?:\\.\\d+)?)";
const pareja = new RegExp(`^\\s*${numero}\\s*[,;~]\\s*${numero}\\s*$`);
function desdePareja(texto: string): PuntoInstalacion | null {
  const partes = texto.match(pareja);
  if (!partes) return null;
  const lat = Number(partes[1]), lon = Number(partes[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
}
export function leerCoordenadas(texto: string): PuntoInstalacion | null {
  if (texto.length > 4096) return null;
  const directo = desdePareja(texto);
  if (directo) return directo;
  try {
    const url = new URL(texto.trim());
    if (!["https:", "http:"].includes(url.protocol)) return null;
    for (const clave of ["destination", "query", "q", "ll", "center", "cp"]) {
      const punto = desdePareja(url.searchParams.get(clave) ?? "");
      if (punto) return punto;
    }
    const datos = decodeURIComponent(url.pathname + url.search + url.hash);
    const lugar = datos.match(new RegExp(`!3d${numero}!4d${numero}`));
    if (lugar) return desdePareja(`${lugar[1]},${lugar[2]}`);
    const mapa = datos.match(new RegExp(`@${numero},${numero}`));
    if (mapa) return desdePareja(`${mapa[1]},${mapa[2]}`);
    const osm = datos.match(new RegExp(`#map=\\d+/${numero}/${numero}`));
    return osm ? desdePareja(`${osm[1]},${osm[2]}`) : null;
  } catch { return null; }
}
