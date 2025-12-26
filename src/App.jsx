import React, { useState, useEffect, useRef } from 'react'; // Importa useRef
import { auth, db } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth'; // Importa signOut
import { doc, onSnapshot } from 'firebase/firestore'; // Importa onSnapshot

import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import VendedorDashboard from './components/VendedorDashboard';

function App() {
  const [userProfile, setUserProfile] = useState(null); // Perfil del usuario ACTUALMENTE logueado
  const [loading, setLoading] = useState(true);
  
  // 👇 --- NUEVO: Guardamos el rol del PRIMER usuario que inició sesión --- 👇
  const initialUserRole = useRef(null); 
  // Usamos useRef para que no cambie en re-renderizados, 
  // a menos que explícitamente lo resetee al cerrar sesión.

  useEffect(() => {
    let unsubscribeProfile = null; // Listener para el perfil

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Usuario logueado: Escuchamos su perfil
        const docRef = doc(db, "usuarios", user.uid);
        unsubscribeProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data();
            const currentProfile = { uid: user.uid, email: user.email, rol: userData.rol };
            setUserProfile(currentProfile); // Actualiza siempre el perfil actual

            // --- LÓGICA CLAVE ---
            // Si es la PRIMERA vez que detectamos un usuario en esta sesión...
            if (initialUserRole.current === null) {
              initialUserRole.current = userData.rol; // ...guardamos su rol inicial.
              console.log("Rol inicial establecido:", initialUserRole.current); // Para depuración
            }
            // --- FIN LÓGICA CLAVE ---

            setLoading(false);
          } else {
            console.error("Perfil no encontrado en Firestore. Deslogueando...");
            if (unsubscribeProfile) unsubscribeProfile(); // Detiene listener de perfil
            signOut(auth); // Cierra sesión de Auth
            setUserProfile(null);
            initialUserRole.current = null; // Resetea rol inicial
            setLoading(false);
          }
        }, (error) => {
           console.error("Error al escuchar perfil:", error);
           if (unsubscribeProfile) unsubscribeProfile();
           signOut(auth);
           setUserProfile(null);
           initialUserRole.current = null;
           setLoading(false);
        });
      } else {
        // Usuario deslogueado
        setUserProfile(null);
        initialUserRole.current = null; // Resetea el rol inicial al cerrar sesión
        setLoading(false);
        if (unsubscribeProfile) {
            unsubscribeProfile(); // Asegúrate de detener el listener si existía
            unsubscribeProfile = null;
        }
      }
    });

    // Limpieza al desmontar App
    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []); // Se ejecuta solo al montar

  // Pantalla de carga
  if (loading) {
    return <div>Cargando...</div>;
  }

  // --- RENDERIZADO BASADO EN EL ROL INICIAL ---
  const renderDashboard = () => {
    if (!userProfile) {
      return <Login />;
    }

    // Usamos el rol guardado en initialUserRole.current
    // para decidir qué panel mostrar, ignorando cambios temporales.
    switch (initialUserRole.current) {
      case 'administrador':
        return <AdminDashboard />;
      case 'vendedor':
        return <VendedorDashboard />;
      default:
        // Si el rol inicial es desconocido (o null después de un error/logout)
        console.error("Rol inicial desconocido o no establecido:", initialUserRole.current);
        // Podrías intentar desloguear aquí de nuevo por seguridad, aunque ya debería estarlo
        // signOut(auth); 
        return <Login />;
    }
  };

  return (
    <div className="App">
      {renderDashboard()}
    </div>
  );
}

export default App;