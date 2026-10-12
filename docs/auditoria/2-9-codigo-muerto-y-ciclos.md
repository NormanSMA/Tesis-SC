# Fase 2.9: código muerto y ciclos (2026-10-11)

## Código muerto (knip, `pnpm dlx knip`, sin instalar en el proyecto)
- 6 archivos sin uso, 1 dependencia, 37 exportaciones y 21 tipos exportados sin uso.
- Verificado: `src/components/ui/scroll-area.tsx` no lo importa nadie (único uso: él mismo). P3: borrar.
- Falso positivo: `@prisma/client` se usa en `src/generated/prisma/*` (cliente generado con `output` propio). Mantener.
- Scripts `scripts/captura-*.mjs` y `scripts/db/generar-migracion.mjs`: herramientas manuales. Mantener y documentar en el README.
- `prisma/schema.prisma` aparece por no ser importado: falso positivo.
- Exportaciones sin uso: la mayoría son piezas shadcn (`dialog`, `dropdown-menu`, `select`, `sheet`, `avatar`...). P3: no borrar, es API estándar de la librería.
- Exportaciones sin uso propias de dominio, P3 (revisar y quitar `export`): `aClienteDto`, `exigirEtapa`, `filtroAlerta`, `LISTA_DETALLE`, `esquemaId`, `LIMITE_HISTORIAL`, `TOPE_CLIENTES_SELECTOR`, `TOPE_OPCIONES_LIBRO`.
- Tipos sin uso de `src/core/consumo-estimado.ts` y `costeo.ts` (`OrigenEstimado`, `LineaReceta`, `TipoItem`...): P3.

## Ciclos y capas
- `dependency-cruiser` con `pnpm dlx` analizó 0 módulos (no encuentra el compilador TypeScript en la caché temporal). Resultado inválido, descartado.
- Reemplazo: script propio con la API de TypeScript del proyecto (453 módulos, 1710 aristas, sin tests ni código generado). Alias `@/` resuelto.
- 2 ciclos, ambos solo de tipos (`import type`, se borran al compilar). P3:
  - `src/modules/auth/service.ts:5` <-> `src/lib/auth/sesion.ts:5` (`UsuarioSesion`).
  - `src/modules/inventario/componentes/CamposLibro.tsx:6` <-> `FormularioLibro.tsx` (`ValoresLibro`).
  - Arreglo: mover los tipos a un archivo `tipos.ts` neutro. Prueba: el script de ciclos devuelve 0.
- Reglas de capa verificadas: `src/core` no importa de `modules`, `app` ni `components`; `modules` no importa de `app`. 0 violaciones.
- P3 de acoplamiento: `src/modules/inventario/componentes/FormularioLibro.tsx:8` importa un hook de cotizaciones (`useSolicitudCotizacion`). Mover `enfocarError` y `erroresEsquema` a `src/components/comunes`.

## Cierre
- Sin P0, P1 ni P2. Todo es limpieza P3.
- Corrección propuesta: un solo encargo "limpieza" al final de la fase 2 (archivo sin uso, `export` de más, tipos neutros). Script de ciclos a guardar como `scripts/auditoria/ciclos.mjs` y enlazar desde `audit:code`.
