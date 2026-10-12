# Copia externa cifrada de los respaldos

El servicio `respaldo` del compose deja un respaldo cada 23 horas en el volumen `sc-plataforma_sc_respaldos`. Ese volumen vive en el mismo equipo que la base. Esta guía agrega una copia cifrada en otro disco o equipo (hallazgo P2 de `docs/auditoria/3-devops.md`).

## Qué hace
- `scripts/respaldo/externo.mjs cifrar <destino>` toma el último respaldo del volumen, lo cifra con AES-256-GCM (clave derivada con scrypt) y lo guarda en `<destino>` con extensión `.dump.enc`.
- `scripts/respaldo/externo.mjs descifrar <archivo.dump.enc> <salida.dump>` lo devuelve a su forma original. Una clave incorrecta o un archivo alterado se rechazan.
- La frase de cifrado entra solo por la variable de entorno `SC_RESPALDO_CLAVE` (14 o más caracteres). El script no la imprime ni la guarda.

## Uso diario
```bash
# Windows con Git Bash. Elija una carpeta en OTRO disco o en un equipo de red.
export SC_RESPALDO_CLAVE="<su frase larga, guardada fuera del disco de copia>"
node scripts/respaldo/externo.mjs cifrar "E:/respaldos-sc" --retener 14
```
`--retener 14` conserva las 14 copias más recientes del destino y borra solo las `.dump.enc` más antiguas de esa carpeta. Sin la opción no se borra nada.

## Recuperar
```bash
export SC_RESPALDO_CLAVE="<la misma frase>"
node scripts/respaldo/externo.mjs descifrar "E:/respaldos-sc/<archivo>.dump.enc" "./restaurado.dump"
# luego restaure con scripts/restaurar.sh (verifica el respaldo y restaura en una sola transacción)
```

## Programarlo
Cree una tarea diaria del Programador de tareas de Windows que ejecute el comando de cifrado con la variable definida en la cuenta de usuario. Programe la tarea al menos una hora después del respaldo del servicio.

## Reglas
- Guarde la frase en un gestor de contraseñas, separada de la copia. Sin ella el respaldo no se recupera.
- Pruebe la recuperación completa una vez por trimestre: descifrar, `scripts/restaurar.sh` y `scripts/prueba-recuperacion.sh`.
- Verificado el 2026-10-12: cifrado y descifrado devuelven un archivo idéntico (misma suma SHA-256 que el original), una clave incorrecta se rechaza y `pg_restore --list` lee el resultado. Prueba unitaria: `tests/unit/respaldo-cifrado.test.ts`.
