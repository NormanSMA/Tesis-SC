"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

type Propiedades = {
  abierto: boolean; alCerrar: () => void; alConfirmar: () => void; titulo: string;
  descripcion: string; etiqueta: string; enviando: boolean; children?: ReactNode;
};

export function ConfirmacionAdmin(props: Propiedades) {
  return (
    <Dialog open={props.abierto} onOpenChange={(abierto) => { if (!abierto && !props.enviando) props.alCerrar(); }}>
      <DialogContent showCloseButton={false} className="max-h-[85dvh] overflow-y-auto">
        <DialogTitle>{props.titulo}</DialogTitle>
        <DialogDescription>{props.descripcion}</DialogDescription>
        {props.children}
        <DialogFooter>
          <Button type="button" className="min-h-10" variant="outline" disabled={props.enviando} onClick={props.alCerrar} autoFocus>
            Cancelar
          </Button>
          <Button type="button" className="min-h-10" disabled={props.enviando} onClick={props.alConfirmar}>
            {props.enviando ? "Guardando…" : props.etiqueta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
