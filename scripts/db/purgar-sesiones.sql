DELETE FROM sesion
WHERE expira_en < now() - interval '24 hours'
   OR revocada_en < now() - interval '24 hours';
