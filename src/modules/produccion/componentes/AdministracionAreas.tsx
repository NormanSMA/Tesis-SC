"use client";

import { useState, type FormEvent } from "react";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { ConfirmDialog } from "@/components/comunes/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AreaDto } from "../tipos";
import { useSolicitudProduccion } from "../useSolicitudProduccion";
import { AvisoProduccion, TextoProduccion } from "./CamposProduccion";

const columnas: ColumnaTabla<AreaDto>[] = [
  { id: "nombre", encabezado: "Área", principal: true, celda: (area) => area.nombre },
  { id: "estado", encabezado: "Estado", celda: (area) => area.activo ? "Activa" : "Archivada" },
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
    <Button size="sm" variant="outline" disabled={solicitud.enviando} aria-label={`Editar área: ${area.nombre}`} onClick={editar}>Editar</Button>
    <Button size="sm" variant="outline" disabled={solicitud.enviando} aria-label={`${area.activo ? "Archivar" : "Reactivar"} área: ${area.nombre}`}
      onClick={() => setConfirmar(true)}>{area.activo ? "Archivar" : "Reactivar"}</Button>
  </div>{confirmar ? <ConfirmDialog abierto alCambiarAbierto={setConfirmar}
    titulo={`${area.activo ? "Archivar" : "Reactivar"} área`} descripcion={area.activo
      ? `Archive ${area.nombre} si no tiene plantillas activas ni etapas abiertas.` : `Reactive ${area.nombre} para utilizarla en producción.`}
    etiquetaConfirmar={area.activo ? "Archivar" : "Reactivar"} cargando={solicitud.enviando} alConfirmar={guardar} /> : null}</div>;
}

export function AdministracionAreas({ areas, gestionar }: { areas: AreaDto[]; gestionar: boolean }) {
  const [edicion, setEdicion] = useState<AreaDto | null | undefined>(undefined);
  return <div className="min-w-0 space-y-4">
    {gestionar ? <Button type="button" onClick={() => setEdicion(null)}>Crear área</Button> : null}
    <DataTable titulo="Áreas de producción" columnas={columnas} filas={areas} idFila={(area) => area.id}
      acciones={gestionar ? (area) => <AccionesArea key={area.actualizadoEn} area={area} editar={() => setEdicion(area)} /> : undefined}
      className="min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere]" />
    {edicion !== undefined ? <FormularioArea key={edicion?.actualizadoEn ?? "nueva"} area={edicion} cerrar={() => setEdicion(undefined)} /> : null}
  </div>;
}
