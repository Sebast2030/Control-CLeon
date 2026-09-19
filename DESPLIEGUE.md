# Despliegue de CLeón en la web

| Parte | Servicio | Dirección |
|---|---|---|
| Base de datos | **Neon** (PostgreSQL, plan gratis) | privada, con SSL |
| Backend (Spring Boot) | **Render** (plan Starter) | `https://cleon-api.onrender.com` |
| Frontend | **Cloudflare Pages** (gratis) | `https://cleon.pages.dev` |

Los tres dan HTTPS con certificados públicos: nadie tiene que instalar nada en su celular.

> **Regla de oro:** ninguna contraseña va en el código ni en este repositorio (es público).
> Solo se escriben en los paneles de Neon y Render, y en tu gestor de contraseñas.

---

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
   - **Name:** `cleon-api` (así la dirección queda `cleon-api.onrender.com`)
   - **Region:** `Virginia (US East)`
   - **Branch:** `main`
   - **Runtime / Language:** `Docker` (Render usa el `Dockerfile` del repo)
   - **Instance type:** `Starter`
3. En **Environment Variables** agrega:

   | Variable | Valor |
   |---|---|
   | `CLEON_DB_URL` | `jdbc:postgresql://ep-xxxx.us-east-1.aws.neon.tech/cleon?sslmode=require` (el host de tu cadena de Neon, **sin** usuario ni contraseña) |
   | `CLEON_DB_PASSWORD` | la contraseña de `cleon_app` del paso 1.4 |
   | `CLEON_CORS_ORIGENES` | `^https://cleon\.pages\.dev$` |

4. **Create Web Service** y espera a que el log diga `Started ComercializadosLeonApplication`.
5. Prueba: abre `https://cleon-api.onrender.com/api/auth/sesion`. Debe responder un JSON con
   *"Sesión inválida o vencida"* (401). Eso significa que funciona y está protegido.

## 3. Frontend en Cloudflare Pages

1. En Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** → repositorio `Control-CLeon`.
2. Configuración:
   - **Project name:** `cleon` (así la dirección queda `cleon.pages.dev`)
   - **Production branch:** `main`
   - **Framework preset:** `None`
   - **Build command:** `mkdir -p dist && cp -r index.html css js img _headers dist/`
   - **Build output directory:** `dist`

   El build copia solo el frontend: el código Java, los scripts SQL y la documentación no se publican.
3. **Save and Deploy**. Abre `https://cleon.pages.dev` e inicia sesión con el admin de producción.

## Si Render o Cloudflare te dan otro nombre

Si `cleon-api` o `cleon` ya están ocupados, las direcciones cambian. Hay que actualizar:

- Dirección de Render → `js/api.js` (API_BASE), `index.html` (connect-src de la CSP) y `_headers` (connect-src).
- Dirección de Pages → `js/api.js` (la condición `.pages.dev`) y la variable `CLEON_CORS_ORIGENES` en Render.

Luego commit y push: Render y Pages vuelven a publicar solos.

## Cada vez que cambies el código

`git push` a `main` → Render y Cloudflare Pages vuelven a publicar solos en unos minutos.
Si el cambio toca la estructura de las tablas, corre primero el script SQL en Neon (como en el
paso 1.5) y después haz push: con `ddl-auto=validate` el backend no arranca si las tablas no coinciden.

## Opcional: una capa más con Cloudflare Access

En Cloudflare **Zero Trust → Access → Applications** puedes proteger `cleon.pages.dev` para
que, antes de ver siquiera la pantalla de login, pida un código enviado a los correos que
autorices. Gratis hasta 50 usuarios.
