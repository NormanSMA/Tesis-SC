# Pruebas E2E pendientes del módulo 2

Estado: pendiente. Fecha: 2026-10-06.
Instrucciones para quien escriba e2e/catalogo.spec.ts y e2e/cotizaciones.spec.ts.
Patrón de referencia: e2e/clientes.spec.ts y e2e/ayudas.ts.

---

Eres un ingeniero de pruebas. Escribe DOS archivos de pruebas E2E con Playwright para el proyecto C:\Proyectos\sc-plataforma. NO ejecutes ningun comando y NO edites ningun otro archivo. Solo crea:
  1) e2e/catalogo.spec.ts
  2) e2e/cotizaciones.spec.ts

LEE PRIMERO como patron exacto de estilo, helpers y convenciones:
- e2e/ayudas.ts (iniciarSesion, PERFILES, VIEWPORTS, violacionesGraves con axe, sinDesbordeHorizontal)
- e2e/clientes.spec.ts (como se crean datos con prefijo E2E-, se archivan al final, se capturan pantallas, se usa Origin en llamadas directas a la API, y como se limitan pruebas con efectos al proyecto portatil con test.skip en los otros)
- playwright.config.ts (4 proyectos: escritorio, portatil, tableta-horizontal, tableta)
- docs/modulos/03-catalogo-cotizaciones.md (especificacion; seccion Pruebas) y los codigos de las pantallas: src/app/(app)/catalogo/**, src/modules/catalogo/componentes/**, src/app/(app)/cotizaciones/**, src/modules/cotizaciones/componentes/** (para usar los textos, etiquetas y roles reales: no inventes selectores; usa getByRole y getByLabel con los textos que aparecen en los componentes).
- src/core/permisos.ts (que ve cada perfil) y prisma/seed/datos/usuarios.json (correos de los usuarios de prueba, ya reflejados en e2e/ayudas.ts).

REGLAS: sin emojis; comentarios solo con el porque; funciones menores a 50 lineas; archivos menores a 500 lineas; espanol en los nombres de pruebas. Las claves se obtienen como en clientes.spec.ts (variables de entorno SEED_PASSWORD_*), nunca escritas en el archivo. Todo dato que creen las pruebas lleva el prefijo "E2E-" mas una marca de tiempo y se archiva al final en un afterAll aunque falle una prueba. NUNCA modifiques ni archives datos sembrados. Las pruebas con efectos corren solo en el proyecto portatil (como en clientes.spec.ts). Las llamadas directas a la API que modifican llevan el encabezado Origin igual al host.

e2e/catalogo.spec.ts debe cubrir:
- Gerencia crea un producto con categoria existente, unidad de cobro, precio base; edita nombre y precio; le agrega una receta con un material; lo archiva. Se verifica cada paso en pantalla.
- Ventas ve el catalogo (tarjetas con imagen) y la ficha SIN botones de gestion (Nuevo producto, Editar, Archivar).
- Produccion ve el catalogo y no ve botones de gestion.
- Administracion termina en /sin-acceso al abrir /catalogo.
- axe en lista y formulario de nuevo producto en 1366x768 y 820x1180 (cero violaciones criticas o serias).
- Sin desborde horizontal en la lista en los 4 viewports.
- Capturas de la lista y de una ficha con receta con Gerencia en 1920x1080, 1366x768, 1024x768 y 820x1180 en docs/capturas/catalogo/catalogo-<lista|ficha>-<tamano>.png (usa un producto sembrado con receta para la ficha, solo lectura).

e2e/cotizaciones.spec.ts debe cubrir:
- Ventas crea una cotizacion nueva para un cliente activo sembrado (solo lectura del cliente), con asunto E2E-<marca>; en el editor agrega: un item de catalogo cobrado por M2 con ancho y alto, un item de catalogo por unidad y un item personalizado con las tres clases de linea de costo (material, mano de obra, tercero); guarda; comprueba en pantalla que los totales (subtotal, IVA 15 %, total) coinciden con los que muestra el detalle; la envia.
- Gerencia abre esa cotizacion enviada y la aprueba (campo version incluido por la interfaz). Se verifica el estado Aprobada.
- La vista /cotizaciones/<id>/imprimir carga y muestra el numero y el total.
- Gerencia NO ve los botones Nueva cotizacion ni Editar. Produccion y Administracion terminan en /sin-acceso.
- Una cotizacion en BORRADOR se puede duplicar (Ventas) y la copia es otro BORRADOR.
- axe en lista, editor y detalle en 1366x768 y 820x1180.
- Capturas CF-10 del detalle de la cotizacion mixta aprobada con Ventas y con Gerencia en los 4 tamanos como docs/capturas/cotizaciones/CF-10-<perfil>-<tamano>.png y una del editor.
- Limpieza: archiva con la API (POST /api/v1/cotizaciones/<id>/archivar con la version) las cotizaciones E2E- creadas.

Al terminar responde en maximo 10 lineas: que archivos creaste, cuantas pruebas hay en cada uno y que selectores o textos no pudiste confirmar leyendo los componentes.
