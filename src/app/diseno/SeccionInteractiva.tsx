"use client";

import { Info, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/comunes/ConfirmDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { Seccion } from "./Seccion";

function Superposiciones() {
  const [dialogo, setDialogo] = useState(false);
  const [panel, setPanel] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={() => setDialogo(true)}>
        Abrir confirmación
      </Button>
      <Button variant="outline" onClick={() => setPanel(true)}>
        Abrir panel lateral
      </Button>
      <Button variant="outline" onClick={() => toast.success("Cotización guardada.")}>
        Mostrar aviso
      </Button>
      <ConfirmDialog
        abierto={dialogo}
        alCambiarAbierto={setDialogo}
        titulo="Cancelar la orden OT-2026-0018"
        descripcion="Las etapas abiertas pasan a Omitida y el sobrante se devuelve al inventario."
        etiquetaConfirmar="Cancelar orden"
        etiquetaCancelar="Volver"
        tono="peligro"
        alConfirmar={() => setDialogo(false)}
      />
      <Sheet open={panel} onOpenChange={setPanel}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Panel lateral</SheetTitle>
            <SheetDescription>Formularios secundarios y detalles sin salir de la lista.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Menus() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Acciones de la fila">
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem>Ver detalle</DropdownMenuItem>
          <DropdownMenuItem>Duplicar</DropdownMenuItem>
          <DropdownMenuItem>Archivar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline">Pasar el cursor</Button>
        </TooltipTrigger>
        <TooltipContent>Aparece con el cursor o el foco del teclado</TooltipContent>
      </Tooltip>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">Abrir popover</Button>
        </PopoverTrigger>
        <PopoverContent className="text-sm">Contenido breve asociado al botón.</PopoverContent>
      </Popover>
      <Avatar>
        <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">NM</AvatarFallback>
      </Avatar>
    </div>
  );
}

function Avisos() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Alert role="status">
        <Info aria-hidden="true" />
        <AlertTitle>Información</AlertTitle>
        <AlertDescription>La cotización vence en 5 días.</AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <Info aria-hidden="true" />
        <AlertTitle>No se pudo guardar</AlertTitle>
        <AlertDescription>Revise los campos marcados e intente de nuevo.</AlertDescription>
      </Alert>
    </div>
  );
}

function Pestanas() {
  return (
    <Tabs defaultValue="resumen" className="rounded-lg border bg-card p-4">
      <TabsList>
        <TabsTrigger value="resumen">Resumen</TabsTrigger>
        <TabsTrigger value="items">Ítems</TabsTrigger>
        <TabsTrigger value="historial">Historial</TabsTrigger>
      </TabsList>
      <TabsContent value="resumen" className="pt-3 text-sm">Datos generales del documento.</TabsContent>
      <TabsContent value="items" className="pt-3 text-sm">Productos y costos asociados.</TabsContent>
      <TabsContent value="historial" className="pt-3 text-sm">Cambios registrados en bitácora.</TabsContent>
    </Tabs>
  );
}

export function SeccionInteractiva() {
  return (
    <Seccion id="interactivos" titulo="Componentes interactivos" descripcion="Diálogo, panel lateral, aviso, menú, tooltip, popover, pestañas y alertas.">
      <Superposiciones />
      <Menus />
      <Avisos />
      <Pestanas />
    </Seccion>
  );
}
