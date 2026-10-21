import { test as setup } from "@playwright/test";
import dotenv from "dotenv";

import { entrarYGuardar, PERFILES } from "./ayudas";

dotenv.config();

// Una sesión por perfil al inicio de cada corrida: los specs la reutilizan con usarSesion.
for (const perfil of PERFILES) {
  setup(`guarda la sesión de ${perfil.codigo}`, async ({ page }) => {
    await entrarYGuardar(page, perfil);
  });
}
