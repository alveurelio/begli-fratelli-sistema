/* =======================
   UTILS.JS
   Funciones reutilizables para todo el módulo Caja.
   Ningún otro archivo repite estas funciones.
   Se carga primero porque todos dependen de él.
======================= */

/* =======================
   CONFIGURACIÓN GLOBAL
======================= */

const CONFIG = {
  RESTAURANTE:        "Begli Fratelli's",
  CIUDAD:             "Naranjal, Guayas",
  WHATSAPP:           "099 310 0997",
  RETRASO_AMARILLO:   15,   // minutos → tarjeta amarilla
  RETRASO_ROJO:       25,   // minutos → tarjeta roja
  MONEDA:             "$",
  LOCALE:             "es-EC",
};

/* =======================
   FORMATEO DE DATOS
======================= */

// Convierte número a formato dinero → "$11.50"
function formatearDinero(numero) {
  if (isNaN(numero) || numero === null || numero === undefined) return "$0.00";
  return CONFIG.MONEDA + parseFloat(numero).toFixed(2);
}

// Convierte timestamp a hora legible → "16:04"
function formatearHora(timestamp) {
  if (!timestamp) return "--:--";
  const fecha = new Date(timestamp);
  return fecha.toLocaleTimeString(CONFIG.LOCALE, {
    hour:   "2-digit",
    minute: "2-digit"
  });
}

// Convierte timestamp a fecha legible → "27/07/2025"
function formatearFecha(timestamp) {
  if (!timestamp) return "--/--/----";
  const fecha = new Date(timestamp);
  return fecha.toLocaleDateString(CONFIG.LOCALE, {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric"
  });
}

// Retorna texto con tiempo transcurrido → "Hace 5 minutos"
function tiempoTranscurrido(timestamp) {
  if (!timestamp) return "Hora desconocida";

  const ahora    = Date.now();
  const diff     = ahora - timestamp;
  const minutos  = Math.floor(diff / 60000);
  const horas    = Math.floor(minutos / 60);

  if (minutos < 1)  return "Hace un momento";
  if (minutos === 1) return "Hace 1 minuto";
  if (minutos < 60) return `Hace ${minutos} minutos`;
  if (horas === 1)  return "Hace 1 hora";
  return `Hace ${horas} horas`;
}

// Retorna nivel de retraso según tiempo transcurrido
// Valores posibles: "normal", "amarillo", "rojo"
function nivelRetraso(timestamp) {
  if (!timestamp) return "normal";

  const minutos = Math.floor((Date.now() - timestamp) / 60000);

  if (minutos >= CONFIG.RETRASO_ROJO)     return "rojo";
  if (minutos >= CONFIG.RETRASO_AMARILLO) return "amarillo";
  return "normal";
}

// Devuelve la fecha de hoy en formato YYYY-MM-DD → "2025-07-27"
function fechaHoy() {
  return new Date().toISOString().split("T")[0];
}

// Devuelve la hora actual en formato HH:MM → "16:04"
function horaActual() {
  return new Date().toLocaleTimeString(CONFIG.LOCALE, {
    hour:   "2-digit",
    minute: "2-digit"
  });
}

/* =======================
   GENERACIÓN DE IDs
======================= */

// Genera ID único para pedidos → "P1785186282649"
function generarIdPedido() {
  return "P" + Date.now();
}

// Genera ID único para gastos → "G1785186282649"
function generarIdGasto() {
  return "G" + Date.now();
}

/* =======================
   VALIDACIONES
======================= */

// Valida que un monto sea número positivo mayor a cero
function validarMonto(valor) {
  const num = parseFloat(valor);
  return !isNaN(num) && num > 0;
}

// Valida que un campo de texto no esté vacío
function validarCampoRequerido(valor) {
  return typeof valor === "string" && valor.trim().length > 0;
}

// Valida que un pedido tenga mesa e items
function validarPedido(pedido) {
  if (!pedido)                          return { ok: false, mensaje: "Pedido no encontrado." };
  if (!pedido.mesa)                     return { ok: false, mensaje: "El pedido no tiene mesa asignada." };
  if (!pedido.items || pedido.items.length === 0)
                                        return { ok: false, mensaje: "El pedido no tiene productos." };
  if (!validarMonto(pedido.total))      return { ok: false, mensaje: "El total del pedido no es válido." };
  return { ok: true };
}

// Valida que un gasto tenga todos los campos requeridos
function validarGasto(gasto) {
  if (!validarCampoRequerido(gasto.categoria))   return { ok: false, mensaje: "Selecciona una categoría." };
  if (!validarCampoRequerido(gasto.descripcion)) return { ok: false, mensaje: "Escribe una descripción." };
  if (!validarMonto(gasto.monto))                return { ok: false, mensaje: "El monto debe ser mayor a cero." };
  return { ok: true };
}

/* =======================
   ESTADOS DE PEDIDOS
======================= */

// Definición de todos los estados posibles con etiqueta y color CSS
const ESTADOS = {
  nuevo_en_caja: { etiqueta: "Nuevo",      clase: "estado-nuevo"     },
  pagado:        { etiqueta: "Pagado",      clase: "estado-pagado"    },
  en_cocina:     { etiqueta: "En cocina",   clase: "estado-cocina"    },
  listo:         { etiqueta: "Listo",       clase: "estado-listo"     },
  entregado:     { etiqueta: "Entregado",   clase: "estado-entregado" },
  cancelado:     { etiqueta: "Cancelado",   clase: "estado-cancelado" },
};

// Retorna etiqueta legible del estado → "Nuevo"
function etiquetaEstado(estado) {
  return ESTADOS[estado]?.etiqueta || estado;
}

// Retorna clase CSS del estado → "estado-nuevo"
function claseEstado(estado) {
  return ESTADOS[estado]?.clase || "";
}

// Valida si una transición de estado es permitida
// Caja solo puede: nuevo_en_caja → pagado  |  nuevo_en_caja → cancelado
function transicionValida(estadoActual, estadoNuevo) {
  const permitidas = {
    nuevo_en_caja: ["pagado", "cancelado"],
    pagado:        ["en_cocina"],          // cocina cambia este
    en_cocina:     ["listo"],              // cocina cambia este
    listo:         ["entregado"],          // caja puede marcar entregado
    entregado:     [],                     // estado final
    cancelado:     [],                     // estado final
  };

  const posibles = permitidas[estadoActual] || [];
  return posibles.includes(estadoNuevo);
}

/* =======================
   CATEGORÍAS DE GASTOS
======================= */

const CATEGORIAS_GASTOS = [
  { valor: "materia_prima", etiqueta: "Materia prima" },
  { valor: "insumos",       etiqueta: "Insumos"       },
  { valor: "limpieza",      etiqueta: "Limpieza"      },
  { valor: "servicios",     etiqueta: "Servicios"     },
  { valor: "otros",         etiqueta: "Otros"         },
];

/* =======================
   MÉTODOS DE PAGO
======================= */

const METODOS_PAGO = [
  { valor: "efectivo",      etiqueta: "Efectivo"      },
  { valor: "transferencia", etiqueta: "Transferencia" },
];

/* =======================
   EXPORTAR
======================= */

window.Utils = {
  CONFIG,
  formatearDinero,
  formatearHora,
  formatearFecha,
  tiempoTranscurrido,
  nivelRetraso,
  fechaHoy,
  horaActual,
  generarIdPedido,
  generarIdGasto,
  validarMonto,
  validarCampoRequerido,
  validarPedido,
  validarGasto,
  ESTADOS,
  etiquetaEstado,
  claseEstado,
  transicionValida,
  CATEGORIAS_GASTOS,
  METODOS_PAGO,
};

console.log("✓ utils.js cargado");
