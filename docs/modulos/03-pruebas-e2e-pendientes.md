# Referencia de pruebas E2E del módulo 2

Estado documental: actualizado a v9 el 2026-10-11.
Consulte los archivos existentes `e2e/catalogo.spec.ts` y `e2e/cotizaciones.spec.ts`.
No interprete esta referencia como evidencia de una nueva ejecución.
Conserve el nombre del documento como antecedente de las pruebas inicialmente pendientes.

## Fuentes

- Use [la matriz v9](09-perfiles-v9.md) y `src/core/permisos.ts` para permisos.
- Consulte `e2e/ayudas.ts` para perfiles, sesiones, axe y comprobación de desbordes.
- Consulte `playwright.config.ts` para los cuatro proyectos.
- Use 1920×1080, 1366×768, 1024×768 y 768×1024; retire la referencia anterior de 820 px.
- Lea los componentes antes de elegir etiquetas y roles.
- Obtenga claves únicamente desde variables `SEED_PASSWORD_*`.

## Catálogo

- Use Operaciones para crear, editar, agregar receta y archivar productos.
- Permita consulta a Gerencia, Administración, Atención al cliente y Producción.
- Oculte acciones de gestión a esos perfiles de consulta.
- Restrinja Administración técnica a `/sin-acceso`.
- Compruebe axe, desbordes y capturas según los casos existentes.

## Cotizaciones

- Use Atención al cliente para crear una cotización mixta y enviarla.
- Use Operaciones para aprobar con referencia obligatoria y versión vigente.
- Rechace referencias vacías o menores de tres caracteres.
- Muestre aprobador y referencia a Gerencia sin acciones de gestión.
- Permita consulta a Administración; restrinja Producción y Administración técnica.
- Use Atención al cliente para solicitar AJUSTE_SOLICITADO con motivo obligatorio.
- Cree una versión corregida en BORRADOR con versión comercial incrementada.
- Conserve la cotización original y su vínculo con la versión corregida.
- Consulte impresión, duplicación, axe, desbordes y capturas CF-10 según los casos existentes.

## Continuidad con órdenes

- Consulte `e2e/ordenes.spec.ts` para conversión por Operaciones sin responsable.
- Permita asignación posterior a Administración y Operaciones.
- Restrinja conversión a Atención al cliente y Gerencia.

## Datos y pendientes

- Cree datos propios con prefijo `E2E-` y marca temporal.
- Archive los datos propios al terminar; conserve los datos sembrados.
- Envíe `Origin` en escrituras directas a la API.
- Limite pruebas con efectos al proyecto portátil según los archivos existentes.
- Ejecute la suite mediante el orquestador antes de registrar nuevos resultados.
- Mantenga pendiente la medición automatizada de superposición para RNF-08.
