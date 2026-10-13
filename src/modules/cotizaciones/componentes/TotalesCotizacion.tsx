import type { TotalesCotizacion as Totales } from "@/core/costeo";
import { Money } from "@/components/comunes/ValorFormateado";
import { Card } from "@/components/ui/card";
import { monedaDe } from "../moneda";

export function TotalesCotizacion({ totales, moneda, mostrarMargen = true }: { totales: Totales; moneda?: string; mostrarMargen?: boolean }) {
  const monedaTotales = monedaDe(moneda);
  return <Card className="w-full px-5 md:ml-auto md:max-w-sm lg:max-w-none" aria-label="Totales de cotización">
    <dl className="space-y-3 text-sm">
      <div className="flex justify-between gap-4"><dt>Subtotal</dt><dd><Money valor={totales.subtotal} moneda={monedaTotales} /></dd></div>
      <div className="flex justify-between gap-4"><dt>Descuento</dt><dd><Money valor={totales.descuento} moneda={monedaTotales} /></dd></div>
      <div className="flex justify-between gap-4"><dt>IVA ({totales.tasaImpuesto} %)</dt><dd><Money valor={totales.impuesto} moneda={monedaTotales} /></dd></div>
      <div className="flex justify-between gap-4 border-t pt-3 text-xl font-semibold"><dt>Total</dt><dd><Money valor={totales.total} moneda={monedaTotales} /></dd></div>
      {mostrarMargen ? <div className="flex justify-between gap-4"><dt>Margen de ítems personalizados</dt>
        <dd>{totales.margenPct === null ? "—" : `${totales.margenPct} %`}</dd></div> : null}
    </dl>
  </Card>;
}
