/* =======================
   APP.JS
   Controlador principal. Responsable de:
   - Inicializar toda la aplicación
   - Navegación entre pestañas
   - Modal de confirmación global
   - Toast de notificaciones
   - Indicador de conexión Firebase
======================= */

/* =======================
   VARIABLES
======================= */

let pestañaActiva = "pedidos";   // pestaña visible en este momento

/* =======================
   FUNCIONES DE MESAS
   (Inicialización general)
======================= */

// Punto de entrada principal — se ejecuta cuando el DOM está listo
document.addEventListener("DOMContentLoaded", function() {
  console.log("🚀 Iniciando Caja — Begli Fratelli's");

  // 1. Inicia Firebase con callbacks de conexión
  Firebase.iniciar(
    onFirebaseConectado,
    onFirebaseDesconectado
  );

  // 2. Configura navegación de pestañas
  configurarPestanas();

  // 3. Activa la pestaña inicial (Pedidos)
  cambiarPestana("pedidos");

  // 4. Muestra hora actual en el encabezado
  actualizarReloj();
  setInterval(actualizarReloj, 60000);

  console.log("✅ App lista");
});

/* =======================
   CONEXIÓN FIREBASE
======================= */

// Se ejecuta cuando Firebase conecta exitosamente
function onFirebaseConectado() {
  const indicador  = document.getElementById("indicadorConexion");
  const bannerRed  = document.getElementById("bannerSinRed");

  if (indicador) {
    indicador.className  = "indicador-conexion conectado";
    indicador.title      = "Conectado a Firebase";
  }

  if (bannerRed) bannerRed.style.display = "none";

  // Reactiva botones críticos
  document.querySelectorAll(".btn-critico").forEach(function(btn) {
    btn.disabled = false;
  });
}

// Se ejecuta cuando Firebase pierde conexión
function onFirebaseDesconectado() {
  const indicador = document.getElementById("indicadorConexion");
  const bannerRed = document.getElementById("bannerSinRed");

  if (indicador) {
    indicador.className = "indicador-conexion desconectado";
    indicador.title     = "Sin conexión — acciones bloqueadas";
  }

  if (bannerRed) bannerRed.style.display = "flex";

  // Desactiva botones críticos
  document.querySelectorAll(".btn-critico").forEach(function(btn) {
    btn.disabled = true;
  });
}

/* =======================
   NAVEGACIÓN DE PESTAÑAS
======================= */

// Asigna evento click a cada botón de pestaña
function configurarPestanas() {
  document.querySelectorAll(".btn-pestana").forEach(function(btn) {
    btn.addEventListener("click", function() {
      cambiarPestana(btn.dataset.pestana);
    });
  });
}

// Cambia la pestaña activa y carga su contenido
function cambiarPestana(nueva) {
  // Si era Pedidos, detiene el listener para ahorrar recursos
  if (pestañaActiva === "pedidos") {
    Pedidos.detener();
  }

  pestañaActiva = nueva;

  // Actualiza botones de pestañas (activo / inactivo)
  document.querySelectorAll(".btn-pestana").forEach(function(btn) {
    btn.classList.toggle("activo", btn.dataset.pestana === nueva);
  });

  // Oculta todos los paneles de contenido
  document.querySelectorAll(".panel-pestana").forEach(function(panel) {
    panel.classList.remove("activo");
  });

  // Muestra el panel de la pestaña seleccionada
  const panelActivo = document.getElementById("panel-" + nueva);
  if (panelActivo) panelActivo.classList.add("activo");

  // Carga el contenido de la pestaña seleccionada
  switch (nueva) {
    case "pedidos":
      Pedidos.iniciar();
      break;

    case "estadisticas":
      Estadisticas.cargar();
      break;

    case "gastos":
      Gastos.iniciar();
      break;

    case "cierre":
      cargarCierre();
      break;

    case "historial":
      Historial.iniciar();
      break;
  }
}

/* =======================
   CIERRE DE CAJA
   (Módulo simple dentro de app.js)
======================= */

// Calcula y muestra el cierre del día
async function cargarCierre() {
  const contenedor = document.getElementById("contenidoCierre");
  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="cargando-texto">
      <div class="spinner-pequeño"></div>
      Calculando cierre...
    </div>
  `;

  try {
    const pedidos = await Firebase.leerPedidosPorFecha(Utils.fechaHoy());
    const gastos  = await Firebase.leerGastosHoy();

    const pedidosValidos    = (pedidos || []).filter(function(p) {
      return ["pagado","en_cocina","listo","entregado"].includes(p.estado);
    });
    const pedidosCancelados = (pedidos || []).filter(function(p) {
      return p.estado === "cancelado";
    });

    const totalVentas  = pedidosValidos.reduce(function(s,p) { return s + (p.total||0); }, 0);
    const totalGastos  = (gastos||[]).reduce(function(s,g) { return s + (g.monto||0); }, 0);
    const ganancia     = totalVentas - totalGastos;
    const totalItems   = pedidosValidos.reduce(function(s,p) {
      return s + (p.items||[]).reduce(function(si,i) { return si+(i.cantidad||1); }, 0);
    }, 0);

    contenedor.innerHTML = `
      <div class="cierre-titulo">Cierre del día — ${Utils.formatearFecha(Date.now())}</div>

      <div class="cierre-grid">
        <div class="cierre-card positiva">
          <div class="cierre-valor">${Utils.formatearDinero(totalVentas)}</div>
          <div class="cierre-etiqueta">Ventas del día</div>
        </div>
        <div class="cierre-card ${totalGastos > 0 ? "alerta" : ""}">
          <div class="cierre-valor">${Utils.formatearDinero(totalGastos)}</div>
          <div class="cierre-etiqueta">Gastos del día</div>
        </div>
        <div class="cierre-card ${ganancia >= 0 ? "positiva" : "alerta"} destacada">
          <div class="cierre-valor">${Utils.formatearDinero(ganancia)}</div>
          <div class="cierre-etiqueta">Ganancia estimada</div>
        </div>
      </div>

      <div class="cierre-detalle">
        <div class="cierre-fila">
          <span>Pedidos realizados</span>
          <span>${pedidosValidos.length}</span>
        </div>
        <div class="cierre-fila">
          <span>Pedidos cancelados</span>
          <span>${pedidosCancelados.length}</span>
        </div>
        <div class="cierre-fila">
          <span>Productos vendidos</span>
          <span>${totalItems}</span>
        </div>
        <div class="cierre-fila">
          <span>Ticket promedio</span>
          <span>${Utils.formatearDinero(pedidosValidos.length > 0 ? totalVentas/pedidosValidos.length : 0)}</span>
        </div>
      </div>

      <div class="cierre-nota">
        ℹ Los cálculos son automáticos basados en los pedidos y gastos registrados hoy.
      </div>
    `;
  } catch (err) {
    contenedor.innerHTML = `<div class="error-texto">Error calculando el cierre.</div>`;
  }
}

/* =======================
   MODAL DE CONFIRMACIÓN GLOBAL
======================= */

// Muestra el modal de confirmación con la configuración recibida
function mostrarModal(config) {
  const overlay    = document.getElementById("modalOverlay");
  const titulo     = document.getElementById("modalTitulo");
  const mensaje    = document.getElementById("modalMensaje");
  const btnConf    = document.getElementById("modalBtnConfirmar");
  const btnCanc    = document.getElementById("modalBtnCancelar");

  if (!overlay) return;

  titulo.textContent      = config.titulo   || "Confirmar";
  mensaje.textContent     = config.mensaje  || "";
  btnConf.textContent     = config.labelConfirmar || "Confirmar";
  btnCanc.textContent     = config.labelCancelar  || "Cancelar";

  // Color del botón de confirmación
  btnConf.className = "modal-btn-confirmar";
  if (config.colorBoton === "rojo") {
    btnConf.classList.add("rojo");
  }

  // Asigna acciones
  btnConf.onclick = function() {
    cerrarModal();
    if (typeof config.onConfirmar === "function") config.onConfirmar();
  };
  btnCanc.onclick = cerrarModal;

  overlay.classList.add("activo");
}

// Cierra el modal
function cerrarModal() {
  const overlay = document.getElementById("modalOverlay");
  if (overlay) overlay.classList.remove("activo");
}

// Cierra el modal si el usuario hace clic fuera
document.addEventListener("click", function(e) {
  const overlay = document.getElementById("modalOverlay");
  if (e.target === overlay) cerrarModal();
});

/* =======================
   TOAST — NOTIFICACIONES
======================= */

let toastTimeout = null;

// Muestra una notificación temporal en pantalla
// tipos: "exito", "error", "aviso"
function mostrarToast(mensaje, tipo) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent  = mensaje;
  toast.className    = "toast activo " + (tipo || "exito");

  // Cancela el timeout anterior si había uno
  if (toastTimeout) clearTimeout(toastTimeout);

  toastTimeout = setTimeout(function() {
    toast.classList.remove("activo");
  }, 3500);
}

/* =======================
   RELOJ EN ENCABEZADO
======================= */

function actualizarReloj() {
  const reloj = document.getElementById("relojCaja");
  if (reloj) reloj.textContent = Utils.horaActual();
}

/* =======================
   EXPORTAR
======================= */

window.App = {
  mostrarModal:  mostrarModal,
  cerrarModal:   cerrarModal,
  mostrarToast:  mostrarToast,
  cambiarPestana: cambiarPestana,
};

// Funciones globales usadas desde HTML
window.cerrarModal        = cerrarModal;
window.cerrarDetallePedido = cerrarDetallePedido;

console.log("✓ app.js cargado");
