# Comercializados León (CLeón)

Sistema de inventario y facturación para una comercializadora de exostos/mufflers.
Backend REST en Spring Boot + frontend estático en JavaScript vanilla.

## Stack

- **Java 17** + **Spring Boot 4.1.1** (Maven, con wrapper `mvnw`) + **Spring Security 7**
- **PostgreSQL** — base de datos `cleon` en `localhost:5432`
- **Lombok** para getters/setters/constructores
- **Jackson 3** (`tools.jackson`), el que trae Spring Boot 4
- **Bucket4j** + **Caffeine** para el rate limiting
- **Frontend**: HTML + CSS + JS vanilla, sin build step ni framework
- Paquete base: `com.sebast.comercializados_leon` · clase principal `ComercializadosLeonApplication`

## Comandos

```bash
# Compilar y levantar el backend (puerto 8080)
./mvnw spring-boot:run

# Compilar sin ejecutar
./mvnw clean install

# Tests
./mvnw test
```

El frontend se sirve con la extensión **Live Server** de VS Code (puerto 5500), para que
celulares y otros equipos de la red local puedan usarlo en `https://<IP-del-PC>:5500`.
Todo va por **HTTPS** (backend y frontend); ver la sección "HTTPS".
Con `spring-boot-devtools` activo, el backend recarga solo al guardar cambios en Java.

**Acceso desde la red:** `API_BASE` en `js/api.js` apunta a la **IP del PC en la red local**
(no a `localhost`) a propósito: con `localhost`, un celular buscaría el backend en sí mismo.
No cambiarlo a `localhost` ni a un host deducido. Si el router le cambia la IP al PC
(`ipconfig` → "Dirección IPv4"), hay que actualizar ese valor **y generar de nuevo el
certificado HTTPS** para la IP nueva (CORS y la CSP ya aceptan cualquier IP `192.168.x.x`).
Conviene reservar la IP del PC en el router para que no cambie.

**Secretos:** el backend lee la contraseña de PostgreSQL de `config/secretos.properties`
(ignorado por git; plantilla en `config/secretos.example.properties`) o de la variable de
entorno `CLEON_DB_PASSWORD`. Nunca poner contraseñas en `application.properties`.

## Estructura

```
src/main/java/com/sebast/comercializados_leon/
├── Controller/    → endpoints REST (@RestController)
├── Service/       → lógica de negocio (@Service @Transactional)
├── Repository/    → acceso a datos (Spring Data JPA; SesionRepository usa JdbcClient)
├── Model/
│   ├── Entity/    → entidades JPA (mapean a tablas)
│   └── Dto/       → objetos de transferencia (lo que ve el frontend)
├── Exception/     → excepciones propias + GlobalExceptionHandler
├── Security/      → filtros (token, rate limiting, tamaño), DataSource con contexto RLS
├── Util/          → Sanitizador (limpieza de texto y patrones de validación)
└── Config/        → SeguridadConfig, CorsConfig, ContextoRlsConfig

index.html         → shell de la app (pantalla de login + layout)
js/icons.js        → set de iconos SVG
js/api.js          → cliente HTTP (const API_BASE) + manejo del token (Sesion)
js/ui.js           → helpers de UI (toasts, modales, validación de formularios)
js/main.js         → login/logout, router por hash + todas las vistas
css/styles.css     → estilos completos
db/                → scripts SQL (schema, seguridad, admin, datos por defecto, reset, migraciones)
config/            → secretos locales (ignorado por git) y su plantilla
```

**Importante:** los 4 scripts JS se cargan en orden fijo en `index.html`
(`icons → api → ui → main`) y comparten scope global. No hay módulos ES ni imports.

## Arquitectura del backend

Flujo estricto en tres capas: **Controller → Service → Repository**.

- Los controllers no tienen lógica: solo reciben, delegan al service y devuelven DTOs.
- Los services nunca devuelven entidades, siempre DTOs (cada service tiene un helper `aDTO()`).
- Inyección de dependencias por constructor vía `@RequiredArgsConstructor` con campos `private final`.
- Los errores se lanzan como excepciones propias (`ResourceNotFoundException`,
  `StockInsuficienteException`, `CredencialesInvalidasException`, `CuentaBloqueadaException`)
  y `GlobalExceptionHandler` las convierte en respuestas HTTP.
  No se devuelven `ResponseEntity` con códigos de error manualmente.

## Seguridad

- **Login:** `POST /api/auth/login` es lo único público. Todo lo demás exige
  `Authorization: Bearer <token>` de una sesión de admin (regla `anyRequest().hasRole("ADMIN")`
  en `SeguridadConfig`): un endpoint nuevo queda protegido sin tocar nada.
- **Contraseñas y sesiones viven en PostgreSQL** (tablas `usuarios` y `sesiones`, creadas por
  `db/seguridad.sql`). La contraseña se verifica con bcrypt **dentro de la base**
  (`cleon_iniciar_sesion`); el token es aleatorio de 256 bits y solo se guarda su SHA-256.
  Sesión: máximo 10 h, se cierra tras 60 min sin uso. 5 fallos seguidos bloquean la cuenta 15 min.
- **El backend se conecta como `cleon_app`**, un rol sin privilegios de dueño ni superusuario.
  No puede leer `usuarios`/`sesiones` (solo llamar a las funciones `cleon_*`), ni borrar
  facturas, ni cambiar la estructura de las tablas.
- **Row Level Security:** todas las tablas tienen RLS. `ContextoRlsDataSource` pone el token de
  la petición en la variable `cleon.token` de cada conexión, y las políticas solo dejan ver o
  modificar datos si ese token es de una sesión de admin vigente. Sin sesión, la base no
  devuelve nada, aunque alguien se salte el login en la app.
- **Rate limiting** (`LimitadorDePeticiones`, límites definidos solo ahí): 100 peticiones/min por
  IP, 200/min por usuario, y el login 5 seguidos + 1/min + 20/hora por IP. Exceder → 429 con
  `Retry-After`. Los contadores están en memoria: se reinician al reiniciar el backend.
- **Validación:** los DTOs normalizan el texto en sus setters (`Sanitizador.limpiar`) y lo validan
  con listas blancas (`@Pattern` con los patrones de `Sanitizador`). Los query params y path
  variables también llevan anotaciones. El JSON es estricto (campos desconocidos, claves
  duplicadas, decimales en enteros y documentos de más de 64 KB → 400/413).
- **Frontend:** token en `sessionStorage` (se borra al cerrar la pestaña). Cualquier 401 vuelve
  al login y limpia la página. CSP en `index.html`.

### Producción

Guía paso a paso en [DESPLIEGUE.md](DESPLIEGUE.md): dominio `comercializadosleon.com` en
**Cloudflare**, base en **Neon**, backend en **Render** (`api.comercializadosleon.com`, con el
`Dockerfile`, perfil `prod` en `application-prod.properties`) y frontend en **Cloudflare Pages**
(`comercializadosleon.com` y `www.`, cabeceras de seguridad en `_headers`).

- La configuración de producción llega por variables de entorno de Render: `CLEON_DB_URL`,
  `CLEON_DB_PASSWORD`, `CLEON_CORS_ORIGENES`. Nunca en archivos del repo, que es **público**.
- `js/api.js` elige la API según dónde se abra la página: desde `localhost` o `192.168.x.x` → backend
  local; desde cualquier otro sitio → `https://api.comercializadosleon.com`.
- El registro DNS `api` en Cloudflare va en **DNS only** (nube gris): con el proxy de Cloudflare,
  Render vería la IP de Cloudflare y el rate limiting por IP dejaría de servir.
- Detrás del proxy de Render, `server.forward-headers-strategy=native` toma la IP real de
  `X-Forwarded-For` solo si viene de la red interna del proxy (el rate limiting depende de eso).
- Si cambia la dirección del backend, actualizarla en `js/api.js`, `index.html` y `_headers` (CSP).

### HTTPS

- Certificado de **mkcert** (autoridad local instalada en este PC con `mkcert -install`) para
  `192.168.1.12`, `localhost` y `127.0.0.1`, válido hasta el 18/12/2028. Archivos:
  `config/cleon-cert.pem` y `config/cleon-key.pem` (ignorados por git; la llave nunca se comparte).
- Backend: `server.ssl.*` en `application.properties`, mismo puerto 8080. Por `http` responde 400.
- Frontend: Live Server usa el mismo certificado (`liveServer.settings.https` en
  `.vscode/settings.json`). Tras cambiar esa configuración hay que detener y volver a iniciar Live Server.
- Cada celular debe tener instalado el certificado raíz de mkcert (`rootCA.pem` de la carpeta que
  muestra `mkcert -CAROOT`); si no, el navegador muestra "conexión no privada" y la API falla.
  **Nunca copiar `rootCA-key.pem`**.
- Si cambia la IP del PC, regenerar el certificado (fuera de `Documents`, porque el acceso
  controlado a carpetas de Windows bloquea a mkcert, y copiarlo con PowerShell):
  `mkcert -cert-file cleon-cert.pem -key-file cleon-key.pem <IP-nueva> localhost 127.0.0.1`.
- `curl` en Windows necesita `--ssl-no-revoke` con estos certificados (no tienen servidor de
  revocación); los navegadores no.

### Administración de la base

```bash
# Aplicar (o re-aplicar) roles, tablas de seguridad, funciones y RLS. Idempotente.
psql -U postgres -d cleon -v app_password='<CLEON_DB_PASSWORD>' -f db/seguridad.sql

# Crear el admin o cambiarle la contraseña (la pide por teclado). También lo desbloquea
# y cierra todas sus sesiones.
psql -U postgres -d cleon -f db/admin.sql
```

Si la ruta del proyecto tiene tildes (`Programación`), `psql -f` y `pg_dump -f` pueden fallar
al abrir el archivo: copiar el script a una ruta sin tildes o pasarlo por stdin.

## Modelo de datos

Tablas de negocio: `productos`, `clientes`, `facturas`, `detalle_factura`.
Tablas de seguridad: `usuarios`, `sesiones` (sin entidades JPA; solo vía funciones `cleon_*`).

- `Producto` — tiene `codigo` único, `stock`, `precio` (BigDecimal 12,2), `categoria`, `marca`
- `Cliente` — acumula `totalCompras`, que determina los "clientes destacados"
- `Factura` — tiene estado `EstadoFactura`: `PENDIENTE` | `PAGADA` | `ANULADA`
- `DetalleFactura` — líneas de la factura, con precio unitario congelado al momento de la venta

Hibernate está en **`ddl-auto=validate`**: comprueba que las entidades coincidan con las tablas
pero **no las crea ni las modifica** (cleon_app no tiene permiso). Al agregar o cambiar un campo
en una entidad hay que escribir el `ALTER TABLE` en un script de `db/`, ejecutarlo como
`postgres` y, si es una tabla o columna nueva que la app debe usar, dar el permiso a
`cleon_app` en `db/seguridad.sql`. Si no, el backend no arranca (validate falla).

## Reglas de negocio (no obvias)

- **El stock se descuenta al CREAR la factura**, no al pagarla.
- **El `totalCompras` del cliente se suma al PAGAR**, no al crear. Así el ranking de
  "destacados" solo refleja dinero realmente cobrado y cuadra con el "Facturado" del
  dashboard, que también cuenta solo las `PAGADA`.
- **Anular una factura devuelve el stock** de cada producto, y resta del `totalCompras`
  del cliente **solo si la factura estaba pagada** (si estaba pendiente, ese monto nunca
  se había sumado).
- **Las facturas nunca se borran**, solo se anulan: `cleon_app` no tiene `DELETE` sobre
  `facturas` ni `detalle_factura`.
- Al crear una factura se hace `saveAndFlush` primero para obtener el ID antes de
  agregar los detalles — el orden importa por la relación en PostgreSQL.
- Los precios y totales usan `BigDecimal`, nunca `double` ni `float`.
- El umbral de "stock bajo" se define **una sola vez** en
  `ProductoService.STOCK_BAJO_POR_DEFECTO` y el frontend lo lee desde
  `GET /api/productos/opciones`. No repetirlo como número fijo en el JS.

## Trampas conocidas

- **Entidades bidireccionales y Lombok**: `Factura` ↔ `DetalleFactura` se apuntan
  mutuamente. Sus relaciones llevan `@ToString.Exclude` y `@EqualsAndHashCode.Exclude`
  porque sin eso `@Data` genera recursión infinita (`StackOverflowError`). Al agregar una
  relación nueva entre entidades, excluirla igual.
- **Jackson 3 ignora los setters si hay `@AllArgsConstructor`**: deserializa por el
  constructor con todos los argumentos. Los DTOs que limpian texto en sus setters llevan
  `@NoArgsConstructor(onConstructor_ = @JsonCreator)` para forzar el uso de los setters.
  Mantenerlo en cualquier DTO de entrada nuevo que sanee datos.
- **Parámetros opcionales en consultas JPQL contra PostgreSQL**: si un parámetro puede
  llegar en `null` y se usa dentro de `LOWER()` o `CONCAT()`, hay que envolverlo en
  `CAST(:param AS String)`. Sin el cast, PostgreSQL no deduce el tipo y falla con
  `function lower(bytea) does not exist`. Ver `ProductoRepository.buscarConFiltros`.
- **`LIKE` con texto del usuario**: escapar con `Sanitizador.escaparLike` y poner
  `ESCAPE '\\'` en la consulta (las consultas derivadas `Containing` de Spring Data ya lo hacen solas).
- **`AuthService` no es `@Transactional` a propósito**: un login fallido lanza excepción y
  el rollback desharía el conteo de intentos fallidos.
- **Filtros de seguridad**: se crean con `new` en `SeguridadConfig`, no como `@Component`,
  para que Spring Boot no los registre dos veces.
- **Colisión de nombres en `ErrorResponse`**: la clase propia del proyecto se llama igual
  que la interfaz `org.springframework.web.ErrorResponse`. En `GlobalExceptionHandler` la
  de Spring se referencia con el nombre completo.
- **CSP y Live Server**: `index.html` permite el script de recarga de Live Server por su
  hash. Si una versión nueva de Live Server lo cambia, la recarga automática deja de andar
  (la app no se afecta): recalcular el hash del script inyectado.

## Convenciones

- **Todo el código está en español**: clases, métodos, variables, comentarios y mensajes
  de error. Mantener ese idioma al escribir código nuevo.
- Nombres de paquetes internos en **PascalCase** (`Controller`, `Service`, `Model.Entity`) —
  no es lo convencional en Java, pero es el patrón del proyecto; respetarlo.
- Validación con anotaciones de Jakarta (`@NotBlank`, `@Size`, `@Pattern`, `@Positive`...)
  sobre DTOs y parámetros, y `@Valid` en los controllers. Todo campo de texto nuevo lleva
  límite de tamaño y patrón de lista blanca.
- Las consultas siempre con parámetros (`:nombre` en JPQL/JdbcClient); nunca concatenar
  texto del usuario, ni usarlo como nombre de columna (ver `FacturaService.parsearOrden`).
- En el frontend, cada recurso tiene su grupo en el objeto `Api` de `js/api.js`
  (`Api.auth`, `Api.productos`, `Api.clientes`, `Api.facturas`). Los endpoints nuevos se agregan ahí.
  Todo dato que se pinte con `innerHTML` pasa por `escapeHtml`.
- Navegación por hash (`#/productos`, `#/facturacion/nueva`) manejada en `js/main.js`.

## Estado actual y pendientes conocidos

- **Renombrado sin commitear**: el proyecto ya se llama `comercializados_leon` en todas
  partes (paquete, `pom.xml`, clase principal, tests), pero git todavía ve el paquete
  viejo `alamcenamiento_leon` como borrado y el nuevo como sin trackear. Falta el commit.
- **Contraseña vieja de `postgres` en el historial de git**: estuvo en `application.properties`
  (con push a `origin/main`). Ya no se usa en la app, pero hay que rotarla
  (`ALTER ROLE postgres PASSWORD '...'`); borrarla del archivo no la saca del historial.
- **Acceso controlado a carpetas de Windows**: algunos programas (pg_dump, mkcert, python,
  editores externos) no pueden escribir dentro de `Documents`. PowerShell sí. Generar archivos
  fuera y copiarlos, o permitir la aplicación en Seguridad de Windows.
- **`pom.xml` fija `tomcat.version`** por CVEs de Tomcat 11.0.24. Quitarlo cuando Spring Boot
  traiga un Tomcat >= 11.0.25.
- `ErrorResponse` declara `@AllArgsConstructor` pero solo se usa su constructor de dos
  argumentos. Es inofensivo, queda pendiente de limpiar.
