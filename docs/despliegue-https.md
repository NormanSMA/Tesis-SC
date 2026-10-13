# Acceso por HTTPS (proxy Caddy)

TRACORE sirve HTTP solo en `127.0.0.1:3000` para desarrollo, pruebas y CI. Para usar la plataforma con TLS 1.2 o superior (RNF-04), active el proxy opcional. Diseño y razones: ADR-017 en `docs/decisiones.md`.

## Activar
1. Genere la clave del proxy una sola vez: `node scripts/generar-proxy-clave.mjs`. Se guarda en `.env` y no se imprime.
2. Levante app y proxy: `docker compose --profile proxy up -d app proxy`.
3. Confíe en la CA local de Caddy (almacén del usuario, sin permisos de administrador):
   ```bash
   docker compose cp proxy:/data/caddy/pki/authorities/local/root.crt ./respaldos/caddy-raiz.crt
   certutil -user -addstore Root .\respaldos\caddy-raiz.crt
   ```
   Firefox usa las raíces de Windows (`security.enterprise_roots.enabled`). Reinicie el navegador.
4. Abra `https://tracore.localhost:8443`. El nombre `*.localhost` resuelve a 127.0.0.1 sin editar `hosts`. `http://tracore.localhost:8080` redirige a HTTPS.

## Qué cambia con el proxy
- La app solo confía en `X-Forwarded-For` cuando llega `X-Proxy-Clave` igual a `PROXY_CLAVE`. Con la clave vacía nunca confía.
- La cookie de sesión lleva `Secure` cuando la petición llega por el proxy con `x-forwarded-proto: https`.
- El proxy emite HSTS. El acceso por `http://127.0.0.1:3000` sigue sin HSTS ni `Secure`.
- Docker Desktop no conserva la IP de origen: el límite de tasa por IP actúa como límite por equipo.

## Comprobar RNF-04
`node scripts/verificar-tls.mjs` comprueba TLS 1.2 y 1.3 aceptados con certificado verificado, TLS 1.0 y 1.1 rechazados por alerta del servidor, HSTS y la redirección 308. Resultados en `docs/pruebas/tls.md`.

## Desactivar
`docker compose --profile proxy stop proxy`. Los datos del certificado quedan en el volumen `sc_caddy_data`.

## Producción
Sustituya `tls internal` en `infra/Caddyfile` por un dominio real con certificado público (Caddy lo obtiene solo) y use un dominio propio en lugar de `tracore.localhost`.
