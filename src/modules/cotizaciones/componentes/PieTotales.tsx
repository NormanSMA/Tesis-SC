"use client";

import { CircleAlert } from "lucide-react";
import { useWatch, type Control } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { calcularVista } from "../calculo";
import type { EntradaReemplazarItems } from "../schema";
import type { CotizacionDto, SelectoresEditor } from "../tipos";
import { TotalesCotizacion } from "./TotalesCotizacion";

export function PieTotales({ control, cotizacion, selectores }: {
  control: Control<EntradaReemplazarItems>; cotizacion: CotizacionDto; selectores: SelectoresEditor;
}) {
  const items = useWatch({ control, name: "items" });
  const vista = calcularVista({ items, originales: cotizacion.items, selectores,
    descuento: cotizacion.descuento, descuentoPct: cotizacion.descuentoPct, tasaImpuesto: cotizacion.tasaImpuesto });
  return vista.totales ? <TotalesCotizacion totales={{ ...vista.totales, descuentoPct: cotizacion.descuentoPct }}
    moneda={cotizacion.moneda} /> : <Alert>
    <CircleAlert aria-hidden="true" /><AlertTitle>Revise los campos para calcular los totales</AlertTitle>
    <AlertDescription>{vista.errores.descuento ?? vista.errores.descuentoPct ?? "Complete productos, cantidades y líneas de costo."}</AlertDescription>
  </Alert>;
}
