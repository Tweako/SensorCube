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
  - Statussensor: opwarmen (3 min na inschakelen), eerste opstart (1 uur na de allereerste keer) of normaal
- **AHT20**: Compensatie sensor voor ENS160 temperatuur en luchtvochtigheid
- **TEMT6000 (LDR)**: Meet lichtintensiteit met gamma correctie
  - Automatische LED helderheid aanpassing
  - Dag/nacht detectie
  - Configureerbare licht thresholds
- **LD2450**: mmWave-sensor voor bewegingsdetectie en aanwezigheidssensing
  - Multi-target tracking
  - Configureerbare detectie zones, met presets (hele kamer, 2 of 3 zones naast elkaar, 3 zones op afstand)
  - Radarkaart op de webpagina en als kaart voor je Home Assistant dashboard: zie live waar personen zijn en teken zones met muis of vinger
  - Bluetooth configuratie support

### Componenten
- **Neopixel LED Ring**: Visuele feedback met aanpasbare effecten
  - Automatische luchtkwaliteit kleuren
  - Configureerbare helderheid op basis van omgevingslicht
  - Diverse effecten (Rainbow, Fire, Scan, etc.)
  - Presence Tracker: een wit lichtje wijst naar elke persoon die de radar ziet en loopt met je mee
- **Diagnostiek**: Uitgebreide systeem monitoring
  - WiFi signaalsterkte
  - ESP32 temperatuur

## 🚀 Installatie

### 1. **Eenvoudige installatie**
Bezoek de [officiële installatiepagina](https://tweako.github.io/SensorCube/) voor directe firmware installatie via je browser.

### 2. **Handmatige installatie**
```bash
# Clone de repository
git clone https://github.com/Tweako/SensorCube.git
cd SensorCube

# Compileer en upload
esphome run sensorcube.yaml
```

### 3. **Factory firmware**
Voor eerste installatie gebruik je de factory versie die WiFi provisioning (Improv via USB) bevat:
```bash
esphome run sensorcube.factory.yaml
```

> **Windows:** start ESPHome vanuit PowerShell of cmd, niet vanuit Git Bash (ESP-IDF ondersteunt MSYS niet).

## ⚙️ Configuratie

### LED Luchtkwaliteit Indicaties
De LED ring toont automatisch de luchtkwaliteit:
- 🔵 **Blauw**: Uitstekend (eCO2 < 600 ppm)
- 🟢 **Groen**: Goed (eCO2 < 800 ppm)
- 🟡 **Geel**: Redelijk (eCO2 < 1000 ppm)
- 🟠 **Oranje**: Slecht (eCO2 < 1500 ppm)
- 🔴 **Rood**: Zeer slecht (eCO2 ≥ 1500 ppm)
- 🌈 **Regenboog**: Nog geen eCO2 meetwaarde beschikbaar (bijv. net opgestart)
- 🟡 **Knipperende gele LEDs (eerste en laatste)**: Geen WiFi verbinding; de rest van de ring blijft de luchtkwaliteit tonen
- 🟡 **Geel (pulsend, gedimd)**: Geen WiFi én nog geen meetwaarde

De helderheid past zich aan het omgevingslicht aan (5–50%). Met de schakelaar
**LED Air Quality Indicator** in Home Assistant zet je de automatische kleuren uit,
zodat je de LED ring zelf kunt bedienen. Alle kleurgrenzen en de helderheid zijn in Home Assistant
aan te passen. Met **LED Night Mode** gaat de ring uit als het donker is (standaard < 5 lx)
of als er 15 minuten niemand aanwezig is; zodra er weer iemand binnenkomt gaat hij weer aan.
Met **LED Presence Tracker** wijst een wit lichtje op de ring naar iedereen die de radar ziet (maximaal 3 personen)
en beweegt mee. Zonder WiFi gaat de WiFi-waarschuwing voor.

### CO2-grafiek zonder Home Assistant
Open het IP-adres van de SensorCube in je browser: onder de entiteiten staat een grafiek van de eCO2 van de
laatste 24 uur (één waarde per 15 minuten). De gegevens staan in het geheugen van het apparaat en beginnen na
een herstart opnieuw.

### Radarkaart en zones tekenen
Op dezelfde webpagina staat een radarkaart van bovenaf, zoals je hem ziet als je naar de voorkant van de cube
kijkt: de cube staat bovenaan, de kamer eronder, het raster is per meter.
Personen verschijnen als rode stippen (maximaal 3) en zones lichten op als er iemand in staat.

Zones tekenen: kies Zone 1, 2 of 3, sleep een rechthoek op de kaart en druk op *Save zones*. *Clear zone*
wist de gekozen zone, *Cancel* gooit niet-opgeslagen wijzigingen weg. Staat Zone Type op Disabled, dan zet
opslaan hem op Detection. Klopt links/rechts niet met jouw kamer, vink dan *Mirror left/right* aan (dit wordt
per browser onthouden).

### Radarkaart op je Home Assistant dashboard
Dezelfde radarkaart is er ook als kaart voor je dashboard, met Nederlandse of Engelse teksten (volgt de taal van
Home Assistant).

1. **Kaart installeren**, op een van deze twee manieren:
   - Met HACS: *HACS → ⋮ → Custom repositories*, voeg `https://github.com/Tweako/SensorCube` toe met type
     *Dashboard* en installeer **SensorCube Radar Card**.
   - Handmatig: zet [`dist/sensorcube-radar-card.js`](dist/sensorcube-radar-card.js) in de map `/config/www/` van
     Home Assistant en voeg bij *Instellingen → Dashboards → ⋮ → Bronnen* de bron `/local/sensorcube-radar-card.js`
     toe (type JavaScript-module). Na een update van het bestand: zet er `?v=2` (enz.) achter, anders gebruikt je
     browser de oude versie.
2. **Entiteit inschakelen**: open de SensorCube bij *Instellingen → Apparaten en diensten* en schakel onder
   Diagnostiek de entiteit **Radar Data** in (die staat standaard uit).
3. **Kaart toevoegen**: bewerk je dashboard, kies *Kaart toevoegen* en zoek **SensorCube Radar**. Of in YAML:

```yaml
type: custom:sensorcube-radar-card
entity: sensor.sensorcube_xxxxxx_radar_data
title: Woonkamer   # optioneel, standaard de naam van het apparaat
mirror: false      # optioneel, links/rechts spiegelen
read_only: false   # optioneel, verbergt de knop Zones bewerken (bijv. voor een wandtablet)
```

Met **Zones bewerken** teken je zones net als op de webpagina; de kaart slaat ze op via de zone-entiteiten van
dezelfde SensorCube. Buiten de bewerkmodus kun je gewoon over de kaart heen scrollen.

Tip: als er iemand beweegt verandert Radar Data tot twee keer per seconde. Houd hem buiten de geschiedenis, zodat
je database niet onnodig groeit en het logboek rustig blijft (`configuration.yaml`):

```yaml
recorder:
  exclude:
    entity_globs:
      - sensor.*_radar_data
```

### GPIO Pin Assignment
```
GPIO0  - LDR (lichtintensiteit)
GPIO4  - Neopixel LED ring
GPIO5  - DHT22 data pin
GPIO6  - I2C SDA (ENS160, AHT20)
GPIO7  - I2C SCL (ENS160, AHT20)
GPIO20 - LD2450 UART TX
GPIO21 - LD2450 UART RX
```

## 🏗️ Project Structuur

```
SensorCube/
├── sensorcube.yaml              # Hoofd configuratie
├── sensorcube.factory.yaml      # Factory firmware (met WiFi provisioning)
├── components/                  # Modulaire componenten
│   ├── sensorcube-base.yaml     # Basis ESP32 configuratie
│   ├── network.yaml             # WiFi, API, OTA configuratie
│   ├── dht22.yaml               # Temperatuur/luchtvochtigheid
│   ├── ens160.yaml              # Luchtkwaliteit sensor
│   ├── ld2450.yaml              # mmWave bewegingssensor
│   ├── ledring.yaml             # LED ring effecten
│   ├── ldr.yaml                 # Lichtintensiteit sensor
│   ├── led-air-quality.yaml     # Automatische LED kleuren
│   ├── comfort.yaml             # Comfortindex (binnenklimaat)
│   ├── eco2-history.yaml        # eCO2 geschiedenis (24 uur) voor de grafiek
│   ├── web/sensorcube.js        # eCO2-grafiek en radarkaart op de webpagina van het apparaat
│   └── diagnostics.yaml         # Systeem monitoring
├── dist/sensorcube-radar-card.js # Radarkaart voor het Home Assistant dashboard
├── hacs.json                    # Zodat HACS de dashboardkaart kan installeren
├── static/                      # GitHub Pages website
└── .github/workflows/           # Automatische CI/CD
```

## 📊 Beschikbare Entiteiten

### Sensoren
- Temperatuur, Luchtvochtigheid
- eCO2, TVOC, Air Quality Index met beschrijvingen
- Lichtintensiteit met percentage en niveau beschrijvingen
- Beweging, Aanwezigheid, Aantal personen (LD2450)
- Ventilation Needed: aan boven de ingestelde eCO2 grens (handig voor meldingen of een ventilator)
- Comfort: Comfortable, Stuffy (benauwd), Too Cold, Too Warm, Too Dry of Too Humid
- Air Quality Sensor Status: Warming Up, Initial Start-up, Normal
- eCO2 History: gegevens voor de grafiek (standaard verborgen in Home Assistant)
- Radar Data: posities en zones voor de radarkaart (staat standaard uit; inschakelen voor de dashboardkaart)
- WiFi signaal, ESP32 temperatuur, Online sinds (via Home Assistant of NTP tijd)


### Knoppen & Controles
- Restart, Factory reset, Safe mode
- LD2450 Bluetooth toggle
- LED Air Quality Indicator (automatische LED kleuren aan/uit)
- LED Night Mode: ring uit als het donker is of als er een tijd niemand aanwezig is
- LED Night Light Level / LED Off Without Presence (instellingen nachtmodus)
- LED Threshold Excellent/Good/Fair/Poor en LED Brightness Min/Max (kleurgrenzen en helderheid)
- Ventilation Threshold (grens voor ventilatie-advies)
- LED Presence Tracker: wit lichtje dat aanwezige personen volgt
- Zone Preset: vult alle LD2450 zones in één keer in
- Daylight Threshold (lux grens voor dag/nacht detectie)

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
