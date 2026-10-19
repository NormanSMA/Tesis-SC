"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DrawerFormulario } from "@/components/comunes/DrawerFormulario";
import { EsqueletoFilas } from "@/components/comunes/Esqueletos";
import { Button } from "@/components/ui/button";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
import type { CotizacionDto, SelectoresEditor } from "../tipos";
import { EditorItems } from "./EditorItems";
import { ModalClienteRapido } from "./ModalClienteRapido";
import { NuevaCotizacion } from "./NuevaCotizacion";

const esquemaPreparacion = z.object({ datos: z.object({
  clientes: z.array(z.object({ id: z.string(), nombre: z.string() })), condiciones: z.string(),
}) });
type Preparacion = z.infer<typeof esquemaPreparacion>["datos"];

async function preparar(): Promise<Preparacion> {
  const respuesta = await fetch("/api/v1/cotizaciones/preparar");
  if (!respuesta.ok) throw new Error("No se pudo preparar la cotización.");
  return esquemaPreparacion.parse(await respuesta.json()).datos;
}

function usePreparacion() {
  const peticion = useRef<Promise<Preparacion> | null>(null);
  const [datos, setDatos] = useState<Preparacion | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let activo = true;
    peticion.current ??= preparar();
    peticion.current.then((datos) => { if (activo) setDatos(datos); }, () => { if (activo) setError(true); });
    return () => { activo = false; };
  }, []);
  return { datos, setDatos, error };
}

async function leerDatos<T>(url: string, signal: AbortSignal): Promise<T> {
  const respuesta = await fetch(url, { signal });
  if (!respuesta.ok) throw new Error("No se pudo cargar el editor. Intente nuevamente.");
  return (await respuesta.json()).datos;
}

// Una sola petición con los mismos datos que la página de edición (cotización y selectores del catálogo).
function cargarEditor(id: string, signal: AbortSignal) {
  return leerDatos<{ cotizacion: CotizacionDto; selectores: SelectoresEditor }>(`/api/v1/cotizaciones/${id}/editor`, signal);
}

function PasoItems({ id, pie, alGuardar }: { id: string; pie: HTMLElement | null; alGuardar: () => void }) {
  const [editor, setEditor] = useState<Awaited<ReturnType<typeof cargarEditor>> | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  function recargar() { setEditor(null); setError(false); setIntento((valor) => valor + 1); }
  useEffect(() => {
    const controlador = new AbortController();
    cargarEditor(id, controlador.signal).then((datos) => { if (!controlador.signal.aborted) setEditor(datos); },
      () => { if (!controlador.signal.aborted) setError(true); });
    return () => controlador.abort();
  }, [id, intento]);
  if (error) return <div role="alert">No se pudo cargar el editor.
    <Button type="button" onClick={recargar}>Reintentar</Button>
    <Button asChild variant="outline"><a href={`/cotizaciones/${id}/editar`}>Abrir editor completo</a></Button>
  </div>;
  return editor ? <EditorItems {...editor} variante="drawer" pie={pie} alGuardar={alGuardar} alRecargar={recargar} /> :
    <div role="status" aria-label="Cargando cotización"><EsqueletoFilas cantidad={4} /></div>;
}

function useCreacion() {
  const router = useRouter();
  const { construir } = useParametrosUrl();
  const [creada, setCreada] = useState<{ id: string; numero?: string } | null>(null);
  // Al guardar: replace deja al router en la URL sin ?crear (cierra el drawer) y refresh trae la lista fresca.
  // Con solo history.replaceState + refresh, Next descartaba la respuesta: su URL registrada seguía con ?crear=1.
  // Con solo replace, Next reutilizaba la página en caché y no pedía la lista.
  function finalizar() {
    if (!creada) return;
    toast.success(`Cotización ${creada.numero ?? creada.id} creada`, {
      action: { label: "Abrir editor", onClick: () => router.push(`/cotizaciones/${creada.id}/editar`) },
    });
    startTransition(() => {
      router.replace(construir({ crear: null, clienteId: null }), { scroll: false });
      router.refresh();
    });
  }
  return { creada, finalizar, guardar: (id: string, numero?: string) => setCreada({ id, numero }) };
}

function SesionCreador({ abierto, clienteId: inicial, puedeCrearCliente, cerrar }: {
  abierto: boolean; clienteId: string; puedeCrearCliente: boolean; cerrar: () => void;
}) {
  const creacion = useCreacion();
  const [pie, setPie] = useState<HTMLElement | null>(null);
  const { datos, setDatos, error } = usePreparacion();
  const [modal, setModal] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [clienteId, setClienteId] = useState(inicial);
  function agregarCliente(cliente: { id: string; nombre: string }) {
    setDatos((actuales) => actuales ? { ...actuales, clientes: [...actuales.clientes, cliente] } : actuales);
    setClienteId(cliente.id); setModal(false);
  }
  return <>
    <DrawerFormulario abierto={abierto} alCambiar={(valor) => { if (!valor && !modal) cerrar(); }}
      titulo="Nueva cotización" descripcion={creacion.creada ? "Agregue los ítems y guarde el borrador." : "Seleccione el cliente y describa el trabajo."} bloquearExterior={modal}
      pie={creacion.creada ? <div ref={setPie} className="w-full" /> : <><Button type="button" variant="outline" onClick={cerrar} disabled={modal}>Cancelar</Button>
        <Button type="submit" form="nueva-cotizacion" disabled={!datos?.clientes.length || modal}>Crear cotización</Button></>}>
      {creacion.creada ? <PasoItems id={creacion.creada.id} pie={pie} alGuardar={creacion.finalizar} /> :
        error ? <p role="alert">No se pudo preparar la cotización. Cierre e intente nuevamente.</p> : datos ?
        <NuevaCotizacion {...datos} clienteId={clienteId} variante="drawer" alGuardar={creacion.guardar}
          alCancelar={cerrar} puedeCrearCliente={puedeCrearCliente} alNuevoCliente={(nombre) => { setNombreNuevo(nombre ?? ""); setModal(true); }} /> :
        <div role="status" aria-label="Cargando cotización"><EsqueletoFilas cantidad={4} /></div>}
    </DrawerFormulario>
    <ModalClienteRapido abierto={modal} alCambiar={setModal} alGuardar={agregarCliente} nombreInicial={nombreNuevo} />
  </>;
}

export function CreadorCotizacion({ puedeCrearCliente }: { puedeCrearCliente: boolean }) {
  const parametros = useSearchParams();
  const { superficial } = useParametrosUrl();
  const abierto = parametros.get("crear") === "1";
  const cerrar = () => superficial({ crear: null, clienteId: null }, "reemplazar");
  // Sigue montado unos milisegundos tras cerrar para que se vea la salida de 150 ms.
  const [montado, setMontado] = useState(abierto);
  if (abierto && !montado) setMontado(true);
  useEffect(() => {
    if (abierto || !montado) return;
    const espera = setTimeout(() => setMontado(false), 200);
    return () => clearTimeout(espera);
  }, [abierto, montado]);
  return montado ? <SesionCreador abierto={abierto} clienteId={parametros.get("clienteId") ?? ""}
    puedeCrearCliente={puedeCrearCliente} cerrar={cerrar} /> : null;
}
