// Extra widgets below the ESPHome web server page (web_server js_include in network.yaml).
// ESPHome allows only one js_include, so every widget lives in this file as its own block.

// eCO2 chart: draws the "eCO2 History" text sensor (components/eco2-history.yaml).
(function () {
  const SLOT_MINUTES = 15;
  const URL = "/text_sensor/eCO2%20History";
  // eCO2 thresholds (ppm) and colours, matching the LED ring
  const BANDS = [
    [600, "#2f7bd6"],
    [800, "#2fa84f"],
    [1000, "#d6b52f"],
    [1500, "#e07b24"],
    [Infinity, "#d63a2f"],
  ];

  const box = document.createElement("div");
  box.style.cssText =
    "max-width:900px;margin:16px auto;padding:12px 16px;font-family:sans-serif;" +
    "border:1px solid rgba(127,127,127,.35);border-radius:8px;box-sizing:border-box";
  box.innerHTML =
    '<div style="font-weight:600;margin-bottom:8px">eCO2 – last 24 hours</div>' +
    '<canvas style="width:100%;height:220px;display:block"></canvas>' +
    '<div class="eco2-note" style="font-size:12px;opacity:.7;margin-top:6px"></div>';
  const canvas = box.querySelector("canvas");
  const note = box.querySelector(".eco2-note");

  function decode(text) {
    const values = [];
    for (let i = 0; i + 1 < text.length; i += 2) {
      const pair = text.substr(i, 2);
      values.push(pair === "--" ? null : parseInt(pair, 36) * 10);
    }
    return values;
  }

  function colour(ppm) {
    return BANDS.find((b) => ppm < b[0])[1];
  }

  function draw(values) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const fg = getComputedStyle(box).color || "#888";
    const known = values.filter((v) => v !== null);
    const left = 44, right = 8, top = 8, bottom = 22;
    const pw = w - left - right, ph = h - top - bottom;
    const min = 400;
    const max = Math.max(1200, ...known) * 1.05;
    const y = (v) => top + ph - ((v - min) / (max - min)) * ph;
    const x = (i) => left + (values.length < 2 ? 0 : (i / (values.length - 1)) * pw);

    // Axes and labels
    ctx.font = "11px sans-serif";
    ctx.fillStyle = fg;
    ctx.strokeStyle = "rgba(127,127,127,.25)";
    ctx.lineWidth = 1;
    for (let v = 400; v <= max; v += max > 2500 ? 1000 : 200) {
      ctx.beginPath();
      ctx.moveTo(left, y(v));
      ctx.lineTo(w - right, y(v));
      ctx.stroke();
      ctx.fillText(String(v), 4, y(v) + 4);
    }
    const hours = (values.length * SLOT_MINUTES) / 60;
    for (let hAgo = hours; hAgo >= 0; hAgo -= 6) {
      const i = values.length - 1 - (hAgo * 60) / SLOT_MINUTES;
      ctx.fillText(hAgo === 0 ? "now" : "-" + hAgo + "h", Math.min(x(Math.max(0, i)), w - 30), h - 6);
    }

    // Line segments coloured by air quality
    ctx.lineWidth = 2;
    for (let i = 1; i < values.length; i++) {
      if (values[i] === null || values[i - 1] === null) continue;
      ctx.strokeStyle = colour(values[i]);
      ctx.beginPath();
      ctx.moveTo(x(i - 1), y(values[i - 1]));
      ctx.lineTo(x(i), y(values[i]));
      ctx.stroke();
    }
    for (let i = 0; i < values.length; i++) {
      // Isolated points (no neighbours) as dots
      if (values[i] === null) continue;
      if (values[i - 1] == null && values[i + 1] == null) {
        ctx.fillStyle = colour(values[i]);
        ctx.beginPath();
        ctx.arc(x(i), y(values[i]), 2.5, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    note.textContent = known.length
      ? "One value per " + SLOT_MINUTES + " min · min " + Math.min(...known) +
        " · max " + Math.max(...known) + " ppm · stored in the device memory, empty after a restart"
      : "No values yet: the first value is stored " + SLOT_MINUTES + " minutes after start-up.";
  }

  let last = [];
  async function refresh() {
    try {
      const res = await fetch(URL);
      if (res.status === 404) {
        box.remove(); // No eCO2 history in this build
        clearInterval(timer);
      } else if (res.ok) {
        const data = await res.json();
        last = decode(data.value || data.state || "");
        draw(last);
      }
    } catch (e) {
      note.textContent = "History not available: " + e;
    }
  }

  let timer = 0;
  function start() {
    document.body.appendChild(box);
    refresh();
    timer = setInterval(refresh, 60000);
    window.addEventListener("resize", () => draw(last));
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();

// Radar map: live LD2450 targets and zones from the "Radar Data" text sensor
// (components/ld2450.yaml). Zones can be drawn with the mouse or a finger and saved to the
// radar through the "Zone N X1/Y1/X2/Y2" numbers. Coordinates are in mm: X sideways, Y distance.
// The Home Assistant dashboard card (dist/sensorcube-radar-card.js) draws the same map: keep both in sync.
(function () {
  const DATA_URL = "/text_sensor/Radar%20Data";
  const POLL_MS = 500;
  const STEP_MS = 300; // Pause between zone value requests while saving
  const X_MAX = 4000; // Shown area: -X_MAX..X_MAX sideways
  const Y_MAX = 6000; // and 0..Y_MAX away from the radar
  const SNAP = 100; // Zone corners snap to 10 cm
  const FOV = 60; // Radar field of view: +-60 degrees
  const ZONE_COLOURS = ["#2f7bd6", "#2fa84f", "#e07b24"];
  const TARGET_COLOUR = "#d63a2f";
  const MIRROR_KEY = "sensorcube-radar-mirror";
  const NO_ZONES = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];

  let data = null; // Last "Radar Data": {t: [[x, y] | null] x3, z: [[x1, y1, x2, y2]] x3, zt}
  let draft = null; // Zones being edited (same format as data.z), null when not editing
  let active = 0; // Zone being drawn
  let drag = null; // {start, before} while drawing
  let busy = false; // Saving
  let message = "";
  let mirror = false;
  try {
    mirror = localStorage.getItem(MIRROR_KEY) === "1";
  } catch (e) {}
  const shown = [null, null, null]; // Smoothed target positions (mm)

  const box = document.createElement("div");
  box.style.cssText =
    "max-width:900px;margin:16px auto;padding:12px 16px;font-family:sans-serif;" +
    "border:1px solid rgba(127,127,127,.35);border-radius:8px;box-sizing:border-box";
  const btn =
    "font:inherit;font-size:13px;padding:4px 10px;border-radius:6px;cursor:pointer;" +
    "border:1px solid rgba(127,127,127,.5);background:transparent;color:inherit";
  box.innerHTML =
    '<div style="font-weight:600;margin-bottom:8px">Radar – live view and zones</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:8px">' +
    [0, 1, 2].map((i) => '<button data-zone="' + i + '" style="' + btn + '">Zone ' + (i + 1) + "</button>").join("") +
    '<button data-act="clear" style="' + btn + '">Clear zone</button>' +
    '<button data-act="save" style="' + btn + '">Save zones</button>' +
    '<button data-act="cancel" style="' + btn + '">Cancel</button>' +
    '<label style="font-size:13px;margin-left:auto"><input type="checkbox" data-act="mirror"> Mirror left/right</label>' +
    "</div>" +
    '<canvas style="width:100%;aspect-ratio:4/3;display:block;touch-action:none;cursor:crosshair"></canvas>' +
    '<div class="radar-note" style="font-size:12px;opacity:.7;margin-top:6px"></div>';
  const canvas = box.querySelector("canvas");
  const note = box.querySelector(".radar-note");
  const zoneButtons = [...box.querySelectorAll("[data-zone]")];
  const saveButton = box.querySelector('[data-act="save"]');
  const cancelButton = box.querySelector('[data-act="cancel"]');
  const mirrorBox = box.querySelector('[data-act="mirror"]');
  mirrorBox.checked = mirror;

  const isSet = (z) => z && z[0] !== z[2] && z[1] !== z[3];
  const zones = () => draft || (data ? data.z : NO_ZONES);
  const inZone = (t, z) =>
    t && isSet(z) &&
    t[0] >= Math.min(z[0], z[2]) && t[0] <= Math.max(z[0], z[2]) &&
    t[1] >= Math.min(z[1], z[3]) && t[1] <= Math.max(z[1], z[3]);

  // Screen layout: as seen when you face the front of the cube. The cube is at the top centre,
  // the room below it; negative X is on the left (verified live: a person to the left of the cube).
  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight, pad = 18;
    const s = Math.min((w - 2 * pad) / (2 * X_MAX), (h - 2 * pad) / Y_MAX);
    return { w, h, s, cx: w / 2, ty: pad };
  }
  function toPx(L, x, y) {
    return [L.cx + (mirror ? -x : x) * L.s, L.ty + y * L.s];
  }
  function toMm(e) {
    const L = layout(), r = canvas.getBoundingClientRect();
    let x = (e.clientX - r.left - L.cx) / L.s;
    const y = (e.clientY - r.top - L.ty) / L.s;
    if (mirror) x = -x;
    const snap = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v / SNAP) * SNAP));
    return [snap(x, -X_MAX, X_MAX), snap(y, 0, Y_MAX)];
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const L = layout();
    canvas.width = L.w * dpr;
    canvas.height = L.h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, L.w, L.h);
    const fg = getComputedStyle(box).color || "#888";
    const [ox, oy] = toPx(L, 0, 0);
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
      const [px] = toPx(L, x, 0);
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, bottom);
      ctx.stroke();
    }
    ctx.font = "11px sans-serif";
    ctx.fillStyle = fg;
    for (let y = 0; y <= Y_MAX; y += 1000) {
      const [, py] = toPx(L, 0, y);
      ctx.beginPath();
      ctx.moveTo(left, py);
      ctx.lineTo(right, py);
      ctx.stroke();
      if (y) ctx.fillText(y / 1000 + " m", ox + 4, py - 3);
    }
    ctx.restore();

    // Zones; a zone with a person in it is drawn stronger
    const t = data ? data.t : [null, null, null];
    zones().forEach((z, i) => {
      if (!isSet(z)) return;
      const [x1, y1] = toPx(L, z[0], z[1]), [x2, y2] = toPx(L, z[2], z[3]);
      const zl = Math.min(x1, x2), zt = Math.min(y1, y2);
      const zw = Math.abs(x2 - x1), zh = Math.abs(y2 - y1);
      const occupied = t.some((p) => inZone(p, z));
      const editing = draft && i === active;
      ctx.fillStyle = ZONE_COLOURS[i] + (occupied ? "55" : "26");
      ctx.fillRect(zl, zt, zw, zh);
      ctx.strokeStyle = ZONE_COLOURS[i];
      ctx.lineWidth = occupied ? 3 : editing ? 2 : 1;
      ctx.setLineDash(editing ? [6, 4] : []);
      ctx.strokeRect(zl, zt, zw, zh);
      ctx.setLineDash([]);
      ctx.fillStyle = ZONE_COLOURS[i];
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("Zone " + (i + 1), zl + 5, zt + 15);
    });

    // The cube itself, just above the edge of the map
    ctx.fillStyle = fg;
    ctx.fillRect(ox - 12, oy - 6, 24, 6);

    // People
    shown.forEach((p, i) => {
      if (!p) return;
      const [px, py] = toPx(L, p[0], p[1]);
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

    updateUi();
  }

  function updateUi() {
    zoneButtons.forEach((b, i) => {
      b.style.background = i === active ? ZONE_COLOURS[i] : "transparent";
      b.style.color = i === active ? "#fff" : "inherit";
    });
    saveButton.disabled = cancelButton.disabled = !draft || busy;
    saveButton.style.opacity = cancelButton.style.opacity = saveButton.disabled ? 0.5 : 1;
    let text;
    if (!data) {
      text = message || "Waiting for radar data…";
    } else if (busy) {
      text = "Saving zones…";
    } else if (draft) {
      text = "Unsaved changes. Drag on the map to draw zone " + (active + 1) + ", then press Save zones.";
    } else {
      const people = data.t.filter((p) => p).length;
      text = (message ? message + " · " : "") +
        (people ? people + (people === 1 ? " person" : " persons") + " detected" : "Nobody detected") +
        " · pick a zone and drag on the map to draw it";
      if (data.zt === "Disabled" && data.z.some(isSet)) text += " · Zone Type is Disabled: zones are not used";
      else if (data.zt === "Filter") text += " · Zone Type is Filter: people inside the zones are ignored";
    }
    note.textContent = text;
  }

  // Smooth movement between radar updates
  let raf = 0;
  function animate() {
    raf = 0;
    let moving = false;
    const t = data ? data.t : [null, null, null];
    for (let i = 0; i < 3; i++) {
      if (!t[i]) {
        shown[i] = null;
      } else if (!shown[i]) {
        shown[i] = t[i].slice();
      } else {
        for (let k = 0; k < 2; k++) {
          const d = t[i][k] - shown[i][k];
          if (Math.abs(d) < 5) {
            shown[i][k] = t[i][k];
          } else {
            shown[i][k] += d * 0.15;
            moving = true;
          }
        }
      }
    }
    draw();
    if (moving) raf = requestAnimationFrame(animate);
  }
  const redraw = () => {
    if (!raf) raf = requestAnimationFrame(animate);
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function post(path) {
    const res = await fetch(encodeURI(path), { method: "POST", body: "" });
    if (!res.ok) throw new Error(path + ": HTTP " + res.status);
  }

  async function save() {
    if (!draft || !data) return;
    busy = true;
    message = "";
    updateUi();
    const keys = ["X1", "Y1", "X2", "Y2"];
    // Store corners as x1 < x2, y1 < y2
    const wanted = draft.map((z) =>
      isSet(z)
        ? [Math.min(z[0], z[2]), Math.min(z[1], z[3]), Math.max(z[0], z[2]), Math.max(z[1], z[3])]
        : [0, 0, 0, 0]
    );
    try {
      for (let i = 0; i < 3; i++) {
        for (let k = 0; k < 4; k++) {
          if (wanted[i][k] === data.z[i][k]) continue;
          await post("/number/Zone " + (i + 1) + " " + keys[k] + "/set?value=" + wanted[i][k]);
          await sleep(STEP_MS); // Every value sends a command to the radar; too fast and one gets lost
        }
      }
      if (data.zt === "Disabled" && wanted.some(isSet)) {
        await post("/select/Zone Type/set?option=Detection");
        await sleep(STEP_MS);
      }
      await post("/select/Zone Preset/set?option=Custom");
      // Check what the device has now
      await sleep(1000);
      const res = await fetch(DATA_URL);
      data = JSON.parse((await res.json()).value);
      if (JSON.stringify(data.z) === JSON.stringify(wanted)) {
        draft = null;
        message = "Zones saved";
      } else {
        message = "Not all zone values were saved, press Save zones again";
      }
    } catch (e) {
      message = "Saving failed: " + e.message;
    }
    busy = false;
    redraw();
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!data || busy) return;
    canvas.setPointerCapture(e.pointerId);
    if (!draft) draft = data.z.map((z) => z.slice());
    const p = toMm(e);
    drag = { start: p, before: draft[active].slice() };
    draft[active] = [p[0], p[1], p[0], p[1]];
    redraw();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = toMm(e);
    draft[active] = [drag.start[0], drag.start[1], p[0], p[1]];
    redraw();
  });
  const endDrag = () => {
    if (!drag) return;
    if (!isSet(draft[active])) draft[active] = drag.before; // A click without dragging changes nothing
    drag = null;
    redraw();
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  zoneButtons.forEach((b, i) =>
    b.addEventListener("click", () => {
      active = i;
      redraw();
    })
  );
  box.querySelector('[data-act="clear"]').addEventListener("click", () => {
    if (!data || busy) return;
    if (!draft) draft = data.z.map((z) => z.slice());
    draft[active] = [0, 0, 0, 0];
    redraw();
  });
  cancelButton.addEventListener("click", () => {
    draft = null;
    redraw();
  });
  saveButton.addEventListener("click", save);
  mirrorBox.addEventListener("change", () => {
    mirror = mirrorBox.checked;
    try {
      localStorage.setItem(MIRROR_KEY, mirror ? "1" : "0");
    } catch (e) {}
    redraw();
  });

  let polling = false;
  let timer = 0;
  async function refresh() {
    if (polling || busy || document.hidden) return;
    polling = true;
    try {
      const res = await fetch(DATA_URL);
      if (res.status === 404) {
        box.remove(); // No radar in this build
        clearInterval(timer);
      } else if (res.ok) {
        const json = await res.json();
        const text = json.value || json.state || "";
        if (text) {
          data = JSON.parse(text);
          message = message.startsWith("Radar data") ? "" : message;
          redraw();
        }
      }
    } catch (e) {
      message = "Radar data not available: " + e;
      updateUi();
    }
    polling = false;
  }

  function start() {
    document.body.appendChild(box);
    draw();
    refresh();
    timer = setInterval(refresh, POLL_MS);
    window.addEventListener("resize", redraw);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
