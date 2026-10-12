import { z } from "zod";

// Se ejecuta antes de hidratar la aplicación. Sin JIT, zod no prueba `new Function`, que la CSP
// (sin 'unsafe-eval') reportaba como violación en cada página con formularios.
z.config({ jitless: true });
