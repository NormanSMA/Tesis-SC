-- Centro de notificaciones: cada usuario marca hasta qué instante leyó sus avisos.
-- Tabla aparte de usuario para no alterar la versión que usa la edición concurrente de usuarios.
CREATE TABLE notificacion_lectura (
  usuario_id uuid PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
  leidas_hasta timestamptz NOT NULL
);
