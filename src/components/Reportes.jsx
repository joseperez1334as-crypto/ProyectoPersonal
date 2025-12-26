import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ************************************************
// 🚨 1. IMPORTACIONES Y REGISTRO DE CHART.JS 
// ESTO ES NECESARIO PARA QUE EL GRAFICO SE DIBUJE
// ************************************************
import { 
    Chart as ChartJS, 
    CategoryScale, 
    LinearScale, 
    BarElement, 
    Title, 
    Tooltip, 
    Legend, 
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

// ************************************************
// 🚨 2. HELPERS DE FORMATO Y FECHAS
// ************************************************

const formatCurrency = (num) => new Intl.NumberFormat('es-CO', { 
    style: 'currency', 
    currency: 'COP', 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
}).format(num);

const formatTimeCo = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return '—';
    // Muestra la hora y fecha en formato local de Colombia
    return timestamp.toDate().toLocaleString('es-CO', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true, 
        timeZone: 'America/Bogota' 
    });
};

const getMonthName = (monthIndex) => {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return months[monthIndex];
};


// FUNCIÓN CLAVE: CALCULAR RANGO DE FECHAS (Unifica la lógica)
const getRangeByFilter = (filter) => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    // Ajustamos la hora fin al último milisegundo de HOY (en la zona local)
    end.setHours(23, 59, 59, 999); 

    switch (filter) {
        case 'dia':
            start.setHours(0, 0, 0, 0);
            break;
        case 'semana':
            // Inicia el domingo (0)
            start.setDate(now.getDate() - now.getDay()); 
            start.setHours(0, 0, 0, 0);
            break;
        case 'mes':
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            break;
        case 'anio':
            start.setMonth(0, 1);
            start.setHours(0, 0, 0, 0);
            break;
        default:
            start.setHours(0, 0, 0, 0);
    }
    return { start, end };
};

// ************************************************
// 🚨 3. COMPONENTE PRINCIPAL
// ************************************************

const Reportes = () => {
    // ESTADOS
    const [activeTab, setActiveTab] = useState('tabla'); 
    const [selectedTableDate, setSelectedTableDate] = useState(new Date().toISOString().substring(0, 10)); 
    const [filterGraph, setFilterGraph] = useState('dia'); // Filtro para el GRÁFICO (dia, semana, mes, anio)

    const [ventas, setVentas] = useState([]);
    const [salidas, setSalidas] = useState([]);
    const [userMap, setUserMap] = useState({}); 
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [graphData, setGraphData] = useState({ labels: [], data: [] });

    // Mapear Usuarios
    useEffect(() => {
        const loadUsers = async () => {
            try {
                const userSnap = await getDocs(collection(db, 'usuarios'));
                const map = {};
                userSnap.docs.forEach(d => {
                    const data = d.data();
                    map[d.id] = `${data.nombre} ${data.apellido || ''}`;
                });
                setUserMap(map);
            } catch (err) {
                console.error("Error cargando usuarios:", err);
            }
        };
        loadUsers();
    }, []);

    // AGREGACIÓN DE DATOS PARA EL GRÁFICO
    const aggregateData = (allVentas, allSalidas, level) => {
        const dataMap = new Map();
        
        const getGroupKey = (date) => {
            const year = date.getFullYear();
            const month = date.getMonth();
            const day = date.getDate();

            if (level === 'anio') return String(year);
            if (level === 'mes') return `${getMonthName(month)} ${year}`;
            // Retorna YYYY-MM-DD para el nivel 'dia'
            return `${year}-${month + 1 < 10 ? '0' : ''}${month + 1}-${day < 10 ? '0' : ''}${day}`;
        };

        // Procesar Ventas
        allVentas.forEach(v => {
            const date = v.fecha.toDate();
            const key = getGroupKey(date);
            const total = v.total;
            
            if (!dataMap.has(key)) {
                dataMap.set(key, { ventas: 0, salidas: 0, balance: 0 });
            }
            const current = dataMap.get(key);
            current.ventas += total;
            current.balance += total;
        });

        // Procesar Salidas
        allSalidas.forEach(s => {
            const date = s.fecha.toDate();
            const key = getGroupKey(date);
            const valor = s.valor;

            if (!dataMap.has(key)) {
                dataMap.set(key, { ventas: 0, salidas: 0, balance: 0 });
            }
            const current = dataMap.get(key);
            current.salidas += valor;
            current.balance -= valor;
        });

        // Ordenar por clave para el gráfico
        const sortedKeys = Array.from(dataMap.keys()).sort();
        
        const labels = [];
        const balances = [];

        sortedKeys.forEach(key => {
            labels.push(key);
            balances.push(dataMap.get(key).balance);
        });

        setGraphData({ labels, data: balances });
    };

    // EFECTO PRINCIPAL (Recarga los datos para la TABLA O GRÁFICO)
    useEffect(() => {
        const fetchReportData = async () => {
            setLoading(true);
            setError(null);
            
            let start, end;
            
            if (activeTab === 'tabla') {
                // Lógica de fecha para la tabla (día único)
                const dateObj = new Date(selectedTableDate);
                
                // Calculamos el inicio y fin del día ajustando al UTC-5 (Colombia) para la consulta
                // Esto ayuda a que el filtro de Firestore se alinee con el día local.
                start = new Date(dateObj); 
                start.setHours(5, 0, 0, 0); // 00:00:00 hora de Colombia

                end = new Date(dateObj); 
                end.setDate(end.getDate() + 1); // Avanza al día siguiente
                end.setHours(4, 59, 59, 999); // 23:59:59.999 hora de Colombia
                
            } else {
                // Lógica de fecha para el gráfico (rango dinámico: día, semana, mes, año)
                const range = getRangeByFilter(filterGraph);
                start = range.start;
                end = range.end;
            }

            if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
                setLoading(false);
                return;
            }

            try {
                // Consultas
                const ventasQuery = query(
                    collection(db, "ventas"), 
                    where("fecha", ">=", start), 
                    where("fecha", "<=", end)
                );
                const salidasQuery = query(
                    collection(db, "salidas"), 
                    where("fecha", ">=", start), 
                    where("fecha", "<=", end)
                );

                const ventasSnap = await getDocs(ventasQuery);
                const salidasSnap = await getDocs(salidasQuery);
                
                const fetchedVentas = ventasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const fetchedSalidas = salidasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                if (activeTab === 'tabla') {
                    setVentas(fetchedVentas);
                    setSalidas(fetchedSalidas);
                } else {
                    aggregateData(fetchedVentas, fetchedSalidas, filterGraph);
                }

            } catch (err) {
                console.error("Error al generar reporte:", err);
                setError("Error al cargar los datos del reporte. Verifique su conexión y permisos.");
            } finally {
                setLoading(false);
            }
        };

        fetchReportData();
    }, [selectedTableDate, activeTab, filterGraph]); 


    // Lógica de Exportación a PDF
    const exportToPDF = () => {
        const doc = new jsPDF();
        const dateStr = new Date(selectedTableDate).toLocaleDateString('es-ES');
        
        const totalVentas = ventas.reduce((sum, v) => sum + v.total, 0);
        const totalSalidas = salidas.reduce((sum, s) => sum + s.valor, 0);
        const balance = totalVentas - totalSalidas;
        
        // --- VENDAS (Tabla 1) ---
        doc.setFontSize(14);
        doc.text(`REPORTE DIARIO DE VENTAS - ${dateStr}`, 15, 20);
        doc.setFontSize(10);
        
        const ventasData = ventas.map(v => [
            v.nombreProducto,
            v.cantidadVendida,
            formatCurrency(v.precioVenta),
            formatCurrency(v.total),
            userMap[v.vendedorId] || 'N/A', 
            formatTimeCo(v.fecha).split(',')[1].trim(), 
        ]);
        
        doc.autoTable({
            startY: 25,
            head: [['Producto', 'Cant.', 'Precio Venta', 'Total', 'Vendedor', 'Hora']],
            body: ventasData,
            foot: [['', '', '', `Total Ventas: ${formatCurrency(totalVentas)}`, '', '']],
            footStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' }
        });

        // --- SALIDAS (Tabla 2) ---
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.text("SALIDAS Y EGRESOS", 15, finalY);

        const salidasData = salidas.map(s => [
            s.motivo,
            formatCurrency(s.valor),
            userMap[s.registradoPorId] || 'N/A',
            formatTimeCo(s.fecha).split(',')[1].trim(), 
        ]);

        doc.autoTable({
            startY: finalY + 5,
            head: [['Motivo', 'Valor', 'Registrado Por', 'Hora']],
            body: salidasData,
            foot: [['', `Total Salidas: -${formatCurrency(totalSalidas)}`, '', '']],
            footStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold' }
        });
        
        // --- BALANCE FINAL ---
        const finalBalanceY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setTextColor(balance >= 0 ? 34 : 255, balance >= 0 ? 139 : 0, 34);
        doc.text(`BALANCE EN CAJA: ${formatCurrency(balance)}`, 15, finalBalanceY);

        doc.save(`Reporte_Diario_${dateStr}.pdf`);
    };
    
    // Cálculos de Totales (para JSX)
    const totalVentas = ventas.reduce((sum, v) => sum + v.total, 0);
    const totalSalidas = salidas.reduce((sum, s) => sum + s.valor, 0);
    const balance = totalVentas - totalSalidas;


    if (loading) return <p>Cargando reporte...</p>;


    return (
        <div className="reportes-container">
            <h2>📊 Módulo de Reportes</h2>
            
            {/* Pestañas */}
            <div className="tabs-nav" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <button className={activeTab === 'tabla' ? 'active' : ''} onClick={() => setActiveTab('tabla')}>
                    Reporte por Tabla
                </button>
                <button className={activeTab === 'grafico' ? 'active' : ''} onClick={() => setActiveTab('grafico')}>
                    Reporte Gráfico
                </button>
            </div>

            {error && <p style={{ color: 'red' }}>Error: {error}</p>}
            
            {/* -------------------------------------------------------- */}
            {/* --- VISTA DE TABLA (Reporte Diario) --- */}
            {/* -------------------------------------------------------- */}
            {activeTab === 'tabla' && (
                <div className="reporte-tabla">
                    <h3>Reporte Detallado por Día</h3>
                    
                    {/* Controles */}
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                        <label>Seleccionar Fecha:</label>
                        <input 
                            type="date" 
                            value={selectedTableDate}
                            onChange={(e) => setSelectedTableDate(e.target.value)}
                            style={{ padding: '8px' }}
                        />
                        <button onClick={exportToPDF} style={{ padding: '8px 15px', background: '#DC3545', color: 'white', border: 'none', borderRadius: '4px' }}>
                            Exportar a PDF
                        </button>
                    </div>

                    {/* Resumen de Totales */}
                    <div className="resumen-totales" style={{ border: '1px solid #1a73e8', padding: '15px', borderRadius: '8px', marginBottom: '20px', background: '#e0f7fa' }}>
                        <p>Total Ventas Netas: <strong>{formatCurrency(totalVentas)}</strong></p>
                        <p>Total Salidas: <strong>{formatCurrency(totalSalidas)}</strong></p>
                        <h4 style={{ color: balance >= 0 ? 'green' : 'red' }}>BALANCE FINAL: {formatCurrency(balance)}</h4>
                    </div>

                    {/* Tablas de Venta y Salida */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                        <div className="ventas-reporte">
                            <h4>Ventas Realizadas</h4>
                            <div className="table-container">
                                <table className="tabla-ventas">
                                    <thead>
                                        <tr>
                                            <th>Hora</th><th>Producto</th><th>Cant.</th><th>Precio Venta</th><th>Total</th><th>Vendedor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ventas.map(v => (
                                            <tr key={v.id}>
                                                <td>{formatTimeCo(v.fecha).split(',')[1].trim()}</td><td>{v.nombreProducto}</td><td>{v.cantidadVendida}</td><td>{formatCurrency(v.precioVenta)}</td><td>{formatCurrency(v.total)}</td><td>{userMap[v.vendedorId] || 'N/A'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="salidas-reporte">
                            <h4>Salidas (Egresos)</h4>
                            <div className="table-container">
                                <table className="tabla-salidas">
                                    <thead>
                                        <tr>
                                            <th>Hora</th><th>Motivo</th><th>Valor</th><th>Registrado Por</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {salidas.map(s => (
                                            <tr key={s.id}>
                                                <td>{formatTimeCo(s.fecha).split(',')[1].trim()}</td><td>{s.motivo}</td><td>{formatCurrency(s.valor)}</td><td>{userMap[s.registradoPorId] || 'N/A'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* -------------------------------------------------------- */}
            {/* --- VISTA DE GRÁFICO (Reporte Agregado) --- */}
            {/* -------------------------------------------------------- */}
            {activeTab === 'grafico' && (
                <div className="reporte-grafico">
                    <h3>Análisis de Balance en Caja</h3>

                    {/* Controles de Filtro */}
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <label>Seleccionar Rango:</label>
                        <select value={filterGraph} onChange={(e) => setFilterGraph(e.target.value)} style={{ padding: '8px' }}>
                            <option value="dia">Este Día</option>
                            <option value="semana">Esta Semana</option>
                            <option value="mes">Este Mes</option>
                            <option value="anio">Este Año</option>
                        </select>
                        <label style={{ fontSize: '0.9em', color: '#555' }}>
                            {/* Muestra el rango calculado */}
                            Rango de Consulta (Local): {getRangeByFilter(filterGraph).start.toLocaleDateString()} — {getRangeByFilter(filterGraph).end.toLocaleDateString()}
                        </label>
                    </div>

                    {/* Área del Gráfico */}
                    <div style={{ maxWidth: '800px', height: '400px', margin: '0 auto', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
                        {graphData.labels.length > 0 ? (
                            <Bar
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false, 
                                    plugins: {
                                        legend: { position: 'top' },
                                        title: { display: true, text: `Balance de Caja por ${filterGraph.toUpperCase()}` },
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            title: { display: true, text: 'Balance (COP)' },
                                            // Formato de pesos en el tooltip/eje (opcional, Chart.js maneja bien los números grandes)
                                            ticks: {
                                                callback: function(value) {
                                                    return formatCurrency(value);
                                                }
                                            }
                                        }
                                    },
                                }}
                                data={{
                                    labels: graphData.labels, 
                                    datasets: [{
                                        label: 'Balance Neto',
                                        data: graphData.data, 
                                        backgroundColor: graphData.data.map(val => val >= 0 ? '#4CAF50' : '#E53935'), 
                                    }]
                                }}
                            />
                        ) : (
                            <p style={{textAlign: 'center', padding: '50px', background: '#f8f8f8'}}>
                                No hay datos en el rango seleccionado para graficar.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reportes;