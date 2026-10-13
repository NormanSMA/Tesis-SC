# Prueba de TLS (RNF-04)

Fecha de la corrida: 2026-10-13. Alcance: proxy Caddy local de TRACORE.

## Qué se prueba

- El proxy acepta TLS 1.2 y TLS 1.3 con certificado verificado.
- El proxy rechaza TLS 1.0 y TLS 1.1.
- La respuesta de `/login` incluye `Strict-Transport-Security`.
- El puerto http 8080 redirige con 308 al puerto https 8443.

## Cómo se ejecuta

```bash
docker compose --profile proxy up -d proxy
docker compose cp proxy:/data/caddy/pki/authorities/local/root.crt ./respaldos/caddy-raiz.crt
node scripts/verificar-tls.mjs
```

## Resultado

```text
OK     TLSv1 debe rechazarse: rechazada (ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION)
OK     TLSv1.1 debe rechazarse: rechazada (ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION)
OK     TLSv1.2 debe aceptarse: aceptada (certificado verificado)
OK     TLSv1.3 debe aceptarse: aceptada (certificado verificado)
OK     HSTS presente en /login: max-age=31536000
OK     http :8080 redirige 308 a https: 308 https://tracore.localhost:8443/
```

Veredicto: RNF-04 cumple en el entorno local.

## Límites

- El certificado es interno (`tls internal`). En producción se reemplaza por un certificado público.
- La prueba valida el proxy. La aplicación sigue escuchando en `127.0.0.1:3000` para E2E y CI.
- El cliente de prueba baja `SECLEVEL` solo para intentar TLS 1.0 y 1.1. Sin ese ajuste, OpenSSL 3 falla antes de llegar al servidor.
- Detalle del diseño: ADR-017 en `docs/decisiones.md` y `docs/despliegue-https.md`.
