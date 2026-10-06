import type { ReactNode } from "react";

import { Fecha } from "@/components/comunes/ValorFormateado";
import { Card } from "@/components/ui/card";

import { ETIQUETA_TIPO } from "../schema";
import type { ClienteDto } from "../tipos";
import { EstadoCliente } from "./EstadoCliente";

function Dato({ etiqueta, children, ancho }: { etiqueta: string; children: ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? "sm:col-span-2" : undefined}>
      <dt className="text-sm font-medium text-muted-foreground">{etiqueta}</dt>
      <dd className="mt-1 text-base break-words whitespace-pre-line text-foreground">{children}</dd>
    </div>
  );
}

function textoOGuion(valor: string | null) {
  return valor ?? "—";
}

export function DatosCliente({ cliente, className }: { cliente: ClienteDto; className?: string }) {
  return (
    <Card className={className} aria-labelledby="datos-cliente">
      <div className="space-y-5 px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="datos-cliente" className="text-xl font-semibold tracking-tight text-foreground">
            Datos del cliente
          </h2>
          <EstadoCliente activo={cliente.activo} />
        </div>
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Dato etiqueta="Tipo">{ETIQUETA_TIPO[cliente.tipo]}</Dato>
          <Dato etiqueta="RUC">{textoOGuion(cliente.ruc)}</Dato>
          <Dato etiqueta="Contacto principal">{textoOGuion(cliente.contactoPrincipal)}</Dato>
          <Dato etiqueta="Teléfono">{textoOGuion(cliente.telefono)}</Dato>
          <Dato etiqueta="Correo electrónico">{textoOGuion(cliente.correo)}</Dato>
          <Dato etiqueta="Dirección">{textoOGuion(cliente.direccion)}</Dato>
          <Dato etiqueta="Notas" ancho>
            {textoOGuion(cliente.notas)}
          </Dato>
          <Dato etiqueta="Registrado">
            <Fecha valor={cliente.creadoEn} />
          </Dato>
          <Dato etiqueta="Última actualización">
            <Fecha valor={cliente.actualizadoEn} />
          </Dato>
        </dl>
      </div>
    </Card>
  );
}
