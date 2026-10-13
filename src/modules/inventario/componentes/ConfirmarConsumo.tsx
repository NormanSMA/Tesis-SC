"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ResumenConsumo } from "../resumen-consumo";

export function ConfirmarConsumo({ abierto, numeroOrden, lineas, cerrar, confirmar, devolverFoco }: {
  abierto: boolean;
  numeroOrden: string;
  lineas: ResumenConsumo[];
  cerrar: () => void;
  confirmar: () => void;
  devolverFoco: () => void;
}) {
  return <Dialog open={abierto} onOpenChange={(valor) => { if (!valor) cerrar(); }}>
    <DialogContent showCloseButton={false} onCloseAutoFocus={(evento) => { evento.preventDefault(); devolverFoco(); }}>
      <DialogHeader>
        <DialogTitle>Confirmar consumo</DialogTitle>
        <DialogDescription>Orden: {numeroOrden}. Revise los materiales antes de registrar el consumo.</DialogDescription>
      </DialogHeader>
      <ul aria-label="Materiales por consumir" className="max-h-[50vh] space-y-3 overflow-y-auto">
        {lineas.map((linea) => <li key={linea.clave} className="min-w-0 break-words">
          <p className="font-medium">{linea.codigo} — {linea.nombre}</p>
          <p>{linea.cantidad} {linea.unidad}</p>
        </li>)}
      </ul>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={cerrar}>Cancelar</Button>
        <Button type="button" onClick={confirmar}>Confirmar consumo</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
