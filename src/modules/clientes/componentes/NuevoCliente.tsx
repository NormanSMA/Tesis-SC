"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ModalClienteRapido } from "@/modules/cotizaciones/componentes/ModalClienteRapido";

/**
 * Alta rápida en modal y enlace al formulario completo.
 * El modal devuelve el foco al elemento con id "nuevo-cliente-lista"; solo el botón del encabezado lo lleva (id único).
 */
export function NuevoCliente({ conEnlace = true, devolverFoco = false }: { conEnlace?: boolean; devolverFoco?: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  return <>
    <Button id={devolverFoco ? "nuevo-cliente-lista" : undefined} type="button" onClick={() => setAbierto(true)}>
      <Plus aria-hidden="true" />Nuevo cliente
    </Button>
    <ModalClienteRapido abierto={abierto} alCambiar={setAbierto} descripcion="Datos básicos; complete el resto en la ficha." idRetorno="nuevo-cliente-lista" enlaceCompleto={conEnlace ? "/clientes/nuevo" : undefined} alGuardar={(cliente) => {
      setAbierto(false);
      router.refresh();
      toast.success(`Cliente creado: ${cliente.nombre}`, {
        action: { label: "Abrir ficha", onClick: () => router.push(`/clientes/${cliente.id}`) },
      });
    }} />
  </>;
}
