"use client";

import { Button } from "@/components/ui/button";
export default function ErrorPanel({ reset }: { reset: () => void }) {
  return <div className="space-y-4"><p role="alert" aria-live="assertive">No se pudo cargar el panel.</p>
    <Button onClick={reset}>Reintentar</Button></div>;
}
