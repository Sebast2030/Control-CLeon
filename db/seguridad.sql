-- ============================================================================
-- Comercializadora Leon - Seguridad de la base de datos
-- ============================================================================
-- Que hace (se puede ejecutar varias veces sin romper nada):
--
--   1. Crea el rol cleon_app, que es con el que se conecta el backend. No es
--      superusuario ni dueno de las tablas: no puede borrar tablas, cambiar su
--      estructura, desactivar la seguridad ni borrar facturas.
--
--   2. Crea las tablas usuarios y sesiones y las funciones de inicio de sesion.
--      Las contrasenas se guardan con bcrypt y los tokens de sesion solo como hash
--      SHA-256. cleon_app no puede leer esas tablas: solo puede llamar a las
--      funciones, y para abrir una sesion hay que conocer la contrasena.
--
--   3. Activa Row Level Security (RLS) en todas las tablas. cleon_app solo puede
--      leer o modificar datos si la conexion trae el token de una sesion de admin
--      valida (el backend lo pone en la variable cleon.token de cada conexion).
--      Si alguien llega a la base saltandose el login, no ve ni cambia nada.
--
-- Ejecutar como el dueno de las tablas (postgres en el PC, neondb_owner en Neon),
-- despues de schema.sql:
--   psql -U postgres -d cleon -v app_password='CONTRASENA_DE_CLEON_APP' -f db/seguridad.sql
-- Esa misma contrasena va en config/secretos.properties (CLEON_DB_PASSWORD).
-- Despues, crear el usuario admin con db/admin.sql.
-- ============================================================================

\set ON_ERROR_STOP on

\if :{?app_password}
\else
    \echo 'Falta la contrasena del rol cleon_app. Uso:'
    \echo '  psql -U postgres -d cleon -v app_password=CONTRASENA -f db/seguridad.sql'
    \quit
\endif

BEGIN;

-- bcrypt (crypt/gen_salt), SHA-256 (digest) y bytes aleatorios seguros (gen_random_bytes)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- ----------------------------------------------------------------------------
-- 1. Rol de la aplicacion
-- ----------------------------------------------------------------------------

SELECT 'CREATE ROLE cleon_app LOGIN'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cleon_app') \gexec

-- Solo atributos que puede poner el dueno de la base aunque no sea superusuario (como en
-- Neon). SUPERUSER, REPLICATION y BYPASSRLS no se tocan: un rol nuevo nace sin ellos, y
-- el control de abajo aborta todo si por alguna razon los tuviera.
SELECT format('ALTER ROLE cleon_app WITH LOGIN NOCREATEDB NOCREATEROLE NOINHERIT '
              'CONNECTION LIMIT 20 PASSWORD %L',
              :'app_password') \gexec

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles
               WHERE rolname = 'cleon_app'
                 AND (rolsuper OR rolbypassrls OR rolreplication OR rolcreatedb OR rolcreaterole)) THEN
        RAISE EXCEPTION 'cleon_app tiene privilegios de mas (superusuario, BYPASSRLS, replicacion, '
                        'CREATEDB o CREATEROLE). Quitarlos como superusuario antes de seguir.';
    END IF;
END $$;

-- Cortar consultas colgadas o transacciones abandonadas (proteccion contra abusos).
ALTER ROLE cleon_app SET statement_timeout = '15s';
ALTER ROLE cleon_app SET lock_timeout = '10s';
ALTER ROLE cleon_app SET idle_in_transaction_session_timeout = '60s';

-- Solo cleon_app (y los superusuarios) pueden conectarse a esta base, y nadie
-- mas que el dueno puede crear objetos en el esquema.
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database()) \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO cleon_app', current_database()) \gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO cleon_app;

-- ----------------------------------------------------------------------------
-- 2. Usuarios y sesiones
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.usuarios (
    id                BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario           VARCHAR(50)  NOT NULL UNIQUE,
    password_hash     TEXT         NOT NULL,            -- bcrypt ($2a$12$...), nunca la contrasena
    rol               VARCHAR(20)  NOT NULL DEFAULT 'ADMIN' CHECK (rol IN ('ADMIN')),
    activo            BOOLEAN      NOT NULL DEFAULT TRUE,
    intentos_fallidos INTEGER      NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
    bloqueado_hasta   TIMESTAMPTZ,
    ultimo_acceso     TIMESTAMPTZ,
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sesiones (
    id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id  BIGINT      NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    token_hash  BYTEA       NOT NULL UNIQUE,              -- SHA-256 del token; el token nunca se guarda
    ip          VARCHAR(45),
    creada_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultimo_uso  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en   TIMESTAMPTZ NOT NULL,
    revocada    BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_id ON public.sesiones (usuario_id);

-- Unica definicion de "sesion valida". La usan el backend (para autenticar cada
-- peticion) y las politicas RLS (para decidir si una conexion puede ver datos).
-- Inactividad maxima: 60 minutos sin peticiones. Duracion maxima: ver cleon_iniciar_sesion.
CREATE OR REPLACE FUNCTION public.cleon_sesion_vigente(p_token TEXT)
RETURNS TABLE (sesion_id BIGINT, usuario_id BIGINT, usuario VARCHAR, rol VARCHAR, expira_en TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT s.id, u.id, u.usuario, u.rol, s.expira_en
    FROM public.sesiones s
    JOIN public.usuarios u ON u.id = s.usuario_id
    WHERE p_token ~ '^[0-9a-f]{64}$'
      AND s.token_hash = public.digest(p_token, 'sha256')
      AND NOT s.revocada
      AND s.expira_en > now()
      AND s.ultimo_uso > now() - interval '60 minutes'
      AND u.activo
$$;

-- Lo usan las politicas RLS: true solo si la conexion trae el token de una sesion
-- de admin vigente. El backend pone ese token con set_config('cleon.token', ...).
CREATE OR REPLACE FUNCTION public.cleon_es_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.cleon_sesion_vigente(current_setting('cleon.token', true)) v
        WHERE v.rol = 'ADMIN'
    )
$$;

-- Inicio de sesion. La contrasena se verifica aqui dentro (bcrypt), asi que ni el
-- backend ni cleon_app necesitan leer los hashes, y abrir una sesion exige conocer
-- la contrasena aunque se tenga acceso a la base como cleon_app.
--
-- resultado: OK | CREDENCIALES_INVALIDAS | BLOQUEADO
CREATE OR REPLACE FUNCTION public.cleon_iniciar_sesion(p_usuario TEXT, p_password TEXT, p_ip TEXT)
RETURNS TABLE (resultado TEXT, token TEXT, usuario VARCHAR, rol VARCHAR,
               expira_en TIMESTAMPTZ, bloqueado_hasta TIMESTAMPTZ)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
#variable_conflict use_column
DECLARE
    c_max_intentos CONSTANT INTEGER  := 5;                     -- fallos seguidos antes de bloquear
    c_bloqueo      CONSTANT INTERVAL := interval '15 minutes';  -- duracion del bloqueo
    c_duracion     CONSTANT INTERVAL := interval '10 hours';    -- vida maxima de una sesion
    v_usuario  public.usuarios%ROWTYPE;
    v_token    TEXT;
    v_expira   TIMESTAMPTZ;
    v_intentos INTEGER;
BEGIN
    -- FOR UPDATE: dos intentos simultaneos no pueden saltarse el conteo de fallos.
    SELECT * INTO v_usuario FROM public.usuarios u WHERE u.usuario = p_usuario FOR UPDATE;

    -- Usuario inexistente o desactivado: se calcula un bcrypt igual de costoso para
    -- que la respuesta tarde lo mismo y no delate que usuarios existen.
    IF NOT FOUND OR NOT v_usuario.activo THEN
        PERFORM public.crypt(coalesce(p_password, ''), public.gen_salt('bf', 12));
        RETURN QUERY SELECT 'CREDENCIALES_INVALIDAS'::text, NULL::text, NULL::varchar,
                            NULL::varchar, NULL::timestamptz, NULL::timestamptz;
        RETURN;
    END IF;

    IF v_usuario.bloqueado_hasta > now() THEN
        RETURN QUERY SELECT 'BLOQUEADO'::text, NULL::text, NULL::varchar,
                            NULL::varchar, NULL::timestamptz, v_usuario.bloqueado_hasta;
        RETURN;
    END IF;

    IF p_password IS NULL
       OR public.crypt(p_password, v_usuario.password_hash) <> v_usuario.password_hash THEN
        v_intentos := v_usuario.intentos_fallidos + 1;
        IF v_intentos >= c_max_intentos THEN
            UPDATE public.usuarios
            SET intentos_fallidos = 0, bloqueado_hasta = now() + c_bloqueo
            WHERE id = v_usuario.id;
            RETURN QUERY SELECT 'BLOQUEADO'::text, NULL::text, NULL::varchar,
                                NULL::varchar, NULL::timestamptz, now() + c_bloqueo;
        ELSE
            UPDATE public.usuarios SET intentos_fallidos = v_intentos WHERE id = v_usuario.id;
            RETURN QUERY SELECT 'CREDENCIALES_INVALIDAS'::text, NULL::text, NULL::varchar,
                                NULL::varchar, NULL::timestamptz, NULL::timestamptz;
        END IF;
        RETURN;
    END IF;

    UPDATE public.usuarios
    SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = now()
    WHERE id = v_usuario.id;

    -- Limpieza: las sesiones vencidas o sin uso desde hace mas de un dia ya no sirven.
    DELETE FROM public.sesiones s
    WHERE s.expira_en < now() - interval '1 day' OR s.ultimo_uso < now() - interval '1 day';

    -- Token de 256 bits. Al cliente se le entrega una sola vez; aqui solo queda su hash.
    v_token  := encode(public.gen_random_bytes(32), 'hex');
    v_expira := now() + c_duracion;
    INSERT INTO public.sesiones (usuario_id, token_hash, ip, expira_en)
    VALUES (v_usuario.id, public.digest(v_token, 'sha256'), left(p_ip, 45), v_expira);

    RETURN QUERY SELECT 'OK'::text, v_token, v_usuario.usuario, v_usuario.rol,
                        v_expira, NULL::timestamptz;
END;
$$;

-- Valida el token de una peticion y registra actividad (para el tiempo de inactividad).
-- Sin filas = token invalido, vencido o revocado.
CREATE OR REPLACE FUNCTION public.cleon_validar_sesion(p_token TEXT)
RETURNS TABLE (usuario_id BIGINT, usuario VARCHAR, rol VARCHAR, expira_en TIMESTAMPTZ)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
#variable_conflict use_column
DECLARE
    v RECORD;
BEGIN
    SELECT * INTO v FROM public.cleon_sesion_vigente(p_token);
    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Como mucho una escritura por minuto por sesion.
    UPDATE public.sesiones
    SET ultimo_uso = now()
    WHERE id = v.sesion_id AND ultimo_uso < now() - interval '1 minute';

    RETURN QUERY SELECT v.usuario_id, v.usuario, v.rol, v.expira_en;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleon_cerrar_sesion(p_token TEXT)
RETURNS VOID
LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
    UPDATE public.sesiones
    SET revocada = TRUE
    WHERE p_token ~ '^[0-9a-f]{64}$'
      AND token_hash = public.digest(p_token, 'sha256');
$$;

-- Las funciones nacen ejecutables por cualquiera (PUBLIC): se cierra y se abre solo
-- lo que el backend necesita. cleon_sesion_vigente queda solo para uso interno.
REVOKE ALL ON FUNCTION public.cleon_sesion_vigente(TEXT),
                       public.cleon_es_admin(),
                       public.cleon_iniciar_sesion(TEXT, TEXT, TEXT),
                       public.cleon_validar_sesion(TEXT),
                       public.cleon_cerrar_sesion(TEXT)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleon_es_admin(),
                          public.cleon_iniciar_sesion(TEXT, TEXT, TEXT),
                          public.cleon_validar_sesion(TEXT),
                          public.cleon_cerrar_sesion(TEXT)
    TO cleon_app;

-- ----------------------------------------------------------------------------
-- 3. Privilegios minimos sobre las tablas
-- ----------------------------------------------------------------------------
-- Solo lo que la aplicacion usa. Las facturas y sus lineas nunca se borran ni se
-- editan (se anulan), asi que cleon_app no tiene DELETE sobre ellas: ni un error en
-- el codigo ni un atacante con acceso a la aplicacion puede hacer desaparecer ventas.
-- Si en el futuro una funcion nueva necesita otro permiso, se agrega aqui.

REVOKE ALL ON public.productos, public.clientes, public.facturas, public.detalle_factura,
              public.usuarios, public.sesiones
    FROM PUBLIC, cleon_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.productos, public.clientes TO cleon_app;
GRANT SELECT, INSERT, UPDATE         ON public.facturas                   TO cleon_app;
GRANT SELECT, INSERT                 ON public.detalle_factura            TO cleon_app;

-- Las columnas id usan secuencias (BIGSERIAL); insertar necesita poder avanzarlas.
SELECT format('GRANT USAGE ON SEQUENCE %s TO cleon_app', pg_get_serial_sequence('public.' || t, 'id'))
FROM unnest(ARRAY['productos', 'clientes', 'facturas', 'detalle_factura']) AS t \gexec

-- usuarios y sesiones: cleon_app no tiene ningun permiso directo. Solo las funciones
-- de arriba (que corren como el dueno) pueden tocarlas.

-- ----------------------------------------------------------------------------
-- 4. Row Level Security
-- ----------------------------------------------------------------------------
-- La regla aplica a cleon_app, que es con el que se conecta el backend. El dueno de
-- las tablas (postgres en el PC, neondb_owner en Neon) queda fuera a proposito: es el
-- rol de mantenimiento con el que se corren los scripts de db/. Por eso el backend
-- NUNCA se conecta con el dueno. NO FORCE deja esto explicito aunque el dueno no sea
-- superusuario.

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['productos', 'clientes', 'facturas', 'detalle_factura'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS solo_admin ON public.%I', t);
        -- (SELECT ...) hace que la comprobacion se evalue una vez por consulta y no por fila.
        EXECUTE format('CREATE POLICY solo_admin ON public.%I FOR ALL TO cleon_app '
                       'USING ((SELECT public.cleon_es_admin())) '
                       'WITH CHECK ((SELECT public.cleon_es_admin()))', t);
    END LOOP;
END $$;

-- Sin politicas para cleon_app: aunque tuviera permisos, no veria ninguna fila.
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones ENABLE ROW LEVEL SECURITY;

COMMIT;

\echo 'Seguridad aplicada. Siguiente paso: crear el admin con db/admin.sql'
