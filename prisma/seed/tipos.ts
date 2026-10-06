import type { Prisma } from "../../src/generated/prisma/client";
import type { Tx } from "../../src/lib/db";
import type { Reloj } from "./fechas";

export type UnidadCobro = "UNIDAD" | "M2";

export type UsuarioSembrado = { id: string; nombre: string; perfil: string };
export type MaterialSembrado = { id: string; codigo: string; nombre: string; unidad: string; costoUnitario: string };
export type ProductoSembrado = {
  id: string;
  codigo: string;
  nombre: string;
  categoriaId: string;
  unidadCobro: UnidadCobro;
  precioBase: string;
};
export type EtapaPlantillaSembrada = { id: string; nombre: string; areaId: string; secuencia: number };
export type RecetaSembrada = { materialId: string; cantidad: number };

// Identificadores de lo sembrado, por la clave natural que usan los datos (nombre, código o clave).
export type Catalogos = {
  usuarios: Map<string, UsuarioSembrado>;
  clientes: Map<string, string>;
  categorias: Map<string, string>;
  areas: Map<string, string>;
  materiales: Map<string, MaterialSembrado>;
  productos: Map<string, ProductoSembrado>;
  plantillas: Map<string, EtapaPlantillaSembrada[]>;
  recetas: Map<string, RecetaSembrada[]>;
};

export type EventoBitacora = Prisma.BitacoraCreateManyInput;

// Los eventos se acumulan y se escriben juntos al final, con su fecha pasada.
export type ColaBitacora = { eventos: EventoBitacora[] };

export type Contexto = {
  db: Tx;
  reloj: Reloj;
  catalogos: Catalogos;
  bitacora: ColaBitacora;
};

export function usuarioPorClave(catalogos: Catalogos, clave: string): UsuarioSembrado {
  const usuario = catalogos.usuarios.get(clave);
  if (!usuario) throw new Error(`Usuario inexistente en los datos de siembra: ${clave}`);
  return usuario;
}
