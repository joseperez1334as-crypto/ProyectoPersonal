import React from 'react';
import { auth } from '../firebaseConfig';
import { signOut } from 'firebase/auth';

const VendedorDashboard = () => {
  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div>
      <h1>Panel de Vendedor</h1>
      <p>Aquí irá el formulario para registrar Ventas y Compras.</p>
      <button onClick={handleLogout}>Cerrar Sesión</button>
    </div>
  );
};

export default VendedorDashboard;