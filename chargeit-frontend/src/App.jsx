import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, ZoomControl, useMap } from 'react-leaflet';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Login from './components/Login';
import Register from './components/Register';
import L from 'leaflet';

import 'leaflet/dist/leaflet.css';
import './chargeshare.css'; // <- nowy plik z fontami i override'ami

/* ──────────────────────────────────────────────────────────────
   PALETA "Neon Mint EV"
   --bg-0   #0a1320  (głębokie navy)
   --bg-1   #0d1b2a  (tło sceny)
   --bg-2   #122436  (panele)
   --line   rgba(255,255,255,0.08)
   --text   #e8f4ef
   --muted  #8aa0ad
   --mint   #2dd4a8  (akcent / dostępna)
   --mint-2 #73ffb8  (glow)
   --amber  #f5c563  (zajęta)
   --red    #ff6b6b  (nieaktywna)
   ────────────────────────────────────────────────────────────── */

function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, zoom); }, [center, zoom, map]);
  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

// Nowoczesna pinezka — pulsujący halo + rdzeń
const createCustomIcon = (status) => {
  let color = '#22c55e'; // Dostępna (zielony środek i puls)
  if (status === 'Zajęta') color = '#eab308'; // (żółty środek i puls)
  if (status === 'Nieaktywna') color = '#ef4444'; // (czerwony środek i puls)

  return L.divIcon({
    className: '', 
    html: `
      <div style="position: relative; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;">
        <!-- Warstwa pulsująca w tle -->
        <div style="
          position: absolute;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background-color: ${color};
          animation: markerPulse 2s infinite ease-out;
          pointer-events: none;
          z-index: 1;
        "></div>
        
        <!-- Główna kropka -->
        <div style="
          position: absolute;
          background-color: ${color}; /* Kolor główny w środku (zielony/żółty/czerwony) */
          width: 16px; 
          height: 16px; 
          border-radius: 50%; 
          border: 2px solid #0a1320; /* Granatowa obramówka z Twojego screena! */
          box-shadow: 0 0 8px rgba(0,0,0,0.8);
          box-sizing: border-box;
          z-index: 2;
        "></div>
      </div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8]
  });
};

function MainMap() {
  // ── stany (bez zmian) ────────────────────────────────────────
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [clickCoords, setClickCoords] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formConnector, setFormConnector] = useState('Type 2');
  const [formPower, setFormPower] = useState(22);
  const [formPrice, setFormPrice] = useState(1.50);
  const [formStatus, setFormStatus] = useState('Dostępna');

  const [searchCity, setSearchCity] = useState('');
  const [filterConnector, setFilterConnector] = useState('Wszystkie');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterStatus, setFilterStatus] = useState('Wszystkie');
  const [mapCenter, setMapCenter] = useState([52.2297, 21.0122]);
  const [mapZoom, setMapZoom] = useState(6);

  const [stations, setStations] = useState([]);
  const navigate = useNavigate();
  const [isFilterBarOpen, setIsFilterBarOpen] = useState(false);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingStationId, setEditingStationId] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '', description: '', connector_type: 'Type 2', power_kw: 22,
    price_per_kwh: '', status: 'Dostępna', owner_phone_number: '',
    owner_email: '', location_lat: null, location_lng: null
  });

  const token = localStorage.getItem('token');
  const username = localStorage.getItem('username');

  // ── handlery (bez zmian logicznych) ──────────────────────────
  const handleCitySearch = async (e) => {
    e.preventDefault();
    if (!searchCity.trim()) return;
    try {
      const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchCity)}&limit=1`);
      if (response.data && response.data.length > 0) {
        const { lat, lon } = response.data[0];
        setMapCenter([parseFloat(lat), parseFloat(lon)]);
        setMapZoom(12);
      } else {
        alert("🔍 Nie znaleziono takiego miasta.");
      }
    } catch (error) {
      console.error("Błąd wyszukiwania miasta:", error);
      alert("Wystąpił błąd podczas lokalizowania miasta.");
    }
  };

  const fetchStations = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/stations`);
      setStations(response.data.stations || []);
    } catch (error) { console.error("❌ Błąd pobierania stacji:", error); }
  };

  useEffect(() => { fetchStations(); }, []);

  const handleMapClick = (latlng) => {
    const currentToken = localStorage.getItem('token');
    if (!currentToken) {
      alert("🔒 Musisz się zalogować, aby dodać punkt ładowania!");
      navigate('/login'); return;
    }
    setClickCoords(latlng);
    setIsSidebarOpen(true);
  };

  const handleSidebarSubmit = async (e) => {
    e.preventDefault();
    if (!clickCoords) return;
    const currentToken = localStorage.getItem('token');
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/api/stations`, {
        title: formTitle, description: formDesc || "Brak opisu",
        location_lat: clickCoords.lat, location_lng: clickCoords.lng,
        connector_type: formConnector, power_kw: parseFloat(formPower),
        price_per_kwh: parseFloat(formPrice), status: formStatus
      }, { headers: { Authorization: `Bearer ${currentToken}` } });
      alert('Stacja dodana!');
      setIsSidebarOpen(false);
      setFormTitle(''); setFormDesc(''); setFormPower(22);
      setFormPrice(1.50); setFormStatus('Dostępna');
      fetchStations();
    } catch (error) {
      alert("Błąd: " + (error.response?.data?.error || "Nie udało się dodać stacji."));
    }
  };

  const startEdit = (station) => {
    setEditingStationId(station.id);
    setEditForm({
      title: station.title, 
      description: station.description,
      connector_type: station.connector_type, 
      power_kw: station.power_kw || 22,
      price_per_kwh: station.price_per_kwh, 
      status: station.status,
      
      // Mapujemy dane na nowe pola kontaktowe stacji. Jeśli stacja nie ma jeszcze swoich, 
      // pobieramy dane właściciela jako domyślny start.
      contact_email: station.contact_email || station.owner_email || '',
      contact_phone: station.contact_phone || station.owner_phone_number || '',
      
      location_lat: station.location_lat, 
      location_lng: station.location_lng
    });
  };

const handleUpdateStation = async (e, id) => {
  e.preventDefault();
  const currentToken = localStorage.getItem('token');
  
  try {
    // Odseparowujemy dane właściciela konta, aby ich NIE wysyłać na serwer
    const { owner_email, owner_phone_number, ...safeStationData } = editForm;

    await axios.put(`${import.meta.env.VITE_API_URL}/api/stations/${id}`, {
      ...safeStationData, // Wysyłamy tylko bezpieczne dane stacji
      power_kw: parseFloat(editForm.power_kw),
      price_per_kwh: parseFloat(editForm.price_per_kwh),
    }, { headers: { Authorization: `Bearer ${currentToken}` } });

    alert('Zaktualizowano!');
    setEditingStationId(null);
    fetchStations();
  } catch (error) {
    alert('Błąd: ' + (error.response?.data?.error || "Nie udało się zapisać"));
  }
};
  const handleDeleteStation = async (id) => {
    if (!window.confirm('Usunąć tę stację z mapy?')) return;
    const currentToken = localStorage.getItem('token');
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/stations/${id}`, {
        headers: { Authorization: `Bearer ${currentToken}` }
      });
      alert('Usunięto.');
      fetchStations();
    } catch (error) {
      alert('Błąd: ' + (error.response?.data?.error || "Nie udało się usunąć."));
    }
  };


  const adminDeleteStation = async (id) => {
  if (!window.confirm('Czy na pewno chcesz usunąć tę stację jako Admin?')) return;
  
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/force-delete/${id}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${token}` 
      }
    });
    
    if (res.ok) {
      alert('Stacja usunięta!');
      window.location.reload(); // Najprostszy sposób na odświeżenie mapy
    } else {
      alert('Błąd: nie masz uprawnień lub stacja nie istnieje.');
    }
  } catch (err) {
    console.error(err);
  }
};

  const handleLogout = () => {
    localStorage.clear();
    window.location.reload();
  };

  const myStations    = stations.filter((s) => s.owner_name === username);
  const filteredStations = stations.filter((s) => {
    const mc = filterConnector === 'Wszystkie' || s.connector_type === filterConnector;
    const ms = filterStatus    === 'Wszystkie' || s.status === filterStatus;
    const mp = !filterMaxPrice || parseFloat(s.price_per_kwh) <= parseFloat(filterMaxPrice);
    return mc && ms && mp;
  });

  const statusDot = (status) =>
    status === 'Zajęta'     ? '#f5c563' :
    status === 'Nieaktywna' ? '#ff6b6b' : '#2dd4a8';

  return (
    <div style={S.scene}>
      {/* ── górny pływający navbar ─────────────────────────── */}
      <header style={S.topbar}>
        <div style={S.brand}>
          <div style={S.brandMark}>
            <span style={S.brandBolt}>⚡</span>
          </div>
          <div>
            <div style={S.brandName}>ChargeShare</div>
            <div style={S.brandTag}>Społeczność prywatnych punktów ładowania</div>
          </div>
        </div>

        <div style={S.topbarRight}>
          {token ? (
            <>
              {/* 1. Profil użytkownika (kaczka) */}
              <div style={S.userChip}>
                <div style={S.avatar}>{(username || '?').slice(0,1).toUpperCase()}</div>
                <span style={S.userName}>{username}</span>
              </div>
              
              {/* 2. Przycisk Filtruj */}
              <button
                onClick={() => setIsFilterBarOpen(!isFilterBarOpen)}
                style={{
                  ...S.ghostBtn,
                  ...(isFilterBarOpen ? S.ghostBtnActive : null),
                }}
              >
                <span style={{opacity:.85}}>⌕</span> {isFilterBarOpen ? 'Ukryj filtry' : 'Filtruj'}
              </button>

              {/* 3. Przycisk Wyloguj */}
              <button onClick={handleLogout} style={S.dangerBtn}>Wyloguj</button>
            </>
          ) : (
            <>
              {/* Układ awaryjny dla niezalogowanego użytkownika: Najpierw opcje konta, potem filtr */}
              <button onClick={() => navigate('/login')} style={S.ghostBtn}>Zaloguj</button>
              <button onClick={() => navigate('/register')} style={S.primaryBtn}>Załóż konto</button>
              
              <button
                onClick={() => setIsFilterBarOpen(!isFilterBarOpen)}
                style={{
                  ...S.ghostBtn,
                  ...(isFilterBarOpen ? S.ghostBtnActive : null),
                }}
              >
                <span style={{opacity:.85}}>⌕</span> {isFilterBarOpen ? 'Ukryj filtry' : 'Filtruj'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── pasek filtrów (rozwijany) ──────────────────────── */}
      <div style={{ ...S.filterDock, ...(isFilterBarOpen ? S.filterDockOpen : S.filterDockClosed) }}>
        <form onSubmit={handleCitySearch} style={S.searchWrap}>
          <span style={S.searchIcon}>⌕</span>
          <input
            value={searchCity}
            onChange={(e) => setSearchCity(e.target.value)}
            placeholder="Szukaj miasta…"
            style={S.searchInput}
          />
          <button type="submit" style={S.searchBtn}>Szukaj</button>
        </form>

        <div style={S.divider} />

        <div style={S.fGroup}>
          <label style={S.fLabel}>Wtyczka</label>
          <select value={filterConnector} onChange={(e) => setFilterConnector(e.target.value)} style={S.select}>
            <option>Wszystkie</option>
            <option value="Type 2">Type 2 (AC)</option>
            <option value="CCS">CCS (DC)</option>
            <option value="CHAdeMO">CHAdeMO</option>
            <option value="Schuko (Gniazdko domowe)">Schuko</option>
          </select>
        </div>

        <div style={S.fGroup}>
          <label style={S.fLabel}>Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={S.select}>
            <option>Wszystkie</option>
            <option value="Dostępna">Wolne</option>
            <option value="Zajęta">Zajęte</option>
            <option value="Nieaktywna">Nieaktywne</option>
          </select>
        </div>

        <div style={S.fGroup}>
          <label style={S.fLabel}>Max cena zł/kWh</label>
          <input
            type="number" step="0.10" placeholder="np. 2.50"
            value={filterMaxPrice}
            onChange={(e) => setFilterMaxPrice(e.target.value)}
            style={{ ...S.select, width: 110 }}
          />
        </div>

        <button
          onClick={() => {
            setFilterConnector('Wszystkie'); setFilterStatus('Wszystkie');
            setFilterMaxPrice(''); setSearchCity('');
            setMapCenter([52.2297, 21.0122]); setMapZoom(6);
          }}
          style={S.resetBtn}
        >Reset</button>
      </div>

      {/* ── statystyki (lewy dolny floating) ───────────────── */}
      <div style={S.statsCard}>
        <div style={S.statRow}>
          <span style={{ ...S.statDot, background: '#2dd4a8' }} />
          <div>
            <div style={S.statNum}>{stations.filter(s => s.status === 'Dostępna').length}</div>
            <div style={S.statLabel}>Dostępne</div>
          </div>
        </div>
        <div style={S.statRow}>
          <span style={{ ...S.statDot, background: '#f5c563' }} />
          <div>
            <div style={S.statNum}>{stations.filter(s => s.status === 'Zajęta').length}</div>
            <div style={S.statLabel}>Zajęte</div>
          </div>
        </div>
        <div style={S.statRow}>
          <span style={{ ...S.statDot, background: '#ff6b6b' }} />
          <div>
            <div style={S.statNum}>{stations.filter(s => s.status === 'Nieaktywna').length}</div>
            <div style={S.statLabel}>Nieaktywne</div>
          </div>
        </div>
      </div>

      {/* ── boczny panel dodawania (glass) ─────────────────── */}
      <aside style={{ ...S.sidebar, right: isSidebarOpen ? 18 : -440 }}>
        <div style={S.sidebarHead}>
          <div>
            <div style={S.sidebarKicker}>Nowy punkt</div>
            <h3 style={S.sidebarTitle}>Dodaj stację ładowania</h3>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} style={S.iconBtn}>✕</button>
        </div>

        {clickCoords && (
          <div style={S.coordsPill}>
            📍 {clickCoords.lat.toFixed(5)}, {clickCoords.lng.toFixed(5)}
          </div>
        )}

        <form onSubmit={handleSidebarSubmit} style={S.form}>
          <Field label="Nazwa stacji">
            <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required style={S.input} />
          </Field>

          <Field label="Opis / wskazówki dojazdu">
            <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} style={S.textarea} />
          </Field>

          <Field label="Typ złącza">
            <select value={formConnector} onChange={(e) => setFormConnector(e.target.value)} style={S.input}>
              <option value="Type 2">Type 2 (AC)</option>
              <option value="CCS">CCS (DC Fast)</option>
              <option value="CHAdeMO">CHAdeMO</option>
              <option value="Schuko (Gniazdko domowe)">Schuko</option>
              <option value="inne">Inne</option>
            </select>
          </Field>

          <Field label={<>Moc ładowania <strong style={{color:'#2dd4a8'}}>{formPower} kW</strong></>}>
            <input type="range" min="3" max="350" value={formPower}
              onChange={(e) => setFormPower(e.target.value)} style={S.range} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Cena zł/kWh">
              <input type="number" step="0.01" min="0" value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)} required style={S.input} />
            </Field>
            <Field label="Status">
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} style={S.input}>
                <option value="Dostępna">🟢 Dostępna</option>
                <option value="Zajęta">🟡 Zajęta</option>
                <option value="Nieaktywna">🔴 Nieaktywna</option>
              </select>
            </Field>
          </div>

          <button type="submit" style={S.submitBtn}>
            <span style={{marginRight:8}}>⚡</span> Opublikuj punkt
          </button>
        </form>
      </aside>

{/* ── MAPA ───────────────────────────────────────────── */}
    <>
      {/* Wstrzyknięcie animacji pulsowania markerów */}
      <style>{`
        @keyframes markerPulse {
          0% {
            transform: scale(1);
            opacity: 0.7;
          }
          100% {
            transform: scale(3);
            opacity: 0;
          }
        }
        .leaflet-container {
          background: #0d1b2a !important;
        }
      `}</style>

      <MapContainer center={mapCenter} zoom={mapZoom} key="clean-map" zoomControl={false} style={{ width: '100%', height: '100%' }}>
        <ChangeView center={mapCenter} zoom={mapZoom} />
        
        {/* Czysta, ciemna mapa bez zbędnych filtrów */}
        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <ZoomControl position="bottomleft" />
        <MapClickHandler onMapClick={handleMapClick} />

        {filteredStations.map((station) => (
          <Marker key={station.id} icon={createCustomIcon(station.status)}
            position={[Number(station.location_lat), Number(station.location_lng)]}>
            <Popup className="cs-popup">
              <div style={S.popup}>
                <div style={S.popupHead}>
                  <h3 style={S.popupTitle}>{station.title}</h3>
                  <span style={{ ...S.statusPill, background: statusDot(station.status) + '22', color: statusDot(station.status) }}>
                    ● {station.status || 'Dostępna'}
                  </span>
                </div>
                <p style={S.popupDesc}>{station.description}</p>

                {/* Tylko jeśli użytkownik jest 'kaczka', pokaż przycisk usuwania dowolnej stacji */}
                {username === 'kaczka' && (
                  <button 
                    onClick={() => adminDeleteStation(station.id)} 
                    style={{ background: 'red', color: 'white', border: 'none', padding: '5px' }}
                  >
                    Usuń (Admin)
                  </button>
                  
                )}
                {username === 'kaczka' && (
                  <div style={{fontSize: '10px', color: '#64748b'}}>
                    Dodane przez: {station.owner_name}
                  </div>
                  
                )}
                

                <div style={S.popupGrid}>
                  <div style={S.popupCell}><div style={S.popupKey}>Złącze</div><div style={S.popupVal}>{station.connector_type}</div></div>
                  <div style={S.popupCell}><div style={S.popupKey}>Moc</div><div style={S.popupVal}>{station.power_kw} kW</div></div>
                  <div style={S.popupCell}><div style={S.popupKey}>Cena</div><div style={S.popupVal}>{station.price_per_kwh} zł/kWh</div></div>
                </div>

                <div style={S.popupOwner}>
                  <div style={S.popupAvatar}>{(station.owner_name || '?').slice(0,1).toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={S.popupOwnerName}>{station.owner_name || 'Anonim'}</div>
                    <div style={S.popupContact}>
                      
                      {/* TELEFON: Najpierw szuka contact_phone, potem owner_phone_number */}
                      {(station.contact_phone || station.owner_phone_number) && (
                        <a href={`tel:${station.contact_phone || station.owner_phone_number}`} style={S.popupLink}>
                          📞 {station.contact_phone || station.owner_phone_number}
                        </a>
                      )}
                      
                      {/* E-MAIL: Najpierw szuka contact_email, potem owner_email */}
                      {(station.contact_email || station.owner_email) && (
                        <a href={`mailto:${station.contact_email || station.owner_email}`} style={S.popupLink}>
                          ✉ {station.contact_email || station.owner_email}
                        </a>
                      )}

                    </div>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </>

      {/* ── FAB: Moje Stacje ───────────────────────────────── */}
      {token && !isSidebarOpen && (
        <button onClick={() => setIsSettingsOpen(true)} style={S.fab}>
          <span style={S.fabIcon}>⚙</span> Moje stacje
          <span style={S.fabBadge}>{myStations.length}</span>
        </button>
      )}

      {/* ── MODAL: Panel zarządzania ───────────────────────── */}
      {token && isSettingsOpen && (
        <div style={S.overlay} onClick={() => { setIsSettingsOpen(false); setEditingStationId(null); }}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <div>
                <div style={S.sidebarKicker}>Panel zarządzania</div>
                <h2 style={S.modalTitle}>Twoje punkty ładowania</h2>
              </div>
              <button onClick={() => { setIsSettingsOpen(false); setEditingStationId(null); }} style={S.iconBtn}>✕</button>
            </div>

            <div style={S.modalBody}>
              {myStations.length === 0 ? (
                <div style={S.emptyState}>
                  <div style={{fontSize:42, marginBottom:8}}>🗺️</div>
                  <div style={{fontWeight:600, marginBottom:4}}>Brak punktów</div>
                  <div style={{color:'#8aa0ad', fontSize:13}}>Kliknij w dowolne miejsce na mapie, aby dodać pierwszy.</div>
                </div>
              ) : (
                <div style={S.list}>
                  {myStations.map((station) => (
                    <div key={station.id} style={S.listItem}>
                      {editingStationId === station.id ? (
                        <form onSubmit={(e) => handleUpdateStation(e, station.id)} style={S.form}>
                          <Field label="Nazwa stacji">
                            <input value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} required style={S.input}/>
                          </Field>
                          <Field label="Opis">
                            <textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} style={S.textarea}/>
                          </Field>
                          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                            <Field label="Typ złącza">
                              <select value={editForm.connector_type} onChange={e => setEditForm({...editForm, connector_type: e.target.value})} style={S.input}>
                                <option value="Type 2">Type 2 (AC)</option>
                                <option value="CCS">CCS (DC)</option>
                                <option value="CHAdeMO">CHAdeMO</option>
                                <option value="Schuko (Gniazdko domowe)">Schuko</option>
                              </select>
                            </Field>
                            <Field label="Status">
                              <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})} style={S.input}>
                                <option value="Dostępna">🟢 Dostępna</option>
                                <option value="Zajęta">🟡 Zajęta</option>
                                <option value="Nieaktywna">🔴 Nieaktywna</option>
                              </select>
                            </Field>
                          </div>
                          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                            <Field label="Moc (kW)">
                              <input type="number" value={editForm.power_kw} onChange={e => setEditForm({...editForm, power_kw: e.target.value})} required style={S.input}/>
                            </Field>
                            <Field label="Cena (zł/kWh)">
                              <input type="number" step="0.01" value={editForm.price_per_kwh} onChange={e => setEditForm({...editForm, price_per_kwh: e.target.value})} required style={S.input}/>
                            </Field>
                          </div>
                          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                            <Field label="Telefon kontaktowy">
                              <input 
                                value={editForm.contact_phone || ''} // Zmiana na contact_phone
                                onChange={e => {
                                  const v = e.target.value.replace(/\D/g, '').slice(0, 9);
                                  setEditForm({ ...editForm, contact_phone: v }); // Zmiana na contact_phone
                                }} 
                                style={S.input}
                              />
                            </Field>
                            <Field label="E-mail">
                              <input 
                                type="email" 
                                value={editForm.contact_email || ''} // Dajemy || '', żeby React nie krzyczał, jeśli na początku będzie to null
                                onChange={e => setEditForm({ ...editForm, contact_email: e.target.value })} 
                                style={S.input}
                              />
                            </Field>
                          </div>
                          <div style={{display:'flex', gap:10, marginTop:6}}>
                            <button type="submit" style={S.submitBtn}>Zapisz zmiany</button>
                            <button type="button" onClick={() => setEditingStationId(null)} style={S.ghostBtn}>Anuluj</button>
                          </div>
                        </form>
                      ) : (
                        <div style={S.listRow}>
                          <div style={{ ...S.listDot, background: statusDot(station.status) }} />
                          <div style={{flex:1, minWidth:0}}>
                            <div style={S.listTitle}>{station.title}</div>
                            <div style={S.listMeta}>
                              {station.connector_type} · {station.power_kw} kW · <strong style={{color:'#e8f4ef'}}>{station.price_per_kwh} zł/kWh</strong>
                            </div>
                          </div>
                          <div style={{display:'flex', gap:8}}>
                            <button onClick={() => startEdit(station)} style={S.miniBtn}>Edytuj</button>
                            <button onClick={() => handleDeleteStation(station.id)} style={S.miniBtnDanger}>Usuń</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* podpowiedź dla niezalogowanych */}
      {!token && (
        <div style={S.hintBubble}>
          💡 Kliknij w dowolne miejsce na mapie, aby dodać stację
        </div>
      )}
    </div>
  );
}

// helper field
function Field({ label, children }) {
  return (
    <div style={S.field}>
      <label style={S.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainMap />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </Router>
  );
}

/* ──────────────────────────────────────────────────────────────
   STYLE
   ────────────────────────────────────────────────────────────── */
const fontStack = `'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
const headFont  = `'Sora', ${fontStack}`;

const glass = {
  background: 'rgba(18, 36, 54, 0.72)',
  backdropFilter: 'blur(18px) saturate(140%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
};

const S = {
  scene: { position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', fontFamily: fontStack, color: '#e8f4ef', background: '#0a1320' },

  // TOPBAR
  topbar: {
    position: 'absolute', top: 16, left: 16, right: 16, zIndex: 1000,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 16px', borderRadius: 16, ...glass,
  },
  brand: { display: 'flex', alignItems: 'center', gap: 12 },
  brandMark: {
    width: 42, height: 42, borderRadius: 12,
    background: 'linear-gradient(135deg, #2dd4a8, #73ffb8)',
    display: 'grid', placeItems: 'center',
    boxShadow: '0 6px 20px rgba(45,212,168,0.45), inset 0 1px 0 rgba(255,255,255,0.4)',
  },
  brandBolt: { fontSize: 20, color: '#0a1320' },
  brandName: { fontFamily: headFont, fontWeight: 700, fontSize: 18, letterSpacing: -0.3 },
  brandTag: { fontSize: 11, color: '#8aa0ad', marginTop: 1 },
  topbarRight: { display: 'flex', alignItems: 'center', gap: 10 },

  userChip: {
    display:'flex', alignItems:'center', gap:8,
    padding: '6px 12px 6px 6px', borderRadius: 999,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 28, height: 28, borderRadius: '50%',
    background: 'linear-gradient(135deg, #2dd4a8, #73ffb8)',
    color:'#0a1320', display:'grid', placeItems:'center',
    fontWeight:700, fontSize:13,
  },
  userName: { fontSize: 13, fontWeight: 600 },

  // BUTTONS
  primaryBtn: {
    padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #2dd4a8, #73ffb8)',
    color: '#0a1320', fontWeight: 700, fontSize: 13,
    boxShadow: '0 6px 18px rgba(45,212,168,0.35)',
  },
  ghostBtn: {
    padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
    background: 'rgba(255,255,255,0.04)', color: '#e8f4ef',
    border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, fontWeight: 600,
  },
  ghostBtnActive: {
    background: 'rgba(45,212,168,0.15)', borderColor: '#2dd4a8', color: '#2dd4a8',
  },
  dangerBtn: {
    padding: '9px 14px', borderRadius: 10, cursor: 'pointer',
    background: 'rgba(255,107,107,0.12)', color: '#ff6b6b',
    border: '1px solid rgba(255,107,107,0.3)', fontSize: 13, fontWeight: 600,
  },
  iconBtn: {
    width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
    background: 'rgba(255,255,255,0.06)', color: '#e8f4ef',
    border: '1px solid rgba(255,255,255,0.1)', fontSize: 14,
  },

  // FILTER DOCK
  filterDock: {
    position: 'absolute', top: 90, left: 16, right: 16, zIndex: 999,
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12,
    padding: '12px 16px', borderRadius: 14, ...glass,
    transition: 'all 0.3s ease',
  },
  filterDockOpen:  { opacity: 1, transform: 'translateY(0)', visibility: 'visible' },
  filterDockClosed:{ opacity: 0, transform: 'translateY(-8px)', visibility: 'hidden', pointerEvents: 'none' },

  searchWrap: {
    position: 'relative', display: 'flex', alignItems: 'center',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10, padding: '4px 4px 4px 36px', minWidth: 260,
  },
  searchIcon: { position: 'absolute', left: 12, color: '#8aa0ad', fontSize: 16 },
  searchInput: {
    flex: 1, background: 'transparent', border: 'none', outline: 'none',
    color: '#e8f4ef', fontSize: 13, padding: '6px 0', fontFamily: fontStack,
  },
  searchBtn: {
    padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #2dd4a8, #73ffb8)', color: '#0a1320',
    fontWeight: 700, fontSize: 12,
  },
  divider: { width: 1, height: 24, background: 'rgba(255,255,255,0.1)' },

  fGroup: { display: 'flex', flexDirection: 'column', gap: 4 },
  fLabel: { fontSize: 10, fontWeight: 700, color: '#8aa0ad', textTransform: 'uppercase', letterSpacing: 0.8 },
  select: {
    padding: '7px 10px', borderRadius: 8,
    background: 'rgba(255,255,255,0.04)', color: '#e8f4ef',
    border: '1px solid rgba(255,255,255,0.1)', fontSize: 13, outline: 'none',
    fontFamily: fontStack,
  },
  resetBtn: {
    marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
    background: 'transparent', color: '#8aa0ad',
    border: '1px solid rgba(255,255,255,0.1)', fontSize: 12, fontWeight: 600,
  },

  // STATS
  statsCard: {
    position: 'absolute', left: 16, bottom: 24, zIndex: 998,
    display: 'flex', gap: 18, padding: '14px 18px', borderRadius: 14, ...glass,
  },
  statRow: { display: 'flex', alignItems: 'center', gap: 10 },
  statDot: { width: 10, height: 10, borderRadius: '50%', boxShadow: '0 0 12px currentColor' },
  statNum: { fontFamily: headFont, fontWeight: 700, fontSize: 18, lineHeight: 1 },
  statLabel: { fontSize: 11, color: '#8aa0ad', marginTop: 2 },

  // SIDEBAR (add)
  sidebar: {
    position: 'absolute', top: 96, bottom: 24, width: 420, zIndex: 1100,
    display: 'flex', flexDirection: 'column', padding: 22, borderRadius: 18,
    transition: 'right 0.35s cubic-bezier(.2,.8,.2,1)',
    ...glass, overflow: 'hidden',
  },
  sidebarHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  sidebarKicker: { fontSize: 10, fontWeight: 700, color: '#2dd4a8', textTransform: 'uppercase', letterSpacing: 1.2 },
  sidebarTitle: { fontFamily: headFont, margin: '4px 0 0', fontWeight: 700, fontSize: 20, letterSpacing: -0.3 },
  coordsPill: {
    display: 'inline-block', padding: '6px 12px', borderRadius: 999,
    background: 'rgba(45,212,168,0.1)', color: '#2dd4a8',
    border: '1px solid rgba(45,212,168,0.3)', fontSize: 12, fontWeight: 600,
    marginBottom: 14, alignSelf: 'flex-start',
  },

  form: { display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1, paddingRight: 4 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontSize: 11, fontWeight: 700, color: '#8aa0ad', textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    padding: '10px 12px', borderRadius: 10,
    background: 'rgba(255,255,255,0.04)', color: '#e8f4ef',
    border: '1px solid rgba(255,255,255,0.1)', fontSize: 14, outline: 'none',
    fontFamily: fontStack,
  },
  textarea: {
    padding: '10px 12px', borderRadius: 10,
    background: 'rgba(255,255,255,0.04)', color: '#e8f4ef',
    border: '1px solid rgba(255,255,255,0.1)', fontSize: 14, outline: 'none',
    minHeight: 70, resize: 'vertical', fontFamily: fontStack,
  },
  range: { width: '100%', accentColor: '#2dd4a8' },

  submitBtn: {
    padding: '13px 18px', borderRadius: 12, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #2dd4a8, #73ffb8)',
    color: '#0a1320', fontWeight: 700, fontSize: 14,
    boxShadow: '0 8px 24px rgba(45,212,168,0.4)', marginTop: 4,
    fontFamily: headFont, letterSpacing: 0.2,
  },

  // POPUP
  popup: { minWidth: 240, fontFamily: fontStack, color: '#e8f4ef' },
  popupHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  popupTitle: { fontFamily: headFont, margin: 0, fontSize: 16, fontWeight: 700, color: '#e8f4ef' },
  statusPill: { padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' },
  popupDesc: { margin: '0 0 12px', fontSize: 12, color: '#8aa0ad', lineHeight: 1.5 },
  popupGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  popupCell: {},
  popupKey: { fontSize: 9, color: '#8aa0ad', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 3 },
  popupVal: { fontSize: 12, fontWeight: 700, color: '#e8f4ef' },
  popupOwner: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 },
  popupAvatar: { width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#2dd4a8,#73ffb8)', color: '#0a1320', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 13 },
  popupOwnerName: { fontSize: 12, fontWeight: 700 },
  popupContact: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 },
  popupLink: { fontSize: 11, color: '#2dd4a8', textDecoration: 'none' },

  // FAB
  fab: {
    position: 'absolute', right: 40, bottom: 24, zIndex: 1100,
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 18px 12px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg, #2dd4a8, #73ffb8)', color: '#0a1320',
    fontWeight: 700, fontSize: 14, fontFamily: headFont,
    boxShadow: '0 10px 30px rgba(45,212,168,0.45)',
  },
  fabIcon: { fontSize: 16 },
  fabBadge: { background: '#0a1320', color: '#73ffb8', borderRadius: 999, padding: '2px 9px', fontSize: 12, fontWeight: 700 },

  // MODAL
  overlay: {
    position: 'absolute', inset: 0, background: 'rgba(8,16,28,0.7)',
    backdropFilter: 'blur(8px)', zIndex: 2000,
    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modal: {
    width: '100%', maxWidth: 620, maxHeight: '86vh', borderRadius: 18,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    ...glass, background: 'rgba(13,27,42,0.95)',
  },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  modalTitle: { fontFamily: headFont, margin: '4px 0 0', fontSize: 22, fontWeight: 700, letterSpacing: -0.3 },
  modalBody: { padding: 22, overflowY: 'auto', flex: 1 },
  emptyState: { textAlign: 'center', padding: '40px 20px', color: '#e8f4ef' },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  listItem: { borderRadius: 12, padding: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' },
  listRow: { display: 'flex', alignItems: 'center', gap: 12 },
  listDot: { width: 10, height: 10, borderRadius: '50%', boxShadow: '0 0 10px currentColor', flexShrink: 0 },
  listTitle: { fontFamily: headFont, fontWeight: 700, fontSize: 15, marginBottom: 3 },
  listMeta: { fontSize: 12, color: '#8aa0ad' },
  miniBtn: {
    padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
    background: 'rgba(45,212,168,0.12)', color: '#2dd4a8',
    border: '1px solid rgba(45,212,168,0.3)', fontSize: 12, fontWeight: 600,
  },
  miniBtnDanger: {
    padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
    background: 'rgba(255,107,107,0.12)', color: '#ff6b6b',
    border: '1px solid rgba(255,107,107,0.3)', fontSize: 12, fontWeight: 600,
  },

  // hint
  hintBubble: {
    position: 'absolute', right: 24, bottom: 24, zIndex: 1100,
    padding: '12px 18px', borderRadius: 12, ...glass,
    fontSize: 13, color: '#8aa0ad', maxWidth: 280,
  },
};

export default App;
