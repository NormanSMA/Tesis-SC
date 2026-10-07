import type { EtapaOrdenDto, ReferenciaOrden } from "@/modules/ordenes/tipos";
import type { EstadoOrden } from "@/generated/prisma/enums";

export type AreaDto = ReferenciaOrden & { activo: boolean; actualizadoEn: string };
export type PlantillaDto = { id: string; categoriaId: string; area: ReferenciaOrden; secuencia: number;
  nombre: string; activo: boolean; actualizadoEn: string };
export type EtapaTablero = EtapaOrdenDto & { orden: { id: string; numero: string; estado: EstadoOrden; fechaEntrega: string }; atrasada: boolean };
export type GrupoEtapas = { id: string | null; nombre: string; etapas: EtapaTablero[] };
export type TableroProduccion = { datos: EtapaTablero[]; porArea: GrupoEtapas[]; porResponsable: GrupoEtapas[]; total: number; pagina: 1 };
export type OpcionesProduccion = { areas: AreaDto[]; responsables: ReferenciaOrden[]; categorias: ReferenciaOrden[] };
