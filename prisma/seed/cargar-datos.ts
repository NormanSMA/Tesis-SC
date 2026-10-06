import { z } from "zod";

import areasJson from "./datos/areas.json";
import categoriasJson from "./datos/categorias.json";
import clientesJson from "./datos/clientes.json";
import entradasJson from "./datos/entradas-inventario.json";
import {
  areaSchema,
  categoriaSchema,
  clienteSchema,
  entradaInventarioSchema,
  escenarioSchema,
  etapaPlantillaSchema,
  materialSchema,
  productoSchema,
  recetaProductoSchema,
  usuarioSchema,
  validarIntegridad,
} from "./datos/esquemas";
import escenariosJson from "./datos/escenarios.json";
import etapasPlantillaJson from "./datos/etapas-plantilla.json";
import materialesJson from "./datos/materiales.json";
import productosJson from "./datos/productos.json";
import recetasJson from "./datos/recetas.json";
import usuariosJson from "./datos/usuarios.json";

export type PlantillaCategoria = z.infer<typeof etapaPlantillaSchema>;
export type RecetaDatos = z.infer<typeof recetaProductoSchema>;

function analizar() {
  return {
    areas: z.array(areaSchema).parse(areasJson),
    categorias: z.array(categoriaSchema).parse(categoriasJson),
    plantillas: z.array(etapaPlantillaSchema).parse(etapasPlantillaJson),
    materiales: z.array(materialSchema).parse(materialesJson),
    productos: z.array(productoSchema).parse(productosJson),
    recetas: z.array(recetaProductoSchema).parse(recetasJson),
    usuarios: z.array(usuarioSchema).parse(usuariosJson),
    clientes: z.array(clienteSchema).parse(clientesJson),
    escenarios: z.array(escenarioSchema).parse(escenariosJson),
    entradas: z.array(entradaInventarioSchema).parse(entradasJson),
  };
}

export type DatosSiembra = ReturnType<typeof analizar>;

// Valida forma e integridad referencial antes de abrir la transacción.
export function cargarDatos(): DatosSiembra {
  const datos = analizar();
  const { valido, errores } = validarIntegridad(datos);
  if (!valido) throw new Error(`Los datos de siembra no son íntegros:\n- ${errores.join("\n- ")}`);
  return datos;
}
