# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project overview

**SensorCube** is an ESPHome firmware for an ESP32-C3 (`esp32-c3-devkitm-1`, ESP-IDF framework) environmental monitor. It measures temperature, humidity, air quality (eCO2/TVOC/AQI), light level and mmWave presence, and shows air quality on a WS2812 LED ring. It integrates with Home Assistant via the native ESPHome API.

There is no application code in the traditional sense: the project is **modular ESPHome YAML**, with C++ only inside `lambda:` blocks.

## Repository layout

| Path | Purpose |
|---|---|
| `sensorcube.yaml` | Main config. Defines root `substitutions`, `esphome.project.version`, includes every component via `packages:`, and the `update:` (HTTP manifest) entity. |
| `sensorcube.factory.yaml` | Factory/provisioning build. Includes `sensorcube.yaml` as a package and adds `improv_serial`, `dashboard_import`, logger baud `115200`, project version `dev`. This is the file built for releases. |
| `components/sensorcube-base.yaml` | ESP32 board, logger, I2C bus (GPIO6 SDA / GPIO7 SCL), `esp_uptime`, ESPHome version, restart/factory reset/safe mode buttons. |
| `components/network.yaml` | WiFi + AP + captive portal, API, `http_request`, OTA (esphome + http_request), web server v3, time (Home Assistant + SNTP fallback), "Online since" sensor. |
| `components/dht22.yaml` | DHT22/AM2302 temperature & humidity (GPIO5). |
| `components/ens160.yaml` | ENS160 air quality (I2C `0x53`) + AHT20 (I2C `0x38`) used as compensation sensor, plus an "Air Quality" text sensor. |
| `components/ld2450.yaml` | LD2450 mmWave radar on UART (TX GPIO20 / RX GPIO21, 256000 baud), zones, counts, targets. |
| `components/ldr.yaml` | TEMT6000/LDR on ADC GPIO0 (`attenuation: auto`) → lux (gamma corrected), light percentage, daylight binary sensor with configurable threshold. |
| `components/ledring.yaml` | `led_ring` light (WS2812, GPIO4, `${num_leds}` LEDs) and all effects; boot animation. |
| `components/led-air-quality.yaml` | Script + interval that drive `led_ring` from eCO2, ambient light and WiFi state; "LED Air Quality Indicator" switch. |
| `components/diagnostics.yaml` | WiFi signal, ESP32 internal temperature, status binary sensor. |
| `static/` | Jekyll site for GitHub Pages (ESP Web Tools installer). |
| `.github/workflows/` | CI, firmware release, Pages publishing. |

## Build & test

ESPHome CLI is required (`pip install esphome`).

```bash
# Validate config only (fast, no toolchain build)
esphome config sensorcube.yaml
esphome config sensorcube.factory.yaml

# Full compile - this is what CI runs; both must succeed
esphome compile sensorcube.yaml
esphome compile sensorcube.factory.yaml

# Flash / OTA to a device
esphome run sensorcube.yaml
```

Always run at least `esphome config` on **both** root files after changing anything under `components/`, because the factory build layers on top of the main config.

## CI / release

- **`ci.yml`** (pull requests touching root `*.yaml` or `components/**`): builds `sensorcube.yaml` and `sensorcube.factory.yaml` with ESPHome `stable` via `esphome/build-action`.
- **`publish-firmware.yml`** (on GitHub Release published): builds `sensorcube.factory.yaml` with a pinned ESPHome version via `esphome/workflows`, uploads binaries + `SensorCube.manifest.json` (named after `combined-name`) to the release. The workflow replaces `version: dev` in the factory file with the release tag, so the published firmware reports the tag as its version. Keep the factory file's `version: dev` line as-is.
- **`publish-pages.yml`**: builds `static/` with Jekyll, downloads the latest release assets into `firmware/`, deploys to GitHub Pages (also triggered after Publish Firmware completes).
- Devices update via the `update:` http_request entity pointing at `releases/latest/download/SensorCube.manifest.json`; the web installer in `static/index.md` loads `firmware/SensorCube.manifest.json`. GitHub Pages is case-sensitive, so keep these names in sync with `combined-name`.
- `http_request.buffer_size_tx: 2048` is required: GitHub redirects release downloads to a ~1.5 kB signed URL.
- Releasing: bump `esphome.project.version` in `sensorcube.yaml` (used for local builds), then publish a GitHub Release with a matching tag (e.g. `v1.2.0`).
- When bumping the ESPHome version in `publish-firmware.yml`, also bump the `esphome/workflows` tag and test locally with the same ESPHome version.
- Dependabot keeps GitHub Actions versions up to date; keep actions pinned to explicit versions.

## Conventions

### Configuration style
- **One feature per file** in `components/`; wire it up with a `packages:` entry in `sensorcube.yaml` (`<name>: !include components/<file>.yaml`).
- **Substitutions over hardcoding**: put tunables (pins, intervals, offsets, thresholds, I2C addresses) in a `substitutions:` block at the top of the component, with an inline comment explaining the value. Prefix them with the component name (e.g. `dht22_temp_offset`, `ens160_eco2_window_size`).
- Root-level substitutions defined in `sensorcube.yaml` and used by components: `name`, `friendly_name`, `num_leds`, `log_level`, `logger_baud_rate`. Do not redefine these in components.
- Each component file starts with a short `#` comment describing what it does.
- File names use kebab-case (`led-air-quality.yaml`, `sensorcube-base.yaml`).

### Naming
- Entity `name:` values are **English**, title-ish case (e.g. `"Air Quality Index"`, `"Light Level"`, `"Restart device"`).
- Internal `id:` values are **snake_case English**, typically prefixed with the sensor (e.g. `ens160_eco2`, `dht22_temperature`, `led_ring`).
- Code comments and `ESP_LOG*` messages are in English. The `README.md` is written in Dutch; keep it Dutch when updating it.

### Sensor filtering pattern
Sensors follow this filter chain:
1. `offset:` for calibration (via substitution),
2. `sliding_window_moving_average:` for smoothing,
3. `lambda:` sanity check that logs with `ESP_LOGW("<component>", ...)` and returns `{}` (drop) or a clamped value.

Current calibration values (keep the explaining comments when changing them):
- DHT22 temperature: offset `-1`, window 5 / send every 15; valid range -40..80 °C; humidity 0..100 %.
- ENS160 eCO2: offset `-100` ppm (calibrated against a Sensirion SCD40), window 15; clamped to 0..65000. The ENS160 never reports below 400 ppm, so clean air shows as 300 ppm.
- AHT20: temperature offset `-7`, humidity offset `+5` to compensate for ENS160 self-heating.

### Entity categorisation
- `entity_category: diagnostic` for WiFi signal, status, uptime/"Online since", restart/factory reset/safe mode buttons.
- `entity_category: config` for user-tunable numbers (e.g. "Daylight Threshold").
- No `entity_category` for primary measurements and for "Ventilation Needed" (ON at ≥ "Ventilation Threshold", OFF below threshold − `ventilation_hysteresis`).
- `entity_category: config` also for the "LED Air Quality Indicator" switch.
- `disabled_by_default: true` for advanced or risky entities (factory reset, safe mode, ESP32 temperature, LD2450 firmware/BT MAC, LD2450 Bluetooth).
- `internal: true` for helper sensors that should not be exposed (AHT20 compensation sensors).

### Hardware / GPIO map
Pins are defined in the component that uses them, not centrally:

```
GPIO0  - LDR / TEMT6000 (ADC)         components/ldr.yaml (substitution ldr_pin)
GPIO4  - WS2812 LED ring              components/ledring.yaml
GPIO5  - DHT22 data                   components/dht22.yaml (substitution dht22_pin)
GPIO6  - I2C SDA (ENS160, AHT20)      components/sensorcube-base.yaml
GPIO7  - I2C SCL (ENS160, AHT20)      components/sensorcube-base.yaml
GPIO20 - LD2450 UART TX               components/ld2450.yaml
GPIO21 - LD2450 UART RX               components/ld2450.yaml
```

Do not reassign pins without being asked: they reflect the physical PCB.

## Cross-component dependencies

Check these before removing or renaming IDs or packages:

- `led-air-quality.yaml` needs `ens160_eco2` (ens160), `illuminance` (ldr), `led_ring` and its "No WiFi Indicator" effect (ledring), and the `wifi` component.
- `ens160.yaml` is self-contained: compensation uses `id_temperature_sensor` / `id_humidity_sensor` from the AHT20 defined in the same file (not the DHT22).
- `network.yaml`'s `uptime_timestamp` ("Online since") is updated from the `on_time_sync` of both `time_homeassistant` and `time_sntp`, and computed once per boot.
- `ledring.yaml` needs the root substitution `num_leds`.
- `sensorcube-base.yaml` needs root substitutions `friendly_name`, `log_level`, `logger_baud_rate`.
- `led-air-quality.yaml` also needs `ld2450_presence` (ld2450) for night mode.
- `ens160.yaml`'s "Ventilation Needed" uses `ens160_eco2` and the `ventilation_threshold` number from the same file.
- `ld2450.yaml` and `diagnostics.yaml` don't depend on other components.

## LED air quality behaviour

`led-air-quality.yaml` runs the `led_aq_update` script every `led_aq_check_interval` (2 s). It works out a state and only calls `led_ring` when the state or brightness changes. That way a manual change from Home Assistant stays until the air quality changes.
- eCO2 unavailable → "Rainbow Spinner" (online) or dim yellow "Pulse" (offline).
- No WiFi but valid eCO2 → air quality colour with the first and last LED blinking yellow ("No WiFi Indicator" effect; red Pulse/Strobe are not shown while offline).
- `< eco2_excellent` (600) blue, `< eco2_good` (800) green, `< eco2_fair` (1000) yellow, `< eco2_poor` (1500) orange, `< eco2_bad` (65000) red + "Pulse", otherwise red + "Strobe".
- Brightness = `illuminance / lux_scale_factor * brightness_max + brightness_min`, clamped to `[brightness_min, brightness_max]` (falls back to `brightness_min` if illuminance is unavailable).
- The `led_aq_enabled` switch ("LED Air Quality Indicator", restored, default on) turns the automation off and switches the ring off. After that the ring is fully under manual control.
- eCO2 thresholds and min/max brightness are template `number` entities ("LED Threshold …", "LED Brightness Min/Max", category config, restored); the substitutions are only their initial values. Changing one forces a refresh.
- Night mode ("LED Night Mode" switch, default on): ring off when illuminance < "LED Night Light Level" (back on above it + `led_night_lux_hysteresis`), or when `ld2450_presence` has been off for "LED Off Without Presence" minutes (0 = disabled). The LED ring does not measurably affect the LDR reading (tested).
- On boot `ledring.yaml` shows a blue "Scan" effect; the interval has a `startup_delay` (10 s), and its first run always applies the state. Don't call `led_aq_update` from the switch's `on_turn_on`: that also fires on restore during setup, before `on_boot`.
- Note: eCO2 (window 15 × 60 s) and DHT22 temperature (send every 15 × 60 s) are block-averaged, so they publish roughly every 15 minutes.

Effect names used in logic (`"Rainbow Spinner"`, `"Pulse"`, `"Strobe"`, `"Scan"`, `"No WiFi Indicator"`, `"None"`) must exist in `ledring.yaml`; keep them in sync when renaming effects.

## Logging & debugging

- Log level comes from the `log_level` substitution (default `INFO`) in `sensorcube.yaml`.
- UART logging is disabled (`logger_baud_rate: "0"`) in the main build; the factory build sets `115200` (needed for `improv_serial`). Use the API/web logs for the main build.
- Useful IDs to watch: `ens160_eco2`, `illuminance`, `dht22_temperature`, `led_ring`.
- `ldr.yaml` logs voltage → lux conversion at `ESP_LOGD` level.
- Since ESPHome 2026.x, sensor state changes are only logged at `VERBOSE`. Build a test firmware with `esphome -s log_level VERBOSE run ...` instead of changing the YAML. **VERBOSE logs print the WiFi password**, so don't share or commit them.

## Live testing on a device

- **Windows:** run ESPHome from PowerShell or cmd, not Git Bash/MSYS. ESP-IDF refuses to build under MSYS (`MSys/Mingw is not supported`).
- The ESP32-C3 uses native USB (VID 303A). Flash with `esphome run sensorcube.factory.yaml --device COMx`. The factory build logs over USB at 115200; the main build doesn't log over USB at all.
- Opening the serial port can reset the C3. Repeated quick resets count towards safe mode (10 boots shorter than 1 minute), so let the device run at least a minute between resets.
- The web server REST API addresses entities **by name**, e.g. `GET http://<ip>/sensor/eCO2`, `GET http://<ip>/light/LED%20ring`. POSTs need a body/Content-Length: `curl -X POST -d '' "http://<ip>/switch/LED%20Air%20Quality%20Indicator/turn_off"`.
- The ENS160 needs a few minutes of warm-up after boot before eCO2/TVOC/AQI have values (the LED shows the rainbow until then).
- Restored states (e.g. switches) are written to flash only every `flash_write_interval` (120 min) or on a clean restart (Restart button). A hard reset or power cut can lose recent changes.

## Adding a new component

1. Create `components/<feature>.yaml` with a header comment and a `substitutions:` block for its tunables.
2. Add the platform configs following the naming, filtering and categorisation conventions above.
3. Add a `packages:` entry in `sensorcube.yaml`.
4. Run `esphome config` (and ideally `esphome compile`) for both `sensorcube.yaml` and `sensorcube.factory.yaml`.
5. Update the component list / GPIO map in `README.md` (Dutch) and in this file.

## Safety

- Keep `safe_mode`, the restart/factory reset buttons and OTA configured; removing them can brick field devices that update via OTA.
- `preferences.flash_write_interval` is intentionally `120min` to limit flash wear; don't lower it without reason.
- Never commit WiFi credentials or API/OTA secrets; provisioning happens via captive portal / improv.
