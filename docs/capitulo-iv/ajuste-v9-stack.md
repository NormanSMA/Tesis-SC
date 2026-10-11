# Ajustes de la tesis v9 al sistema construido (borrador)

Fuente: tesis v9, secciones 4.4, 4.6 y 4.9 (Tablas 14, 16, 19 y 20) y `comparacion-stack.md`.
Estado: borrador para Norman y Jorge. Pegar en la tesis después de revisar. Redactado por el orquestador; el primer borrador de Gemini se verificó contra el repositorio.
Decisión de Norman (2026-10-10): ajustar la tesis al sistema construido. No se rehace el sistema.

## 1. Sección 4.9 y Tablas 19 y 20 (reemplazan el texto de v9)

La selección tecnológica se realizó con los criterios del marco tecnológico: compatibilidad con la arquitectura web, integridad transaccional, control de acceso, mantenibilidad, documentación, costo de licencias, reproducibilidad y pruebas. Se compararon alternativas capaces de implementar los módulos del proyecto. La preferencia por una opción no implica que las demás sean insuficientes. El cumplimiento de cada RNF se supedita a las pruebas sobre la implementación.

Tabla 19
Comparación técnica de alternativas por componente

| Componente | Alternativas consideradas | Criterio de selección y conclusión |
|---|---|---|
| Interfaz y servicios API | Next.js con React y TypeScript; React con Vite más NestJS; Django con HTMX | Las tres permiten reglas y APIs. Se selecciona Next.js: un solo repositorio, un solo contenedor y tipos compartidos entre interfaz y API. NestJS ofrece más estructura modular y exige mantener dos aplicaciones. |
| Persistencia | PostgreSQL; MySQL; SQLite | Se selecciona PostgreSQL 17 por transacciones, bloqueo de filas (`FOR UPDATE`), restricciones y triggers. El consumo concurrente de inventario exige bloqueo de filas. |
| Acceso a datos | Prisma; Drizzle; TypeORM | Se selecciona Prisma 7.10 con migraciones versionadas. Las restricciones CHECK y los triggers se agregan con SQL en la migración. Las consultas críticas usan transacciones explícitas. |
| Interfaz de componentes | shadcn/ui con Tailwind; componentes propios; biblioteca cerrada | Se selecciona shadcn/ui sobre Tailwind 4: primitivas accesibles con soporte de teclado y ARIA, y código dentro del repositorio. |
| Entorno | Docker Compose; PaaS gestionado; máquina virtual | Se selecciona Docker Compose por configuración reproducible y funcionamiento sin internet. Los puertos solo escuchan en 127.0.0.1. |

Nota. Comparación cualitativa orientada al caso de estudio; no se asignaron puntajes de rendimiento no medidos. La valoración ponderada de las plataformas completas figura en el anexo de comparación (cuatro opciones a menos de 5 puntos). La experiencia previa del autor y el plazo de diciembre de 2026 inclinaron la decisión hacia Next.js; es una decisión de viabilidad, no de calidad técnica. Elaboración propia.

La combinación seleccionada consta de Next.js 16 con React 19 y TypeScript para la interfaz y la API, PostgreSQL 17 como base de datos relacional, Prisma 7.10 para el acceso a datos y las migraciones, y Docker Compose para entornos reproducibles. Corresponde a una propuesta técnica compatible con el alcance funcional, no a una demostración anticipada de rendimiento, seguridad o disponibilidad.

Tabla 20
Tecnologías seleccionadas y requisitos que respaldan

| Tecnología | Responsabilidad | Cobertura por verificar |
|---|---|---|
| Next.js + React + TypeScript | Vistas, formularios, navegación y API HTTPS con casos de uso, permisos, validaciones y auditoría. | RF-01 a RF-10; RNF-01 a RNF-04 y RNF-08. |
| PostgreSQL + Prisma | Modelo relacional, migraciones, saldos, vínculos y transacciones. | RF-01 a RF-08; RNF-05. |
| Docker Compose | Configuración replicable de aplicación y base de datos. | Despliegue, respaldo y recuperación: RNF-06 y RNF-07. |
| Git y pruebas automatizadas (Vitest, Playwright, axe) | Versionado, pruebas unitarias, de integración, E2E y de accesibilidad. | Evidencia de calidad y reproducibilidad de entregas. |

Nota. La tabla describe la cobertura técnica de cada tecnología, no una certificación de cumplimiento. Las versiones exactas constan en `package.json` y en las imágenes de Docker del repositorio. Elaboración propia.

TypeScript aporta verificación estática y no sustituye las validaciones de entrada. Prisma simplifica el acceso a datos y no reemplaza el control explícito de transacciones y concurrencia. Docker Compose favorece la reproducibilidad y no equivale a alta disponibilidad.

## 2. Texto para el diagrama C4 (contenedores y componentes)

Contenedor "Aplicación web": Next.js 16 con React 19. Sirve la interfaz y expone la API HTTPS bajo `/api/v1`. Sus componentes son: interfaz por módulo (clientes, catálogo, cotizaciones, órdenes, inventario, producción, trazabilidad, panel y administración), servicios de dominio con reglas de negocio y autorización por permiso, y acceso a datos con Prisma Client.
Contenedor "Base de datos": PostgreSQL 17. Conserva el modelo relacional, las restricciones, los triggers de estados, la bitácora de solo inserción y el libro de inventario.
Relación: la aplicación usa un rol de base de datos sin privilegios de propietario. La conexión local no sale de 127.0.0.1. En operación controlada el transporte usa TLS 1.2 o superior (RNF-04).
Entorno: Docker Compose con los servicios de aplicación, migración y base de datos.

## 3. Justificación de los estados de la orden

El sistema implementa seis estados de la orden: PENDIENTE, EN_PRODUCCION, LISTA, ENTREGADA, CERRADA y CANCELADA. El ERD v9 define tres: REGISTRADA, EN_PRODUCCION y FINALIZADA. PENDIENTE corresponde a REGISTRADA. EN_PRODUCCION coincide. LISTA, ENTREGADA y CERRADA desglosan FINALIZADA, porque la entrega al cliente y el cierre administrativo son hechos distintos con responsables y fechas propias (RF-08). CANCELADA es un estado de excepción que el ERD no modela. Se conserva para impedir consumos nuevos y exigir motivo. Una transición no válida se rechaza en la base de datos (función `transicion_valida` y triggers). La correspondencia no altera los requisitos: toda orden registrada llega a un estado final trazable.

## 4. Justificación de UUID frente a bigserial

El ERD v9 usa `bigserial`. La implementación usa UUID (`gen_random_uuid()`) como clave primaria. El UUID evita revelar el volumen de documentos en las rutas y en las respuestas de la API, impide enumerar registros por incremento y permite generar identificadores en el cliente o en la siembra sin consultar un contador. Las claves siguen siendo no nulas, únicas y con integridad referencial, como exige la Tabla 16. El costo es un índice mayor. Para el volumen del piloto no afecta el rendimiento. La numeración legible para el usuario (COT-AAAA-NNNN, OT-AAAA-NNNN) es independiente de la clave y se asigna sin huecos con un contador transaccional. La diferencia es de implementación física, no de modelo lógico.

## 5. Puntos que Norman y Jorge deben decidir o revisar

1. v9 4.9 declara "no se supone experiencia previa de los autores", pero la comparación del repositorio usa la experiencia previa (proyecto TURNO) como criterio. El texto de arriba la menciona solo como factor de viabilidad. Confirmar.
2. v9 fija PostgreSQL sin versión. El sistema usa 17. La figura del C4 debe decir 17.
3. Las Tablas 14 y 16 (perfiles y claves) ya se alinearon con el sistema (módulo 9). La Tabla 16 pide `HistorialEtapa`, `codigo_cliente` y campos de aprobación: se implementan en las migraciones M3 a M7.
4. La unicidad condicionada de la orden (RB-05) se cumple con `cotizacion_id` único: una orden por cotización. Una reapertura usa una versión corregida de la cotización. Confirmar que cubre la intención de v9.
5. El C4 de v9 muestra React y NestJS. Rehacer la figura con los contenedores de la sección 2.
