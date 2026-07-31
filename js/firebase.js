/* =======================
   FIREBASE.JS
   Responsable de:
   - Conectar a Firebase
   - Leer y escribir datos
   - Indicador de conexión en tiempo real
   - Escuchar cambios en tiempo real
======================= */

/* =======================
   CONFIGURACIÓN FIREBASE
======================= */

const firebaseConfig = {
  apiKey:            "AIzaSyBI6MjIl_obOd4eKV-p-phEEOisM_61_L0",
  authDomain:        "begli-fratelli-s.firebaseapp.com",
  databaseURL:       "https://begli-fratelli-s-default-rtdb.firebaseio.com",
  projectId:         "begli-fratelli-s",
  storageBucket:     "begli-fratelli-s.firebasestorage.app",
  messagingSenderId: "712897993318",
  appId:             "1:712897993318:web:45cdf8879f0981d65eaba7",
  measurementId:     "G-CLKLE8NK6L"
};

/* =======================
   VARIABLES INTERNAS
======================= */

let db             = null;
let conectado      = false;
let cbConectado    = null;   // función que se llama al conectar
let cbDesconectado = null;   // función que se llama al desconectar

/* =======================
   BASE DE DATOS
======================= */

// Inicia Firebase y comienza a escuchar estado de conexión
function iniciarFirebase(onConectado, onDesconectado) {
  cbConectado    = onConectado    || function() {};
  cbDesconectado = onDesconectado || function() {};

  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();

    // /.info/connected es una ruta especial de Firebase
    // cambia automáticamente a true/false según el estado de la red
    db.ref(".info/connected").on("value", function(snap) {
      conectado = snap.val() === true;

      if (conectado) {
        console.log("✓ Firebase conectado");
        cbConectado();
      } else {
        console.warn("⚠ Firebase desconectado");
        cbDesconectado();
      }
    });

    return true;
  } catch (err) {
    console.error("✗ Error iniciando Firebase:", err.message);
    cbDesconectado();
    return false;
  }
}

// Retorna true si hay conexión activa con Firebase
function estaConectado() {
  return conectado;
}

/* =======================
   ESCRITURA EN FIREBASE
======================= */

// Guarda un objeto en una ruta específica
// Ejemplo: guardarDato("pedidos/P123", { mesa: "Mesa 3" })
async function guardarDato(ruta, datos) {
  if (!db) throw new Error("Firebase no inicializado");
  await db.ref(ruta).set(datos);
}

// Actualiza campos específicos sin borrar el resto
// Ejemplo: actualizarDato("pedidos/P123", { estado: "pagado" })
async function actualizarDato(ruta, datos) {
  if (!db) throw new Error("Firebase no inicializado");
  await db.ref(ruta).update(datos);
}

/* =======================
   LECTURA EN FIREBASE
======================= */

// Lee datos una sola vez (no escucha cambios)
// Ideal para estadísticas e historial
async function leerDato(ruta) {
  if (!db) throw new Error("Firebase no inicializado");
  const snap = await db.ref(ruta).once("value");
  return snap.exists() ? snap.val() : null;
}

// Escucha cambios en tiempo real
// Se ejecuta cada vez que algo cambia en esa ruta
// Retorna función para dejar de escuchar
function escucharCambios(ruta, callback) {
  if (!db) throw new Error("Firebase no inicializado");

  const ref = db.ref(ruta);

  ref.on("value", function(snap) {
    callback(null, snap.exists() ? snap.val() : null);
  }, function(err) {
    callback(err, null);
  });

  // Retorna función para dejar de escuchar cuando no se necesite
  return function() { ref.off(); };
}

// Escucha solo los pedidos del día de hoy
// Filtra por timestamp para no cargar pedidos viejos
function escucharPedidosHoy(callback) {
  if (!db) throw new Error("Firebase no inicializado");

  // Inicio del día actual en timestamp
  const inicioDia = new Date();
  inicioDia.setHours(0, 0, 0, 0);
  const tsInicio = inicioDia.getTime();

  const ref = db.ref("pedidos")
    .orderByChild("timestamp")
    .startAt(tsInicio);

  ref.on("value", function(snap) {
    const datos = snap.val();
    if (!datos) {
      callback(null, []);
      return;
    }

    // Convierte objeto de Firebase en array ordenado por timestamp
    const lista = Object.values(datos).sort(function(a, b) {
      return b.timestamp - a.timestamp; // más reciente primero
    });

    callback(null, lista);
  }, function(err) {
    callback(err, []);
  });

  return function() { ref.off(); };
}

// Lee todos los pedidos de una fecha específica
// formato fecha: "2025-07-27"
async function leerPedidosPorFecha(fecha) {
  if (!db) throw new Error("Firebase no inicializado");

  const inicio = new Date(fecha + "T00:00:00").getTime();
  const fin    = new Date(fecha + "T23:59:59").getTime();

  const snap = await db.ref("pedidos")
    .orderByChild("timestamp")
    .startAt(inicio)
    .endAt(fin)
    .once("value");

  if (!snap.exists()) return [];

  return Object.values(snap.val()).sort(function(a, b) {
    return b.timestamp - a.timestamp;
  });
}

/* =======================
   PEDIDOS — ACCIONES
======================= */

// Cambia el estado de un pedido en Firebase
async function cambiarEstadoPedido(idPedido, estadoNuevo, datosExtra) {
  const actualizacion = {
    estado: estadoNuevo,
    ...datosExtra
  };
  await actualizarDato("pedidos/" + idPedido, actualizacion);
}

/* =======================
   GASTOS — ACCIONES
======================= */

// Guarda un nuevo gasto en Firebase
async function guardarGasto(gasto) {
  await guardarDato("gastos/" + gasto.id, gasto);
}

// Lee todos los gastos del día de hoy
async function leerGastosHoy() {
  const hoy    = Utils.fechaHoy();
  const snap   = await db.ref("gastos")
    .orderByChild("fecha")
    .equalTo(hoy)
    .once("value");

  if (!snap.exists()) return [];

  return Object.values(snap.val()).sort(function(a, b) {
    return b.timestamp - a.timestamp;
  });
}

/* =======================
   EXPORTAR
======================= */

window.Firebase = {
  iniciar:              iniciarFirebase,
  estaConectado:        estaConectado,
  guardar:              guardarDato,
  actualizar:           actualizarDato,
  leer:                 leerDato,
  escuchar:             escucharCambios,
  escucharPedidosHoy:   escucharPedidosHoy,
  leerPedidosPorFecha:  leerPedidosPorFecha,
  cambiarEstadoPedido:  cambiarEstadoPedido,
  guardarGasto:         guardarGasto,
  leerGastosHoy:        leerGastosHoy,
};

console.log("✓ firebase.js cargado");
