# Coordinación entre agentes (Claude Code y Codex)

Reglas comunes: `AGENTS.md`. Este archivo solo define cómo se turnan los agentes.
Registro vivo: `docs/coordinacion/estado.md` (local, fuera de git). Un solo registro para todos.
Desde un worktree (`..\Tesis-SC-<agente>`) el registro está en `..\Tesis-SC\docs\coordinacion\estado.md`. Las rutas son relativas para que sigan valiendo si se renombra la carpeta superior.

## Al empezar (los dos agentes)
1. Lee `AGENTS.md` y `estado.md` completos.
2. Revisa "Tarea activa". Si otro agente tiene una reserva vigente sobre los archivos o recursos que necesitas, no los toques: trabaja en otra cosa o pregunta al usuario.
3. Comprueba el estado real antes de creer el registro: `git status --short` y `git log -1` (git de lectura, permitido), `docker ps -a`. Si no coincide, anótalo en "Estado verificado".
4. Escribe tu reserva en "Tarea activa": agente, fecha y hora, tarea, archivos o carpetas, recursos exclusivos.

## Al terminar o interrumpir
1. Documenta el cambio según la tabla "Documentación de cada cambio" de `AGENTS.md`. Sin eso el cambio sigue "en curso".
2. Actualiza en `estado.md`: "Estado verificado" (solo lo comprobado), "Terminado" (con el código y dónde quedó documentado), "Pendiente".
3. Libera la reserva (deja "Tarea activa" en `ninguna`) o déjala marcada como `en pausa` con el motivo.
4. Escribe "Último traspaso" con la plantilla de abajo. Sustituye el anterior; no acumules historial aquí.

## Reservas
- Un solo agente edita un conjunto de archivos a la vez. El otro lee el registro antes de intervenir.
- La reserva es un acuerdo escrito, no un bloqueo. Nada impide la edición: hay que respetarla.
- Reserva abandonada: más de 12 horas sin actualizar, o bien los archivos reservados no cambian (`git status`, fecha de modificación) y no hay procesos del otro agente trabajando (`docker ps`, pruebas en curso). Aun así, no la retires por tu cuenta: avisa al usuario y espera su confirmación. Anota en el registro quién la liberó.

## Recursos exclusivos
Solo un agente a la vez, anotado en la reserva:
- **Base real** (`db`, puerto 5442, base `sc_plataforma`): migraciones, `db:seed`, `usuarios:reales`, restauraciones, `demo:reiniciar` y escrituras directas. Antes de cualquier cambio de esquema o datos: `pg_dump` a `..\respaldos-locales\bd\tracore-antes-<tema>-<AAAAMMDD-HHMMSS>.dump`.
- **App en 3000**: reconstruir, reiniciar o detener `app` y `migrate`. Las E2E apuntan aquí por defecto (`E2E_BASE_URL`) y escriben en la base real.
- **Base de pruebas** (`db_test`, puerto 5443): `test:seccion`, `test:secciones`, `test:cambios`, `ci:local`. Recrean `sc_test_template` con `DROP ... WITH (FORCE)` y cortan las corridas del otro agente.
- **Contenedores temporales** (copias de QA, navegadores de depuración): quien los crea los anota y los retira.
Nunca `docker compose down -v`, borrar volúmenes, borrar respaldos ni tocar contenedores ajenos (`ruta-local-*`, `omniroute`).

## Trabajo simultáneo (worktrees)
- Git de escritura (worktrees, ramas, commits, merges, push) solo cuando el usuario lo pide en el chat, como indica `AGENTS.md`.
- Un worktree sale de un commit. Los cambios sin commit de la carpeta principal no viajan. Antes de crear uno, el usuario debe hacer commit de lo pendiente.
- Patrón: `git worktree add ..\Tesis-SC-<agente> -b <agente>/<tema>`. Cada agente trabaja en su carpeta y anota la ruta en su reserva.
- Los recursos exclusivos siguen siendo compartidos: un worktree no aísla Docker, la base ni los puertos.
- La integración es explícita: el usuario revisa el diff, fusiona una rama a la vez y corre las secciones afectadas después de cada merge.

## Credenciales
Nunca copies claves, tokens ni cadenas de conexión con contraseña en el registro, en las instrucciones ni en ejemplos. Referencia el archivo que las contiene (`validacion-local\*.local.md`, `.env`), no su contenido.

## Registro Word y tesis
Cada cambio funcional se anota en `..\Registro de cambios por módulo.docx` con el formato existente: `CÓDIGO  Título  |  Estado`, descripción y una línea "Ajuste pendiente en la tesis.".
- `Completado` solo después de verificar la implementación (pruebas de la sección y comprobación en la instancia real). Antes de eso: `En curso`.
- "Ajuste pendiente en la tesis" es independiente: un cambio puede estar Completado en el sistema y seguir pendiente en la tesis.
- Antes de editar el Word, copia el original a `..\respaldos-locales\word\`. Solo un agente lo edita a la vez (es un archivo reservable).

## Plantilla de traspaso
```
### Traspaso <AAAA-MM-DD HH:MM> · <agente A> → <agente B o siguiente>
Tarea: <una línea>
Hecho y verificado: <qué y cómo se comprobó>
Hecho sin verificar: <qué falta comprobar>
Archivos tocados: <rutas o carpetas>
Base y servicios: <migraciones, reinicios, respaldo previo, contenedores temporales vivos>
Documentado en: <archivos de docs/ actualizados> · Word: <códigos y estado> · Tesis: <ajustes pendientes>
Siguiente paso: <la primera acción concreta>
Reserva: liberada | en pausa (<motivo>)
```
