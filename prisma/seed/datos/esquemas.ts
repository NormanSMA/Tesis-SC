import { z } from 'zod';
import {
  validarAreas, validarCategorias, validarMateriales, validarProductos,
  validarRecetas, validarUsuarios, validarClientes, validarEscenarios,
  validarEntradas, validarSaldos
} from './integridad';

export const CodigoPerfil = z.enum(['GERENCIA', 'ADMINISTRACION', 'OPERACIONES', 'ATENCION_CLIENTE', 'PRODUCCION', 'ADMIN']);
export const TipoCliente = z.enum(['PERSONA', 'EMPRESA']);
export const UnidadCobro = z.enum(['UNIDAD', 'M2']);
export const UnidadMaterial = z.enum([
  'UNIDAD', 'METRO', 'M2', 'YARDA', 'PIE', 'LITRO',
  'GALON', 'KILOGRAMO', 'LIBRA', 'PLIEGO', 'ROLLO'
]);
export const EstadoCotizacion = z.enum([
  'BORRADOR', 'ENVIADA', 'APROBADA', 'RECHAZADA', 'VENCIDA', 'AJUSTE_SOLICITADO'
]);
export const EstadoOrden = z.enum([
  'PENDIENTE', 'EN_PRODUCCION', 'LISTA', 'ENTREGADA', 'CERRADA', 'CANCELADA'
]);
export const EstadoEtapa = z.enum([
  'PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'OMITIDA'
]);
export const TipoItem = z.enum(['CATALOGO', 'PERSONALIZADO']);

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
}).refine(cliente => cliente.telefono || cliente.correo, {
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
  origen: z.string().min(1).optional(),
  motivoAjuste: z.string().trim().min(3).optional(),
  estadoFinal: EstadoCotizacion,
  diasAtras: z.number().nonnegative(),
  vigenciaDias: z.number().positive(),
  items: z.array(itemCotizacionSchema).min(1),
  orden: ordenSchema.optional()
}).refine(escenario => escenario.estadoFinal !== 'AJUSTE_SOLICITADO' || escenario.motivoAjuste, {
  message: 'AJUSTE_SOLICITADO requiere motivoAjuste de al menos tres caracteres',
  path: ['motivoAjuste']
}).refine(escenario => !escenario.origen || ['BORRADOR', 'ENVIADA'].includes(escenario.estadoFinal), {
  message: 'La versión corregida debe quedar en BORRADOR o ENVIADA',
  path: ['estadoFinal']
});

export const entradaInventarioSchema = z.object({
  material: z.string(),
  cantidad: z.number().positive(),
  costoUnitario: z.union([z.string().regex(/^\d+(\.\d{1,4})?$/), z.number()]),
  diasAtras: z.number().nonnegative(),
  referencia: z.string().max(60)
});

export type Area = z.infer<typeof areaSchema>;
export type Categoria = z.infer<typeof categoriaSchema>;
export type Material = z.infer<typeof materialSchema>;
export type Producto = z.infer<typeof productoSchema>;
export type Usuario = z.infer<typeof usuarioSchema>;
export type Cliente = z.infer<typeof clienteSchema>;
export type Escenario = z.infer<typeof escenarioSchema>;
export type EntradaInventario = z.infer<typeof entradaInventarioSchema>;

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
  const errores = [
    ...validarAreas(datos.areas),
    ...validarCategorias(datos.categorias),
    ...validarMateriales(datos.materiales),
    ...validarProductos(datos.productos, datos.categorias),
    ...validarRecetas(datos.recetas, datos.productos, datos.materiales),
    ...validarUsuarios(datos.usuarios, datos.areas),
    ...validarClientes(datos.clientes),
    ...validarEscenarios(datos),
    ...validarEntradas(datos.entradas, datos.materiales),
    ...validarSaldos(datos)
  ];

  return { valido: errores.length === 0, errores };
}
