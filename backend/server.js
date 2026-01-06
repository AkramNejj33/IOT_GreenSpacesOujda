// npm install express cors dotenv
// npm install -D nodemon

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// ========== MIDDLEWARE ==========
app.use(express.json());
app.use(cors());

// ========== STOCKAGE EN MÉMOIRE ==========
const sensorDataStore = []; // Historique des données
const sensorsStore = new Map();  // Liste des capteurs actifs
const MAX_STORED_DATA = 1000; // Limiter la taille en mémoire

// ========== ROUTES ==========

// POST - Recevoir les données du capteur (depuis ESP32) + STREAMING
app.post('/api/sensors/data', (req, res) => {
  try {
    const { sensorId, temperature, humidity } = req.body;

    console.log(`📊 Données reçues - ${sensorId}: ${temperature}°C, ${humidity}% humidité`);

    // Créer l'objet de données
    const sensorData = {
      _id: new Date().getTime().toString(),
      sensorId,
      temperature: parseFloat(temperature),
      humidity: parseFloat(humidity),
      soilMoisture: 30 + Math.random() * 50,
      airHumidity: 40 + Math.random() * 40,
      battery: 60 + Math.random() * 40,
      timestamp: new Date()
    };

    // Ajouter à l'historique
    sensorDataStore.push(sensorData);
    
    // Limiter la taille du stockage
    if (sensorDataStore.length > MAX_STORED_DATA) {
      sensorDataStore.shift();
    }

    // Mettre à jour le capteur dans la liste
    sensorsStore.set(sensorId, {
      id: sensorId,
      name: `Capteur ${sensorId}`,
      active: true,
      lastUpdate: new Date(),
      lat: 34.6807,
      lng: -1.9102,
      ...sensorData
    });

    // Broadcast à tous les clients SSE connectés
    broadcastToClients(sensorData);

    res.status(200).json({ 
      success: true, 
      message: 'Données reçues et diffusées',
      data: sensorData 
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== SERVER-SENT EVENTS (SSE) - STREAMING ==========
const clients = []; // Liste des clients connectés

app.get('/api/sensors/stream', (req, res) => {
  console.log('🔌 Nouveau client SSE connecté');
  
  // Headers pour SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const clientId = Date.now();
  const client = { id: clientId, res };
  clients.push(client);

  // Envoyer les données actuelles au nouvel client
  res.write(`data: ${JSON.stringify({ type: 'initial', data: Array.from(sensorsStore.values()) })}\n\n`);

  // Gérer la déconnexion
  req.on('close', () => {
    console.log(`❌ Client SSE ${clientId} déconnecté`);
    const index = clients.findIndex(c => c.id === clientId);
    if (index > -1) clients.splice(index, 1);
  });
});

// Fonction pour diffuser les données à tous les clients
function broadcastToClients(data) {
  clients.forEach(client => {
    try {
      client.res.write(`data: ${JSON.stringify({ type: 'update', data })}\n\n`);
    } catch (error) {
      console.error('Erreur lors de l\'envoi aux clients:', error);
    }
  });
}

// GET - Récupérer les 10 dernières données de tous les capteurs
app.get('/api/sensors/latest', (req, res) => {
  try {
    // Retourner les capteurs actifs en mémoire
    const latestData = Array.from(sensorsStore.values()).slice(-10);
    res.status(200).json(latestData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Récupérer les données d'un capteur spécifique
app.get('/api/sensors/:sensorId/data', (req, res) => {
  try {
    const { sensorId } = req.params;
    const limit = req.query.limit || 100;

    const data = sensorDataStore
      .filter(d => d.sensorId === sensorId)
      .slice(-parseInt(limit));

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Liste de tous les capteurs
app.get('/api/sensors', (req, res) => {
  try {
    const sensors = Array.from(sensorsStore.values());
    res.status(200).json(sensors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Statistiques globales
app.get('/api/sensors/stats/global', (req, res) => {
  try {
    const stats = Array.from(sensorsStore.values()).map(sensor => ({
      _id: sensor.sensorId,
      temperature: sensor.temperature,
      humidity: sensor.humidity,
      soilMoisture: sensor.soilMoisture,
      airHumidity: sensor.airHumidity
    }));

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET - Health check (vérifier si l'API fonctionne)
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'API active ✅',
    mode: 'Streaming en mémoire (sans MongoDB)',
    clients: clients.length,
    dataPoints: sensorDataStore.length,
    activeSensors: sensorsStore.size
  });
});

// ========== DÉMARRER LE SERVEUR ==========
const PORT = process.env.PORT || 5137;
const HOST = '0.0.0.0'; // 🔧 IMPORTANT: Écouter sur TOUTES les interfaces réseau

app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════╗
║   Serveur IoT en cours d'exécution     ║
║   🌐 http://0.0.0.0:${PORT}            ║
║   📍 http://192.168.8.103:${PORT}      ║
║   Mode: STREAMING                      ║
║   Endpoint: /api/sensors/data          ║
║   Stream: /api/sensors/stream (SSE)    ║
╚════════════════════════════════════════╝
  `);
});