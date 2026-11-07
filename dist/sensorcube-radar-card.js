// SensorCube radar card for Home Assistant dashboards.
//
// Shows the live LD2450 targets and zones from the SensorCube "Radar Data" sensor
// (components/ld2450.yaml) and lets you draw zones, which are saved through the
// "Zone N X1/Y1/X2/Y2" number entities. The map is drawn the same way as the radar map on the
// device's own web page (components/web/sensorcube.js): keep both in sync.
//
// Install with HACS (custom repository, type Dashboard) or copy this file to /config/www/ and add
// /local/sensorcube-radar-card.js as a dashboard resource (JavaScript module).
//
//   type: custom:sensorcube-radar-card
//   entity: sensor.sensorcube_radar_data  # Required: the "Radar Data" sensor (disabled by default)
//   title: Living room                     # Optional, default: the device name
//   mirror: false                          # Optional: swap left and right
//   read_only: false                       # Optional: hide the "Edit zones" button
(() => {
  const TAG = "sensorcube-radar-card";
  if (customElements.get(TAG)) return;

  const X_MAX = 4000; // Shown area: -X_MAX..X_MAX mm sideways
  const Y_MAX = 6000; // and 0..Y_MAX mm away from the radar
  const SNAP = 100; // Zone corners snap to 10 cm
  const FOV = 60; // Radar field of view: +-60 degrees
  const STEP_MS = 300; // Pause between zone values while saving: each one sends a command to the radar
  const CHECK_MS = 1500; // Wait before checking whether the radar took the new zones
  const ZONE_COLOURS = ["#2f7bd6", "#2fa84f", "#e07b24"];
  const TARGET_COLOUR = "#d63a2f";
  const COORDS = ["x1", "y1", "x2", "y2"]; // Order of a zone in "Radar Data"
  const RADAR_DATA = /^sensor\..*radar_data(_\d+)?$/;

  const STRINGS = {
    en: {
      radar: "Radar",
      edit: "Edit zones",
      zone: "Zone {n}",
      clear: "Clear zone",
      save: "Save",
      cancel: "Cancel",
      waiting: "Waiting for radar data…",
      unavailable: "The SensorCube is unavailable",
      no_entity:
        'Entity {e} not found. In Home Assistant, enable the "Radar Data" entity of the SensorCube ' +
        "(it is disabled by default) and select it in this card.",
      nobody: "Nobody detected",
      one: "1 person detected",
      many: "{n} persons detected",
      draw: "Pick a zone and drag on the map to draw it",
      unsaved: "Unsaved changes",
      saving: "Saving zones…",
      saved: "Zones saved",
      partial: "Not all zone values were saved, press Save again",
      failed: "Saving failed: {e}",
      no_numbers: "The zone entities of this SensorCube were not found, so zones can't be saved",
      zt_disabled: "Zone Type is Disabled: zones are not used",
      zt_filter: "Zone Type is Filter: people inside the zones are ignored",
      cfg_entity: "Radar Data sensor",
      cfg_title: "Title",
      cfg_mirror: "Mirror left/right",
      cfg_read_only: "Hide the Edit zones button",
    },
    nl: {
      radar: "Radar",
      edit: "Zones bewerken",
      zone: "Zone {n}",
      clear: "Zone wissen",
      save: "Opslaan",
      cancel: "Annuleren",
      waiting: "Wachten op radargegevens…",
      unavailable: "De SensorCube is niet beschikbaar",
      no_entity:
        'Entiteit {e} niet gevonden. Schakel in Home Assistant de entiteit "Radar Data" van de SensorCube in ' +
        "(die staat standaard uit) en kies hem in deze kaart.",
      nobody: "Niemand gedetecteerd",
      one: "1 persoon gedetecteerd",
      many: "{n} personen gedetecteerd",
      draw: "Kies een zone en sleep op de kaart om hem te tekenen",
      unsaved: "Niet opgeslagen wijzigingen",
      saving: "Zones opslaan…",
      saved: "Zones opgeslagen",
      partial: "Niet alle zonewaarden zijn opgeslagen, druk nogmaals op Opslaan",
      failed: "Opslaan mislukt: {e}",
      no_numbers: "De zone-entiteiten van deze SensorCube zijn niet gevonden, opslaan kan niet",
      zt_disabled: "Zone Type staat op Disabled: zones worden niet gebruikt",
      zt_filter: "Zone Type staat op Filter: personen in de zones worden genegeerd",
      cfg_entity: "Radar Data sensor",
      cfg_title: "Titel",
      cfg_mirror: "Links/rechts spiegelen",
      cfg_read_only: "Knop Zones bewerken verbergen",
    },
  };

  function translate(language, key, vars) {
    const table = STRINGS[String(language || "").slice(0, 2)] || STRINGS.en;
    let text = table[key] || STRINGS.en[key] || key;
    for (const name in vars || {}) text = text.replace("{" + name + "}", vars[name]);
    return text;
  }

  const isSet = (z) => !!z && z[0] !== z[2] && z[1] !== z[3];
  const inZone = (t, z) =>
    !!t && isSet(z) &&
    t[0] >= Math.min(z[0], z[2]) && t[0] <= Math.max(z[0], z[2]) &&
    t[1] >= Math.min(z[1], z[3]) && t[1] <= Math.max(z[1], z[3]);
  // Store corners as x1 < x2, y1 < y2; an empty zone is all zeros
  const normalise = (z) =>
    isSet(z) ? [Math.min(z[0], z[2]), Math.min(z[1], z[3]), Math.max(z[0], z[2]), Math.max(z[1], z[3])] : [0, 0, 0, 0];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // "Radar Data" state → {data} or {problem}
  // Example state: {"t":[[-520,1830],null,null],"z":[[-4000,0,0,6000],[0,0,4000,6000],[0,0,0,0]],"zt":"Detection"}
  function parse(stateObj) {
    if (!stateObj) return { problem: "no_entity" };
    if (stateObj.state === "unavailable") return { problem: "unavailable" };
    try {
      const data = JSON.parse(stateObj.state);
      if (Array.isArray(data.t) && Array.isArray(data.z) && data.z.length === 3) return { data };
    } catch (e) {
      // Not JSON yet (e.g. "unknown" right after start-up)
    }
    return { problem: "waiting" };
  }

  const STYLE = `
    :host { display: block; }
    [hidden] { display: none !important; }
    ha-card { height: 100%; box-sizing: border-box; padding: 0 16px 16px; overflow: hidden; }
    .header { display: flex; align-items: center; gap: 8px; min-height: 56px; }
    .header.empty { min-height: 16px; }
    .title {
      flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: var(--ha-card-header-font-size, 20px);
      color: var(--ha-card-header-color, var(--primary-text-color));
    }
    .tools { display: none; flex-wrap: wrap; gap: 6px; align-items: center; margin-bottom: 8px; }
    .editing .tools { display: flex; }
    .editing .edit { display: none; }
    .actions { display: flex; gap: 6px; margin-left: auto; }
    button {
      font: inherit; font-size: 13px; padding: 5px 12px; border-radius: 16px; cursor: pointer;
      border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.5));
      background: transparent; color: var(--primary-text-color);
    }
    button:disabled { opacity: 0.5; cursor: default; }
    button.primary {
      background: var(--primary-color); border-color: var(--primary-color);
      color: var(--text-primary-color, #fff);
    }
    canvas { display: block; width: 100%; aspect-ratio: 4 / 3; color: var(--primary-text-color); }
    .editing canvas { touch-action: none; cursor: crosshair; }
    .note { font-size: 12px; line-height: 1.4; min-height: 1.4em; margin-top: 6px; color: var(--secondary-text-color); }
  `;

  class SensorCubeRadarCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._data = null; // Last "Radar Data": {t: [[x, y] | null] x3, z: [[x1, y1, x2, y2]] x3, zt}
      this._problem = "waiting";
      this._editing = false;
      this._draft = null; // Zones being edited (same format as _data.z), null when unchanged
      this._active = 0; // Zone being drawn
      this._drag = null; // {start, before} while drawing
      this._busy = false; // Saving
      this._message = "";
      this._shown = [null, null, null]; // Smoothed target positions (mm)
      this._raf = 0;
      this._stateObj = null; // Last radar state object; null = not read yet (a missing entity is undefined)
    }

    setConfig(config) {
      if (!config || !config.entity) throw new Error('Set "entity" to the "Radar Data" sensor of the SensorCube');
      this._config = { mirror: false, read_only: false, ...config };
      this._stateObj = null; // Read the entity again
      this._editing = false;
      this._draft = null;
      this._message = "";
      if (!this._card) this._build();
      if (this._hass) this.hass = this._hass;
      else this._redraw();
    }

    // Home Assistant calls this on every state change: only react to the radar entity
    set hass(hass) {
      const language = hass.locale ? hass.locale.language : hass.language;
      const changed = !this._hass || language !== this._language;
      this._hass = hass;
      this._language = language;
      if (!this._config) return;
      const stateObj = hass.states[this._config.entity];
      if (stateObj === this._stateObj && !changed) return;
      this._stateObj = stateObj;
      const { data, problem } = parse(stateObj);
      this._data = data || null;
      this._problem = problem || "";
      this._redraw();
    }

    connectedCallback() {
      if (!this._card) return;
      this._resize.observe(this._canvas);
      this._redraw();
    }

    disconnectedCallback() {
      if (this._resize) this._resize.disconnect();
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = 0;
    }

    getCardSize() {
      return 8;
    }

    getGridOptions() {
      return { columns: 12, min_columns: 6 };
    }

    static getStubConfig(hass) {
      const entity = Object.keys(hass.states).find((id) => RADAR_DATA.test(id));
      return { entity: entity || "sensor.sensorcube_radar_data" };
    }

    static getConfigForm() {
      return {
        schema: [
          { name: "entity", required: true, selector: { entity: { filter: { domain: "sensor", integration: "esphome" } } } },
          { name: "title", selector: { text: {} } },
          { name: "mirror", selector: { boolean: {} } },
          { name: "read_only", selector: { boolean: {} } },
        ],
        computeLabel: (schema) => translate(document.documentElement.lang, "cfg_" + schema.name),
      };
    }

    _t(key, vars) {
      return translate(this._language, key, vars);
    }

    _build() {
      this.shadowRoot.innerHTML =
        "<style>" + STYLE + "</style>" +
        "<ha-card>" +
        '<div class="header"><div class="title"></div><button class="edit"></button></div>' +
        '<div class="tools">' +
        [0, 1, 2].map((i) => '<button data-zone="' + i + '"></button>').join("") +
        '<button data-act="clear"></button>' +
        '<span class="actions"><button data-act="cancel"></button><button data-act="save" class="primary"></button></span>' +
        "</div>" +
        "<canvas></canvas>" +
        '<div class="note"></div>' +
        "</ha-card>";
      const $ = (selector) => this.shadowRoot.querySelector(selector);
      this._card = $("ha-card");
      this._header = $(".header");
      this._title = $(".title");
      this._editButton = $(".edit");
      this._zoneButtons = [...this.shadowRoot.querySelectorAll("[data-zone]")];
      this._clearButton = $('[data-act="clear"]');
      this._cancelButton = $('[data-act="cancel"]');
      this._saveButton = $('[data-act="save"]');
      this._canvas = $("canvas");
      this._note = $(".note");

      this._editButton.addEventListener("click", () => {
        this._editing = true;
        this._draft = null;
        this._message = this._zoneEntities() ? "" : this._t("no_numbers");
        this._redraw();
      });
      this._zoneButtons.forEach((button, i) =>
        button.addEventListener("click", () => {
          this._active = i;
          this._redraw();
        })
      );
      this._clearButton.addEventListener("click", () => {
        if (!this._data || this._busy) return;
        if (!this._draft) this._draft = this._data.z.map((z) => z.slice());
        this._draft[this._active] = [0, 0, 0, 0];
        this._redraw();
      });
      this._cancelButton.addEventListener("click", () => {
        this._editing = false;
        this._draft = null;
        this._message = "";
        this._redraw();
      });
      this._saveButton.addEventListener("click", () => this._save());

      const canvas = this._canvas;
      canvas.addEventListener("pointerdown", (e) => {
        if (!this._editing || !this._data || this._busy) return;
        e.preventDefault();
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch (err) {
          // Not every pointer can be captured; drawing still works without it
        }
        if (!this._draft) this._draft = this._data.z.map((z) => z.slice());
        const p = this._toMm(e);
        this._drag = { start: p, before: this._draft[this._active].slice() };
        this._draft[this._active] = [p[0], p[1], p[0], p[1]];
        this._redraw();
      });
      canvas.addEventListener("pointermove", (e) => {
        if (!this._drag) return;
        const p = this._toMm(e);
        this._draft[this._active] = [this._drag.start[0], this._drag.start[1], p[0], p[1]];
        this._redraw();
      });
      const endDrag = () => {
        if (!this._drag) return;
        // A tap without dragging changes nothing
        if (!isSet(this._draft[this._active])) this._draft[this._active] = this._drag.before;
        this._drag = null;
        this._redraw();
      };
      canvas.addEventListener("pointerup", endDrag);
      canvas.addEventListener("pointercancel", endDrag);

      // Cards change size without a window resize (sidebar, sections, edit mode)
      this._resize = new ResizeObserver(() => this._redraw());
      if (this.isConnected) this._resize.observe(canvas);
    }

    // Entity ids of the zone numbers ([zone][x1, y1, x2, y2]) of the same device, or null.
    // ESPHome names them <device>_zone_1_x1 etc.; look them up by device so renamed devices work too.
    _zoneEntities() {
      const ids = [0, 1, 2].map((i) => COORDS.map((c) => this._findEntity("number", "zone_" + (i + 1) + "_" + c)));
      return ids.flat().every((id) => id) ? ids : null;
    }

    _findEntity(domain, suffix) {
      const hass = this._hass;
      if (!hass) return null;
      const entity = this._config.entity;
      const pattern = new RegExp("^" + domain + "\\.(.*_)?" + suffix + "(_\\d+)?$");
      const registry = hass.entities || {};
      const device = registry[entity] && registry[entity].device_id;
      if (device) {
        const found = Object.keys(registry).find((id) => registry[id].device_id === device && pattern.test(id));
        if (found) return found;
      }
      const guess = domain + "." + entity.replace(/^sensor\./, "").replace(/radar_data(_\d+)?$/, "") + suffix;
      return hass.states[guess] ? guess : null;
    }

    _titleText() {
      if (this._config.title !== undefined) return String(this._config.title || "");
      const hass = this._hass;
      const entry = hass && hass.entities && hass.entities[this._config.entity];
      const device = entry && hass.devices && hass.devices[entry.device_id];
      return (device && (device.name_by_user || device.name)) || this._t("radar");
    }

    // Screen layout: as seen when you face the front of the cube. The cube is at the top centre,
    // the room below it; negative X is on the left (verified live: a person to the left of the cube).
    _layout() {
      const w = this._canvas.clientWidth, h = this._canvas.clientHeight, pad = 18;
      const s = Math.min((w - 2 * pad) / (2 * X_MAX), (h - 2 * pad) / Y_MAX);
      return { w, h, s, cx: w / 2, ty: pad };
    }

    _toPx(L, x, y) {
      return [L.cx + (this._config.mirror ? -x : x) * L.s, L.ty + y * L.s];
    }

    _toMm(e) {
      const L = this._layout(), r = this._canvas.getBoundingClientRect();
      let x = (e.clientX - r.left - L.cx) / L.s;
      const y = (e.clientY - r.top - L.ty) / L.s;
      if (this._config.mirror) x = -x;
      const snap = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v / SNAP) * SNAP));
      return [snap(x, -X_MAX, X_MAX), snap(y, 0, Y_MAX)];
    }

    // Smooth movement between radar updates
    _redraw() {
      if (!this._raf && this._card) this._raf = requestAnimationFrame(() => this._animate());
    }

    _animate() {
      this._raf = 0;
      let moving = false;
      const t = this._data ? this._data.t : [null, null, null];
      for (let i = 0; i < 3; i++) {
        const target = t[i], shown = this._shown[i];
        if (!target) {
          this._shown[i] = null;
        } else if (!shown) {
          this._shown[i] = target.slice();
        } else {
          for (let k = 0; k < 2; k++) {
            const d = target[k] - shown[k];
            if (Math.abs(d) < 5) {
              shown[k] = target[k];
            } else {
              shown[k] += d * 0.15;
              moving = true;
            }
          }
        }
      }
      this._draw();
      this._updateUi();
      if (moving && this.isConnected) this._raf = requestAnimationFrame(() => this._animate());
    }

    _draw() {
      const canvas = this._canvas;
      const L = this._layout();
      if (!L.w || !L.h) return; // Not visible
      const dpr = window.devicePixelRatio || 1;
      canvas.width = L.w * dpr;
      canvas.height = L.h * dpr;
      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, L.w, L.h);
      const fg = getComputedStyle(canvas).color || "#888";
      const [ox, oy] = this._toPx(L, 0, 0);
      const left = L.cx - X_MAX * L.s, right = L.cx + X_MAX * L.s, top = L.ty, bottom = L.ty + Y_MAX * L.s;

      // Field of view (pointing down into the room), clipped to the shown area
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, top, right - left, bottom - top);
      ctx.clip();
      ctx.fillStyle = "rgba(127,127,127,.1)";
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      const fov = (FOV * Math.PI) / 180;
      ctx.arc(ox, oy, Math.hypot(X_MAX, Y_MAX) * L.s, Math.PI / 2 - fov, Math.PI / 2 + fov);
      ctx.closePath();
      ctx.fill();

      // Grid every metre
      ctx.strokeStyle = "rgba(127,127,127,.25)";
      ctx.lineWidth = 1;
      for (let x = -X_MAX; x <= X_MAX; x += 1000) {
        const [px] = this._toPx(L, x, 0);
        ctx.beginPath();
        ctx.moveTo(px, top);
        ctx.lineTo(px, bottom);
        ctx.stroke();
      }
      ctx.font = "11px sans-serif";
      ctx.fillStyle = fg;
      for (let y = 0; y <= Y_MAX; y += 1000) {
        const [, py] = this._toPx(L, 0, y);
        ctx.beginPath();
        ctx.moveTo(left, py);
        ctx.lineTo(right, py);
        ctx.stroke();
        if (y) ctx.fillText(y / 1000 + " m", ox + 4, py - 3);
      }
      ctx.restore();

      // Zones; a zone with a person in it is drawn stronger
      const t = this._data ? this._data.t : [null, null, null];
      const zones = this._draft || (this._data ? this._data.z : []);
      zones.forEach((z, i) => {
        if (!isSet(z)) return;
        const [x1, y1] = this._toPx(L, z[0], z[1]), [x2, y2] = this._toPx(L, z[2], z[3]);
        const zl = Math.min(x1, x2), zt = Math.min(y1, y2);
        const zw = Math.abs(x2 - x1), zh = Math.abs(y2 - y1);
        const occupied = t.some((p) => inZone(p, z));
        const editing = this._editing && i === this._active;
        ctx.fillStyle = ZONE_COLOURS[i] + (occupied ? "55" : "26");
        ctx.fillRect(zl, zt, zw, zh);
        ctx.strokeStyle = ZONE_COLOURS[i];
        ctx.lineWidth = occupied ? 3 : editing ? 2 : 1;
        ctx.setLineDash(editing ? [6, 4] : []);
        ctx.strokeRect(zl, zt, zw, zh);
        ctx.setLineDash([]);
        ctx.fillStyle = ZONE_COLOURS[i];
        ctx.font = "bold 12px sans-serif";
        ctx.fillText(this._t("zone", { n: i + 1 }), zl + 5, zt + 15);
      });

      // The cube itself, just above the edge of the map
      ctx.fillStyle = fg;
      ctx.fillRect(ox - 12, oy - 6, 24, 6);

      // People
      this._shown.forEach((p, i) => {
        if (!p) return;
        const [px, py] = this._toPx(L, p[0], p[1]);
        ctx.fillStyle = TARGET_COLOUR + "33";
        ctx.beginPath();
        ctx.arc(px, py, 16, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = TARGET_COLOUR;
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText(String(i + 1), px - 3, py + 4);
      });
    }

    _updateUi() {
      const title = this._titleText();
      const editable = !this._config.read_only;
      this._card.classList.toggle("editing", this._editing);
      this._title.textContent = title;
      this._header.classList.toggle("empty", !title && !editable);
      this._editButton.hidden = !editable;
      this._editButton.disabled = !this._data;
      this._editButton.textContent = this._t("edit");
      this._zoneButtons.forEach((button, i) => {
        const active = i === this._active;
        button.textContent = this._t("zone", { n: i + 1 });
        button.style.background = active ? ZONE_COLOURS[i] : "";
        button.style.borderColor = active ? ZONE_COLOURS[i] : "";
        button.style.color = active ? "#fff" : "";
      });
      this._clearButton.textContent = this._t("clear");
      this._cancelButton.textContent = this._t("cancel");
      this._saveButton.textContent = this._t("save");
      this._clearButton.disabled = this._busy || !this._data;
      this._cancelButton.disabled = this._busy;
      this._saveButton.disabled = this._busy || !this._draft || !this._data;

      const message = this._message ? this._message + " · " : "";
      let text;
      if (this._busy) {
        text = this._t("saving");
      } else if (this._problem) {
        text = this._t(this._problem, { e: this._config.entity });
      } else if (this._editing) {
        text = message + (this._draft ? this._t("unsaved") + " · " : "") + this._t("draw");
      } else {
        const people = this._data.t.filter((p) => p).length;
        text = message + (people === 0 ? this._t("nobody") : people === 1 ? this._t("one") : this._t("many", { n: people }));
        if (this._data.zt === "Disabled" && this._data.z.some(isSet)) text += " · " + this._t("zt_disabled");
        else if (this._data.zt === "Filter") text += " · " + this._t("zt_filter");
      }
      this._note.textContent = text;
    }

    async _save() {
      if (!this._draft || !this._data || this._busy) return;
      const ids = this._zoneEntities();
      if (!ids) {
        this._message = this._t("no_numbers");
        this._redraw();
        return;
      }
      const hass = () => this._hass; // Home Assistant replaces the hass object on every update
      const wanted = this._draft.map(normalise);
      const before = this._data.z.map((z) => z.slice());
      this._busy = true;
      this._message = "";
      this._redraw();
      try {
        for (let i = 0; i < 3; i++) {
          for (let k = 0; k < 4; k++) {
            if (wanted[i][k] === before[i][k]) continue;
            await hass().callService("number", "set_value", { entity_id: ids[i][k], value: wanted[i][k] });
            await sleep(STEP_MS); // Too fast and the radar misses a value
          }
        }
        const zoneType = this._findEntity("select", "zone_type");
        if (zoneType && this._data && this._data.zt === "Disabled" && wanted.some(isSet)) {
          await hass().callService("select", "select_option", { entity_id: zoneType, option: "Detection" });
          await sleep(STEP_MS);
        }
        const preset = this._findEntity("select", "zone_preset");
        if (preset && hass().states[preset] && hass().states[preset].state !== "Custom") {
          await hass().callService("select", "select_option", { entity_id: preset, option: "Custom" });
        }
        // Check what the radar has now (it answers with the zones it stored)
        await sleep(CHECK_MS);
        if (this._data && JSON.stringify(this._data.z) === JSON.stringify(wanted)) {
          this._draft = null;
          this._editing = false;
          this._message = this._t("saved");
        } else {
          this._message = this._t("partial");
        }
      } catch (e) {
        this._message = this._t("failed", { e: (e && e.message) || e });
      }
      this._busy = false;
      this._redraw();
    }
  }

  customElements.define(TAG, SensorCubeRadarCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: TAG,
    name: "SensorCube Radar",
    description: "Live view of the people the SensorCube radar sees, with zones you can draw.",
    preview: true,
    documentationURL: "https://github.com/Tweako/SensorCube",
  });
})();
