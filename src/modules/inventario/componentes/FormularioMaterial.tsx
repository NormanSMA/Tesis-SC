"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CuerpoFormulario, PieFormulario } from "@/components/comunes/SeccionFormulario";
import { Button } from "@/components/ui/button";
import { CERO, comparar, leerDecimal } from "@/core/decimal";
import { enfocarError, erroresEsquema } from "@/modules/cotizaciones/useSolicitudCotizacion";
import type { MaterialDto } from "../dto";
import { esquemaCrearMaterial, esquemaEditarMaterial } from "../schema";
import { useSolicitudInventario } from "../useSolicitudInventario";
import { AvisoSolicitud } from "./AvisoSolicitud";
import { CamposMaterial, type ValoresMaterial } from "./CamposMaterial";

export function FormularioMaterial({ material }: { material?: MaterialDto }) {
  const [valores, setValores] = useState<ValoresMaterial>({ codigo: material?.codigo ?? "", nombre: material?.nombre ?? "",
    descripcion: material?.descripcion ?? "", unidad: material?.unidad ?? "UNIDAD",
    stockMinimo: material?.stockMinimo ?? "0", costoPromedio: material?.costoPromedio ?? "0" });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const solicitud = useSolicitudInventario("formulario-material");
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const cuerpo = material ? { nombre: valores.nombre, descripcion: valores.descripcion, stockMinimo: valores.stockMinimo,
      costoPromedio: valores.costoPromedio, version: material.actualizadoEn } : valores;
    const esquema = material ? esquemaEditarMaterial : esquemaCrearMaterial;
    const campos = erroresEsquema(esquema, cuerpo); setErrores(campos);
    if (Object.keys(campos).length) { enfocarError("formulario-material"); return; }
    await solicitud.enviar({ url: material ? `/api/v1/materiales/${material.id}` : "/api/v1/materiales",
      metodo: material ? "PATCH" : "POST", cuerpo, destino: material ? `/inventario/${material.id}` : "/inventario" });
  }
  function cambiar(campo: keyof ValoresMaterial, valor: string) {
    setValores({ ...valores, [campo]: valor }); setErrores({}); solicitud.cambiarContenido();
  }
  return <form id="formulario-material" aria-label={material ? "Editar material" : "Crear material"}
    className="min-w-0 space-y-5" onSubmit={guardar} noValidate>
    <AvisoSolicitud {...solicitud} />
    <fieldset disabled={solicitud.enviando} className="min-w-0"><CuerpoFormulario>
      <CamposMaterial valores={valores} errores={{ ...errores, ...solicitud.campos }} editar={Boolean(material)}
        conExistencia={Boolean(material && comparar(leerDecimal(material.existencia)!, CERO) !== 0)} cambiar={cambiar} />
    </CuerpoFormulario></fieldset>
    <PieFormulario className="max-sm:[&>div]:flex-col max-sm:[&>div>*]:w-full">
      <Button asChild variant="outline"><Link href={material ? `/inventario/${material.id}` : "/inventario"}>Cancelar</Link></Button>
      <Button type="submit" disabled={solicitud.enviando}>Guardar material</Button></PieFormulario>
  </form>;
}
