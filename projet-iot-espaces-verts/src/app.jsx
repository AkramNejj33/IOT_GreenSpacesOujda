import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Droplets, Thermometer, Wind, Activity, AlertCircle } from 'lucide-react';

// Données simulées pour les capteurs VIRTUELS avec nouvelles coordonnées
const generateVirtualSensorData = () => {
  const sensors = [
    { 
      id: 'ESP32_002', 
      name: 'Parc Central - Zone B', 
      lat: 34.6736, 
      lng: -1.9077, 
      active: true, 
      virtual: true,
      coords: "34°40'25.0\"N 1°54'27.8\"W"
    },
    { 
      id: 'ESP32_003', 
      name: 'Jardin Municipal', 
      lat: 34.6773, 
      lng: -1.9150, 
      active: true, 
      virtual: true,
      coords: "34°40'38.3\"N 1°54'53.8\"W"
    },
    { 
      id: 'ESP32_004', 
      name: 'Espace Vert Résidentiel', 
      lat: 34.6750, 
      lng: -1.9110, 
      active: false, 
      virtual: true,
      coords: "34°40'30.0\"N 1°54'39.6\"W"
    }
  ];

  return sensors.map(sensor => ({
    ...sensor,
    temperature: (20 + Math.random() * 15).toFixed(1),
    soilMoisture: (30 + Math.random() * 50).toFixed(1),
    airHumidity: (40 + Math.random() * 40).toFixed(1),
    lastUpdate: new Date().toLocaleTimeString('fr-FR'),
    battery: (60 + Math.random() * 40).toFixed(0)
  }));
};

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sensors, setSensors] = useState([
    {
      id: 'ESP32_001',
      name: 'Parc Central - Zone A (RÉEL)',
      lat: 34.6807,
      lng: -1.9102,
      coords: "34°40'50.5\"N 1°54'36.7\"W",
      active: true,
      virtual: false,
      temperature: 25.0,
      soilMoisture: 50.0,
      airHumidity: 60.0,
      battery: 85,
      lastUpdate: new Date().toLocaleTimeString('fr-FR')
    },
    ...generateVirtualSensorData()
  ]);
  
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [geojsonData, setGeojsonData] = useState(null);
  const [apiStatus, setApiStatus] = useState('disconnected');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const apiURL = 'http://192.168.8.103:5137';

  // Mise à jour des données réelles
  useEffect(() => {
    const fetchRealSensorData = async () => {
      try {
        const response = await fetch(`${apiURL}/api/sensors/latest`);
        if (!response.ok) throw new Error('API non disponible');
        
        const latestData = await response.json();
        const realSensorData = latestData.find(d => d.sensorId === 'ESP32_001');

        if (realSensorData) {
          setSensors(prevSensors => 
            prevSensors.map(sensor => {
              if (sensor.id === 'ESP32_001') {
                return {
                  ...sensor,
                  temperature: parseFloat(realSensorData.temperature).toFixed(1),
                  soilMoisture: parseFloat(realSensorData.soilMoisture || 50).toFixed(1),
                  airHumidity: parseFloat(realSensorData.humidity || realSensorData.airHumidity || 60).toFixed(1),
                  battery: parseFloat(realSensorData.battery || 85).toFixed(0),
                  lastUpdate: new Date(realSensorData.timestamp).toLocaleTimeString('fr-FR'),
                  active: true
                };
              }
              return sensor;
            })
          );
          setApiStatus('connected');
        }
      } catch (error) {
        console.log('API non disponible, utilisation de données simulées');
        setApiStatus('disconnected');
      }
    };

    fetchRealSensorData();
    const realInterval = setInterval(fetchRealSensorData, 5000);

    const virtualInterval = setInterval(() => {
      setSensors(prevSensors => {
        const virtualSensorsUpdated = generateVirtualSensorData();
        return [
          prevSensors[0],
          ...virtualSensorsUpdated
        ];
      });
    }, 5000);

    return () => {
      clearInterval(realInterval);
      clearInterval(virtualInterval);
    };
  }, []);

  // Initialisation de la carte Leaflet
  useEffect(() => {
    if (activeTab === 'map' && !mapInstanceRef.current) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => initMap();
      document.body.appendChild(script);
    }
  }, [activeTab]);

  const initMap = () => {
    if (mapRef.current && window.L && !mapInstanceRef.current) {
      const map = window.L.map(mapRef.current).setView([34.6750, -1.9115], 14);
      
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      sensors.forEach(sensor => {
        const color = sensor.active ? '#10b981' : '#ef4444';
        const isReal = !sensor.virtual ? '#FFD700' : '#FFFFFF';
        const icon = window.L.divIcon({
          className: 'custom-marker',
          html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 4px solid ${isReal}; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
          iconSize: [30, 30]
        });

        window.L.marker([sensor.lat, sensor.lng], { icon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: system-ui, -apple-system, sans-serif;">
              <strong style="font-size: 14px;">${sensor.name}</strong>
              ${!sensor.virtual ? '<span style="color: #FFD700; font-weight: bold;"> [RÉEL]</span>' : ''}
              <br/>
              <span style="color: #666; font-size: 12px;">ID: ${sensor.id}</span><br/>
              <span style="color: #666; font-size: 11px;">📍 ${sensor.coords}</span><br/>
              <div style="margin-top: 8px; font-size: 13px;">
                <div>🌡️ Température: ${sensor.temperature}°C</div>
                <div>💧 Humidité sol: ${sensor.soilMoisture}%</div>
                <div>☁️ Humidité air: ${sensor.airHumidity}%</div>
              </div>
            </div>
          `);
      });

      if (geojsonData) {
        window.L.geoJSON(geojsonData, {
          style: {
            color: '#22c55e',
            weight: 2,
            fillColor: '#86efac',
            fillOpacity: 0.3
          },
          onEachFeature: (feature, layer) => {
            if (feature.properties && feature.properties.name) {
              layer.bindPopup(`
                <strong>${feature.properties.name}</strong><br/>
                ${feature.properties.description || 'Espace vert urbain'}
              `);
            }
          }
        }).addTo(map);
      }

      mapInstanceRef.current = map;
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target.result);
          setGeojsonData(json);
          if (mapInstanceRef.current && window.L) {
            window.L.geoJSON(json, {
              style: {
                color: '#22c55e',
                weight: 2,
                fillColor: '#86efac',
                fillOpacity: 0.3
              }
            }).addTo(mapInstanceRef.current);
          }
        } catch (error) {
          alert('Erreur lors de la lecture du fichier GeoJSON');
        }
      };
      reader.readAsText(file);
    }
  };

  // Calcul des statistiques
  const activeSensors = sensors.filter(s => s.active).length;
  const avgTemp = (sensors.reduce((sum, s) => sum + parseFloat(s.temperature), 0) / sensors.length).toFixed(1);
  const avgSoilMoisture = (sensors.reduce((sum, s) => sum + parseFloat(s.soilMoisture), 0) / sensors.length).toFixed(1);
  const avgAirHumidity = (sensors.reduce((sum, s) => sum + parseFloat(s.airHumidity), 0) / sensors.length).toFixed(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-md border-b-4 border-green-500">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-green-500 p-2 rounded-lg">
                <Activity className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Système IoT - Espaces Verts Urbains</h1>
                <p className="text-sm text-gray-600">Monitoring en temps réel - Smart City</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                apiStatus === 'connected' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <div className={`w-3 h-3 rounded-full ${apiStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className={`text-sm font-medium ${apiStatus === 'connected' ? 'text-green-800' : 'text-red-800'}`}>
                  {apiStatus === 'connected' ? 'API Connectée ✅' : 'Mode Simulé'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-3 font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-green-600'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-6 py-3 font-medium transition-all ${
                activeTab === 'map'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-green-600'
              }`}
            >
              🗺️ Carte Interactive
            </button>
            <button
              onClick={() => setActiveTab('sensors')}
              className={`px-6 py-3 font-medium transition-all ${
                activeTab === 'sensors'
                  ? 'text-green-600 border-b-2 border-green-600'
                  : 'text-gray-600 hover:text-green-600'
              }`}
            >
              📡 Capteurs
            </button>
          </div>
        </div>
      </nav>

      {/* Contenu principal */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* TAB: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Statistiques globales */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Capteurs Actifs</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{activeSensors}/{sensors.length}</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-lg">
                    <Activity className="text-blue-600" size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Température Moy.</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{avgTemp}°C</p>
                  </div>
                  <div className="bg-orange-100 p-3 rounded-lg">
                    <Thermometer className="text-orange-600" size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-cyan-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Humidité Sol Moy.</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{avgSoilMoisture}%</p>
                  </div>
                  <div className="bg-cyan-100 p-3 rounded-lg">
                    <Droplets className="text-cyan-600" size={24} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">Humidité Air Moy.</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{avgAirHumidity}%</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-lg">
                    <Wind className="text-green-600" size={24} />
                  </div>
                </div>
              </div>
            </div>

            {/* Graphiques et données temps réel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <Thermometer className="mr-2 text-orange-500" size={20} />
                  Température par Zone
                </h3>
                <div className="space-y-3">
                  {sensors.map(sensor => (
                    <div key={sensor.id} className={`flex items-center justify-between p-3 rounded-lg ${sensor.virtual ? 'bg-gray-50' : 'bg-yellow-50 border border-yellow-200'}`}>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700">{sensor.name}</span>
                        {!sensor.virtual && <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">RÉEL</span>}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-400 to-red-500 h-2 rounded-full"
                            style={{ width: `${(parseFloat(sensor.temperature) / 40) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold text-gray-800 w-12">{sensor.temperature}°C</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <Droplets className="mr-2 text-cyan-500" size={20} />
                  Humidité du Sol par Zone
                </h3>
                <div className="space-y-3">
                  {sensors.map(sensor => (
                    <div key={sensor.id} className={`flex items-center justify-between p-3 rounded-lg ${sensor.virtual ? 'bg-gray-50' : 'bg-yellow-50 border border-yellow-200'}`}>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700">{sensor.name}</span>
                        {!sensor.virtual && <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">RÉEL</span>}
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-yellow-400 to-cyan-500 h-2 rounded-full"
                            style={{ width: `${parseFloat(sensor.soilMoisture)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-bold text-gray-800 w-12">{sensor.soilMoisture}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Alertes */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <AlertCircle className="mr-2 text-yellow-500" size={20} />
                Alertes et Recommandations
              </h3>
              <div className="space-y-3">
                {sensors.map(sensor => {
                  const soilMoisture = parseFloat(sensor.soilMoisture);
                  if (soilMoisture < 40) {
                    return (
                      <div key={sensor.id} className="flex items-start p-4 bg-red-50 border-l-4 border-red-500 rounded">
                        <AlertCircle className="text-red-500 mr-3 flex-shrink-0 mt-1" size={20} />
                        <div>
                          <p className="font-medium text-red-800">{sensor.name}</p>
                          <p className="text-sm text-red-700">Humidité du sol faible ({soilMoisture}%). Irrigation recommandée.</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
                {sensors.every(s => parseFloat(s.soilMoisture) >= 40) && (
                  <div className="flex items-start p-4 bg-green-50 border-l-4 border-green-500 rounded">
                    <Activity className="text-green-500 mr-3 flex-shrink-0 mt-1" size={20} />
                    <div>
                      <p className="font-medium text-green-800">Système nominal</p>
                      <p className="text-sm text-green-700">Toutes les zones présentent des conditions optimales.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB: Carte */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center">
                  <MapPin className="mr-2 text-green-500" size={20} />
                  Carte Interactive des Espaces Verts
                </h3>
                <label className="bg-green-500 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-green-600 transition-colors">
                  📁 Importer GeoJSON
                  <input
                    type="file"
                    accept=".geojson,.json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              
              <div 
                ref={mapRef} 
                className="w-full h-96 rounded-lg border-2 border-gray-200"
              ></div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                  <span className="text-sm text-gray-700">Capteur actif</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-yellow-400"></div>
                  <span className="text-sm text-gray-700">Capteur réel</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-gray-700">Capteur inactif</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-green-300 border-2 border-green-600"></div>
                  <span className="text-sm text-gray-700">Espace vert</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Capteurs */}
        {activeTab === 'sensors' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Liste des Capteurs ESP32</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {sensors.map(sensor => (
                  <div 
                    key={sensor.id}
                    className={`border-2 rounded-xl p-5 hover:border-green-500 transition-all cursor-pointer ${
                      sensor.virtual ? 'border-gray-200' : 'border-yellow-400 bg-yellow-50'
                    }`}
                    onClick={() => setSelectedSensor(sensor)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${sensor.active ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                        <h4 className="font-bold text-gray-800">{sensor.name}</h4>
                        {!sensor.virtual && <span className="text-xs bg-yellow-300 text-yellow-900 px-2 py-1 rounded font-bold">RÉEL</span>}
                      </div>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">{sensor.id}</span>
                    </div>

                    <div className="text-xs text-gray-500 mb-3 flex items-center">
                      <MapPin size={14} className="mr-1" />
                      {sensor.coords}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center">
                          <Thermometer size={16} className="mr-1 text-orange-500" />
                          Température
                        </span>
                        <span className="font-bold text-gray-800">{sensor.temperature}°C</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center">
                          <Droplets size={16} className="mr-1 text-cyan-500" />
                          Humidité Sol
                        </span>
                        <span className="font-bold text-gray-800">{sensor.soilMoisture}%</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center">
                          <Wind size={16} className="mr-1 text-green-500" />
                          Humidité Air
                        </span>
                        <span className="font-bold text-gray-800">{sensor.airHumidity}%</span>
                      </div>

                      <div className="flex items-center justify-between text-sm pt-2 border-t">
                        <span className="text-gray-500 text-xs">Batterie: {sensor.battery}%</span>
                        <span className="text-gray-500 text-xs">MAJ: {sensor.lastUpdate}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Détails du capteur sélectionné */}
            {selectedSensor && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">Détails - {selectedSensor.name}</h3>
                  <button 
                    onClick={() => setSelectedSensor(null)}
                    className="text-gray-500 hover:text-gray-700 text-xl"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4">
                    <Thermometer className="text-orange-500 mb-2" size={24} />
                    <p className="text-sm text-gray-600">Température</p>
                    <p className="text-2xl font-bold text-gray-800">{selectedSensor.temperature}°C</p>
                    <p className="text-xs text-gray-500 mt-1">Plage: 15-35°C</p>
                  </div>

                  <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-4">
                    <Droplets className="text-cyan-500 mb-2" size={24} />
                    <p className="text-sm text-gray-600">Humidité Sol</p>
                    <p className="text-2xl font-bold text-gray-800">{selectedSensor.soilMoisture}%</p>
                  </div>

                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                    <Wind className="text-green-500 mb-2" size={24} />
                    <p className="text-sm text-gray-600">Humidité Air</p>
                    <p className="text-2xl font-bold text-gray-800">{selectedSensor.airHumidity}%</p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-bold text-gray-800 mb-3">Informations Techniques</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Type:</span>
                      <span className="ml-2 font-medium">{selectedSensor.virtual ? 'Virtuel' : 'Réel (DHT11)'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Statut:</span>
                      <span className={`ml-2 font-medium ${selectedSensor.active ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedSensor.active ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Position:</span>
                      <span className="ml-2 font-medium text-xs">{selectedSensor.lat.toFixed(4)}, {selectedSensor.lng.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Batterie:</span>
                      <span className="ml-2 font-medium">{selectedSensor.battery}%</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600">Coordonnées GPS:</span>
                      <span className="ml-2 font-medium text-xs">{selectedSensor.coords}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-600">Dernière mise à jour:</span>
                      <span className="ml-2 font-medium">{selectedSensor.lastUpdate}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;