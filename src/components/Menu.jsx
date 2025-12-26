import React from 'react';
import '../styles/Menu.css'; 

const Menu = ({ activeView, setActiveView }) => {
  const handleNavClick = (e, view) => {
    e.preventDefault(); 
    setActiveView(view);
  };

  return (
    <nav className="main-nav">
      {/* Usamos el contenedor 'ul' de la plantilla original */}
      <ul className="mcd-menu">
        
        {/* --- 1. Usuarios --- */}
        <li>
          <a 
            href=""
            className={activeView === 'usuarios' ? 'active' : ''}
            onClick={(e) => handleNavClick(e, 'usuarios')}
          >
            <i className="fa fa-users"></i> 
            <strong>Usuarios</strong>
            <small>Gestionar usuarios</small>
          </a>
        </li>

        {/* --- 2. Inventario --- */}
        <li>
          <a 
            href=""
            className={activeView === 'productos' ? 'active' : ''}
            onClick={(e) => handleNavClick(e, 'productos')}
          >
            <i className="fa fa-archive"></i> 
            <strong>Inventario</strong>
            <small>Ver productos</small>
          </a>
        </li>

        {/* --- 3. Ventas --- */}
        <li>
          <a 
            href=""
            className={activeView === 'ventas' ? 'active' : ''}
            onClick={(e) => handleNavClick(e, 'ventas')}
          >
            <i className="fa fa-shopping-cart"></i> 
            <strong>Ventas</strong>
            <small>Registrar ventas</small>
          </a>
        </li>
        
        {/* --- 4. Reportes --- */}
        <li>
          <a 
            href=""
            className={activeView === 'reportes' ? 'active' : ''}
            onClick={(e) => handleNavClick(e, 'reportes')}
          >
            <i className="fa fa-bar-chart"></i> 
            <strong>Reportes</strong>
            <small>Análisis y gráficos</small>
          </a>
        </li>
        
        {/* Asegúrate de que no haya otros <li> anidados o flotantes aquí */}

      </ul>
    </nav>
  );
};

export default Menu;