# Texto propuesto para la sección 4.11 (evidencias de calidad)

Origen: auditoría técnica del 2026-10-11 y 2026-10-12. Detalle y trazabilidad en `docs/auditoria/` y `docs/auditoria/5-iso-25010.md`.

## Cómo usarlo en la tesis (v9)
- El apartado 4.11 actual termina con: "Este apartado define el plan de calidad y no presenta métricas de ejecución de una plataforma todavía no validada." Esa frase deja de ser cierta. Reemplácela por el párrafo "Evidencia técnica preliminar" de abajo.
- Agregue la Tabla 21A después de la Tabla 21 (misma estructura APA 7: número, título en cursiva, nota al pie con "Elaboración propia").
- El criterio de valoración por usuarios (mediana de cuatro, mínimo cuatro de cinco) sigue pendiente: las evidencias de abajo son técnicas y no sustituyen la validación con usuarios de la Fase 4.

## Párrafo de reemplazo
**Evidencia técnica preliminar.** Antes de la validación con usuarios se ejecutó una verificación técnica de la plataforma, organizada según las características del modelo de calidad ISO/IEC 25010:2023 (Tabla 21A). La suite automatizada comprende 2 580 pruebas unitarias y de integración, 829 pruebas de extremo a extremo en cuatro anchos de pantalla (768, 1024, 1366 y 1920 píxeles) y 10 comparaciones de regresión visual. Con 20 sesiones concurrentes durante 60 segundos, la plataforma procesó 13 643 operaciones con un percentil 95 de 118,65 ms y 100 % de operaciones en 2 s o menos, con el límite de tasa activo y sin respuestas 429, por lo que cumple RNF-01. La restauración de un respaldo tardó 3 s y no produjo diferencias de integridad en las 26 tablas comparadas (RNF-06 y RNF-07). Las 26 consultas de invariantes sobre los datos no detectaron corrupción. Estos resultados se obtuvieron en un entorno local con datos de siembra; no sustituyen la medición en el entorno de operación ni la validación con usuarios.

## Tabla 21A
*Tabla 21A*
*Evidencias técnicas por característica de calidad (ISO/IEC 25010:2023)*

| Característica | Evidencia | Resultado |
|---|---|---|
| Adecuación funcional | 26 requisitos cubiertos y 2 parciales (RNF-04, RNF-08); reglas RB-01 a RB-10 con prueba | Cumple |
| Eficiencia de desempeño | RNF-01: p95 de 118,65 ms con 20 sesiones (corrida del 2026-10-13, fuente en docs/pruebas/rendimiento-RNF-01.md); Lighthouse de 99 a 100 en rendimiento; con 40 000 cotizaciones el panel comercial pasó de 2 013 ms a 266 ms al desactivar la compilación JIT de PostgreSQL | Cumple |
| Usabilidad | axe (WCAG 2.x A y AA) sin impactos serios o críticos en todas las rutas por perfil; sin desborde horizontal en cuatro anchos | Cumple |
| Fiabilidad | Pruebas de concurrencia entre operaciones sin defectos; restauración en 3 s con integridad verificada | Cumple |
| Seguridad | Costos filtrados por permiso; cada ruta declara permiso (prueba estática); política de seguridad de contenido obligatoria; sin secretos en el historial ni en la imagen | Cumple |
| Mantenibilidad | 0 ciclos de importación y 0 violaciones de capas en 454 módulos | Cumple |
| Portabilidad | Arranque desde cero en 22 s con un solo comando; imágenes base fijadas por resumen criptográfico | Cumple |

*Nota.* Resultados del 12 de octubre de 2026 en entorno local con datos de siembra. Elaboración propia.

## Limitaciones que debe declarar
- Los 2 requisitos parciales (RNF-04 y RNF-08) dependen de HTTPS en el entorno de operación y de pruebas en dispositivos reales.
- Quedan riesgos aceptados y documentados (ADR-015): dependencias transitivas sin acceso desde la aplicación, un defecto sin corrección publicada en una librería de compresión del sistema base y la ausencia de límites de CPU y memoria en los contenedores.
- La copia externa cifrada de los respaldos existe como procedimiento (`docs/operacion/respaldo-externo.md`) y debe programarse en el entorno de operación.
