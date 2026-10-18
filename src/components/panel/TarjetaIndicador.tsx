import { AnilloProgreso } from "@/components/comunes/AnilloProgreso";
import { TarjetaMetrica } from "@/components/comunes/TarjetaMetrica";
import type { IndicadorPanel } from "@/modules/panel/tipos";

export function TarjetaIndicador({ indicador }: { indicador: IndicadorPanel }) {
  const { numero, formato, meta } = indicador;
  return (
    <TarjetaMetrica
      etiqueta={indicador.etiqueta} numero={numero} texto={indicador.valor} formato={formato}
      tendencia={indicador.tendencia} mejorSiBaja={indicador.mejorSiBaja}
      pie={indicador.comparacion?.texto ?? indicador.contexto}
      alerta={indicador.alerta} destino={indicador.destino}
      adorno={formato === "porcentaje" && meta !== undefined && numero !== null ? (
        <AnilloProgreso valor={numero} meta={meta} radio={23} grosor={4}
          etiqueta={indicador.etiqueta} subtexto={`Meta ${meta} %`} />
      ) : undefined}
    />
  );
}
