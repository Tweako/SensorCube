# SensorCube AI Coding Guidelines

## Project Overview
**SensorCube** is an ESPHome-based IoT environmental monitoring device using ESP32-C3. It integrates multiple sensors (temperature, humidity, air quality, motion, light) and provides visual feedback via a configurable LED ring. The codebase is organized as modular YAML configuration files rather than traditional code.

## Architecture & Key Components

### Configuration Structure
- **Root configs** (`sensorcube.yaml`, `sensorcube-rc.yaml`, `sensorcube.factory.yaml`): Enable/disable components via `packages:` includes
- **Modular components** (in `components/`): Self-contained sensor/feature configs that can be mixed-and-matched
  - `sensorcube-base.yaml`: Core ESP32 setup (GPIO, I2C, logging, buttons)
  - `network.yaml`: WiFi, API, OTA, web server, time sync
  - `ens160.yaml`: Air quality with AHT20 temperature compensation
  - `ld2450.yaml`: mmWave motion detection with configurable zones
  - `led-air-quality.yaml`: Intelligent LED color/brightness based on eCO2 + ambient light
  - `dht22.yaml`, `ledring.yaml`, `ldr.yaml`: Individual sensors/actuators

### Critical Data Flows
1. **Sensor readings** → ESPHome platform (every 60s by default)
2. **eCO2 → LED feedback**: `led-air-quality.yaml` monitors `ens160_eco2` sensor and updates `led_ring` colors based on CO2 thresholds
3. **Home Assistant integration**: Native ESPHome API with entity discovery
4. **OTA updates**: Via GitHub Releases manifest (see `publish-firmware.yml`)

### Sensor Integration Patterns
- **Filtering**: All sensors use `filters:` with `offset`, `sliding_window_moving_average`, and `lambda:` sanity checks
  - DHT22: ±1°C offset, 5-sample window, rejects values outside -40..80°C range
  - ENS160: -100 ppm eCO2 offset (calibration vs SCD40), 15-sample window
  - AHT20: Temperature/humidity offsets account for ENS160 heat dissipation
- **Compensation**: ENS160 uses AHT20 for temperature/humidity compensation
- **Thresholds**: Configurable via `substitutions:` for easy adjustment (see `led-air-quality.yaml`)

## Development Workflows

### Local Building & Testing
```bash
# Build all firmware variants (used in CI)
esphome compile sensorcube.factory.yaml
esphome compile sensorcube-aq.factory.yaml
esphome compile sensorcube-rc.factory.yaml

# Upload to device with automatic OTA
esphome run sensorcube.yaml
```

### Creating New Components
1. Create new `.yaml` file in `components/`
2. Define `substitutions:` at top for configurable values
3. Add platform configs (sensor, binary_sensor, light, etc.)
4. Include in main config via `packages:` (commented by default)
5. Test via `esphome run` before committing

### Release & CI Process
- Tag releases with version (e.g., `v1.1.1`)
- GitHub Actions builds all `.factory.yaml` variants via ESPHome workflow
- Firmware manifests uploaded to release for OTA updates
- See `.github/workflows/publish-firmware.yml` for exact config

## Project Conventions

### Naming & IDs
- Entity `name:` in user-friendly Dutch (e.g., "Luchtkwaliteit Index")
- Internal `id:` in snake_case English (e.g., `ens160_aqi`)
- GPIO pins hardcoded in `sensorcube-base.yaml`: GPIO6=SDA, GPIO7=SCL, GPIO5=DHT22, GPIO20/21=LD2450 UART

### Configuration Philosophy
- **Substitutions over hardcoding**: All thresholds, offsets, timeouts configurable
- **Modular over monolithic**: Each sensor/feature in separate file (avoid mega configs)
- **Disabled by default**: Diagnostic/advanced features use `disabled_by_default: true`
- **Safe by default**: Factory reset buttons, safe mode, internal temp sensors

### LED Air Quality Logic
- **Color thresholds** (configurable): Excellent <600 ppm → Blue, Good <800 → Green, Fair <1000 → Yellow, Poor <1500 → Orange, Bad ≥1500 → Red pulsing
- **Brightness**: Calculated from ambient light (LDR sensor) scaled to 5-50% range
- **Fallback**: Rainbow spinner effect if eCO2 value unavailable (WiFi/sensor error)

### Entity Categorization
- `entity_category: diagnostic`: WiFi signal, uptime, device restart buttons
- `entity_category: ""` (empty): Primary sensor data visible in Home Assistant UI
- `hidden_by_default: true`: Advanced LD2450 configuration, firmware versions

## File Dependencies & Cross-Component References
- `ens160.yaml` requires `id_temperature_sensor` and `id_humidity_sensor` from `dht22.yaml` or `aht10` for compensation
- `led-air-quality.yaml` requires `ens160_eco2` and `illuminance` IDs, and `led_ring` light entity
- `ld2450.yaml` can work standalone; provides motion/presence for automations
- `network.yaml` provides `time_homeassistant` ID used by `network.yaml` itself for uptime calculation

## Debugging & Logging
- Default log level: `DEBUG` for LD2450, `INFO` for UART
- Adjust in `sensorcube-base.yaml` `logger:` section
- Key IDs to monitor: `ens160_eco2`, `illuminance`, `dht22_temperature`, `led_ring`
- Use lambda `ESP_LOGW()` for sensor sanity check violations (e.g., "eCO2 waarde zeer hoog")
