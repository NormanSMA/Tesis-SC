import { expect, it, vi } from "vitest";
import { can } from "@/core/autorizacion";
import { aOrdenDto, aOrdenFila } from "@/modules/ordenes/dto";

vi.mock("@/core/autorizacion", () => ({ can: vi.fn() }));

const actor = {} as Parameters<typeof aOrdenFila>[1];
const cliente = { id: "cliente", nombre: "Cliente de prueba", codigoCliente: "CLI-0001", tipo: "EMPRESA",
  telefono: null, correo: null, ruc: "RUC reservado", direccion: "Dirección reservada",
} as Parameters<typeof aOrdenDto>[0]["cliente"];
// La fixture cubre los campos leídos sin permiso de cotización.
const ficha = {
  id: "orden", numero: "OT-0001", estado: "PENDIENTE",
  categoria: { id: "categoria", nombre: "Impresión" }, responsable: null,
  cliente,
  cotizacion: { id: "cotizacion", numero: "COT-0001", asunto: null, cliente, items: [] },
  fechaEntrega: new Date("2099-01-01T00:00:00Z"),
  actualizadoEn: new Date("2026-01-01T00:00:00Z"), creadoEn: new Date("2026-01-01T00:00:00Z"),
  especificaciones: null, motivoCancelacion: null, fechaInicioReal: null, fechaEntregaReal: null, fechaCierre: null,
  etapas: [], consumosEstimados: [], eventosBitacora: [],
} as unknown as Parameters<typeof aOrdenDto>[0];

it.each([true, false])("devuelve codigoCliente en ficha y lista con cliente:ver=%s", (verCliente) => {
  vi.mocked(can).mockImplementation((_actor, permiso) => permiso === "cliente:ver" && verCliente);
  for (const convertir of [aOrdenDto, aOrdenFila]) {
    const cliente = convertir(ficha, actor).cliente;
    expect(cliente.codigoCliente).toBe("CLI-0001");
    if (verCliente) {
      expect(cliente).toMatchObject({ ruc: ficha.cliente.ruc, direccion: ficha.cliente.direccion });
    } else {
      expect(cliente).not.toHaveProperty("ruc");
      expect(cliente).not.toHaveProperty("direccion");
    }
  }
});
