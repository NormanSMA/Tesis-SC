"use client";

import { useEffect, useState } from "react";
import { FormField } from "@/components/comunes/FormField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MaterialDto } from "../dto";

export function SelectorMaterial({ id, valor, error, cambiar }: {
  id: string; valor: string; error?: string; cambiar: (material: MaterialDto | null) => void;
}) {
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [respuesta, setRespuesta] = useState<{ datos: MaterialDto[]; total: number }>({ datos: [], total: 0 });
  const [fallo, setFallo] = useState("");
  const [externo, setExterno] = useState<{ id: string; texto: string } | null>(null);
  useEffect(() => {
    const controlador = new AbortController();
    fetch(`/api/v1/materiales?activo=true&porPagina=20&pagina=${pagina}&q=${encodeURIComponent(q)}`, { signal: controlador.signal })
      .then(async (resultado) => { if (!resultado.ok) throw new Error("No se pudieron cargar los materiales."); return resultado.json(); })
      .then((datos) => { setRespuesta(datos); setFallo(""); })
      .catch((causa) => { if (!controlador.signal.aborted) setFallo(causa.message ?? "No se pudieron cargar los materiales."); });
    return () => controlador.abort();
  }, [q, pagina]);
  // El material puede venir de la URL y no estar en la página cargada: se consulta para mostrar su nombre.
  useEffect(() => {
    if (!valor || externo?.id === valor || respuesta.datos.some((material) => material.id === valor)) return;
    const controlador = new AbortController();
    fetch(`/api/v1/materiales/${valor}`, { signal: controlador.signal })
      .then((resultado) => (resultado.ok ? resultado.json() : null))
      .then((datos) => { if (datos?.datos) setExterno({ id: valor, texto: `${datos.datos.codigo} · ${datos.datos.nombre}` }); })
      .catch(() => undefined);
    return () => controlador.abort();
  }, [valor, externo, respuesta.datos]);
  return <div className="min-w-0 space-y-3">
    <FormField id={`${id}-buscar`} etiqueta="Buscar material">{(atributos) => <Input {...atributos} value={q}
      onChange={(e) => { setQ(e.target.value); setPagina(1); }} placeholder="Nombre o código" />}</FormField>
    <FormField id={id} etiqueta="Material" requerido error={error}>{(atributos) => <select {...atributos} value={valor}
      className="h-11 w-full min-w-0 rounded-md border bg-background px-3"
      onChange={(e) => cambiar(respuesta.datos.find((material) => material.id === e.target.value) ?? null)}>
      <option value="">Seleccione un material</option>
      {valor && !respuesta.datos.some((material) => material.id === valor) ? <option value={valor}>{externo?.id === valor ? externo.texto : "Material seleccionado"}</option> : null}
      {respuesta.datos.map((material) => <option key={material.id} value={material.id}>{material.codigo} · {material.nombre}</option>)}
    </select>}</FormField>
    <p role="status" className="text-sm text-danger">{fallo}</p>
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anteriores</Button>
      <span className="text-sm">Página {pagina}</span>
      <Button type="button" variant="outline" disabled={pagina * 20 >= respuesta.total} onClick={() => setPagina(pagina + 1)}>Siguientes</Button>
    </div>
  </div>;
}
