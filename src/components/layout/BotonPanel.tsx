"use client";

import { useReducedMotion } from "motion/react";
import { useRef, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";

import type { ControlIcono, IconoAnimado } from "./icono-animado";

type PropiedadesBoton = { Icono: IconoAnimado } & Omit<ComponentProps<typeof Button>, "children">;

/** Botón de ícono cuyo dibujo se anima al pasar el mouse o al enfocarlo (salvo que se pida reducir el movimiento). */
export function BotonPanel({ Icono, ...resto }: PropiedadesBoton) {
  const control = useRef<ControlIcono>(null);
  const reducir = useReducedMotion();
  const animar = () => {
    if (!reducir) control.current?.startAnimation();
  };
  return (
    <Button
      {...resto}
      onMouseEnter={animar}
      onFocus={animar}
      onMouseLeave={() => control.current?.stopAnimation()}
      onBlur={() => control.current?.stopAnimation()}
    >
      <Icono ref={control} size={20} aria-hidden="true" />
    </Button>
  );
}
