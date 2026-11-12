import Image from "next/image";
import { CERO, dividir, formatear, leerDecimal, multiplicar, redondear, restar, sumar } from "@/core/decimal";
import { Money } from "@/components/comunes/ValorFormateado";
import { monedaDe } from "../moneda";
import { hoyManagua } from "../fechas";
import type { CotizacionDto } from "../tipos";

const fechaLarga = new Intl.DateTimeFormat("es-NI", { dateStyle: "long", timeZone: "UTC" });

function partidasPublicas({ items, subtotal, total }: CotizacionDto) {
  const base = leerDecimal(subtotal)!;
  const neto = leerDecimal(total)!;
  let acumulado = CERO;
  let anterior = CERO;
  return items.map((item, indice) => {
    acumulado = sumar(acumulado, leerDecimal(item.importe)!);
    const ajustado = indice === items.length - 1 ? neto :
      base.num === BigInt(0) ? CERO : redondear(dividir(multiplicar(acumulado, neto), base), 2);
    const importe = restar(ajustado, anterior);
    anterior = ajustado;
    return { id: item.id, descripcion: item.descripcion,
      cantidad: item.cantidad.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""), total: formatear(importe, 2),
      unitario: formatear(dividir(importe, leerDecimal(item.cantidad)!), 2) };
  });
}

function DescripcionPartida({ descripcion }: { descripcion: string }) {
  const [titulo, ...detalle] = descripcion.split("\n");
  return <><strong>{titulo}</strong>{detalle.length ? <><br />{detalle.join("\n")}</> : null}</>;
}

export function Proforma({ cotizacion }: { cotizacion: CotizacionDto }) {
  const moneda = monedaDe(cotizacion.moneda);
  const fecha = cotizacion.fechaEmision ?? cotizacion.creadoEn?.slice(0, 10) ?? hoyManagua();
  return <article id="proforma" aria-label={`Proforma ${cotizacion.numero}`}>
    <Image className="proforma-membrete" src="/brand/proforma-membrete.png" alt="Soluciones Creativas · Publicidad efectiva"
      width={1698} height={378} priority unoptimized />
    <div className="proforma-datos">
      <p className="proforma-fecha"><time dateTime={fecha}>{fechaLarga.format(new Date(`${fecha}T12:00:00Z`))}</time></p>
      <h2>Proforma</h2>
      <p><strong>Cliente:</strong> {cotizacion.cliente.nombre}</p>
      <p><strong>Referencia:</strong> {cotizacion.asunto}</p>
    </div>
    <div className="proforma-cuerpo">
      <table aria-label="Partidas de la proforma">
        <colgroup><col style={{ width: "58%" }} /><col style={{ width: "10%" }} /><col style={{ width: "16%" }} /><col /></colgroup>
        <thead><tr><th scope="col">Descripción</th><th scope="col">Cantidad</th><th scope="col">Costo Unitario</th><th scope="col">Total</th></tr></thead>
        <tbody>
          {partidasPublicas(cotizacion).map((fila) => <tr key={fila.id}>
            <td><DescripcionPartida descripcion={fila.descripcion} /></td><td className="proforma-cantidad">{fila.cantidad}</td>
            <td><Money valor={fila.unitario} moneda={moneda} /></td><td><Money valor={fila.total} moneda={moneda} /></td>
          </tr>)}
          <tr><td colSpan={2} /><th scope="row">Total</th><td><strong><Money valor={cotizacion.total} moneda={moneda} /></strong></td></tr>
        </tbody>
      </table>
      {cotizacion.mostrarCondiciones && cotizacion.condiciones ? <section className="proforma-condiciones" aria-label="Condiciones comerciales">
        <h3>Condiciones comerciales</h3><p>{cotizacion.condiciones}</p>
      </section> : null}
    </div>
    <Image className="proforma-pie" src="/brand/proforma-pie.png"
      alt="Soluciones Creativas, Estelí. Teléfonos 2714 1105 y 8851 0449. Correo info@s-creativas.net. Redes @scmarketing360."
      width={1694} height={490} priority unoptimized />
  </article>;
}
