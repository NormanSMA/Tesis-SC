import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { Fecha } from "@/components/comunes/ValorFormateado";
import { nombreMoneda } from "../moneda";
import type { CotizacionDto } from "../tipos";
import { ItemsCotizacion } from "./ItemsCotizacion";
import { TotalesCotizacion } from "./TotalesCotizacion";

export function Proforma({ cotizacion, empresaNombre }: { cotizacion: CotizacionDto; empresaNombre: string }) {
  const cliente = cotizacion.cliente;
  return <article id="proforma" className="mx-auto max-w-5xl space-y-6 rounded-lg border bg-card p-6">
    <div className="flex flex-wrap justify-between gap-4 border-b pb-5">
      <div><p className="text-xl font-semibold">{empresaNombre}</p><p className="mt-1 text-sm">Proforma {cotizacion.numero}</p></div>
      <div className="space-y-2"><EstadoBadge tipo="cotizacion" estado={cotizacion.estado} />
        {cotizacion.archivada ? <p className="text-sm">Cotización archivada</p> : null}</div>
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <section aria-label="Datos vigentes del cliente" className="space-y-1 text-sm">
        <h2 className="text-base font-semibold">Cliente</h2><p className="font-medium">{cliente.nombre}</p>
        {cliente.ruc ? <p>RUC: {cliente.ruc}</p> : null}
        {cliente.contactoPrincipal ? <p>Contacto: {cliente.contactoPrincipal}</p> : null}
        {cliente.telefono ? <p>Teléfono: {cliente.telefono}</p> : null}
        {cliente.correo ? <p>Correo: {cliente.correo}</p> : null}
        {cliente.direccion ? <p>{cliente.direccion}</p> : null}
      </section>
      <dl className="space-y-2 text-sm">
        <div><dt>Emisión</dt><dd><Fecha valor={cotizacion.fechaEmision} /></dd></div>
        <div className="flex gap-1"><dt>Moneda:</dt>
          <dd>{nombreMoneda(cotizacion.moneda)}</dd></div>
        {cotizacion.moneda !== "NIO" ? <div className="flex gap-1"><dt>Tipo de cambio:</dt>
          <dd>C$ {cotizacion.tipoCambio} por US$ 1</dd></div> : null}
        <div><dt>Vencimiento</dt><dd><Fecha valor={cotizacion.fechaVencimiento} /></dd></div>
        <div><dt>Vigencia</dt><dd>{cotizacion.vigenciaDias} días</dd></div>
      </dl>
    </div>
    <h2 className="text-xl font-semibold">{cotizacion.asunto}</h2>
    <ItemsCotizacion items={cotizacion.items} mostrarCostos={false} moneda={cotizacion.moneda} />
    <div className="ml-auto max-w-sm"><TotalesCotizacion totales={cotizacion} moneda={cotizacion.moneda} mostrarMargen={false} /></div>
    <section className="space-y-2" aria-label="Condiciones comerciales">
      <h2 className="text-base font-semibold">Condiciones comerciales</h2>
      <p className="whitespace-pre-wrap text-sm">{cotizacion.condiciones || "Sin condiciones adicionales."}</p>
    </section>
    <p className="border-t pt-4 text-xs text-muted-foreground">Proforma. Documento de cotización.</p>
  </article>;
}
