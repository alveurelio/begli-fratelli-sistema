/* =======================
   ESTADISTICAS.JS
   Responsable de:
   - Calcular ventas del día automáticamente
   - Ticket promedio
   - Top 5 productos
   - Ventas por categoría
   Lee Firebase una sola vez al abrir la pestaña
======================= */

/* =======================
   VARIABLES
======================= */

const CATEGORIAS_MENU = {
  hamburguesas: ["Sanguche Champiñones", "Hamburguesa Clásica", "Hamburguesa Mixta", "Hamburguesa VIP"],
  pizzas:       ["Pizza Mediana", "Pizza Grande", "Pizza Mixta Familiar"],
  bebidas:      ["Gaseosa Lata", "Jugo Natural", "Agua Embotellada"],
  extras:       ["Papas Fritas", "Alitas de Pollo"],
};

/* =======================
   FUNCIONES DE MESAS
   (Inicialización y carga)
======================= */

// Carga y muestra todas las estadísticas del día
async function cargarEstadisticas() {
  const contenedor = document.getElementById("contenidoEstadisticas");
  if (!contenedor) return;

  contenedor.innerHTML = `
    <div class="cargando-estadisticas">
      <div class="spinner-pequeño"></div>
      <span>Calculando estadísticas...</span>
    </div>
  `;

  try {
    // Lee todos los pedidos de hoy desde Firebase (una sola vez)
    const pedidos = await Firebase.leerPedidosPorFecha(Utils.fechaHoy());

    // Lee gastos de hoy
    const gastos = await Firebase.leerGastosHoy();

    // Calcula todas las métricas
    const metricas = calcularMetricas(pedidos, gastos);

    // Renderiza el resultado
    renderizarEstadisticas(metricas);

  } catch (err) {
    console.error("✗ Error cargando estadísticas:", err.message);
    contenedor.innerHTML = `
      <div class="error-estadisticas">
        Error al cargar estadísticas. Intenta nuevamente.
      </div>
    `;
  }
}

/* =======================
   FUNCIONES DE VENTAS
   (Cálculos automáticos)
======================= */

// Recibe array de pedidos y retorna objeto con todas las métricas
function calcularMetricas(pedidos, gastos) {
  // Solo cuenta pedidos pagados, en cocina, listos o entregados
  const pedidosValidos = (pedidos || []).filter(function(p) {
    return ["pagado", "en_cocina", "listo", "entregado"].includes(p.estado);
  });

  const pedidosCancelados = (pedidos || []).filter(function(p) {
    return p.estado === "cancelado";
  });

  // Total de ventas
  const totalVentas = pedidosValidos.reduce(function(sum, p) {
    return sum + (p.total || 0);
  }, 0);

  // Ticket promedio
  const ticketPromedio = pedidosValidos.length > 0
    ? totalVentas / pedidosValidos.length
    : 0;

  // Mesas únicas atendidas
  const mesasUnicas = new Set(pedidosValidos.map(function(p) { return p.mesa; }));

  // Conteo de productos vendidos
  const conteoProductos = {};
  pedidosValidos.forEach(function(pedido) {
    (pedido.items || []).forEach(function(item) {
      const nombre = item.nombre;
      const cantidad = item.cantidad || 1;
      conteoProductos[nombre] = (conteoProductos[nombre] || 0) + cantidad;
    });
  });

  // Top 5 productos
  const top5 = Object.entries(conteoProductos)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 5)
    .map(function(entry) { return { nombre: entry[0], cantidad: entry[1] }; });

  // Ventas por categoría
  const ventasCategorias = {};
  Object.keys(CATEGORIAS_MENU).forEach(function(cat) {
    let total = 0;
    let unidades = 0;
    pedidosValidos.forEach(function(pedido) {
      (pedido.items || []).forEach(function(item) {
        if (CATEGORIAS_MENU[cat].includes(item.nombre)) {
          total    += (item.precio || 0) * (item.cantidad || 1);
          unidades += (item.cantidad || 1);
        }
      });
    });
    ventasCategorias[cat] = { total, unidades };
  });

  // Total gastos
  const totalGastos = (gastos || []).reduce(function(sum, g) {
    return sum + (g.monto || 0);
  }, 0);

  return {
    totalVentas,
    totalPedidos:      pedidosValidos.length,
    pedidosCancelados: pedidosCancelados.length,
    ticketPromedio,
    mesasAtendidas:    mesasUnicas.size,
    top5,
    ventasCategorias,
    totalGastos,
    gananciaEstimada:  totalVentas - totalGastos,
  };
}

// Renderiza las métricas calculadas en pantalla
function renderizarEstadisticas(m) {
  const contenedor = document.getElementById("contenidoEstadisticas");
  if (!contenedor) return;

  // Genera barra de porcentaje para cada categoría
  const maxCategoria = Math.max(...Object.values(m.ventasCategorias).map(function(c) { return c.total; }), 1);

  const categoriasHTML = Object.entries(m.ventasCategorias).map(function(entry) {
    const nombre = entry[0];
    const datos  = entry[1];
    const pct    = Math.round((datos.total / maxCategoria) * 100);
    const etiquetas = { hamburguesas: "Hamburguesas", pizzas: "Pizzas", bebidas: "Bebidas", extras: "Extras" };
    return `
      <div class="categoria-fila">
        <div class="categoria-nombre">${etiquetas[nombre] || nombre}</div>
        <div class="categoria-barra-wrap">
          <div class="categoria-barra" style="width: ${pct}%"></div>
        </div>
        <div class="categoria-monto">${Utils.formatearDinero(datos.total)}</div>
        <div class="categoria-unidades">${datos.unidades} uds.</div>
      </div>
    `;
  }).join("");

  // Top 5 productos
  const top5HTML = m.top5.length > 0
    ? m.top5.map(function(p, i) {
        return `
          <div class="top-fila">
            <span class="top-posicion">${i + 1}</span>
            <span class="top-nombre">${p.nombre}</span>
            <span class="top-cantidad">${p.cantidad} vendidos</span>
          </div>
        `;
      }).join("")
    : `<div class="sin-datos">Sin ventas registradas aún</div>`;

  contenedor.innerHTML = `

    <!-- MÉTRICAS PRINCIPALES -->
    <div class="metricas-grid">
      <div class="metrica-card destacada">
        <div class="metrica-valor">${Utils.formatearDinero(m.totalVentas)}</div>
        <div class="metrica-etiqueta">Ventas del día</div>
      </div>
      <div class="metrica-card">
        <div class="metrica-valor">${m.totalPedidos}</div>
        <div class="metrica-etiqueta">Pedidos</div>
      </div>
      <div class="metrica-card">
        <div class="metrica-valor">${Utils.formatearDinero(m.ticketPromedio)}</div>
        <div class="metrica-etiqueta">Ticket promedio</div>
      </div>
      <div class="metrica-card">
        <div class="metrica-valor">${m.mesasAtendidas}</div>
        <div class="metrica-etiqueta">Mesas atendidas</div>
      </div>
      <div class="metrica-card ${m.pedidosCancelados > 0 ? "alerta" : ""}">
        <div class="metrica-valor">${m.pedidosCancelados}</div>
        <div class="metrica-etiqueta">Cancelados</div>
      </div>
      <div class="metrica-card ${m.gananciaEstimada < 0 ? "alerta" : "positiva"}">
        <div class="metrica-valor">${Utils.formatearDinero(m.gananciaEstimada)}</div>
        <div class="metrica-etiqueta">Ganancia estimada</div>
      </div>
    </div>

    <!-- TOP 5 PRODUCTOS -->
    <div class="seccion-estadisticas">
      <div class="seccion-titulo">Top 5 productos más vendidos</div>
      <div class="top-lista">${top5HTML}</div>
    </div>

    <!-- VENTAS POR CATEGORÍA -->
    <div class="seccion-estadisticas">
      <div class="seccion-titulo">Ventas por categoría</div>
      <div class="categorias-lista">${categoriasHTML}</div>
    </div>

    <!-- BOTÓN ACTUALIZAR -->
    <div class="estadisticas-acciones">
      <button class="btn-actualizar-stats" onclick="cargarEstadisticas()">
        ↻ Actualizar estadísticas
      </button>
      <div class="stats-nota">Actualizado a las ${Utils.horaActual()}</div>
    </div>
  `;
}

/* =======================
   EXPORTAR
======================= */

window.Estadisticas = {
  cargar: cargarEstadisticas,
};

window.cargarEstadisticas = cargarEstadisticas;

console.log("✓ estadisticas.js cargado");
