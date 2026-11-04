# Usuarios para la validación inicial

Después de actualizar el repositorio, con Docker Desktop, Node y pnpm disponibles:

```sh
git pull --ff-only
docker compose up -d --build
pnpm usuarios:reales
```

`up --build` actualiza las imágenes de la plataforma antes de arrancar.
El comando de usuarios construye la imagen de herramientas con el código actualizado. No reinicia ni borra la base.
Es una operación explícita: el arranque normal y la siembra de pruebas conservan su comportamiento.
No requiere instalar las dependencias de Node en el equipo anfitrión.

## Cuentas y perfiles

| Persona | Perfil | Correo de acceso |
|---|---|---|
| Jorge Isaac Rodríguez | Gerencia | jorge.rodriguez@solucionescreativas.test |
| Arely Rodríguez | Administración | arely.rodriguez@solucionescreativas.test |
| Dalila Ruiz | Administración | dalila.ruiz@solucionescreativas.test |
| Dariela Centeno | Operaciones | dariela.centeno@solucionescreativas.test |
| María Fernanda Padilla | Atención al cliente | maria.padilla@solucionescreativas.test |
| Danny Gahona | Producción | danny.gahona@solucionescreativas.test |
| Gabriel Morales | Producción | gabriel.morales@solucionescreativas.test |
| Nathaly Chavarría | Producción | nathaly.chavarria@solucionescreativas.test |
| Mariam García | Producción | mariam.garcia@solucionescreativas.test |
| Eykelt Tórrez | Producción | eykelt.torrez@solucionescreativas.test |
| Norman Solís | Producción | norman.solis@solucionescreativas.test |
| José Osegueda | Producción | jose.osegueda@solucionescreativas.test |
| Félix Osegueda | Producción | felix.osegueda@solucionescreativas.test |
| Mario Pineda | Producción | mario.pineda@solucionescreativas.test |
| Luis Zeledón | Producción | luis.zeledon@solucionescreativas.test |

La cuenta técnica `pruebas.admin@solucionescreativas.test` tiene los seis perfiles y su unión de permisos.
Jorge conserva únicamente Gerencia. Las direcciones `.test` son identificadores de acceso, no buzones reales.

Cada cuenta nueva recibe una contraseña aleatoria, temporal por 48 horas, con cambio obligatorio al entrar.
Se guarda en `output/usuarios-reales/credenciales.local.md`, excluido de Git y de las imágenes Docker.
Cada equipo genera sus propias contraseñas. No publiques ni adjuntes ese archivo.
Las cuentas existentes conservan sus claves, incluso si su contraseña temporal ya venció;
en ese caso, usa el restablecimiento de contraseña de Administración.
Si no hubo altas, el archivo no contiene contraseñas nuevas.

## Conservación de datos

El script utiliza los servicios de la aplicación y registra los cambios en bitácora.
Necesita una base migrada y sembrada, con al menos un ADMIN activo con permiso de gestión de usuarios.
Primero crea o conserva la cuenta técnica; después crea las personas que falten.
Si una cuenta conocida tiene otro nombre, perfiles o está inactiva, se detiene antes de modificar datos,
para que el administrador revise esa diferencia. Las cuentas adicionales ajenas a esta lista se conservan.

Reasigna órdenes abiertas y etapas pendientes o en curso de los usuarios ficticios a operarios reales,
según el área de la etapa. Las especialidades orientan esta asignación; el modelo no restringe cada
usuario a un área. Luego desactiva las diez cuentas ficticias de la siembra y revoca sus sesiones.
Conserva sus referencias históricas, documentos, existencias y movimientos de inventario.
No reescribe trabajos terminados.

Se puede volver a ejecutar: no duplica cuentas ni restablece claves.
Si una ejecución se interrumpe, conserva el archivo de accesos y vuelve a ejecutar el comando.
No ejecutes dos instancias a la vez ni durante cambios de responsables desde la interfaz.
Un reinicio destructivo de la demostración restaura los usuarios ficticios; después debes ejecutar
otra vez `pnpm usuarios:reales`. Un arranque normal conserva los usuarios reales.
