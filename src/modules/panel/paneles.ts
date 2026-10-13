import { can, type Actor } from "@/core/autorizacion";
import { dividir, formatear, leerDecimal, deEntero } from "@/core/decimal";
import { formatearFecha } from "@/lib/formato";
import { textoEstado } from "@/modules/trazabilidad/etiquetas";
import { cantidadMaterialPanel, cantidadPanel, dineroPanel, etiquetaDia, etiquetaSemana, mesesConActividad, META_APROBACION_PCT, nombreMes, nombreMesCorto, tasaAprobacion, tendenciaMonto, tendenciaTasa, tituloGerencia } from "./dto";
import { consultarClientesNuevos, consultarComercial, consultarMaterialesPanel, consultarMovimientos, consultarOperacion, consultarProduccion } from "./repo";
import type { AtencionPanel, ContenidoPanel, GraficoPanel, IndicadorPanel, InventarioPanel, OperacionPanel, PerfilPanel, SerieConteo } from "./tipos";

const vacio = (): ContenidoPanel => ({ titulo: "No hay datos disponibles con sus permisos", pregunta: "", indicadores: [], grafico: null, atencion: [], atencionTotal: 0 });
function indicador(entrada: Omit<IndicadorPanel, "valor"> & { valor: number | string }): IndicadorPanel {
  return { ...entrada, valor: typeof entrada.valor === "number" ? cantidadPanel(entrada.valor) : entrada.valor };
}
function grafico(titulo: string, subtitulo: string, datos: SerieConteo[]): GraficoPanel {
  return { titulo, subtitulo, tipo: "barras", datos };
}
function textoAprobadas(cantidad: number): string {
  return cantidad === 1 ? "1 cotización aprobada" : `${cantidad} cotizaciones aprobadas`;
}
function atencionOrdenes(datos: OperacionPanel): AtencionPanel[] {
  return datos.filas.map((fila) => ({ id: fila.id, titulo: fila.dias > 0 ? `${fila.numero} atrasada ${fila.dias} días` : `${fila.numero} sin responsable`,
    detalle: fila.sinResponsable ? "Asigne un responsable" : "Revise la fecha de entrega",
    gravedad: fila.dias > 0 ? "alta" : "media", destino: `/ordenes/${fila.id}` }));
}
function atencionMateriales(datos: InventarioPanel): AtencionPanel[] {
  return datos.filas.map((fila) => ({ id: fila.id, titulo: `${fila.nombre} bajo el mínimo`,
    detalle: `Existencia ${cantidadMaterialPanel(fila.existencia, fila.unidad)} de ${cantidadMaterialPanel(fila.minimo, fila.unidad)}`,
    gravedad: fila.existencia === "0.000" || Number(fila.existencia) === 0 ? "alta" : "media", destino: `/inventario/${fila.id}` }));
}
async function gerencia(actor: Actor, hoy: string): Promise<ContenidoPanel> {
  const [comercial, ordenes, materiales] = await Promise.all([
    can(actor, "cotizacion:ver") ? consultarComercial(hoy) : undefined,
    can(actor, "orden:ver") ? consultarOperacion(hoy, true) : undefined,
    can(actor, "inventario:ver") ? consultarMaterialesPanel(false) : undefined,
  ]);
  const panel = { ...vacio(), pregunta: "¿Cómo va el negocio este mes?" };
  if (comercial) {
    const actual = comercial.meses[5], anterior = comercial.meses[4];
    panel.titulo = tituloGerencia(actual, anterior);
    panel.indicadores.push(indicador({ id: "monto-aprobado", etiqueta: "Monto aprobado", valor: dineroPanel(actual.monto),
      contexto: `${textoAprobadas(actual.aprobadas)}; ${nombreMes(anterior.mes)}: ${dineroPanel(anterior.monto)}`, tendencia: tendenciaMonto(actual.monto, anterior.monto), destino: "/cotizaciones?estado=APROBADA" }),
    indicador({ id: "tasa-aprobacion", etiqueta: "Tasa de aprobación", valor: `${Math.round(tasaAprobacion(actual))} %`,
      contexto: `Meta ${META_APROBACION_PCT} %; ${actual.aprobadas} aprobadas de ${actual.respondidas} respondidas`,
      tendencia: tendenciaTasa(actual, anterior), destino: "/cotizaciones" }));
    panel.grafico = grafico("Monto aprobado por mes", "Meses con datos (hasta seis)", mesesConActividad(comercial.meses).map((mes) => ({
      etiqueta: nombreMesCorto(mes.mes), valor: Number(formatear(dividir(leerDecimal(mes.monto)!, deEntero(1000)), 1)), texto: dineroPanel(mes.monto), destacado: mes.mes === actual.mes })));
    if (can(actor, "reporte:ver")) panel.grafico.nota = { texto: "Ver en Reportes", destino: "/reportes" };
  }
  if (ordenes) {
    if (!comercial) panel.titulo = `${ordenes.enProduccion} órdenes en producción`;
    panel.indicadores.push(indicador({ id: "en-produccion", etiqueta: "Órdenes en producción", valor: ordenes.enProduccion,
      contexto: `${ordenes.pendientes} por iniciar`, destino: "/ordenes?estado=EN_PRODUCCION" }),
    indicador({ id: "ordenes-atrasadas", etiqueta: "Órdenes atrasadas", valor: ordenes.atrasadas,
      contexto: "Fecha de entrega anterior a hoy", destino: "/ordenes?vencidas=true", alerta: ordenes.atrasadas > 0 }));
    panel.atencion.push(...atencionOrdenes(ordenes)); panel.atencionTotal += ordenes.accion;
  }
  if (materiales) { panel.atencion.push(...atencionMateriales(materiales)); panel.atencionTotal += materiales.bajoMinimo; }
  panel.atencion = panel.atencion.slice(0, 5);
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
      indicador({ id: "por-iniciar", etiqueta: "Por iniciar", valor: datos.pendientes, contexto: "Meta: 0 órdenes pendientes de iniciar", destino: "/ordenes?estado=PENDIENTE" }),
      indicador({ id: "sin-responsable", etiqueta: "Sin responsable", valor: datos.sinResponsable, contexto: "Meta: 0 órdenes activas sin responsable", destino: "/ordenes?responsable=sin-responsable", alerta: datos.sinResponsable > 0 }),
      indicador({ id: "en-produccion", etiqueta: "En producción", valor: datos.enProduccion, contexto: "Meta: completar todas las órdenes en producción", destino: "/ordenes?estado=EN_PRODUCCION" }),
      indicador({ id: "entregas-proximas", etiqueta: "Entregas próximas", valor: datos.entregas, contexto: "Meta: entregar a tiempo el 100 %; próximos siete días", destino: "/ordenes" }),
    ], grafico: { ...grafico("Órdenes por estado", "Órdenes activas; excluye cerradas y canceladas", datos.porEstado.filter((fila) => fila.etiqueta !== "CERRADA" && fila.etiqueta !== "CANCELADA").map((fila) => ({ ...fila, etiqueta: textoEstado(fila.etiqueta) ?? fila.etiqueta }))),
      nota: { texto: "Ver órdenes", destino: "/ordenes" } },
    atencion: atencionOrdenes(datos), atencionTotal: datos.accion };
}

async function atencionCliente(actor: Actor, hoy: string): Promise<ContenidoPanel> {
  const panel = { ...vacio(), pregunta: "¿Qué clientes esperan respuesta?" };
  const [datos, clientes] = await Promise.all([can(actor, "cotizacion:ver") ? consultarComercial(hoy) : undefined,
    can(actor, "cliente:ver") ? consultarClientesNuevos(hoy) : undefined]);
  if (datos) {
    panel.titulo = `${datos.enviadas} cotizaciones esperan respuesta del cliente`;
    panel.indicadores.push(indicador({ id: "enviadas", etiqueta: "Enviadas sin respuesta", valor: datos.enviadas, contexto: "Meta: 0 cotizaciones vigentes sin respuesta", destino: "/cotizaciones?estado=ENVIADA" }),
      indicador({ id: "por-vencer", etiqueta: "Por vencer", valor: datos.porVencer, contexto: "Meta: 0 cotizaciones por vencer en los próximos tres días", destino: "/cotizaciones?estado=ENVIADA", alerta: datos.porVencer > 0 }),
      indicador({ id: "aprobadas-mes", etiqueta: "Aprobadas del mes", valor: datos.meses[5].aprobadas, contexto: `Mes anterior: ${datos.meses[4].aprobadas} aprobadas`, destino: "/cotizaciones?estado=APROBADA" }));
    panel.grafico = grafico("Cotizaciones por estado", "Creadas en los últimos treinta días", datos.porEstado.filter((fila) => fila.etiqueta !== "CERRADA" && fila.etiqueta !== "CANCELADA").map((fila) => ({ ...fila, etiqueta: textoEstado(fila.etiqueta) ?? fila.etiqueta })));
    panel.grafico.nota = { texto: "Ver cotizaciones", destino: "/cotizaciones" };
    panel.atencionTotal = datos.atencionTotal;
    panel.atencion = datos.filas.map((fila) => ({ id: fila.id, titulo: fila.numero,
      detalle: fila.estado === "AJUSTE_SOLICITADO" ? "Ajuste solicitado sin versión corregida" : `Vence el ${formatearFecha(fila.vencimiento)}`,
      gravedad: fila.estado === "AJUSTE_SOLICITADO" ? "alta" : "media", destino: `/cotizaciones/${fila.id}` }));
  }
  if (clientes !== undefined) panel.indicadores.push(indicador({ id: "clientes-nuevos", etiqueta: "Clientes nuevos", valor: clientes, contexto: "Meta: al menos 1 cliente nuevo al mes", destino: "/clientes" }));
  return panel;
}

async function produccion(actor: Actor, hoy: string, instante: Date): Promise<ContenidoPanel> {
  const pregunta = "¿Qué hago hoy?";
  if (!can(actor, "produccion:ver") || !can(actor, "orden:ver")) return { ...vacio(), pregunta };
  const datos = await consultarProduccion({ hoy, instante, actorId: actor.id });
  return { titulo: `${datos.enCurso + datos.pendientes} etapas por atender hoy`, pregunta,
    indicadores: [
      indicador({ id: "mis-etapas-en-curso", etiqueta: "Mis etapas en curso", valor: datos.enCurso, contexto: "Meta: 1 etapa en curso a la vez", destino: "/produccion" }),
      indicador({ id: "mis-etapas-pendientes", etiqueta: "Mis etapas pendientes", valor: datos.pendientes, contexto: "Meta: 0 etapas asignadas pendientes", destino: "/produccion" }),
      indicador({ id: "completadas-hoy", etiqueta: "Completadas hoy por mí", valor: datos.completadasHoy, contexto: "Meta: al menos 1 etapa completada al día", destino: "/produccion" }),
      indicador({ id: "mis-etapas-atrasadas", etiqueta: "Mis etapas atrasadas", valor: datos.atrasadas, contexto: "Meta: 0 etapas con fecha de fin vencida", destino: "/produccion", alerta: datos.atrasadas > 0 }),
    ], grafico: { ...grafico("Etapas que completé", "Últimos siete días", datos.porDia.map((fila) => ({ ...fila, etiqueta: etiquetaDia(fila.etiqueta) }))),
      nota: { texto: "Ver producción", destino: "/produccion" } },
    atencion: datos.filas.map((fila) => ({ id: fila.id, titulo: `${fila.numero}: ${fila.nombre}`,
      detalle: fila.dias > 0 ? `Atrasada ${fila.dias} días` : "En curso desde hace más de dos días",
      gravedad: fila.dias > 0 ? "alta" : "media", destino: `/ordenes/${fila.ordenId}` })), atencionTotal: datos.atencionTotal };
}

async function administracion(actor: Actor, hoy: string): Promise<ContenidoPanel> {
  const pregunta = "¿Está sano el inventario?";
  if (!can(actor, "inventario:ver")) return { ...vacio(), pregunta };
  const [datos, movimientos] = await Promise.all([consultarMaterialesPanel(can(actor, "cotizacion:ver")), consultarMovimientos(hoy)]);
  const indicadores = [indicador({ id: "materiales-bajo-minimo", etiqueta: "Materiales bajo el mínimo", valor: datos.bajoMinimo,
    contexto: "Meta: 0 materiales activos bajo el mínimo", destino: "/inventario?bajoMinimo=true", alerta: datos.bajoMinimo > 0 }),
  indicador({ id: "consumos-hoy", etiqueta: "Consumos de hoy", valor: movimientos.consumosHoy, contexto: "Meta: registrar el 100 % de los consumos del día", destino: "/inventario" })];
  if (can(actor, "cotizacion:ver")) indicadores.push(indicador({ id: "valor-inventario", etiqueta: "Valor del inventario", valor: dineroPanel(datos.valor), contexto: "Meta: valorar el 100 % de las existencias al costo promedio", destino: "/inventario" }));
  indicadores.push(indicador({ id: "movimientos-semana", etiqueta: "Movimientos de la semana", valor: movimientos.movimientosSemana, contexto: "Meta: registrar el 100 % de los movimientos; desde el lunes hasta hoy", destino: "/inventario" }));
  return { titulo: datos.bajoMinimo ? `${datos.bajoMinimo} materiales bajo el mínimo` : "El inventario está al día", pregunta, indicadores,
    grafico: { ...grafico("Consumos por semana", "Cantidad de consumos; últimas seis semanas", movimientos.semanas.map((fila) => ({ ...fila, etiqueta: etiquetaSemana(fila.etiqueta) }))),
      nota: { texto: "Ver inventario", destino: "/inventario" } },
    atencion: atencionMateriales(datos), atencionTotal: datos.bajoMinimo };
}

export async function construirPanel(entrada: { perfil: PerfilPanel; actor: Actor; hoy: string; instante: Date }): Promise<ContenidoPanel> {
  const { perfil, actor, hoy, instante } = entrada;
  switch (perfil) {
    case "GERENCIA": return gerencia(actor, hoy);
    case "OPERACIONES": return operaciones(actor, hoy);
    case "ATENCION_CLIENTE": return atencionCliente(actor, hoy);
    case "PRODUCCION": return produccion(actor, hoy, instante);
    case "ADMINISTRACION": return administracion(actor, hoy);
  }
}
