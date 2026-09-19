/* ==========================================================
   Comercializadora León — Utilidades de interfaz
   ========================================================== */

const currencyFmt = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function formatMoney(value) {
  return currencyFmt.format(Number(value) || 0);
}

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mes = MESES_CORTOS[d.getMonth()];
  const yyyy = d.getFullYear();
  let h = d.getHours();
  const ampm = h >= 12 ? 'p.m.' : 'a.m.';
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd} ${mes} ${yyyy}, ${h}:${min} ${ampm}`;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Validacion de formularios ----------
// Mismas reglas que el backend (Util/Sanitizador.java y los DTOs), para avisar al
// instante. El backend es el que manda: si algo pasa aqui pero no alla, se rechaza igual.

const REGLAS = {
  texto: /^[\p{L}\p{M}\p{N} .,'"()/#&+°_-]*$/u,
  nit: /^[0-9A-Za-z.-]*$/,
  telefono: /^[0-9+() -]*$/,
  email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/,
};

// Igual que Sanitizador.limpiar: NFC, sin espacios de sobra, vacio -> null.
function limpiarTexto(valor) {
  const limpio = String(valor ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  return limpio || null;
}

// Revisa un campo y devuelve el mensaje de error, o null si esta bien.
// opciones: { requerido, min, max, regla, mensajeRegla, etiqueta }
function validarCampo(valor, { requerido = false, min = 0, max = Infinity, regla = null, mensajeRegla, etiqueta }) {
  if (valor == null) return requerido ? `${etiqueta} es obligatorio` : null;
  if (valor.length < min || valor.length > max) {
    return max === Infinity
      ? `${etiqueta} debe tener al menos ${min} caracteres`
      : `${etiqueta} debe tener entre ${min} y ${max} caracteres`;
  }
  if (regla && !regla.test(valor)) return mensajeRegla || `${etiqueta} tiene caracteres no permitidos`;
  return null;
}

// Marca en el formulario los errores de { campo: mensaje } y dice si hubo alguno.
function mostrarErroresDeCampos(overlay, errores) {
  clearFieldErrors(overlay);
  const entradas = Object.entries(errores).filter(([, msg]) => msg);
  entradas.forEach(([campo, msg]) => fieldError(overlay, campo, msg));
  if (entradas.length) showToast('Revisa los campos marcados', 'error');
  return entradas.length > 0;
}

// ---------- Toasts ----------

function showToast(message, type = 'default') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.2s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 3800);
}

function showApiError(err) {
  console.error(err);
  // Sesion vencida: la pantalla de login ya lo explica; no se llena de avisos.
  if (err.status === 401) return;
  showToast(err.message || 'Ocurrió un error inesperado', 'error');
}

// ---------- Modal generico ----------

function openModal({ title, bodyHtml, onMount, onSubmit, submitLabel = 'Guardar' }) {
  const root = document.getElementById('modal-root');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
      <div class="modal-header">
        <h3 class="modal-title">${escapeHtml(title)}</h3>
        <button type="button" class="btn btn-ghost" data-close>✕</button>
      </div>
      <form data-form autocomplete="off">
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-footer">
          <button type="button" class="btn" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">${escapeHtml(submitLabel)}</button>
        </div>
      </form>
    </div>
  `;
  root.appendChild(overlay);

  // El listener de Escape vive en document, asi que hay que quitarlo en CUALQUIER
  // forma de cierre (boton, fondo o Escape). Si no, cada modal abierto deja uno
  // pegado para siempre apuntando a un overlay ya eliminado.
  const escHandler = (e) => { if (e.key === 'Escape') close(); };

  const close = () => {
    document.removeEventListener('keydown', escHandler);
    overlay.remove();
  };

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', close));
  document.addEventListener('keydown', escHandler);

  const form = overlay.querySelector('[data-form]');
  if (onMount) onMount(overlay);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    try {
      await onSubmit(new FormData(form), overlay, close);
    } catch (err) {
      showApiError(err);
    } finally {
      submitBtn.disabled = false;
    }
  });

  return { overlay, close };
}

function confirmDialog(message) {
  return window.confirm(message);
}

function fieldError(overlay, name, message) {
  const field = overlay.querySelector(`[name="${name}"]`);
  if (!field) return;
  const existing = field.parentElement.querySelector('.field-error');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'field-error';
  el.textContent = message;
  field.parentElement.appendChild(el);
}

function clearFieldErrors(overlay) {
  overlay.querySelectorAll('.field-error').forEach(el => el.remove());
}

function applyValidationErrors(err, overlay) {
  clearFieldErrors(overlay);
  if (err.body && err.body.errores) {
    Object.entries(err.body.errores).forEach(([campo, msg]) => fieldError(overlay, campo, msg));
    showToast('Revisa los campos marcados', 'error');
  } else {
    showApiError(err);
  }
}
