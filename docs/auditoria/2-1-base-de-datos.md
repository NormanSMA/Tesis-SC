# Fase 2.1: base de datos (2026-10-11)

Herramientas: `prisma validate`, `migrate status`, `migrate diff` y Squawk (ghcr.io/sbdchd/squawk, imagen autorizada por Norman). Ejecutadas por el `tester`; verificadas por el orquestador.

## Resultado
- `prisma validate`: esquema válido.
- `migrate status`: 20 migraciones aplicadas, base al día.
- `migrate diff` (base de demostración contra `schema.prisma`): sin diferencias. Deriva cero.
- Squawk: 669 advertencias, 0 errores, en 20 archivos (salida 1 por advertencias).

## Triaje de Squawk
- 590 de 669 son reglas de bloqueo en tablas grandes y de estilo: `prefer-robust-stmts` 181, `constraint-missing-not-valid` 161, `ban-drop-constraint` 111, `require-concurrent-index-creation` 75, `adding-foreign-key-constraint` 48, `require-lock-timeout` 20, `require-statement-timeout` 20. Casi todas vienen de `20261005205638_inicial`, que corre sobre una base vacía.
- P3: no se corrigen las migraciones ya aplicadas. Reescribirlas rompería la historia de Prisma.
- Las 12 reglas de baja frecuencia sí describen cambios sobre datos existentes. Revisadas a mano:
  - `adding-not-nullable-field` (`20261010100200`:21): falso positivo. Rellena con `UPDATE` y fija `DEFAULT` antes de `SET NOT NULL`.
  - `ban-drop-column` (`20261011020000`:18): intencional, contracción M8 de ADR-014. Hay script inverso en `prisma/migrations-down`.
  - `ban-drop-not-null` y `disallowed-unique-constraint` (`20261010100500`): cambio de diseño aprobado por Norman (orden sin responsable, cliente en la orden).
  - `renaming-object` (`20261010100000`:4): `RENAME VALUE` de VENTAS a ATENCION_CLIENTE, decidido en ADR-014.
  - `require-enum-value-ordering` 5, `prefer-text-field` 29, `prefer-bigint-over-int` 8: estilo; sin riesgo a esta escala.

## Hallazgos
- P3 (DevOps, no dato): sin Squawk en CI, una migración futura riesgosa pasa sin aviso. Arreglo: job de CI que corra Squawk solo sobre migraciones nuevas, con `.squawk.toml` que excluya `prefer-robust-stmts`, `prefer-text-field`, `prefer-bigint-*` y `require-enum-value-ordering`. Se hace en la parte 3.6.
- Sin hallazgos P0, P1 ni P2 en esta parte.
