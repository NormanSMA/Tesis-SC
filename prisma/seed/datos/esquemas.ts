import { z } from 'zod';

// Enums del schema de Prisma
export const CodigoPerfil = z.enum(['GERENCIA', 'VENTAS', 'PRODUCCION', 'ADMIN']);
export const TipoCliente = z.enum(['PERSONA', 'EMPRESA']);
export const UnidadCobro = z.enum(['UNIDAD', 'M2']);
export const UnidadMaterial = z.enum([
  'UNIDAD', 'METRO', 'M2', 'YARDA', 'PIE', 'LITRO',
  'GALON', 'KILOGRAMO', 'LIBRA', 'PLIEGO', 'ROLLO'
]);
export const EstadoCotizacion = z.enum([
  'BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA', 'VENCIDA'
]);
export const EstadoOrden = z.enum([
  'PENDIENTE', 'EN_PRODUCCION', 'LISTA', 'ENTREGADA', 'CERRADA', 'CANCELADA'
]);
export const EstadoEtapa = z.enum([
  'PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'OMITIDA'
]);
export const TipoItem = z.enum(['CATALOGO', 'PERSONALIZADO']);

// Esquemas de datos
export const areaSchema = z.object({
  nombre: z.string().min(1).max(80)
});

export const categoriaSchema = z.object({
  nombre: z.string().min(1).max(80),
  descripcion: z.string().optional()
});

export const etapaPlantillaSchema = z.object({
  categoria: z.string(),
  etapas: z.array(z.object({
    nombre: z.string().min(1).max(80),
    area: z.string().min(1).max(80),
    secuencia: z.number().int().positive()
  })).min(1)
});

export const materialSchema = z.object({
  codigo: z.string().min(1).max(30),
  nombre: z.string().min(1).max(160),
  unidad: UnidadMaterial,
  costoUnitario: z.union([z.string().regex(/^\d+(\.\d{1,4})?$/), z.number()]),
  existenciaInicial: z.number().nonnegative(),
  stockMinimo: z.number().nonnegative()
});

export const productoSchema = z.object({
  codigo: z.string().min(1).max(30),
  nombre: z.string().min(1).max(160),
  descripcion: z.string().optional(),
  categoria: z.string().min(1),
  unidadCobro: UnidadCobro,
  precioBase: z.union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number()])
});

export const recetaProductoSchema = z.object({
  producto: z.string(),
  materiales: z.array(z.object({
    material: z.string(),
    cantidad: z.number().positive()
  })).min(1)
});

export const clienteSchema = z.object({
  nombre: z.string().min(1).max(200),
  tipo: TipoCliente,
  ruc: z.string().max(20).optional(),
  contactoPrincipal: z.string().max(120).optional(),
  telefono: z.string().max(30).optional(),
  correo: z.string().max(254).optional(),
  direccion: z.string().optional(),
  notas: z.string().optional()
}).refine(d => d.telefono || d.correo, {
  message: 'Debe proporcionar teléfono o correo'
});

export const usuarioSchema = z.object({
  nombre: z.string().min(1).max(120),
  correo: z.string().email().max(254),
  perfil: CodigoPerfil,
  cargo: z.string().max(120),
  area: z.string().max(80).nullable(),
  clave: z.string().min(1)
});

export const lineaMaterialSchema = z.object({
  tipo: z.literal('MATERIAL'),
  material: z.string(),
  descripcion: z.string().optional(),
  cantidad: z.number().positive(),
  mermaPct: z.number().nonnegative().max(50)
});

export const lineaManObraSchema = z.object({
  tipo: z.literal('MANO_OBRA'),
  descripcion: z.string(),
  horas: z.number().positive(),
  tarifa: z.number().positive()
});

export const lineaTerceroSchema = z.object({
  tipo: z.literal('TERCERO'),
  descripcion: z.string(),
  costo: z.number().positive()
});

export const lineaItemSchema = z.union([lineaMaterialSchema, lineaManObraSchema, lineaTerceroSchema]);

export const itemCotizacionSchema = z.object({
  tipo: TipoItem,
  producto: z.string().optional(),
  categoria: z.string().optional(),
  descripcion: z.string().optional(),
  cantidad: z.number().positive(),
  ancho: z.number().positive().optional(),
  alto: z.number().positive().optional(),
  margenPct: z.number().nonnegative().max(100).optional(),
  lineas: z.array(lineaItemSchema).optional()
}).refine(
  item => item.tipo === 'CATALOGO' ? item.producto : item.categoria,
  { message: 'Catálogo requiere producto, personalizado requiere categoría' }
);

export const etapaOrdenSchema = z.object({
  nombre: z.string().max(80),
  estado: EstadoEtapa,
  responsable: z.string().nullable(),
  diasInicio: z.number().nullable(),
  diasFin: z.number().nullable()
});

export const consumoSchema = z.object({
  material: z.string(),
  cantidad: z.number().positive(),
  diasAtras: z.number().nonnegative()
});

export const ordenSchema = z.object({
  estadoFinal: EstadoOrden,
  responsable: z.string(),
  diasParaEntrega: z.number().nonnegative(),
  etapas: z.array(etapaOrdenSchema),
  consumos: z.array(consumoSchema)
});

export const escenarioSchema = z.object({
  clave: z.string().min(1),
  cliente: z.string().min(1),
  asunto: z.string().optional(),
  estadoFinal: EstadoCotizacion,
  diasAtras: z.number().nonnegative(),
  vigenciaDias: z.number().positive(),
  items: z.array(itemCotizacionSchema).min(1),
  orden: ordenSchema.optional()
});

export const entradaInventarioSchema = z.object({
  material: z.string(),
  cantidad: z.number().positive(),
  costoUnitario: z.union([z.string().regex(/^\d+(\.\d{1,4})?$/), z.number()]),
  diasAtras: z.number().nonnegative(),
  referencia: z.string().max(60)
});

// Tipos inferidos
export type Area = z.infer<typeof areaSchema>;
export type Categoria = z.infer<typeof categoriaSchema>;
export type Material = z.infer<typeof materialSchema>;
export type Producto = z.infer<typeof productoSchema>;
export type Usuario = z.infer<typeof usuarioSchema>;
export type Cliente = z.infer<typeof clienteSchema>;
export type Escenario = z.infer<typeof escenarioSchema>;
export type EntradaInventario = z.infer<typeof entradaInventarioSchema>;

// Validación de integridad
export function validarIntegridad(datos: {
  areas: Area[];
  categorias: Categoria[];
  materiales: Material[];
  productos: Producto[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recetas: any[];
  usuarios: Usuario[];
  clientes: Cliente[];
  escenarios: Escenario[];
  entradas: EntradaInventario[];
}) {
  const errores: string[] = [];

  // Validar áreas únicas
  const areasSet = new Set(datos.areas.map(a => a.nombre));
  if (areasSet.size !== datos.areas.length) {
    errores.push('Existen áreas duplicadas');
  }

  // Validar categorías únicas
  const categoriasSet = new Set(datos.categorias.map(c => c.nombre));
  if (categoriasSet.size !== datos.categorias.length) {
    errores.push('Existen categorías duplicadas');
  }

  // Validar materiales únicos y códigos válidos
  const materialCodigos = new Set<string>();
  for (const mat of datos.materiales) {
    if (materialCodigos.has(mat.codigo)) {
      errores.push(`Material duplicado: ${mat.codigo}`);
    }
    materialCodigos.add(mat.codigo);
  }

  // Validar productos únicos y categorías existen
  const productoCodigos = new Set<string>();
  for (const prod of datos.productos) {
    if (productoCodigos.has(prod.codigo)) {
      errores.push(`Producto duplicado: ${prod.codigo}`);
    }
    productoCodigos.add(prod.codigo);
    if (!categoriasSet.has(prod.categoria)) {
      errores.push(`Producto ${prod.codigo} referencia categoría inexistente: ${prod.categoria}`);
    }
  }

  // Validar recetas: materiales y productos existen
  for (const receta of datos.recetas) {
    if (!productoCodigos.has(receta.producto)) {
      errores.push(`Receta referencia producto inexistente: ${receta.producto}`);
    }
    for (const linea of receta.materiales) {
      if (!materialCodigos.has(linea.material)) {
        errores.push(`Receta de ${receta.producto} referencia material inexistente: ${linea.material}`);
      }
    }
  }

  // Validar usuarios únicos y áreas válidas
  const usuariosSet = new Set<string>();
  const usuariosClaves = new Set<string>();
  for (const usr of datos.usuarios) {
    if (usuariosSet.has(usr.correo)) {
      errores.push(`Usuario duplicado: ${usr.correo}`);
    }
    usuariosSet.add(usr.correo);
    usuariosClaves.add(usr.clave);
    if (usr.area && !areasSet.has(usr.area)) {
      errores.push(`Usuario ${usr.correo} referencia área inexistente: ${usr.area}`);
    }
  }

  // Validar clientes únicos
  const clientesNombres = new Set<string>();
  const rucUnicos = new Set<string>();
  for (const cli of datos.clientes) {
    if (clientesNombres.has(cli.nombre)) {
      errores.push(`Cliente duplicado: ${cli.nombre}`);
    }
    clientesNombres.add(cli.nombre);
    if (cli.ruc && rucUnicos.has(cli.ruc)) {
      errores.push(`RUC duplicado: ${cli.ruc}`);
    }
    if (cli.ruc) rucUnicos.add(cli.ruc);
  }

  // Validar escenarios: clientes y productos existen
  for (const esc of datos.escenarios) {
    if (!clientesNombres.has(esc.cliente)) {
      errores.push(`Escenario ${esc.clave} referencia cliente inexistente: ${esc.cliente}`);
    }
    for (const item of esc.items) {
      if (item.tipo === 'CATALOGO' && item.producto) {
        if (!productoCodigos.has(item.producto)) {
          errores.push(`Escenario ${esc.clave} referencia producto inexistente: ${item.producto}`);
        }
      }
      if (item.tipo === 'PERSONALIZADO' && item.categoria) {
        if (!categoriasSet.has(item.categoria)) {
          errores.push(`Escenario ${esc.clave} referencia categoría inexistente: ${item.categoria}`);
        }
        // Validar líneas en ítems personalizado
        if (item.lineas && item.lineas.length > 0) {
          if (item.lineas.length < 2) {
            errores.push(`Item personalizado de ${esc.clave} tiene menos de 2 líneas`);
          }
          const tiposLinea = new Set(item.lineas.map(l => l.tipo));
          if (!tiposLinea.has('MATERIAL')) {
            errores.push(`Item personalizado de ${esc.clave} carece de línea MATERIAL`);
          }
          if (!tiposLinea.has('MANO_OBRA')) {
            errores.push(`Item personalizado de ${esc.clave} carece de línea MANO_OBRA`);
          }
          for (const linea of item.lineas) {
            if (linea.tipo === 'MATERIAL' && !materialCodigos.has(linea.material)) {
              errores.push(`Item personalizado de ${esc.clave} referencia material inexistente: ${linea.material}`);
            }
          }
        }
      }
    }
    if (esc.orden) {
      if (!usuariosClaves.has(esc.orden.responsable)) {
        errores.push(`Orden de ${esc.clave} referencia usuario inexistente: ${esc.orden.responsable}`);
      }
      for (const consumo of esc.orden.consumos) {
        if (!materialCodigos.has(consumo.material)) {
          errores.push(`Consumo de orden ${esc.clave} referencia material inexistente: ${consumo.material}`);
        }
      }
    }
  }

  // Validar entradas: materiales existen
  for (const entrada of datos.entradas) {
    if (!materialCodigos.has(entrada.material)) {
      errores.push(`Entrada referencia material inexistente: ${entrada.material}`);
    }
  }

  // Validar que stock no sea negativo: existenciaInicial + entradas - consumos >= 0
  const saldoMateriales = new Map<string, number>();
  for (const mat of datos.materiales) {
    saldoMateriales.set(mat.codigo, mat.existenciaInicial);
  }
  for (const entrada of datos.entradas) {
    saldoMateriales.set(entrada.material, (saldoMateriales.get(entrada.material) || 0) + entrada.cantidad);
  }
  for (const esc of datos.escenarios) {
    if (esc.orden) {
      for (const consumo of esc.orden.consumos) {
        const saldo = saldoMateriales.get(consumo.material) || 0;
        saldoMateriales.set(consumo.material, saldo - consumo.cantidad);
        if ((saldoMateriales.get(consumo.material) || 0) < 0) {
          errores.push(`Material ${consumo.material} quedaría con saldo negativo`);
        }
      }
    }
  }

  return { valido: errores.length === 0, errores };
}
