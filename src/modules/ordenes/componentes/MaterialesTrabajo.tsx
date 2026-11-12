import { agruparMaterialesPorArea } from "../materiales-por-area";
import type { OrdenDto } from "../tipos";

export function MaterialesTrabajo({ materiales }: { materiales: OrdenDto["materialesTrabajo"] }) {
  if (!materiales.length) return null;
  return <section aria-labelledby="titulo-materiales-trabajo">
    <h3 id="titulo-materiales-trabajo" className="mb-2 text-lg font-semibold">Materiales para el trabajo</h3>
    <div className="space-y-2">
      {agruparMaterialesPorArea(materiales).map(({ area, titulo, filas }) => <div key={area ?? "sin-area"}>
        <h4 className="font-semibold">{area ? titulo : "Sin área asignada"}</h4>
        <ul className="list-disc pl-5">{filas.map(({ nombre }) => <li key={nombre}>{nombre}</li>)}</ul>
      </div>)}
    </div>
  </section>;
}
