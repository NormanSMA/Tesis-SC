-- El relleno de responsables no identifica cuáles eran nulos originalmente.
-- Conservar responsables rellenados evita perder historial; recuperar nulos exige un respaldo anterior.
ALTER TABLE "historial_etapa" DROP CONSTRAINT "historial_etapa_responsable_obligatorio";
