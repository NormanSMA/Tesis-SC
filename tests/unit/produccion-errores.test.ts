import { expect, it } from "vitest";
import { AppError } from "@/lib/errores";
import { traducirError } from "@/modules/produccion/errores";

for (const codigo of ["SC001", "SC002", "SC003", "SC004", "SC005", "SC006", "SC007"]) {
  it(`traduce ${codigo} con mensaje legible y 409`, () => {
    expect(() => traducirError({ code: "P2010", meta: { code: codigo } })).toThrow(expect.objectContaining({
      status: 409, codigo, mensaje: expect.any(String) }));
  });
}
it("conserva errores de negocio y propaga errores desconocidos", () => {
  const error = new AppError({ status: 409, codigo: "ETAPA_SIN_RESPONSABLE", mensaje: "Asigne un responsable." });
  expect(() => traducirError(error)).toThrow(error);
  const desconocido = new Error("Error de conexión");
  expect(() => traducirError(desconocido)).toThrow(desconocido);
});
for (const codigo of ["40P01", "40001"]) {
  it(`traduce ${codigo} a conflicto de concurrencia`, () => {
    expect(() => traducirError({ meta: { code: codigo } })).toThrow(expect.objectContaining({ status: 409, codigo: "CONFLICTO_CONCURRENCIA" }));
  });
}
