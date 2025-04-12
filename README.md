# SensorCube

SensorCube is een open-source project ontworpen om omgevingsmonitoring te vereenvoudigen. Het combineert hardware en software om parameters zoals temperatuur, luchtvochtigheid, luchtkwaliteit en beweging te meten. Het project is ideaal voor hobbyisten, onderzoekers en ontwikkelaars die op zoek zijn naar een aanpasbare IoT-oplossing.

## Functies

Met SensorCube kun je:
- Omgevingsgegevens in realtime monitoren.
- Gebruik maken van mmWave-technologie voor geavanceerde bewegingsdetectie.
- Firmware aanpassen aan jouw specifieke behoeften.
- Integreren met cloudplatforms voor geavanceerde analyses.

## Ondersteunde sensoren en componenten

- **ENS160**: Meet luchtkwaliteit, eCO2 en TVOC.
- **AHT20**: Meet temperatuur en luchtvochtigheid.
- **LD2450**: mmWave-sensor voor bewegingsdetectie en aanwezigheidssensing.
- **LED-ring**: Visuele feedback met aanpasbare lichteffecten.

## Installatie

1. **Firmware installeren**  
   Gebruik de onderstaande knop om de vooraf gebouwde firmware direct op je apparaat te installeren via USB vanuit de browser.

   <esp-web-install-button manifest="firmware/sensorcube.manifest.json"></esp-web-install-button>

   <script type="module" src="https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module"></script>

2. **Handmatige installatie**  
   Clone deze repository en pas de configuratiebestanden aan jouw behoeften aan. Gebruik vervolgens [ESPHome](https://esphome.io/) om de firmware te compileren en te uploaden.

   ```bash
   esphome run sensorcube.yaml
   ```
