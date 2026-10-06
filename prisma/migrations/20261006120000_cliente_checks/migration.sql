-- Endurece las restricciones de cliente: contacto no vacio y correo en minusculas.
ALTER TABLE cliente
  DROP CONSTRAINT IF EXISTS cliente_nombre_no_vacio,
  ADD CONSTRAINT cliente_nombre_no_vacio CHECK (length(btrim(nombre)) > 0),
  DROP CONSTRAINT IF EXISTS cliente_medio_contacto,
  ADD CONSTRAINT cliente_medio_contacto CHECK (telefono IS NOT NULL OR correo IS NOT NULL),
  DROP CONSTRAINT IF EXISTS cliente_contacto_no_vacio,
  ADD CONSTRAINT cliente_contacto_no_vacio CHECK (
    (telefono IS NULL OR length(btrim(telefono)) > 0) AND (correo IS NULL OR length(btrim(correo)) > 0)
  ),
  DROP CONSTRAINT IF EXISTS cliente_correo_valido,
  ADD CONSTRAINT cliente_correo_valido CHECK (
    correo IS NULL OR (correo = lower(btrim(correo)) AND position('@' IN correo) > 1)
  );
