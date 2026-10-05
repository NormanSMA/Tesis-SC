# Comparación de alternativas tecnológicas

Material para el Capítulo IV. Fecha: 2026-10-05.
Estado: propuesta del orquestador. Norman y Jorge validan las valoraciones.
Las valoraciones son juicio fundamentado, no medición. La columna de evidencia indica en qué se apoyan.

## 1. Criterios

Derivados de la Tabla 4 (sección 2.7), de ISO/IEC 25010 y de la viabilidad temporal (sección 1.6).

| ID | Criterio | Peso | Origen |
|---|---|---|---|
| C1 | Adaptabilidad a escritorio, portátil y tableta | 2 | Tabla 4, R-10, CF-08 |
| C2 | Accesibilidad WCAG 2.2 (soporte del ecosistema) | 3 | Tabla 4 |
| C3 | Modularidad y mantenibilidad | 3 | Tabla 4, R-12, ISO 25010 |
| C4 | Autenticación y control de acceso | 3 | Tabla 4, CF-07 |
| C5 | API REST y validación en el servidor | 3 | Tabla 4, 2.4.2 |
| C6 | Facilidad de pruebas | 3 | Tabla 4, 2.5.4 |
| C7 | Integridad referencial y transacciones | 3 | Tabla 4, 2.4.3 |
| C8 | Costo y licencia | 2 | Tabla 4, 1.6 |
| C9 | Reproducibilidad del despliegue | 3 | Tabla 4 |
| C10 | Curva de aprendizaje y experiencia del equipo | 3 | 1.6 (tecnologías conocidas por los autores) |
| C11 | Documentación y comunidad | 2 | 2.7 |
| C12 | Esfuerzo de desarrollo frente al plazo | 3 | 1.6 (viabilidad temporal) |

Escala: 1 (débil) a 5 (fuerte). Peso total: 33. Puntaje máximo: 165.

## 2. Alternativas de plataforma completa

Versiones verificadas el 2026-10-05 con `pnpm view`, PyPI y GitHub.

| Opción | Composición | Versiones |
|---|---|---|
| A | Next.js (App Router, rutas REST) + Prisma + PostgreSQL | Next.js 16.3.8, React 19.3.0, Prisma 7.10.0 |
| B | NestJS (API) + React con Vite (cliente) + Prisma + PostgreSQL | NestJS 12.1.2, Vite 8.3.2 |
| C | Django con plantillas y HTMX + PostgreSQL | Django 6.1.1 |
| D | Laravel con panel Filament + PostgreSQL | Laravel 13.34.0, Filament 5.9.0 |

## 3. Valoración

| Criterio | Peso | A | B | C | D |
|---|---|---|---|---|---|
| C1 Adaptabilidad | 2 | 5 | 5 | 3 | 4 |
| C2 WCAG 2.2 | 3 | 4 | 4 | 3 | 3 |
| C3 Modularidad | 3 | 3 | 5 | 4 | 3 |
| C4 Autenticación y acceso | 3 | 3 | 4 | 5 | 5 |
| C5 API y validación | 3 | 4 | 5 | 4 | 3 |
| C6 Pruebas | 3 | 4 | 5 | 5 | 4 |
| C7 Integridad de datos | 3 | 4 | 4 | 5 | 4 |
| C8 Costo y licencia | 2 | 5 | 5 | 5 | 5 |
| C9 Despliegue reproducible | 3 | 5 | 4 | 4 | 4 |
| C10 Curva y experiencia | 3 | 5 | 3 | 2 | 4 |
| C11 Documentación | 2 | 5 | 4 | 5 | 5 |
| C12 Esfuerzo y plazo | 3 | 4 | 2 | 4 | 5 |
| **Total ponderado (de 165)** | | **138** | **136** | **134** | **133** |
| Porcentaje | | 83.6 % | 82.4 % | 81.2 % | 80.6 % |
| Total sin C10 y C12 (de 135) | | 111 | 121 | 116 | 106 |
| Porcentaje sin C10 y C12 | | 82.2 % | 89.6 % | 85.9 % | 78.5 % |

Lectura:
- Las cuatro opciones quedan a menos de 5 puntos con el conjunto completo de criterios.
- Con criterios solo técnicos, la opción B puntúa más alto. Su costo es mantener dos aplicaciones.
- La experiencia del equipo y el plazo inclinan la decisión hacia A. Es una decisión de viabilidad, no de calidad técnica.

## 4. Evidencia y límites por opción

**A. Next.js + Prisma.**
- Una sola base de código y un solo contenedor. Tipos compartidos entre API e interfaz.
- Experiencia previa de Norman: proyecto TURNO (Next.js 16, Prisma 7, PostgreSQL 17, 669 pruebas). La experiencia de Jorge no consta en la documentación.
- Límite: no impone estructura. La modularidad depende de una convención del repositorio.
- Límite: no trae autenticación ni permisos. Se implementan y se prueban.
- Límite: Prisma no expresa restricciones CHECK ni triggers. Se agregan con SQL.

**B. NestJS + React (Vite).**
- Estructura modular y OpenAPI nativos. Mejor puntaje técnico.
- Límite: dos aplicaciones, dos contratos y más archivos. Más coordinación entre agentes y autores.
- Límite: sin experiencia documentada con NestJS en el entorno del autor.

**C. Django + HTMX.**
- Autenticación, permisos y restricciones CHECK integrados. Excelente integridad de datos.
- Límite: interfaz de componentes accesibles hecha a mano. API REST requiere Django REST Framework.
- Límite: sin experiencia documentada.

**D. Laravel + Filament.**
- Mayor velocidad para pantallas de administración. Experiencia previa de Norman en Taste Tracker (Laravel 12, Filament 5).
- Límite: el panel no es API-first. La exigencia de backend con API (sección 2.7) requiere rutas adicionales.
- Límite: menos control sobre la accesibilidad de componentes del panel.

## 5. Decisión propuesta

Opción A. Razones:
1. Un solo repositorio y un solo contenedor simplifican el criterio de despliegue reproducible.
2. Los tipos compartidos reducen errores entre módulos. Ayuda a CF-09.
3. La experiencia previa y el plazo de diciembre 2026 favorecen la entrega.
4. Se compensan sus límites: estructura por módulos en `src/modules`, reglas puras en `src/core`, SQL de restricciones versionado, autenticación propia con pruebas.

Riesgo aceptado: el puntaje técnico de B es mayor. Se documenta como alternativa para una ampliación futura con equipos separados.

## 6. Comparaciones por componente

### Base de datos

| Criterio | PostgreSQL 17 | MySQL (familia 8) | SQLite |
|---|---|---|---|
| Integridad referencial y CHECK | Completa | Completa desde 8.0.16 | Completa con pragma |
| Transacciones y bloqueo de filas (`FOR UPDATE`) | Sí | Sí | No (bloqueo de base) |
| Concurrencia de escrituras | Alta | Alta | Limitada |
| Tipos (timestamptz, numeric, jsonb) | Completos | Parciales | Débiles |
| Licencia | Código abierto permisivo | GPL con edición comercial | Dominio público |
| Referencia en la tesis | Citada en 2.4.3 | No citada | No citada |

Decisión: PostgreSQL 17. El consumo concurrente de inventario exige bloqueo de filas.
La imagen `postgres:17-alpine` está disponible y probada en proyectos previos del autor.

### Acceso a datos (ORM)

| Criterio | Prisma 7.10.0 | Drizzle 0.45.3 | TypeORM 1.1.1 |
|---|---|---|---|
| Tipado de consultas | Generado desde el esquema | Inferido desde el código | Decoradores |
| Migraciones | Integradas | Integradas | Integradas |
| Restricciones CHECK y triggers | SQL manual en la migración | SQL manual | SQL manual |
| Transacciones interactivas | Sí | Sí | Sí |
| Experiencia previa | TURNO | No consta | No consta |

Decisión: Prisma 7.10.0. La etiqueta `latest` de npm apunta a la versión 8.0.0-rc.20, que es candidata y no estable.
No se usa. Se fija 7.10.0.

### Interfaz

| Criterio | shadcn/ui + Tailwind 4 | Componentes propios | Biblioteca cerrada |
|---|---|---|---|
| Accesibilidad de base | Primitivas con soporte de teclado y ARIA | Depende del equipo | Variable |
| Un solo sistema de componentes | Sí, el código vive en el repositorio | Sí | Sí |
| Control visual | Total | Total | Limitado |
| Esfuerzo | Bajo | Alto | Bajo |

Decisión: shadcn/ui sobre Tailwind 4. Se audita con axe y revisión manual de WCAG 2.2.

### Despliegue

| Criterio | Docker Compose | PaaS gestionado | Máquina virtual con servicios del sistema |
|---|---|---|---|
| Reproducibilidad | Alta | Media | Baja |
| Costo | Bajo | Variable | Bajo |
| Control de respaldo | Alto | Depende del proveedor | Alto |
| Funciona sin internet | Sí | No | Sí |
| Exigencia del proyecto | Sí | No | No |

Decisión: Docker Compose con puertos solo en 127.0.0.1.
Versiones fijas de Node 24 y PostgreSQL 17 en las imágenes.

## 7. Versiones que se fijan

| Paquete | Versión | Motivo |
|---|---|---|
| next | 16.3.x | Estable. Probada en TURNO |
| react y react-dom | 19.2 o 19.3 | Compatible con Next 16 |
| prisma y @prisma/client | 7.10.0 | Última estable. `latest` es 8.0.0-rc |
| @prisma/adapter-pg | 7.10.0 | Obligatorio en Prisma 7 |
| typescript | 5.x | La versión 7.0.2 es reciente. Se evita el riesgo con Next y ESLint |
| eslint | 9.x | Compatibilidad con la configuración de Next |
| zod | 4.x | Validación en servidor y cliente |
| tailwindcss | 4.x | Sistema de diseño |
| vitest | 4.1.x | Probada en TURNO. La 5.0.3 es reciente |
| @playwright/test | 1.63.x | Pruebas E2E |
| @axe-core/playwright | 4.13.x | Accesibilidad |
| @node-rs/argon2 | 2.x | Hash de contraseñas |

La fijación final se confirma al crear el proyecto en la Fase 2.
