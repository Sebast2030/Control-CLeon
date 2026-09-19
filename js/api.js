/* ==========================================================
   Comercializadora León — Cliente de API

   Se usa la IP del PC en la red local (y no "localhost") para
   que celulares y cualquier otro equipo de la red puedan usar
   el sistema, no solo el PC donde corre el backend.

   Si el router le asigna otra IP al PC, hay que cambiar la
   direccion local de abajo y generar de nuevo el certificado
   HTTPS para la IP nueva (ver "HTTPS" en CLAUDE.md). Para verla
   en Windows: ipconfig (linea "Direccion IPv4").
   ========================================================== */

// Abierto desde el PC o la red del local (Live Server) -> backend local.
// Publicado en comercializadosleon.com -> backend en Render.
const EN_RED_LOCAL = /^(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3})$/
  .test(window.location.hostname);
const API_BASE = EN_RED_LOCAL
  ? 'https://192.168.1.12:8080/api'
  : 'https://api.comercializadosleon.com/api';

/* ---------- Sesion ----------
   El token se guarda en sessionStorage: dura mientras la pestaña esté
   abierta y se borra al cerrarla (no queda guardado en el equipo).
   Si el navegador bloquea sessionStorage, se mantiene solo en memoria. */

const Sesion = {
  CLAVE: 'cleon.token',
  _memoria: null,

  token() {
    try { return sessionStorage.getItem(this.CLAVE) || this._memoria; } catch (_) { return this._memoria; }
  },
  guardar(token) {
    this._memoria = token;
    try { sessionStorage.setItem(this.CLAVE, token); } catch (_) { /* queda en memoria */ }
  },
  borrar() {
    this._memoria = null;
    try { sessionStorage.removeItem(this.CLAVE); } catch (_) { /* nada que borrar */ }
  },
};

// Evento que escucha main.js para volver a la pantalla de login.
const EVENTO_SESION_EXPIRADA = 'cleon:sesion-expirada';

// options.publica = true para las llamadas que no llevan token (el login).
async function apiRequest(path, options = {}) {
  const { publica = false, headers: headersExtra, ...fetchOptions } = options;

  const headers = { 'Content-Type': 'application/json', ...headersExtra };
  const token = Sesion.token();
  if (token && !publica) headers['Authorization'] = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      credentials: 'omit', // la sesion va en la cabecera, nunca en cookies
      cache: 'no-store',
    });
  } catch (err) {
    throw new ApiError('No se pudo conectar con el servidor. ¿Está corriendo el backend en ' + API_BASE + '?', 0, null);
  }

  let data = null;
  const text = await response.text();
  if (text) {
    try { data = JSON.parse(text); } catch (_) { data = null; }
  }

  // Token vencido, cerrado o invalido: se descarta y la app vuelve al login.
  if (response.status === 401 && !publica) {
    Sesion.borrar();
    window.dispatchEvent(new CustomEvent(EVENTO_SESION_EXPIRADA));
  }

  if (!response.ok) {
    const mensaje = (data && (data.mensaje || (data.errores && Object.values(data.errores)[0])))
      || `Error ${response.status}`;
    throw new ApiError(mensaje, response.status, data);
  }

  return data;
}

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body; // puede traer "errores" por campo (validacion)
  }
}

const Api = {
  // ---- Autenticacion ----
  auth: {
    login: (usuario, password) => apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usuario, password }),
      publica: true,
    }),
    sesion: () => apiRequest('/auth/sesion'),
    logout: () => apiRequest('/auth/logout', { method: 'POST' }),
  },

  // ---- Productos ----
  productos: {
    listar: (q, categoria, marca) => {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (categoria) params.set('categoria', categoria);
      if (marca) params.set('marca', marca);
      const qs = params.toString();
      return apiRequest(`/productos${qs ? `?${qs}` : ''}`);
    },
    // Sin "minimo" el backend aplica su propio umbral por defecto.
    stockBajo: (minimo) => apiRequest(`/productos/stock-bajo${minimo != null ? `?minimo=${encodeURIComponent(minimo)}` : ''}`),
    opciones: () => apiRequest('/productos/opciones'),
    crear: (dto) => apiRequest('/productos', { method: 'POST', body: JSON.stringify(dto) }),
    actualizar: (id, dto) => apiRequest(`/productos/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(dto) }),
    eliminar: (id) => apiRequest(`/productos/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },

  // ---- Clientes ----
  clientes: {
    listar: (nombre) => apiRequest(`/clientes${nombre ? `?nombre=${encodeURIComponent(nombre)}` : ''}`),
    destacados: () => apiRequest('/clientes/destacados'),
    crear: (dto) => apiRequest('/clientes', { method: 'POST', body: JSON.stringify(dto) }),
    actualizar: (id, dto) => apiRequest(`/clientes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(dto) }),
    eliminar: (id) => apiRequest(`/clientes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },

  // ---- Facturas ----
  facturas: {
    listar: ({ clienteId, estado, ordenarPor } = {}) => {
      const params = new URLSearchParams();
      if (clienteId) params.set('clienteId', clienteId);
      if (estado) params.set('estado', estado);
      if (ordenarPor) params.set('ordenarPor', ordenarPor);
      const qs = params.toString();
      return apiRequest(`/facturas${qs ? `?${qs}` : ''}`);
    },
    obtener: (id) => apiRequest(`/facturas/${encodeURIComponent(id)}`),
    crear: (dto) => apiRequest('/facturas', { method: 'POST', body: JSON.stringify(dto) }),
    pagar: (id) => apiRequest(`/facturas/${encodeURIComponent(id)}/pagar`, { method: 'PUT' }),
    anular: (id) => apiRequest(`/facturas/${encodeURIComponent(id)}/anular`, { method: 'PUT' }),
  },
};
