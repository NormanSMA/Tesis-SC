"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";

export function BotonActualizar() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  return (
    <Button type="button" onClick={() => iniciar(() => router.refresh())} disabled={pendiente} aria-busy={pendiente} className="max-sm:w-full">
      <RefreshCw aria-hidden="true" className={pendiente ? "animate-spin" : undefined} />
      {pendiente ? "Actualizando" : "Actualizar"}
    </Button>
  );
}
