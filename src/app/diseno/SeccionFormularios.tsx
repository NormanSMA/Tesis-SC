import { FormField } from "@/components/comunes/FormField";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { Seccion } from "./Seccion";

function CamposTexto() {
  return (
    <div className="space-y-5">
      <FormField id="g-nombre" etiqueta="Nombre del cliente" ayuda="Razón social o nombre completo." requerido>
        {(atributos) => <Input {...atributos} defaultValue="Distribuidora Pacífico, S. A." />}
      </FormField>
      <FormField id="g-ruc" etiqueta="RUC" error="El RUC debe tener 14 caracteres." requerido>
        {(atributos) => <Input {...atributos} defaultValue="J0310" />}
      </FormField>
      <FormField id="g-notas" etiqueta="Notas" ayuda="Visible solo para el personal interno.">
        {(atributos) => <Textarea {...atributos} rows={3} />}
      </FormField>
    </div>
  );
}

function CamposSeleccion() {
  return (
    <div className="space-y-5">
      <FormField id="g-tipo" etiqueta="Tipo de cliente" error="Seleccione un tipo de cliente." requerido>
        {(atributos) => (
          <Select>
            <SelectTrigger {...atributos}>
              <SelectValue placeholder="Seleccione una opción" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERSONA">Persona</SelectItem>
              <SelectItem value="EMPRESA">Empresa</SelectItem>
            </SelectContent>
          </Select>
        )}
      </FormField>
      <fieldset className="space-y-3">
        <legend className="text-base font-medium">Unidad de cobro</legend>
        <RadioGroup defaultValue="M2" className="gap-3">
          <div className="flex items-center gap-3">
            <RadioGroupItem value="UNIDAD" id="g-unidad" />
            <Label htmlFor="g-unidad" className="text-base">Por unidad</Label>
          </div>
          <div className="flex items-center gap-3">
            <RadioGroupItem value="M2" id="g-m2" />
            <Label htmlFor="g-m2" className="text-base">Por metro cuadrado</Label>
          </div>
        </RadioGroup>
      </fieldset>
      <div className="flex items-center gap-3">
        <Checkbox id="g-activo" defaultChecked />
        <Label htmlFor="g-activo" className="text-base">Cliente activo</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch id="g-iva" defaultChecked />
        <Label htmlFor="g-iva" className="text-base">Aplicar IVA</Label>
      </div>
    </div>
  );
}

export function SeccionFormularios() {
  return (
    <Seccion id="formularios" titulo="Formularios" descripcion="Controles de 40 px, texto de 16 px. Errores con ícono, texto y aria-describedby.">
      <div className="grid gap-8 rounded-lg border bg-card p-5 md:grid-cols-2">
        <CamposTexto />
        <CamposSeleccion />
      </div>
    </Seccion>
  );
}
