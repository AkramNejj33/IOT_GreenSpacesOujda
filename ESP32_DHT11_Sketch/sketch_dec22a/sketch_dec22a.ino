#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ========== CONFIGURATION WiFi ==========
const char* ssid = "inwi Home 4GA72201";           // Remplace par ton WiFi
const char* password = "40509937";    // Remplace par ton mot de passe

// ========== CONFIGURATION SERVEUR ==========
const char* serverURL = "http://192.168.8.103:5137/api/sensors/data";

// ========== CONFIGURATION DHT11 ==========
#define DHTPIN 4        // GPIO 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// ========== VARIABLES GLOBALES ==========
unsigned long lastUpdateTime = 0;
const unsigned long updateInterval = 5000;  // Envoyer toutes les 5 secondes
int failureCount = 0;

void setup() {
  Serial.begin(115200);
  delay(2000);  // Attendre le démarrage
  
  Serial.println("\n\n");
  Serial.println("╔════════════════════════════════════════╗");
  Serial.println("║  Démarrage du capteur IoT ESP32+DHT11  ║");
  Serial.println("╚════════════════════════════════════════╝");
  
  // Initialiser le capteur DHT11
  dht.begin();
  delay(1000);
  
  // Connexion WiFi
  connectToWiFi();
}

void loop() {
  // Vérifier la connexion WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️  WiFi déconnecté, tentative de reconnexion...");
    connectToWiFi();
  }
  
  // Envoyer les données à intervalle régulier
  if (millis() - lastUpdateTime >= updateInterval) {
    sendSensorData();
    lastUpdateTime = millis();
  }
  
  delay(1000);
}

// ========== FONCTION: CONNEXION WiFi ==========
void connectToWiFi() {
  Serial.print("🔌 Connexion au WiFi: ");
  Serial.println(ssid);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  Serial.println();
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("✅ WiFi connecté!");
    Serial.print("📍 IP locale: ");
    Serial.println(WiFi.localIP());
    failureCount = 0;
  } else {
    Serial.println("❌ Échec de connexion WiFi");
    failureCount++;
  }
}

// ========== FONCTION: LIRE ET ENVOYER LES DONNÉES ==========
void sendSensorData() {
  // Lire les données du DHT11
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  
  // Vérifier les erreurs de lecture
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("❌ Erreur de lecture DHT11!");
    return;
  }
  
  // Afficher dans le moniteur série
  Serial.print("📊 Données lues - ");
  Serial.print("Température: ");
  Serial.print(temperature);
  Serial.print("°C | Humidité: ");
  Serial.print(humidity);
  Serial.println("%");
  
  // Créer le JSON
  StaticJsonDocument<200> jsonDoc;
  jsonDoc["sensorId"] = "ESP32_001";
  jsonDoc["temperature"] = temperature;
  jsonDoc["humidity"] = humidity;
  jsonDoc["timestamp"] = millis();
  
  String jsonString;
  serializeJson(jsonDoc, jsonString);
  
  Serial.print("📤 Envoi au serveur: ");
  Serial.println(jsonString);
  
  // Envoyer au serveur
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    
    int httpResponseCode = http.POST(jsonString);
    
    if (httpResponseCode > 0) {
      Serial.print("✅ Réponse serveur: ");
      Serial.println(httpResponseCode);
      
      String response = http.getString();
      Serial.print("📥 Réponse: ");
      Serial.println(response);
      
      failureCount = 0;  // Réinitialiser le compteur d'erreurs
    } else {
      Serial.print("❌ Erreur HTTP: ");
      Serial.println(httpResponseCode);
      failureCount++;
    }
    
    http.end();
  } else {
    Serial.println("❌ WiFi non connecté, impossible d'envoyer");
    failureCount++;
  }
  
  Serial.println("---");
}