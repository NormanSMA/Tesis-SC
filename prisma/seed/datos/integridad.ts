import type {
  Area, Categoria, Material, Producto, Usuario, Cliente, Escenario, EntradaInventario
} from './esquemas';

type Receta = { producto: string; materiales: { material: string }[] };
type DatosEscenarios = {
  escenarios: Escenario[];
  clientes: Cliente[];
  productos: Producto[];
  categorias: Categoria[];
  materiales: Material[];
  usuarios: Usuario[];
};
type ReferenciasEscenario = {
  clientes: ReadonlySet<string>;
  productos: ReadonlySet<string>;
  categorias: ReadonlySet<string>;
  materiales: ReadonlySet<string>;
  usuarios: ReadonlySet<string>;
};
type Item = Escenario['items'][number];

export function validarAreas(areas: Area[]): string[] {
  const nombres = new Set(areas.map(area => area.nombre));
  return nombres.size !== areas.length ? ['Existen áreas duplicadas'] : [];
}

export function validarCategorias(categorias: Categoria[]): string[] {
  const nombres = new Set(categorias.map(categoria => categoria.nombre));
  return nombres.size !== categorias.length ? ['Existen categorías duplicadas'] : [];
}

export function validarMateriales(materiales: Material[]): string[] {
  const errores: string[] = [];
  const codigos = new Set<string>();
  for (const material of materiales) {
    if (codigos.has(material.codigo)) {
      errores.push(`Material duplicado: ${material.codigo}`);
    }
    codigos.add(material.codigo);
  }
  return errores;
}

export function validarProductos(productos: Producto[], categorias: Categoria[]): string[] {
  const errores: string[] = [];
  const codigos = new Set<string>();
  const categoriasSet = new Set(categorias.map(categoria => categoria.nombre));
  for (const producto of productos) {
    if (codigos.has(producto.codigo)) {
      errores.push(`Producto duplicado: ${producto.codigo}`);
    }
    codigos.add(producto.codigo);
    if (!categoriasSet.has(producto.categoria)) {
      errores.push(`Producto ${producto.codigo} referencia categoría inexistente: ${producto.categoria}`);
    }
  }
  return errores;
}

export function validarRecetas(recetas: Receta[], productos: Producto[], materiales: Material[]): string[] {
  const errores: string[] = [];
  const productoCodigos = new Set(productos.map(producto => producto.codigo));
  const materialCodigos = new Set(materiales.map(material => material.codigo));
  for (const receta of recetas) {
    if (!productoCodigos.has(receta.producto)) {
      errores.push(`Receta referencia producto inexistente: ${receta.producto}`);
    }
    for (const linea of receta.materiales) {
      if (!materialCodigos.has(linea.material)) {
        errores.push(`Receta de ${receta.producto} referencia material inexistente: ${linea.material}`);
      }
    }
  }
  return errores;
}

export function validarUsuarios(usuarios: Usuario[], areas: Area[]): string[] {
  const errores: string[] = [];
  const correos = new Set<string>();
  const areasSet = new Set(areas.map(area => area.nombre));
  for (const usuario of usuarios) {
    if (correos.has(usuario.correo)) {
      errores.push(`Usuario duplicado: ${usuario.correo}`);
    }
    correos.add(usuario.correo);
    if (usuario.area && !areasSet.has(usuario.area)) {
      errores.push(`Usuario ${usuario.correo} referencia área inexistente: ${usuario.area}`);
    }
  }
  return errores;
}

export function validarClientes(clientes: Cliente[]): string[] {
  const errores: string[] = [];
  const nombres = new Set<string>();
  const rucUnicos = new Set<string>();
  for (const cliente of clientes) {
    if (nombres.has(cliente.nombre)) {
      errores.push(`Cliente duplicado: ${cliente.nombre}`);
    }
    nombres.add(cliente.nombre);
    if (cliente.ruc && rucUnicos.has(cliente.ruc)) {
      errores.push(`RUC duplicado: ${cliente.ruc}`);
    }
    if (cliente.ruc) rucUnicos.add(cliente.ruc);
  }
  return errores;
}

function validarLineasPersonalizadas(
  lineas: NonNullable<Item['lineas']>, clave: string, materiales: ReadonlySet<string>
): string[] {
  const errores: string[] = [];
  if (lineas.length === 0) return errores;
  if (lineas.length < 2) {
    errores.push(`Item personalizado de ${clave} tiene menos de 2 líneas`);
  }
  const tiposLinea = new Set(lineas.map(linea => linea.tipo));
  if (!tiposLinea.has('MATERIAL')) {
    errores.push(`Item personalizado de ${clave} carece de línea MATERIAL`);
  }
  if (!tiposLinea.has('MANO_OBRA')) {
    errores.push(`Item personalizado de ${clave} carece de línea MANO_OBRA`);
  }
  for (const linea of lineas) {
    if (linea.tipo === 'MATERIAL' && !materiales.has(linea.material)) {
      errores.push(`Item personalizado de ${clave} referencia material inexistente: ${linea.material}`);
    }
  }
  return errores;
}

function validarItem(item: Item, clave: string, referencias: ReferenciasEscenario): string[] {
  const errores: string[] = [];
  if (item.tipo === 'CATALOGO' && item.producto && !referencias.productos.has(item.producto)) {
    errores.push(`Escenario ${clave} referencia producto inexistente: ${item.producto}`);
  }
  if (item.tipo === 'PERSONALIZADO' && item.categoria) {
    if (!referencias.categorias.has(item.categoria)) {
      errores.push(`Escenario ${clave} referencia categoría inexistente: ${item.categoria}`);
    }
    if (item.lineas) {
      errores.push(...validarLineasPersonalizadas(item.lineas, clave, referencias.materiales));
    }
  }
  return errores;
}

function validarOrden(escenario: Escenario, referencias: ReferenciasEscenario): string[] {
  const errores: string[] = [];
  if (!escenario.orden) return errores;
  if (!referencias.usuarios.has(escenario.orden.responsable)) {
    errores.push(`Orden de ${escenario.clave} referencia usuario inexistente: ${escenario.orden.responsable}`);
  }
  for (const consumo of escenario.orden.consumos) {
    if (!referencias.materiales.has(consumo.material)) {
      errores.push(`Consumo de orden ${escenario.clave} referencia material inexistente: ${consumo.material}`);
    }
  }
  return errores;
}

function validarEscenario(escenario: Escenario, referencias: ReferenciasEscenario): string[] {
  const errores: string[] = [];
  if (!referencias.clientes.has(escenario.cliente)) {
    errores.push(`Escenario ${escenario.clave} referencia cliente inexistente: ${escenario.cliente}`);
  }
  return [
    ...errores,
    ...escenario.items.flatMap(item => validarItem(item, escenario.clave, referencias)),
    ...validarOrden(escenario, referencias)
  ];
}

export function validarEscenarios(datos: DatosEscenarios): string[] {
  const referencias: ReferenciasEscenario = {
    clientes: new Set(datos.clientes.map(cliente => cliente.nombre)),
    productos: new Set(datos.productos.map(producto => producto.codigo)),
    categorias: new Set(datos.categorias.map(categoria => categoria.nombre)),
    materiales: new Set(datos.materiales.map(material => material.codigo)),
    usuarios: new Set(datos.usuarios.map(usuario => usuario.clave))
  };
  return datos.escenarios.flatMap(escenario => validarEscenario(escenario, referencias));
}

export function validarEntradas(entradas: EntradaInventario[], materiales: Material[]): string[] {
  const errores: string[] = [];
  const materialCodigos = new Set(materiales.map(material => material.codigo));
  for (const entrada of entradas) {
    if (!materialCodigos.has(entrada.material)) {
      errores.push(`Entrada referencia material inexistente: ${entrada.material}`);
    }
  }
  return errores;
}

export function validarSaldos(datos: {
  materiales: Material[]; entradas: EntradaInventario[]; escenarios: Escenario[];
}): string[] {
  const errores: string[] = [];
  const saldoMateriales = new Map<string, number>();
  for (const material of datos.materiales) {
    saldoMateriales.set(material.codigo, material.existenciaInicial);
  }
  for (const entrada of datos.entradas) {
    saldoMateriales.set(entrada.material, (saldoMateriales.get(entrada.material) || 0) + entrada.cantidad);
  }
  for (const escenario of datos.escenarios) {
    if (!escenario.orden) continue;
    for (const consumo of escenario.orden.consumos) {
      const saldo = saldoMateriales.get(consumo.material) || 0;
      saldoMateriales.set(consumo.material, saldo - consumo.cantidad);
      if ((saldoMateriales.get(consumo.material) || 0) < 0) {
        errores.push(`Material ${consumo.material} quedaría con saldo negativo`);
      }
    }
  }
  return errores;
}
