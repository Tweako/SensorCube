// Draws the "eCO2 History" text sensor (components/eco2-history.yaml) as a chart
// below the ESPHome web server page.
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
      if (res.ok) {
        const data = await res.json();
        last = decode(data.value || data.state || "");
        draw(last);
      }
    } catch (e) {
      note.textContent = "History not available: " + e;
    }
  }

  function start() {
    document.body.appendChild(box);
    refresh();
    setInterval(refresh, 60000);
    window.addEventListener("resize", () => draw(last));
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
