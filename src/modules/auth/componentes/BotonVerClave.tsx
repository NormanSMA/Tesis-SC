"use client";

import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export function BotonVerClave({ etiqueta, visible, alternar }: {
  etiqueta: string; visible: boolean; alternar: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="absolute top-1/2 right-1.5 size-8 -translate-y-1/2 rounded-lg text-slate-500"
      aria-label={`Mostrar ${etiqueta}`}
      aria-pressed={visible}
      onClick={alternar}
    >
      {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
    </Button>
  );
}
