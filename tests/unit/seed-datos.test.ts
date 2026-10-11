import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import {
  areaSchema,
  categoriaSchema,
  materialSchema,
  productoSchema,
  recetaProductoSchema,
  usuarioSchema,
  clienteSchema,
  escenarioSchema,
  entradaInventarioSchema,
  validarIntegridad
} from '../../prisma/seed/datos/esquemas';

const DATOS_DIR = path.join(__dirname, '../../prisma/seed/datos');

// Utilidades
function cargarJSON(archivo: string): unknown {
  const contenido = fs.readFileSync(path.join(DATOS_DIR, archivo), 'utf-8');
  return JSON.parse(contenido);
}

function parseArray<T>(datos: unknown, esquema: z.ZodSchema<T>): T[] {
  if (!Array.isArray(datos)) {
    throw new Error(`${datos} no es un array`);
  }
  return datos.map((item, idx) => {
    const resultado = esquema.safeParse(item);
    if (!resultado.success) {
      throw new Error(`Item ${idx}: ${resultado.error.message}`);
    }
    return resultado.data;
  });
}

 
describe('Datos de prueba', () => {
  describe('Carga de JSON', () => {
    it('debe cargar areas.json', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datos = cargarJSON('areas.json') as any[];
      expect(Array.isArray(datos)).toBe(true);
      expect(datos.length).toBeGreaterThan(0);
    });

    it('debe cargar categorias.json', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datos = cargarJSON('categorias.json') as any[];
      expect(Array.isArray(datos)).toBe(true);
      expect(datos.length).toBe(8);
    });

    it('debe cargar materiales.json', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datos = cargarJSON('materiales.json') as any[];
      expect(Array.isArray(datos)).toBe(true);
      expect(datos.length).toBeGreaterThanOrEqual(30);
    });

    it('debe cargar productos.json', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datos = cargarJSON('productos.json') as any[];
      expect(Array.isArray(datos)).toBe(true);
      expect(datos.length).toBeGreaterThanOrEqual(34);
    });

    it('debe cargar clientes.json', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datos = cargarJSON('clientes.json') as any[];
      expect(Array.isArray(datos)).toBe(true);
      expect(datos.length).toBeGreaterThanOrEqual(25);
    });

    it('debe cargar usuarios.json', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datos = cargarJSON('usuarios.json') as any[];
      expect(Array.isArray(datos)).toBe(true);
      expect(datos.length).toBe(10);
    });

    it('debe cargar escenarios.json', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const datos = cargarJSON('escenarios.json') as any[];
      expect(Array.isArray(datos)).toBe(true);
      expect(datos.length).toBeGreaterThanOrEqual(14);
    });
  });

  describe('Validación de esquemas', () => {
    it('áreas deben ser válidas', () => {
      const datos = cargarJSON('areas.json');
      const parsed = parseArray(datos, areaSchema);
      expect(parsed.length).toBeGreaterThan(0);
    });

    it('categorías deben ser válidas', () => {
      const datos = cargarJSON('categorias.json');
      const parsed = parseArray(datos, categoriaSchema);
      expect(parsed.length).toBe(8);
    });

    it('materiales deben ser válidos', () => {
      const datos = cargarJSON('materiales.json');
      const parsed = parseArray(datos, materialSchema);
      expect(parsed.length).toBeGreaterThanOrEqual(30);
    });

    it('productos deben ser válidos', () => {
      const datos = cargarJSON('productos.json');
      const parsed = parseArray(datos, productoSchema);
      expect(parsed.length).toBeGreaterThanOrEqual(34);
    });

    it('recetas deben ser válidas', () => {
      const datos = cargarJSON('recetas.json');
      const parsed = parseArray(datos, recetaProductoSchema);
      expect(parsed.length).toBeGreaterThan(0);
    });

    it('clientes deben ser válidos', () => {
      const datos = cargarJSON('clientes.json');
      const parsed = parseArray(datos, clienteSchema);
      expect(parsed.length).toBeGreaterThanOrEqual(25);
    });

    it('usuarios deben ser válidos', () => {
      const datos = cargarJSON('usuarios.json');
      const parsed = parseArray(datos, usuarioSchema);
      expect(parsed.length).toBe(10);
    });

    it('escenarios deben ser válidos', () => {
      const datos = cargarJSON('escenarios.json');
      const parsed = parseArray(datos, escenarioSchema);
      expect(parsed.length).toBeGreaterThanOrEqual(14);
    });

    it('entradas deben ser válidas', () => {
      const datos = cargarJSON('entradas-inventario.json');
      const parsed = parseArray(datos, entradaInventarioSchema);
      expect(parsed.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Integridad referencial', () => {
    it('debe validar todas las referencias', () => {
       
      const datos = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        areas: parseArray(cargarJSON('areas.json'), areaSchema) as any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        categorias: parseArray(cargarJSON('categorias.json'), categoriaSchema) as any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        materiales: parseArray(cargarJSON('materiales.json'), materialSchema) as any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        productos: parseArray(cargarJSON('productos.json'), productoSchema) as any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recetas: parseArray(cargarJSON('recetas.json'), recetaProductoSchema) as any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        usuarios: parseArray(cargarJSON('usuarios.json'), usuarioSchema) as any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        clientes: parseArray(cargarJSON('clientes.json'), clienteSchema) as any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        escenarios: parseArray(cargarJSON('escenarios.json'), escenarioSchema) as any[],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entradas: parseArray(cargarJSON('entradas-inventario.json'), entradaInventarioSchema) as any[]
      };

      const resultado = validarIntegridad(datos);
      if (!resultado.valido) {
        throw new Error(`Errores de integridad:\n${resultado.errores.join('\n')}`);
      }
      expect(resultado.valido).toBe(true);
    });
  });

  describe('Cobertura de estados', () => {
    it('debe cubrir todos los estados de cotización', () => {
      const escenarios = parseArray(cargarJSON('escenarios.json'), escenarioSchema);
      const estados = new Set(escenarios.map(e => e.estadoFinal));

      expect(estados.has('BORRADOR')).toBe(true);
      expect(estados.has('ENVIADA')).toBe(true);
      expect(estados.has('APROBADA')).toBe(true);
      expect(estados.has('RECHAZADA')).toBe(true);
      expect(estados.has('VENCIDA')).toBe(true);
    });

    it('debe cubrir todos los estados de orden', () => {
      const escenarios = parseArray(cargarJSON('escenarios.json'), escenarioSchema);
      const ordenesConEstado = escenarios
        .filter(e => e.orden)
        .map(e => e.orden!.estadoFinal);

      const estados = new Set(ordenesConEstado);
      expect(estados.has('PENDIENTE')).toBe(true);
      expect(estados.has('EN_PRODUCCION')).toBe(true);
      expect(estados.has('LISTA')).toBe(true);
      expect(estados.has('ENTREGADA')).toBe(true);
      expect(estados.has('CERRADA')).toBe(true);
      expect(estados.has('CANCELADA')).toBe(true);
    });

    it('debe tener al menos 2 cotizaciones BORRADOR', () => {
      const escenarios = parseArray(cargarJSON('escenarios.json'), escenarioSchema);
      const borradores = escenarios.filter(e => e.estadoFinal === 'BORRADOR');
      expect(borradores.length).toBeGreaterThanOrEqual(2);
    });

    it('debe tener al menos 2 cotizaciones ENVIADA', () => {
      const escenarios = parseArray(cargarJSON('escenarios.json'), escenarioSchema);
      const enviadas = escenarios.filter(e => e.estadoFinal === 'ENVIADA');
      expect(enviadas.length).toBeGreaterThanOrEqual(2);
    });

    it('debe tener al menos 5 cotizaciones APROBADA', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const escenarios = parseArray(cargarJSON('escenarios.json'), escenarioSchema) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const aprobadas = escenarios.filter((e: any) => e.estadoFinal === 'APROBADA');
      expect(aprobadas.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Materiales críticos', () => {
    it('debe tener al menos 4 materiales bajo stock mínimo', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const materiales = parseArray(cargarJSON('materiales.json'), materialSchema) as any[];
       
      const bajoMinimo = materiales.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (m: any) => parseFloat(m.existenciaInicial as any) < parseFloat(m.stockMinimo as any)
      );
      expect(bajoMinimo.length).toBeGreaterThanOrEqual(4);
    });

    it('debe tener al menos 1 material en cero existencia', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const materiales = parseArray(cargarJSON('materiales.json'), materialSchema) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enCero = materiales.filter(m => parseFloat(m.existenciaInicial as any) === 0);
      expect(enCero.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Contenido de datos', () => {
    it('debe tener cotizaciones personalizadas', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const escenarios = parseArray(cargarJSON('escenarios.json'), escenarioSchema) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const personalizadas = escenarios.filter((e: any) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        e.items.some((item: any) => item.tipo === 'PERSONALIZADO')
      );
      expect(personalizadas.length).toBeGreaterThanOrEqual(3);
    });

    it('debe tener al menos 1 cotización de mobiliario', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const escenarios = parseArray(cargarJSON('escenarios.json'), escenarioSchema) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mobiliario = escenarios.filter((e: any) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        e.items.some((item: any) =>
          item.tipo === 'PERSONALIZADO' && item.categoria === 'Mobiliario'
        )
      );
      expect(mobiliario.length).toBeGreaterThanOrEqual(1);
    });

    it('debe tener usuarios de todos los perfiles', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const usuarios = parseArray(cargarJSON('usuarios.json'), usuarioSchema) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const perfiles = new Set(usuarios.map((u: any) => u.perfil));

      expect(perfiles.has('GERENCIA')).toBe(true);
      expect(perfiles.has('ADMINISTRACION')).toBe(true);
      expect(perfiles.has('OPERACIONES')).toBe(true);
      expect(perfiles.has('ATENCION_CLIENTE')).toBe(true);
      expect(perfiles.has('PRODUCCION')).toBe(true);
      expect(perfiles.has('ADMIN')).toBe(true);
    });

    it('debe tener clientes de ambos tipos', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clientes = parseArray(cargarJSON('clientes.json'), clienteSchema) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tipos = new Set(clientes.map((c: any) => c.tipo));

      expect(tipos.has('PERSONA')).toBe(true);
      expect(tipos.has('EMPRESA')).toBe(true);
    });
  });

  describe('Conteos mínimos', () => {
    it('debe tener al menos 25 clientes', () => {
      const clientes = parseArray(cargarJSON('clientes.json'), clienteSchema);
      expect(clientes.length).toBeGreaterThanOrEqual(25);
    });

    it('debe tener al menos 30 materiales', () => {
      const materiales = parseArray(cargarJSON('materiales.json'), materialSchema);
      expect(materiales.length).toBeGreaterThanOrEqual(30);
    });

    it('debe tener al menos 34 productos', () => {
      const productos = parseArray(cargarJSON('productos.json'), productoSchema);
      expect(productos.length).toBeGreaterThanOrEqual(34);
    });

    it('debe tener 8 categorías', () => {
      const categorias = parseArray(cargarJSON('categorias.json'), categoriaSchema);
      expect(categorias.length).toBe(8);
    });

    it('debe tener al menos 14 escenarios', () => {
      const escenarios = parseArray(cargarJSON('escenarios.json'), escenarioSchema);
      expect(escenarios.length).toBeGreaterThanOrEqual(14);
    });
  });

  describe('Validación de ítems personalizados', () => {
    it('todo ítem personalizado debe tener líneas con MATERIAL y MANO_OBRA', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const escenarios = parseArray(cargarJSON('escenarios.json'), escenarioSchema) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const personalizados = escenarios.flatMap((e: any) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        e.items.filter((item: any) => item.tipo === 'PERSONALIZADO').map((item: any) => ({
          escenario: e.clave,
          item
        }))
      );

      expect(personalizados.length).toBeGreaterThanOrEqual(6);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personalizados.forEach((p: any) => {
        expect(p.item.lineas).toBeDefined();
        expect(Array.isArray(p.item.lineas)).toBe(true);
        expect(p.item.lineas.length).toBeGreaterThanOrEqual(2);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tiposLinea = new Set(p.item.lineas.map((l: any) => l.tipo));
        expect(tiposLinea.has('MATERIAL')).toBe(true);
        expect(tiposLinea.has('MANO_OBRA')).toBe(true);
      });
    });

    it('precio calculado de ítems personalizados debe estar entre C$3,000 y C$80,000', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const materiales = parseArray(cargarJSON('materiales.json'), materialSchema) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const materialMap = new Map(materiales.map((m: any) => [m.codigo, m.costoUnitario]));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const escenarios = parseArray(cargarJSON('escenarios.json'), escenarioSchema) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const personalizados = escenarios.flatMap((e: any) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        e.items.filter((item: any) => item.tipo === 'PERSONALIZADO').map((item: any) => ({
          escenario: e.clave,
          item
        }))
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      personalizados.forEach((p: any) => {
        if (p.item.lineas && p.item.lineas.length > 0) {
          let costoTotal = 0;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          p.item.lineas.forEach((linea: any) => {
            if (linea.tipo === 'MATERIAL') {
              const costoPorUnidad = materialMap.get(linea.material) || 0;
              const costoMaterial = linea.cantidad * costoPorUnidad;
              const conMerma = costoMaterial * (1 + (linea.mermaPct || 0) / 100);
              costoTotal += conMerma;
            } else if (linea.tipo === 'MANO_OBRA') {
              const costoMO = linea.horas * linea.tarifa;
              costoTotal += costoMO;
            } else if (linea.tipo === 'TERCERO') {
              costoTotal += linea.costo;
            }
          });

          const margenPct = p.item.margenPct || 30;
          const precioCalculado = costoTotal / (1 - margenPct / 100);

          expect(precioCalculado).toBeGreaterThanOrEqual(3000);
          expect(precioCalculado).toBeLessThanOrEqual(80000);
        }
      });
    });
  });
});
