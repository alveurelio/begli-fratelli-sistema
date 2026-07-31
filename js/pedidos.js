/* =======================
   PEDIDOS.JS
   Responsable de:
   - Mostrar lista de pedidos en tiempo real
   - Abrir detalle de un pedido
   - Confirmar pago
   - Cancelar pedido
   - Temporizador de retraso (cada 60 segundos)
======================= */

/* =======================
   VARIABLES
======================= */

let pedidosActuales   = [];       // copia local de los pedidos activos
let detenerEscucha    = null;     // función para detener listener Firebase
let intervalTemporizador = null;  // referencia al setInterval del temporizador

/* =======================
   FUNCIONES DE MESAS
======================= */

// Inicia la escucha en tiempo real de pedidos de hoy
function iniciarPedidos() {
  // Si ya había un listener activo, lo detiene primero
  if (detenerEscucha) {
    detenerEscucha();
    detenerEscucha = null;
  }

  detenerEscucha = Firebase.escucharPedidosHoy(function(err, lista) {
    if (err) {
      console.error("✗ Error cargando pedidos:", err.message);
      return;
    }

    pedidosActuales = lista;
    renderizarListaPedidos(lista);
    actualizarBadge(lista);
  });

  // Inicia temporizador: actualiza tiempos cada 60 segundos
  if (intervalTemporizador) clearInterval(intervalTemporizador);
  intervalTemporizador = setInterval(function() {
    renderizarListaPedidos(pedidosActuales);
  }, 60000);
}

// Detiene la escucha de pedidos (cuando se cambia de pestaña)
function detenerPedidos() {
  if (detenerEscucha) {
    detenerEscucha();
    detenerEscucha = null;
  }
  if (intervalTemporizador) {
    clearInterval(intervalTemporizador);
    intervalTemporizador = null;
  }
}

/* =======================
   FUNCIONES DE PEDIDOS
======================= */

// Renderiza la lista completa de pedidos en pantalla
function renderizarListaPedidos(lista) {
  const contenedor = document.getElementById("listaPedidos");
  if (!contenedor) return;

  // Si no hay pedidos, muestra mensaje vacío
  if (!lista || lista.length === 0) {
    contenedor.innerHTML = `
      <div class="estado-vacio">
        <div class="estado-vacio-icono">📋</div>
        <div class="estado-vacio-texto">No hay pedidos por el momento</div>
      </div>
    `;
    return;
  }

  // Filtra solo los pedidos activos (no entregados ni cancelados)
  // Los entregados y cancelados van al historial
  const activos = lista.filter(function(p) {
    return p.estado !== "entregado" && p.estado !== "cancelado";
  });

  const finalizados = lista.filter(function(p) {
    return p.estado === "entregado" || p.estado === "cancelado";
  });

  let html = "";

  if (activos.length > 0) {
    html += `<div class="seccion-pedidos-titulo">Pedidos activos (${activos.length})</div>`;
    html += activos.map(tarjetaPedido).join("");
  }

  if (finalizados.length > 0) {
    html += `<div class="seccion-pedidos-titulo opaco">Finalizados hoy (${finalizados.length})</div>`;
    html += finalizados.map(tarjetaPedido).join("");
  }

  contenedor.innerHTML = html;

  // Agrega eventos de click a cada tarjeta
  contenedor.querySelectorAll(".tarjeta-pedido").forEach(function(tarjeta) {
    tarjeta.addEventListener("click", function() {
      const id = tarjeta.dataset.id;
      const pedido = pedidosActuales.find(function(p) { return p.id === id; });
      if (pedido) abrirDetallePedido(pedido);
    });
  });
}

// Genera el HTML de una tarjeta de pedido
function tarjetaPedido(pedido) {
  const retraso = Utils.nivelRetraso(pedido.timestamp);
  const claseRetraso = retraso !== "normal" ? "retraso-" + retraso : "";

  return `
    <div class="tarjeta-pedido ${claseRetraso}" data-id="${pedido.id}">
      <div class="tarjeta-pedido-cabecera">
        <div class="tarjeta-pedido-mesa">${pedido.mesa}</div>
        <span class="badge-estado ${Utils.claseEstado(pedido.estado)}">
          ${Utils.etiquetaEstado(pedido.estado)}
        </span>
      </div>
      <div class="tarjeta-pedido-items">
        ${(pedido.items || []).map(function(item) {
          return `<span class="item-chip">${item.cantidad || 1}× ${item.nombre}</span>`;
        }).join("")}
      </div>
      <div class="tarjeta-pedido-pie">
        <span class="tarjeta-pedido-tiempo ${claseRetraso}">
          ${retraso === "rojo" ? "⚠ " : ""}
          ${Utils.tiempoTranscurrido(pedido.timestamp)}
        </span>
        <span class="tarjeta-pedido-total">${Utils.formatearDinero(pedido.total)}</span>
      </div>
    </div>
  `;
}

// Actualiza el badge de la pestaña Pedidos con el conteo de nuevos
function actualizarBadge(lista) {
  const badge = document.getElementById("badgePedidos");
  if (!badge) return;

  const nuevos = (lista || []).filter(function(p) {
    return p.estado === "nuevo_en_caja";
  }).length;

  if (nuevos > 0) {
    badge.textContent = nuevos;
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }
}

/* =======================
   DETALLE DEL PEDIDO
======================= */

// Abre el panel de detalle con toda la información del pedido
function abrirDetallePedido(pedido) {
  const panel = document.getElementById("panelDetalle");
  const contenido = document.getElementById("contenidoDetalle");
  if (!panel || !contenido) return;

  // Construye la lista de items
  const itemsHTML = (pedido.items || []).map(function(item) {
    const subtotal = (item.precio || 0) * (item.cantidad || 1);
    return `
      <div class="detalle-fila">
        <span>${item.cantidad || 1}× ${item.nombre}</span>
        <span>${Utils.formatearDinero(subtotal)}</span>
      </div>
    `;
  }).join("");

  // Determina qué botones mostrar según el estado actual
  const puedeConfirmar = pedido.estado === "nuevo_en_caja";
  const puedeCancelar  = pedido.estado === "nuevo_en_caja";
  const puedeEntregar  = pedido.estado === "listo";

  contenido.innerHTML = `
    <div class="detalle-cabecera">
      <div class="detalle-mesa">${pedido.mesa}</div>
      <span class="badge-estado ${Utils.claseEstado(pedido.estado)}">
        ${Utils.etiquetaEstado(pedido.estado)}
      </span>
    </div>

    <div class="detalle-meta">
      <span>Pedido #${pedido.id.substring(1, 7)}</span>
      <span>${Utils.formatearHora(pedido.timestamp)}</span>
      <span>${Utils.tiempoTranscurrido(pedido.timestamp)}</span>
    </div>

    <div class="detalle-items">
      ${itemsHTML}
    </div>

    <div class="detalle-total">
      <span>Total</span>
      <span>${Utils.formatearDinero(pedido.total)}</span>
    </div>

    ${puedeConfirmar ? `
    <div class="detalle-metodo-pago">
      <label class="detalle-label">Método de pago</label>
      <div class="metodos-pago">
        ${Utils.METODOS_PAGO.map(function(m) {
          return `
            <label class="metodo-opcion">
              <input type="radio" name="metodoPago" value="${m.valor}"
                ${m.valor === "efectivo" ? "checked" : ""}>
              <span>${m.etiqueta}</span>
            </label>
          `;
        }).join("")}
      </div>
    </div>
    ` : `
    <div class="detalle-metodo-pago">
      <span class="detalle-label">Pago:</span>
      <span>${pedido.metodo_pago || "—"}</span>
    </div>
    `}

    ${pedido.observaciones ? `
    <div class="detalle-observaciones">
      <span class="detalle-label">Observaciones:</span>
      <span>${pedido.observaciones}</span>
    </div>
    ` : ""}

    <div class="detalle-acciones">
      ${puedeConfirmar ? `
        <button class="btn-confirmar-pago" onclick="solicitarConfirmarPago('${pedido.id}')">
          ✓ Confirmar pago
        </button>
      ` : ""}

      ${puedeEntregar ? `
        <button class="btn-entregar" onclick="solicitarMarcarEntregado('${pedido.id}')">
          ✓ Marcar entregado
        </button>
      ` : ""}

      ${puedeCancelar ? `
        <button class="btn-cancelar-pedido" onclick="solicitarCancelarPedido('${pedido.id}')">
          ✗ Cancelar pedido
        </button>
      ` : ""}

      <button class="btn-cerrar-detalle" onclick="cerrarDetallePedido()">
        Cerrar
      </button>
    </div>
  `;

  panel.classList.add("activo");
}

// Cierra el panel de detalle
function cerrarDetallePedido() {
  const panel = document.getElementById("panelDetalle");
  if (panel) panel.classList.remove("activo");
}

/* =======================
   FUNCIONES DE VENTAS
   (Acciones que cambian estado en Firebase)
======================= */

// Solicita confirmación antes de confirmar el pago
function solicitarConfirmarPago(idPedido) {
  const pedido = pedidosActuales.find(function(p) { return p.id === idPedido; });
  if (!pedido) return;

  // Validaciones antes de abrir el modal
  if (!Firebase.estaConectado()) {
    App.mostrarToast("Sin conexión. Espera a recuperar la red.", "error");
    return;
  }

  const validacion = Utils.validarPedido(pedido);
  if (!validacion.ok) {
    App.mostrarToast(validacion.mensaje, "error");
    return;
  }

  if (!Utils.transicionValida(pedido.estado, "pagado")) {
    App.mostrarToast("Este pedido no puede confirmarse en su estado actual.", "error");
    return;
  }

  App.mostrarModal({
    titulo:          "Confirmar pago",
    mensaje:         `¿Confirmar el pago de ${Utils.formatearDinero(pedido.total)} para ${pedido.mesa}? El pedido pasará automáticamente a cocina.`,
    labelConfirmar:  "Sí, confirmar pago",
    labelCancelar:   "No, volver",
    colorBoton:      "verde",
    onConfirmar:     function() { ejecutarConfirmarPago(idPedido); }
  });
}

// Ejecuta la confirmación del pago en Firebase
async function ejecutarConfirmarPago(idPedido) {
  const panel = document.getElementById("panelDetalle");

  try {
    // Lee el método de pago seleccionado
    const metodoPagoInput = document.querySelector('input[name="metodoPago"]:checked');
    const metodoPago = metodoPagoInput ? metodoPagoInput.value : "efectivo";

    await Firebase.cambiarEstadoPedido(idPedido, "pagado", {
      metodo_pago:      metodoPago,
      hora_pago:        Utils.horaActual(),
      timestamp_pago:   Date.now()
    });

    cerrarDetallePedido();
    App.mostrarToast("Pago confirmado. Pedido enviado a cocina.", "exito");

  } catch (err) {
    console.error("✗ Error confirmando pago:", err.message);
    App.mostrarToast("Error al confirmar el pago. Intenta nuevamente.", "error");
  }
}

// Solicita confirmación antes de cancelar el pedido
function solicitarCancelarPedido(idPedido) {
  const pedido = pedidosActuales.find(function(p) { return p.id === idPedido; });
  if (!pedido) return;

  if (!Firebase.estaConectado()) {
    App.mostrarToast("Sin conexión. Espera a recuperar la red.", "error");
    return;
  }

  if (!Utils.transicionValida(pedido.estado, "cancelado")) {
    App.mostrarToast("Este pedido no puede cancelarse en su estado actual.", "error");
    return;
  }

  App.mostrarModal({
    titulo:          "Cancelar pedido",
    mensaje:         `¿Cancelar el pedido de ${pedido.mesa} por ${Utils.formatearDinero(pedido.total)}? Esta acción no se puede deshacer.`,
    labelConfirmar:  "Sí, cancelar pedido",
    labelCancelar:   "No, volver",
    colorBoton:      "rojo",
    onConfirmar:     function() { ejecutarCancelarPedido(idPedido); }
  });
}

// Ejecuta la cancelación del pedido en Firebase
async function ejecutarCancelarPedido(idPedido) {
  try {
    await Firebase.cambiarEstadoPedido(idPedido, "cancelado", {
      hora_cancelacion:      Utils.horaActual(),
      timestamp_cancelacion: Date.now()
    });

    cerrarDetallePedido();
    App.mostrarToast("Pedido cancelado.", "aviso");

  } catch (err) {
    console.error("✗ Error cancelando pedido:", err.message);
    App.mostrarToast("Error al cancelar el pedido. Intenta nuevamente.", "error");
  }
}

// Solicita confirmación antes de marcar como entregado
function solicitarMarcarEntregado(idPedido) {
  App.mostrarModal({
    titulo:          "Marcar como entregado",
    mensaje:         "¿Confirmar que el pedido fue entregado a la mesa?",
    labelConfirmar:  "Sí, entregado",
    labelCancelar:   "No, volver",
    colorBoton:      "verde",
    onConfirmar:     function() { ejecutarMarcarEntregado(idPedido); }
  });
}

// Ejecuta el cambio de estado a entregado
async function ejecutarMarcarEntregado(idPedido) {
  try {
    await Firebase.cambiarEstadoPedido(idPedido, "entregado", {
      hora_entrega:      Utils.horaActual(),
      timestamp_entrega: Date.now()
    });

    cerrarDetallePedido();
    App.mostrarToast("Pedido marcado como entregado.", "exito");

  } catch (err) {
    console.error("✗ Error marcando entregado:", err.message);
    App.mostrarToast("Error al actualizar el pedido. Intenta nuevamente.", "error");
  }
}

/* =======================
   EXPORTAR
======================= */

window.Pedidos = {
  iniciar:              iniciarPedidos,
  detener:              detenerPedidos,
  abrirDetalle:         abrirDetallePedido,
  cerrarDetalle:        cerrarDetallePedido,
};

// Funciones globales llamadas desde HTML con onclick
window.solicitarConfirmarPago    = solicitarConfirmarPago;
window.solicitarCancelarPedido   = solicitarCancelarPedido;
window.solicitarMarcarEntregado  = solicitarMarcarEntregado;
window.cerrarDetallePedido       = cerrarDetallePedido;

console.log("✓ pedidos.js cargado");
