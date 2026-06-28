// ============================================================
// MPM Pendientes — app.js
// Titan Empaques Mega Planta Mexicali
//
// PASO 1: Despliega apps-script/Code.gs como Web App en
//         script.google.com, luego pega la URL aquí:
// ============================================================

const Config = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyM1OOQ9eHZgfdugEBSkmeoQhOwPE0vQehsZvmNaNan33Fs6SPnAPRTBBFBI0eDB2qi/exec'
};

// ── Estado global ──────────────────────────────────────────
const State = {
  user:                 null,   // {id, nombre, rol}
  pendientes:           [],
  propuestasPendientes: 0,
  catalogo:             { maquinas: [], secciones: [] },
  filtro:               'todos',
  filtroPersona:        '',
  prevView:             'view-dashboard',
  pendienteActual:      null,
};

const SUPERVISORES = [
  'Daniel Cervantes', 'Efrain Ruiz', 'Jesus Ley',
  'Arol Lopez', 'Ramon Alarcon', 'Nohemi Hernández',
];

// ── API ────────────────────────────────────────────────────
async function api(action, params = {}) {
  const res = await fetch(Config.API_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...params }),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Utilidades ─────────────────────────────────────────────
function formatFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function estadoLabel(e) {
  const m = { pendiente: 'Pendiente', en_proceso: 'En Proceso', resuelto: 'Resuelto', rechazado: 'Rechazada' };
  return m[e] || e;
}

function origenLabel(o) {
  const m = { personal: 'Personal', propuesta: 'Propuesta', asignado: 'Asignado' };
  return m[o] || o;
}

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast-${type} show`;
  setTimeout(() => t.classList.remove('show'), 3200);
}

function showLoading(show) {
  document.getElementById('loading-overlay').classList.toggle('visible', show);
}

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Navegación ─────────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(id);
  if (view) {
    view.classList.add('active');
    // Scroll content area to top
    const content = view.querySelector('.view-content');
    if (content) content.scrollTop = 0;
  }
}

// ── Auth ───────────────────────────────────────────────────
function initLogin() {
  const sel = document.getElementById('login-nombre');
  const usuarios = [
    'Luis Manuel Lima Díaz', 'Daniel Cervantes', 'Efrain Ruiz',
    'Jesus Ley', 'Arol Lopez', 'Ramon Alarcon', 'Nohemi Hernández',
  ];
  sel.innerHTML =
    '<option value="">— Selecciona tu nombre —</option>' +
    usuarios.map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join('');
}

async function handleLogin() {
  const nombre   = document.getElementById('login-nombre').value;
  const password = document.getElementById('login-password').value;

  if (!nombre)   { showToast('Selecciona tu nombre', 'error'); return; }
  if (!password) { showToast('Ingresa la contraseña', 'error'); return; }

  if (Config.API_URL === 'PEGAR_AQUI_LA_URL_DEL_APPS_SCRIPT') {
    showToast('Configura la URL del Apps Script en app.js primero', 'error');
    return;
  }

  showLoading(true);
  try {
    const r = await api('login', { nombre, password });
    if (r.success) {
      State.user = r.usuario;
      localStorage.setItem('mpm_user', JSON.stringify(State.user));
      await loadAndShowDashboard();
    } else {
      showToast(r.error || 'Acceso denegado', 'error');
    }
  } catch {
    showToast('Sin conexión. Verifica tu red.', 'error');
  } finally {
    showLoading(false);
  }
}

function handleLogout() {
  State.user = null;
  State.pendientes = [];
  localStorage.removeItem('mpm_user');
  document.getElementById('login-password').value = '';
  showView('view-login');
}

// ── Dashboard ──────────────────────────────────────────────
async function loadAndShowDashboard() {
  showLoading(true);
  try {
    const r = await api('getPendientes', { nombre: State.user.nombre, rol: State.user.rol });
    if (r.success) {
      State.pendientes           = r.pendientes || [];
      State.propuestasPendientes = r.propuestasPendientes || 0;
    }
  } catch {
    showToast('Error al cargar datos', 'error');
  } finally {
    showLoading(false);
  }
  renderDashboard();
  showView('view-dashboard');
}

async function refreshPendientes() {
  const r = await api('getPendientes', { nombre: State.user.nombre, rol: State.user.rol });
  if (r.success) {
    State.pendientes           = r.pendientes || [];
    State.propuestasPendientes = r.propuestasPendientes || 0;
  }
}

function renderDashboard() {
  const u = State.user;
  const p = State.pendientes;

  // Header
  document.getElementById('dash-nombre').textContent = u.nombre.split(' ')[0];
  document.getElementById('dash-rol').textContent =
    u.rol === 'gerente'   ? 'Gerente de Mantenimiento'  :
    u.rol === 'planeador' ? 'Planeador de Mantenimiento' :
                            'Supervisor de Mantenimiento';

  // Counts
  let nPendiente, nEnProceso, nResuelto;
  if (u.rol === 'gerente') {
    const activos = p.filter(x => x.aprobacion_estado !== 'pendiente');
    nPendiente = activos.filter(x => x.estado === 'pendiente').length;
    nEnProceso = activos.filter(x => x.estado === 'en_proceso').length;
    nResuelto  = p.filter(x => x.estado === 'resuelto').length;
  } else {
    const mine = p.filter(x => x.asignado_a === u.nombre && x.aprobacion_estado !== 'pendiente');
    nPendiente = mine.filter(x => x.estado === 'pendiente').length;
    nEnProceso = mine.filter(x => x.estado === 'en_proceso').length;
    nResuelto  = mine.filter(x => x.estado === 'resuelto').length;
  }

  document.getElementById('count-pendiente').textContent  = nPendiente;
  document.getElementById('count-en-proceso').textContent = nEnProceso;
  document.getElementById('count-resuelto').textContent   = nResuelto;

  // Propuestas alert
  const bannerEl = document.getElementById('dash-propuestas-section');
  if (u.rol === 'gerente' && State.propuestasPendientes > 0) {
    bannerEl.hidden = false;
    document.getElementById('badge-propuestas').textContent = State.propuestasPendientes;
  } else {
    bannerEl.hidden = true;
  }

  // Gerente controls
  document.getElementById('dash-gerente-section').hidden = (u.rol !== 'gerente');

  renderRecentList();
}

function renderRecentList() {
  const u = State.user;
  let items;
  if (u.rol === 'gerente') {
    items = State.pendientes
      .filter(p => p.estado !== 'resuelto' && p.estado !== 'rechazado' && p.aprobacion_estado !== 'pendiente')
      .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
      .slice(0, 6);
  } else {
    items = State.pendientes
      .filter(p => p.asignado_a === u.nombre && p.estado !== 'resuelto' && p.aprobacion_estado !== 'pendiente')
      .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
      .slice(0, 6);
  }

  const container = document.getElementById('dash-recent');
  if (items.length === 0) {
    container.innerHTML = '<p class="empty-msg">Sin pendientes activos 🎉</p>';
    return;
  }
  container.innerHTML = items.map(renderCard).join('');
}

// ── Lista ──────────────────────────────────────────────────
function openLista(filtroInicial = 'todos') {
  State.filtro      = filtroInicial;
  State.filtroPersona = '';
  State.prevView    = 'view-lista';
  renderLista();
  showView('view-lista');
}

function openListaPersona(persona) {
  State.filtro        = 'todos';
  State.filtroPersona = persona;
  State.prevView      = 'view-lista';
  renderLista();
  showView('view-lista');
}

function setFiltro(f) { State.filtro = f; renderLista(); }
function setFiltroPersona(p) { State.filtroPersona = p; renderLista(); }

function renderLista() {
  const u = State.user;
  let items = [...State.pendientes];

  // Filters
  if (State.filtro === 'propuestas') {
    items = items.filter(p => p.origen === 'propuesta' && p.aprobacion_estado === 'pendiente');
  } else if (State.filtro !== 'todos') {
    items = items.filter(p => p.estado === State.filtro);
    if (u.rol !== 'gerente') {
      items = items.filter(p => !(p.origen === 'propuesta' && p.aprobacion_estado === 'pendiente'));
    }
  }

  if (u.rol === 'gerente' && State.filtroPersona) {
    items = items.filter(p =>
      p.asignado_a === State.filtroPersona || p.creado_por === State.filtroPersona
    );
  }

  // Sort: active first, then by date desc
  const stOrder = { pendiente: 0, en_proceso: 1, resuelto: 2, rechazado: 3 };
  items.sort((a, b) => {
    const d = (stOrder[a.estado] ?? 4) - (stOrder[b.estado] ?? 4);
    return d || new Date(b.fecha_creacion) - new Date(a.fecha_creacion);
  });

  // Filter pills
  document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.filtro === State.filtro);
  });

  // Persona filter
  const personaEl = document.getElementById('persona-filter');
  personaEl.hidden = (u.rol !== 'gerente');
  if (u.rol === 'gerente') {
    document.getElementById('persona-select').value = State.filtroPersona;
  }

  // Title
  const titles = {
    todos: 'Todos los pendientes', pendiente: 'Pendientes',
    en_proceso: 'En proceso', resuelto: 'Resueltos',
    propuestas: 'Propuestas por aprobar',
  };
  document.getElementById('lista-title').textContent = titles[State.filtro] || 'Pendientes';

  // Render
  const container = document.getElementById('lista-items');
  if (items.length === 0) {
    container.innerHTML = '<p class="empty-msg">No hay registros para este filtro</p>';
    return;
  }
  container.innerHTML = items.map(renderCard).join('');
}

function renderCard(pend) {
  const estadoClass = {
    pendiente: 'estado-pendiente', en_proceso: 'estado-proceso',
    resuelto:  'estado-resuelto',  rechazado:  'estado-rechazado',
  };

  let extraBadge = '';
  if (pend.origen === 'propuesta' && pend.aprobacion_estado === 'pendiente') {
    extraBadge = '<span class="badge badge-proposal">⏳ Por aprobar</span>';
  } else if (pend.aprobacion_estado === 'rechazado' && pend.origen === 'propuesta') {
    extraBadge = '<span class="badge badge-rejected">✗ Rechazada</span>';
  }

  const asignadoText = pend.asignado_a
    ? `<span>👤 ${esc(pend.asignado_a.split(' ')[0])}</span>` : '';

  return `
    <div class="card pendiente-card" data-estado="${esc(pend.estado)}"
         onclick="openDetalle('${esc(pend.id)}')">
      <div class="card-top">
        <span class="maquina-tag">${esc(pend.maquina)}</span>
        <span class="seccion-tag">${esc(pend.seccion)}</span>
        <span class="estado-badge ${estadoClass[pend.estado] || ''}">${estadoLabel(pend.estado)}</span>
      </div>
      <p class="descripcion">${esc(pend.descripcion)}</p>
      <div class="card-meta">
        ${asignadoText}
        <span>📅 ${formatFecha(pend.fecha_creacion)}</span>
        ${extraBadge}
      </div>
    </div>`;
}

// ── Detalle ────────────────────────────────────────────────
function openDetalle(id) {
  const pend = State.pendientes.find(p => p.id === id);
  if (!pend) return;
  State.pendienteActual = pend;
  renderDetalle(pend);
  showView('view-detalle');
}

function goBackFromDetalle() {
  showView(State.prevView || 'view-dashboard');
}

function renderDetalle(pend) {
  const u         = State.user;
  const isGerente = u.rol === 'gerente';
  const isMiTarea = pend.asignado_a === u.nombre ||
                    (pend.origen === 'personal' && pend.creado_por === u.nombre);
  const isPending = pend.origen === 'propuesta' && pend.aprobacion_estado === 'pendiente';
  const isActivo  = pend.estado !== 'resuelto' && pend.estado !== 'rechazado';

  document.getElementById('det-maquina').textContent          = pend.maquina;
  document.getElementById('det-seccion').textContent          = pend.seccion;
  document.getElementById('det-estado').textContent           = estadoLabel(pend.estado);
  document.getElementById('det-estado').className             = `detail-value estado-text ${pend.estado}`;
  document.getElementById('det-origen').textContent           = origenLabel(pend.origen);
  document.getElementById('det-asignado-a').textContent       = pend.asignado_a || '—';
  document.getElementById('det-creado-por').textContent       = pend.creado_por;
  document.getElementById('det-aprobado-por').textContent     = pend.aprobado_por || '—';
  document.getElementById('det-fecha-creacion').textContent   = formatFecha(pend.fecha_creacion);
  document.getElementById('det-fecha-resolucion').textContent = formatFecha(pend.fecha_resolucion) || '—';
  document.getElementById('det-descripcion').textContent      = pend.descripcion;

  // Bitácora
  const bitEl = document.getElementById('det-bitacora-section');
  if (pend.bitacora) {
    bitEl.hidden = false;
    document.getElementById('det-bitacora').textContent = pend.bitacora;
  } else {
    bitEl.hidden = true;
  }

  // Actions
  const actEl = document.getElementById('det-actions');
  actEl.innerHTML = '';

  // Supervisor/planeador: update status of their own task
  if (!isGerente && isMiTarea && isActivo && !isPending) {
    if (pend.estado === 'pendiente') {
      actEl.innerHTML += `
        <button class="btn btn-secondary btn-full" onclick="cambiarEstado('en_proceso')">
          ▶ Marcar En Proceso
        </button>`;
    }
    actEl.innerHTML += `
      <button class="btn btn-success btn-full" onclick="openBitacoraModal()">
        ✓ Marcar Resuelto
      </button>`;
  }

  // Gerente: approve / reject proposal
  if (isGerente && isPending) {
    actEl.innerHTML = `
      <div class="aprobacion-panel">
        <p class="aprobacion-label">Propuesto por: <strong>${esc(pend.creado_por)}</strong></p>
        <label>Asignar a:</label>
        <select id="aprobacion-asignado" class="form-select" style="margin-bottom:0">
          ${SUPERVISORES.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('')}
        </select>
        <div class="aprobacion-btns">
          <button class="btn btn-success" onclick="handleAprobacion('aprobado')">✓ Aprobar</button>
          <button class="btn btn-danger"  onclick="handleAprobacion('rechazado')">✗ Rechazar</button>
        </div>
      </div>`;
    const sel = document.getElementById('aprobacion-asignado');
    if (sel && SUPERVISORES.includes(pend.creado_por)) sel.value = pend.creado_por;
  }

  // Gerente: change status of any active task
  if (isGerente && !isPending && isActivo) {
    actEl.innerHTML += `
      <div class="estado-change-panel">
        <span class="detail-label">Cambiar estado</span>
        <div class="estado-change-btns">
          ${pend.estado !== 'en_proceso' ? `
            <button class="btn btn-secondary btn-sm" onclick="cambiarEstado('en_proceso')">▶ En Proceso</button>` : ''}
          <button class="btn btn-success btn-sm" onclick="openBitacoraModal()">✓ Resuelto</button>
        </div>
      </div>`;
  }
}

async function cambiarEstado(nuevoEstado) {
  const pend = State.pendienteActual;
  showLoading(true);
  try {
    const r = await api('updateEstado', { id: pend.id, estado: nuevoEstado });
    if (r.success) {
      showToast('Estado actualizado', 'success');
      await refreshPendientes();
      State.pendienteActual = State.pendientes.find(p => p.id === pend.id);
      if (State.pendienteActual) renderDetalle(State.pendienteActual);
      showView('view-detalle');
    } else {
      showToast(r.error || 'Error al actualizar', 'error');
    }
  } catch {
    showToast('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

function openBitacoraModal() {
  document.getElementById('bitacora-texto').value = '';
  document.getElementById('modal-bitacora').classList.add('visible');
  setTimeout(() => document.getElementById('bitacora-texto').focus(), 100);
}

function closeBitacoraModal() {
  document.getElementById('modal-bitacora').classList.remove('visible');
}

async function submitBitacora() {
  const texto = document.getElementById('bitacora-texto').value.trim();
  if (!texto) {
    showToast('Describe qué se hizo para resolver el pendiente', 'error');
    document.getElementById('bitacora-texto').focus();
    return;
  }
  closeBitacoraModal();

  const pend = State.pendienteActual;
  showLoading(true);
  try {
    const r = await api('updateEstado', { id: pend.id, estado: 'resuelto', bitacora: texto });
    if (r.success) {
      showToast('Pendiente resuelto ✓', 'success');
      await refreshPendientes();
      State.pendienteActual = State.pendientes.find(p => p.id === pend.id);
      if (State.pendienteActual) renderDetalle(State.pendienteActual);
      showView('view-detalle');
    } else {
      showToast(r.error || 'Error al guardar', 'error');
    }
  } catch {
    showToast('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

async function handleAprobacion(decision) {
  const pend = State.pendienteActual;
  let asignadoA = '';
  if (decision === 'aprobado') {
    asignadoA = document.getElementById('aprobacion-asignado')?.value;
    if (!asignadoA) { showToast('Selecciona a quién asignar', 'error'); return; }
  }
  showLoading(true);
  try {
    const r = await api('aprobarPropuesta', {
      id: pend.id, decision,
      aprobado_por: State.user.nombre,
      asignado_a:   asignadoA,
    });
    if (r.success) {
      const msg = decision === 'aprobado'
        ? `Propuesta aprobada → asignada a ${asignadoA.split(' ')[0]}`
        : 'Propuesta rechazada';
      showToast(msg, 'success');
      await refreshPendientes();
      renderDashboard();
      showView('view-dashboard');
    } else {
      showToast(r.error || 'Error', 'error');
    }
  } catch {
    showToast('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

// ── Nuevo pendiente ────────────────────────────────────────
async function openNuevo() {
  showLoading(true);
  try {
    const r = await api('getCatalogo');
    if (r.success) State.catalogo = r;
  } catch {
    showToast('Error cargando catálogo', 'error');
  } finally {
    showLoading(false);
  }
  renderNuevoForm();
  showView('view-nuevo');
}

function renderNuevoForm() {
  const isGerente = State.user.rol === 'gerente';

  document.getElementById('nuevo-origen').innerHTML = isGerente
    ? `<option value="asignado">Asignar a supervisor / planeador</option>
       <option value="personal">Personal (solo yo lo veo)</option>`
    : `<option value="personal">Personal (solo yo lo veo)</option>
       <option value="propuesta">Proponer al gerente</option>`;

  populateSelect('nuevo-maquina', State.catalogo.maquinas, '— Selecciona máquina —', true);
  populateSelect('nuevo-seccion', State.catalogo.secciones, '— Selecciona sección —', true);
  updateAsignadoField();
  document.getElementById('nuevo-descripcion').value = '';
}

function populateSelect(id, items, placeholder, withNew = false) {
  const sel = document.getElementById(id);
  sel.innerHTML =
    `<option value="">${placeholder}</option>` +
    (items || []).map(i => `<option value="${esc(i)}">${esc(i)}</option>`).join('');
  if (withNew) sel.innerHTML += `<option value="__nuevo__">+ Agregar nueva...</option>`;
}

function updateAsignadoField() {
  const origen    = document.getElementById('nuevo-origen').value;
  const asigSec   = document.getElementById('nuevo-asignado-section');
  const isGerente = State.user.rol === 'gerente';

  if (isGerente && origen === 'asignado') {
    asigSec.hidden = false;
    populateSelect('nuevo-asignado', SUPERVISORES, '— Seleccionar persona —');
  } else {
    asigSec.hidden = true;
  }
}

function handleCatalogoChange(selectId, tipo) {
  const sel = document.getElementById(selectId);
  if (sel.value !== '__nuevo__') return;
  const label = tipo === 'maquina' ? 'máquina / equipo' : 'sección / módulo';
  const valor = prompt(`Nombre del nuevo ${label}:`);
  if (!valor || !valor.trim()) { sel.value = ''; return; }
  agregarCatalogo(tipo, valor.trim(), sel);
}

async function agregarCatalogo(tipo, valor, selectEl) {
  showLoading(true);
  try {
    const r = await api('addCatalogo', { tipo, valor });
    if (r.success) {
      if (tipo === 'maquina') State.catalogo.maquinas.push(valor);
      else                    State.catalogo.secciones.push(valor);
      const opt    = document.createElement('option');
      opt.value    = valor; opt.textContent = valor;
      const newRef = selectEl.querySelector('option[value="__nuevo__"]');
      selectEl.insertBefore(opt, newRef);
      selectEl.value = valor;
      showToast(`${tipo === 'maquina' ? 'Máquina' : 'Sección'} "${valor}" agregada`, 'success');
    }
  } catch {
    showToast('Error al agregar', 'error');
    selectEl.value = '';
  } finally {
    showLoading(false);
  }
}

async function submitNuevo() {
  const origen      = document.getElementById('nuevo-origen').value;
  const maquina     = document.getElementById('nuevo-maquina').value;
  const seccion     = document.getElementById('nuevo-seccion').value;
  const descripcion = document.getElementById('nuevo-descripcion').value.trim();
  const asignado_a  = document.getElementById('nuevo-asignado')?.value || '';

  if (!maquina || maquina === '__nuevo__') { showToast('Selecciona una máquina', 'error'); return; }
  if (!seccion || seccion === '__nuevo__') { showToast('Selecciona una sección', 'error'); return; }
  if (!descripcion) {
    document.getElementById('nuevo-descripcion').focus();
    showToast('Escribe la descripción del pendiente', 'error');
    return;
  }
  if (State.user.rol === 'gerente' && origen === 'asignado' && !asignado_a) {
    showToast('Selecciona a quién asignar', 'error'); return;
  }

  showLoading(true);
  try {
    const r = await api('createPendiente', {
      origen, maquina, seccion, descripcion, asignado_a,
      creado_por: State.user.nombre,
    });
    if (r.success) {
      const msg = {
        propuesta: 'Propuesta enviada al gerente',
        asignado:  `Pendiente asignado a ${asignado_a.split(' ')[0]}`,
        personal:  'Pendiente personal creado',
      }[origen] || 'Guardado';
      showToast(msg, 'success');
      await refreshPendientes();
      renderDashboard();
      showView('view-dashboard');
    } else {
      showToast(r.error || 'Error al crear', 'error');
    }
  } catch {
    showToast('Error de conexión', 'error');
  } finally {
    showLoading(false);
  }
}

// ── Init ───────────────────────────────────────────────────
async function init() {
  const saved = localStorage.getItem('mpm_user');
  if (saved) {
    try {
      State.user = JSON.parse(saved);
      await loadAndShowDashboard();
      return;
    } catch {
      localStorage.removeItem('mpm_user');
    }
  }
  initLogin();
  showView('view-login');
}

document.addEventListener('DOMContentLoaded', init);

// Service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
