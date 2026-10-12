import { z } from "zod";

export const TIPOS_CLIENTE = ["PERSONA", "EMPRESA"] as const;
export type TipoCliente = (typeof TIPOS_CLIENTE)[number];

export const ETIQUETA_TIPO: Record<TipoCliente, string> = { PERSONA: "Persona", EMPRESA: "Empresa" };

export const LIMITES = { nombre: 200, ruc: 20, contactoPrincipal: 120, telefono: 30, correo: 254 } as const;

export const CAMPOS_EDITABLES = [
  "nombre",
  "tipo",
  "ruc",
  "contactoPrincipal",
  "telefono",
  "correo",
  "direccion",
  "notas",
] as const;
export type CampoEditable = (typeof CAMPOS_EDITABLES)[number];

export const MENSAJE_SIN_CONTACTO = "Indique un teléfono o un correo electrónico.";

function recortar(valor: string | null | undefined): string | null | undefined {
  if (valor === undefined || valor === null) return valor;
  const limpio = valor.trim();
  return limpio === "" ? null : limpio;
}

function compactarRuc(valor: string | null | undefined): string | null | undefined {
  const limpio = recortar(valor);
  return limpio ? limpio.replace(/\s+/g, "").toUpperCase() : limpio;
}

function minusculas(valor: string | null | undefined): string | null | undefined {
  const limpio = recortar(valor);
  return typeof limpio === "string" ? limpio.toLowerCase() : limpio;
}

const nombre = z
  .string({ error: "Ingrese el nombre del cliente." })
  .transform((valor) => valor.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(1, "Ingrese el nombre del cliente.")
      .max(LIMITES.nombre, `El nombre admite hasta ${LIMITES.nombre} caracteres.`),
  );

const tipo = z.enum(TIPOS_CLIENTE, { error: "Seleccione el tipo de cliente." });

function limitado(maximo: number, etiqueta: string) {
  return z.string().max(maximo, `${etiqueta} admite hasta ${maximo} caracteres.`);
}

const reglasTexto = {
  ruc: limitado(LIMITES.ruc, "El RUC").nullable(),
  contactoPrincipal: limitado(LIMITES.contactoPrincipal, "El contacto principal").nullable(),
  telefono: limitado(LIMITES.telefono, "El teléfono").nullable(),
  correo: z
    .string()
    .max(LIMITES.correo, `El correo admite hasta ${LIMITES.correo} caracteres.`)
    .email("Ingrese un correo electrónico válido.")
    .nullable(),
  direccion: z.string().max(2000, "Admite hasta 2000 caracteres.").nullable(),
  notas: z.string().max(2000, "Admite hasta 2000 caracteres.").nullable(),
};

const normalizacion: Record<keyof typeof reglasTexto, (valor: string | null | undefined) => string | null | undefined> =
  {
    ruc: compactarRuc,
    contactoPrincipal: recortar,
    telefono: recortar,
    correo: minusculas,
    direccion: recortar,
    notas: recortar,
  };

function textoAlCrear(campo: keyof typeof reglasTexto) {
  return z
    .string({ error: "Debe ser texto." })
    .nullish()
    .transform((valor) => normalizacion[campo](valor) ?? null)
    .pipe(reglasTexto[campo]);
}

function textoAlEditar(campo: keyof typeof reglasTexto) {
  return z
    .string({ error: "Debe ser texto." })
    .nullish()
    .transform((valor) => normalizacion[campo](valor))
    .pipe(reglasTexto[campo].optional());
}

type DatosContacto = { telefono?: string | null; correo?: string | null };

export function tieneMedioContacto({ telefono, correo }: DatosContacto): boolean {
  return Boolean(telefono) || Boolean(correo);
}

export const esquemaCrearCliente = z
  .object({
    nombre,
    tipo,
    ruc: textoAlCrear("ruc"),
    contactoPrincipal: textoAlCrear("contactoPrincipal"),
    telefono: textoAlCrear("telefono"),
    correo: textoAlCrear("correo"),
    direccion: textoAlCrear("direccion"),
    notas: textoAlCrear("notas"),
  })
  .superRefine((valor, contexto) => {
    if (tieneMedioContacto(valor)) return;
    for (const campo of ["telefono", "correo"] as const) {
      contexto.addIssue({ code: "custom", path: [campo], message: MENSAJE_SIN_CONTACTO });
    }
  });

export type EntradaCrearCliente = z.output<typeof esquemaCrearCliente>;

const CLAVES_PERMITIDAS = new Set<string>(["version", ...CAMPOS_EDITABLES]);

// El PATCH no acepta activo, id ni marcas de tiempo: cada clave ajena recibe su propio error.
export const esquemaEditarCliente = z
  .looseObject({
    version: z.iso.datetime({ offset: true, error: "Falta la versión del cliente. Recargue la página." }),
    nombre: nombre.optional(),
    tipo: tipo.optional(),
    ruc: textoAlEditar("ruc"),
    contactoPrincipal: textoAlEditar("contactoPrincipal"),
    telefono: textoAlEditar("telefono"),
    correo: textoAlEditar("correo"),
    direccion: textoAlEditar("direccion"),
    notas: textoAlEditar("notas"),
  })
  .superRefine((valor, contexto) => {
    for (const clave of Object.keys(valor)) {
      if (CLAVES_PERMITIDAS.has(clave)) continue;
      contexto.addIssue({ code: "custom", path: [clave], message: "Este campo no se puede modificar." });
    }
  });

export type EntradaEditarCliente = z.output<typeof esquemaEditarCliente>;

export const esquemaCambioEstado = z.object({
  version: z.iso.datetime({ offset: true, error: "Falta la versión del cliente. Recargue la página." }),
});

export const esquemaIdCliente = z.uuid();

// Evita que un OFFSET enorme llegue a la base como un error 500.
const MAXIMO_PAGINA = 100_000;

export const esquemaConsultaClientes = z.object({
  q: z.string().max(200, "La búsqueda admite hasta 200 caracteres.").optional(),
  tipo: z.enum(TIPOS_CLIENTE, { error: "El tipo debe ser PERSONA o EMPRESA." }).optional(),
  activo: z
    .enum(["true", "false"], { error: "El estado debe ser true o false." })
    .default("true")
    .transform((valor) => valor === "true"),
  pagina: z.coerce
    .number({ error: "La página debe ser un número entero mayor o igual a 1." })
    .int("La página debe ser un número entero mayor o igual a 1.")
    .min(1, "La página debe ser un número entero mayor o igual a 1.")
    .max(MAXIMO_PAGINA, "La página solicitada es demasiado grande.")
    .default(1),
  porPagina: z.coerce
    .number({ error: "El tamaño de página debe estar entre 1 y 100." })
    .int("El tamaño de página debe estar entre 1 y 100.")
    .min(1, "El tamaño de página debe estar entre 1 y 100.")
    .max(100, "El tamaño de página debe estar entre 1 y 100.")
    .default(20),
});

export type ConsultaClientes = z.output<typeof esquemaConsultaClientes>;

type ParametrosBrutos = URLSearchParams | Record<string, string | string[] | undefined>;

// Un parámetro vacío (?tipo=) equivale a no enviarlo.
export function objetoDeParametros(parametros: ParametrosBrutos): Record<string, string> {
  const pares =
    parametros instanceof URLSearchParams
      ? [...parametros.entries()]
      : Object.entries(parametros).map(([clave, valor]) => [clave, Array.isArray(valor) ? valor[0] : valor] as const);
  const resultado: Record<string, string> = {};
  for (const [clave, valor] of pares) {
    const limpio = valor?.trim();
    if (limpio) resultado[clave] = limpio;
  }
  return resultado;
}
