# Extracción de hechos: Capítulo I y II

> Revisión del orquestador (2026-10-05): Extracción de Haiku, revisada contra la fuente. Se corrigieron tres atribuciones de normas en la tabla 7. Las reglas RN-01 a RN-08 son síntesis, no citas literales. Consolidado en 00-consolidado.md.


Documento fuente: pce.md (líneas 129-463)  
Empresa: Soluciones Creativas  
Sector: Publicitario con producción física  
Fecha: Agosto 2026

---

## 1. Actores

| Nombre | Rol en el flujo | Qué necesita | Fuente |
|--------|-----------------|-------------|--------|
| Gerencia | Supervisa operación y toma decisiones | Información consolidada de clientes, cotizaciones, órdenes, materiales y producción | 1.1, 1.6 |
| Área de atención al cliente y ventas | Elabora cotizaciones, coordina trabajos | Continuidad entre la cotización aprobada y su ejecución | 1.1, 1.6 |
| Área de producción | Ejecuta órdenes, depende de materiales | Disponibilidad de materiales y especificaciones de trabajo con trazabilidad | 1.1, 1.6 |

---

## 2. Entidades y conceptos de negocio

| Nombre | Definición textual | Atributos | Fuente |
|--------|-------------------|-----------|--------|
| Cliente | Entidad solicitante de servicios, cuyo registro y relación con cotizaciones y trabajos son necesarios para mantener continuidad del flujo | Datos básicos, historial de cotizaciones, historial de trabajos | 2.6 |
| Cotización o proforma | Documento que expresa el precio propuesto para un trabajo solicitado | Puede ser de catálogo o personalizada con costos variables según medidas, materiales, cantidades, condiciones particulares | 2.6 |
| Orden de trabajo | Registro que autoriza la ejecución de un trabajo después de aprobada la cotización; registro central del seguimiento operativo | Relación con cotización de origen, estado, responsable, fechas, materiales consumidos, costos | 2.6, 1.1 |
| Inventario de materiales | Conjunto de existencias disponibles para la producción | Movimientos de entrada, salida, consumo; relación con orden de trabajo | 2.6 |
| Consumo de materiales | Cantidad de material utilizada en una orden específica | Cantidad, costo, orden asociada | 2.6 |
| Producción | Conjunto de etapas mediante las cuales se ejecuta una orden hasta su entrega | Etapas variables según tipo de servicio; cada etapa requiere responsable, fecha, estado | 2.6 |
| Trazabilidad | Capacidad de reconstruir el recorrido de un trabajo mediante registro de cambios | Estado, responsable, fecha, materiales, costos asociados | 2.6 |

---

## 3. Flujo de trabajo

| Paso | Descripción | Actor responsable | Fuente |
|-----|-------------|-------------------|--------|
| 1 | Solicitud de cliente por servicio o producto | Cliente | 2.3.1 |
| 2 | Registro del cliente o consulta de datos existentes | Área de atención y ventas | 2.6 |
| 3 | Elaboración de cotización (catálogo o personalizada) | Área de atención y ventas | 1.1, 2.6 |
| 4 | Presentación de cotización al cliente | Área de atención y ventas | 2.3.2 |
| 5 | Aprobación de cotización por cliente | Cliente | 2.3.2 |
| 6 | Conversión de cotización aprobada en orden de trabajo | Área de atención y ventas | 2.6 |
| 7 | Asignación de materiales a la orden | Área de producción / inventario | 1.1, 1.2 |
| 8 | Ejecución de producción por etapas | Área de producción | 2.6 |
| 9 | Registro de cada cambio de estado, responsable, fecha en la orden | Área de producción | 1.2, 2.3.3 |
| 10 | Entrega del trabajo | Área de producción | 2.3.1 |
| 11 | Cierre administrativo y consulta de trazabilidad completa | Gerencia / Área de atención | 1.7 |

---

## 4. Reglas de negocio explícitas

| ID | Enunciado | Fuente |
|----|-----------|--------|
| RN-01 | Una cotización puede ser de producto de catálogo o de trabajo personalizado con costos variables | 1.1, 2.6 |
| RN-02 | Una cotización aprobada debe conservar su relación con la orden de trabajo generada | 2.3.2, 2.6 |
| RN-03 | La orden de trabajo es el registro central que vincula cliente, cotización, materiales y producción | 2.6 |
| RN-04 | Cada cambio de estado en una orden debe registrar: estado, responsable, fecha | 1.2, 2.3.3 |
| RN-05 | Los materiales consumidos deben vincularse a la orden de trabajo específica y registrar cantidad y costo | 1.1, 1.2, 2.6 |
| RN-06 | La trazabilidad requiere registro completo de etapas, responsables, fechas, materiales y costos por trabajo | 1.2 |
| RN-07 | Las personas con rol de gerencia, atención al cliente y ventas, producción y administrador del sistema tienen acceso diferenciado a funciones y datos | 1.7 |
| RN-08 | La información de un trabajo no debe requerir reconstrucción desde múltiples fuentes separadas | 1.1, 1.2 |

---

## 5. Alcance incluido

| Módulo | Funciones | Fuente |
|--------|-----------|--------|
| Gestión de clientes | Registro, consulta, actualización de datos básicos; historial de cotizaciones y trabajos asociados | 1.7, 2.6 |
| Cotización | Elaboración de cotizaciones de catálogo y personalizadas con costos variables; conversión a orden de trabajo | 1.7, 2.6 |
| Orden de trabajo | Autorización, seguimiento por etapas, responsables, fechas; relación con cotización de origen | 1.7, 2.6 |
| Inventario de materiales | Control de existencias, movimientos de entrada, salida, consumo por orden | 1.7 |
| Producción | Seguimiento por etapas variables según tipo de servicio; registro de responsables, fechas, estados | 1.7 |
| Trazabilidad | Bitácora de cambios de estado, responsable, fecha, materiales consumidos y costos por trabajo | 1.7 |
| Paneles y reportes | Consulta y reportes de gestión para supervisar operación | 1.7 |
| Control de acceso | Perfiles de gerencia, atención al cliente y ventas, producción, administración del sistema | 1.7 |
| Interfaz | Adaptable a computadoras de escritorio, portátiles y tabletas | 1.7 |

---

## 6. Alcance excluido

| Item | Justificación | Fuente |
|------|--------------|--------|
| Contabilidad financiera completa | Se excluye; es posible ampliación futura | 1.7 |
| Nómina | Se excluye; es posible ampliación futura | 1.7 |
| Gestión de recursos humanos | Se excluye; es posible ampliación futura | 1.7 |
| Facturación electrónica gubernamental | Se excluye; es posible ampliación futura | 1.7 |
| Pagos en línea | Se excluye; es posible ampliación futura | 1.7 |
| Funciones avanzadas de CRM | Se excluye; es posible ampliación futura | 1.7 |
| Aplicaciones móviles nativas | Se excluye; es posible ampliación futura | 1.7 |
| Inteligencia artificial avanzada | Se excluye; es posible ampliación futura | 1.7 |
| Optimización industrial | Se excluye; es posible ampliación futura | 1.7 |

---

## 7. Requisitos no funcionales y de calidad

| Característica | Estándar | Detalle | Fuente |
|----------------|----------|--------|--------|
| Accesibilidad | WCAG 2.2 | Interfaces perceptibles, operables, comprensibles, robustas en diversos dispositivos | 2.4.1, 2.8 |
| Calidad de datos | ISO/IEC 25012 | Exactitud, completitud, consistencia, accesibilidad de datos estructurados | 2.4.3, 2.3.3 |
| Seguridad | OWASP Top 10 (2021) | Proteger confidencialidad, integridad, disponibilidad frente a accesos no autorizados | 2.4.4, 2.8 |
| Autenticación | NIST (Temoshok et al. 2025) | Requisitos de autenticación e identidad digital | 2.4.4, 2.8 |
| Control de acceso | OWASP (2021); Temoshok et al. (2025) | Autenticación, roles, permisos y validaciones en el servidor | 2.4.4 |
| Integridad referencial | Modelo relacional (PostgreSQL Global Development Group, 2026, como referencia documental; el SGBD se elige en el Cap. IV) | Restricciones, claves, transacciones para validez de datos y coherencia de operaciones múltiples | 2.4.3 |
| Disponibilidad | Aplicación empresarial | Acceso centralizado sin instalar programa independiente en cada estación | 2.4.1 |
| Modularidad | ISO/IEC/IEEE 42010 | Separación entre presentación, reglas de negocio y acceso a datos | 2.4.2 |
| API REST | Microsoft (2025) | Recursos de negocio expuestos por API; bajo acoplamiento entre cliente y servicios | 2.4.2, 2.5.3 |
| Rendimiento | No especificado en documento | Capacidad de manejo del volumen de datos esperado | 2.4.3 |
| Despliegue | No especificado en documento | Reproducibilidad del entorno, facilidad de respaldo, conexión segura | 2.7 |
| Registro de operaciones | OWASP (2021) | La plataforma debe contemplar registro de operaciones; trazabilidad por estados, responsables, tiempos y materiales | 2.4.4, 2.3.3 |

---

## 8. Supuestos y limitaciones

### Supuestos

| Condición | Depende de | Fuente |
|-----------|-----------|--------|
| OE1: La empresa brinda acceso a informantes y registros representativos | Disponibilidad de informantes y datos de cotizaciones, órdenes y consumo | 1.5 |
| OE1: Dispersión de información es la principal condición que dificulta seguimiento | Análisis correcto del problema raíz | 1.5 |
| OE2: Usuarios de gerencia, atención, ventas y producción disponibles para validar | Participación de usuarios en validación de requerimientos | 1.5 |
| OE2: Necesidades del informante clave representan funcionamiento real | Consistencia entre lo reportado y la operación real | 1.5 |
| OE3: Infraestructura tecnológica y datos de prueba disponibles | Recursos para construir y desplegar en entorno controlado | 1.5 |
| OE3: Una estructura de datos común permite mantener relaciones | Diseño de BD que vincule cliente, cotización, orden, materiales, producción | 1.5 |
| OE4: Gerente y cuatro usuarios participan en prueba y responden cuestionario | Participación de usuarios en período de validación | 1.5 |
| OE4: Cuestionario de validación mide adecuadamente requerimientos y usabilidad | Validez del instrumento tras revisión de expertos | 1.5 |

### Limitaciones

| Limitación | Implicación | Fuente |
|-----------|-----------|--------|
| Desarrollo en un único caso de estudio | Resultados vinculados a Soluciones Creativas; no generalizables a todas las empresas del sector publicitario | 1.7 |
| Identificación de necesidades con un informante clave | Diversidad limitada de perspectivas en fase de diagnóstico | 1.7 |
| Evaluación sin comparación antes/después | No permite atribuir mejoras cuantitativas de eficiencia | 1.7 |
| Dependencia de disponibilidad de informantes | Participación de usuarios limita la extensión de validación | 1.7 |
| Período de estudio: segundo semestre 2026 | Limitación temporal del diagnóstico y validación | 1.2 |
| Exclusión de funciones financieras avanzadas | Plataforma no cubre contabilidad, facturación electrónica, pagos en línea | 1.7 |

---

## 9. Servicios de la empresa

| Servicio | Descripción | Implicación en plataforma | Fuente |
|----------|------------|--------------------------|--------|
| Rotulación | Creación de rótulos y señalización | Requiere especificaciones de medidas, materiales, diseño | 1.1 |
| Gran formato | Impresión y producción en grandes dimensiones | Requiere especificaciones de medidas, materiales | 1.1 |
| Impresión | Servicios de impresión | Requiere especificaciones de cantidad, materiales | 1.1 |
| Artes gráficas | Diseño y producción gráfica | Requiere especificaciones de diseño, cantidad | 1.1 |
| Diseño y branding | Servicios de diseño visual y marca | Requiere iteraciones, aprobaciones, especificaciones | 1.1 |
| Publicidad digital y medios | Gestión de campañas publicitarias en línea | Requiere presupuesto, fechas de ejecución, métricas | 1.1 |
| Producción de artículos promocionales | Manufactura de items con marca del cliente | Requiere especificaciones personalizadas, cantidad, materiales | 1.1 |
| Letras corpóreas | Fabricación de letras tridimensionales | Requiere especificaciones de medidas, materiales, acabado | 1.1 |
| Rótulos luminosos | Elaboración de señalización con iluminación | Requiere especificaciones de tamaño, electricidad, acabado | 1.1 |
| Corte y grabado láser | Servicios de procesamiento con láser | Requiere especificaciones de material, medidas, diseño | 1.1 |
| Mobiliario | Fabricación de muebles personalizados | Requiere especificaciones de medidas, materiales, acabado | 1.1 |
| Otras soluciones de comunicación visual | Servicios adicionales no categorizados | Flexible según necesidad del cliente | 1.1 |

---

## 10. Vacíos: definiciones no explícitas en el documento

| Vacío | Por qué importa | Implicación |
|------|-----------------|------------|
| Estados exactos de una orden de trabajo (ej: cotizado, aprobado, en producción, completado, entregado) | Define transiciones válidas y controles de cambio de estado | Requerimientos de diseño de BD y lógica de negocio |
| Campos específicos del cliente (ej: nombre, teléfono, email, dirección, RUC/NIT, contacto) | Determina estructura de datos y validaciones | Requerimientos funcionales de gestión de clientes |
| Estructura de etapas de producción por tipo de servicio | Cada servicio puede tener etapas diferentes; necesario para seguimiento | Requerimientos de configuración de tipos de orden y estados |
| Moneda de operación (USD, NIO, otra) | Afecta cálculos de costo, reportes, datos de cotización | Requerimientos de implementación de costos |
| Unidades de medida (metros, unidades, horas, etc.) | Necesario para especificar materiales y servicios | Requerimientos de datos de materiales y cotización |
| Margen comercial o fórmula de costo de cotización | Cotización requiere lógica de cálculo de precio | Requerimientos de lógica de negocio de cotización |
| Política de impuestos (IVA u otros) | Cotizaciones pueden requerir desglose de impuestos | Requerimientos de cálculo en cotización |
| Niveles de permisos específicos por rol (ej: qué puede ver o editar cada rol) | Control de acceso debe ser granular | Requerimientos de seguridad y control de acceso |
| Duración típica de cada tipo de trabajo (tiempos estándar) | Afecta planificación y cumplimiento de fechas | Requerimientos de planificación de producción |
| Responsables de cada área y sus relaciones jerárquicas | Necesario para asignar responsables a tareas | Requerimientos de gestión de usuarios y roles |
| Criterios de aprobación de cotización | ¿Quién aprueba? ¿Bajo qué condiciones? | Requerimientos de flujo de aprobación |
| Historial de cambios de precio en materiales | Afecta costeo de órdenes pasadas | Requerimientos de versionado de catálogo de materiales |
| Códigos o referencias de materiales | Necesario para identificación única | Requerimientos de estructura de BD de inventario |
| Márgenes o tolerancias en existencias (stock mínimo, máximo) | Define cuándo reabastecer | Requerimientos de alertas de inventario |

---

## Notas de síntesis

**Actores (3):** gerencia, área de atención/ventas, área de producción.  
**Entidades (7):** cliente, cotización, orden de trabajo, inventario, consumo, producción, trazabilidad.  
**Flujo (11 pasos):** solicitud → registro cliente → cotización → aprobación → orden → asignación → producción → cierre.  
**Reglas de negocio (8):** RN-01 a RN-08.  
**Alcance incluido (9 módulos):** gestión de clientes, cotización, orden de trabajo, inventario, producción, trazabilidad, paneles, control de acceso, interfaz adaptable.  
**Alcance excluido (9 items):** contabilidad, nómina, RRHH, facturación electrónica, pagos en línea, CRM avanzado, apps móviles, IA, optimización.  
**Requisitos no funcionales (12 características):** WCAG 2.2, ISO/IEC 25012, OWASP, NIST, integridad referencial, modularidad, API REST, accesibilidad, registro.  
**Supuestos (8):** disponibilidad de informantes, participación de usuarios, infraestructura.  
**Limitaciones (6):** caso único, informante limitado, sin comparación antes/después, período acotado.  
**Servicios (12):** rotulación, gran formato, impresión, artes gráficas, diseño, publicidad digital, artículos promocionales, letras corpóreas, rótulos luminosos, corte láser, mobiliario, soluciones visuales.  
**Vacíos (14):** estados de orden, campos de cliente, etapas por tipo, moneda, unidades, fórmula de costo, impuestos, permisos por rol, tiempos estándar, responsables, criterios de aprobación, historial de precios, códigos de material, umbrales de inventario.
