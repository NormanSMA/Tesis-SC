// Lectura mixta: rampa a 200 VU durante 5 minutos. Cada VU usa su propia sesion.
import { sleep } from "k6";

import { pasoDeLectura, sesionDe, umbralesLectura } from "./comun.js";

export const options = {
  scenarios: {
    lectura: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 200 },
        { duration: "3m", target: 200 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: umbralesLectura,
};

export default function escenario() {
  pasoDeLectura(sesionDe(__VU - 1));
  sleep(0.5 + Math.random());
}
