-- ============================================================================
-- Comercializadora Leon - Crear el admin o cambiarle la contrasena
-- ============================================================================
-- Crea el usuario administrador si no existe. Si ya existe, le cambia la
-- contrasena, lo desbloquea y cierra todas sus sesiones abiertas.
--
-- Ejecutar como postgres, despues de db/seguridad.sql:
--   psql -U postgres -d cleon -f db/admin.sql
--
-- La contrasena se pide por teclado para que no quede guardada en ningun archivo.
-- Debe tener al menos 16 caracteres, con mayusculas, minusculas, numeros y simbolos.
-- Opcional: -v admin_usuario='OtroUsuario' (por defecto Admin_Cleon#2026).
-- ============================================================================

\set ON_ERROR_STOP on

\if :{?admin_usuario}
\else
    \set admin_usuario 'Admin_Cleon#2026'
\endif

\if :{?admin_password}
\else
    \prompt 'Nueva contrasena para el admin: ' admin_password
\endif

SELECT length(:'admin_password') BETWEEN 16 AND 72
       AND :'admin_password' ~ '[A-Z]'
       AND :'admin_password' ~ '[a-z]'
       AND :'admin_password' ~ '[0-9]'
       AND :'admin_password' ~ '[^A-Za-z0-9]' AS password_valida \gset

\if :password_valida
\else
    \echo 'ERROR: la contrasena debe tener entre 16 y 72 caracteres, con mayusculas, minusculas, numeros y simbolos.'
    \quit
\endif

BEGIN;

INSERT INTO public.usuarios (usuario, password_hash, rol)
VALUES (:'admin_usuario', public.crypt(:'admin_password', public.gen_salt('bf', 12)), 'ADMIN')
ON CONFLICT (usuario) DO UPDATE
    SET password_hash     = EXCLUDED.password_hash,
        intentos_fallidos = 0,
        bloqueado_hasta   = NULL,
        activo            = TRUE;

-- Una contrasena nueva invalida las sesiones abiertas con la anterior.
UPDATE public.sesiones
SET revocada = TRUE
WHERE usuario_id = (SELECT id FROM public.usuarios WHERE usuario = :'admin_usuario');

COMMIT;

\unset admin_password
\echo 'Listo: usuario' :admin_usuario 'actualizado.'
