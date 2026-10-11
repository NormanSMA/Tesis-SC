export type PerfilCodigo =
  | "GERENCIA"
  | "ADMINISTRACION"
  | "OPERACIONES"
  | "ATENCION_CLIENTE"
  | "PRODUCCION"
  | "ADMIN";

// El orden define el perfil principal de un usuario con varios perfiles.
export const PERFILES: readonly { codigo: PerfilCodigo; nombre: string; descripcion: string }[] = [
  { codigo: "GERENCIA", nombre: "Gerencia", descripcion: "Consulta la operación, los paneles y los reportes." },
  {
    codigo: "ADMINISTRACION",
    nombre: "Administración",
    descripcion: "Registra consumos y ajustes de inventario, asigna responsables y actualiza etapas.",
  },
  {
    codigo: "OPERACIONES",
    nombre: "Operaciones",
    descripcion: "Genera, asigna, inicia, cierra y cancela órdenes. Registra la aprobación comercial.",
  },
  {
    codigo: "ATENCION_CLIENTE",
    nombre: "Atención al cliente",
    descripcion: "Atiende clientes, cotiza, registra la aprobación, entrega y cierra órdenes.",
  },
  { codigo: "PRODUCCION", nombre: "Producción", descripcion: "Actualiza las etapas de producción." },
  {
    codigo: "ADMIN",
    nombre: "Administración técnica",
    descripcion: "Gestiona usuarios, permisos y configuración. No hereda operaciones de negocio.",
  },
];

export const ETIQUETA_PERFIL: Readonly<Record<PerfilCodigo, string>> = Object.fromEntries(
  PERFILES.map(({ codigo, nombre }) => [codigo, nombre]),
) as Record<PerfilCodigo, string>;

// Perfil principal: el primero según el orden de PERFILES.
export function perfilPrincipal(codigos: readonly PerfilCodigo[]): PerfilCodigo {
  const principal = PERFILES.find(({ codigo }) => codigos.includes(codigo));
  if (!principal) throw new Error("El usuario no tiene perfiles asignados.");
  return principal.codigo;
}

const DEFINICION_PERMISOS = [
  ["cliente:ver", "Ver clientes"],
  ["cliente:gestionar", "Crear y editar clientes"],
  ["catalogo:ver", "Ver el catálogo de productos"],
  ["catalogo:gestionar", "Gestionar productos, recetas, categorías, áreas y plantillas"],
  ["cotizacion:ver", "Ver cotizaciones"],
  ["cotizacion:gestionar", "Crear, editar borradores, duplicar y archivar cotizaciones"],
  ["cotizacion:enviar", "Enviar cotizaciones al cliente"],
  ["cotizacion:responder", "Registrar la aprobación, el rechazo o el vencimiento de cotizaciones"],
  ["orden:ver", "Ver órdenes de trabajo"],
  ["orden:crear", "Convertir una cotización en orden de trabajo"],
  ["orden:gestionar", "Editar fecha de entrega, responsable y especificaciones de la orden"],
  ["orden:avanzar", "Avanzar el estado de la orden en producción"],
  ["orden:entregar", "Registrar la entrega de la orden"],
  ["orden:cerrar", "Cerrar órdenes entregadas"],
  ["orden:cancelar", "Cancelar órdenes"],
  ["produccion:ver", "Ver el tablero de producción"],
  ["produccion:planificar", "Asignar responsables, fechas y etapas de producción"],
  ["produccion:ejecutar", "Iniciar y completar etapas de producción"],
  ["inventario:ver", "Ver existencias y movimientos de inventario"],
  ["inventario:entrada", "Registrar entradas de material"],
  ["inventario:consumir", "Registrar consumos y devoluciones de material"],
  ["inventario:ajustar", "Ajustar existencias de inventario"],
  ["material:gestionar", "Dar de alta materiales y definir stock mínimo"],
  ["bitacora:ver", "Ver la bitácora global de trazabilidad"],
  ["panel:ver", "Ver el panel de indicadores"],
  ["reporte:ver", "Ver reportes"],
  ["reporte:exportar", "Exportar reportes"],
  ["usuario:gestionar", "Gestionar usuarios"],
  ["permiso:gestionar", "Gestionar la matriz de perfiles y permisos"],
  ["configuracion:gestionar", "Gestionar la configuración del sistema"],
] as const;

export type Permiso = (typeof DEFINICION_PERMISOS)[number][0];

export const CATALOGO_PERMISOS: readonly { permiso: Permiso; descripcion: string }[] = DEFINICION_PERMISOS.map(
  ([permiso, descripcion]) => ({ permiso, descripcion }),
);

// Matriz por defecto: Tabla 14 de la tesis v9 (docs/modulos/09-perfiles-v9.md). Reemplaza ADR-006 y SD-24.
// ADMIN puede editarla en la base.
export const PERMISOS_POR_PERFIL: Readonly<Record<PerfilCodigo, readonly Permiso[]>> = {
  GERENCIA: [
    "cliente:ver",
    "catalogo:ver",
    "cotizacion:ver",
    "orden:ver",
    "produccion:ver",
    "inventario:ver",
    "bitacora:ver",
    "panel:ver",
    "reporte:ver",
    "reporte:exportar",
  ],
  ADMINISTRACION: [
    "catalogo:ver",
    "cotizacion:ver",
    "orden:ver",
    "orden:gestionar",
    "orden:avanzar",
    "produccion:ver",
    "produccion:planificar",
    "produccion:ejecutar",
    "inventario:ver",
    "inventario:entrada",
    "inventario:consumir",
    "inventario:ajustar",
    "material:gestionar",
    "panel:ver",
  ],
  OPERACIONES: [
    "cliente:ver",
    "catalogo:ver",
    "catalogo:gestionar",
    "cotizacion:ver",
    "cotizacion:responder",
    "orden:ver",
    "orden:crear",
    "orden:gestionar",
    "orden:avanzar",
    "orden:entregar",
    "orden:cerrar",
    "orden:cancelar",
    "produccion:ver",
    "produccion:planificar",
    "inventario:ver",
    "panel:ver",
  ],
  ATENCION_CLIENTE: [
    "cliente:ver",
    "cliente:gestionar",
    "catalogo:ver",
    "cotizacion:ver",
    "cotizacion:gestionar",
    "cotizacion:enviar",
    "cotizacion:responder",
    "orden:ver",
    "orden:entregar",
    "orden:cerrar",
    "produccion:ver",
    "panel:ver",
  ],
  PRODUCCION: ["catalogo:ver", "orden:ver", "orden:avanzar", "produccion:ver", "produccion:ejecutar", "panel:ver"],
  ADMIN: ["bitacora:ver", "usuario:gestionar", "permiso:gestionar", "configuracion:gestionar"],
};

// ADMIN no tiene panel:ver: su pantalla de inicio es la gestión de usuarios.
export const destinoPorPerfil: Readonly<Record<PerfilCodigo, string>> = {
  GERENCIA: "/panel",
  ADMINISTRACION: "/panel",
  OPERACIONES: "/panel",
  ATENCION_CLIENTE: "/panel",
  PRODUCCION: "/panel",
  ADMIN: "/admin/usuarios",
};
