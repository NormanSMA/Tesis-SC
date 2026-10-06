export type PerfilCodigo = "GERENCIA" | "VENTAS" | "PRODUCCION" | "ADMIN";

export const PERFILES: readonly { codigo: PerfilCodigo; nombre: string; descripcion: string }[] = [
  { codigo: "GERENCIA", nombre: "Gerencia", descripcion: "Supervisa la operación, aprueba y consulta reportes." },
  {
    codigo: "VENTAS",
    nombre: "Atención al cliente y ventas",
    descripcion: "Atiende clientes, cotiza y da seguimiento a las órdenes.",
  },
  { codigo: "PRODUCCION", nombre: "Producción", descripcion: "Ejecuta etapas y controla el inventario de materiales." },
  { codigo: "ADMIN", nombre: "Administración del sistema", descripcion: "Gestiona usuarios, permisos y configuración." },
];

const DEFINICION_PERMISOS = [
  ["cliente:ver", "Ver clientes"],
  ["cliente:gestionar", "Crear y editar clientes"],
  ["catalogo:ver", "Ver el catálogo de productos"],
  ["catalogo:gestionar", "Gestionar productos, recetas, categorías, áreas y plantillas"],
  ["cotizacion:ver", "Ver cotizaciones"],
  ["cotizacion:gestionar", "Crear, editar borradores, duplicar y archivar cotizaciones"],
  ["cotizacion:enviar", "Enviar cotizaciones al cliente"],
  ["cotizacion:responder", "Aprobar, rechazar o vencer cotizaciones"],
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

// Matriz por defecto de la sección (c) del modelo de datos (SD-24). ADMIN puede editarla en la base.
export const PERMISOS_POR_PERFIL: Readonly<Record<PerfilCodigo, readonly Permiso[]>> = {
  GERENCIA: [
    "cliente:ver",
    "catalogo:ver",
    "catalogo:gestionar",
    "cotizacion:ver",
    "cotizacion:responder",
    "orden:ver",
    "orden:gestionar",
    "orden:cerrar",
    "orden:cancelar",
    "produccion:ver",
    "inventario:ver",
    "inventario:ajustar",
    "material:gestionar",
    "bitacora:ver",
    "panel:ver",
    "reporte:ver",
    "reporte:exportar",
  ],
  VENTAS: [
    "cliente:ver",
    "cliente:gestionar",
    "catalogo:ver",
    "cotizacion:ver",
    "cotizacion:gestionar",
    "cotizacion:enviar",
    "cotizacion:responder",
    "orden:ver",
    "orden:crear",
    "orden:gestionar",
    "orden:entregar",
    "orden:cerrar",
    "produccion:ver",
    "inventario:ver",
    "panel:ver",
  ],
  PRODUCCION: [
    "catalogo:ver",
    "orden:ver",
    "orden:avanzar",
    "orden:entregar",
    "produccion:ver",
    "produccion:planificar",
    "produccion:ejecutar",
    "inventario:ver",
    "inventario:entrada",
    "inventario:consumir",
    "material:gestionar",
    "panel:ver",
  ],
  ADMIN: ["bitacora:ver", "usuario:gestionar", "permiso:gestionar", "configuracion:gestionar"],
};

// ADMIN no tiene panel:ver: su pantalla de inicio es la gestión de usuarios.
export const destinoPorPerfil: Readonly<Record<PerfilCodigo, string>> = {
  GERENCIA: "/panel",
  VENTAS: "/panel",
  PRODUCCION: "/panel",
  ADMIN: "/admin/usuarios",
};
