/* ==========================================================================
   server.js — serve la web app statica e uno stato condiviso tra dispositivi
   (prima l'app salvava solo in localStorage del browser: ogni dispositivo
   vedeva dati diversi). Lo stato vive in un file JSON su un volume Railway
   persistente montato su STATE_DIR (default /data), cosi' sopravvive ai
   redeploy. In locale, se /data non e' scrivibile, si usa ./data.
   (Volume /data collegato su Railway — verificato con redeploy di prova.)
   ========================================================================== */
const express = require("express");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const PRIMARY_DIR = process.env.STATE_DIR || "/data";
const FALLBACK_DIR = path.join(__dirname, "data");

function pickStateDir() {
  try {
    fs.mkdirSync(PRIMARY_DIR, { recursive: true });
    fs.accessSync(PRIMARY_DIR, fs.constants.W_OK);
    return PRIMARY_DIR;
  } catch (e) {
    console.warn(`[state] "${PRIMARY_DIR}" non scrivibile (${e.code}); uso "${FALLBACK_DIR}" (non persistente tra i deploy senza volume).`);
    fs.mkdirSync(FALLBACK_DIR, { recursive: true });
    return FALLBACK_DIR;
  }
}

const STATE_DIR = pickStateDir();
const STATE_FILE = path.join(STATE_DIR, "state.json");

function readState() {
  try {
    return fs.readFileSync(STATE_FILE, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") return null;
    throw e;
  }
}

function writeStateAtomic(raw) {
  const tmp = STATE_FILE + ".tmp";
  fs.writeFileSync(tmp, raw, "utf8");
  fs.renameSync(tmp, STATE_FILE);
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/state", (req, res) => {
  const raw = readState();
  if (raw === null) return res.status(404).json({ error: "not_found" });
  res.type("application/json").send(raw);
});

app.put("/api/state", (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || !body.parametri) {
    return res.status(400).json({ error: "invalid_state" });
  }
  writeStateAtomic(JSON.stringify(body));
  res.json({ ok: true });
});

app.use(express.static(__dirname, {
  index: "index.html",
  setHeaders: (res) => res.setHeader("Cache-Control", "no-cache"),
}));

app.listen(PORT, () => {
  console.log(`fotovoltaico-webapp in ascolto sulla porta ${PORT} (stato in ${STATE_FILE})`);
});
