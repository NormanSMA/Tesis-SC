"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { FilaConfiguracion, type ParametroDto } from "./FilaConfiguracion";

export function TarifasMateriales({ filas }: { filas: ParametroDto[] }) {
  const [busqueda, setBusqueda] = useState("");
  const q = busqueda.trim().toLocaleLowerCase("es");
  const resultados = q ? filas.filter(({ descripcion }) => descripcion?.toLocaleLowerCase("es").includes(q)) : filas;
  return <section aria-labelledby="tarifas-materiales" className="rounded-xl border bg-card">
    <div className="space-y-3 border-b p-5">
      <h2 id="tarifas-materiales" className="font-semibold">Precios de materiales para cotizar</h2>
      <p className="text-sm text-muted-foreground">El precio se guarda en córdobas por unidad de cotización. Si queda vacío, se usa el costo promedio equivalente de Inventario.</p>
      <label className="block max-w-sm text-sm font-medium">Buscar material
        <Input type="search" className="mt-1" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} />
      </label>
      {!resultados.length ? <p role="status" className="text-sm">{q ? "Sin coincidencias." : "No hay materiales activos."}</p> : null}
    </div>
    <div className="divide-y">{resultados.map((fila) => <FilaConfiguracion key={fila.clave} inicial={fila} />)}</div>
  </section>;
}
