# Seguridad de autenticación y permisos

Cubre el criterio CF-07: cada usuario ve y hace lo que corresponde a su puesto.
Marcos: OWASP Top 10 2021 y NIST SP 800-63B (secciones 2.4.4 y 3.8 de la tesis).
La autorización se decide en el servidor. La interfaz solo oculta opciones.

## Piezas
- `src/core/permisos.ts`: catálogo, matriz por defecto y destino por perfil.
- `src/core/autorizacion.ts`: `can` y `exigir`. Son funciones puras.
- `src/lib/auth/`: contraseñas, tokens, cookies, sesión y guardia de páginas.
- `src/lib/http.ts`: `manejar`, `ok` y `leerJson` para los handlers de ruta.
- `src/modules/auth/`: servicio de login, logout y validación de sesión.
- `prisma/seed/referencia.ts`: siembra perfiles, permisos y matriz.

## Cómo funciona
1. El login recibe correo y contraseña. Normaliza el correo a minúsculas.
2. Verifica la contraseña con argon2id. Falla igual para usuario inexistente, inactivo o clave errónea.
3. Genera un token de 32 bytes aleatorios en base64url.
4. Guarda en la base solo el SHA-256 del token (`sesion.tokenHash`).
5. Envía el token en una cookie `httpOnly` con `SameSite=Lax`.
6. En cada petición busca la sesión por hash. Exige que no esté vencida ni revocada.
7. Exige que el usuario siga activo. Lee los permisos de `perfil_permiso`.
8. Un cambio en la matriz rige en la siguiente petición. El token no lleva permisos.

## Parámetros
| Parámetro | Valor | Origen |
|---|---|---|
| argon2id memoria | 19456 KiB | OWASP Password Storage |
| argon2id iteraciones | 2 | OWASP Password Storage |
| argon2id paralelismo | 1 | OWASP Password Storage |
| Token de sesión | 32 bytes aleatorios | OWASP Session Management |
| Duración de sesión | `SESSION_TTL_HOURS`, 12 por defecto | SD-21 |
| Intentos antes del bloqueo | 5 seguidos | SD-21 |
| Duración del bloqueo | 15 minutos | SD-21 |
| Nombre de la cookie | `SESSION_COOKIE_NAME`, `sc_sesion` por defecto | `.env.example` |
| Atributo Secure | `SESSION_COOKIE_SECURE=true` | ver abajo |

## Cookie Secure
La cookie lleva Secure por solicitud (`cookieSegura` en `src/lib/auth/cookies.ts`).
Lleva Secure si `SESSION_COOKIE_SECURE=true` o si la solicitud llega por el proxy con `X-Forwarded-Proto: https`.
En http local directo (127.0.0.1:3000) no lleva Secure. Es un riesgo aceptado solo en desarrollo.

## HTTPS y proxy (RNF-04)
Caddy termina TLS 1.2 y 1.3, rechaza TLS 1.0 y 1.1, envía HSTS y redirige http a https con 308.
Configuración: `infra/Caddyfile`. Guía: `docs/despliegue-https.md`. Evidencia: `docs/pruebas/tls.md`.
La aplicación acepta `X-Forwarded-For` solo si el proxy envía `X-Proxy-Clave` igual a `PROXY_CLAVE` (32 caracteres o más, comparación en tiempo constante).
Sin esa clave la IP del cliente se registra como `local`.

## Límite de tasa
`src/lib/limite-tasa.ts` usa `rate-limiter-flexible` en memoria (una sola instancia).
Por usuario: 6000 lecturas y 1200 escrituras por minuto. Por IP en rutas públicas: 120 por minuto. Fallos de login por IP: 30 en 15 minutos.
Al excederlo responde 429 `DEMASIADAS_SOLICITUDES` con `Retry-After`. Los topes se ajustan con las variables `LIMITE_*`.

## Registro y bitácora de accesos
`src/lib/registro.ts` usa pino con redacción de contraseñas, cookies, tokens y cabeceras de autorización.
La bitácora guarda inicio de sesión, fallo, bloqueo, cierre de sesión y cambio de clave con la IP truncada (IPv4 /24, IPv6 /48).
No guarda contraseñas ni tokens. Un correo desconocido no genera fila.
`src/env.ts` valida las variables de entorno al arrancar (`@t3-oss/env-nextjs`).

## Origin ausente
Los métodos POST, PUT, PATCH y DELETE comparan el encabezado Origin con el Host.
Si no coinciden, la respuesta es 403 `ORIGEN_NO_PERMITIDO`.
Si Origin falta, la petición se rechaza salvo que `NODE_ENV` sea `test`.
Un navegador siempre envía Origin en esos métodos. Su ausencia indica un cliente que no es navegador.
Las pruebas con Request no tienen Origin. Por eso `NODE_ENV=test` lo permite.
Un cliente de pruebas con navegador real debe enviar Origin en las llamadas directas a la API.
El proxy inverso debe conservar el encabezado Host original. El Caddyfile del repositorio lo hace.

## Mapa OWASP Top 10 2021
| Riesgo | Qué se implementó | Cómo se verifica |
|---|---|---|
| A01 Control de acceso roto | `manejar` exige sesión y permiso. `exigirPermisoPagina` protege cada página. La matriz vive en la base. | `tests/integration/auth-http.test.ts`, `tests/unit/permisos.test.ts` |
| A02 Fallos criptográficos | Contraseñas con argon2id. Token aleatorio y solo su SHA-256 en la base. | `auth-login.test.ts`: formato del hash y del tokenHash |
| A03 Inyección | Prisma parametriza las consultas. El UPDATE de intentos usa parámetros. Zod valida las entradas. | `auth-login.test.ts`: validación 422 |
| A04 Diseño inseguro | Bloqueo por cuenta, sesión con vencimiento y revocación, permisos en el servidor. | `auth-login.test.ts`, `auth-sesion.test.ts` |
| A05 Configuración incorrecta | Variables solo desde `process.env`. Sin secretos en el código. Cabeceras en `next.config.ts`. | Revisión de código y `.env.example` |
| A06 Componentes vulnerables | Dependencias fijadas en `pnpm-lock.yaml`. | Se revisa con `pnpm audit` |
| A07 Fallos de identificación y autenticación | Mensaje único contra enumeración. Verificación ficticia para igualar tiempos. Bloqueo tras 5 fallos. Logout revoca. | `auth-login.test.ts`, `auth-sesion.test.ts` |
| A08 Fallos de integridad | Sin deserialización insegura. El cuerpo se valida con zod antes de usarse. | `auth-http.test.ts` |
| A09 Fallos de registro | Los errores 500 se registran en el servidor. Los cambios de negocio van a bitácora. | Revisión de código |
| A10 SSRF | El módulo no hace peticiones salientes. | Revisión de código |

## Mapa NIST SP 800-63B
| Requisito | Estado | Verificación |
|---|---|---|
| Almacenar con hash resistente y sal única (5.1.1.2) | Cumple con argon2id. La sal es aleatoria por hash. | `auth-login.test.ts` |
| Limitar intentos fallidos (5.2.2) | Cumple. 5 intentos y bloqueo de 15 minutos. | `auth-login.test.ts` |
| Token de sesión con al menos 64 bits de entropía (7.1) | Cumple. 256 bits. | `tokens.ts` |
| Cookie protegida contra script y envío inseguro (7.1.1) | `httpOnly` y `SameSite=Lax`. Secure por variable en producción. | `auth-login.test.ts` |
| Vencimiento de sesión (7.2) | Cumple. Expira a las 12 horas por defecto. | `auth-sesion.test.ts` |
| Terminar la sesión al cerrar (7.1) | Cumple. Logout revoca en la base y borra la cookie. | `auth-sesion.test.ts` |
| Longitud mínima de contraseña de 8 caracteres (5.1.1.2) | Cumple. La contraseña exige 14 caracteres o más (`src/modules/auth/schema.ts`). | `auth-cambiar-clave.test.ts` |

## Riesgos residuales
- Un correo real bloqueado responde 423. Un correo inexistente responde 401. Eso revela la existencia de la cuenta bloqueada. SD-21 exige el mensaje de bloqueo. Se acepta en el piloto.
- No hay límite de intentos por dirección IP. El bloqueo es por cuenta.
- Un atacante puede bloquear una cuenta ajena con intentos fallidos. Es el costo del bloqueo temporal.
- No hay segundo factor de autenticación. Queda fuera del alcance del piloto.

## Pendientes para otros módulos
- El módulo de usuarios debe validar la política de contraseñas con `hashearContrasena`.
- Al desactivar un usuario, la sesión deja de valer en la siguiente petición. No hace falta revocarla.
- Al editar la matriz, el módulo de permisos debe escribir `OTORGAR_PERMISO` y `REVOCAR_PERMISO` en bitácora.

## Cómo reproducir la verificación
1. Levanta la base de pruebas: `docker compose --profile test up -d db_test`.
2. Ejecuta `pnpm test`. Corre las pruebas unitarias y las de integración.
3. Ejecuta `pnpm typecheck`, `pnpm lint` y `pnpm build`.
4. Para una prueba manual, arranca `pnpm dev` y llama a `POST /api/v1/auth/login` con un encabezado Origin igual al Host.
