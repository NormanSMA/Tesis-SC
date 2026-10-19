"use client";

import { Layers } from "lucide-react";
import { useState, type FormEvent } from "react";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { ConfirmDialog } from "@/components/comunes/ConfirmDialog";
import { EmptyState } from "@/components/comunes/EmptyState";
import { InsigniaPunto } from "@/components/comunes/FilaOperativa";
import { ZonaResultados } from "@/components/comunes/ZonaResultados";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AreaDto } from "../tipos";
import { useSolicitudProduccion } from "../useSolicitudProduccion";
import { AvisoProduccion, TextoProduccion } from "./CamposProduccion";
import { FiltrosCatalogo, type ConteosCatalogo } from "./FiltrosCatalogo";

const columnas: ColumnaTabla<AreaDto>[] = [
  { id: "nombre", encabezado: "Área", principal: true, celda: (area) => <span className="flex min-w-0 items-center gap-3">
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-primary ring-1 ring-indigo-100">
      <Layers className="size-4" /></span>
    <span className="min-w-0 font-medium text-slate-900">{area.nombre}</span></span> },
  { id: "estado", encabezado: "Estado", celda: (area) => <InsigniaPunto tono={area.activo ? "exito" : "neutro"}>{area.activo ? "Activa" : "Archivada"}</InsigniaPunto> },
];

function FormularioArea({ area, cerrar }: { area: AreaDto | null; cerrar: () => void }) {
  const [nombre, setNombre] = useState(area?.nombre ?? "");
  const solicitud = useSolicitudProduccion("formulario-area");
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    if (await solicitud.enviar({ url: area ? `/api/v1/areas/${area.id}` : "/api/v1/areas",
      metodo: area ? "PATCH" : "POST", cuerpo: area ? { nombre, version: area.actualizadoEn } : { nombre } })) cerrar();
  }
  return <Dialog open onOpenChange={(valor) => !valor && !solicitud.enviando && cerrar()}>
    <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{area ? "Editar área" : "Crear área"}</DialogTitle>
      <DialogDescription>Defina el nombre del área de producción.</DialogDescription></DialogHeader>
      <form id="formulario-area" onSubmit={guardar} className="space-y-4"><AvisoProduccion {...solicitud} />
        <TextoProduccion id="nombre-area" etiqueta="Nombre" valor={nombre} alCambiar={setNombre}
          requerido maximo={80} deshabilitado={solicitud.enviando} error={solicitud.campos.nombre} />
        <DialogFooter><Button type="button" variant="outline" disabled={solicitud.enviando} onClick={cerrar}>Volver</Button>
          <Button type="submit" disabled={solicitud.enviando}>{area ? "Guardar cambios" : "Crear área"}</Button></DialogFooter>
      </form></DialogContent>
  </Dialog>;
}

function AccionesArea({ area, editar }: { area: AreaDto; editar: () => void }) {
  const [confirmar, setConfirmar] = useState(false);
  const solicitud = useSolicitudProduccion();
  const accion = area.activo ? "archivar" : "reactivar";
  async function guardar() {
    await solicitud.enviar({ url: `/api/v1/areas/${area.id}/${accion}`, metodo: "POST", cuerpo: { version: area.actualizadoEn } });
    setConfirmar(false);
  }
  return <div className="space-y-2 text-left"><AvisoProduccion {...solicitud} /><div className="flex flex-wrap gap-2">
    <Button size="sm" className="h-10" variant="outline" disabled={solicitud.enviando} aria-label={`Editar área: ${area.nombre}`} onClick={editar}>Editar</Button>
    <Button size="sm" className="h-10" variant="outline" disabled={solicitud.enviando} aria-label={`${area.activo ? "Archivar" : "Reactivar"} área: ${area.nombre}`}
      onClick={() => setConfirmar(true)}>{area.activo ? "Archivar" : "Reactivar"}</Button>
  </div>{confirmar ? <ConfirmDialog abierto alCambiarAbierto={setConfirmar}
    titulo={`${area.activo ? "Archivar" : "Reactivar"} área`} descripcion={area.activo
      ? `Archive ${area.nombre} si no tiene plantillas activas ni etapas abiertas.` : `Reactive ${area.nombre} para utilizarla en producción.`}
    etiquetaConfirmar={area.activo ? "Archivar" : "Reactivar"} cargando={solicitud.enviando} alConfirmar={guardar} /> : null}</div>;
}

export function AdministracionAreas({ areas, conteos, gestionar }: { areas: AreaDto[]; conteos: ConteosCatalogo; gestionar: boolean }) {
  const [edicion, setEdicion] = useState<AreaDto | null | undefined>(undefined);
  const filtrado = conteos.todas > areas.length;
  const vacio = <EmptyState titulo={filtrado ? "Sin resultados" : "Sin áreas"}
    descripcion={filtrado ? "Ninguna área coincide con la consulta. Pruebe otros términos o quite los filtros." : "Cree la primera área de producción."} />;
  return <div className="min-w-0">
    <FiltrosCatalogo busqueda="Buscar áreas" marcador="Buscar por nombre del área" conteos={conteos}>
      {gestionar ? <Button type="button" className="h-10" onClick={() => setEdicion(null)}>Crear área</Button> : null}
    </FiltrosCatalogo>
    <ZonaResultados><DataTable titulo="Áreas de producción" columnas={columnas} filas={areas} idFila={(area) => area.id} vacio={vacio}
      acciones={gestionar ? (area) => <AccionesArea key={area.actualizadoEn} area={area} editar={() => setEdicion(area)} /> : undefined}
      className="min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere]" /></ZonaResultados>
    {edicion !== undefined ? <FormularioArea key={edicion?.actualizadoEn ?? "nueva"} area={edicion} cerrar={() => setEdicion(undefined)} /> : null}
  </div>;
}
