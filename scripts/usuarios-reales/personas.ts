import type { PerfilCodigo } from "../../src/core/permisos";

type Persona = { nombre: string; correo: string; perfil: PerfilCodigo; area: string };
const datos: [string, string, PerfilCodigo, string][] = [
  ['Jorge Isaac Rodríguez', 'jorge.rodriguez', 'GERENCIA', 'Gerencia General'],
  ['Arely Rodríguez', 'arely.rodriguez', 'ADMINISTRACION', 'Administración'],
  ['Dalila Ruiz', 'dalila.ruiz', 'ADMINISTRACION', 'Administración'],
  ['Dariela Centeno', 'dariela.centeno', 'OPERACIONES', 'Operaciones'],
  ['María Fernanda Padilla', 'maria.padilla', 'ATENCION_CLIENTE', 'Atención al cliente'],
  ['Danny Gahona', 'danny.gahona', 'PRODUCCION', 'Grabado y Corte Láser'],
  ['Gabriel Morales', 'gabriel.morales', 'PRODUCCION', 'Impresión Digital'],
  ['Nathaly Chavarría', 'nathaly.chavarria', 'PRODUCCION', 'Diseño Gráfico'],
  ['Mariam García', 'mariam.garcia', 'PRODUCCION', 'Diseño Gráfico'],
  ['Eykelt Tórrez', 'eykelt.torrez', 'PRODUCCION', 'Diseño Gráfico'],
  ['Norman Solís', 'norman.solis', 'PRODUCCION', 'Acabado y Montaje'],
  ['José Osegueda', 'jose.osegueda', 'PRODUCCION', 'Acabado y Montaje'],
  ['Félix Osegueda', 'felix.osegueda', 'PRODUCCION', 'Acabado y Montaje'],
  ['Mario Pineda', 'mario.pineda', 'PRODUCCION', 'Taller'],
  ['Luis Zeledón', 'luis.zeledon', 'PRODUCCION', 'Taller'],
];
export const personas: Persona[] = datos.map(([nombre, alias, perfil, area]) => ({
  nombre, correo: `${alias}@solucionescreativas.test`, perfil, area,
}));
