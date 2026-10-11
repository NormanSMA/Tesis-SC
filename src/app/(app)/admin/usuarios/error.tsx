"use client";

import { Button } from "@/components/ui/button";

export default function ErrorUsuarios({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="space-y-4" role="alert">
      <h2 className="text-lg font-semibold">No se pudieron cargar los usuarios</h2>
      <p>Intente cargar los datos nuevamente.</p>
      <Button className="min-h-10" onClick={retry}>Reintentar</Button>
    </div>
  );
}
