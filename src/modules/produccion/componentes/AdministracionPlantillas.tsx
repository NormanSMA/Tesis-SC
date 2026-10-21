"use client";

import { useState, type FormEvent } from "react";
import { DataTable, type ColumnaTabla } from "@/components/comunes/DataTable";
import { ConfirmDialog } from "@/components/comunes/ConfirmDialog";
import { EmptyState } from "@/components/comunes/EmptyState";
import { InsigniaPunto } from "@/components/comunes/FilaOperativa";
import { ZonaResultados } from "@/components/comunes/ZonaResultados";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ReferenciaOrden } from "@/modules/ordenes/tipos";
import type { PlantillaDto } from "../tipos";
import { useSolicitudProduccion } from "../useSolicitudProduccion";
import { AvisoProduccion, SeleccionProduccion, TextoProduccion } from "./CamposProduccion";
import { FiltrosCatalogoProduccion, type ConteosCatalogo } from "./FiltrosCatalogoProduccion";

const columnas: ColumnaTabla<PlantillaDto>[] = [
  { id: "nombre", encabezado: "Posición y etapa", principal: true, celda: (plantilla) => <span className="flex min-w-0 items-center gap-3">
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-semibold text-primary ring-1 ring-indigo-100 tabular-nums">
      {plantilla.secuencia}</span>
    <span className="min-w-0 font-medium text-slate-900"><span className="sr-only">{plantilla.secuencia}. </span>{plantilla.nombre}</span></span> },
  { id: "area", encabezado: "Área", celda: (plantilla) => plantilla.area.nombre },
  { id: "estado", encabezado: "Estado", celda: (plantilla) => <InsigniaPunto tono={plantilla.activo ? "exito" : "neutro"}>{plantilla.activo ? "Activa" : "Archivada"}</InsigniaPunto> },
];
type Formulario = { categoriaId: string; areas: ReferenciaOrden[]; plantilla: PlantillaDto | null; cerrar: () => void };

function CamposPlantilla({ entrada, areas, campos, cambiar }: { entrada: { nombre: string; areaId: string; secuencia: string };
  areas: ReferenciaOrden[]; campos: Record<string, string>; cambiar: (campo: "nombre" | "areaId" | "secuencia", valor: string) => void;
}) {
  return <><TextoProduccion id="nombre-plantilla" etiqueta="Nombre de la etapa" valor={entrada.nombre}
    requerido maximo={80} alCambiar={(valor) => cambiar("nombre", valor)} error={campos.nombre} />
    <SeleccionProduccion id="area-plantilla" etiqueta="Área" valor={entrada.areaId} opciones={areas}
      requerido alCambiar={(valor) => cambiar("areaId", valor)} error={campos.areaId} />
    <TextoProduccion id="posicion-plantilla" etiqueta="Posición" tipo="number" minimo={1} valor={entrada.secuencia}
      alCambiar={(valor) => cambiar("secuencia", valor)} error={campos.secuencia} />
    <p className="text-sm text-muted-foreground">Deje la posición vacía para agregar al final.</p></>;
}

function FormularioPlantilla({ categoriaId, areas, plantilla, cerrar }: Formulario) {
  const [entrada, setEntrada] = useState({ nombre: plantilla?.nombre ?? "", areaId: plantilla?.area.id ?? "",
    secuencia: plantilla ? String(plantilla.secuencia) : "" });
  const solicitud = useSolicitudProduccion("formulario-plantilla");
  const opciones = plantilla && !areas.some((area) => area.id === plantilla.area.id)
    ? [...areas, { ...plantilla.area, nombre: `${plantilla.area.nombre} (área actual)` }] : areas;
  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const cuerpo = { nombre: entrada.nombre, areaId: entrada.areaId,
      ...(entrada.secuencia ? { secuencia: Number(entrada.secuencia) } : {}),
      ...(plantilla ? { version: plantilla.actualizadoEn } : {}) };
    if (await solicitud.enviar({ url: plantilla ? `/api/v1/plantillas/${plantilla.id}` : `/api/v1/categorias/${categoriaId}/plantillas`,
      metodo: plantilla ? "PATCH" : "POST", cuerpo })) cerrar();
  }
  return <Dialog open onOpenChange={(valor) => !valor && !solicitud.enviando && cerrar()}>
    <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{plantilla ? "Editar plantilla" : "Agregar plantilla"}</DialogTitle>
      <DialogDescription>Los cambios se aplican a las órdenes futuras.</DialogDescription></DialogHeader>
      <form id="formulario-plantilla" onSubmit={guardar} className="space-y-4"><AvisoProduccion {...solicitud} />
        <fieldset disabled={solicitud.enviando} className="min-w-0 space-y-4"><CamposPlantilla entrada={entrada} areas={opciones}
          campos={solicitud.campos} cambiar={(campo, valor) => setEntrada({ ...entrada, [campo]: valor })} /></fieldset>
        <DialogFooter><Button type="button" variant="outline" disabled={solicitud.enviando} onClick={cerrar}>Volver</Button>
          <Button type="submit" disabled={solicitud.enviando}>{plantilla ? "Guardar cambios" : "Agregar plantilla"}</Button></DialogFooter>
      </form></DialogContent>
  </Dialog>;
}

function AccionesPlantilla({ plantilla, editar }: { plantilla: PlantillaDto; editar: () => void }) {
  const [confirmar, setConfirmar] = useState(false);
  const solicitud = useSolicitudProduccion();
  async function archivar() {
    await solicitud.enviar({ url: `/api/v1/plantillas/${plantilla.id}/archivar`, metodo: "POST", cuerpo: { version: plantilla.actualizadoEn } });
    setConfirmar(false);
  }
  return <div className="space-y-2 text-left"><AvisoProduccion {...solicitud} /><div className="flex flex-wrap gap-2">
    <Button variant="outline" disabled={solicitud.enviando} aria-label={`Editar plantilla: ${plantilla.nombre}`} onClick={editar}>Editar</Button>
    {plantilla.activo ? <Button variant="outline" disabled={solicitud.enviando}
      aria-label={`Archivar plantilla: ${plantilla.nombre}`} onClick={() => setConfirmar(true)}>Archivar</Button> : null}
  </div>{confirmar ? <ConfirmDialog abierto alCambiarAbierto={setConfirmar} titulo="Archivar plantilla"
    descripcion={`Archive ${plantilla.nombre}. Las etapas existentes se conservan.`} etiquetaConfirmar="Archivar"
    cargando={solicitud.enviando} alConfirmar={archivar} /> : null}</div>;
}

export function AdministracionPlantillas({ categoriaId, categorias, plantillas, conteos, areas, gestionar }: {
  categoriaId: string; categorias: ReferenciaOrden[]; plantillas: PlantillaDto[]; conteos: ConteosCatalogo;
  areas: ReferenciaOrden[]; gestionar: boolean;
}) {
  const [edicion, setEdicion] = useState<PlantillaDto | null | undefined>(undefined);
  const filtrado = conteos.todas > plantillas.length;
  const vacio = <EmptyState titulo={filtrado ? "Sin resultados" : "Sin plantillas"}
    descripcion={filtrado ? "Ninguna plantilla coincide con la consulta. Pruebe otros términos o quite los filtros."
      : "Agregue la primera etapa de esta categoría."} />;
  return <div className="min-w-0">
    <FiltrosCatalogoProduccion busqueda="Buscar plantillas" marcador="Buscar por etapa o área" conteos={conteos} categorias={categorias}>
      {gestionar ? <Button type="button" className="h-10" onClick={() => setEdicion(null)}>Agregar plantilla</Button> : null}
    </FiltrosCatalogoProduccion>
    <ZonaResultados><DataTable titulo="Plantillas de etapas" columnas={columnas} filas={plantillas} idFila={(plantilla) => plantilla.id} vacio={vacio}
      acciones={gestionar ? (plantilla) => <AccionesPlantilla key={plantilla.actualizadoEn} plantilla={plantilla}
        editar={() => setEdicion(plantilla)} /> : undefined}
      className="min-w-0 [&_table]:table-fixed [&_th]:whitespace-normal [&_td]:whitespace-normal [&_td]:break-words [&_td]:[overflow-wrap:anywhere]" /></ZonaResultados>
    {edicion !== undefined ? <FormularioPlantilla key={edicion?.actualizadoEn ?? "nueva"} categoriaId={categoriaId}
      areas={areas} plantilla={edicion} cerrar={() => setEdicion(undefined)} /> : null}
  </div>;
}
