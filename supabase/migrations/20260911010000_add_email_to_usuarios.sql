ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS email VARCHAR(254);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_key
  ON public.usuarios (email)
  WHERE email IS NOT NULL;
