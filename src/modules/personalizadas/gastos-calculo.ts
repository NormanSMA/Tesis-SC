import { CERO, CIEN, UNO, comparar, dividir, formatear, leerDecimal, multiplicar, restar, sumar, type Racional } from "@/core/decimal";
import { costearItemPersonalizado, type EntradaLinea } from "@/core/costeo";
import { AppError } from "@/lib/errores";
import { esquemaGastos, type GastosPersonalizados } from "./gastos-schema";

type GastoCalculado = { descripcion: string; costo: string };
const decimal = (v: string) => leerDecimal(v)!;
function producto(valores: string[]) { return valores.reduce((total, v) => multiplicar(total, decimal(v)), UNO); }
function fijos(g: GastosPersonalizados): GastoCalculado[] {
  return [
    { descripcion: "Renta asignada al trabajo", costo: g.rentaModo === "MONTO" ? g.rentaValor : "0" },
    { descripcion: "Traslado: ida y vuelta por viajes", costo: formatear(producto([g.kmIda,"2",g.viajes,g.tarifaKm]),2) },
    { descripcion: "Mano de obra: personas por horas", costo: formatear(producto([g.personas,g.horasPersona,g.tarifaHora]),2) },
    { descripcion: "Viáticos: personas por días", costo: formatear(producto([g.personasViaticos,g.diasViaticos,g.tarifaViatico]),2) },
    { descripcion: "Hospedaje: personas por noches", costo: formatear(producto([g.personasHospedaje,g.noches,g.tarifaHospedaje]),2) },
  ];
}
function porcentuales(g: GastosPersonalizados, precio: Racional): GastoCalculado[] {
  return [
    { descripcion: "Renta sobre venta", pct: g.rentaModo === "PORCENTAJE" ? g.rentaValor : "0" },
    { descripcion: "Imprevistos sobre venta", pct: g.imprevistosPct },
    { descripcion: "Impuestos internos sobre venta", pct: g.impuestosPct },
  ].map(f => ({ descripcion: `${f.descripcion} (${f.pct} %)`, costo: formatear(dividir(multiplicar(precio,decimal(f.pct)),CIEN),2) }));
}
export function gastosCalculados(entrada: { gastos: GastosPersonalizados; lineas: EntradaLinea[]; cantidad: string; margenPct: string }): GastoCalculado[] {
  const lectura = esquemaGastos.safeParse(entrada.gastos);
  if (!lectura.success) throw new AppError({ status: 422, codigo: "VALIDACION", mensaje: [...new Set(lectura.error.issues.map(i=>i.message))].join(" ") });
  const g = lectura.data;
  const costoBase = entrada.lineas.length ? costearItemPersonalizado({ ...entrada, lineas: entrada.lineas }).costoTotal : "0";
  const cargos = fijos(g);
  const costo = cargos.reduce((t,f) => sumar(t,decimal(f.costo)),decimal(costoBase));
  const tasas = [entrada.margenPct,g.imprevistosPct,g.impuestosPct,g.rentaModo === "PORCENTAJE" ? g.rentaValor : "0"];
  const suma = tasas.reduce((t,v) => sumar(t,dividir(decimal(v),CIEN)),CERO);
  if (comparar(suma,UNO) >= 0) throw new AppError({ status: 422, codigo: "VALIDACION", mensaje: "Margen, renta porcentual, imprevistos e impuestos deben sumar menos de 100 %." });
  let precio = decimal(formatear(dividir(costo,restar(UNO,suma)),2));
  for (let paso=0;paso<30;paso++) {
    const lineas = [...cargos,...porcentuales(g,precio)].filter(f=>comparar(decimal(f.costo),CERO)>0);
    const total = costearItemPersonalizado({ cantidad: entrada.cantidad, margenPct: entrada.margenPct,
      lineas: [...entrada.lineas,...lineas.map(f=>({ tipo:"TERCERO" as const,costo:f.costo }))] });
    if (comparar(decimal(total.importe),precio) === 0) return lineas;
    precio = decimal(total.importe);
  }
  throw new AppError({ status: 422, codigo: "VALIDACION", mensaje: "No se pudo conciliar el redondeo con esos porcentajes. Revise el margen y los gastos." });
}
