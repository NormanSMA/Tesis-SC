"use client";

import { useSyncExternalStore } from "react";

const sinSuscripcion = () => () => {};

// Falso en el servidor y durante la hidratación, verdadero después: react-hook-form escribe los valores
// iniciales al hidratar y pisaría lo que la persona alcance a escribir antes.
export function useHidratado(): boolean {
  return useSyncExternalStore(sinSuscripcion, () => true, () => false);
}
