/* ==========================================================
   Comercializadora León — App principal (router + vistas)
   ========================================================== */

const app = document.getElementById('app');

// { categorias: [...], marcas: [...], stockBajo: n, recargoNivel2: n }
// El umbral de stock bajo y el recargo de la lista 2 los define el backend; aqui nunca
// se repiten como numero fijo.
let opcionesCache = null;

async function getOpciones() {
  if (opcionesCache) return opcionesCache;
  opcionesCache = await Api.productos.opciones();
  return opcionesCache;
}

const routes = {
  'dashboard':              { render: renderDashboard, group: null },
  'productos':              { render: () => renderProductos(false), group: 'inventario' },
  'productos-stock-bajo':   { render: () => renderProductos(true), group: 'inventario' },
  'clientes':               { render: renderClientes, group: 'clientes' },
  'destacados':             { render: renderDestacados, group: 'clientes' },
  'facturacion-nueva':      { render: renderFacturacionNueva, group: 'facturacion' },
  'facturacion-historial':  { render: () => renderFacturacionHistorial(), group: 'facturacion' },
  'camion-inventario':      { render: renderCamionInventario, group: 'camion' },
  'camion-ventas':          { render: () => renderFacturacionHistorial('CAMION'), group: 'camion' },
  'bodega':                 { render: renderBodega, group: null },
};

const hashToRoute = {
  '#/dashboard': 'dashboard',
  '#/productos': 'productos',
  '#/productos/stock-bajo': 'productos-stock-bajo',
  '#/clientes': 'clientes',
  '#/clientes/destacados': 'destacados',
  '#/facturacion/nueva': 'facturacion-nueva',
  '#/facturacion/historial': 'facturacion-historial',
  '#/camion/inventario': 'camion-inventario',
  '#/camion/ventas': 'camion-ventas',
  '#/bodega': 'bodega',
};

function currentRouteKey() {
  return hashToRoute[window.location.hash] || 'dashboard';
}

function navigate() {
  if (!sesionActiva) return; // sin sesion no se pinta ninguna vista
  const routeKey = currentRouteKey();
  const routeInfo = routes[routeKey];
  document.getElementById('modal-root').innerHTML = ''; // un modal abierto no sigue en otra vista

  document.querySelectorAll('.nav-item-single, .nav-sublink').forEach(el => {
    el.classList.toggle('active', el.dataset.route === routeKey);
  });

  document.querySelectorAll('.nav-group').forEach(group => {
    group.classList.toggle('open', group.dataset.group === routeInfo.group);
  });

  routeInfo.render();
}

function setupNavIcons() {
  document.querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = Icons[el.dataset.icon] || '';
  });
}

function setupAccordion() {
  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.closest('.nav-group');
      const wasOpen = group.classList.contains('open');
      document.querySelectorAll('.nav-group').forEach(g => g.classList.remove('open'));
      group.classList.toggle('open', !wasOpen);
    });
  });
}

function setupMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const menuBtn = document.getElementById('mobile-menu-btn');

  const abrir = () => { sidebar.classList.add('open'); backdrop.classList.add('open'); };
  const cerrar = () => { sidebar.classList.remove('open'); backdrop.classList.remove('open'); };

  menuBtn.addEventListener('click', abrir);
  backdrop.addEventListener('click', cerrar);
  // Cerrar el menu automaticamente al elegir cualquier opcion (solo aplica en movil, no estorba en escritorio)
  sidebar.querySelectorAll('.nav-item-single, .nav-sublink').forEach(el => el.addEventListener('click', cerrar));
}

window.addEventListener('hashchange', navigate);

// Cualquier 401 de la API (token vencido, cerrado en otro equipo, contraseña cambiada)
// devuelve al login.
window.addEventListener(EVENTO_SESION_EXPIRADA, () => {
  if (sesionActiva) mostrarLogin('Tu sesión venció o se cerró. Inicia sesión de nuevo.');
});

window.addEventListener('DOMContentLoaded', async () => {
  setupNavIcons();
  setupAccordion();
  setupMobileMenu();
  setupLogin();

  // Si hay un token guardado de esta pestaña, se confirma con el backend antes de
  // mostrar nada: puede haber vencido o haberse cerrado.
  if (!Sesion.token()) {
    mostrarLogin();
    return;
  }
  try {
    mostrarApp(await Api.auth.sesion());
  } catch (err) {
    mostrarLogin(err.status === 401 ? 'Tu sesión venció. Inicia sesión de nuevo.' : err.message);
  }
});

/* ==========================================================
   SESION: inicio y cierre
   ========================================================== */

let sesionActiva = false;

function mostrarApp(sesion) {
  sesionActiva = true;
  document.getElementById('login-screen').hidden = true;
  document.getElementById('layout').hidden = false;
  // Solo el rol: el nombre de usuario no se muestra en pantalla.
  document.getElementById('sidebar-usuario').textContent = 'Administrador';
  if (!window.location.hash) window.location.hash = '#/dashboard';
  navigate();
  checkApiStatus();
}

// Vuelve al login y borra de la pagina todo lo que se estaba viendo, para que nadie
// pueda leer datos en un equipo donde la sesion ya se cerro.
function mostrarLogin(mensaje = '', tipo = 'error') {
  sesionActiva = false;
  Sesion.borrar();
  opcionesCache = null;
  dashboardData = null;
  clientesState = { items: [], filtroNombre: '', filtroCiudad: '' };
  borrarBorrador();
  facturacionState.clientes = [];
  facturacionState.productos = [];
  camionState = { items: [], q: '' };
  bodegaState = { items: [], q: '', categoria: '', mostrarTodos: false };
  historialState = { estado: '', clienteId: '', origen: '', ordenarPor: '', facturas: [], detalleCache: {} };
  app.innerHTML = '';
  document.getElementById('modal-root').innerHTML = '';
  document.getElementById('sidebar-usuario').textContent = '';
  document.getElementById('layout').hidden = true;
  document.getElementById('login-screen').hidden = false;

  const password = document.getElementById('login-password');
  password.value = '';
  mostrarPassword(false);
  mostrarMensajeLogin(mensaje, tipo);
  document.getElementById('login-usuario').focus();
}

function mostrarMensajeLogin(mensaje, tipo = 'error') {
  const el = document.getElementById('login-error');
  el.textContent = mensaje || '';
  el.className = `login-error ${tipo}`;
  el.hidden = !mensaje;
}

function mostrarPassword(visible) {
  const input = document.getElementById('login-password');
  const boton = document.getElementById('login-ver-password');
  input.type = visible ? 'text' : 'password';
  boton.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
  boton.querySelector('.icon').innerHTML = Icons[visible ? 'eyeOff' : 'eye'];
}

function setupLogin() {
  const form = document.getElementById('login-form');
  const usuario = document.getElementById('login-usuario');
  const password = document.getElementById('login-password');
  const boton = document.getElementById('login-submit');

  document.getElementById('login-ver-password').addEventListener('click', () => {
    mostrarPassword(password.type === 'password');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valorUsuario = usuario.value.trim();
    // La contraseña se manda tal cual, sin recortar espacios.
    const valorPassword = password.value;
    if (!valorUsuario || !valorPassword) {
      mostrarMensajeLogin('Escribe tu usuario y tu contraseña.');
      return;
    }

    boton.disabled = true;
    mostrarMensajeLogin('');
    try {
      const respuesta = await Api.auth.login(valorUsuario, valorPassword);
      Sesion.guardar(respuesta.token);
      password.value = '';
      mostrarPassword(false);
      mostrarApp(respuesta);
    } catch (err) {
      password.value = '';
      mostrarMensajeLogin(err.message);
      password.focus();
    } finally {
      boton.disabled = false;
    }
  });

  document.getElementById('btn-logout').addEventListener('click', async () => {
    try {
      await Api.auth.logout();
    } catch (_) {
      // Aunque el backend no responda, en este equipo la sesion se cierra igual.
    }
    mostrarLogin('Sesión cerrada.', 'info');
  });
}

async function checkApiStatus() {
  const el = document.getElementById('api-status');
  try {
    await Api.productos.listar();
    el.textContent = 'Backend conectado';
    el.className = 'api-status ok';
  } catch (err) {
    el.textContent = 'Backend no disponible';
    el.className = 'api-status error';
  }
}

/* ==========================================================
   DASHBOARD
   ========================================================== */

const PERIODOS = ['historico', 'anio', 'mes'];
const PERIODO_LABEL = { historico: 'Histórico', anio: 'Este año', mes: 'Este mes' };
let dashboardData = null; // cache de facturas/productos/clientes para recalcular el slider sin refetch
let periodoIndex = 0;

async function renderDashboard() {
  periodoIndex = 0;
  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${icon('dashboard')} Dashboard</h1>
        <p class="page-subtitle">Resumen general del negocio</p>
      </div>
    </div>

    <div class="stat-grid" id="stat-grid">
      ${statCard('box', '—', 'Productos en inventario')}
      ${statCard('alert', '—', 'Productos con stock bajo')}
      ${statCard('users', '—', 'Clientes registrados')}
      <div class="stat-card" id="stat-periodo">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div class="stat-icon">${icon('wallet')}</div>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-ghost btn-sm" id="periodo-prev" type="button" style="transform:scaleX(-1);">${icon('chevron')}</button>
            <button class="btn btn-ghost btn-sm" id="periodo-next" type="button">${icon('chevron')}</button>
          </div>
        </div>
        <div class="stat-value" id="periodo-valor">—</div>
        <div class="stat-label" id="periodo-label">Facturado · cargando…</div>
      </div>
    </div>

    <h2 class="dashboard-section-title">Accesos rápidos</h2>
    <div class="quick-actions">
      <button class="quick-action" id="qa-producto">
        <span class="quick-action-icon">${icon('plus')}</span>
        <span>
          <span class="quick-action-title">Nuevo producto</span>
          <span class="quick-action-desc">Agregar una pieza al inventario</span>
        </span>
      </button>
      <button class="quick-action" id="qa-cliente">
        <span class="quick-action-icon">${icon('plus')}</span>
        <span>
          <span class="quick-action-title">Nuevo cliente</span>
          <span class="quick-action-desc">Registrar un cliente nuevo</span>
        </span>
      </button>
      <button class="quick-action" id="qa-factura">
        <span class="quick-action-icon">${icon('receipt')}</span>
        <span>
          <span class="quick-action-title">Nueva factura</span>
          <span class="quick-action-desc">Facturar una venta</span>
        </span>
      </button>
    </div>

    <div class="dashboard-columns">
      <div>
        <h2 class="dashboard-section-title">${icon('alert')} Stock bajo</h2>
        <div class="table-wrap" id="dash-stock-bajo">
          <p class="skeleton-text" style="padding:20px;">Cargando…</p>
        </div>
      </div>
      <div>
        <h2 class="dashboard-section-title">${icon('star')} Top clientes</h2>
        <div class="panel" id="dash-destacados">
          <p class="skeleton-text">Cargando…</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('qa-producto').addEventListener('click', () => abrirModalProducto());
  document.getElementById('qa-cliente').addEventListener('click', () => abrirModalCliente());
  document.getElementById('qa-factura').addEventListener('click', () => { window.location.hash = '#/facturacion/nueva'; });
  document.getElementById('periodo-prev').addEventListener('click', () => cambiarPeriodo(-1));
  document.getElementById('periodo-next').addEventListener('click', () => cambiarPeriodo(1));

  cargarStatsDashboard();
}

async function cargarStatsDashboard() {
  try {
    const [opciones, productos, clientes, facturas] = await Promise.all([
      getOpciones(),
      Api.productos.listar(),
      Api.clientes.listar(),
      Api.facturas.listar(),
    ]);

    dashboardData = { productos, clientes, facturas };

    const stockBajo = productos.filter(p => p.stock <= opciones.stockBajo);

    const grid = document.getElementById('stat-grid');
    grid.innerHTML = statCard('box', productos.length, 'Productos en inventario')
      + statCard('alert', stockBajo.length, 'Productos con stock bajo')
      + statCard('users', clientes.length, 'Clientes registrados')
      + grid.querySelector('#stat-periodo').outerHTML;

    // Reasignar listeners porque innerHTML se reemplazo
    document.getElementById('periodo-prev').addEventListener('click', () => cambiarPeriodo(-1));
    document.getElementById('periodo-next').addEventListener('click', () => cambiarPeriodo(1));

    pintarPeriodo();

    const stockBajoPanel = document.getElementById('dash-stock-bajo');
    if (!stockBajo.length) {
      stockBajoPanel.innerHTML = `<p class="skeleton-text" style="padding:20px;">Ningún producto con stock bajo. Todo en orden.</p>`;
    } else {
      stockBajoPanel.innerHTML = `
        <table>
          <thead><tr><th>Código</th><th>Nombre</th><th>Marca</th><th class="num">Stock</th></tr></thead>
          <tbody>
            ${stockBajo.slice(0, 6).map(p => `
              <tr>
                <td><span class="code-tag">${escapeHtml(p.codigo)}</span></td>
                <td>${escapeHtml(p.nombre)}</td>
                <td class="muted">${escapeHtml(p.marca || '—')}</td>
                <td class="num stock-low">${p.stock}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    const destacados = await Api.clientes.destacados();
    const destPanel = document.getElementById('dash-destacados');
    if (!destacados.length) {
      destPanel.innerHTML = `<p class="skeleton-text">Aún no hay compras registradas.</p>`;
    } else {
      destPanel.innerHTML = destacados.slice(0, 5).map((c, i) => `
        <div class="mini-ranking-item">
          <div class="mini-ranking-num">${i + 1}</div>
          <div class="mini-ranking-name">${escapeHtml(c.nombre)}</div>
          <div class="mini-ranking-total">${formatMoney(c.totalCompras)}</div>
        </div>
      `).join('');
    }
  } catch (err) {
    showApiError(err);
  }
}

function cambiarPeriodo(delta) {
  periodoIndex = (periodoIndex + delta + PERIODOS.length) % PERIODOS.length;
  pintarPeriodo();
}

// Se recalcula siempre a partir de la fecha actual real, asi que al entrar
// un mes o año nuevo, el periodo "Este mes" / "Este año" avanza solo, sin
// necesidad de guardar nada aparte.
function pintarPeriodo() {
  if (!dashboardData) return;
  const periodo = PERIODOS[periodoIndex];
  const ahora = new Date();

  const pagadas = dashboardData.facturas.filter(f => f.estado === 'PAGADA');

  let filtradas = pagadas;
  if (periodo === 'anio') {
    filtradas = pagadas.filter(f => new Date(f.fecha).getFullYear() === ahora.getFullYear());
  } else if (periodo === 'mes') {
    filtradas = pagadas.filter(f => {
      const d = new Date(f.fecha);
      return d.getFullYear() === ahora.getFullYear() && d.getMonth() === ahora.getMonth();
    });
  }

  const total = filtradas.reduce((sum, f) => sum + Number(f.total), 0);

  document.getElementById('periodo-valor').textContent = formatMoney(total);
  document.getElementById('periodo-label').textContent = `Facturado · ${PERIODO_LABEL[periodo]} (${filtradas.length} fact.)`;
}

function statCard(iconName, value, label) {
  return `
    <div class="stat-card">
      <div class="stat-icon">${icon(iconName)}</div>
      <div class="stat-value">${value}</div>
      <div class="stat-label">${label}</div>
    </div>
  `;
}

/* ==========================================================
   INVENTARIO
   ========================================================== */

let productosState = { items: [], q: '', categoria: '', marca: '', lista: 1, soloStockBajo: false, umbralStockBajo: null, recargo: 0 };

async function renderProductos(soloStockBajo) {
  const opciones = await getOpciones();
  productosState = {
    items: [], q: '', categoria: '', marca: '', lista: 1, soloStockBajo,
    umbralStockBajo: opciones.stockBajo, recargo: opciones.recargoNivel2,
  };

  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${icon(soloStockBajo ? 'alert' : 'box')} ${soloStockBajo ? 'Stock bajo' : 'Inventario'}</h1>
        <p class="page-subtitle">${soloStockBajo ? `Productos con ${opciones.stockBajo} unidades o menos` : 'Productos disponibles en el local (el stock incluye lo cargado en el camión)'}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-nuevo-producto">${icon('plus')} Nuevo producto</button>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-box">
        ${icon('search')}
        <input autocomplete="off" type="text" class="input" id="buscar-producto" maxlength="100" placeholder="Buscar por nombre o código (ej: SC)…" ${soloStockBajo ? 'disabled' : ''}>
      </div>
      <select class="select" id="filtro-categoria" ${soloStockBajo ? 'disabled' : ''}>
        <option value="">Todas las categorías</option>
        ${opciones.categorias.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
      </select>
      <select class="select" id="filtro-marca" ${soloStockBajo ? 'disabled' : ''}>
        <option value="">Todas las marcas</option>
        ${opciones.marcas.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
      </select>
      <select class="select" id="filtro-lista" aria-label="Lista de precios">
        ${NIVELES_PRECIO.map(n => `<option value="${n}">${nombreLista(n)}</option>`).join('')}
      </select>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th class="hide-mobile">Categoría</th>
            <th class="num" id="th-precio">Precio</th>
            <th class="num" title="Stock general: incluye lo que va en el camión">Stock</th>
            <th class="num hide-mobile" title="Unidades del stock que van cargadas en el camión">Camión</th>
            <th class="hide-mobile">Marca</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="productos-tbody">
          <tr class="empty-row"><td colspan="8">Cargando…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-nuevo-producto').addEventListener('click', () => abrirModalProducto());
  document.getElementById('filtro-lista').addEventListener('change', (e) => {
    productosState.lista = Number(e.target.value);
    document.getElementById('th-precio').textContent = productosState.lista === 1 ? 'Precio' : `Precio (lista ${productosState.lista})`;
    pintarProductos(productosState.items);
  });

  if (!soloStockBajo) {
    document.getElementById('buscar-producto').addEventListener('input', debounce((e) => {
      productosState.q = e.target.value;
      cargarProductos();
    }, 300));
    document.getElementById('filtro-categoria').addEventListener('change', (e) => {
      productosState.categoria = e.target.value;
      cargarProductos();
    });
    document.getElementById('filtro-marca').addEventListener('change', (e) => {
      productosState.marca = e.target.value;
      cargarProductos();
    });
  }

  await cargarProductos();
}

async function cargarProductos() {
  const tbody = document.getElementById('productos-tbody');
  if (!tbody) return;
  try {
    const data = productosState.soloStockBajo
      ? await Api.productos.stockBajo()
      : await Api.productos.listar(productosState.q, productosState.categoria, productosState.marca);
    productosState.items = data;
    pintarProductos(data);
  } catch (err) {
    showApiError(err);
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No se pudo cargar el inventario.</td></tr>`;
  }
}

function pintarProductos(items) {
  const tbody = document.getElementById('productos-tbody');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No hay productos que coincidan. Crea uno con "Nuevo producto".</td></tr>`;
    return;
  }
  const { lista, recargo } = productosState;
  tbody.innerHTML = items.map(p => {
    const precio = precioSegunNivel(p, lista, recargo);
    return `
    <tr>
      <td><span class="code-tag">${escapeHtml(p.codigo)}</span></td>
      <td>${escapeHtml(p.nombre)}</td>
      <td class="muted hide-mobile">${escapeHtml(p.categoria || '—')}</td>
      <td class="num">${precio == null ? '<span class="text-muted">Libre</span>' : formatMoney(precio)}</td>
      <td class="num ${p.stock <= productosState.umbralStockBajo ? 'stock-low' : ''}">${p.stock}</td>
      <td class="num muted hide-mobile">${p.stockCamion || '—'}</td>
      <td class="muted hide-mobile">${escapeHtml(p.marca || '—')}</td>
      <td class="actions">
        <button class="btn btn-ghost btn-sm" data-sumar="${p.id}" title="Agregar unidades" aria-label="Agregar unidades">${icon('plus')}</button>
        <button class="btn btn-ghost btn-sm" data-trasladar="${p.id}" title="Trasladar al camión o a bodega" aria-label="Trasladar">${icon('transfer')}</button>
        <button class="btn btn-ghost btn-sm" data-edit="${p.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>
        <button class="btn btn-ghost btn-sm" data-delete="${p.id}" data-nombre="${escapeHtml(p.nombre)}" title="Eliminar" aria-label="Eliminar">${icon('trash')}</button>
      </td>
    </tr>
  `;
  }).join('');

  const buscar = (id) => productosState.items.find(p => p.id == id);
  tbody.querySelectorAll('[data-sumar]').forEach(btn => btn.addEventListener('click', () => {
    abrirModalEntrada(buscar(btn.dataset.sumar), 'GENERAL', cargarProductos);
  }));
  tbody.querySelectorAll('[data-trasladar]').forEach(btn => btn.addEventListener('click', () => {
    abrirModalTraslado({ producto: buscar(btn.dataset.trasladar), origen: 'GENERAL', destino: 'CAMION', onHecho: cargarProductos });
  }));
  tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
    abrirModalProducto(buscar(btn.dataset.edit));
  }));
  tbody.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirmDialog(`¿Eliminar "${btn.dataset.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await Api.productos.eliminar(btn.dataset.delete);
      showToast('Producto eliminado', 'success');
      cargarProductos();
    } catch (err) { showApiError(err); }
  }));
}

// almacen: 'GENERAL' (inventario del local) o 'BODEGA'. Desde la bodega, el stock que
// se edita es el de bodega y un producto nuevo nace con el stock general en 0.
// onGuardado(producto): lo que se hace despues de guardar (por defecto, recargar el inventario).
async function abrirModalProducto(producto = null, { almacen = 'GENERAL', onGuardado = null } = {}) {
  const esEdicion = !!producto;
  const esBodega = almacen === 'BODEGA';
  const opciones = await getOpciones();
  const campoStock = esBodega ? 'stockBodega' : 'stock';
  const valorStock = esBodega ? producto?.stockBodega : producto?.stock;

  openModal({
    title: esEdicion ? 'Editar producto' : (esBodega ? 'Nuevo producto en bodega' : 'Nuevo producto'),
    submitLabel: esEdicion ? 'Guardar cambios' : 'Crear producto',
    bodyHtml: `
      ${esEdicion ? `
        <div class="field">
          <label>Código</label>
          <input autocomplete="off" class="input" value="${escapeHtml(producto.codigo)}" disabled>
        </div>
      ` : ''}
      <div class="field">
        <label for="f-nombre">Nombre</label>
        <input autocomplete="off" class="input" id="f-nombre" name="nombre" required maxlength="120" value="${escapeHtml(producto?.nombre || '')}" placeholder="Ej: Silenciador deportivo 2&quot;">
      </div>
      <div class="field">
        <label for="f-categoria">Categoría</label>
        <select class="select" id="f-categoria" name="categoria" required>
          <option value="">Selecciona…</option>
          ${opciones.categorias.map(c => `<option value="${escapeHtml(c)}" ${producto?.categoria === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="f-marca">Marca</label>
        <select class="select" id="f-marca" name="marca" required>
          <option value="">Selecciona…</option>
          ${opciones.marcas.map(m => `<option value="${escapeHtml(m)}" ${producto?.marca === m ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="f-precio-display">Precio (COP)</label>
        <div class="money-input">
          <span class="money-prefix">$</span>
          <input type="text" inputmode="numeric" id="f-precio-display" placeholder="0" autocomplete="off">
          <div class="money-steppers">
            <button type="button" class="stepper-btn" id="f-precio-up" tabindex="-1">${icon('caretUp')}</button>
            <button type="button" class="stepper-btn" id="f-precio-down" tabindex="-1">${icon('caretDown')}</button>
          </div>
        </div>
        <input autocomplete="off" type="hidden" id="f-precio" name="precio" value="${producto?.precio ?? 0}">
      </div>
      <div class="field">
        <label for="f-stock">${esBodega ? 'Unidades en bodega' : 'Stock'}</label>
        <input autocomplete="off" class="input" id="f-stock" name="${campoStock}" type="number" min="0" max="1000000" step="1" required value="${valorStock ?? ''}">
        ${!esBodega && producto?.stockCamion ? `<p class="field-hint">${producto.stockCamion} de estas unidades van cargadas en el camión.</p>` : ''}
      </div>
      ${!esEdicion ? `<p class="text-muted" style="font-size:12.5px;">El código se arma automáticamente con la categoría y la marca (ej: Silenciador + CLeón → SC-0001).</p>` : ''}
    `,
    onMount: (overlay) => {
      setupMoneyStepper(overlay, Number(producto?.precio) || 0);
    },
    onSubmit: async (formData, overlay, close) => {
      const unidades = Number(formData.get(campoStock));
      const dto = {
        nombre: limpiarTexto(formData.get('nombre')),
        categoria: formData.get('categoria'),
        marca: formData.get('marca'),
        precio: Number(formData.get('precio')),
        // Desde la bodega el stock general no se toca (y un producto nuevo arranca en 0).
        stock: esBodega ? (producto ? producto.stock : 0) : unidades,
      };
      if (esBodega) dto.stockBodega = unidades;

      const hayErrores = mostrarErroresDeCampos(overlay, {
        nombre: validarCampo(dto.nombre, { requerido: true, min: 2, max: 120, regla: REGLAS.texto, etiqueta: 'El nombre' }),
        categoria: dto.categoria ? null : 'Elige una categoría',
        marca: dto.marca ? null : 'Elige una marca',
        precio: Number.isFinite(dto.precio) && dto.precio >= 0 && dto.precio <= 9999999999 ? null : 'Precio inválido',
        [campoStock]: Number.isInteger(unidades) && unidades >= 0 && unidades <= 1000000
          ? null : 'El stock debe ser un número entero entre 0 y 1.000.000',
      });
      if (hayErrores) return;

      try {
        let guardado;
        if (esEdicion) {
          guardado = await Api.productos.actualizar(producto.id, dto);
          showToast('Producto actualizado', 'success');
        } else {
          guardado = await Api.productos.crear(dto);
          showToast(`Producto creado con código ${guardado.codigo}`, 'success');
        }
        close();
        if (onGuardado) await onGuardado(guardado);
        else cargarProductos();
      } catch (err) {
        applyValidationErrors(err, overlay);
      }
    },
  });
}

// Boton "+": suma unidades que llegaron, sin tocar nada mas del producto.
// almacen: 'GENERAL' o 'BODEGA'.
function abrirModalEntrada(producto, almacen, onHecho) {
  if (!producto) return;
  const enBodega = almacen === 'BODEGA';
  const actual = enBodega ? producto.stockBodega : producto.stock;
  openModal({
    title: enBodega ? 'Agregar unidades a bodega' : 'Agregar unidades',
    submitLabel: 'Agregar',
    bodyHtml: `
      <p class="modal-product"><span class="code-tag">${escapeHtml(producto.codigo)}</span> ${escapeHtml(producto.nombre)}</p>
      <p class="text-muted" style="font-size:13px;margin-top:0;">
        ${enBodega ? 'En bodega' : 'Stock general'} ahora: <strong>${actual}</strong> unidades.
        Solo se suma la cantidad; el resto del producto no cambia.
      </p>
      <div class="field">
        <label for="e-cantidad">Unidades que llegaron</label>
        <input autocomplete="off" class="input" id="e-cantidad" name="cantidad" type="number" min="1" max="1000000" step="1" required>
      </div>
    `,
    onMount: (overlay) => overlay.querySelector('#e-cantidad').focus(),
    onSubmit: async (formData, overlay, close) => {
      const cantidad = Number(formData.get('cantidad'));
      if (mostrarErroresDeCampos(overlay, {
        cantidad: esCantidadValida(cantidad, 1000000) ? null : 'Escribe un número entero entre 1 y 1.000.000',
      })) return;
      try {
        const actualizado = await Api.productos.agregarUnidades(producto.id, almacen, cantidad);
        const nuevo = enBodega ? actualizado.stockBodega : actualizado.stock;
        showToast(`Se agregaron ${cantidad} unidades. Ahora hay ${nuevo}.`, 'success');
        close();
        if (onHecho) onHecho(actualizado);
      } catch (err) {
        applyValidationErrors(err, overlay);
      }
    },
  });
}

// Traslado de unidades entre el local (GENERAL), el camion y la bodega.
// Sin producto, se elige de una lista con los que tienen unidades en el origen.
async function abrirModalTraslado({ producto = null, origen = 'GENERAL', destino = 'CAMION', onHecho = null } = {}) {
  let productos;
  try {
    productos = producto ? [producto] : await Api.productos.listar();
  } catch (err) {
    showApiError(err);
    return;
  }

  const opcionesAlmacen = (seleccionado) => Object.entries(ALMACENES)
    .map(([valor, nombre]) => `<option value="${valor}" ${valor === seleccionado ? 'selected' : ''}>${escapeHtml(nombre)}</option>`)
    .join('');

  openModal({
    title: 'Trasladar unidades',
    submitLabel: 'Trasladar',
    bodyHtml: `
      ${producto ? `<p class="modal-product"><span class="code-tag">${escapeHtml(producto.codigo)}</span> ${escapeHtml(producto.nombre)}</p>` : ''}
      <div class="form-row-2">
        <div class="field">
          <label for="t-origen">Desde</label>
          <select class="select" id="t-origen" name="origen">${opcionesAlmacen(origen)}</select>
        </div>
        <div class="field">
          <label for="t-destino">Hacia</label>
          <select class="select" id="t-destino" name="destino">${opcionesAlmacen(destino)}</select>
        </div>
      </div>
      ${producto ? '' : `
        <div class="field">
          <label for="t-producto-buscar">Producto</label>
          <input autocomplete="off" class="input" id="t-producto-buscar" maxlength="100" placeholder="Escribe nombre o código…" style="margin-bottom:6px;">
          <select class="select" id="t-producto" name="productoId"></select>
        </div>
      `}
      <div class="field">
        <label for="t-cantidad">Cantidad</label>
        <input autocomplete="off" class="input" id="t-cantidad" name="cantidad" type="number" min="1" max="1000000" step="1" required>
        <p class="field-hint" id="t-disponible"></p>
      </div>
      <p class="text-muted" style="font-size:12.5px;">
        El camión hace parte del inventario general: pasar unidades entre el local y el camión no cambia el stock general.
        Lo que está en bodega no se puede facturar.
      </p>
    `,
    onMount: (overlay) => {
      const selOrigen = overlay.querySelector('#t-origen');
      const selProducto = overlay.querySelector('#t-producto');
      const hint = overlay.querySelector('#t-disponible');

      const productoElegido = () => producto || productos.find(p => String(p.id) === selProducto?.value) || null;
      const pintarDisponible = () => {
        const p = productoElegido();
        hint.textContent = p ? `Disponible en ${ALMACENES[selOrigen.value].toLowerCase()}: ${disponibleEn(p, selOrigen.value)}` : '';
      };
      const pintarProductos = () => {
        if (!selProducto) return;
        const anterior = selProducto.value;
        const conUnidades = productos.filter(p => disponibleEn(p, selOrigen.value) > 0);
        selProducto.innerHTML = conUnidades.length
          ? conUnidades.map(p => `<option value="${p.id}">${escapeHtml(p.codigo)} — ${escapeHtml(p.nombre)} (${disponibleEn(p, selOrigen.value)})</option>`).join('')
          : '<option value="">No hay productos con unidades ahí</option>';
        if (conUnidades.some(p => String(p.id) === anterior)) selProducto.value = anterior;
        overlay.querySelector('#t-producto-buscar').value = '';
      };

      selOrigen.addEventListener('change', () => { pintarProductos(); pintarDisponible(); });
      if (selProducto) {
        selProducto.addEventListener('change', pintarDisponible);
        setupAutocompleteFilter('t-producto-buscar', 't-producto');
      }
      pintarProductos();
      pintarDisponible();
    },
    onSubmit: async (formData, overlay, close) => {
      const desde = formData.get('origen');
      const hacia = formData.get('destino');
      const p = producto || productos.find(x => String(x.id) === formData.get('productoId'));
      const cantidad = Number(formData.get('cantidad'));

      const hayErrores = mostrarErroresDeCampos(overlay, {
        destino: desde === hacia ? 'Elige un destino distinto del origen' : null,
        productoId: producto || p ? null : 'Elige un producto',
        cantidad: !esCantidadValida(cantidad, 1000000) ? 'Escribe un número entero, al menos 1'
          : (p && cantidad > disponibleEn(p, desde) ? `Solo hay ${disponibleEn(p, desde)} disponibles` : null),
      });
      if (hayErrores) return;

      try {
        const actualizado = await Api.productos.trasladar(p.id, { origen: desde, destino: hacia, cantidad });
        showToast(`Trasladadas ${cantidad} unidades de "${actualizado.nombre}": ${ALMACENES[desde]} → ${ALMACENES[hacia]}`, 'success');
        close();
        if (onHecho) onHecho(actualizado);
      } catch (err) {
        applyValidationErrors(err, overlay);
      }
    },
  });
}

/* ==========================================================
   CAMION — Inventario del camion
   ========================================================== */

let camionState = { items: [], q: '' };

async function renderCamionInventario() {
  camionState = { items: [], q: '' };
  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${icon('truck')} Inventario del camión</h1>
        <p class="page-subtitle">Lo cargado en el camión sigue siendo parte del inventario general: al vender desde el camión se descuenta de los dos.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-cargar-camion">${icon('truck')} Cargar productos al camión</button>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-box">
        ${icon('search')}
        <input autocomplete="off" type="text" class="input" id="buscar-camion" maxlength="100" placeholder="Buscar por nombre o código…">
      </div>
    </div>
    <p class="summary-line" id="camion-resumen"></p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th class="hide-mobile">Marca</th>
            <th class="num">En camión</th>
            <th class="num hide-mobile">En el local</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="camion-tbody">
          <tr class="empty-row"><td colspan="6">Cargando…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-cargar-camion').addEventListener('click', () =>
    abrirModalTraslado({ origen: 'GENERAL', destino: 'CAMION', onHecho: cargarCamion }));
  document.getElementById('buscar-camion').addEventListener('input', debounce((e) => {
    camionState.q = e.target.value;
    pintarCamion();
  }, 200));

  await cargarCamion();
}

async function cargarCamion() {
  const tbody = document.getElementById('camion-tbody');
  if (!tbody) return;
  try {
    const productos = await Api.productos.listar();
    camionState.items = productos.filter(p => p.stockCamion > 0);
    pintarCamion();
  } catch (err) {
    showApiError(err);
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No se pudo cargar el inventario del camión.</td></tr>`;
  }
}

function pintarCamion() {
  const tbody = document.getElementById('camion-tbody');
  if (!tbody) return;
  const { items } = camionState;
  const unidades = items.reduce((s, p) => s + p.stockCamion, 0);
  document.getElementById('camion-resumen').textContent =
    `${items.length} ${items.length === 1 ? 'producto' : 'productos'} · ${unidades} unidades en el camión`;

  const visibles = filtrarPorTexto(items, camionState.q);
  if (!visibles.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${items.length
      ? 'Ningún producto del camión coincide con la búsqueda.'
      : 'El camión está vacío. Cárgalo con "Cargar productos al camión".'}</td></tr>`;
    return;
  }
  tbody.innerHTML = visibles.map(p => `
    <tr>
      <td><span class="code-tag">${escapeHtml(p.codigo)}</span></td>
      <td>${escapeHtml(p.nombre)}</td>
      <td class="muted hide-mobile">${escapeHtml(p.marca || '—')}</td>
      <td class="num"><strong>${p.stockCamion}</strong></td>
      <td class="num muted hide-mobile">${p.stock - p.stockCamion}</td>
      <td class="actions">
        <button class="btn btn-ghost btn-sm" data-trasladar="${p.id}" title="Devolver al local o pasar a bodega">${icon('transfer')} Mover</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-trasladar]').forEach(btn => btn.addEventListener('click', () => {
    const producto = camionState.items.find(p => p.id == btn.dataset.trasladar);
    abrirModalTraslado({ producto, origen: 'CAMION', destino: 'GENERAL', onHecho: cargarCamion });
  }));
}

/* ==========================================================
   BODEGA — Inventario aparte (no se factura)
   ========================================================== */

let bodegaState = { items: [], q: '', categoria: '', mostrarTodos: false };

async function renderBodega() {
  const opciones = await getOpciones();
  bodegaState = { items: [], q: '', categoria: '', mostrarTodos: false };
  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${icon('warehouse')} Bodega</h1>
        <p class="page-subtitle">Inventario aparte: lo que está en bodega no se puede facturar hasta que lo pases al local o al camión.</p>
      </div>
      <div class="page-actions">
        <button class="btn" id="btn-traer-bodega">${icon('transfer')} Traer de otro inventario</button>
        <button class="btn btn-primary" id="btn-nuevo-bodega">${icon('plus')} Nuevo producto en bodega</button>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-box">
        ${icon('search')}
        <input autocomplete="off" type="text" class="input" id="buscar-bodega" maxlength="100" placeholder="Buscar por nombre o código…">
      </div>
      <select class="select" id="filtro-categoria-bodega">
        <option value="">Todas las categorías</option>
        ${opciones.categorias.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
      </select>
      <select class="select" id="filtro-mostrar-bodega" aria-label="Qué productos mostrar">
        <option value="">Con unidades en bodega</option>
        <option value="todos">Todos los productos</option>
      </select>
    </div>
    <p class="summary-line" id="bodega-resumen"></p>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th class="hide-mobile">Categoría</th>
            <th class="hide-mobile">Marca</th>
            <th class="num">En bodega</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="bodega-tbody">
          <tr class="empty-row"><td colspan="6">Cargando…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-nuevo-bodega').addEventListener('click', () =>
    abrirModalProducto(null, { almacen: 'BODEGA', onGuardado: cargarBodega }));
  document.getElementById('btn-traer-bodega').addEventListener('click', () =>
    abrirModalTraslado({ origen: 'GENERAL', destino: 'BODEGA', onHecho: cargarBodega }));
  document.getElementById('buscar-bodega').addEventListener('input', debounce((e) => {
    bodegaState.q = e.target.value;
    pintarBodega();
  }, 200));
  document.getElementById('filtro-categoria-bodega').addEventListener('change', (e) => {
    bodegaState.categoria = e.target.value;
    pintarBodega();
  });
  document.getElementById('filtro-mostrar-bodega').addEventListener('change', (e) => {
    bodegaState.mostrarTodos = e.target.value === 'todos';
    pintarBodega();
  });

  await cargarBodega();
}

async function cargarBodega() {
  const tbody = document.getElementById('bodega-tbody');
  if (!tbody) return;
  try {
    bodegaState.items = await Api.productos.listar();
    pintarBodega();
  } catch (err) {
    showApiError(err);
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No se pudo cargar la bodega.</td></tr>`;
  }
}

function pintarBodega() {
  const tbody = document.getElementById('bodega-tbody');
  if (!tbody) return;
  const enBodega = bodegaState.items.filter(p => p.stockBodega > 0);
  const unidades = enBodega.reduce((s, p) => s + p.stockBodega, 0);
  document.getElementById('bodega-resumen').textContent =
    `${enBodega.length} ${enBodega.length === 1 ? 'producto' : 'productos'} · ${unidades} unidades en bodega`;

  let visibles = bodegaState.mostrarTodos ? bodegaState.items : enBodega;
  if (bodegaState.categoria) visibles = visibles.filter(p => p.categoria === bodegaState.categoria);
  visibles = filtrarPorTexto(visibles, bodegaState.q);

  if (!visibles.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">${enBodega.length || bodegaState.mostrarTodos
      ? 'Ningún producto coincide con la búsqueda.'
      : 'La bodega está vacía. Crea un producto o trae unidades de otro inventario.'}</td></tr>`;
    return;
  }
  tbody.innerHTML = visibles.map(p => `
    <tr>
      <td><span class="code-tag">${escapeHtml(p.codigo)}</span></td>
      <td>${escapeHtml(p.nombre)}</td>
      <td class="muted hide-mobile">${escapeHtml(p.categoria || '—')}</td>
      <td class="muted hide-mobile">${escapeHtml(p.marca || '—')}</td>
      <td class="num"><strong>${p.stockBodega}</strong></td>
      <td class="actions">
        <button class="btn btn-ghost btn-sm" data-sumar="${p.id}" title="Agregar unidades a bodega" aria-label="Agregar unidades">${icon('plus')}</button>
        <button class="btn btn-ghost btn-sm" data-trasladar="${p.id}" title="Pasar al local o al camión" aria-label="Trasladar">${icon('transfer')}</button>
        <button class="btn btn-ghost btn-sm" data-edit="${p.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>
      </td>
    </tr>
  `).join('');

  const buscar = (id) => bodegaState.items.find(p => p.id == id);
  tbody.querySelectorAll('[data-sumar]').forEach(btn => btn.addEventListener('click', () =>
    abrirModalEntrada(buscar(btn.dataset.sumar), 'BODEGA', cargarBodega)));
  tbody.querySelectorAll('[data-trasladar]').forEach(btn => btn.addEventListener('click', () =>
    abrirModalTraslado({ producto: buscar(btn.dataset.trasladar), origen: 'BODEGA', destino: 'GENERAL', onHecho: cargarBodega })));
  tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () =>
    abrirModalProducto(buscar(btn.dataset.edit), { almacen: 'BODEGA', onGuardado: cargarBodega })));
}

/* ==========================================================
   CLIENTES
   ========================================================== */

let clientesState = { items: [], filtroNombre: '', filtroCiudad: '' };

async function renderClientes() {
  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${icon('users')} Clientes</h1>
        <p class="page-subtitle">Personas y talleres que compran en el local</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-nuevo-cliente">${icon('plus')} Nuevo cliente</button>
      </div>
    </div>

    <div class="toolbar">
      <div class="search-box">
        ${icon('search')}
        <input autocomplete="off" type="text" class="input" id="buscar-cliente" maxlength="100" placeholder="Buscar por nombre…" value="${escapeHtml(clientesState.filtroNombre)}">
      </div>
      <select class="select" id="filtro-ciudad-cliente" aria-label="Filtrar por ciudad">
        <option value="">Todas las ciudades</option>
      </select>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Cédula / NIT</th>
            <th>Teléfono</th>
            <th>Ciudad</th>
            <th class="hide-mobile">Email</th>
            <th>Lista</th>
            <th class="num">Total comprado</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody id="clientes-tbody">
          <tr class="empty-row"><td colspan="9">Cargando…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-nuevo-cliente').addEventListener('click', () => abrirModalCliente());
  document.getElementById('buscar-cliente').addEventListener('input', debounce((e) => {
    clientesState.filtroNombre = e.target.value;
    cargarClientes();
  }, 350));
  document.getElementById('filtro-ciudad-cliente').addEventListener('change', (e) => {
    clientesState.filtroCiudad = e.target.value;
    pintarClientes(clientesState.items);
  });

  await cargarClientes();
}

async function cargarClientes() {
  const tbody = document.getElementById('clientes-tbody');
  if (!tbody) return;
  try {
    // Las ciudades se recargan junto con los clientes: asi aparece enseguida una ciudad
    // nueva que se acaba de agregar a un cliente.
    const [data, ciudades] = await Promise.all([
      Api.clientes.listar(clientesState.filtroNombre),
      Api.clientes.ciudades().catch(() => []),
    ]);
    clientesState.items = data;
    pintarFiltroCiudades(ciudades);
    pintarClientes(data);
  } catch (err) {
    showApiError(err);
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">No se pudo cargar la lista de clientes.</td></tr>`;
  }
}

// Lista de ciudades del filtro. Si la ciudad elegida ya no existe, vuelve a "Todas".
function pintarFiltroCiudades(ciudades) {
  const select = document.getElementById('filtro-ciudad-cliente');
  if (!select) return;
  if (clientesState.filtroCiudad && !ciudades.some(c => claveTexto(c) === claveTexto(clientesState.filtroCiudad))) {
    clientesState.filtroCiudad = '';
  }
  select.innerHTML = '<option value="">Todas las ciudades</option>'
    + ciudades.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  select.value = ciudades.find(c => claveTexto(c) === claveTexto(clientesState.filtroCiudad)) || '';
}

function pintarClientes(todos) {
  const tbody = document.getElementById('clientes-tbody');
  if (!tbody) return;
  // Filtro por ciudad sin importar tildes ni mayusculas ("medellin" = "Medellín").
  const { filtroCiudad } = clientesState;
  const items = filtroCiudad ? todos.filter(c => claveTexto(c.ciudad) === claveTexto(filtroCiudad)) : todos;
  if (!items.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="9">No hay clientes que coincidan. Crea uno con "Nuevo cliente".</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(c => `
    <tr>
      <td>${escapeHtml(c.nombre)}</td>
      <td class="muted">${c.nit ? escapeHtml(c.nit) : '—'}</td>
      <td class="muted">${c.telefono ? escapeHtml(c.telefono) : '—'}</td>
      <td class="muted">${c.ciudad ? escapeHtml(c.ciudad) : '—'}</td>
      <td class="muted hide-mobile">${c.email ? escapeHtml(c.email) : '—'}</td>
      <td>${badgeNivel(c.nivelPrecio)}</td>
      <td class="num">${formatMoney(c.totalCompras)}</td>
      <td>${c.destacado ? `<span class="badge badge-destacado">${icon('star')} Destacado</span>` : ''}</td>
      <td class="actions">
        <button class="btn btn-ghost btn-sm" data-edit="${c.id}" title="Editar" aria-label="Editar">${icon('edit')}</button>
        <button class="btn btn-ghost btn-sm" data-delete="${c.id}" data-nombre="${escapeHtml(c.nombre)}" title="Eliminar" aria-label="Eliminar">${icon('trash')}</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
    const cliente = clientesState.items.find(c => c.id == btn.dataset.edit);
    abrirModalCliente(cliente);
  }));
  tbody.querySelectorAll('[data-delete]').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirmDialog(`¿Eliminar a "${btn.dataset.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await Api.clientes.eliminar(btn.dataset.delete);
      showToast('Cliente eliminado', 'success');
      cargarClientes();
    } catch (err) { showApiError(err); }
  }));
}

// Valor de la opcion "+ Agregar otra ciudad" en la lista de ciudades del cliente.
const CIUDAD_NUEVA = '__nueva__';

// onGuardado(cliente): lo que se hace despues de guardar (por defecto, recargar la lista).
async function abrirModalCliente(cliente = null, { onGuardado = null } = {}) {
  const esEdicion = !!cliente;
  // Ciudades donde ya hay clientes; la lista trae ademas la opcion de agregar una nueva.
  const ciudades = await Api.clientes.ciudades().catch(() => []);
  const nivelActual = cliente?.nivelPrecio || 1;
  // La ciudad del cliente, tal como aparece en la lista (sin importar tildes o mayusculas).
  // Si no esta en la lista, se muestra como ciudad nueva ya escrita.
  const ciudadActual = !cliente?.ciudad ? ''
    : (ciudades.find(c => claveTexto(c) === claveTexto(cliente.ciudad)) || CIUDAD_NUEVA);

  openModal({
    title: esEdicion ? 'Editar cliente' : 'Nuevo cliente',
    submitLabel: esEdicion ? 'Guardar cambios' : 'Crear cliente',
    bodyHtml: `
      <div class="field">
        <label for="c-nombre">Nombre</label>
        <input autocomplete="off" class="input" id="c-nombre" name="nombre" required maxlength="120" value="${escapeHtml(cliente?.nombre || '')}">
      </div>
      <div class="field">
        <label for="c-cedula">Cédula / NIT <span class="text-muted">(opcional)</span></label>
        <input autocomplete="off" class="input" id="c-cedula" name="nit" maxlength="20" value="${escapeHtml(cliente?.nit || '')}">
      </div>
      <div class="field">
        <label for="c-telefono">Teléfono</label>
        <input autocomplete="off" class="input" id="c-telefono" name="telefono" type="tel" maxlength="20" value="${escapeHtml(cliente?.telefono || '')}">
      </div>
      <div class="field">
        <label for="c-ciudad-lista">Ciudad <span class="text-muted">(opcional)</span></label>
        <select class="select" id="c-ciudad-lista" name="ciudadLista">
          <option value="">Sin ciudad</option>
          ${ciudades.map(c => `<option value="${escapeHtml(c)}" ${c === ciudadActual ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          <option value="${CIUDAD_NUEVA}" ${ciudadActual === CIUDAD_NUEVA ? 'selected' : ''}>+ Agregar otra ciudad…</option>
        </select>
        <input autocomplete="off" class="input" id="c-ciudad" name="ciudad" maxlength="80" placeholder="Escribe el nombre de la ciudad"
               style="margin-top:6px;" value="${ciudadActual === CIUDAD_NUEVA ? escapeHtml(cliente.ciudad) : ''}" ${ciudadActual === CIUDAD_NUEVA ? '' : 'hidden'}>
      </div>
      <div class="field">
        <label for="c-nivel">Lista de precios</label>
        <select class="select" id="c-nivel" name="nivelPrecio">
          ${NIVELES_PRECIO.map(n => `<option value="${n}" ${n === nivelActual ? 'selected' : ''}>${nombreLista(n)}</option>`).join('')}
        </select>
        <p class="field-hint">Con la lista 3 el precio de cada producto se escribe al facturar.</p>
      </div>
      <div class="field">
        <label for="c-email">Email <span class="text-muted">(opcional)</span></label>
        <input autocomplete="off" class="input" id="c-email" name="email" type="email" maxlength="120" value="${escapeHtml(cliente?.email || '')}">
      </div>
    `,
    onMount: (overlay) => {
      const lista = overlay.querySelector('#c-ciudad-lista');
      const nueva = overlay.querySelector('#c-ciudad');
      lista.addEventListener('change', () => {
        nueva.hidden = lista.value !== CIUDAD_NUEVA;
        if (!nueva.hidden) nueva.focus();
      });
    },
    onSubmit: async (formData, overlay, close) => {
      const eleccion = formData.get('ciudadLista');
      let ciudad = eleccion === CIUDAD_NUEVA ? limpiarTexto(formData.get('ciudad')) : (eleccion || null);
      // Si la "nueva" ya existe (con otras tildes o mayusculas), se usa la de la lista.
      if (ciudad) ciudad = ciudades.find(c => claveTexto(c) === claveTexto(ciudad)) || ciudad;

      const dto = {
        nombre: limpiarTexto(formData.get('nombre')),
        nit: limpiarTexto(formData.get('nit')),
        telefono: limpiarTexto(formData.get('telefono')),
        ciudad,
        nivelPrecio: Number(formData.get('nivelPrecio')),
        email: limpiarTexto(formData.get('email')),
      };

      const hayErrores = mostrarErroresDeCampos(overlay, {
        nombre: validarCampo(dto.nombre, { requerido: true, min: 2, max: 120, regla: REGLAS.texto, etiqueta: 'El nombre' }),
        nit: validarCampo(dto.nit, {
          min: 3, max: 20, regla: REGLAS.nit, etiqueta: 'La cédula o NIT',
          mensajeRegla: 'La cédula o NIT solo admite números, letras, puntos y guiones',
        }),
        telefono: validarCampo(dto.telefono, {
          min: 7, max: 20, regla: REGLAS.telefono, etiqueta: 'El teléfono',
          mensajeRegla: 'El teléfono solo admite números, espacios, +, - y paréntesis',
        }),
        ciudad: eleccion === CIUDAD_NUEVA && !dto.ciudad
          ? 'Escribe el nombre de la ciudad'
          : validarCampo(dto.ciudad, { min: 2, max: 80, regla: REGLAS.texto, etiqueta: 'La ciudad' }),
        nivelPrecio: NIVELES_PRECIO.includes(dto.nivelPrecio) ? null : 'Elige una lista de precios',
        email: validarCampo(dto.email, { max: 120, regla: REGLAS.email, etiqueta: 'El email', mensajeRegla: 'El email no es válido' }),
      });
      if (hayErrores) return;

      try {
        let guardado;
        if (esEdicion) {
          guardado = await Api.clientes.actualizar(cliente.id, dto);
          showToast('Cliente actualizado', 'success');
        } else {
          guardado = await Api.clientes.crear(dto);
          showToast('Cliente creado', 'success');
        }
        close();
        if (onGuardado) await onGuardado(guardado);
        else cargarClientes();
      } catch (err) {
        applyValidationErrors(err, overlay);
      }
    },
  });
}

/* ==========================================================
   CLIENTES DESTACADOS
   ========================================================== */

async function renderDestacados() {
  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${icon('star')} Clientes destacados</h1>
        <p class="page-subtitle">Los que más han comprado en el local</p>
      </div>
    </div>
    <div id="destacados-container"><p class="skeleton-text">Cargando…</p></div>
  `;

  const container = document.getElementById('destacados-container');
  try {
    const destacados = await Api.clientes.destacados();
    if (!destacados.length) {
      container.innerHTML = `<p class="skeleton-text">Todavía no hay compras registradas. En cuanto factures a un cliente, aparecerá aquí.</p>`;
      return;
    }
    container.innerHTML = `
      <div class="ranking-list">
        ${destacados.map((c, i) => `
          <div class="ranking-item">
            <div class="ranking-num">${String(i + 1).padStart(2, '0')}</div>
            <div class="ranking-info">
              <div class="ranking-name">${escapeHtml(c.nombre)}</div>
              <div class="ranking-meta">${escapeHtml(c.telefono || c.email || 'Sin contacto registrado')}</div>
            </div>
            <div class="ranking-total">${formatMoney(c.totalCompras)}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    showApiError(err);
    container.innerHTML = `<p class="skeleton-text">No se pudo cargar el ranking de clientes.</p>`;
  }
}

/* ==========================================================
   FACTURACION — Nueva factura
   ========================================================== */

// La factura que se esta armando (borrador) vive en memoria y en sessionStorage: si te
// vas a otro apartado, o recargas la pagina, al volver sigue igual. Se borra al crearla
// o al cerrar sesion. Los nombres y precios NO se guardan: se toman siempre del
// inventario actual, asi que un producto nuevo o un precio cambiado se ven al volver.
const CLAVE_BORRADOR = 'cleon.facturaBorrador';
const MAX_LINEAS_FACTURA = 100; // mismo tope que el backend (FacturaCreateRequest)

function borradorVacio() {
  return { origen: 'GENERAL', ciudad: '', clienteId: '', lineas: [] };
}

// Lo que haya en sessionStorage se revisa campo por campo antes de usarlo.
function leerBorrador() {
  const borrador = borradorVacio();
  let data = null;
  try { data = JSON.parse(sessionStorage.getItem(CLAVE_BORRADOR) || 'null'); } catch (_) { data = null; }
  if (!data || typeof data !== 'object') return borrador;

  if (data.origen === 'CAMION') borrador.origen = 'CAMION';
  if (typeof data.ciudad === 'string') borrador.ciudad = data.ciudad.slice(0, 80);
  if (/^\d{1,18}$/.test(String(data.clienteId ?? ''))) borrador.clienteId = String(data.clienteId);
  if (Array.isArray(data.lineas)) {
    borrador.lineas = data.lineas.slice(0, MAX_LINEAS_FACTURA)
      .filter(l => l && Number.isInteger(l.productoId) && l.productoId > 0
        && Number.isInteger(l.cantidad) && l.cantidad >= 1 && l.cantidad <= 10000)
      .map(l => ({
        productoId: l.productoId,
        cantidad: l.cantidad,
        precio: Number.isFinite(l.precio) && l.precio > 0 && l.precio <= 9999999999 ? l.precio : null,
      }));
  }
  return borrador;
}

function guardarBorrador() {
  try { sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify(facturacionState.borrador)); } catch (_) { /* queda en memoria */ }
}

function borrarBorrador() {
  facturacionState.borrador = borradorVacio();
  try { sessionStorage.removeItem(CLAVE_BORRADOR); } catch (_) { /* nada que borrar */ }
}

let facturacionState = {
  clientes: [],
  productos: [],
  recargo: 0,
  borrador: leerBorrador(),
};

function clienteDeFactura() {
  return facturacionState.clientes.find(c => String(c.id) === String(facturacionState.borrador.clienteId)) || null;
}

function nivelDeFactura() {
  return clienteDeFactura()?.nivelPrecio || 1;
}

function productoDeFactura(id) {
  return facturacionState.productos.find(p => p.id === Number(id)) || null;
}

// Lo que se puede vender de un producto segun de donde sale la mercancia.
function disponibleParaVenta(producto, origen) {
  return disponibleEn(producto, origen === 'CAMION' ? 'CAMION' : 'GENERAL');
}

// Precio por unidad de una linea: en las listas 1 y 2 sale del inventario; en la 3 es el escrito.
function precioDeLinea(linea) {
  const nivel = nivelDeFactura();
  if (nivel === NIVEL_PRECIO_LIBRE) return linea.precio;
  const producto = productoDeFactura(linea.productoId);
  return producto ? precioSegunNivel(producto, nivel, facturacionState.recargo) : null;
}

async function renderFacturacionNueva() {
  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${icon('receipt')} Nueva factura</h1>
        <p class="page-subtitle">La factura se guarda sola mientras la armas: puedes ir a otro apartado y volver.</p>
      </div>
    </div>

    <div class="invoice-grid">
      <div class="panel">
        <h3 class="panel-title">${icon('receipt')} Detalle de la factura</h3>

        <div class="field">
          <label>¿De dónde sale la mercancía?</label>
          <div class="segmented" role="group" aria-label="De dónde sale la mercancía">
            <button type="button" class="segmented-btn" data-origen="GENERAL">${icon('box')} General</button>
            <button type="button" class="segmented-btn" data-origen="CAMION">${icon('truck')} Camión</button>
          </div>
          <p class="field-hint" id="fac-origen-hint"></p>
        </div>

        <div class="field">
          <label for="fac-ciudad">Ciudad</label>
          <select class="select" id="fac-ciudad"><option value="">Todas las ciudades</option></select>
        </div>

        <div class="field">
          <label for="fac-cliente-buscar">Cliente</label>
          <input autocomplete="off" class="input" id="fac-cliente-buscar" maxlength="100" placeholder="Escribe para buscar…" style="margin-bottom:6px;">
          <select class="select" id="fac-cliente"><option value="">Cargando clientes…</option></select>
          <p class="field-hint" id="fac-nivel-info"></p>
        </div>

        <div class="field">
          <div class="field-label-row">
            <label for="fac-producto-buscar">Agregar producto</label>
            <button type="button" class="btn btn-ghost btn-sm" id="fac-nuevo-producto">${icon('plus')} Nuevo producto</button>
          </div>
          <input autocomplete="off" class="input" id="fac-producto-buscar" maxlength="100" placeholder="Escribe nombre o código…" style="margin-bottom:6px;">
          <select class="select" id="fac-producto"><option value="">Cargando productos…</option></select>
          <div class="item-row item-row-precio">
            <div>
              <span class="mini-label">Cantidad</span>
              <input autocomplete="off" type="number" class="input" id="fac-cantidad" min="1" max="10000" step="1" value="1" aria-label="Cantidad">
            </div>
            <div>
              <span class="mini-label" id="fac-precio-label">Precio</span>
              <div class="money-input" id="fac-precio-box">
                <span class="money-prefix">$</span>
                <input type="text" inputmode="numeric" id="fac-precio" autocomplete="off" aria-labelledby="fac-precio-label">
              </div>
            </div>
            <button class="btn btn-sm" id="fac-agregar" type="button" aria-label="Agregar a la factura" title="Agregar a la factura">${icon('plus')}</button>
          </div>
        </div>

        <div class="invoice-lines" id="fac-lineas">
          <p class="text-muted" style="font-size:13px;">Todavía no has agregado productos.</p>
        </div>

        <div class="invoice-total-row">
          <span class="invoice-total-label">Total</span>
          <span class="invoice-total-amount" id="fac-total">${formatMoney(0)}</span>
        </div>

        <div style="margin-top:18px;display:flex;flex-direction:column;gap:8px;">
          <button class="btn btn-primary" id="fac-crear" style="width:100%;justify-content:center;">Crear factura</button>
          <button class="btn btn-ghost btn-sm" id="fac-vaciar" type="button" style="align-self:center;">${icon('trash')} Vaciar factura</button>
        </div>
      </div>

      <div>
        <h3 class="panel-title" style="border:none;padding:0;margin-bottom:16px;">${icon('history')} Últimas facturas</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Origen</th>
                <th class="num">Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody id="facturas-tbody-mini">
              <tr class="empty-row"><td colspan="6">Cargando…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const opciones = await getOpciones().catch(() => ({ recargoNivel2: 0 }));
  facturacionState.recargo = opciones.recargoNivel2;
  await Promise.all([cargarClientesParaFactura(), cargarProductosParaFactura(), cargarFacturasMini()]);
  depurarLineasDelBorrador();

  document.querySelectorAll('.segmented-btn').forEach(btn => btn.addEventListener('click', () => {
    facturacionState.borrador.origen = btn.dataset.origen;
    guardarBorrador();
    pintarOrigenFactura();
    pintarOpcionesProductos();
    actualizarCampoPrecio();
    pintarLineasFactura();
  }));
  document.getElementById('fac-ciudad').addEventListener('change', (e) => {
    facturacionState.borrador.ciudad = e.target.value;
    document.getElementById('fac-cliente-buscar').value = '';
    pintarOpcionesClientes();
    alCambiarCliente();
  });
  document.getElementById('fac-cliente').addEventListener('change', alCambiarCliente);
  document.getElementById('fac-producto').addEventListener('change', actualizarCampoPrecio);
  document.getElementById('fac-agregar').addEventListener('click', agregarLineaFactura);
  document.getElementById('fac-crear').addEventListener('click', crearFactura);
  document.getElementById('fac-vaciar').addEventListener('click', () => {
    if (!facturacionState.borrador.lineas.length) return;
    if (!confirmDialog('¿Quitar todos los productos de esta factura?')) return;
    facturacionState.borrador.lineas = [];
    guardarBorrador();
    pintarLineasFactura();
  });
  document.getElementById('fac-nuevo-producto').addEventListener('click', () => abrirModalProducto(null, {
    onGuardado: async (creado) => {
      await cargarProductosParaFactura();
      const select = document.getElementById('fac-producto');
      if (select && productoDeFactura(creado.id) && [...select.options].some(o => o.value === String(creado.id))) {
        select.value = String(creado.id);
      }
      actualizarCampoPrecio();
      pintarLineasFactura();
    },
  }));
  setupMoneyText(document.getElementById('fac-precio'));

  setupAutocompleteFilter('fac-cliente-buscar', 'fac-cliente');
  setupAutocompleteFilter('fac-producto-buscar', 'fac-producto');

  pintarOrigenFactura();
  alCambiarCliente();
}

// Filtra visualmente las <option> de un <select> segun lo que se escriba en el input de al lado.
// El select se deja intacto (sigue funcionando como desplegable normal). Si la opcion
// elegida cambia, se avisa con un evento "change" como si la hubiera elegido el usuario.
function setupAutocompleteFilter(inputId, selectId) {
  const input = document.getElementById(inputId);
  const select = document.getElementById(selectId);
  input.addEventListener('input', () => {
    const term = input.value.trim().toLowerCase();
    let primerVisible = null;
    Array.from(select.options).forEach(opt => {
      if (!opt.value) return; // deja siempre visible el placeholder si lo hay
      const coincide = opt.textContent.toLowerCase().includes(term);
      opt.hidden = !coincide;
      if (coincide && primerVisible === null) primerVisible = opt.value;
    });
    if (term && primerVisible && select.value !== primerVisible) {
      select.value = primerVisible;
      select.dispatchEvent(new Event('change'));
    }
  });
}

async function cargarClientesParaFactura() {
  const select = document.getElementById('fac-cliente');
  try {
    facturacionState.clientes = await Api.clientes.listar();
    pintarOpcionesCiudades();
    pintarOpcionesClientes();
  } catch (err) {
    if (select) select.innerHTML = '<option value="">Error al cargar</option>';
  }
}

// Las ciudades del filtro salen de los clientes que hay (sin repetir mayusculas o tildes).
function pintarOpcionesCiudades() {
  const select = document.getElementById('fac-ciudad');
  if (!select) return;
  const unicas = new Map();
  facturacionState.clientes.forEach(c => {
    if (c.ciudad && !unicas.has(claveTexto(c.ciudad))) unicas.set(claveTexto(c.ciudad), c.ciudad);
  });
  const ciudades = [...unicas.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  const { borrador } = facturacionState;
  if (borrador.ciudad && !unicas.has(claveTexto(borrador.ciudad))) borrador.ciudad = '';
  select.innerHTML = '<option value="">Todas las ciudades</option>'
    + ciudades.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  select.value = ciudades.find(c => claveTexto(c) === claveTexto(borrador.ciudad)) || '';
}

function pintarOpcionesClientes() {
  const select = document.getElementById('fac-cliente');
  if (!select) return;
  const { borrador, clientes } = facturacionState;
  const filtrados = borrador.ciudad
    ? clientes.filter(c => claveTexto(c.ciudad) === claveTexto(borrador.ciudad))
    : clientes;

  if (!filtrados.length) {
    select.innerHTML = `<option value="">${clientes.length ? 'No hay clientes en esa ciudad' : 'No hay clientes creados'}</option>`;
    borrador.clienteId = '';
    return;
  }
  select.innerHTML = filtrados.map(c => `
    <option value="${c.id}">${escapeHtml(c.nombre)}${c.ciudad ? ` — ${escapeHtml(c.ciudad)}` : ''} · Lista ${c.nivelPrecio || 1}</option>
  `).join('');
  if (!filtrados.some(c => String(c.id) === String(borrador.clienteId))) {
    borrador.clienteId = String(filtrados[0].id);
  }
  select.value = String(borrador.clienteId);
}

function alCambiarCliente() {
  const select = document.getElementById('fac-cliente');
  if (!select) return;
  facturacionState.borrador.clienteId = select.value || '';
  guardarBorrador();

  const cliente = clienteDeFactura();
  const info = document.getElementById('fac-nivel-info');
  info.innerHTML = cliente ? badgeNivel(cliente.nivelPrecio) : '';
  actualizarCampoPrecio();
  pintarLineasFactura();
}

function pintarOrigenFactura() {
  const { origen } = facturacionState.borrador;
  document.querySelectorAll('.segmented-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.origen === origen));
  document.getElementById('fac-origen-hint').textContent = origen === 'CAMION'
    ? 'Se descuenta del camión y del inventario general.'
    : 'Se descuenta del inventario del local.';
}

async function cargarProductosParaFactura() {
  const select = document.getElementById('fac-producto');
  try {
    facturacionState.productos = await Api.productos.listar();
    pintarOpcionesProductos();
  } catch (err) {
    if (select) select.innerHTML = '<option value="">Error al cargar</option>';
  }
}

function pintarOpcionesProductos() {
  const select = document.getElementById('fac-producto');
  if (!select) return;
  const { origen } = facturacionState.borrador;
  const anterior = select.value;
  const lista = origen === 'CAMION'
    ? facturacionState.productos.filter(p => p.stockCamion > 0)
    : facturacionState.productos;

  select.innerHTML = lista.length
    ? lista.map(p => `<option value="${p.id}">${escapeHtml(p.codigo)} — ${escapeHtml(p.nombre)} (${origen === 'CAMION' ? 'camión' : 'disp.'}: ${disponibleParaVenta(p, origen)})</option>`).join('')
    : `<option value="">${origen === 'CAMION' ? 'No hay productos cargados en el camión' : 'No hay productos creados'}</option>`;
  if (lista.some(p => String(p.id) === anterior)) select.value = anterior;
  const buscador = document.getElementById('fac-producto-buscar');
  if (buscador) buscador.value = '';
}

// Lineas guardadas de productos que ya no existen (se borraron mientras tanto) se quitan.
function depurarLineasDelBorrador() {
  const { borrador } = facturacionState;
  const antes = borrador.lineas.length;
  borrador.lineas = borrador.lineas.filter(l => productoDeFactura(l.productoId));
  if (borrador.lineas.length !== antes) {
    showToast('Se quitaron de la factura productos que ya no existen en el inventario', 'error');
    guardarBorrador();
  }
}

// Campo "Precio": bloqueado (gris) en las listas 1 y 2 mostrando el precio que se va a
// cobrar; editable solo si el cliente es de la lista 3 (precio libre).
function actualizarCampoPrecio() {
  const input = document.getElementById('fac-precio');
  const box = document.getElementById('fac-precio-box');
  if (!input) return;
  const nivel = nivelDeFactura();
  const producto = productoDeFactura(document.getElementById('fac-producto').value);
  const libre = nivel === NIVEL_PRECIO_LIBRE;

  input.disabled = !libre;
  box.classList.toggle('bloqueado', !libre);
  document.getElementById('fac-precio-label').textContent = libre ? 'Precio (libre)' : `Precio (lista ${nivel})`;
  if (libre) {
    input.placeholder = producto ? `Base: ${Number(producto.precio).toLocaleString('es-CO')}` : 'Escribe el precio';
    // Venia bloqueado mostrando un precio calculado: se limpia para escribir el propio.
    if (input.dataset.bloqueado === '1') {
      input.value = '';
      input.dataset.valor = '';
    }
    input.dataset.bloqueado = '';
  } else {
    const precio = producto ? precioSegunNivel(producto, nivel, facturacionState.recargo) : null;
    input.value = precio != null ? precio.toLocaleString('es-CO') : '';
    input.dataset.valor = precio != null ? String(precio) : '';
    input.placeholder = '';
    input.dataset.bloqueado = '1';
  }
}

async function cargarFacturasMini() {
  const tbody = document.getElementById('facturas-tbody-mini');
  try {
    const facturas = await Api.facturas.listar();
    if (!tbody) return;
    if (!facturas.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="6">Sin facturas todavía.</td></tr>`;
      return;
    }
    tbody.innerHTML = facturas.slice(0, 8).map(f => `
      <tr>
        <td class="muted">#${f.id}</td>
        <td>${escapeHtml(f.clienteNombre)}</td>
        <td class="muted fecha">${formatDate(f.fecha)}</td>
        <td>${badgeOrigen(f.origen)}</td>
        <td class="num">${formatMoney(f.total)}</td>
        <td>${badgeEstado(f.estado)}</td>
      </tr>
    `).join('');
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No se pudo cargar.</td></tr>`;
  }
}

function agregarLineaFactura() {
  const productoId = document.getElementById('fac-producto').value;
  const cantidad = Number(document.getElementById('fac-cantidad').value);
  const { borrador } = facturacionState;
  const libre = nivelDeFactura() === NIVEL_PRECIO_LIBRE;
  const precioEscrito = Number(document.getElementById('fac-precio').dataset.valor || 0);

  if (!productoId) { showToast('Selecciona un producto', 'error'); return; }
  if (!Number.isInteger(cantidad) || cantidad < 1) { showToast('La cantidad debe ser un número entero, al menos 1', 'error'); return; }
  if (libre && !(precioEscrito > 0)) { showToast('Escribe el precio del producto (el cliente es de precio libre)', 'error'); return; }

  const producto = productoDeFactura(productoId);
  if (!producto) return;

  const existente = borrador.lineas.find(l => l.productoId === producto.id);
  // Mismos topes que el backend (FacturaItemRequest y FacturaCreateRequest).
  if ((existente ? existente.cantidad : 0) + cantidad > 10000) {
    showToast('No se pueden facturar más de 10.000 unidades de un producto', 'error');
    return;
  }
  if (!existente && borrador.lineas.length >= MAX_LINEAS_FACTURA) {
    showToast(`Una factura no puede tener más de ${MAX_LINEAS_FACTURA} productos distintos`, 'error');
    return;
  }

  if (existente) {
    existente.cantidad += cantidad;
    if (libre) existente.precio = precioEscrito;
  } else {
    borrador.lineas.push({ productoId: producto.id, cantidad, precio: libre ? precioEscrito : null });
  }
  if (libre) {
    // El siguiente producto necesita su propio precio.
    const campoPrecio = document.getElementById('fac-precio');
    campoPrecio.value = '';
    campoPrecio.dataset.valor = '';
  }
  guardarBorrador();
  pintarLineasFactura();
}

function quitarLineaFactura(productoId) {
  const { borrador } = facturacionState;
  borrador.lineas = borrador.lineas.filter(l => l.productoId !== Number(productoId));
  guardarBorrador();
  pintarLineasFactura();
}

function totalDeFactura() {
  return facturacionState.borrador.lineas.reduce((suma, l) => suma + (precioDeLinea(l) || 0) * l.cantidad, 0);
}

function pintarLineasFactura() {
  const container = document.getElementById('fac-lineas');
  const totalEl = document.getElementById('fac-total');
  if (!container) return;
  const { lineas, origen } = facturacionState.borrador;
  const libre = nivelDeFactura() === NIVEL_PRECIO_LIBRE;

  if (!lineas.length) {
    container.innerHTML = `<p class="text-muted" style="font-size:13px;">Todavía no has agregado productos.</p>`;
    totalEl.textContent = formatMoney(0);
    return;
  }

  container.innerHTML = lineas.map(l => {
    const producto = productoDeFactura(l.productoId);
    const precio = precioDeLinea(l);
    const disponible = producto ? disponibleParaVenta(producto, origen) : 0;
    const aviso = l.cantidad > disponible
      ? ` · <span class="stock-low">solo hay ${disponible} ${origen === 'CAMION' ? 'en el camión' : 'en el local'}</span>`
      : '';
    return `
      <div class="invoice-line">
        <div>
          <div class="invoice-line-name">${escapeHtml(producto?.nombre || 'Producto')} × ${l.cantidad}</div>
          <div class="invoice-line-meta">${escapeHtml(producto?.codigo || '')}${libre ? '' : ` · ${formatMoney(precio)} c/u`}${aviso}</div>
          ${libre ? `
            <div class="money-input money-input-sm">
              <span class="money-prefix">$</span>
              <input type="text" inputmode="numeric" data-precio-linea="${l.productoId}" autocomplete="off"
                     placeholder="Precio c/u" aria-label="Precio por unidad de ${escapeHtml(producto?.nombre || 'producto')}">
            </div>` : ''}
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="invoice-line-amount" data-subtotal="${l.productoId}">${formatMoney((precio || 0) * l.cantidad)}</span>
          <button type="button" class="btn btn-ghost btn-sm" data-quitar="${l.productoId}" aria-label="Quitar">${icon('close')}</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-quitar]').forEach(btn =>
    btn.addEventListener('click', () => quitarLineaFactura(btn.dataset.quitar))
  );

  // Precio libre por linea: se actualiza el subtotal y el total sin volver a pintar
  // la lista (asi el cursor no se sale del campo mientras se escribe).
  container.querySelectorAll('[data-precio-linea]').forEach(input => {
    const linea = lineas.find(l => l.productoId === Number(input.dataset.precioLinea));
    setupMoneyText(input, linea.precio || 0, (valor) => {
      linea.precio = valor > 0 ? valor : null;
      guardarBorrador();
      container.querySelector(`[data-subtotal="${linea.productoId}"]`).textContent = formatMoney((linea.precio || 0) * linea.cantidad);
      totalEl.textContent = formatMoney(totalDeFactura());
    });
  });

  totalEl.textContent = formatMoney(totalDeFactura());
}

async function crearFactura() {
  const { borrador } = facturacionState;
  const cliente = clienteDeFactura();
  const libre = nivelDeFactura() === NIVEL_PRECIO_LIBRE;

  if (!cliente) { showToast('Selecciona un cliente', 'error'); return; }
  if (!borrador.lineas.length) { showToast('Agrega al menos un producto', 'error'); return; }
  if (libre && borrador.lineas.some(l => !(l.precio > 0))) {
    showToast('Escribe el precio de todos los productos (el cliente es de precio libre)', 'error');
    return;
  }

  const dto = {
    clienteId: cliente.id,
    origen: borrador.origen,
    items: borrador.lineas.map(l => ({
      productoId: l.productoId,
      cantidad: l.cantidad,
      ...(libre ? { precioUnitario: l.precio } : {}),
    })),
  };

  const btn = document.getElementById('fac-crear');
  btn.disabled = true;
  try {
    const creada = await Api.facturas.crear(dto);
    showToast(`Factura #${creada.id} creada como Pendiente`, 'success');
    borrador.lineas = [];
    guardarBorrador();
    pintarLineasFactura();
    await Promise.all([cargarProductosParaFactura(), cargarFacturasMini()]);
    actualizarCampoPrecio();
  } catch (err) {
    showApiError(err);
  } finally {
    btn.disabled = false;
  }
}

/* ==========================================================
   FACTURACION — Historial
   ========================================================== */

let historialState = { estado: '', clienteId: '', origen: '', ordenarPor: '', facturas: [], detalleCache: {} };

// origenFijo = 'CAMION' para "Ventas del camion" (mismo historial, ya filtrado).
async function renderFacturacionHistorial(origenFijo = '') {
  historialState = { estado: '', clienteId: '', origen: origenFijo, ordenarPor: '', facturas: [], detalleCache: {} };
  const esCamion = origenFijo === 'CAMION';

  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${icon(esCamion ? 'truck' : 'history')} ${esCamion ? 'Ventas del camión' : 'Historial de facturas'}</h1>
        <p class="page-subtitle">Haz clic en una factura para ver el detalle. La numeración es la misma para ventas del local y del camión.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-ir-nueva">${icon('plus')} ${esCamion ? 'Nueva venta en camión' : 'Nueva factura'}</button>
      </div>
    </div>

    <div class="toolbar">
      <select class="select" id="filtro-estado">
        <option value="">Todos los estados</option>
        <option value="PENDIENTE">Pendiente</option>
        <option value="PAGADA">Pagada</option>
        <option value="ANULADA">Anulada</option>
      </select>
      <select class="select" id="filtro-origen">
        <option value="">Todas las ventas</option>
        <option value="GENERAL" ${origenFijo === 'GENERAL' ? 'selected' : ''}>Ventas en general</option>
        <option value="CAMION" ${esCamion ? 'selected' : ''}>Ventas en camión</option>
      </select>
      <select class="select" id="filtro-cliente">
        <option value="">Todos los clientes</option>
      </select>
      <select class="select" id="filtro-orden">
        <option value="">Más recientes primero</option>
        <option value="total">Mayor valor</option>
      </select>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="hide-mobile">#</th>
            <th>Cliente</th>
            <th>Fecha</th>
            <th>Origen</th>
            <th class="num">Total pagado</th>
            <th class="num">Total</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="facturas-tbody">
          <tr class="empty-row"><td colspan="8">Cargando…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-ir-nueva').addEventListener('click', () => {
    if (esCamion) {
      facturacionState.borrador.origen = 'CAMION';
      guardarBorrador();
    }
    window.location.hash = '#/facturacion/nueva';
  });
  document.getElementById('filtro-estado').addEventListener('change', (e) => { historialState.estado = e.target.value; cargarFacturas(); });
  document.getElementById('filtro-origen').addEventListener('change', (e) => { historialState.origen = e.target.value; cargarFacturas(); });
  document.getElementById('filtro-cliente').addEventListener('change', (e) => { historialState.clienteId = e.target.value; cargarFacturas(); });
  document.getElementById('filtro-orden').addEventListener('change', (e) => { historialState.ordenarPor = e.target.value; cargarFacturas(); });

  cargarClientesFiltro();
  await cargarFacturas();
}

async function cargarClientesFiltro() {
  const select = document.getElementById('filtro-cliente');
  try {
    const clientes = await Api.clientes.listar();
    if (!select) return;
    select.innerHTML = '<option value="">Todos los clientes</option>'
      + clientes.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('');
  } catch (err) { /* deja solo "Todos los clientes" */ }
}

async function cargarFacturas() {
  const tbody = document.getElementById('facturas-tbody');
  if (!tbody) return;
  try {
    const facturas = await Api.facturas.listar({
      estado: historialState.estado,
      clienteId: historialState.clienteId,
      origen: historialState.origen,
      ordenarPor: historialState.ordenarPor,
    });
    historialState.facturas = facturas;
    historialState.detalleCache = {}; // los pagos y estados pudieron cambiar
    pintarFacturas(facturas);
  } catch (err) {
    showApiError(err);
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No se pudo cargar el historial.</td></tr>`;
  }
}

function badgeEstado(estado) {
  const map = {
    PAGADA: 'badge-pagada',
    PENDIENTE: 'badge-pendiente',
    ANULADA: 'badge-anulada',
  };
  return `<span class="badge ${map[estado] || ''}">${escapeHtml(estado)}</span>`;
}

function badgeOrigen(origen) {
  return origen === 'CAMION'
    ? `<span class="badge badge-camion">${icon('truck')} Camión</span>`
    : `<span class="badge badge-general">General</span>`;
}

// Dias que lleva una factura pendiente sin completar el pago.
function badgeDias(fecha) {
  const dias = Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000));
  const texto = dias === 0 ? 'Hoy' : dias === 1 ? '1 día' : `${dias} días`;
  return `<span class="badge badge-dias ${dias > 30 ? 'alerta' : ''}" title="Días desde que se creó sin completar el pago">${icon('clock')} ${texto}</span>`;
}

function pintarFacturas(facturas) {
  const tbody = document.getElementById('facturas-tbody');
  if (!tbody) return;
  if (!facturas.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No hay facturas que coincidan con el filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = facturas.map(f => `
    <tr class="factura-row" data-factura-id="${f.id}" style="cursor:pointer;">
      <td class="muted hide-mobile">#${f.id}</td>
      <td>${escapeHtml(f.clienteNombre)}</td>
      <td class="muted fecha">${formatDate(f.fecha)}</td>
      <td>${badgeOrigen(f.origen)}</td>
      <td class="num ${Number(f.totalPagado) > 0 && f.estado === 'PENDIENTE' ? 'pagado-parcial' : 'muted'}">${formatMoney(f.totalPagado)}</td>
      <td class="num">${formatMoney(f.total)}</td>
      <td><div class="estado-cell">${badgeEstado(f.estado)}${f.estado === 'PENDIENTE' ? badgeDias(f.fecha) : ''}</div></td>
      <td class="actions actions-wrap" data-no-toggle>
        <div class="acciones-factura">
          ${f.estado === 'PENDIENTE' ? `<button class="btn btn-ghost btn-sm" data-abonar="${f.id}">${icon('cash')} Abono</button>` : ''}
          ${f.estado === 'PENDIENTE' ? `<button class="btn btn-ghost btn-sm" data-pagar="${f.id}">${icon('wallet')} Marcar pagada</button>` : ''}
          ${f.estado !== 'ANULADA' ? `<button class="btn btn-ghost btn-sm" data-anular="${f.id}">${icon('ban')} Anular</button>` : ''}
        </div>
      </td>
    </tr>
    <tr class="factura-detalle-row" data-detalle-de="${f.id}" style="display:none;">
      <td colspan="8"><div class="factura-detalle" data-detalle-body="${f.id}"><p class="skeleton-text">Cargando detalle…</p></div></td>
    </tr>
  `).join('');

  const buscar = (id) => historialState.facturas.find(f => f.id == id);

  tbody.querySelectorAll('.factura-row').forEach(row => row.addEventListener('click', (e) => {
    if (e.target.closest('[data-no-toggle]')) return;
    toggleDetalleFactura(row.dataset.facturaId);
  }));

  tbody.querySelectorAll('[data-abonar]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    abrirModalAbono(buscar(btn.dataset.abonar));
  }));

  tbody.querySelectorAll('[data-pagar]').forEach(btn => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const factura = buscar(btn.dataset.pagar);
    const saldo = Number(factura.total) - Number(factura.totalPagado);
    if (Number(factura.totalPagado) > 0
      && !confirmDialog(`Se registrará el pago de lo que falta (${formatMoney(saldo)}) y la factura quedará pagada. ¿Continuar?`)) return;
    try {
      await Api.facturas.pagar(factura.id);
      showToast('Factura marcada como pagada', 'success');
      cargarFacturas();
    } catch (err) { showApiError(err); }
  }));

  tbody.querySelectorAll('[data-anular]').forEach(btn => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const factura = buscar(btn.dataset.anular);
    let mensaje = factura.origen === 'CAMION'
      ? '¿Anular esta factura? Las unidades vuelven al camión.'
      : '¿Anular esta factura? El stock de los productos se restaurará.';
    if (factura.estado === 'PENDIENTE' && Number(factura.totalPagado) > 0) {
      mensaje += `\n\nOjo: tiene abonos por ${formatMoney(factura.totalPagado)}. Esa plata no se devuelve sola.`;
    }
    if (!confirmDialog(mensaje)) return;
    try {
      await Api.facturas.anular(factura.id);
      showToast('Factura anulada', 'success');
      cargarFacturas();
    } catch (err) { showApiError(err); }
  }));
}

function abrirModalAbono(factura) {
  if (!factura) return;
  const total = Number(factura.total);
  const pagado = Number(factura.totalPagado);
  const saldo = Math.round((total - pagado) * 100) / 100;

  openModal({
    title: `Abono a la factura #${factura.id}`,
    submitLabel: 'Registrar abono',
    bodyHtml: `
      <p class="modal-product">${escapeHtml(factura.clienteNombre)}</p>
      <div class="abono-resumen">
        <div><span>Total</span><strong>${formatMoney(total)}</strong></div>
        <div><span>Pagado</span><strong>${formatMoney(pagado)}</strong></div>
        <div><span>Falta</span><strong>${formatMoney(saldo)}</strong></div>
      </div>
      <div class="field">
        <label for="a-monto">Valor del abono</label>
        <div class="money-input">
          <span class="money-prefix">$</span>
          <input type="text" inputmode="numeric" id="a-monto" autocomplete="off" placeholder="0">
        </div>
        <input type="hidden" name="monto" id="a-monto-valor">
        <button type="button" class="btn btn-ghost btn-sm" id="a-todo" style="margin-top:6px;">Pagar todo lo que falta (${formatMoney(saldo)})</button>
      </div>
      <p class="text-muted" style="font-size:12.5px;">Si el abono completa el total, la factura queda pagada.</p>
    `,
    onMount: (overlay) => {
      const display = overlay.querySelector('#a-monto');
      const oculto = overlay.querySelector('#a-monto-valor');
      const control = setupMoneyText(display, 0, (valor) => { oculto.value = valor > 0 ? String(valor) : ''; });
      overlay.querySelector('#a-todo').addEventListener('click', () => control.poner(saldo));
      display.focus();
    },
    onSubmit: async (formData, overlay, close) => {
      const monto = Number(formData.get('monto'));
      if (mostrarErroresDeCampos(overlay, {
        monto: !(monto > 0) ? 'Escribe el valor del abono'
          : monto > saldo ? `El abono no puede superar lo que falta (${formatMoney(saldo)})` : null,
      })) return;
      try {
        const actualizada = await Api.facturas.abonar(factura.id, monto);
        showToast(actualizada.estado === 'PAGADA'
          ? `Abono registrado. La factura #${factura.id} quedó pagada.`
          : `Abono registrado. Falta ${formatMoney(Number(actualizada.total) - Number(actualizada.totalPagado))}.`, 'success');
        close();
        cargarFacturas();
      } catch (err) {
        applyValidationErrors(err, overlay);
      }
    },
  });
}

async function toggleDetalleFactura(facturaId) {
  const detalleRow = document.querySelector(`[data-detalle-de="${facturaId}"]`);
  const abierta = detalleRow.style.display !== 'none';

  document.querySelectorAll('.factura-detalle-row').forEach(r => r.style.display = 'none');

  if (abierta) return; // ya estaba abierta -> solo se cierra

  detalleRow.style.display = '';

  if (!historialState.detalleCache[facturaId]) {
    try {
      historialState.detalleCache[facturaId] = await Api.facturas.obtener(facturaId);
    } catch (err) {
      document.querySelector(`[data-detalle-body="${facturaId}"]`).innerHTML = `<p class="skeleton-text">No se pudo cargar el detalle.</p>`;
      return;
    }
  }

  const factura = historialState.detalleCache[facturaId];
  const abonos = factura.abonos || [];
  const body = document.querySelector(`[data-detalle-body="${facturaId}"]`);
  body.innerHTML = `
    <p class="detalle-meta">
      Factura #${factura.id} · ${factura.origen === 'CAMION' ? 'Venta en camión' : 'Venta en general'} ·
      Lista de precios ${factura.nivelPrecio || 1}
    </p>
    <table>
      <thead><tr><th>Producto</th><th class="num">Cantidad</th><th class="num">Precio unitario</th><th class="num">Subtotal</th></tr></thead>
      <tbody>
        ${factura.detalles.map(d => `
          <tr>
            <td>${escapeHtml(d.productoNombre)}</td>
            <td class="num">${d.cantidad}</td>
            <td class="num">${formatMoney(d.precioUnitario)}</td>
            <td class="num">${formatMoney(d.subtotal)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${abonos.length ? `
      <h4 class="detalle-subtitulo">${icon('cash')} Pagos y abonos</h4>
      <table>
        <thead><tr><th>Fecha</th><th class="num">Valor</th></tr></thead>
        <tbody>
          ${abonos.map(a => `
            <tr><td>${formatDate(a.fecha)}</td><td class="num">${formatMoney(a.monto)}</td></tr>
          `).join('')}
        </tbody>
      </table>
    ` : ''}
  `;
}

/* ==========================================================
   Utilidades
   ========================================================== */

// ---- Listas de precios ----
// 1: precio del producto. 2: precio + recargo (lo define el backend). 3: precio libre,
// que se escribe en cada factura. El backend recalcula todo al facturar.
const NIVELES_PRECIO = [1, 2, 3];
const NIVEL_PRECIO_LIBRE = 3;

function nombreLista(nivel) {
  return `Lista ${NIVELES_PRECIO.includes(nivel) ? nivel : 1}`;
}

// Mismo calculo que ProductoService.precioSegunNivel (redondeado al peso). null = libre.
function precioSegunNivel(producto, nivel, recargo) {
  if (nivel === NIVEL_PRECIO_LIBRE) return null;
  const base = Number(producto.precio) || 0;
  return nivel === 2 ? Math.round(base * (100 + recargo) / 100) : base;
}

function badgeNivel(nivel) {
  const n = NIVELES_PRECIO.includes(nivel) ? nivel : 1;
  return `<span class="badge badge-nivel nivel-${n}">Lista ${n}</span>`;
}

// ---- Inventarios ----
// El stock general incluye lo cargado en el camion; la bodega va aparte.
const ALMACENES = { GENERAL: 'Local (inventario general)', CAMION: 'Camión', BODEGA: 'Bodega' };

function disponibleEn(producto, almacen) {
  if (almacen === 'CAMION') return producto.stockCamion || 0;
  if (almacen === 'BODEGA') return producto.stockBodega || 0;
  return producto.stock - (producto.stockCamion || 0);
}

function esCantidadValida(cantidad, maximo) {
  return Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= maximo;
}

// Para comparar textos sin importar mayusculas ni tildes ("Medellín" = "medellin").
function claveTexto(texto) {
  return String(texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

// Busqueda local por nombre o codigo en una lista de productos ya cargada.
function filtrarPorTexto(productos, texto) {
  const buscado = claveTexto(texto);
  if (!buscado) return productos;
  return productos.filter(p => claveTexto(p.nombre).includes(buscado) || claveTexto(p.codigo).includes(buscado));
}

// Campo de dinero con formato mientras se escribe (1.250.000). El valor numerico queda
// en input.dataset.valor y se avisa con onChange(valor). Devuelve { poner(valor) }.
function setupMoneyText(input, valorInicial = 0, onChange = null) {
  const MAXIMO = 9999999999; // NUMERIC(12,2) en la base: hasta 10 digitos enteros
  const poner = (valor, avisar = true) => {
    const v = Math.min(MAXIMO, Math.max(0, Number(valor) || 0));
    input.value = v > 0 ? v.toLocaleString('es-CO') : '';
    input.dataset.valor = v > 0 ? String(v) : '';
    if (avisar && onChange) onChange(v);
  };
  input.addEventListener('input', () => {
    const digitos = input.value.replace(/\D/g, '');
    poner(digitos ? parseInt(digitos.slice(0, 10), 10) : 0);
  });
  poner(valorInicial, false);
  return { poner };
}

// Input de precio con formato de moneda mientras se escribe, y flechas
// que suman/restan de a 1000. El valor real (sin puntos) se guarda en
// un input oculto llamado "precio", que es el que se envia al backend.
function setupMoneyStepper(overlay, valorInicial) {
  const display = overlay.querySelector('#f-precio-display');
  const hidden = overlay.querySelector('#f-precio');
  const btnUp = overlay.querySelector('#f-precio-up');
  const btnDown = overlay.querySelector('#f-precio-down');
  if (!display || !hidden) return;

  const PASO = 1000;
  const MAXIMO = 9999999999; // NUMERIC(12,2) en la base: hasta 10 digitos enteros
  let valor = Math.min(MAXIMO, Math.max(0, Math.round(valorInicial) || 0));

  const pintar = () => {
    display.value = valor > 0 ? valor.toLocaleString('es-CO') : '';
    hidden.value = valor;
  };

  display.addEventListener('input', () => {
    const soloDigitos = display.value.replace(/\D/g, '');
    valor = soloDigitos ? Math.min(MAXIMO, parseInt(soloDigitos.slice(0, 10), 10)) : 0;
    pintar();
  });

  btnUp.addEventListener('click', () => { valor = Math.min(MAXIMO, valor + PASO); pintar(); });
  btnDown.addEventListener('click', () => { valor = Math.max(0, valor - PASO); pintar(); });

  pintar();
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
