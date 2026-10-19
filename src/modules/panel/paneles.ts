import { can, type Actor } from "@/core/autorizacion";
import { dividir, formatear, leerDecimal, deEntero } from "@/core/decimal";
import { textoEstado } from "@/modules/trazabilidad/etiquetas";
import { comparacionPanel, mesAnterior, cantidadPanel, dineroPanel, etiquetaDia, etiquetaSemana, mesesConActividad, META_APROBACION_PCT, nombreMes, nombreMesCorto, tasaAprobacion, tendenciaMonto, tendenciaTasa, tituloGerencia } from "./dto";
import { consultarClientesNuevos, consultarComercial, consultarMaterialesPanel, consultarMovimientos, consultarOperacion, consultarProduccion } from "./repo";
import { consultarFeed } from "./feed";
import type { ContenidoPanel, GraficoPanel, IndicadorPanel, PerfilPanel, SerieConteo } from "./tipos";

const vacio = (): ContenidoPanel => ({ titulo: "No hay datos disponibles con sus permisos", pregunta: "", indicadores: [], grafico: null, atencion: [], atencionTotal: 0 });
function indicador(entrada: Omit<IndicadorPanel, "valor" | "numero" | "formato"> & { valor: number | string; numero?: number | null; formato?: IndicadorPanel["formato"] }): IndicadorPanel {
  return { ...entrada, numero: entrada.numero ?? (typeof entrada.valor === "number" ? entrada.valor : null), formato: entrada.formato ?? "entero", valor: typeof entrada.valor === "number" ? cantidadPanel(entrada.valor) : entrada.valor };
}
function grafico(titulo: string, subtitulo: string, datos: SerieConteo[]): GraficoPanel {
  return { titulo, subtitulo, tipo: "barras", datos };
}
async function gerencia(actor: Actor, hoy: string): Promise<ContenidoPanel> {
  const [comercial, ordenes] = await Promise.all([
    can(actor, "cotizacion:ver") ? consultarComercial(hoy) : undefined,
    can(actor, "orden:ver") ? consultarOperacion(hoy) : undefined,
  ]);
  const panel = { ...vacio(), pregunta: "¿Cómo va el negocio este mes?" };
  if (comercial) {
    const actual = comercial.meses[5], anterior = comercial.meses[4];
    panel.titulo = tituloGerencia(actual, anterior);
    panel.indicadores.push(indicador({ id: "monto-aprobado", etiqueta: "Monto aprobado", valor: dineroPanel(actual.monto), numero: Number(actual.monto), formato: "moneda",
      comparacion: comparacionPanel(Number(actual.monto), Number(anterior.monto), "el mes anterior"),
      contexto: `vs. ${dineroPanel(anterior.monto)} en ${nombreMes(anterior.mes)}`, tendencia: tendenciaMonto(actual.monto, anterior.monto), destino: "/cotizaciones?estado=APROBADA" }),
    indicador({ id: "tasa-aprobacion", etiqueta: "Tasa de aprobación", valor: `${Math.round(tasaAprobacion(actual))} %`, numero: tasaAprobacion(actual), formato: "porcentaje", meta: META_APROBACION_PCT,
      comparacion: comparacionPanel(tasaAprobacion(actual), tasaAprobacion(anterior), "el mes anterior"),
      contexto: `${actual.aprobadas} de ${actual.respondidas} respondidas`,
      tendencia: tendenciaTasa(actual, anterior), destino: "/cotizaciones" }));
    panel.grafico = grafico("Monto aprobado por mes", "Meses con datos (hasta seis)", mesesConActividad(comercial.meses).map((mes) => ({
      clave: mes.mes, etiqueta: nombreMesCorto(mes.mes), valor: Number(formatear(dividir(leerDecimal(mes.monto)!, deEntero(1000)), 1)), texto: dineroPanel(mes.monto), destacado: mes.mes === actual.mes })));
    if (can(actor, "reporte:ver")) panel.grafico.nota = { texto: "Ver en Reportes", destino: "/reportes" };
  }
  if (ordenes) {
    if (!comercial) panel.titulo = `${ordenes.enProduccion} órdenes en producción`;
    panel.indicadores.push(indicador({ id: "en-produccion", etiqueta: "Órdenes en producción", valor: ordenes.enProduccion,
      contexto: `${ordenes.pendientes} por iniciar`, destino: "/ordenes?estado=EN_PRODUCCION" }),
    indicador({ id: "ordenes-atrasadas", mejorSiBaja: true, etiqueta: "Órdenes atrasadas", valor: ordenes.atrasadas,
      contexto: "Entrega vencida", destino: "/ordenes?vencidas=true", alerta: ordenes.atrasadas > 0 }));
  }
  return panel;
}

function tituloOperaciones(accion: number): string {
  if (accion === 0) return "Ninguna orden necesita su acción";
  return accion === 1 ? "1 orden necesita su acción" : `${accion} órdenes necesitan su acción`;
}
async function operaciones(actor: Actor, hoy: string): Promise<ContenidoPanel> {
  const pregunta = "¿Qué órdenes necesitan mi acción?";
  if (!can(actor, "orden:ver")) return { ...vacio(), pregunta };
  const datos = await consultarOperacion(hoy);
  return { titulo: tituloOperaciones(datos.accion), pregunta,
    indicadores: [
      indicador({ id: "por-iniciar", mejorSiBaja: true, etiqueta: "Por iniciar", valor: datos.pendientes, contexto: "Meta: 0 sin iniciar", destino: "/ordenes?estado=PENDIENTE" }),
      indicador({ id: "sin-responsable", mejorSiBaja: true, etiqueta: "Sin responsable", valor: datos.sinResponsable, contexto: "Meta: 0 sin responsable", destino: "/ordenes?responsable=sin-responsable", alerta: datos.sinResponsable > 0 }),
      indicador({ id: "en-produccion", etiqueta: "En producción", valor: datos.enProduccion, contexto: "Meta: terminarlas a tiempo", destino: "/ordenes?estado=EN_PRODUCCION" }),
      indicador({ id: "entregas-proximas", etiqueta: "Entregas próximas", valor: datos.entregas, comparacion: comparacionPanel(datos.entregas, datos.entregadasAnteriores, "7 días previos"), contexto: "Meta: 100 % a tiempo", destino: "/ordenes" }),
    ], grafico: { ...grafico("Órdenes por estado", "Órdenes activas; excluye cerradas y canceladas", datos.porEstado.filter((fila) => fila.etiqueta !== "CERRADA" && fila.etiqueta !== "CANCELADA").map((fila) => ({ ...fila, clave: fila.etiqueta, etiqueta: textoEstado(fila.etiqueta) ?? fila.etiqueta }))),
      nota: { texto: "Ver órdenes", destino: "/ordenes" } },
    atencion: [], atencionTotal: 0 };
}

async function atencionCliente(actor: Actor, hoy: string): Promise<ContenidoPanel> {
  const panel = { ...vacio(), pregunta: "¿Qué clientes esperan respuesta?" };
  const [datos, clientes, clientesAnteriores] = await Promise.all([can(actor, "cotizacion:ver") ? consultarComercial(hoy) : undefined,
    can(actor, "cliente:ver") ? consultarClientesNuevos(hoy) : undefined,
    can(actor, "cliente:ver") ? consultarClientesNuevos(mesAnterior(hoy)) : undefined]);
  if (datos) {
    panel.titulo = `${datos.enviadas} cotizaciones esperan respuesta del cliente`;
    panel.indicadores.push(indicador({ id: "enviadas", mejorSiBaja: true, etiqueta: "Enviadas sin respuesta", valor: datos.enviadas, contexto: "Meta: 0 sin respuesta", destino: "/cotizaciones?estado=ENVIADA" }),
      indicador({ id: "por-vencer", mejorSiBaja: true, etiqueta: "Por vencer", valor: datos.porVencer, contexto: "Meta: 0 por vencer", destino: "/cotizaciones?estado=ENVIADA", alerta: datos.porVencer > 0 }),
      indicador({ id: "aprobadas-mes", etiqueta: "Aprobadas del mes", valor: datos.meses[5].aprobadas, comparacion: comparacionPanel(datos.meses[5].aprobadas, datos.meses[4].aprobadas, "el mes anterior"), contexto: `Mes anterior: ${datos.meses[4].aprobadas}`, destino: "/cotizaciones?estado=APROBADA" }));
    panel.grafico = grafico("Cotizaciones por estado", "Creadas en los últimos treinta días", datos.porEstado.filter((fila) => fila.etiqueta !== "CERRADA" && fila.etiqueta !== "CANCELADA").map((fila) => ({ ...fila, clave: fila.etiqueta, etiqueta: textoEstado(fila.etiqueta) ?? fila.etiqueta })));
    panel.grafico.nota = { texto: "Ver cotizaciones", destino: "/cotizaciones" };

  }
  if (clientes !== undefined) panel.indicadores.push(indicador({ id: "clientes-nuevos", etiqueta: "Clientes nuevos", valor: clientes, comparacion: comparacionPanel(clientes, clientesAnteriores!, "el mes anterior"), contexto: "Meta: 1 o más al mes", destino: "/clientes" }));
  return panel;
}

async function produccion(actor: Actor, hoy: string, instante: Date): Promise<ContenidoPanel> {
  const pregunta = "¿Qué hago hoy?";
  if (!can(actor, "produccion:ver") || !can(actor, "orden:ver")) return { ...vacio(), pregunta };
  const datos = await consultarProduccion({ hoy, instante, actorId: actor.id });
  return { titulo: `${datos.enCurso + datos.pendientes} etapas por atender hoy`, pregunta,
    indicadores: [
      indicador({ id: "mis-etapas-en-curso", etiqueta: "Mis etapas en curso", valor: datos.enCurso, contexto: "Meta: 1 a la vez", destino: "/produccion" }),
      indicador({ id: "mis-etapas-pendientes", mejorSiBaja: true, etiqueta: "Mis etapas pendientes", valor: datos.pendientes, contexto: "Meta: 0 pendientes", destino: "/produccion" }),
      indicador({ id: "completadas-hoy", etiqueta: "Completadas hoy por mí", valor: datos.completadasHoy, comparacion: comparacionPanel(datos.completadasHoy, datos.porDia.at(-2)?.valor ?? 0, "ayer"), contexto: "Meta: 1 o más al día", destino: "/produccion" }),
      indicador({ id: "mis-etapas-atrasadas", mejorSiBaja: true, etiqueta: "Mis etapas atrasadas", valor: datos.atrasadas, contexto: "Meta: 0 atrasadas", destino: "/produccion", alerta: datos.atrasadas > 0 }),
    ], grafico: { ...grafico("Etapas que completé", "Últimos siete días", datos.porDia.map((fila) => ({ ...fila, clave: fila.etiqueta, etiqueta: etiquetaDia(fila.etiqueta) }))),
      nota: { texto: "Ver producción", destino: "/produccion" } },
    atencion: [], atencionTotal: 0 };
}

// La comparación es de la semana (no del día): el texto lo dice para no confundir bajo "Consumos de hoy".
function comparacionSemanal(semanas: SerieConteo[]) {
  const comparacion = comparacionPanel(semanas.at(-1)?.valor ?? 0, semanas.at(-2)?.valor ?? 0, "la semana anterior");
  if (comparacion.porcentaje === null) return { ...comparacion, texto: "Sin consumos la semana anterior" };
  return { ...comparacion, texto: `Esta semana: ${comparacion.texto.replace(/ vs\. la semana anterior$/, "")}` };
}

async function administracion(actor: Actor, hoy: string): Promise<ContenidoPanel> {
  const pregunta = "¿Está sano el inventario?";
  if (!can(actor, "inventario:ver")) return { ...vacio(), pregunta };
  const [datos, movimientos] = await Promise.all([consultarMaterialesPanel(can(actor, "cotizacion:ver")), consultarMovimientos(hoy)]);
  const indicadores = [indicador({ id: "materiales-bajo-minimo", mejorSiBaja: true, etiqueta: "Materiales bajo el mínimo", valor: datos.bajoMinimo,
    contexto: "Meta: 0 bajo mínimo", destino: "/inventario?bajoMinimo=true", alerta: datos.bajoMinimo > 0 }),
  indicador({ id: "consumos-hoy", etiqueta: "Consumos de hoy", valor: movimientos.consumosHoy, comparacion: comparacionSemanal(movimientos.semanas), contexto: "Meta: registrar todos", destino: "/inventario" })];
  if (can(actor, "cotizacion:ver")) indicadores.push(indicador({ id: "valor-inventario", etiqueta: "Valor del inventario", valor: dineroPanel(datos.valor), numero: Number(datos.valor), formato: "moneda", contexto: "Meta: costo promedio", destino: "/inventario" }));
  indicadores.push(indicador({ id: "movimientos-semana", etiqueta: "Movimientos de la semana", valor: movimientos.movimientosSemana, contexto: "Meta: registrar todos", destino: "/inventario" }));
  return { titulo: datos.bajoMinimo ? `${datos.bajoMinimo} materiales bajo el mínimo` : "El inventario está al día", pregunta, indicadores,
    grafico: { ...grafico("Consumos por semana", "Cantidad de consumos; últimas seis semanas", movimientos.semanas.map((fila) => ({ ...fila, clave: fila.etiqueta, etiqueta: etiquetaSemana(fila.etiqueta) }))),
      nota: { texto: "Ver inventario", destino: "/inventario" } },
    atencion: [], atencionTotal: 0 };
}

async function construirIndicadores(entrada: { perfil: PerfilPanel; actor: Actor; hoy: string; instante: Date }): Promise<ContenidoPanel> {
  const { perfil, actor, hoy, instante } = entrada;
  switch (perfil) {
    case "GERENCIA": return gerencia(actor, hoy);
    case "OPERACIONES": return operaciones(actor, hoy);
    case "ATENCION_CLIENTE": return atencionCliente(actor, hoy);
    case "PRODUCCION": return produccion(actor, hoy, instante);
    case "ADMINISTRACION": return administracion(actor, hoy);
  }
}

export async function construirPanel(entrada: { perfil: PerfilPanel; actor: Actor; hoy: string; instante: Date }): Promise<ContenidoPanel> {
  const [contenido, feed] = await Promise.all([construirIndicadores(entrada), consultarFeed(entrada)]);
  return { ...contenido, ...feed };
}
