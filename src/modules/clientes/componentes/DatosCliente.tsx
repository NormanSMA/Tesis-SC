import { TarjetaSeccion, ListaDatos } from "@/components/comunes/TarjetaSeccion";
import { Fecha } from "@/components/comunes/ValorFormateado";

import { ETIQUETA_TIPO } from "../schema";
import type { ClienteDto } from "../tipos";

function textoOGuion(valor: string | null) {
  return valor ?? "—";
}

export function DatosCliente({ cliente, className }: { cliente: ClienteDto; className?: string }) {
  return (
    <TarjetaSeccion titulo="Datos del cliente" className={className}>
      <ListaDatos
        datos={[
          { etiqueta: "Tipo", valor: ETIQUETA_TIPO[cliente.tipo] },
          { etiqueta: "RUC", valor: textoOGuion(cliente.ruc) },
          { etiqueta: "Contacto principal", valor: textoOGuion(cliente.contactoPrincipal) },
          { etiqueta: "Teléfono", valor: textoOGuion(cliente.telefono) },
          { etiqueta: "Correo electrónico", valor: textoOGuion(cliente.correo) },
          { etiqueta: "Dirección", valor: <span className="whitespace-pre-line">{textoOGuion(cliente.direccion)}</span> },
          { etiqueta: "Notas", valor: <span className="whitespace-pre-line">{textoOGuion(cliente.notas)}</span>, ancho: true },
          { etiqueta: "Registrado", valor: <Fecha valor={cliente.creadoEn} /> },
          { etiqueta: "Última actualización", valor: <Fecha valor={cliente.actualizadoEn} /> },
        ]}
      />
    </TarjetaSeccion>
  );
}
