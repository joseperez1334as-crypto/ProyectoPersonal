import React, { useState, useEffect } from 'react';

// 1. Importaciones Consolidadas y Corregidas
import { db, auth } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';

const GestionUsuarios = () => {
    // Estados (sin cambios)
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [nombre, setNombre] = useState('');
    const [apellido, setApellido] = useState('');
    const [documento, setDocumento] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rol, setRol] = useState('vendedor');
    const [editandoUsuarioId, setEditandoUsuarioId] = useState(null);
    const [editNombre, setEditNombre] = useState('');
    const [editApellido, setEditApellido] = useState('');
    const [editDocumento, setEditDocumento] = useState('');
    const [editRol, setEditRol] = useState('');
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(null);

    // useEffect para cargar usuarios (sin cambios)
    useEffect(() => {
        const fetchUsuarios = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, "usuarios"));
                const usuariosData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setUsuarios(usuariosData);
            } catch (error) {
                console.error("Error al obtener usuarios: ", error);
                setError("No se pudieron cargar los usuarios.");
            } finally {
                setLoading(false);
            }
        };
        fetchUsuarios();
    }, []);

    // handleCreateUser (Validación de Documento Único sin cambios)
    const handleCreateUser = async (e) => {
        e.preventDefault();
        // Validación de campos vacíos (ahora incluye trim)
        if (!nombre.trim() || !apellido.trim() || !documento.trim() || !email.trim() || !password || !rol) {
            setError("Por favor, complete todos los campos."); return;
        }
        if (password.length < 6) {
            setError("La contraseña debe tener al menos 6 caracteres."); return;
        }
        setError(null); setSuccess(false); setIsCreating(true);
        try {
            // Validación Cédula Única
            const usuariosRef = collection(db, "usuarios");
            const q = query(usuariosRef, where("documento", "==", documento.trim()));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                setError("El número de documento ya está registrado."); setIsCreating(false); return;
            }

            // Crear en Auth y Firestore
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCredential.user.uid;
            await setDoc(doc(db, "usuarios", uid), {
                email: email, rol: rol, nombre: nombre.trim(),
                apellido: apellido.trim(), documento: documento.trim()
            });

            // ELIMINAMOS el signOut para que el admin NO se desloguee
            // await signOut(auth);

            // Limpiar formulario y Recargar lista
            setNombre(''); setApellido(''); setDocumento(''); setEmail(''); setPassword(''); setRol('vendedor');
            setSuccess("Usuario creado con éxito!");
            setTimeout(() => setSuccess(false), 3000);
            const updatedSnapshot = await getDocs(collection(db, "usuarios"));
            setUsuarios(updatedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        } catch (firebaseError) {
            console.error("Error al crear usuario:", firebaseError);
            let mensajeError = "Ocurrió un error al crear el usuario.";
            if (firebaseError.code === 'auth/email-already-in-use') mensajeError = 'El email ya está registrado.';
            else if (firebaseError.code === 'auth/weak-password') mensajeError = 'La contraseña debe tener al menos 6 caracteres.';
            else if (firebaseError.code) mensajeError = firebaseError.message;
            setError(mensajeError);
        } finally {
            setIsCreating(false);
        }
    };

    // handleGuardarCambios (Validación de Documento Único sin cambios)
    const handleGuardarCambios = async (userId) => {
        // Validación básica (ahora incluye trim)
        if (!editNombre.trim() || !editApellido.trim() || !editDocumento.trim() || !editRol) {
            setError("Por favor, complete todos los campos editables."); return;
        }
        setError(null); setIsSaving(true);
        try {
            // Validación Cédula Única (al editar)
            const usuarioOriginal = usuarios.find(u => u.id === userId);
            const documentoEditado = editDocumento.trim(); // Usar versión trim
            if (usuarioOriginal && usuarioOriginal.documento !== documentoEditado) {
                const usuariosRef = collection(db, "usuarios");
                const q = query(usuariosRef, where("documento", "==", documentoEditado));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    setError("El nuevo número de documento ya está registrado."); setIsSaving(false); return;
                }
            }

            // Guardar en Firestore
            const userDocRef = doc(db, "usuarios", userId);
            await setDoc(userDocRef, {
                nombre: editNombre.trim(), apellido: editApellido.trim(),
                documento: documentoEditado, rol: editRol
            }, { merge: true });

            // Actualizar estado local
            setUsuarios(usuarios.map(user =>
                user.id === userId ? {
                    ...user, nombre: editNombre.trim(), apellido: editApellido.trim(),
                    documento: documentoEditado, rol: editRol
                } : user
            ));

            // Salir de modo edición y limpiar
            setEditandoUsuarioId(null);
            setEditNombre(''); setEditApellido(''); setEditDocumento(''); setEditRol('');
            setSuccess("Usuario actualizado con éxito!");
            setTimeout(() => setSuccess(false), 3000);

        } catch (error) {
            console.error("Error al actualizar el usuario:", error);
            setError("Error al guardar los cambios. Verifica tus permisos.");
        } finally {
            setIsSaving(false);
        }
    };

    // handleEliminarUsuario (Sin cambios)
    const handleEliminarUsuario = async (userId, userEmail) => {
        if (!window.confirm(`¿Estás seguro de que quieres eliminar al usuario ${userEmail}? Esta acción borrará su perfil de la base de datos.`)) {
            return;
        }
        setError(null); setSuccess(false); setIsDeleting(userId);
        try {
            await deleteDoc(doc(db, "usuarios", userId));
            setUsuarios(usuarios.filter(user => user.id !== userId));
            setSuccess("Perfil de usuario eliminado de Firestore con éxito.");
            setTimeout(() => setSuccess(false), 3000);
            console.warn(`Usuario con ID ${userId} eliminado de Firestore, pero AÚN EXISTE en Firebase Authentication.`);
        } catch (error) {
            console.error("Error al eliminar el perfil del usuario:", error);
            setError("Error al eliminar el perfil. Verifica tus permisos.");
        } finally {
            setIsDeleting(null);
        }
    };

    // --- NUEVAS FUNCIONES DE VALIDACIÓN ---
    const handleNombreChange = (e) => {
        const value = e.target.value;
        // Permite solo letras y espacios
        if (/^[a-zA-Z\s]*$/.test(value)) {
            setNombre(value);
        }
    };

    const handleApellidoChange = (e) => {
        const value = e.target.value;
        // Permite solo letras y espacios
        if (/^[a-zA-Z\s]*$/.test(value)) {
            setApellido(value);
        }
    };

    const handleDocumentoChange = (e) => {
        const value = e.target.value;
        // Permite solo números
        if (/^[0-9]*$/.test(value)) {
            setDocumento(value);
        }
    };
     // --- FIN NUEVAS FUNCIONES ---

    // Renderizado
    if (loading) {
        return <p>Cargando usuarios...</p>;
    }

    return (
        <div className="gestion-usuarios">

            {/* SECCIÓN CREAR USUARIO (Inputs con nuevos onChange) */}
           {/* SECCIÓN CREAR USUARIO (CON LABELS AÑADIDOS) */}
      <h2>Crear Nuevo Usuario</h2>
      // En GestionUsuarios.jsx (Dentro del return, en el formulario)
<form onSubmit={handleCreateUser} className="crear-usuario-form">
  
  {/* Campo Nombre */}
  <div className="form-input-wrapper">
    <label htmlFor="nombre">Nombre</label> 
    <input type="text" id="nombre" placeholder="Nombre del usuario" value={nombre} onChange={handleNombreChange} required />
  </div>

  {/* Campo Apellido */}
  <div className="form-input-wrapper">
    <label htmlFor="apellido">Apellido</label>
    <input type="text" id="apellido" placeholder="Apellido del usuario" value={apellido} onChange={handleApellidoChange} required />
  </div>

  {/* Campo Documento */}
  <div className="form-input-wrapper">
    <label htmlFor="documento">Documento</label>
    <input type="text" id="documento" placeholder="Número de documento" value={documento} onChange={handleDocumentoChange} required />
  </div>
  
  {/* Campo Email */}
  <div className="form-input-wrapper">
    <label htmlFor="email">Email</label>
    <input type="email" id="email" placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
  </div>
  
  {/* Campo Contraseña */}
  <div className="form-input-wrapper">
    <label htmlFor="password">Contraseña</label>
    <input type="password" id="password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required />
  </div>
  
  {/* Campo Rol */}
  <div className="form-input-wrapper">
    <label htmlFor="rol">Rol</label>
    <select id="rol" value={rol} onChange={(e) => setRol(e.target.value)}>
      <option value="vendedor">Vendedor</option>
      <option value="administrador">Administrador</option>
    </select>
  </div>
  
  {/* Botón */}
  <button type="submit" disabled={isCreating}>
    {isCreating ? 'Creando...' : 'Crear Usuario'}
  </button>
</form>

            {/* Mensajes */}
            {error && <p className="error-message" style={{ color: 'red' }}>Error: {error}</p>}
            {success && <p className="success-message" style={{ color: 'green' }}>{success === true ? 'Usuario creado con éxito!' : success}</p>}

            <hr />

            {/* LISTA DE USUARIOS (Tabla sin UID) */}
            <h2>Lista de Usuarios Registrados</h2>
            <div className="table-container">
                <table className="usuarios-table">
                    <thead>
                        <tr>
                            <th>Documento</th><th>Nombre</th><th>Apellido</th><th>Email</th>
                            <th>Rol</th>{/*<th>ID (UID)</th> <-- Eliminada */}<th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usuarios.map(user => (
                            <tr key={user.id}>
                                {/* Celdas Editables (Sin cambios aquí, la validación es al crear) */}
                                <td>{editandoUsuarioId === user.id ? <input type="text" value={editDocumento} onChange={(e) => setEditDocumento(e.target.value)} /> : user.documento}</td>
                                <td>{editandoUsuarioId === user.id ? <input type="text" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} /> : user.nombre}</td>
                                <td>{editandoUsuarioId === user.id ? <input type="text" value={editApellido} onChange={(e) => setEditApellido(e.target.value)} /> : user.apellido}</td>
                                <td title={user.email}>{user.email}</td>
                                <td>
                                    {editandoUsuarioId === user.id ? (
                                        <select value={editRol} onChange={(e) => setEditRol(e.target.value)}>
                                            <option value="vendedor">Vendedor</option>
                                            <option value="administrador">Administrador</option>
                                        </select>
                                    ) : (user.rol)}
                                </td>
                                {/* <td title={user.id}>{user.id}</td> <-- Eliminada */}

                                {/* Acciones */}
                                <td>
                                    {editandoUsuarioId === user.id ? (
                                        <>
                                            <button className="guardar" onClick={() => handleGuardarCambios(user.id)} disabled={isSaving}> {isSaving ? 'Guardando...' : 'Guardar'} </button>
                                            <button className="cancelar" onClick={() => setEditandoUsuarioId(null)} disabled={isSaving}> Cancelar </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                className="editar"
                                                onClick={() => {
                                                    const u = usuarios.find(usr => usr.id === user.id);
                                                    if(u) {
                                                        setEditandoUsuarioId(user.id);
                                                        setEditNombre(u.nombre); setEditApellido(u.apellido);
                                                        setEditDocumento(u.documento); setEditRol(u.rol);
                                                        setError(null); setSuccess(false);
                                                    }
                                                }}
                                                disabled={isDeleting === user.id}
                                            > Editar </button>
                                            <button
                                                className="eliminar"
                                                onClick={() => handleEliminarUsuario(user.id, user.email)}
                                                disabled={isDeleting === user.id}
                                            >
                                                {isDeleting === user.id ? 'Eliminando...' : 'Eliminar'}
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default GestionUsuarios;