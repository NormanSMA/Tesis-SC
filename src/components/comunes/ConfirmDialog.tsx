"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PropiedadesConfirmacion = {
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
  titulo: string;
  descripcion: string;
  etiquetaConfirmar?: string;
  etiquetaCancelar?: string;
  /** "peligro" para acciones destructivas o irreversibles. */
  tono?: "normal" | "peligro";
  cargando?: boolean;
  alConfirmar: () => void;
};

export function ConfirmDialog({
  abierto,
  alCambiarAbierto,
  titulo,
  descripcion,
  etiquetaConfirmar = "Confirmar",
  etiquetaCancelar = "Cancelar",
  tono = "normal",
  cargando = false,
  alConfirmar,
}: PropiedadesConfirmacion) {
  return (
    <Dialog open={abierto} onOpenChange={(valor) => !cargando && alCambiarAbierto(valor)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={cargando} onClick={() => alCambiarAbierto(false)}>
            {etiquetaCancelar}
          </Button>
          <Button variant={tono === "peligro" ? "destructive" : "default"} disabled={cargando} onClick={alConfirmar}>
            {cargando ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            {etiquetaConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
