# SensorCube

SensorCube is een open-source project ontworpen om omgevingsmonitoring te vereenvoudigen. Het combineert hardware en software om parameters zoals temperatuur, luchtvochtigheid, luchtkwaliteit en beweging te meten. Het project is ideaal voor hobbyisten, onderzoekers en ontwikkelaars die op zoek zijn naar een aanpasbare IoT-oplossing.

## 🌟 Functies

Met SensorCube kun je:
- **Omgevingsgegevens in realtime monitoren** met geavanceerde sensoren
- **mmWave-technologie** voor geavanceerde bewegingsdetectie en aanwezigheidssensing
- **Integreren met Home Assistant** via ESPHome API
- **Visuele feedback** via een configureerbare LED ring
- **Diagnostiek en monitoring** van het systeem zelf

## 🔧 Ondersteunde sensoren en componenten

### Sensoren
- **DHT22 (AM2302)**: Meet temperatuur en luchtvochtigheid met verbeterde kalibratie
- **ENS160**: Meet luchtkwaliteit, eCO2 en TVOC met intelligente filters
  - Air Quality Index (AQI)
- **AHT20**: Compensatie sensor voor ENS160 temperatuur en luchtvochtigheid
- **TEMT6000 (LDR)**: Meet lichtintensiteit met gamma correctie
  - Automatische LED helderheid aanpassing
  - Dag/nacht detectie
  - Configureerbare licht thresholds
- **LD2450**: mmWave-sensor voor bewegingsdetectie en aanwezigheidssensing
  - Multi-target tracking
  - Configureerbare detectie zones
  - Bluetooth configuratie support

### Componenten
- **Neopixel LED Ring**: Visuele feedback met aanpasbare effecten
  - Automatische luchtkwaliteit kleuren
  - Configureerbare helderheid op basis van omgevingslicht
  - Diverse effecten (Rainbow, Fire, Scan, etc.)
- **Remote Control**: Ondersteuning voor IR afstandsbediening (RC variant)
- **Diagnostiek**: Uitgebreide systeem monitoring
  - WiFi signaalsterkte
  - ESP32 temperatuur

## 📱 Drie configuratie varianten

### 1. **SensorCube Standard** (`sensorcube.yaml`)
Volledige configuratie met alle sensoren en functies.

### 2. **SensorCube Air Quality** (`sensorcube_aq.yaml`) 
Gefocust op luchtkwaliteit monitoring zonder mmWave sensor.

### 3. **SensorCube RC** (`sensorcube_rc.yaml`)
Standaard configuratie plus IR remote control ondersteuning.

## 🚀 Installatie

### 1. **Eenvoudige installatie**
Bezoek de [officiële installatiepagina](https://tweako.github.io/SensorCube/) voor directe firmware installatie via je browser.

### 2. **Handmatige installatie**
```bash
# Clone de repository
git clone https://github.com/Tweako/SensorCube.git
cd SensorCube

# Compileer en upload (kies je variant)
esphome run sensorcube.yaml          # Standaard versie
esphome run sensorcube_aq.yaml       # Luchtkwaliteit focus
esphome run sensorcube_rc.yaml       # Met remote control
```

### 3. **Factory firmware**
Voor eerste installatie gebruik je de factory versies die WiFi provisioning bevatten:
```bash
esphome run sensorcube.factory.yaml
```

## ⚙️ Configuratie

### LED Luchtkwaliteit Indicaties
De LED ring toont automatisch de luchtkwaliteit:
- 🔵 **Blauw**: Uitstekend (eCO2 < 600 ppm)
- 🟢 **Groen**: Goed (eCO2 < 800 ppm)  
- 🟡 **Geel**: Redelijk (eCO2 < 1000 ppm)
- 🟠 **Oranje**: Slecht (eCO2 < 1500 ppm)
- 🔴 **Rood (pulsend)**: Zeer slecht (eCO2 ≥ 1500 ppm)

### GPIO Pin Assignment
```
GPIO0  - LDR (lichtintensiteit)
GPIO4  - Neopixel LED ring
GPIO5  - DHT22 data pin
GPIO6  - I2C SDA (ENS160, AHT20)
GPIO7  - I2C SCL (ENS160, AHT20)  
GPIO20 - LD2450 UART TX
GPIO21 - LD2450 UART RX
GPIO1  - IR Receiver (alleen RC variant)
```

## 🏗️ Project Structuur

```
SensorCube/
├── sensorcube.yaml              # Hoofd configuratie
├── sensorcube_aq.yaml           # Luchtkwaliteit variant
├── sensorcube_rc.yaml           # Remote control variant
├── sensorcube*.factory.yaml     # Factory firmware versies
├── components/                  # Modulaire componenten
│   ├── sensorcube_base.yaml     # Basis ESP32 configuratie
│   ├── network.yaml             # WiFi, API, OTA configuratie
│   ├── dht22.yaml              # Temperatuur/luchtvochtigheid
│   ├── ens160.yaml             # Luchtkwaliteit sensor
│   ├── ld2450.yaml             # mmWave bewegingssensor
│   ├── ledring.yaml            # LED ring effecten
│   ├── ldr.yaml                # Lichtintensiteit sensor
│   ├── led_air_quality.yaml    # Automatische LED kleuren
│   ├── diagnostics.yaml        # Systeem monitoring
│   └── remote_receiver.yaml    # IR afstandsbediening
├── static/                     # GitHub Pages website
└── .github/workflows/          # Automatische CI/CD
```

## 📊 Beschikbare Entiteiten

### Sensoren
- Temperatuur, Luchtvochtigheid
- eCO2, TVOC, Air Quality Index met beschrijvingen
- Lichtintensiteit met percentage en niveau beschrijvingen
- Beweging, Aanwezigheid, Aantal personen (LD2450)
- WiFi signaal, ESP32 temperatuur


### Knoppen & Controles  
- Restart, Factory reset, Safe mode
- LD2450 Bluetooth toggle

## 🔄 Updates & Onderhoud

Het project ondersteunt automatische OTA updates via:
- **ESPHome Dashboard**: Lokale updates via WiFi
- **GitHub Releases**: Automatische firmware builds

## 🤝 Bijdragen

Bijdragen zijn welkom! Maak een fork, implementeer je verbeteringen en dien een pull request in.

## 📄 Licentie

Dit project is open-source onder de MIT licentie.

---

**Hardware schema en PCB ontwerpen worden later toegevoegd.**
