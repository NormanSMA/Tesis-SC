import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

export const esquemaLogin = z.object({
  correo: z.string().trim().min(1, "Ingrese su correo electrónico.").email("Ingrese un correo electrónico válido."),
  contrasena: z.string().min(1, "Ingrese su contraseña."),
});

export type ValoresLogin = z.infer<typeof esquemaLogin>;

type CuerpoError = {
  error?: { codigo?: string; mensaje?: string; campos?: Record<string, string | string[]> };
};

const MENSAJE_RED = "No se pudo conectar con el servidor. Revise su conexión e intente de nuevo.";

function textoCampo(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export function useFormularioLogin() {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const formulario = useForm<ValoresLogin>({
    resolver: zodResolver(esquemaLogin),
    defaultValues: { correo: "", contrasena: "" },
    shouldFocusError: false,
  });

  async function enviar(valores: ValoresLogin) {
    if (enviando) return;
    setEnviando(true);
    setErrorGeneral(null);
    try {
      const respuesta = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(valores),
      });
      const cuerpo = (await respuesta.json().catch(() => ({}))) as CuerpoError;
      if (respuesta.ok) {
        router.replace("/panel");
        return;
      }
      const campos = cuerpo.error?.campos ?? {};
      if (textoCampo(campos.correo)) formulario.setError("correo", { message: textoCampo(campos.correo) });
      if (textoCampo(campos.contrasena)) formulario.setError("contrasena", { message: textoCampo(campos.contrasena) });
      setErrorGeneral(cuerpo.error?.mensaje ?? "No se pudo iniciar sesión. Intente de nuevo.");
    } catch {
      setErrorGeneral(MENSAJE_RED);
    }
    setEnviando(false);
  }

  return {
    formulario,
    enviando,
    errorGeneral,
    enviar: formulario.handleSubmit(enviar, (errores) =>
      // El foco va al primer campo del formulario con error, en el orden visual.
      formulario.setFocus(errores.correo ? "correo" : "contrasena"),
    ),
  };
}
