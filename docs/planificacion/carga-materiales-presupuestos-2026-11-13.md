# INV-11 Carga normalizada de materiales de presupuestos

Fuente: insumos-cliente/PRESUPUESTOS VARIADOS.xlsx. SHA-256: 56e3f88201e01f650d22301467fb482a0d16a1b904de3a1154f086f9aa3509ed. La selección amarilla indica lo usado en un ejemplo; el catálogo se toma de todas las etiquetas de material y no solo del amarillo. Se excluyen renta, horas, impresión, cortes externos, viáticos, kilometraje, impuestos y comisiones.

Se prepararon 66 referencias: 63 altas nuevas y 3 coincidencias conservadas (Acrílico y PVC de 3 y 6 mm). Se unen variantes de escritura de los tubos cuadrados y tornillos. Se separa soldadura por libra y por caja comercial; su equivalencia en peso queda pendiente. En 47 altas se propone como tarifa de material el valor histórico más frecuente, tomando la primera aparición si hay empate. No son tarifas vigentes confirmadas. Otras 16 altas conservan tarifa pendiente por ambigüedad de presentación o unidad del costo.

Las existencias iniciales, los costos promedio y los mínimos se dejan en cero, sin entradas ni ajustes ficticios. El precio de cotización es independiente del costo promedio contable. Los datos anteriores y sus tarifas no se reemplazan. Los materiales se asocian a Taller, Acabado, Impresión Digital o Grabado y Corte Láser según su uso. Las referencias exactas a hoja, fila, valores históricos y advertencias permanecen en la descripción, el manifiesto local y la bitácora.

Los tubos se cuentan por tramo comercial como unidad; falta verificar sus longitudes. Las láminas sin dimensiones se cuentan como pliegos; no se inventa equivalencia a m². Los rollos sin longitud o base de precio conocida quedan pendientes de tarifar. Envases, cemento y otras presentaciones comerciales se cuentan por unidad cuando la fuente no precisa capacidad; verificarla antes de recibir existencias. Estas decisiones no afirman que los insumos físicos estén disponibles.

Carga transaccional e idempotente, atribuida al Administrador de pruebas como cuenta técnica y con origen Codex en el detalle. Se verificó en una copia: segunda ejecución con cero altas, 63 eventos, cero movimientos y comparación exacta de todas las filas anteriores. Los scripts y resultados locales están en validacion-local/historico/materiales-presupuestos-2026-11-13. No contienen claves; resuelven la conexión desde los archivos locales de entorno.

| Código o coincidencia | Material | Unidad de inventario | Tarifa de material |
|---|---|---|---|
| SC-PRE-001 | 3M reflectivo amarillo (30") | ROLLO | Pendiente |
| SC-PRE-002 | 3M reflectivo blanco/verde (36") | ROLLO | Pendiente |
| SC-PRE-003 | 3M reflectivo naranja (36") | ROLLO | Pendiente |
| SC-PRE-004 | 3M reflectivo rojo (36") | ROLLO | Pendiente |
| SC-PRE-005 | Broca para concreto de 3/8 | UNIDAD | C$150.0000 |
| SC-PRE-006 | Broca para metal de 1/4 | UNIDAD | C$80.0000 |
| SC-PRE-007 | Broca para metal de 3/8 | UNIDAD | C$130.0000 |
| SC-PRE-008 | Cemento | UNIDAD | C$500.0000 |
| SC-PRE-009 | Cinta LED | UNIDAD | Pendiente |
| SC-PRE-010 | Cener | UNIDAD | Pendiente |
| SC-PRE-011 | Disco de corte de 14" Metabo | UNIDAD | C$420.0000 |
| SC-PRE-012 | Disco de corte de 7" Metabo | UNIDAD | C$160.0000 |
| SC-PRE-013 | Disco de pulir | UNIDAD | C$85.0000 |
| SC-PRE-014 | Faritos | UNIDAD | C$2510.0000 |
| SC-PRE-015 | Tornillo goloso de 2" × 1/2" todo hilo | UNIDAD | C$8.0000 |
| SC-PRE-016 | Lona para marquesina | ROLLO | Pendiente |
| SC-PRE-017 | Láminas de melamina | PLIEGO | Pendiente |
| SC-PRE-018 | PVC sin espesor especificado | PLIEGO | Pendiente |
| SC-PRE-019 | PVC de 1/4" | PLIEGO | Pendiente |
| SC-PRE-020 | Cable multifilar #14 | METRO | C$19.0000 |
| SC-PRE-021 | Papel transfer de montaje de 24" | ROLLO | Pendiente |
| SC-PRE-022 | Perno de anclaje de 4" x 3/8 | UNIDAD | C$20.0000 |
| SC-PRE-023 | Perno metálico 2" x 1/2 | UNIDAD | C$40.0000 |
| SC-PRE-024 | Pernos galvanizados | UNIDAD | C$130.0000 |
| SC-PRE-025 | Platina de 30 x 30 | UNIDAD | C$350.0000 |
| SC-PRE-026 | Platinas | UNIDAD | C$400.0000 |
| SC-PRE-027 | Platinas 40 x 40 8 pernos | UNIDAD | C$600.0000 |
| SC-PRE-028 | Portalámpara | UNIDAD | C$19.0000 |
| SC-PRE-029 | Protoduro #2 × 14 | METRO | C$65.0000 |
| SC-PRE-030 | Remaches | UNIDAD | C$1.0000 |
| SC-PRE-031 | Removedor (tipo por confirmar) | UNIDAD | Pendiente |
| SC-PRE-032 | Silicón | UNIDAD | Pendiente |
| SC-PRE-033 | Soldadura delgada Lincoln 6013 · libra | LIBRA | C$170.0000 |
| SC-PRE-034 | Tapón de hule de 1" | UNIDAD | C$30.0000 |
| SC-PRE-035 | Tornillos | UNIDAD | C$0.5000 |
| SC-PRE-036 | Tubo redondo de 2" calibre 16 | UNIDAD | C$400.0000 |
| SC-PRE-037 | Tubo redondo de 3" × 1/8" | UNIDAD | C$2300.0000 |
| SC-PRE-038 | Tubo redondo de 4" × 1/8" | UNIDAD | C$4000.0000 |
| SC-PRE-039 | Tubo redondo de 6" × 1/8" | UNIDAD | C$9000.0000 |
| SC-PRE-040 | Tubo cuadrado 2x 2 | UNIDAD | C$780.0000 |
| SC-PRE-041 | Tubo cuadrado de 3/4" calibre 16 | UNIDAD | C$300.0000 |
| SC-PRE-042 | Vinil de corte negro de 48" | ROLLO | Pendiente |
| SC-PRE-043 | Varilla de anclaje de 1/2" | UNIDAD | C$150.0000 |
| SC-LEG-032 | Acrílico | Referencia existente | Se conserva |
| SC-PRE-045 | Angular aluminio | UNIDAD | C$160.0000 |
| SC-PRE-046 | Angular metálico para contorno | UNIDAD | C$160.0000 |
| SC-XLS-IMP-042 | PVC 3 mm · 1.22 × 2.44 m | Referencia existente | Se conserva |
| SC-XLS-IMP-045 | PVC 6 mm · 1.22 × 2.44 m | Referencia existente | Se conserva |
| SC-PRE-049 | Lámina galvanizada 1.55m | PLIEGO | Pendiente |
| SC-PRE-050 | Lámina galvanizada 1mm | PLIEGO | C$1430.0000 |
| SC-PRE-051 | Lámina lisa calibre 24 | PLIEGO | C$400.0000 |
| SC-PRE-052 | Lámina lisa calibre 26 | PLIEGO | C$290.0000 |
| SC-PRE-053 | Lámina lisa calibre 28 | PLIEGO | C$350.0000 |
| SC-PRE-054 | Lámpara LED | UNIDAD | C$730.0000 |
| SC-PRE-055 | Lata de arena | UNIDAD | C$30.0000 |
| SC-PRE-056 | Lata de piedrín | UNIDAD | C$30.0000 |
| SC-PRE-057 | Pega | UNIDAD | Pendiente |
| SC-PRE-058 | Pintura Fast Dry · galón | GALON | C$1600.0000 |
| SC-PRE-059 | Rodos para mueble | UNIDAD | C$70.0000 |
| SC-PRE-060 | Cinta aislante negra · rollo | ROLLO | C$85.0000 |
| SC-PRE-061 | Transformador | UNIDAD | C$600.0000 |
| SC-PRE-062 | Tubo cuadrado de 1" calibre 16 | UNIDAD | C$390.0000 |
| SC-PRE-063 | Tubo cuadrado galvanizado de 2 × 2" calibre 16 | UNIDAD | C$950.0000 |
| SC-PRE-064 | Tubo de 1 1/2" ch 16 | UNIDAD | C$390.0000 |
| SC-PRE-065 | Tubo de iluminación de 18 W | UNIDAD | C$180.0000 |
| SC-PRE-SOL-CAJA | Soldadura delgada Lincoln 6013 · caja | UNIDAD | C$1350.0000 |
