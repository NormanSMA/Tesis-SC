import type { CotizacionSembrada } from "./cotizaciones";
import type { Escenario } from "./datos/esquemas";
import { desplazarMinutos, diaSiguiente, fechaCalendario, instante, type Reloj } from "./fechas";
import { usuarioPorClave, type Catalogos, type EtapaPlantillaSembrada } from "./tipos";

export type EstadoEtapaPlan = "PENDIENTE" | "EN_CURSO" | "COMPLETADA" | "OMITIDA";
export type EstadoOrdenPlan = "PENDIENTE" | "EN_PRODUCCION" | "LISTA" | "ENTREGADA" | "CERRADA" | "CANCELADA";

export type EtapaPlan = {
  plantilla: EtapaPlantillaSembrada;
  nombre: string;
  estado: EstadoEtapaPlan;
  responsableId: string | null;
  inicioPlan: Date | null;
  finPlan: Date | null;
  inicioReal: Date | null;
  finReal: Date | null;
  // Etapa que el escenario no define: se omite en una orden terminada o cancelada.
  porDefecto: boolean;
};

export type PlanOrden = {
  creadaEn: Date;
  categoriaId: string;
  categoriaNombre: string;
  fechaEntrega: Date;
  etapas: EtapaPlan[];
  inicioReal: Date | null;
  omitidaEn: Date | null;
  listaEn: Date | null;
  entregadaEn: Date | null;
  cerradaEn: Date | null;
  canceladaEn: Date | null;
};

type OrdenDatos = NonNullable<Escenario["orden"]>;
type EtapaDatos = OrdenDatos["etapas"][number];

const ESTADOS_TERMINADOS: EstadoOrdenPlan[] = ["LISTA", "ENTREGADA", "CERRADA", "CANCELADA"];
const HORA_INICIO_ETAPA = 13;

function usuarioDeEtapa(catalogos: Catalogos, clave: string | null): string | null {
  return clave ? usuarioPorClave(catalogos, clave).id : null;
}

function exigirFechas(clave: string, definicion: EtapaDatos, diasOrden: number): void {
  const { nombre, diasInicio, diasFin } = definicion;
  if (diasInicio !== null && diasInicio > diasOrden) {
    throw new Error(`${clave}: la etapa "${nombre}" empieza antes de crear la orden (${diasInicio} > ${diasOrden} días)`);
  }
  if (diasInicio !== null && diasFin !== null && diasFin > diasInicio) {
    throw new Error(`${clave}: la etapa "${nombre}" termina antes de empezar`);
  }
}

type EntradaEtapa = {
  clave: string;
  plantilla: EtapaPlantillaSembrada;
  definicion: EtapaDatos;
  previoFin: Date;
  diasOrden: number;
};

// Los días de la etapa cuentan hacia atrás desde hoy. En etapas sin cerrar, diasFin es la fecha planificada.
function etapaDefinida(reloj: Reloj, catalogos: Catalogos, entrada: EntradaEtapa): EtapaPlan {
  const { clave, plantilla, definicion, previoFin, diasOrden } = entrada;
  exigirFechas(clave, definicion, diasOrden);
  const { estado, diasInicio, diasFin, nombre } = definicion;
  const iniciada = estado === "EN_CURSO" || estado === "COMPLETADA";
  if (iniciada && (diasInicio === null || definicion.responsable === null)) {
    throw new Error(`${clave}: la etapa "${nombre}" en estado ${estado} requiere diasInicio y responsable`);
  }
  if (estado === "COMPLETADA" && diasFin === null) {
    throw new Error(`${clave}: la etapa "${nombre}" COMPLETADA requiere diasFin`);
  }
  const inicioReal = iniciada
    ? new Date(Math.max(instante(reloj, diasInicio as number, HORA_INICIO_ETAPA).getTime(), previoFin.getTime()))
    : null;
  const horaFin = diasInicio !== null && diasFin !== null && diasFin < diasInicio ? 12 : 17.5;
  const finReal =
    estado === "COMPLETADA" && inicioReal
      ? new Date(Math.max(instante(reloj, diasFin as number, horaFin).getTime(), inicioReal.getTime()))
      : null;
  return {
    plantilla,
    nombre,
    estado,
    responsableId: usuarioDeEtapa(catalogos, definicion.responsable),
    inicioPlan: diasInicio === null ? null : fechaCalendario(reloj, diasInicio),
    finPlan: diasFin === null ? null : fechaCalendario(reloj, diasFin),
    inicioReal,
    finReal,
    porDefecto: false,
  };
}

function etapaPorDefecto(plantilla: EtapaPlantillaSembrada, estadoOrden: EstadoOrdenPlan): EtapaPlan {
  return {
    plantilla,
    nombre: plantilla.nombre,
    estado: ESTADOS_TERMINADOS.includes(estadoOrden) ? "OMITIDA" : "PENDIENTE",
    responsableId: null,
    inicioPlan: null,
    finPlan: null,
    inicioReal: null,
    finReal: null,
    porDefecto: true,
  };
}

// La etapa i del escenario corresponde a la etapa i de la plantilla de la categoría principal.
// Conserva el nombre del escenario: puede refinar el de la plantilla (por ejemplo "Fabricación estructura LED").
function planificarEtapas(
  reloj: Reloj,
  catalogos: Catalogos,
  datos: { cotizacion: CotizacionSembrada; plantilla: EtapaPlantillaSembrada[]; creadaEn: Date },
): EtapaPlan[] {
  const { escenario } = datos.cotizacion;
  const orden = escenario.orden as OrdenDatos;
  if (orden.etapas.length > datos.plantilla.length) {
    throw new Error(`${escenario.clave}: define ${orden.etapas.length} etapas y la plantilla solo tiene ${datos.plantilla.length}`);
  }
  let previoFin = datos.creadaEn;
  return datos.plantilla.map((plantilla, indice) => {
    const definicion = orden.etapas[indice];
    if (!definicion) return etapaPorDefecto(plantilla, orden.estadoFinal);
    const etapa = etapaDefinida(reloj, catalogos, {
      clave: escenario.clave,
      plantilla,
      definicion,
      previoFin,
      diasOrden: escenario.diasAtras,
    });
    previoFin = etapa.finReal ?? etapa.inicioReal ?? previoFin;
    return etapa;
  });
}

function exigirCoherencia(clave: string, estadoOrden: EstadoOrdenPlan, etapas: EtapaPlan[]): void {
  const estados = etapas.map((e) => e.estado);
  const hay = (...buscados: EstadoEtapaPlan[]) => estados.some((e) => buscados.includes(e));
  const problema = {
    PENDIENTE: hay("EN_CURSO", "COMPLETADA") && "no puede tener etapas iniciadas",
    EN_PRODUCCION: !hay("EN_CURSO", "COMPLETADA") && "requiere una etapa iniciada",
    LISTA: (hay("PENDIENTE", "EN_CURSO") || !hay("COMPLETADA")) && "requiere todas las etapas cerradas",
    ENTREGADA: (hay("PENDIENTE", "EN_CURSO") || !hay("COMPLETADA")) && "requiere todas las etapas cerradas",
    CERRADA: (hay("PENDIENTE", "EN_CURSO") || !hay("COMPLETADA")) && "requiere todas las etapas cerradas",
    CANCELADA: hay("EN_CURSO") && "no puede cancelarse con una etapa en curso",
  }[estadoOrden];
  if (problema) throw new Error(`${clave}: una orden ${estadoOrden} ${problema}`);
}

function nombreDeCategoria(catalogos: Catalogos, categoriaId: string): string {
  const nombre = [...catalogos.categorias].find(([, id]) => id === categoriaId)?.[0];
  if (!nombre) throw new Error(`Categoría inexistente: ${categoriaId}`);
  return nombre;
}

function ultimoFin(etapas: EtapaPlan[], respaldo: Date): Date {
  const fines = etapas.flatMap((e) => (e.finReal ? [e.finReal.getTime()] : []));
  return fines.length > 0 ? new Date(Math.max(...fines)) : respaldo;
}

function cronologia(reloj: Reloj, estado: EstadoOrdenPlan, base: { creadaEn: Date; etapas: EtapaPlan[] }) {
  const inicios = base.etapas.flatMap((e) => (e.inicioReal ? [e.inicioReal.getTime()] : []));
  const cierre = ultimoFin(base.etapas, base.creadaEn);
  const llegoALista = ["LISTA", "ENTREGADA", "CERRADA"].includes(estado);
  const listaEn = llegoALista ? desplazarMinutos(reloj, cierre, 5) : null;
  const entregadaEn = listaEn && estado !== "LISTA" ? diaSiguiente(reloj, listaEn, 10) : null;
  const cerradaEn = entregadaEn && estado === "CERRADA" ? diaSiguiente(reloj, entregadaEn, 10) : null;
  const canceladaEn =
    estado === "CANCELADA"
      ? new Date(Math.max(diaSiguiente(reloj, base.creadaEn, 9).getTime(), cierre.getTime() + 300_000))
      : null;
  const omitidaEn = canceladaEn ? desplazarMinutos(reloj, canceladaEn, -1) : desplazarMinutos(reloj, cierre, 2);
  return {
    inicioReal: inicios.length > 0 ? new Date(Math.min(...inicios)) : null,
    omitidaEn,
    listaEn,
    entregadaEn,
    cerradaEn,
    canceladaEn,
  };
}

export function planificarOrden(reloj: Reloj, catalogos: Catalogos, cotizacion: CotizacionSembrada): PlanOrden {
  const { escenario, plan, items } = cotizacion;
  const orden = escenario.orden as OrdenDatos;
  const categoriaId = items[0].categoriaId;
  const categoriaNombre = nombreDeCategoria(catalogos, categoriaId);
  const plantilla = catalogos.plantillas.get(categoriaNombre);
  if (!plantilla) throw new Error(`${escenario.clave}: la categoría ${categoriaNombre} no tiene plantilla de etapas`);
  const creadaEn = desplazarMinutos(reloj, plan.respondidaEn as Date, 30);
  const etapas = planificarEtapas(reloj, catalogos, { cotizacion, plantilla, creadaEn });
  exigirCoherencia(escenario.clave, orden.estadoFinal, etapas);
  return {
    creadaEn,
    categoriaId,
    categoriaNombre,
    fechaEntrega: fechaCalendario(reloj, -orden.diasParaEntrega),
    etapas,
    ...cronologia(reloj, orden.estadoFinal, { creadaEn, etapas }),
  };
}
