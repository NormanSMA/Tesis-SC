"use client";

import { motion, useAnimation } from "motion/react";
import { forwardRef, useImperativeHandle } from "react";

import { BrazoRobot } from "./IconoBrazoRobot";
import type { ControlIcono } from "./icono-animado";

type Propiedades = { size?: number; className?: string; "aria-hidden"?: boolean | "true" | "false" };

/** Brazo robótico con un balanceo corto. No existe en lucide-animated, por eso se anima aquí con el mismo contrato. */
export const BrazoRobotAnimado = forwardRef<ControlIcono, Propiedades>(function BrazoRobotAnimado(
  { size = 24, className, "aria-hidden": ocultoAlLector },
  ref,
) {
  const controles = useAnimation();
  useImperativeHandle(
    ref,
    () => ({
      startAnimation: () => {
        void controles.start({ rotate: [0, -8, 6, -3, 0], transition: { duration: 0.9, ease: "easeInOut" } });
      },
      stopAnimation: () => {
        void controles.start({ rotate: 0, transition: { duration: 0.2 } });
      },
    }),
    [controles],
  );
  return (
    <motion.div animate={controles} className={className} style={{ display: "flex", transformOrigin: "22% 88%" }} aria-hidden={ocultoAlLector}>
      <BrazoRobot size={size} />
    </motion.div>
  );
});
