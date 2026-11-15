import { z } from "zod";

export const esquemaSeleccionProducto = z.object({ id: z.uuid(), nombre: z.string().trim().min(1).max(80), materiales: z.array(z.uuid()).max(100) });
export type SeleccionProducto = z.infer<typeof esquemaSeleccionProducto>;
