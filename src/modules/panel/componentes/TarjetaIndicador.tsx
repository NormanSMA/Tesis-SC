import {
  AlarmClock, ArrowLeftRight, Banknote, CircleCheck, CirclePause, Hammer, Layers, ListChecks, PackageMinus,
  PackageOpen, Send, Target, Timer, Truck, UserPlus, UserRoundX, Warehouse, type LucideIcon,
} from "lucide-react";

import { AnilloProgreso } from "@/components/comunes/AnilloProgreso";
import { TarjetaMetrica } from "@/components/comunes/TarjetaMetrica";
import type { IndicadorPanel } from "@/modules/panel/tipos";

// Ícono por indicador; uno desconocido usa el ícono genérico de la tarjeta.
const ICONOS: Record<string, LucideIcon> = {
  "monto-aprobado": Banknote, "tasa-aprobacion": Target, "en-produccion": Hammer, "ordenes-atrasadas": AlarmClock,
  "por-iniciar": CirclePause, "sin-responsable": UserRoundX, "entregas-proximas": Truck,
  enviadas: Send, "por-vencer": Timer, "aprobadas-mes": CircleCheck, "clientes-nuevos": UserPlus,
  "mis-etapas-en-curso": Layers, "mis-etapas-pendientes": ListChecks, "completadas-hoy": CircleCheck,
  "mis-etapas-atrasadas": AlarmClock, "materiales-bajo-minimo": PackageMinus, "consumos-hoy": PackageOpen,
  "valor-inventario": Warehouse, "movimientos-semana": ArrowLeftRight,
};

// Si la tendencia ya muestra el cambio porcentual, el pie da el contexto (valor anterior) y no lo repite.
function textoPie(indicador: IndicadorPanel): string {
  if (indicador.tendencia) return indicador.contexto;
  return indicador.comparacion?.texto ?? indicador.contexto;
}

export function TarjetaIndicador({ indicador, destacada = false }: { indicador: IndicadorPanel; destacada?: boolean }) {
  const { numero, formato, meta } = indicador;
  return (
    <TarjetaMetrica
      etiqueta={indicador.etiqueta} numero={numero} texto={indicador.valor} formato={formato}
      tendencia={indicador.tendencia} mejorSiBaja={indicador.mejorSiBaja}
      pie={textoPie(indicador)} icono={ICONOS[indicador.id]} destacada={destacada}
      alerta={indicador.alerta} destino={indicador.destino}
      adorno={formato === "porcentaje" && meta !== undefined && numero !== null ? (
        <AnilloProgreso valor={numero} meta={meta} radio={22} grosor={4}
          etiqueta={indicador.etiqueta} centro={`${meta} %`} subtexto="meta" />
      ) : undefined}
    />
  );
}
