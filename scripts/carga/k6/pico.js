// Pico: de 0 a 1000 VU en 60 s y bajada. Mismas lecturas que lectura-mixta, un usuario por VU.
import { sleep } from "k6";

import { pasoDeLectura, sesionDe, umbralesLectura } from "./comun.js";

export const options = {
  scenarios: {
    pico: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "60s", target: 1000 },
        { duration: "30s", target: 1000 },
        { duration: "60s", target: 0 },
      ],
      gracefulRampDown: "15s",
    },
  },
  thresholds: umbralesLectura,
};

export default function escenario() {
  pasoDeLectura(sesionDe(__VU - 1));
  sleep(0.5 + Math.random());
}
