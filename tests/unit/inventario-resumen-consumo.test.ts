import { describe, expect, it } from "vitest";
import { resumirConsumo } from "../../src/modules/inventario/resumen-consumo";

const primera = { clave: "1", materialId: "material-1", codigo: "VIN-01", nombre: "Vinil", cantidad: "2.500", unidad: "METRO" };
const segunda = { clave: "2", materialId: "material-2", codigo: "PAP-01", nombre: "Papel", cantidad: "3", unidad: "PLIEGO" };

describe("resumirConsumo", () => {
  it("ignora líneas sin material o cantidad", () => {
    expect(resumirConsumo([
      { ...primera, materialId: "", cantidad: "" },
      { ...primera, materialId: " " },
      { ...primera, cantidad: " " },
      primera,
    ])).toEqual([{ clave: "1", codigo: "VIN-01", nombre: "Vinil", cantidad: "2.500", unidad: "METRO" }]);
    expect(resumirConsumo([])).toEqual([]);
  });

  it("conserva el orden del formulario, las cadenas decimales y las unidades", () => {
    const lineas = Object.freeze([Object.freeze(segunda), Object.freeze(primera)]);
    expect(resumirConsumo(lineas)).toEqual([
      { clave: "2", codigo: "PAP-01", nombre: "Papel", cantidad: "3", unidad: "PLIEGO" },
      { clave: "1", codigo: "VIN-01", nombre: "Vinil", cantidad: "2.500", unidad: "METRO" },
    ]);
  });
});
