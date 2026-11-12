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
    descripcion: material?.descripcion ?? "", unidad: material?.unidad ?? "UNIDAD", areaProduccion: material?.areaProduccion ?? "",
    unidadCotizacion: material?.unidadCotizacion ?? "", areaUnidadInventario: material?.areaUnidadInventario ?? "",
    stockMinimo: material?.stockMinimo ?? "0", costoPromedio: material?.costoPromedio ?? "0",
    tipoPresentacion: material?.presentacion?.tipo ?? "", anchoPresentacion: material?.presentacion?.ancho ?? "",
    largoPresentacion: material?.presentacion?.largo ?? "" });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const solicitud = useSolicitudInventario("formulario-material");
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const { codigo, unidad, tipoPresentacion, anchoPresentacion, largoPresentacion, unidadCotizacion, areaUnidadInventario, ...campos } = valores;
    const presentacion = unidad === "M2" && tipoPresentacion
      ? { tipo: tipoPresentacion, ancho: anchoPresentacion, largo: largoPresentacion } : null;
    const unidadVenta = unidadCotizacion || (unidad === "M2" ? "M2" : null);
    const areaUnidad = unidadVenta === "M2" && unidad !== "M2" ? areaUnidadInventario : null;
    const compartidos = { ...campos, areaProduccion: campos.areaProduccion || null, presentacion,
      unidadCotizacion: unidadVenta, areaUnidadInventario: areaUnidad };
    const cuerpo = material ? { ...compartidos, version: material.actualizadoEn }
      : { ...compartidos, codigo, unidad };
    const esquema = material ? esquemaEditarMaterial : esquemaCrearMaterial;
    const erroresValidacion = erroresEsquema(esquema, cuerpo); setErrores(erroresValidacion);
    if (Object.keys(erroresValidacion).length) { enfocarError("formulario-material"); return; }
    await solicitud.enviar({ url: material ? `/api/v1/materiales/${material.id}` : "/api/v1/materiales",
      metodo: material ? "PATCH" : "POST", cuerpo, destino: material ? `/inventario/${material.id}` : "/inventario" });
  }
  function cambiar(campo: keyof ValoresMaterial, valor: string) {
    setValores({ ...valores, [campo]: valor, ...(campo === "unidad" ? { unidadCotizacion: "", areaUnidadInventario: "" } : {}) });
    setErrores({}); solicitud.cambiarContenido();
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
