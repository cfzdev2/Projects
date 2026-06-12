// Import zainstalowanych bibliotek
const cors = require('cors');
const express = require('express');

const { Pool } = require('pg');
require('dotenv').config();
const jwt = require('jsonwebtoken');

//Inicjalizacja aplikacji express - nasz serwer
const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

//Pozwolenie serwerowi czytac dane w formacjie JSON
app.use(express.json());

//Konfiguracja polaczenia z baza danych PostgreSQL na podstawie pliku .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // TO JEST NAJWAŻNIEJSZE
  ssl: {
    rejectUnauthorized: false // Wymagane dla Neon.tech
  }
});

//Tesotwanie polaczenia z baza danych od razu przy starcie serwera
pool.query('SELECT NOW()', (err, res) => {
    if(err) {
        console.error('Blad polaczenia z baza danych PostgreSQL:', err.stack);
    } else {
        console.log('Pomyslnie polaczono z baza danych PostgreSQL');
    }
});

//Funkcja tworzaca tabele uzytkownikow w bazie danych
const createTables = async () => {
    const createUsersTableQuery = `
        CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE, 
        password_hash VARCHAR(255) NOT NULL,
        phone_number VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
        `;

        //Tabela punktow ladowania (zaktualizowana o kolumnę status)
        const createStationsTableQuery = `
            CREATE TABLE IF NOT EXISTS stations (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(100) NOT NULL,
            description TEXT,
            location_lat NUMERIC(9, 6) NOT NULL,
            location_lng NUMERIC(9, 6) NOT NULL,
            connector_type VARCHAR(50) NOT NULL,
            power_kw NUMERIC(5, 2) NOT NULL,
            price_per_kwh NUMERIC(5, 2) DEFAULT 0.00,
            status VARCHAR(50) DEFAULT 'Dostępna',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            `;
        try {
            await pool.query(createUsersTableQuery);
            await pool.query(createStationsTableQuery);

            // 🔥 AUTOMATYCZNA AKTUALIZACJA BAZY DANYCH:
            // Jeśli kolumny contact_email i contact_phone nie istnieją w starej bazie, to je teraz dodajemy:
            await pool.query(`ALTER TABLE stations ADD COLUMN IF NOT EXISTS contact_email VARCHAR(100);`);
            await pool.query(`ALTER TABLE stations ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(20);`);

            console.log('Wszystkie tabele sa gotowe w bazie danych (i zaktualizowane).');
        } catch(err) {
            console.error('Błąd podczas ładowania tabel w bazie: ', err);
        }
            
};
createTables();

const start = async () => {
  try {
    await createTables(); // Tutaj kod tworzy tabele w nowym Neonie
    app.listen(process.env.PORT || 5000, () => console.log("Serwer działa!"));
  } catch (err) {
    console.error("Błąd startu:", err);
  }
};

start();

//Tworzenie pierwszej testowej sciezki (endpoint) w przegladarce
app.get('/', (req, res) => {
    res.send('Serwer ChargeShare dziala bez zarzutu');
});

//Importowanie bcrypt na samej gorze lub bez posrednio przed uzyciem
const bcrypt = require('bcrypt');


//Sciezka (endpoint) do rejestracji nowego uzytkownika
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, phone_number} = req.body;

        if(!username || !email || !password) {
            return res.status(400).json({ error: 'Wszystkie wymagane pola muszą być wypełnione.'});
        }

        if (phone_number && phone_number.trim() !== "") {
            const phoneRegex = /^\d{9}$/;
            if (!phoneRegex.test(phone_number)) {
                return res.status(400).json({ error: 'Numer telefonu musi składać się z dokładnie 9 cyfr (np. 123456789).' });
            }
        }

        const saltRounds = 10; 
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const insertUserQuery = `
            INSERT INTO users (username, email, password_hash, phone_number)
            VALUES ($1, $2, $3, $4)
            RETURNING id, username, email;
        `;
        
        const values = [username, email, hashedPassword, phone_number || null];
        const result = await pool.query(insertUserQuery, values);

        res.status(201).json({
            message: 'Uzytkownik zarejestrowany pomyslnie',
            user: result.rows[0]
        });
    } catch (err) {
        if (err.code === '23505') { 
            return res.status(400).json({ error: 'Użytkownik o takim loginie lub adresie e-mail już istnieje'});
        }
        console.error(err);
        res.status(500).json({ error: 'Wystąpił błąd serwera podczas rejestracji.' });
    }
});

//Sciezka (endpoint) do logowania uzyttkownika
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if(!email || !password) {
            return res.status(400).json({ error: 'Podaj adres e-mail oraz hasło.' });
        } 

        const userQuery = 'SELECT * FROM users WHERE email = $1;';
        const result = await pool.query(userQuery, [email]);

        if(result.rows.length === 0) {
            return res.status(401).json({ error: 'Nieprawidłowy e-mail lub hasło.'});
        }

        const user = result.rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Nieprawidłowy e-mail lub hasło.'});
        }

        const token = jwt.sign(
            { userId: user.id, username: user.username},
            process.env.JWT_SECRET,
            { expiresIn: '24h'}
        );

        res.status(200).json({
            message: 'Zalogowano pomyślnie!',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        });
    
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Wystąpił błąd serwera podczas logowania.'});
    }
});

//Ochroniarz sprawdza czy uzytkownik przesylal wazny token JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Brak dostępu. Zaloguj się aby uzyskać autoryzację.'});
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decodedUser) => {
        if (err) {
            return res.status(403).json({ error: 'Twój bilet jest nieważny lub wygasł' });
        }
        req.user = decodedUser;
        next();
    });
};

//Sciezka do dodawania nowego punktu ladowania (Zaktualizowana o dane kontaktowe)
app.post('/api/stations', authenticateToken, async (req, res) => {
    try {
        const { title, description, location_lat, location_lng, connector_type, power_kw, price_per_kwh, status, contact_email, contact_phone } = req.body; 
        
        if(!title || !location_lat || !location_lng || !connector_type || !power_kw) {
            return res.status(400).json({ error: 'Wypełnij wszystkie wymagane pola.'});
        }
        
        if (isNaN(location_lat) || isNaN(location_lng) || isNaN(power_kw) || (price_per_kwh && isNaN(price_per_kwh))) {
            return res.status(400).json({ error: 'Współrzędne, moc oraz cena muszą być poprawnymi liczbami.' });
        }

        const userId = req.user.userId;

        const insertStationQuery = `
            INSERT INTO stations (user_id, title, description, location_lat, location_lng, connector_type, power_kw, price_per_kwh, status, contact_email, contact_phone)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *;
            `;

            const values = [
                userId,
                title,
                description || null,
                location_lat,
                location_lng,
                connector_type,
                power_kw,
                price_per_kwh || 0.00,
                status || 'Dostępna',
                contact_email || null,
                contact_phone || null
            ];
            const result = await pool.query(insertStationQuery, values);

            res.status(201).json({
                message: 'Punkt ładowania został dodany pomyślnie!',
                station: result.rows[0]
            });
    } catch (err) {
        console.error('Błąd podczas dodawania stacji:', err);
        res.status(500).json({ error: 'Wystąpił błąd serwera podczas zapisywania stacji.'});
    }
});

//Sciezka do pobierania wszystkich punktow ladowania
app.get('/api/stations', async (req, res) => {
    try {
        const selectStationsQuery = `
            SELECT 
                stations.*, 
                users.username as owner_name, 
                users.email as owner_email, 
                users.phone_number as owner_phone_number 
            FROM stations 
            LEFT JOIN users ON stations.user_id = users.id
            ORDER BY stations.id DESC;
        `;
        const result = await pool.query(selectStationsQuery);

        res.status(200).json({
            message: 'Pobrano listę punktów ładowania.',
            count: result.rows.length,
            stations: result.rows
        });
    } catch (err) {
        console.error('Błąd podczas pobierania stacji:', err);
        res.status(500).json({ error: 'Wystąpił błąd serwera podczas pobierania punktów ładowania.'});
    }
});

//Sciezka do pobierania pojedynczego punktu ladowania po jego ID
app.get('/api/stations/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const selectStationQuery = `
            SELECT 
                stations.*, 
                users.username as owner_name, 
                users.email as owner_email, 
                users.phone_number as owner_phone_number 
            FROM stations 
            LEFT JOIN users ON stations.user_id = users.id
            WHERE stations.id = $1;
        `;
        const result = await pool.query(selectStationQuery, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nie znaleziono punktu ładowania o podanym ID.'});
        }

        res.status(200).json({
            message: 'Pobrano szczegóły stacji.',
            station: result.rows[0]
        });
    } catch (err) {
        console.error('Błąd podczas pobierania szczegółów stacji:', err);
        res.status(500).json({ error: 'Wystąpił błąd serwera podczas pobierania danych stacji.'});
    }
});

//Sciezka do usuwania punktu ladowania
app.delete('/api/stations/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const chceckStationQuery = 'SELECT user_id FROM stations WHERE id = $1;';
        const stationResult = await pool.query(chceckStationQuery, [id]);

        if (stationResult.rows.length === 0) {
            return res.status(404).json({ error: 'Nie znaleziono punktów łądowania o podanym ID.'});
        } 

        if (stationResult.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'Brak uprawnień. Możesz usuwać tylko własne punkty ładowania.'});
        }

        const deleteStationQuery = 'DELETE FROM stations WHERE id = $1;';
        await pool.query(deleteStationQuery, [id]);

        res.status(200).json({ message: 'Punkt ładowania został pomyślnie usunięty.'});
    } catch (err) {
        console.error('Błąd podczas usuwania stacji:', err);
        res.status(500).json({ error: 'Wystąpił błąd serwera podczas usuwania stacji.'});
    }
});

// NAPRAWIONA ŚCIEŻKA DO EDYCJI STACJI
app.put('/api/stations/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const { 
            title, description, location_lat, location_lng, 
            connector_type, power_kw, price_per_kwh, status,
            contact_email, contact_phone 
        } = req.body;

        if (isNaN(location_lat) || isNaN(location_lng) || isNaN(power_kw) || (price_per_kwh && isNaN(price_per_kwh))) {
            return res.status(400).json({ error: 'Współrzędne, moc oraz cena muszą być poprawnymi liczbami.' });
        }

        if (contact_phone && contact_phone.trim() !== "") {
            const phoneRegex = /^\d{9}$/;
            if (!phoneRegex.test(contact_phone)) {
                return res.status(400).json({ error: 'Numer telefonu stacji musi składać się z dokładnie 9 cyfr.' });
            }
        }

        // 1. Sprawdzanie czy stacja istnieje i do kogo należy
        const checkStationQuery = 'SELECT user_id FROM stations WHERE id = $1;';
        const stationResult = await pool.query(checkStationQuery, [id]);

        if (stationResult.rows.length === 0) {
            return res.status(404).json({ error: 'Nie znaleziono punktu ładowania o podanym ID.'});
        } 

        // Sprawdzanie uprawnień
        if (stationResult.rows[0].user_id !== userId) {
            return res.status(403).json({ error: 'Brak uprawnień. Możesz edytować tylko własne punkty ładowania.'});
        }

        // 2. Aktualizacja danych TYLKO w tabeli 'stations' (Wrzucamy nowe pola kontaktowe)
        const updateStationQuery = `
            UPDATE stations 
            SET title = $1, description = $2, location_lat = $3, location_lng = $4, 
                connector_type = $5, power_kw = $6, price_per_kwh = $7, status = $8,
                contact_email = $9, contact_phone = $10
            WHERE id = $11
            RETURNING *;
        `;
        
        const values = [
            title, 
            description || null, 
            location_lat, 
            location_lng, 
            connector_type, 
            power_kw, 
            price_per_kwh || 0.00, 
            status || 'Dostępna',
            contact_email || null,
            contact_phone || null,
            id
        ];

        const result = await pool.query(updateStationQuery, values);

        res.status(200).json({ 
            message: 'Punkt ładowania został zaktualizowany.',
            station: result.rows[0]
        });

    } catch (err) {
        console.error('Błąd podczas aktualizacji stacji:', err);
        res.status(500).json({ error: 'Wystąpił błąd serwera podczas aktualizacji stacji.'});
    }
});

// Ten endpoint pozwoli Ci usuwać stacje jako admin po kliknięciu w aplikacji
app.delete('/api/admin/force-delete/:id', authenticateToken, async (req, res) => {
    try {
        // 1. Sprawdzamy, czy użytkownik z tokena to faktycznie "kaczka"
        const userQuery = 'SELECT username FROM users WHERE id = $1;';
        const userResult = await pool.query(userQuery, [req.user.userId]);

        if (userResult.rows[0]?.username !== 'kaczka') {
            return res.status(403).json({ error: 'Nie masz uprawnień.' });
        }

        // 2. Jeśli to "kaczka", usuwamy stację
        const deleteResult = await pool.query('DELETE FROM stations WHERE id = $1 RETURNING *;', [req.params.id]);
        
        if (deleteResult.rows.length === 0) {
            return res.status(404).json({ error: 'Stacja nie istnieje.' });
        }

        res.status(200).json({ message: 'Stacja usunięta.' });
    } catch (err) {
        console.error('Błąd usuwania:', err);
        res.status(500).json({ error: 'Błąd serwera.' });
    }
});

//Odpalanie serwera by nasluchiwal ruchu na porcie 5000
app.listen(PORT, () => {
    console.log(`Serwer wystartował na porcie ${PORT}`);
});