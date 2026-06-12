import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Wysyłamy żądanie rejestracji do Twojego backendu Node.js
      await axios.post(`${import.meta.env.VITE_API_URL}/api/register`, {
        username,
        email,
        password,
        phone_number: phoneNumber
      });

      alert('🎉 Konto zostało stworzone pomyślnie! Teraz możesz się zalogować.');
      navigate('/login'); // Po sukcesie automatycznie przenosimy do logowania
    } catch (err) {
      setError(err.response?.data?.error || 'Wystąpił błąd podczas rejestracji.');
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleRegister} style={styles.card}>
        <h2 style={styles.title}>Stwórz konto ChargeShare</h2>
        
        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.inputGroup}>
          <label style={styles.label}>Nazwa użytkownika (Login):</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            required 
            style={styles.input}
          />
        </div>
        
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
            <label style={styles.label}>Numer telefonu:</label>
            <input 
                type="tel" 
                placeholder="np. 123 456 789"
                value={phoneNumber} 
                onChange={(e) => setPhoneNumber(e.target.value)} 
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

        <button type="submit" style={styles.button}>Zarejestruj się</button>
        <button type="button" onClick={() => navigate('/login')} style={styles.linkButton}>
          Masz już konto? Zaloguj się
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f0f2f5' },
  card: { background: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px' },
  title: { margin: '0 0 20px 0', textAlign: 'center', color: '#333', fontFamily: 'sans-serif' },
  error: { color: 'red', backgroundColor: '#ffe6e6', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '14px', textAlign: 'center' },
  inputGroup: { marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '14px', color: '#555', fontWeight: 'bold' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '16px' },
  button: { padding: '12px', backgroundColor: '#24b47e', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginBottom: '10px', transition: 'background 0.2s' },
  linkButton: { padding: '10px', backgroundColor: 'transparent', color: '#1a73e8', border: 'none', fontSize: '14px', cursor: 'pointer', width: '100%', textDecoration: 'underline' }
};

export default Register;