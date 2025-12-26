import React, { useState, useEffect } from "react";
import { db, auth } from '../firebaseConfig';
import { collection, doc, getDocs, addDoc, updateDoc, query, where, runTransaction, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth'; 
import './AdminDashboard'; 

// --- FUNCIÓN DE FORMATO MONETARIO (SIN DECIMALES) ---
const formatCurrency = (number) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP', 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0,
    }).format(number);
};

// Helper para obtener el inicio y fin del día actual (sin cambios)
// Nueva función más flexible (usada en Reportes y Ventas)
const getDayRange = (dateString) => {
    // 1. Crear el objeto Date a partir del string (YYYY-MM-DD)
    // El 'T00:00:00' fuerza a interpretarlo como medianoche LOCAL
    const dateObj = new Date(dateString + 'T00:00:00'); 

    // 2. Definir el inicio (Medianoche del día seleccionado, hora de Colombia)
    const start = new Date(dateObj);
    
    // 3. Definir el final (Medianoche del día siguiente - 1ms)
    const end = new Date(dateObj);
    end.setDate(end.getDate() + 1); // Avanza al día siguiente
    end.setMilliseconds(-1);        // Retrocede 1 milisegundo

    // Firestore lo guardará como UTC, pero la consulta usará estas marcas de tiempo.
    return { start, end };
};

// --- FUNCIÓN HELPER PARA HORA COLOMBIA (UTC-5) (sin cambios) ---
const formatTimeCo = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return '—';
    const date = timestamp.toDate();
    return date.toLocaleTimeString('es-CO', {
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: true, 
        timeZone: 'America/Bogota' 
    });
};


const Ventas = () => {
  // 1. ESTADOS DE DATOS
  const [productos, setProductos] = useState([]);
  const [ventasDiarias, setVentasDiarias] = useState([]);
  const [salidasDiarias, setSalidasDiarias] = useState([]);
  const [userRol, setUserRol] = useState(null); 
  
  // 2. ESTADOS DE FORMULARIO DE VENTA
  const [productoSeleccionado, setProductoSeleccionado] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [precioVentaInput, setPrecioVentaInput] = useState(''); 
  const [precioVentaValor, setPrecioVentaValor] = useState(0); 
  
  // 👇 --- NUEVOS ESTADOS PARA NOTA ---
  const [notaVenta, setNotaVenta] = useState('');
  const [mostrarNota, setMostrarNota] = useState(false); 
  // 👆 --- FIN NUEVOS ESTADOS ---

  // 3. ESTADOS DE FORMULARIO DE SALIDA
  const [motivoSalida, setMotivoSalida] = useState("");
  const [valorSalida, setValorSalida] = useState("");

  // 4. ESTADOS DE FEEDBACK
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [mensajeTipo, setMensajeTipo] = useState(""); 
  const [stockInsuficiente, setStockInsuficiente] = useState(false); 


  // 5. EFECTO: Cargar Inventario y verificar rol al montar (sin cambios)
  useEffect(() => {
    const cargarDatosIniciales = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, "inventario"));
          const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setProductos(data);
        } catch (error) {
          console.error("Error al cargar productos:", error);
          setMensaje("Error al cargar productos para la venta.", "error");
        }
        const user = auth.currentUser;
        if (user) {
          const userDocRef = doc(db, 'usuarios', user.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            setUserRol(userSnap.data().rol); 
          }
        }
        setLoading(false);
      };
      cargarDatosIniciales();
    }, []);

  // 6. OBTENER VENTAS Y SALIDAS DEL DÍA (READ DIARIO - sin cambios)
  const cargarRegistrosDiarios = async () => {
    const { start, end } = getTodayRange();
    const ventasQuery = query(collection(db, "ventas"), where("fecha", ">=", start), where("fecha", "<=", end));
    const salidasQuery = query(collection(db, "salidas"), where("fecha", ">=", start), where("fecha", "<=", end));
    try {
        const ventasSnap = await getDocs(ventasQuery);
        setVentasDiarias(ventasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        const salidasSnap = await getDocs(salidasQuery);
        setSalidasDiarias(salidasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
        console.error("Error cargando registros diarios:", error);
        setMensaje("Error al cargar ventas/salidas del día.", "error");
    }
  };

  useEffect(() => {
    if (!loading) cargarRegistrosDiarios();
  }, [productos, loading]); 


  // --- FUNCIÓN DE FORMATO Y CONVERSIÓN A ENTERO ---
  const handlePrecioChange = (e) => {
    const rawValue = e.target.value.replace(/[$,.]/g, ''); 
    if (!/^\d*$/.test(rawValue)) return;

    const numberValue = parseInt(rawValue) || 0;
    
    const formattedInput = new Intl.NumberFormat('es-CO', {
      style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(numberValue);

    setPrecioVentaInput(formattedInput); 
    setPrecioVentaValor(numberValue); 
  };


  // 7. TRANZACCIÓN CRÍTICA: Registrar Venta y Descontar Stock
  const handleRegistrarVenta = async (e) => {
    e.preventDefault();
    setMensaje(null); setMensajeTipo(null);
    setStockInsuficiente(false); 

    const producto = productos.find(p => p.id === productoSeleccionado);
    const precioUnitarioVenta = precioVentaValor; 
    const cantidadVendida = parseInt(cantidad);
    
    // Validación de campos y precio
    if (!producto || cantidadVendida <= 0 || precioUnitarioVenta <= 0) {
      setMensaje("Completa todos los campos con valores válidos.", "error");
      return;
    }

    const productoRef = doc(db, "inventario", producto.id);
    const vendedorId = auth.currentUser ? auth.currentUser.uid : "desconocido";

    try {
      await runTransaction(db, async (transaction) => {
        const productoDoc = await transaction.get(productoRef);
        
        if (!productoDoc.exists) {
          throw new Error("El producto ya no existe en el inventario.");
        }

        const stockActual = parseInt(productoDoc.data().cantidad);
        const nuevoStock = stockActual - cantidadVendida;

        // VALIDACIÓN CRÍTICA: Stock
        if (nuevoStock < 0) {
          setStockInsuficiente(true);
          throw new Error(`Stock insuficiente. Solo quedan ${stockActual} unidades de ${producto.nombre}.`);
        }

        // ESCRITURA 1: Actualizar el inventario
        transaction.update(productoRef, { cantidad: nuevoStock });

        // ESCRITURA 2: Crear el registro de la venta
        const ventaRef = doc(collection(db, "ventas"));
        transaction.set(ventaRef, {
          productoId: producto.id,
          nombreProducto: producto.nombre,
          precioVenta: precioUnitarioVenta,
          cantidadVendida: cantidadVendida,
          fecha: new Date(), 
          total: precioUnitarioVenta * cantidadVendida,
          vendedorId: vendedorId,
          // 👇 --- CAMBIO CLAVE: Incluir la nota (vacía si no se activa) ---
          nota: mostrarNota ? notaVenta.trim() : '', 
        });
      });

      setMensaje("Venta registrada y stock descontado con éxito.", "success");
      
      // Limpiar formulario Y NOTA
      setProductoSeleccionado("");
      setCantidad(1);
      setPrecioVentaInput('');
      setPrecioVentaValor(0);
      setNotaVenta(''); // Limpia la nota
      setMostrarNota(false); // Oculta el campo de nota
      
      cargarRegistrosDiarios();

    } catch (e) {
        if (e.message && e.message.includes("Stock insuficiente")) {
            // Ya el aviso se seteo antes
        } else {
            console.error("Fallo la transacción:", e);
            setMensaje("Fallo la transacción de venta. Verifica los datos.", "error");
        }
    }
  };


  // 8. REGISTRAR SALIDA (EGRESO - sin cambios)
  const handleRegistrarSalida = async (e) => {
    e.preventDefault();
    setMensaje(null); setMensajeTipo(null);

    const valorInput = valorSalida.replace(/[$,.]/g, ''); 
    const valorNumerico = parseInt(valorInput) || 0; 
    
    if (!motivoSalida.trim() || valorNumerico <= 0) {
      setMensaje("Ingresa un motivo y un valor válido (sin decimales).", "error");
      return;
    }
    
    try {
      await addDoc(collection(db, "salidas"), {
        motivo: motivoSalida.trim(),
        valor: valorNumerico, 
        fecha: new Date(),
        registradoPorId: auth.currentUser ? auth.currentUser.uid : "desconocido",
      });

      setMensaje("Salida registrada con éxito.", "success");
      setMotivoSalida("");
      setValorSalida("");
      cargarRegistrosDiarios(); 

    } catch (error) {
      console.error("Error al registrar salida:", error);
      setMensaje("Error al registrar la salida.", "error");
    }
  };
  
  // Función para manejar el input de salida con formato (sin cambios)
  const handleSalidaChange = (e) => {
    const rawValue = e.target.value.replace(/[$,.]/g, '');
    if (!/^\d*$/.test(rawValue)) return;

    const numberValue = parseInt(rawValue) || 0;
    
    const formattedInput = new Intl.NumberFormat('es-CO', {
      style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(numberValue);

    setValorSalida(formattedInput); 
  };


  // 9. CÁLCULOS DE TOTALES
  const totalVentas = ventasDiarias.reduce((sum, venta) => sum + venta.total, 0);
  const totalSalidas = salidasDiarias.reduce((sum, salida) => sum + salida.valor, 0);
  const balanceFinal = totalVentas - totalSalidas;
  const fechaActual = new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });


  if (loading) return <p>Cargando datos de ventas...</p>;

  return (
    <div className="ventas-container">
      <h2>💸 Registro y Balance Diario</h2>
      
      {/* Información de Fecha */}
      <div className="info-box" style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <strong>Fecha Actual:</strong> {fechaActual}
      </div>

      {/* Mensaje de Feedback */}
      {mensaje && (
        <p style={{ color: mensajeTipo === 'error' ? 'red' : 'green', fontWeight: 'bold' }}>
          {mensaje}
        </p>
      )}

      {/* Aviso de Stock */}
      {stockInsuficiente && (
        <div style={{ padding: '10px', backgroundColor: '#fdd', color: 'red', borderRadius: '8px', marginBottom: '15px', fontWeight: 'bold' }}>
            🚨 Producto no disponible. Stock insuficiente para esa cantidad.
        </div>
      )}

      {/* --- SECCIÓN PRINCIPAL: VENTAS Y SALIDAS --- */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        
        {/* 1. REGISTRAR VENTA */}
        <div style={{ flex: '1 1 300px', background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3>Registrar Venta</h3>
          <form onSubmit={handleRegistrarVenta} className="venta-form">
            <label>Producto:</label>
            <select
              value={productoSeleccionado}
              onChange={(e) => {
                setProductoSeleccionado(e.target.value);
                const p = productos.find(p => p.id === e.target.value);
                // Inicializa el precio de venta con el precio del inventario (formateado)
                setPrecioVentaInput(p ? p.precio.toLocaleString('es-CO', { minimumFractionDigits: 0 }) : '');
                setPrecioVentaValor(p ? p.precio : 0);
              }}
              required
            >
              <option value="">-- Selecciona un producto --</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id} disabled={p.cantidad < 1}>
                  {p.nombre} ({p.cantidad} en stock) — {formatCurrency(p.precio)}
                </option>
              ))}
            </select>

            <label>Precio de Venta Final:</label>
            <input
              type="text" 
              value={precioVentaInput}
              onChange={handlePrecioChange}
              placeholder="Ej: 15.000"
              required
            />

            <label>Cantidad:</label>
            <input
              type="number"
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              min="1"
              required
            />
            
            {/* 👇 --- BOTÓN DE ALTERNANCIA DE NOTA --- */}
            <button 
                type="button" 
                onClick={() => setMostrarNota(!mostrarNota)}
                style={{ 
                    backgroundColor: mostrarNota ? '#e53935' : '#4CAF50', // Rojo si está activa, Verde si no
                    color: 'white',
                    padding: '8px',
                    borderRadius: '4px',
                    width: '100%',
                    marginTop: '5px'
                }}
            >
                {mostrarNota ? '❌ Ocultar Nota' : '➕ Agregar Nota (Opcional)'}
            </button>

            {/* 👇 --- CAMPO DE NOTA (Muestra condicionalmente) --- */}
            {mostrarNota && (
                <div style={{ width: '100%' }}>
                    <label>Nota de Venta:</label>
                    <textarea
                        value={notaVenta}
                        onChange={(e) => setNotaVenta(e.target.value)}
                        placeholder="Ej: Se dejó a deber / Se aplicó 10% de descuento."
                        rows="2"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    ></textarea>
                </div>
            )}
            {/* 👆 --- FIN CAMPO DE NOTA --- */}

            <button type="submit" className="btn-success" style={{ marginTop: '10px' }}>Registrar Venta</button>
          </form>
        </div>

        {/* 2. REGISTRAR SALIDA */}
        <div style={{ flex: '1 1 300px', background: '#f9f9f9', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3>Registrar Salida (Gasto/Egreso)</h3>
          <form onSubmit={handleRegistrarSalida} className="venta-form">
            <label>Motivo:</label>
            <input
              type="text"
              value={motivoSalida}
              onChange={(e) => setMotivoSalida(e.target.value)}
              required
            />
            <label>Valor:</label>
            <input
              type="text" 
              value={valorSalida}
              onChange={handleSalidaChange} 
              placeholder="Ej: 5.000"
              required
            />
            <button type="submit" className="btn-danger">Registrar Salida</button>
          </form>
        </div>
      </div>

      <hr style={{ margin: '30px 0' }} />

      {/* --- SECCIÓN DE REPORTES DIARIOS --- */}
      <h3>Resumen Diario ({new Date().toLocaleDateString()})</h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>

        {/* CÁLCULO DE BALANCE */}
        <div className="resumen-card" style={{ padding: '15px', border: '2px solid #1a73e8', borderRadius: '8px', background: '#d2e3fc' }}>
          <h4>BALANCE DEL DÍA</h4>
          <p>Ventas Netas: <strong>{formatCurrency(totalVentas)}</strong></p>
          <p>Salidas: <strong>-{formatCurrency(totalSalidas)}</strong></p>
          <h4 style={{ color: balanceFinal >= 0 ? 'green' : 'red' }}>Total en Caja: {formatCurrency(balanceFinal)}</h4>
        </div>

        {/* TABLA DE VENTAS */}
        <div>
          <h4>Ventas Registradas ({ventasDiarias.length})</h4>
          <div className="table-container">
            <table className="tabla-ventas">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Producto</th>
                  <th>Cant.</th>
                  <th>Total</th>
                  <th>Nota</th> {/* 👈 COLUMNA AÑADIDA */}
                </tr>
              </thead>
              <tbody>
                {ventasDiarias.sort((a, b) => b.fecha.seconds - a.fecha.seconds).map(v => (
                  <tr key={v.id}>
                    <td>{formatTimeCo(v.fecha)}</td> 
                    <td>{v.nombreProducto}</td>
                    <td>{v.cantidadVendida}</td>
                    <td>{formatCurrency(v.total)}</td> 
                    <td>{v.nota || '—'}</td> {/* 👈 CAMPO AÑADIDO */}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="4"><strong>TOTAL VENTAS</strong></td> {/* span ajustado a 4 */}
                  <td><strong>{formatCurrency(totalVentas)}</strong></td> 
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* TABLA DE SALIDAS (sin cambios) */}
        <div>
          <h4>Salidas (Egresos) Registradas ({salidasDiarias.length})</h4>
          <div className="table-container">
            <table className="tabla-salidas">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Motivo</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {salidasDiarias.sort((a, b) => b.fecha.seconds - a.fecha.seconds).map(s => (
                  <tr key={s.id}>
                    <td>{formatTimeCo(s.fecha)}</td> 
                    <td>{s.motivo}</td>
                    <td>-{formatCurrency(s.valor)}</td> 
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="2"><strong>TOTAL SALIDAS</strong></td>
                  <td><strong>-{formatCurrency(totalSalidas)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default Ventas;