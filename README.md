# SensorCube

SensorCube is een open-source project ontworpen om omgevingsmonitoring te vereenvoudigen. Het combineert hardware en software om parameters zoals temperatuur, luchtvochtigheid, luchtkwaliteit en beweging te meten. Het project is ideaal voor hobbyisten, onderzoekers en ontwikkelaars die op zoek zijn naar een aanpasbare IoT-oplossing.

## Functies

Met SensorCube kun je:
- Omgevingsgegevens in realtime monitoren.
- Gebruik maken van mmWave-technologie voor geavanceerde bewegingsdetectie.
- Firmware aanpassen aan jouw specifieke behoeften.
- Integreren met cloudplatforms voor geavanceerde analyses.

## Ondersteunde sensoren en componenten

- **DHT22**: Meet temperatuur en luchtvochtigheid.
- **ENS160**: Meet luchtkwaliteit, eCO2 en TVOC.
- **AHT20**: Compenseer eCO2 met temperatuur en luchtvochtigheid.
- **TEMT6000**: Meet lichtintensiteit en regelt automatisch lichtintensiteit.
- **LD2450**: mmWave-sensor voor bewegingsdetectie en aanwezigheidssensing.
- **Neopixel-ring**: Visuele feedback met aanpasbare lichteffecten.

## Installatie

1. **Firmware installeren**  
Bezoek de [officiële installatiepagina](https://tweako.github.io/SensorCube/) voor gedetailleerde instructies en downloads.

2. **Handmatige installatie**  
   Clone deze repository en pas de configuratiebestanden aan jouw behoeften aan. Gebruik vervolgens [ESPHome](https://esphome.io/) om de firmware te compileren en te uploaden.

   ```bash
   esphome run sensorcube.yaml
   ```
