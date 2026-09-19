/* ==========================================================
   Comercializadora León — App principal (router + vistas)
   ========================================================== */

const app = document.getElementById('app');

// { categorias: [...], marcas: [...], stockBajo: n }
// El umbral de stock bajo lo define el backend; aqui nunca se repite como numero fijo.
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
  'facturacion-historial':  { render: renderFacturacionHistorial, group: 'facturacion' },
};

const hashToRoute = {
  '#/dashboard': 'dashboard',
  '#/productos': 'productos',
  '#/productos/stock-bajo': 'productos-stock-bajo',
  '#/clientes': 'clientes',
  '#/clientes/destacados': 'destacados',
  '#/facturacion/nueva': 'facturacion-nueva',
  '#/facturacion/historial': 'facturacion-historial',
};

function currentRouteKey() {
  return hashToRoute[window.location.hash] || 'dashboard';
}

function navigate() {
  if (!sesionActiva) return; // sin sesion no se pinta ninguna vista
  const routeKey = currentRouteKey();
  const routeInfo = routes[routeKey];

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
  document.getElementById('sidebar-usuario').textContent = sesion.usuario;
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
  clientesState = { items: [], filtroNombre: '' };
  facturacionState = { clientes: [], productos: [], lineas: [] };
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

let productosState = { items: [], q: '', categoria: '', marca: '', soloStockBajo: false, umbralStockBajo: null };

async function renderProductos(soloStockBajo) {
  const opciones = await getOpciones();
  productosState = { items: [], q: '', categoria: '', marca: '', soloStockBajo, umbralStockBajo: opciones.stockBajo };

  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${icon(soloStockBajo ? 'alert' : 'box')} ${soloStockBajo ? 'Stock bajo' : 'Inventario'}</h1>
        <p class="page-subtitle">${soloStockBajo ? `Productos con ${opciones.stockBajo} unidades o menos` : 'Productos disponibles en el local'}</p>
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
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th class="hide-mobile">Categoría</th>
            <th class="num">Precio</th>
            <th class="num">Stock</th>
            <th class="hide-mobile">Marca</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="productos-tbody">
          <tr class="empty-row"><td colspan="7">Cargando…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-nuevo-producto').addEventListener('click', () => abrirModalProducto());

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
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No se pudo cargar el inventario.</td></tr>`;
  }
}

function pintarProductos(items) {
  const tbody = document.getElementById('productos-tbody');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No hay productos que coincidan. Crea uno con "Nuevo producto".</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(p => `
    <tr>
      <td><span class="code-tag">${escapeHtml(p.codigo)}</span></td>
      <td>${escapeHtml(p.nombre)}</td>
      <td class="muted hide-mobile">${escapeHtml(p.categoria || '—')}</td>
      <td class="num">${formatMoney(p.precio)}</td>
      <td class="num ${p.stock <= productosState.umbralStockBajo ? 'stock-low' : ''}">${p.stock}</td>
      <td class="muted hide-mobile">${escapeHtml(p.marca || '—')}</td>
      <td class="actions">
        <button class="btn btn-ghost btn-sm" data-edit="${p.id}">${icon('edit')}</button>
        <button class="btn btn-ghost btn-sm" data-delete="${p.id}" data-nombre="${escapeHtml(p.nombre)}">${icon('trash')}</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
    const producto = productosState.items.find(p => p.id == btn.dataset.edit);
    abrirModalProducto(producto);
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

async function abrirModalProducto(producto = null) {
  const esEdicion = !!producto;
  const opciones = await getOpciones();

  openModal({
    title: esEdicion ? 'Editar producto' : 'Nuevo producto',
    submitLabel: esEdicion ? 'Guardar cambios' : 'Crear producto',
    bodyHtml: `
      ${esEdicion ? `
        <div class="field">
          <label>Código</label>
          <input autocomplete="off" class="input" value="${escapeHtml(producto.codigo)}" disabled>
        </div>
      ` : `
        <div class="field">
          <label>Código</label>
          <input autocomplete="off" class="input" value="Se genera automáticamente al guardar" disabled>
        </div>
      `}
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
        <label for="f-stock">Stock</label>
        <input autocomplete="off" class="input" id="f-stock" name="stock" type="number" min="0" max="1000000" step="1" required value="${producto?.stock ?? ''}">
      </div>
      ${!esEdicion ? `<p class="text-muted" style="font-size:12.5px;">El código se arma automáticamente con la categoría y la marca (ej: Silenciador + Cleon → SC-0001).</p>` : ''}
    `,
    onMount: (overlay) => {
      setupMoneyStepper(overlay, Number(producto?.precio) || 0);
    },
    onSubmit: async (formData, overlay, close) => {
      const dto = {
        nombre: limpiarTexto(formData.get('nombre')),
        categoria: formData.get('categoria'),
        marca: formData.get('marca'),
        precio: Number(formData.get('precio')),
        stock: Number(formData.get('stock')),
      };

      const hayErrores = mostrarErroresDeCampos(overlay, {
        nombre: validarCampo(dto.nombre, { requerido: true, min: 2, max: 120, regla: REGLAS.texto, etiqueta: 'El nombre' }),
        categoria: dto.categoria ? null : 'Elige una categoría',
        marca: dto.marca ? null : 'Elige una marca',
        precio: Number.isFinite(dto.precio) && dto.precio >= 0 && dto.precio <= 9999999999 ? null : 'Precio inválido',
        stock: Number.isInteger(dto.stock) && dto.stock >= 0 && dto.stock <= 1000000
          ? null : 'El stock debe ser un número entero entre 0 y 1.000.000',
      });
      if (hayErrores) return;

      try {
        if (esEdicion) {
          await Api.productos.actualizar(producto.id, dto);
          showToast('Producto actualizado', 'success');
        } else {
          const creado = await Api.productos.crear(dto);
          showToast(`Producto creado con código ${creado.codigo}`, 'success');
        }
        close();
        cargarProductos();
      } catch (err) {
        applyValidationErrors(err, overlay);
      }
    },
  });
}

/* ==========================================================
   CLIENTES
   ========================================================== */

let clientesState = { items: [], filtroNombre: '' };

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
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Cédula / NIT</th>
            <th>Teléfono</th>
            <th class="hide-mobile">Email</th>
            <th class="num">Total comprado</th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody id="clientes-tbody">
          <tr class="empty-row"><td colspan="7">Cargando…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-nuevo-cliente').addEventListener('click', () => abrirModalCliente());
  document.getElementById('buscar-cliente').addEventListener('input', debounce((e) => {
    clientesState.filtroNombre = e.target.value;
    cargarClientes();
  }, 350));

  await cargarClientes();
}

async function cargarClientes() {
  const tbody = document.getElementById('clientes-tbody');
  if (!tbody) return;
  try {
    const data = await Api.clientes.listar(clientesState.filtroNombre);
    clientesState.items = data;
    pintarClientes(data);
  } catch (err) {
    showApiError(err);
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No se pudo cargar la lista de clientes.</td></tr>`;
  }
}

function pintarClientes(items) {
  const tbody = document.getElementById('clientes-tbody');
  if (!tbody) return;
  if (!items.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">No hay clientes que coincidan. Crea uno con "Nuevo cliente".</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map(c => `
    <tr>
      <td>${escapeHtml(c.nombre)}</td>
      <td class="muted">${c.nit ? escapeHtml(c.nit) : '—'}</td>
      <td class="muted">${c.telefono ? escapeHtml(c.telefono) : '—'}</td>
      <td class="muted hide-mobile">${c.email ? escapeHtml(c.email) : '—'}</td>
      <td class="num">${formatMoney(c.totalCompras)}</td>
      <td>${c.destacado ? `<span class="badge badge-destacado">${icon('star')} Destacado</span>` : ''}</td>
      <td class="actions">
        <button class="btn btn-ghost btn-sm" data-edit="${c.id}">${icon('edit')}</button>
        <button class="btn btn-ghost btn-sm" data-delete="${c.id}" data-nombre="${escapeHtml(c.nombre)}">${icon('trash')}</button>
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

function abrirModalCliente(cliente = null) {
  const esEdicion = !!cliente;
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
        <label for="c-email">Email <span class="text-muted">(opcional)</span></label>
        <input autocomplete="off" class="input" id="c-email" name="email" type="email" maxlength="120" value="${escapeHtml(cliente?.email || '')}">
      </div>
    `,
    onSubmit: async (formData, overlay, close) => {
      const dto = {
        nombre: limpiarTexto(formData.get('nombre')),
        nit: limpiarTexto(formData.get('nit')),
        telefono: limpiarTexto(formData.get('telefono')),
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
        email: validarCampo(dto.email, { max: 120, regla: REGLAS.email, etiqueta: 'El email', mensajeRegla: 'El email no es válido' }),
      });
      if (hayErrores) return;

      try {
        if (esEdicion) {
          await Api.clientes.actualizar(cliente.id, dto);
          showToast('Cliente actualizado', 'success');
        } else {
          await Api.clientes.crear(dto);
          showToast('Cliente creado', 'success');
        }
        close();
        cargarClientes();
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

let facturacionState = {
  clientes: [],
  productos: [],
  lineas: [],
};

async function renderFacturacionNueva() {
  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${icon('receipt')} Nueva factura</h1>
        <p class="page-subtitle">Selecciona el cliente y agrega los productos vendidos</p>
      </div>
    </div>

    <div class="invoice-grid">
      <div class="panel">
        <h3 class="panel-title">${icon('receipt')} Detalle de la factura</h3>

        <div class="field">
          <label for="fac-cliente-buscar">Cliente</label>
          <input autocomplete="off" class="input" id="fac-cliente-buscar" maxlength="100" placeholder="Escribe para buscar…" style="margin-bottom:6px;">
          <select class="select" id="fac-cliente"><option value="">Cargando clientes…</option></select>
        </div>

        <div class="field">
          <label>Agregar producto</label>
          <input autocomplete="off" class="input" id="fac-producto-buscar" maxlength="100" placeholder="Escribe nombre o código…" style="margin-bottom:6px;">
          <div class="item-row">
            <select class="select" id="fac-producto"><option value="">Cargando productos…</option></select>
            <input autocomplete="off" type="number" class="input" id="fac-cantidad" min="1" max="10000" step="1" value="1">
            <button class="btn btn-sm" id="fac-agregar" type="button">${icon('plus')}</button>
          </div>
        </div>

        <div class="invoice-lines" id="fac-lineas">
          <p class="text-muted" style="font-size:13px;">Todavía no has agregado productos.</p>
        </div>

        <div class="invoice-total-row">
          <span class="invoice-total-label">Total</span>
          <span class="invoice-total-amount" id="fac-total">${formatMoney(0)}</span>
        </div>

        <div style="margin-top:18px;">
          <button class="btn btn-primary" id="fac-crear" style="width:100%;justify-content:center;">Crear factura</button>
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
                <th class="num">Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody id="facturas-tbody-mini">
              <tr class="empty-row"><td colspan="5">Cargando…</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  facturacionState.lineas = [];
  await Promise.all([cargarClientesParaFactura(), cargarProductosParaFactura(), cargarFacturasMini()]);

  document.getElementById('fac-agregar').addEventListener('click', agregarLineaFactura);
  document.getElementById('fac-crear').addEventListener('click', crearFactura);

  setupAutocompleteFilter('fac-cliente-buscar', 'fac-cliente');
  setupAutocompleteFilter('fac-producto-buscar', 'fac-producto');
}

// Filtra visualmente las <option> de un <select> segun lo que se escriba en el input de al lado.
// El select se deja intacto (sigue funcionando como desplegable normal).
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
    if (term && primerVisible) select.value = primerVisible;
  });
}

async function cargarClientesParaFactura() {
  const select = document.getElementById('fac-cliente');
  try {
    const clientes = await Api.clientes.listar();
    facturacionState.clientes = clientes;
    select.innerHTML = clientes.length
      ? clientes.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join('')
      : '<option value="">No hay clientes creados</option>';
  } catch (err) {
    select.innerHTML = '<option value="">Error al cargar</option>';
  }
}

async function cargarProductosParaFactura() {
  const select = document.getElementById('fac-producto');
  try {
    const productos = await Api.productos.listar();
    facturacionState.productos = productos;
    select.innerHTML = productos.length
      ? productos.map(p => `<option value="${p.id}">${escapeHtml(p.codigo)} — ${escapeHtml(p.nombre)} (stock: ${p.stock})</option>`).join('')
      : '<option value="">No hay productos creados</option>';
  } catch (err) {
    select.innerHTML = '<option value="">Error al cargar</option>';
  }
}

async function cargarFacturasMini() {
  const tbody = document.getElementById('facturas-tbody-mini');
  try {
    const facturas = await Api.facturas.listar();
    if (!facturas.length) {
      tbody.innerHTML = `<tr class="empty-row"><td colspan="5">Sin facturas todavía.</td></tr>`;
      return;
    }
    tbody.innerHTML = facturas.slice(0, 8).map(f => `
      <tr>
        <td class="muted">#${f.id}</td>
        <td>${escapeHtml(f.clienteNombre)}</td>
        <td class="muted">${formatDate(f.fecha)}</td>
        <td class="num">${formatMoney(f.total)}</td>
        <td>${badgeEstado(f.estado)}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="5">No se pudo cargar.</td></tr>`;
  }
}

function agregarLineaFactura() {
  const productoId = document.getElementById('fac-producto').value;
  const cantidad = Number(document.getElementById('fac-cantidad').value);

  if (!productoId) { showToast('Selecciona un producto', 'error'); return; }
  if (!Number.isInteger(cantidad) || cantidad < 1) { showToast('La cantidad debe ser un número entero, al menos 1', 'error'); return; }

  const producto = facturacionState.productos.find(p => p.id == productoId);
  if (!producto) return;

  const existente = facturacionState.lineas.find(l => l.productoId == productoId);
  // Mismo tope por linea que el backend (FacturaItemRequest).
  if ((existente ? existente.cantidad : 0) + cantidad > 10000) {
    showToast('No se pueden facturar más de 10.000 unidades de un producto', 'error');
    return;
  }

  if (existente) {
    existente.cantidad += cantidad;
  } else {
    facturacionState.lineas.push({
      productoId: producto.id,
      nombre: producto.nombre,
      codigo: producto.codigo,
      cantidad,
      precio: producto.precio,
    });
  }
  pintarLineasFactura();
}

function quitarLineaFactura(productoId) {
  facturacionState.lineas = facturacionState.lineas.filter(l => l.productoId != productoId);
  pintarLineasFactura();
}

function pintarLineasFactura() {
  const container = document.getElementById('fac-lineas');
  const totalEl = document.getElementById('fac-total');
  const { lineas } = facturacionState;

  if (!lineas.length) {
    container.innerHTML = `<p class="text-muted" style="font-size:13px;">Todavía no has agregado productos.</p>`;
    totalEl.textContent = formatMoney(0);
    return;
  }

  let total = 0;
  container.innerHTML = lineas.map(l => {
    const subtotal = l.cantidad * l.precio;
    total += subtotal;
    return `
      <div class="invoice-line">
        <div>
          <div class="invoice-line-name">${escapeHtml(l.nombre)} × ${l.cantidad}</div>
          <div class="invoice-line-meta">${escapeHtml(l.codigo)} · ${formatMoney(l.precio)} c/u</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="invoice-line-amount">${formatMoney(subtotal)}</span>
          <button type="button" class="btn btn-ghost btn-sm" data-quitar="${l.productoId}">${icon('close')}</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-quitar]').forEach(btn =>
    btn.addEventListener('click', () => quitarLineaFactura(btn.dataset.quitar))
  );

  totalEl.textContent = formatMoney(total);
}

async function crearFactura() {
  const clienteId = document.getElementById('fac-cliente').value;
  const { lineas } = facturacionState;

  if (!clienteId) { showToast('Selecciona un cliente', 'error'); return; }
  if (!lineas.length) { showToast('Agrega al menos un producto', 'error'); return; }

  const dto = {
    clienteId: Number(clienteId),
    items: lineas.map(l => ({ productoId: l.productoId, cantidad: l.cantidad })),
  };

  const btn = document.getElementById('fac-crear');
  btn.disabled = true;
  try {
    await Api.facturas.crear(dto);
    showToast('Factura creada como Pendiente', 'success');
    facturacionState.lineas = [];
    pintarLineasFactura();
    await Promise.all([cargarProductosParaFactura(), cargarFacturasMini()]);
  } catch (err) {
    showApiError(err);
  } finally {
    btn.disabled = false;
  }
}

/* ==========================================================
   FACTURACION — Historial
   ========================================================== */

let historialState = { estado: '', clienteId: '', ordenarPor: '', expandido: null, detalleCache: {} };

async function renderFacturacionHistorial() {
  historialState = { estado: '', clienteId: '', ordenarPor: '', expandido: null, detalleCache: {} };

  app.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${icon('history')} Historial de facturas</h1>
        <p class="page-subtitle">Haz clic en una factura para ver el detalle</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" id="btn-ir-nueva">${icon('plus')} Nueva factura</button>
      </div>
    </div>

    <div class="toolbar">
      <select class="select" id="filtro-estado">
        <option value="">Todos los estados</option>
        <option value="PENDIENTE">Pendiente</option>
        <option value="PAGADA">Pagada</option>
        <option value="ANULADA">Anulada</option>
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
            <th class="num">Total</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="facturas-tbody">
          <tr class="empty-row"><td colspan="6">Cargando…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-ir-nueva').addEventListener('click', () => { window.location.hash = '#/facturacion/nueva'; });
  document.getElementById('filtro-estado').addEventListener('change', (e) => { historialState.estado = e.target.value; cargarFacturas(); });
  document.getElementById('filtro-cliente').addEventListener('change', (e) => { historialState.clienteId = e.target.value; cargarFacturas(); });
  document.getElementById('filtro-orden').addEventListener('change', (e) => { historialState.ordenarPor = e.target.value; cargarFacturas(); });

  cargarClientesFiltro();
  await cargarFacturas();
}

async function cargarClientesFiltro() {
  const select = document.getElementById('filtro-cliente');
  try {
    const clientes = await Api.clientes.listar();
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
      ordenarPor: historialState.ordenarPor,
    });
    pintarFacturas(facturas);
  } catch (err) {
    showApiError(err);
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No se pudo cargar el historial.</td></tr>`;
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

function pintarFacturas(facturas) {
  const tbody = document.getElementById('facturas-tbody');
  if (!tbody) return;
  if (!facturas.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No hay facturas que coincidan con el filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = facturas.map(f => `
    <tr class="factura-row" data-factura-id="${f.id}" style="cursor:pointer;">
      <td class="muted hide-mobile">#${f.id}</td>
      <td>${escapeHtml(f.clienteNombre)}</td>
      <td class="muted">${formatDate(f.fecha)}</td>
      <td class="num">${formatMoney(f.total)}</td>
      <td>${badgeEstado(f.estado)}</td>
      <td class="actions" data-no-toggle>
        ${f.estado === 'PENDIENTE' ? `<button class="btn btn-ghost btn-sm" data-pagar="${f.id}">${icon('wallet')} Marcar pagada</button>` : ''}
        ${f.estado !== 'ANULADA' ? `<button class="btn btn-ghost btn-sm" data-anular="${f.id}">${icon('ban')} Anular</button>` : ''}
      </td>
    </tr>
    <tr class="factura-detalle-row" data-detalle-de="${f.id}" style="display:none;">
      <td colspan="6"><div class="factura-detalle" data-detalle-body="${f.id}"><p class="skeleton-text">Cargando detalle…</p></div></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.factura-row').forEach(row => row.addEventListener('click', (e) => {
    if (e.target.closest('[data-no-toggle]')) return;
    toggleDetalleFactura(row.dataset.facturaId);
  }));

  tbody.querySelectorAll('[data-pagar]').forEach(btn => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await Api.facturas.pagar(btn.dataset.pagar);
      showToast('Factura marcada como pagada', 'success');
      cargarFacturas();
    } catch (err) { showApiError(err); }
  }));

  tbody.querySelectorAll('[data-anular]').forEach(btn => btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirmDialog('¿Anular esta factura? El stock de los productos se restaurará.')) return;
    try {
      await Api.facturas.anular(btn.dataset.anular);
      showToast('Factura anulada', 'success');
      cargarFacturas();
    } catch (err) { showApiError(err); }
  }));
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
  const body = document.querySelector(`[data-detalle-body="${facturaId}"]`);
  body.innerHTML = `
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
  `;
}

/* ==========================================================
   Utilidades
   ========================================================== */

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
