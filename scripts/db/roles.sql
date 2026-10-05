-- Rol de la aplicacion (ADR-009). Idempotente.
-- Lo ejecuta roles.sh (psql) y tests/helpers/global-setup.ts (pg).
-- Antes de ejecutarlo, la sesion define sc.rol y sc.clave con set_config.
-- Debe correr como el dueno de las tablas, despues de migrar.

DO $roles$
DECLARE
  v_rol   text := current_setting('sc.rol');
  v_clave text := current_setting('sc.clave');
  v_dueno text := current_user;
BEGIN
  IF v_rol = '' OR v_clave = '' THEN
    RAISE EXCEPTION 'sc.rol y sc.clave son obligatorios';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_rol) THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', v_rol, v_clave);
  END IF;
  -- ALTER en cada corrida: aplica cambios de clave y corrige atributos alterados a mano.
  EXECUTE format(
    'ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
    v_rol, v_clave
  );

  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), v_rol);
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', v_rol);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', v_rol);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', v_rol);
  EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO %I', v_rol);

  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
    v_dueno, v_rol
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %I',
    v_dueno, v_rol
  );
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO %I',
    v_dueno, v_rol
  );

  -- Defensa en profundidad: ademas de los triggers SC001, el rol no puede modificar el libro ni la bitacora.
  EXECUTE format(
    'REVOKE UPDATE, DELETE, TRUNCATE ON bitacora, movimiento_inventario, consumo_orden FROM %I',
    v_rol
  );
  -- La tabla de migraciones es del dueno. La aplicacion no la toca.
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON _prisma_migrations FROM %I', v_rol);
  END IF;
END
$roles$;
