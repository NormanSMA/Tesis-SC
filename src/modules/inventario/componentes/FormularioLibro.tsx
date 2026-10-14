"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/comunes/FormField";
import { Input } from "@/components/ui/input";
import { formatearCantidadConUnidad } from "@/lib/formato";
import { enfocarError, erroresEsquema } from "@/modules/cotizaciones/useSolicitudCotizacion";
import type { MaterialDto } from "../dto";
import { esquemaAjuste, esquemaEntrada } from "../schema";
import { useSolicitudInventario } from "../useSolicitudInventario";
import { AvisoSolicitud } from "./AvisoSolicitud";
import { SelectorMaterial } from "./SelectorMaterial";
import { CamposLibro } from "./CamposLibro";
import type { ValoresLibro } from "./tipos-libro";

export function FormularioLibro({ tipo, inicial }: { tipo: "entrada" | "ajuste"; inicial?: MaterialDto }) {
  const [material, setMaterial] = useState<MaterialDto | null>(inicial ?? null);
  const [valores, setValores] = useState<ValoresLibro>({ cantidad: "", costoUnitario: "", referencia: "", motivo: "", direccion: "AUMENTAR" });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const solicitud = useSolicitudInventario("formulario-libro");
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const base = { materialId: material?.id ?? "", cantidad: valores.cantidad };
    const cuerpo = tipo === "entrada" ? { ...base, costoUnitario: valores.costoUnitario, referencia: valores.referencia }
      : { ...base, direccion: valores.direccion, motivo: valores.motivo };
    const campos = erroresEsquema(tipo === "entrada" ? esquemaEntrada : esquemaAjuste, cuerpo); setErrores(campos);
    if (Object.keys(campos).length) { enfocarError("formulario-libro"); return; }
    await solicitud.enviar({ url: `/api/v1/inventario/${tipo === "entrada" ? "entradas" : "ajustes"}`, cuerpo, libro: true });
  }
  function cambiar(campo: keyof ValoresLibro, valor: string) {
    setValores({ ...valores, [campo]: valor }); setErrores({}); solicitud.cambiarContenido();
  }
  return <form id="formulario-libro" className="max-w-3xl space-y-5" onSubmit={guardar} noValidate aria-label={tipo === "entrada" ? "Registrar entrada" : "Ajustar inventario"}>
    <AvisoSolicitud {...solicitud} /><Card className="min-w-0 px-5"><fieldset disabled={solicitud.enviando} className="min-w-0 space-y-5">
      <SelectorMaterial id="materialId" valor={material?.id ?? ""} error={errores.materialId ?? solicitud.campos.materialId}
        cambiar={(nuevo) => { setMaterial(nuevo); setErrores({}); solicitud.cambiarContenido(); }} />
      {material ? <p className="text-sm" aria-live="polite">Existencia disponible: {formatearCantidadConUnidad(solicitud.existencias[material.id] ?? material.existencia, material.unidad)}</p> : null}
      <FormField id="cantidad" etiqueta="Cantidad" requerido error={errores.cantidad ?? solicitud.campos.cantidad}>{(atributos) =>
        <Input {...atributos} inputMode="decimal" value={valores.cantidad} onChange={(e) => cambiar("cantidad", e.target.value)} />}</FormField>
      <CamposLibro tipo={tipo} valores={valores} errores={{ ...errores, ...solicitud.campos }} cambiar={cambiar} />
    </fieldset></Card><Button type="submit" disabled={solicitud.enviando}>{tipo === "entrada" ? "Registrar entrada" : "Registrar ajuste"}</Button>
  </form>;
}
