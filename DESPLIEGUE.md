# Despliegue de CLeón en la web

| Parte | Servicio | Dirección |
|---|---|---|
| Dominio y DNS | **Cloudflare** (Registrar) | `comercializadosleon.com` |
| Frontend | **Cloudflare Pages** (gratis) | `https://comercializadosleon.com` (y `www.`) |
| Backend (Spring Boot) | **Render** (plan Starter, 7 USD/mes) | `https://api.comercializadosleon.com` |
| Base de datos | **Neon** (PostgreSQL, plan gratis) | privada, con SSL |

Los tres dan HTTPS con certificados públicos y gratis: nadie tiene que instalar nada en su celular.

> **Regla de oro:** ninguna contraseña va en el código ni en este repositorio (es público).
> Solo se escriben en los paneles de Neon y Render, y en tu gestor de contraseñas.

Orden: dominio → Neon → Render → Cloudflare Pages → conectar `api.` con Render.

---

## 0. Dominio en Cloudflare

1. En Cloudflare: **Domain Registration → Register Domains** → `comercializadosleon.com`.
2. Al comprarlo, Cloudflare crea solo la zona DNS del dominio. No hace falta configurar nada más aquí;
   los registros se agregan en los pasos 3 y 4.
3. Recomendado: activa la **renovación automática** y el **bloqueo de transferencia** (vienen por defecto).

## 1. Base de datos en Neon

1. Crea una cuenta en <https://neon.tech> y un proyecto:
   - **Project name:** `cleon`
   - **Postgres version:** 17 o la más reciente
   - **Region:** `AWS US East (N. Virginia)` (la misma zona que Render en el paso 2, para que
     el backend y la base estén cerca).
2. En el proyecto, crea una base llamada **`cleon`** (Databases → New database, dueño `neondb_owner`).
3. En **Connect**, elige la base `cleon`, el rol `neondb_owner` y copia la cadena de conexión
   (`postgresql://neondb_owner:...@ep-xxxx.us-east-1.aws.neon.tech/cleon?sslmode=require`).
   Es la llave maestra de la base: guárdala en tu gestor de contraseñas.
4. Genera una contraseña para `cleon_app` (el rol con el que se conecta el backend).
   En PowerShell:
   ```powershell
   -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | % {[char]$_})
   ```
   Guárdala: la vas a usar aquí y en Render.
5. Desde la carpeta del proyecto, crea las tablas, la seguridad y el admin. En cada comando
   reemplaza `CADENA_NEON` por la cadena del paso 3 (entre comillas):
   ```powershell
   psql "CADENA_NEON" -f db/schema.sql
   psql "CADENA_NEON" -v app_password='CONTRASENA_CLEON_APP' -f db/seguridad.sql
   psql "CADENA_NEON" -f db/admin.sql
   ```
   El último pide la contraseña del admin **de producción** (mínimo 16 caracteres, con
   mayúsculas, minúsculas, números y símbolos). Usa una distinta a la del PC.

   Si `psql` no se reconoce, usa la ruta completa: `& "C:\Program Files\PostgreSQL\18\bin\psql.exe" ...`

## 2. Backend en Render

1. Crea una cuenta en <https://render.com> y conéctala con GitHub.
2. **New → Web Service** → elige el repositorio `Control-CLeon`.
   - **Name:** `cleon-api`
   - **Region:** `Virginia (US East)`
   - **Branch:** `main`
   - **Runtime / Language:** `Docker` (Render usa el `Dockerfile` del repo)
   - **Instance type:** `Starter`
3. En **Environment Variables** agrega:

   | Variable | Valor |
   |---|---|
   | `CLEON_DB_URL` | `jdbc:postgresql://ep-xxxx.us-east-1.aws.neon.tech/cleon?sslmode=require` (el host de tu cadena de Neon, **sin** usuario ni contraseña) |
   | `CLEON_DB_PASSWORD` | la contraseña de `cleon_app` del paso 1.4 |
   | `CLEON_CORS_ORIGENES` | `^https://(www\.)?comercializadosleon\.com$` |

4. **Create Web Service** y espera a que el log diga `Started ComercializadosLeonApplication`.
5. Prueba: abre `https://<tu-servicio>.onrender.com/api/auth/sesion` (la dirección aparece arriba
   en el panel). Debe responder un JSON con *"Sesión inválida o vencida"* (401): funciona y está protegido.

## 3. Frontend en Cloudflare Pages

1. En Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** → repositorio `Control-CLeon`.
2. Configuración:
   - **Project name:** `cleon`
   - **Production branch:** `main`
   - **Framework preset:** `None`
   - **Build command:** `mkdir -p dist && cp -r index.html css js img _headers dist/`
   - **Build output directory:** `dist`

   El build copia solo el frontend: el código Java, los scripts SQL y la documentación no se publican.
3. **Save and Deploy**.
4. En el proyecto: **Custom domains → Set up a custom domain** → `comercializadosleon.com`.
   Repite con `www.comercializadosleon.com`. Como el dominio está en Cloudflare, los registros
   DNS se crean solos. El certificado tarda unos minutos.

La app solo funciona desde `comercializadosleon.com` / `www.`: la dirección `*.pages.dev` abre la
página, pero el backend la rechaza (CORS). Es a propósito.

## 4. Conectar `api.comercializadosleon.com` con Render

1. En Render, en el servicio `cleon-api`: **Settings → Custom Domains → Add** →
   `api.comercializadosleon.com`. Render muestra a qué dirección apuntar (`cleon-api.onrender.com`
   o la que te haya dado).
2. En Cloudflare: **comercializadosleon.com → DNS → Records → Add record**:
   - **Type:** `CNAME`
   - **Name:** `api`
   - **Target:** la dirección `.onrender.com` que mostró Render
   - **Proxy status:** **DNS only** (nube **gris**), no "Proxied".

   > **Importante, nube gris:** si pasa por el proxy de Cloudflare, Render ve la IP de Cloudflare
   > en vez de la del usuario y el rate limiting por IP deja de servir (todos compartirían el mismo
   > límite). Además, Render necesita el DNS directo para emitir su certificado.
3. En Render, pulsa **Verify**. Cuando diga *Certificate issued*, abre
   `https://api.comercializadosleon.com/api/auth/sesion`: debe dar el mismo 401 del paso 2.5.
4. Abre `https://comercializadosleon.com` e inicia sesión con el admin de producción.

## Cada vez que cambies el código

`git push` a `main` → Render y Cloudflare Pages vuelven a publicar solos en unos minutos.
Si el cambio toca la estructura de las tablas, corre primero el script SQL en Neon (como en el
paso 1.5) y después haz push: con `ddl-auto=validate` el backend no arranca si las tablas no coinciden.

## Si cambias el dominio

- Dirección del backend → `js/api.js` (API_BASE), `index.html` y `_headers` (connect-src de la CSP).
- Dirección del frontend → la variable `CLEON_CORS_ORIGENES` en Render.

## Opcional: una capa más con Cloudflare Access

En Cloudflare **Zero Trust → Access → Applications** puedes proteger `comercializadosleon.com` para
que, antes de ver siquiera la pantalla de login, pida un código enviado a los correos que
autorices. Gratis hasta 50 usuarios.
