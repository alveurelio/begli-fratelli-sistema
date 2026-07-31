/* =======================
   HISTORIAL.JS
   Responsable de:
   - Buscar pedidos por fecha, mesa, número, estado
   - Mostrar resultados de búsqueda
   - No carga datos hasta que el usuario busca activamente
======================= */

/* =======================
   VARIABLES
======================= */

let resultadosBusqueda = [];   // resultados actuales de la búsqueda

/* =======================
   FUNCIONES DE MESAS
   (Inicialización)
======================= */

// Construye la interfaz de búsqueda del historial
function iniciarHistorial() {
  const contenedor = document.getElementById("contenidoHistorial");
  if (!contenedor) return;

  // Genera opciones de estados para el filtro
  const opcionesEstados = Object.entries(Utils.ESTADOS).map(function(entry) {
    return `<option value="${entry[0]}">${entry[1].etiqueta}</option>`;
  }).join("");

  contenedor.innerHTML = `

    <!-- FORMULARIO DE BÚSQUEDA -->
    <div class="card-formulario">
      <div class="formulario-titulo">Buscar pedidos</div>

      <div class="filtros-grid">

        <div class="campo-grupo">
          <label class="campo-label">Fecha</label>
          <input
            type="date"
            id="filtroFecha"
            class="campo-input"
            value="${Utils.fechaHoy()}"
          >
        </div>

        <div class="campo-grupo">
          <label class="campo-label">Mesa</label>
          <input
            type="text"
            id="filtroMesa"
            class="campo-input"
            placeholder="Ej: Mesa 3"
          >
        </div>

        <div class="campo-grupo">
          <label class="campo-label">Número de pedido</label>
          <input
            type="text"
            id="filtroNumeroPedido"
            class="campo-input"
            placeholder="Ej: P1785186282649"
          >
        </div>

        <div class="campo-grupo">
          <label class="campo-label">Estado</label>
          <select id="filtroEstado" class="campo-input">
            <option value="">Todos los estados</option>
            ${opcionesEstados}
          </select>
        </div>

      </div>

      <button class="btn-buscar-historial" id="btnBuscarHistorial">
        Buscar
      </button>
    </div>

    <!-- RESULTADOS -->
    <div id="resultadosHistorial" class="resultados-historial">
      <div class="estado-vacio">
        <div class="estado-vacio-icono">🔍</div>
        <div class="estado-vacio-texto">Usa los filtros para buscar pedidos</div>
      </div>
    </div>
  `;

  // Asigna evento al botón buscar
  document.getElementById("btnBuscarHistorial")
    .addEventListener("click", ejecutarBusqueda);
}

/* =======================
   FUNCIONES DE VENTAS
   (Búsqueda y filtrado)
======================= */

// Ejecuta la búsqueda con los filtros activos
async function ejecutarBusqueda() {
  const resultados  = document.getElementById("resultadosHistorial");
  const btnBuscar   = document.getElementById("btnBuscarHistorial");

  if (!resultados) return;

  // Lee los filtros
  const fecha         = document.getElementById("filtroFecha")?.value        || Utils.fechaHoy();
  const mesa          = (document.getElementById("filtroMesa")?.value        || "").trim().toLowerCase();
  const numeroPedido  = (document.getElementById("filtroNumeroPedido")?.value || "").trim().toLowerCase();
  const estado        = document.getElementById("filtroEstado")?.value        || "";

  // Muestra indicador de carga
  resultados.innerHTML = `
    <div class="cargando-texto">
      <div class="spinner-pequeño"></div>
      Buscando pedidos...
    </div>
  `;

  if (btnBuscar) btnBuscar.disabled = true;

  try {
    // Carga los pedidos de la fecha seleccionada desde Firebase
    const pedidos = await Firebase.leerPedidosPorFecha(fecha);

    // Aplica filtros adicionales en el cliente
    resultadosBusqueda = (pedidos || []).filter(function(p) {
      const coincideMesa   = !mesa          || (p.mesa || "").toLowerCase().includes(mesa);
      const coincideNumero = !numeroPedido  || (p.id   || "").toLowerCase().includes(numeroPedido);
      const coincideEstado = !estado        || p.estado === estado;
      return coincideMesa && coincideNumero && coincideEstado;
    });

    renderizarResultados(resultadosBusqueda, fecha);

  } catch (err) {
    console.error("✗ Error en búsqueda:", err.message);
    resultados.innerHTML = `
      <div class="error-texto">Error al buscar. Intenta nuevamente.</div>
    `;
  } finally {
    if (btnBuscar) btnBuscar.disabled = false;
  }
}

// Renderiza los resultados de búsqueda en pantalla
function renderizarResultados(pedidos, fecha) {
  const resultados = document.getElementById("resultadosHistorial");
  if (!resultados) return;

  if (!pedidos || pedidos.length === 0) {
    resultados.innerHTML = `
      <div class="estado-vacio">
        <div class="estado-vacio-icono">📭</div>
        <div class="estado-vacio-texto">No se encontraron pedidos con esos filtros</div>
      </div>
    `;
    return;
  }

  // Calcula el total de los resultados
  const totalResultados = pedidos
    .filter(function(p) { return p.estado !== "cancelado"; })
    .reduce(function(sum, p) { return sum + (p.total || 0); }, 0);

  const resumenHTML = `
    <div class="resumen-busqueda">
      <span>${pedidos.length} pedidos encontrados</span>
      <span>Total: ${Utils.formatearDinero(totalResultados)}</span>
    </div>
  `;

  const pedidosHTML = pedidos.map(function(pedido) {
    const itemsTexto = (pedido.items || [])
      .map(function(item) { return `${item.cantidad || 1}× ${item.nombre}`; })
      .join(", ");

    return `
      <div class="fila-historial">
        <div class="historial-cabecera">
          <div class="historial-mesa">${pedido.mesa}</div>
          <span class="badge-estado ${Utils.claseEstado(pedido.estado)}">
            ${Utils.etiquetaEstado(pedido.estado)}
          </span>
        </div>
        <div class="historial-items">${itemsTexto}</div>
        <div class="historial-pie">
          <span class="historial-hora">${Utils.formatearHora(pedido.timestamp)}</span>
          ${pedido.metodo_pago
            ? `<span class="historial-pago">${pedido.metodo_pago}</span>`
            : ""}
          <span class="historial-total">${Utils.formatearDinero(pedido.total)}</span>
        </div>
      </div>
    `;
  }).join("");

  resultados.innerHTML = resumenHTML + pedidosHTML;
}

/* =======================
   EXPORTAR
======================= */

window.Historial = {
  iniciar: iniciarHistorial,
};

console.log("✓ historial.js cargado");
