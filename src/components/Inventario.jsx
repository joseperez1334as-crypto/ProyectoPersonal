import React, { useState, useEffect } from 'react';
// Importamos todas las funciones necesarias de Firestore
import { db, auth } from '../firebaseConfig';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, getDoc } from 'firebase/firestore'; 
import { onAuthStateChanged } from 'firebase/auth';
// Importamos AdminDashboard, aunque no es necesario si se usa CSS global
// import './AdminDashboard'; 

const Inventario = () => {
    // 1. Estados de Datos y Funcionalidad
    const [inventario, setInventario] = useState([]);
    const [userRol, setUserRol] = useState(null); // Rol del usuario logueado
    const [loading, setLoading] = useState(true); // Carga inicial de datos
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    
    // 2. Estados para CREACIÓN
    const [nuevoProducto, setNuevoProducto] = useState({
        nombre: '', cantidad: '', precio: '', categoria: '',
    });

    // 3. Estados para EDICIÓN
    const [editandoId, setEditandoId] = useState(null);
    const [editProducto, setEditProducto] = useState({});

    // 🔹 1. Obtener rol del usuario logueado (LÓGICA SIMPLE Y CONFIABLE)
    // Usamos esta lógica simplificada para obtener el rol, ya que App.jsx valida la sesión.
    useEffect(() => {
        const checkRole = async () => {
            const user = auth.currentUser; // Obtenemos el usuario actual
            if (user) {
                const userDocRef = doc(db, 'usuarios', user.uid);
                const userSnap = await getDoc(userDocRef);
                if (userSnap.exists()) {
                    setUserRol(userSnap.data().rol); // Asignamos el rol
                }
            }
            setLoading(false); // Apagamos el loading después de verificar
        };
        // Para evitar problemas de asincronía en la carga, solo llamamos al check una vez
        if (loading) {
            checkRole();
        }
    }, [loading]);

    // 🔹 2. Obtener inventario (READ)
    const obtenerInventario = async () => {
        setError(null);
        try {
            const querySnapshot = await getDocs(collection(db, 'inventario'));
            const data = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                // Convertir a string para que los inputs tipo number no fallen en React
                cantidad: String(doc.data().cantidad), 
                precio: String(doc.data().precio), 
            }));
            setInventario(data);
        } catch (err) {
            console.error('Error al obtener inventario:', err);
            setError('Error al cargar el inventario.');
        }
    };

    useEffect(() => {
        // Solo cargamos el inventario después de que la verificación de rol haya terminado
        if (!loading) obtenerInventario();
    }, [loading]); 

    // 🔹 3. Agregar producto (CREATE)
    const handleAgregarProducto = async (e) => {
        e.preventDefault();
        setError(null); setSuccess(null);

        // 1. Verificación de permisos (usando el rol de Firestore)
        if (userRol !== 'administrador') {
            setError('Solo el administrador puede agregar productos.'); return;
        }
        if (!Object.values(nuevoProducto).every(field => field !== '')) {
            setError('Por favor completa todos los campos.'); return;
        }

        // 2. Conversión y Validación Numérica
        const cantidadNumerica = parseInt(nuevoProducto.cantidad);
        const precioNumerico = parseFloat(nuevoProducto.precio);

        if (isNaN(cantidadNumerica) || cantidadNumerica < 1) {
            setError("La Cantidad debe ser un número entero válido (mínimo 1).");
            return;
        }
        if (isNaN(precioNumerico) || precioNumerico <= 0) {
            setError("El Precio debe ser un valor numérico mayor a cero.");
            return;
        }

        try {
            // 3. Envío a Firestore
            await addDoc(collection(db, 'inventario'), {
                nombre: nuevoProducto.nombre.trim(),
                categoria: nuevoProducto.categoria,
                cantidad: cantidadNumerica, 
                precio: precioNumerico,      
                fechaIngreso: new Date(),
            });

            setSuccess('Producto agregado correctamente.');
            setNuevoProducto({ nombre: '', cantidad: '', precio: '', categoria: '' });
            obtenerInventario(); 
        } catch (error) {
            console.error('Error al agregar producto:', error);
            setError('Error al agregar producto. Revisa tus reglas de seguridad.');
        }
    };
    
    // 🔹 4. Eliminar producto (DELETE)
    const handleEliminar = async (id, nombre) => {
        if (userRol !== 'administrador') {
            setError('Solo el administrador puede eliminar productos.'); return;
        }
        if (!window.confirm(`¿Estás seguro de eliminar "${nombre}"?`)) return;

        setError(null); setSuccess(null);
        try {
            await deleteDoc(doc(db, 'inventario', id));
            setSuccess(`Producto "${nombre}" eliminado correctamente.`);
            obtenerInventario(); 
        } catch (error) {
            console.error('Error al eliminar producto:', error);
            setError('Error al eliminar producto.');
        }
    };
    
    // 🔹 5. Guardar Edición (UPDATE)
    const handleGuardarEdicion = async (e) => {
        e.preventDefault();
        setError(null); setSuccess(null);

        if (userRol !== 'administrador') {
            setError('Solo el administrador puede editar productos.'); return;
        }
        
        // Validación de campos no vacíos en edición
        if (!editProducto.nombre || !editProducto.cantidad || !editProducto.precio || !editProducto.categoria) {
            setError('Por favor completa todos los campos de edición.'); return;
        }

        // Conversión y Validación Numérica para edición
        const cantidadNumerica = parseInt(editProducto.cantidad);
        const precioNumerico = parseFloat(editProducto.precio);

        if (isNaN(cantidadNumerica) || cantidadNumerica < 0) {
            setError("La Cantidad debe ser un número entero válido (mínimo 0).");
            return;
        }
        if (isNaN(precioNumerico) || precioNumerico <= 0) {
            setError("El Precio debe ser un valor numérico mayor a cero.");
            return;
        }


        try {
            const productoRef = doc(db, 'inventario', editandoId);
            
            await updateDoc(productoRef, {
                nombre: editProducto.nombre.trim(),
                categoria: editProducto.categoria,
                cantidad: cantidadNumerica,
                precio: precioNumerico,
            });

            setEditandoId(null);
            setSuccess(`Producto "${editProducto.nombre}" actualizado correctamente.`);
            obtenerInventario(); 

        } catch (error) {
            console.error('Error al guardar edición:', error);
            setError('Error al guardar edición.');
        }
    };

    if (loading) return <p>Cargando inventario...</p>;
    
    // Determina si el usuario tiene permisos de administrador
    const esAdmin = userRol === 'administrador'; 

    return (
        <div className="inventario-container">
            <h2>🧾 Gestión de Inventario</h2>

            {/* Mensajes de Feedback */}
            {error && <p className="error" style={{ color: 'red' }}>Error: {error}</p>}
            {success && <p className="success" style={{ color: 'green' }}>{success}</p>}
            
            {/* Mostrar formulario de CREACIÓN solo si es admin */}
            {esAdmin && (
                <>
                    <form onSubmit={handleAgregarProducto} className="form-inventario">
                        <h3>Añadir Nuevo Producto</h3>
                        {/* El formulario original de creación es de fila, mantenemos los div.form-group */}
                        <div className="form-group">
                            <input
                                type="text"
                                placeholder="Nombre del producto"
                                value={nuevoProducto.nombre}
                                onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <input
                                type="number"
                                placeholder="Cantidad"
                                value={nuevoProducto.cantidad}
                                onChange={(e) => setNuevoProducto({ ...nuevoProducto, cantidad: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <input
                                type="number"
                                step="0.01"
                                placeholder="Precio"
                                value={nuevoProducto.precio}
                                onChange={(e) => setNuevoProducto({ ...nuevoProducto, precio: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <select
                                value={nuevoProducto.categoria}
                                onChange={(e) => setNuevoProducto({ ...nuevoProducto, categoria: e.target.value })}
                                required
                            >
                                <option value="">Selecciona categoría</option>
                                <option value="Mercancia">Mercancía</option>
                                <option value="Compra">Compra</option>
                            </select>
                        </div>
                        <button type="submit" className="btn-guardar">
                            💾 Guardar producto
                        </button>
                    </form>
                    <hr />
                </>
            )}
            
            {/* Tabla de inventario (READ y EDICIÓN) */}
            <h3>Listado de Stock</h3>
            <div className="table-container">
                <table className="tabla-inventario">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Categoría</th>
                            <th>Cantidad</th>
                            <th>Precio</th>
                            <th>Fecha ingreso</th>
                            {esAdmin && <th>Acciones</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {inventario.length > 0 ? (
                            inventario.map((item) => (
                                <tr key={item.id}>
                                    {/* Celda Nombre */}
                                    <td>
                                        {editandoId === item.id && esAdmin ? (
                                            <input 
                                                type="text"
                                                value={editProducto.nombre}
                                                onChange={(e) => setEditProducto({...editProducto, nombre: e.target.value})}
                                            />
                                        ) : (item.nombre)}
                                    </td>
                                    {/* Celda Categoría */}
                                    <td>
                                        {editandoId === item.id && esAdmin ? (
                                            <select
                                                value={editProducto.categoria}
                                                onChange={(e) => setEditProducto({...editProducto, categoria: e.target.value})}
                                            >
                                                <option value="Mercancia">Mercancía</option>
                                                <option value="Compra">Compra</option>
                                            </select>
                                        ) : (item.categoria)}
                                    </td>
                                    {/* Celda Cantidad */}
                                    <td>
                                        {editandoId === item.id && esAdmin ? (
                                            <input 
                                                type="number"
                                                value={editProducto.cantidad}
                                                onChange={(e) => setEditProducto({...editProducto, cantidad: e.target.value})}
                                            />
                                        ) : (item.cantidad)}
                                    </td>
                                    {/* Celda Precio */}
                                    <td>
                                        {editandoId === item.id && esAdmin ? (
                                            <input 
                                                type="number"
                                                step="0.01"
                                                value={editProducto.precio}
                                                onChange={(e) => setEditProducto({...editProducto, precio: e.target.value})}
                                            />
                                        ) : (`$${Number(item.precio).toLocaleString()}`)}
                                    </td>
                                    {/* Celda Fecha */}
                                    <td>
                                        {item.fechaIngreso?.toDate
                                            ? item.fechaIngreso.toDate().toLocaleDateString()
                                            : '—'}
                                    </td>
                                    
                                    {/* Acciones */}
                                    {esAdmin && (
                                        <td>
                                            {editandoId === item.id ? (
                                                <>
                                                    <button onClick={handleGuardarEdicion} className="btn-guardar-edicion">
                                                        Guardar
                                                    </button>
                                                    <button onClick={() => setEditandoId(null)} className="btn-cancelar-edicion">
                                                        Cancelar
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => {
                                                            setEditandoId(item.id);
                                                            setEditProducto(item); // Carga todos los datos del producto en edición
                                                        }}
                                                        className="btn-editar"
                                                    >
                                                        📝 Editar
                                                    </button>
                                                    <button
                                                        onClick={() => handleEliminar(item.id, item.nombre)}
                                                        className="btn-eliminar"
                                                    >
                                                        🗑️ Eliminar
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={esAdmin ? "6" : "5"}>No hay productos en el inventario.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Inventario;