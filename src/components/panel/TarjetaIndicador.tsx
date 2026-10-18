import { AnilloProgreso } from "@/components/comunes/AnilloProgreso";
import { TarjetaMetrica } from "@/components/comunes/TarjetaMetrica";
import type { IndicadorPanel } from "@/modules/panel/tipos";

// Si la tendencia ya muestra el cambio porcentual, el pie da el contexto (valor anterior) y no lo repite.
function textoPie(indicador: IndicadorPanel): string {
  if (indicador.tendencia) return indicador.contexto;
  return indicador.comparacion?.texto ?? indicador.contexto;
}

export function TarjetaIndicador({ indicador }: { indicador: IndicadorPanel }) {
  const { numero, formato, meta } = indicador;
  return (
    <TarjetaMetrica
      etiqueta={indicador.etiqueta} numero={numero} texto={indicador.valor} formato={formato}
      tendencia={indicador.tendencia} mejorSiBaja={indicador.mejorSiBaja}
      pie={textoPie(indicador)}
      alerta={indicador.alerta} destino={indicador.destino}
      adorno={formato === "porcentaje" && meta !== undefined && numero !== null ? (
        <AnilloProgreso valor={numero} meta={meta} radio={22} grosor={4}
          etiqueta={indicador.etiqueta} centro={`${meta} %`} subtexto="meta" />
      ) : undefined}
    />
  );
}
