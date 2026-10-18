"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { DrawerFormulario } from "@/components/comunes/DrawerFormulario";
import { EsqueletoFilas } from "@/components/comunes/Esqueletos";
import { Button } from "@/components/ui/button";
import { useParametrosUrl } from "@/lib/listas/useParametrosUrl";
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

function SesionCreador({ abierto, clienteId: inicial, puedeCrearCliente, cerrar }: {
  abierto: boolean; clienteId: string; puedeCrearCliente: boolean; cerrar: () => void;
}) {
  const router = useRouter();
  const { datos, setDatos, error } = usePreparacion();
  const [modal, setModal] = useState(false);
  const [clienteId, setClienteId] = useState(inicial);
  function guardar(id: string, numero?: string) {
    cerrar();
    toast.success(`Cotización ${numero ?? id} creada`, {
      action: { label: "Agregar ítems", onClick: () => router.push(`/cotizaciones/${id}/editar`) },
    });
    startTransition(() => router.refresh());
  }
  function agregarCliente(cliente: { id: string; nombre: string }) {
    setDatos((actuales) => actuales ? { ...actuales, clientes: [...actuales.clientes, cliente] } : actuales);
    setClienteId(cliente.id); setModal(false);
  }
  return <>
    <DrawerFormulario abierto={abierto} alCambiar={(valor) => { if (!valor && !modal) cerrar(); }}
      titulo="Nueva cotización" descripcion="Seleccione el cliente y describa el trabajo." bloquearExterior={modal}
      pie={<><Button type="button" variant="outline" onClick={cerrar} disabled={modal}>Cancelar</Button>
        <Button type="submit" form="nueva-cotizacion" disabled={!datos?.clientes.length || modal}>Crear cotización</Button></>}>
      {error ? <p role="alert">No se pudo preparar la cotización. Cierre e intente nuevamente.</p> : datos ?
        <NuevaCotizacion {...datos} clienteId={clienteId} variante="drawer" alGuardar={guardar}
          alCancelar={cerrar} puedeCrearCliente={puedeCrearCliente} alNuevoCliente={() => setModal(true)} /> :
        <div role="status" aria-label="Cargando cotización"><EsqueletoFilas cantidad={4} /></div>}
    </DrawerFormulario>
    <ModalClienteRapido abierto={modal} alCambiar={setModal} alGuardar={agregarCliente} />
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
