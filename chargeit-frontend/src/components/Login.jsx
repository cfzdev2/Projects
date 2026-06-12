import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/login`, {
        email,
        password
      });

      // Zapisujemy token i nazwę usera w pamięci przeglądarki
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('username', response.data.user.username);

      alert(`Cześć ${response.data.user.username}! Zalogowano pomyślnie.`);
      navigate('/'); // Przekierowanie na mapę główną
    } catch (err) {
      setError(err.response?.data?.error || 'Wystąpił błąd podczas logowania.');
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleLogin} style={styles.card}>
        <h2 style={styles.title}>Zaloguj się do ChargeShare</h2>
        
        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.inputGroup}>
          <label style={styles.label}>Adres E-mail:</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            style={styles.input}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>Hasło:</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            style={styles.input}
          />
        </div>

        <button type="submit" style={styles.button}>Zaloguj się</button>
        
        {/* Przycisk pod spodem, o który prosiłeś */}
        <button type="button" onClick={() => navigate('/register')} style={styles.registerLink}>
          Nie masz konta? Zarejestruj się
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f2f5' },
  card: { background: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' },
  title: { margin: '0 0 20px 0', textAlign: 'center', color: '#333' },
  error: { color: 'red', backgroundColor: '#ffe6e6', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '14px', textAlign: 'center' },
  inputGroup: { marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '14px', color: '#555', fontWeight: 'bold' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '16px' },
  button: { padding: '12px', backgroundColor: '#1a73e8', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '15px' },
  registerLink: { padding: '10px', backgroundColor: 'transparent', color: '#1a73e8', border: 'none', fontSize: '14px', cursor: 'pointer', width: '100%', textDecoration: 'underline' }
};

export default Login;