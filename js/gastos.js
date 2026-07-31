/* =======================
   GASTOS.JS
   Responsable de:
   - Formulario para registrar gastos
   - Validaciones antes de guardar
   - Historial de gastos del día
   - Total gastado hoy
======================= */

/* =======================
   VARIABLES
======================= */

let gastosDelDia = [];   // copia local de gastos del día

/* =======================
   FUNCIONES DE MESAS
   (Inicialización)
======================= */

// Inicia el módulo de gastos: construye formulario y carga historial
async function iniciarGastos() {
  renderizarFormularioGastos();
  await cargarGastosDelDia();
}

/* =======================
   FUNCIONES DE PEDIDOS
   (Formulario)
======================= */

// Construye el formulario de registro de gastos
function renderizarFormularioGastos() {
  const contenedor = document.getElementById("contenidoGastos");
  if (!contenedor) return;

  // Genera opciones de categorías desde Utils
  const opcionesCategorias = Utils.CATEGORIAS_GASTOS.map(function(c) {
    return `<option value="${c.valor}">${c.etiqueta}</option>`;
  }).join("");

  contenedor.innerHTML = `

    <!-- FORMULARIO NUEVO GASTO -->
    <div class="card-formulario">
      <div class="formulario-titulo">Registrar gasto</div>

      <div class="campo-grupo">
        <label class="campo-label">Categoría</label>
        <select id="gastoCategoria" class="campo-input">
          <option value="">Seleccionar categoría...</option>
          ${opcionesCategorias}
        </select>
      </div>

      <div class="campo-grupo">
        <label class="campo-label">Descripción</label>
        <input
          type="text"
          id="gastoDescripcion"
          class="campo-input"
          placeholder="Ej: Compra de queso mozzarella"
          maxlength="100"
        >
      </div>

      <div class="campo-grupo">
        <label class="campo-label">Monto ($)</label>
        <input
          type="number"
          id="gastoMonto"
          class="campo-input"
          placeholder="0.00"
          min="0.01"
          step="0.01"
        >
      </div>

      <button class="btn-guardar-gasto" id="btnGuardarGasto">
        + Registrar gasto
      </button>
    </div>

    <!-- HISTORIAL DE GASTOS DEL DÍA -->
    <div class="historial-gastos-titulo">
      Gastos de hoy —
      <span id="totalGastosHoy">$0.00</span>
    </div>
    <div id="listaGastos" class="lista-gastos">
      <div class="cargando-texto">Cargando gastos...</div>
    </div>
  `;

  // Asigna evento al botón guardar
  document.getElementById("btnGuardarGasto")
    .addEventListener("click", solicitarGuardarGasto);
}

/* =======================
   FUNCIONES DE VENTAS
   (Guardar gasto)
======================= */

// Solicita confirmación antes de guardar el gasto
function solicitarGuardarGasto() {
  if (!Firebase.estaConectado()) {
    App.mostrarToast("Sin conexión. Espera a recuperar la red.", "error");
    return;
  }

  // Lee los valores del formulario
  const categoria   = document.getElementById("gastoCategoria")?.value   || "";
  const descripcion = document.getElementById("gastoDescripcion")?.value || "";
  const monto       = document.getElementById("gastoMonto")?.value       || "";

  // Construye objeto gasto para validar
  const gasto = { categoria, descripcion, monto };
  const validacion = Utils.validarGasto(gasto);

  if (!validacion.ok) {
    App.mostrarToast(validacion.mensaje, "error");
    return;
  }

  // Busca la etiqueta de la categoría para el modal
  const catObj = Utils.CATEGORIAS_GASTOS.find(function(c) { return c.valor === categoria; });
  const catEtiqueta = catObj ? catObj.etiqueta : categoria;

  App.mostrarModal({
    titulo:         "Registrar gasto",
    mensaje:        `¿Registrar ${Utils.formatearDinero(monto)} en "${catEtiqueta}" — ${descripcion}?`,
    labelConfirmar: "Sí, registrar",
    labelCancelar:  "Cancelar",
    colorBoton:     "verde",
    onConfirmar:    function() {
      ejecutarGuardarGasto(categoria, descripcion, parseFloat(monto));
    }
  });
}

// Guarda el gasto en Firebase
async function ejecutarGuardarGasto(categoria, descripcion, monto) {
  const gasto = {
    id:          Utils.generarIdGasto(),
    categoria:   categoria,
    descripcion: descripcion,
    monto:       monto,
    fecha:       Utils.fechaHoy(),
    hora:        Utils.horaActual(),
    timestamp:   Date.now()
  };

  try {
    await Firebase.guardarGasto(gasto);

    // Limpia el formulario después de guardar
    document.getElementById("gastoCategoria").value  = "";
    document.getElementById("gastoDescripcion").value = "";
    document.getElementById("gastoMonto").value       = "";

    App.mostrarToast("Gasto registrado correctamente.", "exito");

    // Recarga la lista de gastos
    await cargarGastosDelDia();

  } catch (err) {
    console.error("✗ Error guardando gasto:", err.message);
    App.mostrarToast("Error al registrar el gasto. Intenta nuevamente.", "error");
  }
}

/* =======================
   HISTORIAL DE GASTOS
======================= */

// Carga y muestra los gastos del día desde Firebase
async function cargarGastosDelDia() {
  const lista = document.getElementById("listaGastos");
  const totalEl = document.getElementById("totalGastosHoy");
  if (!lista) return;

  try {
    gastosDelDia = await Firebase.leerGastosHoy();
    renderizarListaGastos(gastosDelDia);

    // Calcula y muestra total
    const total = gastosDelDia.reduce(function(sum, g) {
      return sum + (g.monto || 0);
    }, 0);

    if (totalEl) totalEl.textContent = Utils.formatearDinero(total);

  } catch (err) {
    console.error("✗ Error cargando gastos:", err.message);
    lista.innerHTML = `<div class="error-texto">Error cargando gastos.</div>`;
  }
}

// Renderiza la lista de gastos en pantalla
function renderizarListaGastos(gastos) {
  const lista = document.getElementById("listaGastos");
  if (!lista) return;

  if (!gastos || gastos.length === 0) {
    lista.innerHTML = `
      <div class="estado-vacio">
        <div class="estado-vacio-icono">💰</div>
        <div class="estado-vacio-texto">No hay gastos registrados hoy</div>
      </div>
    `;
    return;
  }

  lista.innerHTML = gastos.map(function(gasto) {
    const catObj = Utils.CATEGORIAS_GASTOS.find(function(c) { return c.valor === gasto.categoria; });
    const catEtiqueta = catObj ? catObj.etiqueta : gasto.categoria;

    return `
      <div class="fila-gasto">
        <div class="gasto-info">
          <div class="gasto-descripcion">${gasto.descripcion}</div>
          <div class="gasto-meta">${catEtiqueta} · ${gasto.hora}</div>
        </div>
        <div class="gasto-monto">${Utils.formatearDinero(gasto.monto)}</div>
      </div>
    `;
  }).join("");
}

/* =======================
   EXPORTAR
======================= */

window.Gastos = {
  iniciar:       iniciarGastos,
  cargarGastos:  cargarGastosDelDia,
  getGastos:     function() { return gastosDelDia; },
};

console.log("✓ gastos.js cargado");
