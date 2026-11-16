import Image from "next/image";
import { Fecha } from "@/components/comunes/ValorFormateado";
import type { OrdenDto } from "../tipos";
import { materialesPorEtapa } from "../materiales-por-area";

export function OrdenImprimible({ orden }: { orden: OrdenDto }) {
  const { porEtapa, sinEtapa } = materialesPorEtapa(orden.etapas, orden.materialesTrabajo);
  return <article id="orden-impresa" aria-label={`Orden de trabajo ${orden.numero}`}>
    <div className="encabezado-orden-impresa">
      <h2>Orden de trabajo {orden.numero}</h2>
      <Image src="/brand/soluciones-creativas.png" alt="Soluciones Creativas" width={375} height={213} priority unoptimized />
    </div>
    <p><strong>Cliente:</strong> {orden.cliente.nombre}</p>
    {orden.cotizacion ? <p><strong>Cotización:</strong> {orden.cotizacion.numero}</p> : null}
    {orden.responsable ? <p><strong>Responsable de la orden:</strong> {orden.responsable.nombre}</p> : null}
    <p><strong>Fecha de entrega:</strong> <Fecha valor={orden.fechaEntrega} /></p>
    {orden.especificaciones ? <section><h3>Especificaciones generales</h3><p>{orden.especificaciones}</p></section> : null}
    {orden.etapas.length || sinEtapa.length ? <section>
      <h3>Áreas, materiales e instrucciones</h3>
      <table aria-label="Áreas, materiales e instrucciones">
        <thead><tr><th scope="col">Etapa y área</th><th scope="col">Responsable</th><th scope="col">Materiales</th><th scope="col">Instrucciones</th></tr></thead>
        <tbody>{orden.etapas.map((etapa) => <tr key={etapa.id}>
          <td>{etapa.secuencia}. {etapa.nombre}{etapa.area.nombre === etapa.nombre
            ? null : <small>{etapa.area.nombre}</small>}</td>
          <td>{etapa.responsable?.nombre ?? "Sin asignar"}</td>
          <td>{porEtapa.get(etapa.id)?.length ? porEtapa.get(etapa.id)!.join(", ") : "—"}</td><td>{etapa.instrucciones ?? "—"}</td>
        </tr>)}
        {sinEtapa.length ? <tr><td>Sin área asignada</td><td>—</td><td>{sinEtapa.join(", ")}</td><td>—</td></tr> : null}</tbody>
      </table>
    </section> : null}
  </article>;
}
