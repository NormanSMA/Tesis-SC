"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/comunes/ConfirmDialog";
import { Button } from "@/components/ui/button";

type PropiedadesAcciones = { id: string; nombre: string; activo: boolean; version: string };

type CuerpoError = { error?: { codigo?: string; mensaje?: string } };

const MENSAJE_RED = "No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.";

async function enviarCambio(url: string, version: string): Promise<string | null> {
  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version }),
    });
    if (respuesta.ok) return null;
    const cuerpo = (await respuesta.json().catch(() => ({}))) as CuerpoError;
    return cuerpo.error?.mensaje ?? "No se pudo completar la acción.";
  } catch {
    return MENSAJE_RED;
  }
}

export function AccionesEstado({ id, nombre, activo, version }: PropiedadesAcciones) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function confirmar(): Promise<void> {
    setCargando(true);
    const fallo = await enviarCambio(`/api/v1/clientes/${id}/${activo ? "archivar" : "reactivar"}`, version);
    if (fallo) toast.error(fallo);
    else toast.success(activo ? "Cliente archivado." : "Cliente reactivado.");
    setCargando(false);
    setAbierto(false);
    router.refresh();
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setAbierto(true)}>
        {activo ? <Archive aria-hidden="true" /> : <ArchiveRestore aria-hidden="true" />}
        {activo ? "Archivar" : "Reactivar"}
      </Button>
      <ConfirmDialog
        abierto={abierto}
        alCambiarAbierto={setAbierto}
        titulo={activo ? "Archivar cliente" : "Reactivar cliente"}
        descripcion={
          activo
            ? `«${nombre}» dejará de poder elegirse en cotizaciones nuevas. Su historial se conserva y puede reactivarlo cuando quiera.`
            : `«${nombre}» volverá a poder elegirse en cotizaciones nuevas.`
        }
        etiquetaConfirmar={activo ? "Archivar" : "Reactivar"}
        tono={activo ? "peligro" : "normal"}
        cargando={cargando}
        alConfirmar={confirmar}
      />
    </>
  );
}
