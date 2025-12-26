import React, { useState } from 'react';
import { auth } from '../firebaseConfig'; 
import { signInWithEmailAndPassword } from 'firebase/auth';
import '../styles/Login.css';


const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isEmailValid = email.includes('@');
  const isFormValid = email && password && isEmailValid;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ ¡Inicio de sesión exitoso!');
      // Aquí puedes redirigir al usuario:
      // window.location.href = '/dashboard';
    } catch (err) {
      console.error(err.message);
      if (err.code === 'auth/invalid-credential') {
        setError('Email o contraseña incorrectos.');
      } else {
        setError('Error al iniciar sesión: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <img 
        src="/Logo.png" 
        alt="Logo de Jgames" 
        className="login-logo" 
      />

      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="email">Correo electrónico</label>
          <input
            type="email"
            id="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className={!isEmailValid && email ? 'input-error' : ''}
          />
          {!isEmailValid && email && (
            <small className="error-text">Debe contener “@”</small>
          )}
        </div>

        <div className="form-group">
        <label htmlFor="password">Contraseña</label>
        <div className="password-wrapper">
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
          />
          
          {/* --- INICIO DE LA MODIFICACIÓN --- */}
          <button
            type="button"
            className="toggle-password"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              // Si showPassword es TRUE, mostramos el icono de "No ver"
              <img src="/Nover.svg" alt="Ocultar contraseña" />
            ) : (
              // Si showPassword es FALSE, mostramos el icono de "Ver"
              <img src="/ver.svg" alt="Mostrar contraseña" />
            )}
          </button>
          {/* --- FIN DE LA MODIFICACIÓN --- */}

        </div>
      </div>

        {error && <p className="error">{error}</p>}

        <div className="button-group">
          <button
            type="submit"
            disabled={!isFormValid || loading}
           
          >
            {loading ? 'Iniciando...' : 'Iniciar Sesión'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Login;
