import { test } from "node:test";
import assert from "node:assert/strict";
import { huellaSql, separarHallazgos, validarHistoricas } from "./migraciones.mjs";

const sql = "ALTER TABLE ejemplo ADD COLUMN nombre text;\n";
const revisadas = { archivos: [{ archivo: "vieja.sql", sha256Lf: huellaSql(sql), hallazgos: [{ regla: "require-lock-timeout", linea: 0, columna: 0 }] }] };
const conocido = { file: "vieja.sql", rule_name: "require-lock-timeout", line: 0, column: 0 };

test("rechaza reescrituras de migraciones históricas, admitiendo solo diferencias CRLF", () => {
  assert.doesNotThrow(() => validarHistoricas({ revisadas, leer: () => sql.replace(/\n/g, "\r\n") }));
  assert.throws(() => validarHistoricas({ revisadas, leer: () => sql + "DROP TABLE ejemplo;" }), /histórica modificada/);
});

test("la revisión histórica no exonera otra regla, ubicación o migración nueva", () => {
  const nuevos = [{ ...conocido, file: "nueva.sql" }, { ...conocido, rule_name: "ban-drop-table" },
    { ...conocido, line: 1 }, { ...conocido, column: 1 }];
  assert.deepEqual(separarHallazgos({ revisadas, hallazgos: [conocido, ...nuevos] }), nuevos);
});

test("rechaza registros de revisión sin ubicación exacta", () => {
  const incompleta = { archivos: [{ ...revisadas.archivos[0], hallazgos: [{ regla: "require-lock-timeout", columna: 0 }] }] };
  assert.throws(() => validarHistoricas({ revisadas: incompleta, leer: () => sql }), /revisión histórica incompleta/i);
});
