import { expect, it } from "vitest";

import type { Cliente } from "@/generated/prisma/client";
import { aClienteDto, aClienteFila } from "@/modules/clientes/dto";

it("conserva el código asignado por la base en ficha y lista", () => {
  const fecha = new Date("2026-10-10T12:00:00.000Z");
  const cliente: Cliente = {
    id: "cliente", codigoCliente: "CLI-0001", nombre: "Cliente", tipo: "PERSONA",
    ruc: null, contactoPrincipal: null, telefono: "8888 0000", correo: null,
    direccion: null, notas: null, activo: true, creadoEn: fecha, actualizadoEn: fecha,
  };
  expect(aClienteDto(cliente).codigoCliente).toBe("CLI-0001");
  expect(aClienteFila(cliente, undefined).codigoCliente).toBe("CLI-0001");
});
