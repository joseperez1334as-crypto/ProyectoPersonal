import React, { useState } from 'react';
import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

// 1. IMPORTAR MÓDULOS (TODOS)
import GestionUsuarios from './GestionUsuarios';
import Inventario from './Inventario';
import Ventas from './Ventas';
import Reportes from './Reportes'; // <-- AÑADIDO

// 2. IMPORTAR MENÚ Y ESTILOS
import Menu from './Menu'; 
import '../styles/Menu.css'; 
import '../styles/AdminDashboard.css'; 

const AdminDashboard = () => {
  const [activeView, setActiveView] = useState('usuarios');

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.reload(); 
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // 3. ACTUALIZAR RENDER FUNCTION
  const renderActiveView = () => {
    switch (activeView) {
      case 'usuarios':
        return <GestionUsuarios />;
      case 'productos':
        return <Inventario />;
      case 'ventas':
        return <Ventas />;
      case 'reportes': 
        return <Reportes />;
      default:
        return <GestionUsuarios />;
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>Panel de Administración</h1>
        <button onClick={handleLogout} className="logout-button">Cerrar Sesión</button>
      </header>

      <div className="admin-body-wrapper">

        <div className="menu-container">
          <Menu 
            activeView={activeView} 
            setActiveView={setActiveView} 
          />
        </div>

        <main className="admin-content">
          {renderActiveView()}
        </main>

      </div>
    </div>
  );
};

export default AdminDashboard;