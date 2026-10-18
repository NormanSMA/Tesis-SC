import { FileText, Package, TrendingUp } from "lucide-react";
import { Suspense } from "react";

import { AnilloProgreso } from "@/components/comunes/AnilloProgreso";
import { BarraProgresoAnimada } from "@/components/comunes/BarraProgresoAnimada";
import { BuscadorEnVivo } from "@/components/comunes/BuscadorEnVivo";
import { EsqueletoFilas, EsqueletoTabla, EsqueletoTarjetas } from "@/components/comunes/Esqueletos";
import { EstadoBadge } from "@/components/comunes/EstadoBadge";
import { FilaOperativa } from "@/components/comunes/FilaOperativa";
import { FiltroSegmentado } from "@/components/comunes/FiltroSegmentado";
import { ListaEscalonada } from "@/components/comunes/ListaEscalonada";
import { TarjetaMetrica } from "@/components/comunes/TarjetaMetrica";

import { Seccion } from "./Seccion";

/** Casos límite de R9: cero, nulo, negativo, más de 100 % y números grandes. */
export function SeccionDatosVivos() {
  return (
    <Seccion id="datos-vivos" titulo="Datos vivos" descripcion="Métricas con conteo, barras, anillos, feed operativo, búsqueda en vivo y esqueletos.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <TarjetaMetrica etiqueta="Monto aprobado" numero={284500} texto="C$ 284,500" formato="moneda" icono={TrendingUp}
          tendencia={{ direccion: "sube", texto: "6 %" }} pie="vs. septiembre: C$ 268,400" />
        <TarjetaMetrica etiqueta="Órdenes atrasadas" numero={3} texto="3" formato="entero" alerta mejorSiBaja
          tendencia={{ direccion: "sube", texto: "2" }} pie="Fecha de entrega anterior a hoy" />
        <TarjetaMetrica etiqueta="Tasa de aprobación" numero={64} texto="64 %" formato="porcentaje" pie="Meta 70 %"
          adorno={<AnilloProgreso valor={64} meta={70} etiqueta="Tasa de aprobación" radio={20} grosor={5} />} />
        <TarjetaMetrica etiqueta="Valor del inventario" numero={12_450_000} texto="C$ 12,450,000" formato="moneda" pie="Número grande compacto" />
        <TarjetaMetrica etiqueta="Sin dato" numero={null} texto="—" formato="entero" pie="Valor nulo" />
        <TarjetaMetrica etiqueta="Cero" numero={0} texto="0" formato="entero" pie="Sin comparación" />
        <TarjetaMetrica etiqueta="Negativo" numero={-1500} texto="-C$ 1,500" formato="moneda" tendencia={{ direccion: "baja", texto: "12 %" }} />
        <TarjetaMetrica etiqueta="Más de 100 %" numero={135} texto="135 %" formato="porcentaje"
          adorno={<AnilloProgreso valor={135} etiqueta="Cumplimiento" radio={20} grosor={5} tono="exito" />} />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm lg:col-span-8">
          <ListaEscalonada>
            <FilaOperativa destino="#" icono={FileText} codigo="COT-2026-0042" insignia={<EstadoBadge tipo="cotizacion" estado="ENVIADA" />}
              titulo="Distribuidora Central" detalle="Rótulo luminoso" valor="C$ 18,400" tiempo="Sin respuesta hace 4 días" critica />
            <FilaOperativa destino="#" icono={FileText} codigo="COT-2026-0040" insignia={<EstadoBadge tipo="cotizacion" estado="AJUSTE_SOLICITADO" />}
              titulo="Tecnologías de América" valor="US$ 950" tiempo="Hace 2 h" />
            <FilaOperativa destino="#" icono={Package} codigo="MAT-014" titulo="Vinil blanco mate" detalle="Existencia 2 de 10 m²" tiempo="Bajo mínimo" critica />
          </ListaEscalonada>
        </div>
        <div className="space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm lg:col-span-4">
          <BarraProgresoAnimada valor={3} total={5} etiqueta="Etapas completadas" texto="3 de 5" />
          <BarraProgresoAnimada valor={2} total={10} etiqueta="Existencia frente a mínimo" texto="2 de 10" tono="advertencia" />
          <BarraProgresoAnimada valor={0} total={4} etiqueta="Sin avance" texto="0 de 4" />
          <BarraProgresoAnimada valor={7} total={0} etiqueta="Total cero" texto="7 de 0" />
        </div>
      </div>
      <Suspense fallback={<EsqueletoTabla filas={0} />}>
        <div className="flex flex-wrap items-center gap-3">
          <BuscadorEnVivo etiqueta="Buscar en la galería" parametro="demo-q" />
          <FiltroSegmentado etiqueta="Estado" parametro="demo-estado" valorTodos="todas"
            opciones={[{ valor: "todas", etiqueta: "Todas", conteo: 22 }, { valor: "BORRADOR", etiqueta: "Borrador", conteo: 4 },
              { valor: "ENVIADA", etiqueta: "Enviada", conteo: 5 }, { valor: "APROBADA", etiqueta: "Aprobada", conteo: 8 },
              { valor: "por-vencer", etiqueta: "Por vencer", conteo: 1 }]} />
        </div>
      </Suspense>
      <EsqueletoTarjetas />
      <EsqueletoFilas cantidad={3} />
    </Seccion>
  );
}
