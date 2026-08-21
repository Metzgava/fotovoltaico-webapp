/* ==========================================================================
   app.js — stato, persistenza, rendering UI e grafici
   ========================================================================== */

const API_STATE_URL = "/api/state";

/* -------------------------------------------------------------------------
   Parametri: default + note descrittive (riprese dal foglio "Parametri")
   ------------------------------------------------------------------------- */
const PARAM_FIELDS = [
  { key: "annoSolareIniziale", label: "Anno solare iniziale", hint: "Primo anno di esercizio dell'impianto", step: 1, int: true },
  { key: "costoIniziale", label: "Costo iniziale impianto (€)", hint: "Costo totale lordo di acquisto e installazione", step: 1 },
  { key: "pctDetrazione", label: "% Contributo / detrazione fiscale", hint: "Percentuale del costo rimborsata tramite detrazione fiscale", pct: true },
  { key: "numRateDetrazione", label: "Numero rate detrazione (anni)", hint: "Numero di anni su cui è spalmata la detrazione", step: 1, int: true },
  { key: "producibilitaAnnuaNominale", label: "Producibilità annua nominale (kWh)", hint: "Producibilità attesa dichiarata; usata anche come ipotesi per gli anni “Stima”", step: 1 },
  { key: "durataAnalisi", label: "Durata analisi (anni)", hint: "Numero di anni coperti dall'analisi di ammortamento", step: 1, int: true },
  { key: "autoconsumoStima", label: "Autoconsumo annuo ipotizzato per anni “Stima” (kWh)", hint: "Ipotesi usata per gli anni non ancora inseriti", step: 1 },
  { key: "immissioneStima", label: "Immissione in rete annua ipotizzata per anni “Stima” (kWh)", hint: "Ipotesi usata per gli anni non ancora inseriti", step: 1 },
  { key: "costoMercatoStima", label: "Costo €/kWh di mercato ipotizzato per anni “Stima”", hint: "Prezzo unitario dell'energia (IVA esclusa) per gli anni non ancora inseriti", step: 0.001 },
  { key: "consumoStima", label: "Consumo annuo ipotizzato per costo virtuale — anni “Stima” (kWh)", hint: "Consumo domestico totale ipotizzato per il costo virtuale senza impianto", step: 1 },
  { key: "pctIvaStima", label: "% IVA sul costo virtuale ipotizzato (anni “Stima”)", hint: "Applicata al consumo ipotizzato, oltre al prezzo €/kWh", pct: true },
];

function defaultParametri() {
  return {
    annoSolareIniziale: 2026,
    costoIniziale: 24200,
    pctDetrazione: 0.5,
    numRateDetrazione: 10,
    producibilitaAnnuaNominale: 12000,
    durataAnalisi: 25,
    autoconsumoStima: 8000,
    immissioneStima: 4000,
    costoMercatoStima: 0.25,
    consumoStima: 9000,
    pctIvaStima: 0.22,
  };
}

function deriveParametri(p) {
  const importoDetrazione = round2(p.costoIniziale * p.pctDetrazione);
  const rataAnnuaDetrazione = p.numRateDetrazione ? round2(importoDetrazione / p.numRateDetrazione) : 0;
  const costoNettoInvestimento = round2(p.costoIniziale - importoDetrazione);
  return { ...p, importoDetrazione, rataAnnuaDetrazione, costoNettoInvestimento };
}

/* -------------------------------------------------------------------------
   Dati di partenza (seed) — dati reali già inseriti nel file originale
   ------------------------------------------------------------------------- */
function buildSeedState() {
  const state = { parametri: defaultParametri(), datiMensili: {}, bollette: {}, manutenzione: {} };

  const anno1Mesi = {
    1: { kwhProdotti: 473, kwhAutoconsumo: 433, kwhCeduti: 40, kwhPrelevati: 342, costoKwh: 0.208, contributoGse: 5.24 },
    2: { kwhProdotti: 561, kwhAutoconsumo: 397, kwhCeduti: 165, kwhPrelevati: 207, costoKwh: 0.208, contributoGse: 22.55 },
    3: { kwhProdotti: 1120, kwhAutoconsumo: 600, kwhCeduti: 525, kwhPrelevati: 33, costoKwh: 0.208, contributoGse: 63.41 },
    4: { kwhProdotti: 1490, kwhAutoconsumo: 633, kwhCeduti: 861, kwhPrelevati: 35, costoKwh: 0.208, contributoGse: 62.66 },
    5: { kwhProdotti: 1700, kwhAutoconsumo: 592, kwhCeduti: 1110, kwhPrelevati: 29, costoKwh: 0.202, contributoGse: 73.03 },
    6: { kwhProdotti: 1810, kwhAutoconsumo: 698, kwhCeduti: 1120, kwhPrelevati: 29, costoKwh: 0.202, contributoGse: 0 },
    7: { kwhProdotti: 0, kwhAutoconsumo: 0, kwhCeduti: 0, kwhPrelevati: 0, costoKwh: 0.202, contributoGse: 0 },
    8: { kwhProdotti: 0, kwhAutoconsumo: 0, kwhCeduti: 0, kwhPrelevati: 0, costoKwh: 0.202, contributoGse: 0 },
    9: { kwhProdotti: 0, kwhAutoconsumo: 0, kwhCeduti: 0, kwhPrelevati: 0, costoKwh: 0.202, contributoGse: 0 },
    10: { kwhProdotti: 0, kwhAutoconsumo: 0, kwhCeduti: 0, kwhPrelevati: 0, costoKwh: 0.202, contributoGse: 0 },
    11: { kwhProdotti: 0, kwhAutoconsumo: 0, kwhCeduti: 0, kwhPrelevati: 0, costoKwh: 0.202, contributoGse: 0 },
    12: { kwhProdotti: 0, kwhAutoconsumo: 0, kwhCeduti: 0, kwhPrelevati: 0, costoKwh: 0.202, contributoGse: 0 },
  };
  state.datiMensili[1] = anno1Mesi;

  state.bollette[1] = {
    1: { costoEnergia: 0, speseGestione: 0, oneriSistema: 0, iva: 0 },
    2: { costoEnergia: 16, speseGestione: 19, oneriSistema: 0, iva: 5 },
    3: { costoEnergia: 12, speseGestione: 19, oneriSistema: 0, iva: 5 },
    4: { costoEnergia: 0, speseGestione: 0, oneriSistema: 0, iva: 0 },
    5: { costoEnergia: 0, speseGestione: 0, oneriSistema: 0, iva: 0 },
    6: { costoEnergia: 0, speseGestione: 0, oneriSistema: 0, iva: 0 },
  };

  state.manutenzione[1] = 0;

  return state;
}

/* -------------------------------------------------------------------------
   Persistenza
   ------------------------------------------------------------------------- */
let state = null;

/* Stato condiviso via server (non piu' per-browser): tutti i dispositivi
   leggono/scrivono lo stesso /api/state, salvato su volume persistente. */
const LEGACY_LOCALSTORAGE_KEY = "fv_webapp_state_v1"; // usata dalla vecchia versione solo-browser

function readLegacyLocalState() {
  try {
    const raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.parametri ? parsed : null;
  } catch (e) { return null; }
}

// Una tantum: prima che il costo €/kWh diventasse un campo sovrascrivibile,
// era un input manuale sempre valorizzato (anche col vecchio calcolo). Quei
// valori sono rimasti nei dati salvati e verrebbero ora riletti come
// sovrascritture volute dall'utente, falsando i calcoli in silenzio. Li
// azzero una sola volta, cosi' il prezzo torna a essere quello derivato
// dalla bolletta finche' l'utente non inserisce davvero un valore nuovo.
function stripCostoKwhLegacy(s) {
  if (!s || s._costoKwhMigrato) return s;
  const mensili = s.datiMensili || {};
  for (const anno of Object.keys(mensili)) {
    const mesi = mensili[anno] || {};
    for (const k of Object.keys(mesi)) {
      if (mesi[k] && "costoKwh" in mesi[k]) delete mesi[k].costoKwh;
    }
  }
  s._costoKwhMigrato = true;
  return s;
}

async function loadState() {
  try {
    const res = await fetch(API_STATE_URL);
    if (res.ok) {
      const parsed = await res.json();
      if (parsed && parsed.parametri) {
        if (!parsed._costoKwhMigrato) {
          stripCostoKwhLegacy(parsed);
          try { await putState(parsed); } catch (e) { /* riprovera' al prossimo salvataggio */ }
        }
        return parsed;
      }
    }
  } catch (e) { /* server irraggiungibile: ricade sul seed */ }
  // Il server non ha ancora nulla: se questo browser ha dati della vecchia
  // versione solo-locale, li uso come base (una tantum) invece di ripartire
  // dal seed, cosi' non si perdono le modifiche gia' fatte su questo dispositivo.
  const legacy = readLegacyLocalState();
  const seed = legacy || buildSeedState();
  stripCostoKwhLegacy(seed);
  try {
    await putState(seed);
    if (legacy) toast("Dati locali di questo browser migrati sul server condiviso");
  } catch (e) { /* il prossimo salvataggio riprovera' */ }
  return seed;
}

async function putState(s) {
  const res = await fetch(API_STATE_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  });
  if (!res.ok) throw new Error("save_failed");
}

let saveTimer = null;
let saveInFlight = false;
let savePending = false;

function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 400);
}

async function flushSave() {
  if (saveInFlight) { savePending = true; return; }
  saveInFlight = true;
  const snapshot = state;
  try {
    await putState(snapshot);
  } catch (e) {
    toast("Salvataggio non riuscito — controlla la connessione");
  } finally {
    saveInFlight = false;
    if (savePending) { savePending = false; flushSave(); }
  }
}

function withDerived() {
  return { ...state, parametri: deriveParametri(state.parametri) };
}

function currentModel() {
  return computeModel(withDerived());
}

/* -------------------------------------------------------------------------
   Mutatori
   ------------------------------------------------------------------------- */
function ensureYear(obj, anno) { if (!obj[anno]) obj[anno] = {}; return obj[anno]; }

function setMonthField(anno, mese, field, raw) {
  const y = ensureYear(state.datiMensili, anno);
  if (!y[mese]) y[mese] = {};
  y[mese][field] = raw === "" || raw === null ? null : Number(raw);
  saveState();
}

function setBollettaField(anno, bim, field, raw) {
  const y = ensureYear(state.bollette, anno);
  if (!y[bim]) y[bim] = {};
  y[bim][field] = raw === "" || raw === null ? null : Number(raw);
  saveState();
}

function setManutenzione(anno, raw) {
  state.manutenzione[anno] = raw === "" || raw === null ? null : Number(raw);
  saveState();
}

function setParametro(key, raw, opts) {
  let v = Number(raw);
  if (opts && opts.pct) v = v / 100;
  state.parametri[key] = v;
  saveState();
}

/* -------------------------------------------------------------------------
   Utility DOM
   ------------------------------------------------------------------------- */
function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
function h(tag, attrs, children) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === "class") el.className = attrs[k];
    else if (k === "html") el.innerHTML = attrs[k];
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), attrs[k]);
    else el.setAttribute(k, attrs[k]);
  }
  (children || []).forEach(c => { if (c) el.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
  return el;
}
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1600);
}

/* -------------------------------------------------------------------------
   Stato UI runtime
   ------------------------------------------------------------------------- */
let currentTab = "dashboard";
let uiMensiliYear = 1;
let uiBolletteYear = 1;
const charts = {};

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id]; } }

function yearsRange() {
  const durata = state.parametri.durataAnalisi || 25;
  const arr = [];
  for (let a = 0; a <= durata; a++) arr.push(a);
  return arr;
}
function clampYear(y) {
  const durata = state.parametri.durataAnalisi || 25;
  return Math.max(0, Math.min(durata, y));
}

/* ==========================================================================
   Navigazione
   ========================================================================== */
function switchTab(tab) {
  currentTab = tab;
  $all(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  $all(".tab").forEach(s => s.classList.toggle("active", s.id === "tab-" + tab));
  renderCurrentTab();
}

function renderCurrentTab() {
  const model = currentModel();
  switch (currentTab) {
    case "dashboard": renderDashboard(model); break;
    case "parametri": renderParametri(); break;
    case "mensili": renderMensili(model); break;
    case "bollette": renderBollette(model); break;
    case "manutenzione": renderManutenzione(); break;
    case "riepilogo": renderRiepilogo(model); break;
    case "grafici": renderGrafici(model); break;
    case "topbottom": renderTopBottom(model); break;
    case "istruzioni": renderIstruzioni(); break;
  }
  $("#brand-sub").textContent = fmtNum(state.parametri.producibilitaAnnuaNominale) + " kWh/anno";
}

/* ==========================================================================
   DASHBOARD
   ========================================================================== */
function renderDashboard(model) {
  const root = $("#tab-dashboard");
  root.innerHTML = "";
  root.appendChild(h("h1", { class: "page-title" }, ["Dashboard impianto fotovoltaico"]));
  root.appendChild(h("p", { class: "page-sub" }, [
    "I valori “ad oggi” sommano solo i mesi effettivamente inseriti nel foglio Dati mensili. La data di pareggio è stimata per interpolazione lineare all'interno dell'anno di rientro."
  ]));

  const dp = model.dashboardPayback;
  const today = new Date();
  let giorniMancanti = null;
  if (dp) giorniMancanti = Math.round((dp.date.getTime() - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);

  const kpis = h("div", { class: "kpi-grid" }, [
    kpiCard("Data di pareggio stimata", dp ? fmtDate(dp.date) : "Non raggiunto entro " + state.parametri.durataAnalisi + " anni", dp ? (giorniMancanti <= 0 ? "Già raggiunto" : null) : null),
    kpiCard("Giorni mancanti al pareggio", dp ? (giorniMancanti <= 0 ? "Raggiunto" : fmtNum(giorniMancanti)) : "—", null, giorniMancanti !== null && giorniMancanti <= 0 ? "good" : ""),
    kpiCard("kWh prodotti (ad oggi)", fmtNum(model.kwhProdottiOggi), null),
    kpiCard("kWh autoconsumati (ad oggi)", fmtNum(model.kwhAutoconsumoOggi), null),
    kpiCard("kWh immessi in rete (ad oggi)", fmtNum(model.kwhCedutiOggi), null),
  ]);
  root.appendChild(kpis);

  const ua = model.ultimoAnnoReale;
  const kpis2 = h("div", { class: "kpi-grid" }, [
    kpiCard("Costo annuo senza impianto (ultimo anno reale)", ua ? fmtEUR(ua.I) : "—", ua ? "Anno " + ua.annoSolare : null),
    kpiCard("Costo annuo con impianto (ultimo anno reale)", ua ? fmtEUR(ua.S) : "—", null, ua && ua.S < 0 ? "good" : ""),
    kpiCard("Risparmio annuo (ultimo anno reale)", ua ? fmtEUR(ua.M) : "—", null, "good"),
  ]);
  root.appendChild(kpis2);

  const kpis3 = h("div", { class: "kpi-grid" }, [
    kpiCard("Totale " + state.parametri.durataAnalisi + " anni — costo SENZA impianto", fmtEUR(model.totale25.costoVirtuale)),
    kpiCard("Totale " + state.parametri.durataAnalisi + " anni — costo CON impianto", fmtEUR(model.totale25.costoConImpianto), null, model.totale25.costoConImpianto < 0 ? "good" : ""),
    kpiCard("Totale " + state.parametri.durataAnalisi + " anni — risparmio", fmtEUR(model.totale25.risparmioEnergetico), null, "good"),
  ]);
  root.appendChild(kpis3);

  const compareNote = h("div", { class: "note" }, [
    model.payback.anniAnticipo !== null
      ? `Grazie alla detrazione fiscale il pareggio arriva ${model.payback.anniAnticipo} anni prima. Senza detrazione: ${model.payback.annoSolareSenzaDetr}.`
      : (model.payback.raggiuntoConDetr
          ? `Senza la detrazione fiscale il pareggio non sarebbe raggiunto entro ${state.parametri.durataAnalisi} anni.`
          : `Il pareggio non è ancora raggiunto entro ${state.parametri.durataAnalisi} anni con i parametri correnti.`)
  ]);
  root.appendChild(compareNote);

  const twoCol = h("div", { class: "two-col" });
  const chartCard = h("div", { class: "section-card" }, [
    h("h2", {}, ["Andamento beneficio cumulato vs costo impianto"]),
    h("div", { class: "chart-wrap" }, [h("canvas", { id: "chart-dash-payback" })]),
  ]);
  twoCol.appendChild(chartCard);

  const tableCard = h("div", { class: "section-card" }, [
    h("h2", {}, ["Dettaglio per anno ", h("span", { class: "hint" }, ["(solo anni con dati inseriti)"])]),
  ]);
  const realRows = model.rows.filter(r => r.stato === "Reale");
  if (realRows.length) {
    const table = h("table", { class: "data-table" });
    table.appendChild(h("thead", {}, [h("tr", {}, [
      h("th", { class: "left" }, ["Anno solare"]), h("th", {}, ["kWh prodotti"]), h("th", {}, ["kWh autoconsumati"]), h("th", {}, ["kWh immessi in rete"]),
    ])]));
    const tbody = h("tbody");
    realRows.forEach(r => tbody.appendChild(h("tr", {}, [
      h("td", { class: "left" }, [String(r.annoSolare)]), h("td", {}, [fmtNum(r.D)]), h("td", {}, [fmtNum(r.E)]), h("td", {}, [fmtNum(r.F)]),
    ])));
    table.appendChild(tbody);
    tableCard.appendChild(h("div", { class: "table-scroll" }, [table]));
  } else {
    tableCard.appendChild(h("p", { class: "page-sub" }, ["Nessun anno completamente inserito ancora."]));
  }
  twoCol.appendChild(tableCard);
  root.appendChild(twoCol);

  drawPaybackChart("chart-dash-payback", model, { compact: true });
}

function kpiCard(label, value, sub, cls) {
  return h("div", { class: "kpi-card" }, [
    h("div", { class: "kpi-label" }, [label]),
    h("div", { class: "kpi-value " + (cls || "") }, [value]),
    sub ? h("div", { class: "kpi-sub" }, [sub]) : null,
  ]);
}

/* ==========================================================================
   PARAMETRI
   ========================================================================== */
function renderParametri() {
  const root = $("#tab-parametri");
  root.innerHTML = "";
  root.appendChild(h("h1", { class: "page-title" }, ["Parametri impianto"]));
  root.appendChild(h("p", { class: "page-sub" }, ["Questi valori guidano le stime per gli anni non ancora compilati e i calcoli di detrazione fiscale e pareggio."]));

  const card = h("div", { class: "section-card" }, [h("h2", {}, ["Parametri modificabili"])]);
  const grid = h("div", { class: "form-grid" });
  PARAM_FIELDS.forEach(f => {
    const val = f.pct ? state.parametri[f.key] * 100 : state.parametri[f.key];
    const input = h("input", {
      type: "number", step: f.step || "any", value: String(val),
      onchange: (e) => { setParametro(f.key, e.target.value, { pct: f.pct }); renderParametri(); }
    });
    grid.appendChild(h("div", { class: "field" }, [
      h("label", {}, [f.label + (f.pct ? " (%)" : "")]),
      input,
      h("div", { class: "field-hint" }, [f.hint]),
    ]));
  });
  card.appendChild(grid);
  root.appendChild(card);

  const dp = deriveParametri(state.parametri);
  const infoCard = h("div", { class: "section-card" }, [
    h("h2", {}, ["Valori calcolati automaticamente"]),
    h("div", { class: "kpi-grid" }, [
      kpiCard("Importo detrazione fiscale (€)", fmtEUR(dp.importoDetrazione)),
      kpiCard("Rata annua detrazione (€)", fmtEUR(dp.rataAnnuaDetrazione)),
      kpiCard("Costo netto investimento (€)", fmtEUR(dp.costoNettoInvestimento)),
    ]),
  ]);
  root.appendChild(infoCard);

  const resetCard = h("div", { class: "section-card" }, [
    h("h2", {}, ["Dati"]),
    h("p", { class: "page-sub", style: "margin-bottom:14px" }, ["Ripristina tutti i dati (parametri, mesi, bollette, manutenzione) ai valori originariamente presenti nel foglio di calcolo, cancellando eventuali modifiche successive."]),
    h("button", {
      class: "small-btn", onclick: () => {
        if (confirm("Ripristinare tutti i dati ai valori originali del file? Le modifiche non salvate andranno perse.")) {
          state = buildSeedState(); saveState(); toast("Dati ripristinati"); renderCurrentTab();
        }
      }
    }, ["Ripristina dati originali del foglio"]),
  ]);
  root.appendChild(resetCard);
}

/* ==========================================================================
   DATI MENSILI
   ========================================================================== */
function renderMensili(model) {
  uiMensiliYear = clampYear(uiMensiliYear);
  const root = $("#tab-mensili");
  root.innerHTML = "";
  root.appendChild(h("h1", { class: "page-title" }, ["Dati mensili"]));
  root.appendChild(h("p", { class: "page-sub" }, [
    "Inserisci ogni mese i kWh prodotti, autoconsumati, ceduti al GSE, prelevati dalla rete e il contributo GSE ricevuto. Il costo €/kWh viene calcolato automaticamente dal \"costo energia\" della bolletta del bimestre corrispondente (tab Bollette bimestrali), diviso i kWh prelevati — ma puoi sempre sovrascriverlo inserendo un valore nel campo del mese: lasciandolo vuoto torna al calcolo automatico. Un anno diventa “Reale” quando tutti e 12 i mesi sono compilati (anche con 0), altrimenti resta stimato dai Parametri."
  ]));

  root.appendChild(yearTabs(model, uiMensiliYear, (y) => { uiMensiliYear = y; renderMensili(currentModel()); }));

  const anno = uiMensiliYear;
  const isBridge = anno === 0;
  const mesiList = isBridge ? [11, 12] : [1,2,3,4,5,6,7,8,9,10,11,12];
  const mesiObj = (state.datiMensili[anno]) || {};
  const bimObj = (state.bollette[anno]) || {};
  const prezziBim = prezziPerBimestre(mesiObj, bimObj);

  const row = model.rows.find(r => r.anno === anno);
  const headerNote = isBridge
    ? h("div", { class: "note" }, ["Bimestre Nov-Dic 2025 (Anno 0): periodo precedente all'Anno 1, usato solo come “testa di ponte” per stimare la data di pareggio; non entra nelle tabelle e nei grafici del riepilogo annuale."])
    : (row ? h("div", { class: "flex-between", style: "margin-bottom:14px" }, [
        h("span", {}, ["Stato anno: ", badge(row.stato)]),
      ]) : null);

  const card = h("div", { class: "section-card" });
  card.appendChild(h("h2", {}, [`Anno ${anno === 0 ? "0" : anno} — ${state.parametri.annoSolareIniziale + anno - 1}`]));
  if (headerNote) card.appendChild(headerNote);

  const table = h("table", { class: "data-table" });
  table.appendChild(h("thead", {}, [h("tr", {}, [
    h("th", { class: "left" }, ["Mese"]),
    h("th", {}, ["kWh prodotti"]),
    h("th", {}, ["kWh autoconsumo"]),
    h("th", {}, ["kWh ceduti GSE"]),
    h("th", {}, ["kWh prelevati rete"]),
    h("th", {}, ["Costo €/kWh (auto, sovrascrivibile)"]),
    h("th", {}, ["Contributo GSE (€)"]),
    h("th", {}, ["Rimborso GSE (€/kWh)"]),
    h("th", {}, ["Verifica"]),
  ])]));
  const tbody = h("tbody");
  mesiList.forEach(m => {
    const mv = mesiObj[m] || {};
    const tr = h("tr");
    tr.appendChild(h("td", { class: "left" }, [MESI[m - 1]]));
    ["kwhProdotti", "kwhAutoconsumo", "kwhCeduti", "kwhPrelevati"].forEach(field => {
      const input = h("input", {
        type: "number", step: "any",
        value: mv[field] === undefined || mv[field] === null ? "" : String(mv[field]),
        placeholder: "—",
        onchange: (e) => { setMonthField(anno, m, field, e.target.value); renderMensili(currentModel()); }
      });
      tr.appendChild(h("td", {}, [input]));
    });
    const prezzoDerivato = prezziBim[Math.ceil(m / 2)];
    const haManuale = mv.costoKwh !== undefined && mv.costoKwh !== null && mv.costoKwh !== "";
    const prezzoInput = h("input", {
      type: "number", step: "any",
      value: haManuale ? String(mv.costoKwh) : "",
      placeholder: "auto " + fmtEUR2(prezzoDerivato),
      title: "Lascia vuoto per usare il prezzo calcolato dalla bolletta. Inserisci un valore per sovrascriverlo.",
      onchange: (e) => { setMonthField(anno, m, "costoKwh", e.target.value); renderMensili(currentModel()); }
    });
    tr.appendChild(h("td", {}, [prezzoInput]));
    tr.appendChild(h("td", {}, [h("input", {
      type: "number", step: "any",
      value: mv.contributoGse === undefined || mv.contributoGse === null ? "" : String(mv.contributoGse),
      placeholder: "—",
      onchange: (e) => { setMonthField(anno, m, "contributoGse", e.target.value); renderMensili(currentModel()); }
    })]));
    const cedutiVal = Number(mv.kwhCeduti) || 0;
    const gseVal = Number(mv.contributoGse) || 0;
    const rimborsoKwh = cedutiVal > 0 ? gseVal / cedutiVal : null;
    tr.appendChild(h("td", {}, [rimborsoKwh === null ? "—" : fmtEUR2(rimborsoKwh) + "/kWh"]));
    let verifica = "—";
    if (mv.kwhProdotti !== undefined && mv.kwhProdotti !== null && mv.kwhProdotti !== "") {
      const prod = Number(mv.kwhProdotti) || 0;
      const somma = (Number(mv.kwhAutoconsumo) || 0) + (Number(mv.kwhCeduti) || 0);
      const tol = Math.max(1, prod * 0.02);
      verifica = Math.abs(prod - somma) <= tol ? "OK" : "Verifica";
    }
    tr.appendChild(h("td", {}, [verifica === "—" ? "—" : badge(verifica === "OK" ? "Reale" : "Stima", verifica)]));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  card.appendChild(h("div", { class: "table-scroll" }, [table]));
  root.appendChild(card);

  if (!isBridge) {
    const chartCard = h("div", { class: "section-card" }, [
      h("h2", {}, ["Profilo mensile " + (state.parametri.annoSolareIniziale + anno - 1)]),
      h("div", { class: "chart-wrap" }, [h("canvas", { id: "chart-mensile-profilo" })]),
    ]);
    root.appendChild(chartCard);
    drawMonthlyChart("chart-mensile-profilo", mesiObj);
  }
}

function yearTabs(model, current, onSelect) {
  const wrap = h("div", { class: "year-tabs" });
  yearsRange().forEach(y => {
    const row = model.rows.find(r => r.anno === y);
    const isReal = row && row.stato === "Reale";
    const label = y === 0 ? "Anno 0" : "Anno " + y;
    const btn = h("button", {
      class: (y === current ? "active " : "") + (isReal ? "is-real" : ""),
      onclick: () => onSelect(y),
    }, [label]);
    wrap.appendChild(btn);
  });
  return wrap;
}

function badge(stato, textOverride) {
  const cls = stato === "Reale" ? "reale" : "stima";
  return h("span", { class: "badge " + cls }, [textOverride || stato]);
}

/* ==========================================================================
   BOLLETTE BIMESTRALI
   ========================================================================== */
function renderBollette(model) {
  uiBolletteYear = clampYear(uiBolletteYear);
  const root = $("#tab-bollette");
  root.innerHTML = "";
  root.appendChild(h("h1", { class: "page-title" }, ["Bollette bimestrali"]));
  root.appendChild(h("p", { class: "page-sub" }, [
    "Inserisci, per ciascuno dei 6 bimestri dell'anno, il costo energia, le spese di gestione (trasporto e gestione contatore), gli oneri di sistema e l'IVA indicati in bolletta. Il totale bolletta si calcola da solo."
  ]));

  root.appendChild(yearTabs(model, uiBolletteYear, (y) => { uiBolletteYear = y; renderBollette(currentModel()); }));

  const anno = uiBolletteYear;
  const isBridge = anno === 0;
  const bimList = isBridge ? [6] : [1,2,3,4,5,6];
  const bimObj = state.bollette[anno] || {};

  const card = h("div", { class: "section-card" });
  card.appendChild(h("h2", {}, [`Anno ${anno} — ${state.parametri.annoSolareIniziale + anno - 1}`]));
  if (isBridge) card.appendChild(h("div", { class: "note" }, ["Bimestre Nov-Dic 2025 (Anno 0): usato solo per la stima del pareggio."]));

  const table = h("table", { class: "data-table" });
  table.appendChild(h("thead", {}, [h("tr", {}, [
    h("th", { class: "left" }, ["Periodo"]), h("th", {}, ["Costo energia (€)"]), h("th", {}, ["Spese gestione (€)"]), h("th", {}, ["Oneri di sistema (€)"]), h("th", {}, ["IVA (€)"]), h("th", {}, ["Totale bolletta (€)"]),
  ])]));
  const tbody = h("tbody");
  bimList.forEach(b => {
    const bv = bimObj[b] || {};
    const tr = h("tr");
    tr.appendChild(h("td", { class: "left" }, [BIMESTRI[b - 1]]));
    ["costoEnergia", "speseGestione", "oneriSistema", "iva"].forEach(field => {
      const input = h("input", {
        type: "number", step: "any",
        value: bv[field] === undefined || bv[field] === null ? "" : String(bv[field]),
        placeholder: "—",
        onchange: (e) => { setBollettaField(anno, b, field, e.target.value); renderBollette(currentModel()); }
      });
      tr.appendChild(h("td", {}, [input]));
    });
    tr.appendChild(h("td", {}, [fmtEUR2(totaleBimestre(bv))]));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  card.appendChild(h("div", { class: "table-scroll" }, [table]));
  root.appendChild(card);
}

/* ==========================================================================
   MANUTENZIONE ANNUA
   ========================================================================== */
function renderManutenzione() {
  const root = $("#tab-manutenzione");
  root.innerHTML = "";
  root.appendChild(h("h1", { class: "page-title" }, ["Manutenzione annua"]));
  root.appendChild(h("p", { class: "page-sub" }, ["Eventuale spesa di manutenzione dell'impianto, una riga per anno."]));

  const card = h("div", { class: "section-card" });
  const table = h("table", { class: "data-table" });
  table.appendChild(h("thead", {}, [h("tr", {}, [h("th", { class: "left" }, ["Anno"]), h("th", { class: "left" }, ["Anno solare"]), h("th", {}, ["Spesa manutenzione (€)"])])]));
  const tbody = h("tbody");
  yearsRange().forEach(anno => {
    const v = state.manutenzione[anno];
    const tr = h("tr");
    tr.appendChild(h("td", { class: "left" }, [anno === 0 ? "0 (bimestre 2025)" : String(anno)]));
    tr.appendChild(h("td", { class: "left" }, [String(state.parametri.annoSolareIniziale + anno - 1)]));
    const input = h("input", {
      type: "number", step: "any",
      value: v === undefined || v === null ? "" : String(v),
      placeholder: "0",
      onchange: (e) => { setManutenzione(anno, e.target.value); }
    });
    tr.appendChild(h("td", {}, [input]));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  card.appendChild(h("div", { class: "table-scroll" }, [table]));
  root.appendChild(card);
}

/* ==========================================================================
   RIEPILOGO ANNUALE
   ========================================================================== */
function renderRiepilogo(model) {
  const root = $("#tab-riepilogo");
  root.innerHTML = "";
  root.appendChild(h("h1", { class: "page-title" }, ["Riepilogo annuale"]));
  root.appendChild(h("p", { class: "page-sub" }, [
    "Totali calcolati per anno. Le righe in grigio corsivo sono anni stimati (non ancora inseriti), calcolati come media degli anni reali precedenti o dalle ipotesi in Parametri."
  ]));

  const card = h("div", { class: "section-card" });
  const table = h("table", { class: "data-table" });
  table.appendChild(h("thead", {}, [h("tr", {}, [
    h("th", { class: "left" }, ["Anno"]), h("th", { class: "left" }, ["Stato"]),
    h("th", {}, ["Produzione (kWh)"]), h("th", {}, ["Autoconsumo (kWh)"]), h("th", {}, ["Ceduto GSE (kWh)"]), h("th", {}, ["Prelevato rete (kWh)"]),
    h("th", {}, ["Costo medio (€/kWh)"]), h("th", {}, ["Costo virtuale senza impianto (€)"]), h("th", {}, ["Bolletta reale (€)"]),
    h("th", {}, ["Contributo GSE (€)"]), h("th", {}, ["Rimborso GSE (€/kWh)"]), h("th", {}, ["Manutenzione (€)"]), h("th", {}, ["Risparmio energetico (€)"]),
    h("th", {}, ["Rata detrazione (€)"]), h("th", {}, ["Beneficio annuo (€)"]), h("th", {}, ["Beneficio cumulato (€)"]), h("th", {}, ["Investimento residuo (€)"]),
  ])]));
  const tbody = h("tbody");
  model.rows.forEach(r => {
    const tr = h("tr", { class: r.stato === "Stima" ? "row-stima" : "" });
    tr.appendChild(h("td", { class: "left" }, [String(r.annoSolare) + " (anno " + r.anno + ")"]));
    tr.appendChild(h("td", { class: "left" }, [badge(r.stato)]));
    tr.appendChild(h("td", {}, [fmtNum(r.D)]));
    tr.appendChild(h("td", {}, [fmtNum(r.E)]));
    tr.appendChild(h("td", {}, [fmtNum(r.F)]));
    tr.appendChild(h("td", {}, [fmtNum(r.G)]));
    tr.appendChild(h("td", {}, [fmtNum(r.H, 3)]));
    tr.appendChild(h("td", {}, [fmtEUR2(r.I)]));
    tr.appendChild(h("td", {}, [fmtEUR2(r.J)]));
    tr.appendChild(h("td", {}, [fmtEUR2(r.K)]));
    tr.appendChild(h("td", {}, [r.F > 0 ? fmtEUR2(r.K / r.F) + "/kWh" : "—"]));
    tr.appendChild(h("td", {}, [fmtEUR2(r.L)]));
    tr.appendChild(h("td", {}, [fmtEUR2(r.M)]));
    tr.appendChild(h("td", {}, [fmtEUR2(r.N)]));
    tr.appendChild(h("td", {}, [fmtEUR2(r.O)]));
    tr.appendChild(h("td", {}, [fmtEUR2(r.P)]));
    tr.appendChild(h("td", {}, [fmtEUR2(r.Q)]));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  card.appendChild(h("div", { class: "table-scroll" }, [table]));
  root.appendChild(card);

  const sintesi = h("div", { class: "section-card" }, [
    h("h2", {}, ["Sintesi " + state.parametri.durataAnalisi + " anni"]),
    h("div", { class: "kpi-grid" }, [
      kpiCard("Totale risparmio energetico (€)", fmtEUR(model.totale25.risparmioEnergetico), null, "good"),
      kpiCard("Totale beneficio (risparmio + detrazione) (€)", fmtEUR(model.totale25.beneficioTotale), null, "good"),
      kpiCard("Anno di rientro investimento", model.payback.raggiuntoConDetr ? ("Anno " + model.payback.idxConDetr + " (" + model.payback.annoSolareConDetr + ")") : "Non raggiunto"),
      kpiCard("Anno di rientro SENZA detrazione", model.payback.raggiuntoSenzaDetr ? ("Anno " + model.payback.idxSenzaDetr + " (" + model.payback.annoSolareSenzaDetr + ")") : "Non raggiunto"),
      kpiCard("Anni di anticipo grazie alla detrazione", model.payback.anniAnticipo !== null ? fmtNum(model.payback.anniAnticipo) : "—"),
    ]),
  ]);
  root.appendChild(sintesi);

  const b = model.bridge;
  const bridgeCard = h("div", { class: "section-card" }, [
    h("h2", {}, ["Bimestre Nov-Dic 2025 (Anno 0)", h("span", { class: "hint" }, [" — testa di ponte, solo per calcolo del pareggio"])]),
    h("div", { class: "kpi-grid" }, [
      kpiCard("Produzione (kWh)", fmtNum(b.D0)),
      kpiCard("Autoconsumo (kWh)", fmtNum(b.E0)),
      kpiCard("Ceduto GSE (kWh)", fmtNum(b.F0)),
      kpiCard("Prelevato rete (kWh)", fmtNum(b.G0)),
      kpiCard("Risparmio energetico bimestre (€)", fmtEUR2(b.bridgeRisparmio)),
    ]),
    h("div", { class: "note warn" }, ["Questo risparmio non si somma mai al Beneficio cumulato né al Cumulato senza detrazione: viene usato solo per anticipare/verificare l'anno di pareggio."]),
  ]);
  root.appendChild(bridgeCard);
}

/* ==========================================================================
   MESI TOP / BOTTOM
   ========================================================================== */
function renderTopBottom(model) {
  const root = $("#tab-topbottom");
  root.innerHTML = "";
  root.appendChild(h("h1", { class: "page-title" }, ["Mesi Top / Bottom"]));
  root.appendChild(h("p", { class: "page-sub" }, ["Per ogni anno con dati completi (“Reale”): i 3 mesi con produzione più alta e più bassa, i 3 con maggior cessione al GSE e i 3 con maggior autoconsumo."]));

  const tb = computeTopBottom(state, model);
  if (!tb.length) {
    root.appendChild(h("div", { class: "note" }, ["Nessun anno completamente inserito ancora: compila tutti e 12 i mesi di un anno nella sezione “Dati mensili” per vedere qui la classifica."]));
    return;
  }
  tb.forEach(y => {
    const card = h("div", { class: "section-card" });
    card.appendChild(h("h2", {}, ["Anno " + y.anno + " — " + y.annoSolare]));
    const grid = h("div", { class: "form-grid" });
    grid.appendChild(miniRankTable("Produzione più alta", y.prodAlta, "kwhProdotti", "kWh"));
    grid.appendChild(miniRankTable("Produzione più bassa", y.prodBassa, "kwhProdotti", "kWh"));
    grid.appendChild(miniRankTable("Maggior cessione GSE", y.cessioneAlta, "kwhCeduti", "kWh"));
    grid.appendChild(miniRankTable("Maggior autoconsumo", y.autoconsumoAlta, "kwhAutoconsumo", "kWh"));
    card.appendChild(grid);
    root.appendChild(card);
  });
}

function miniRankTable(title, list, field, unit) {
  const rows = list.map(item => h("div", { class: "rank-row" }, [
    h("span", { class: "rank-month" }, [item.mese]),
    h("span", { class: "rank-value" }, [fmtNum(item[field]) + " " + unit]),
  ]));
  return h("div", { class: "field" }, [h("label", {}, [title]), h("div", { class: "rank-list" }, rows)]);
}

/* ==========================================================================
   ISTRUZIONI
   ========================================================================== */
function renderIstruzioni() {
  const root = $("#tab-istruzioni");
  root.innerHTML = "";
  root.appendChild(h("h1", { class: "page-title" }, ["Istruzioni"]));
  root.appendChild(h("p", { class: "page-sub" }, ["Ammortamento e risparmio energetico — Impianto fotovoltaico"]));

  const card = h("div", { class: "section-card instr", html: `
    <h3>Come è fatta questa app</h3>
    <ul>
      <li><b>Dashboard:</b> le card di sintesi (data di pareggio stimata, giorni mancanti, kWh prodotti/autoconsumati/immessi in rete ad oggi, costi con/senza impianto) e il dettaglio per anno, limitato agli anni con dati inseriti.</li>
      <li><b>Parametri:</b> dati generali dell'impianto (costo, detrazione fiscale, durata analisi) e ipotesi per gli anni non ancora compilati.</li>
      <li><b>Dati mensili:</b> inserisci ogni mese, per ciascuno degli anni, i kWh prodotti, autoconsumati, ceduti al GSE, prelevati dalla rete e il contributo GSE ricevuto. Il costo €/kWh è calcolato automaticamente dalla bolletta (vedi sotto).</li>
      <li><b>Bollette bimestrali:</b> inserisci, per ciascuno dei 6 bimestri, il costo energia, le spese di gestione, gli oneri di sistema e l'IVA indicati in bolletta. Il totale si calcola da solo.</li>
      <li><b>Manutenzione annua:</b> eventuale spesa di manutenzione, una riga per anno.</li>
      <li><b>Riepilogo annuale:</b> calcola in automatico i totali per anno, il risparmio energetico e il beneficio della detrazione fiscale.</li>
      <li><b>Grafici:</b> i quattro grafici riassuntivi, con la tabella dei valori esatti sotto ciascuno.</li>
      <li><b>Mesi Top/Bottom:</b> per ogni anno reale, i mesi con produzione più alta/bassa, maggior cessione GSE e maggior autoconsumo.</li>
    </ul>

    <h3>Come vengono stimati gli anni non ancora compilati</h3>
    <p>Nel Riepilogo annuale la colonna Stato indica “Reale” se hai inserito tutti i 12 mesi di quell'anno, altrimenti “Stima”.</p>
    <p>Per gli anni in “Stima”: produzione, autoconsumo, immissione in rete e costo €/kWh di mercato usano le ipotesi fisse impostate in Parametri. Il costo virtuale senza impianto usa il consumo annuo ipotizzato, allo stesso prezzo di mercato più IVA. Tutti gli altri valori (prelievo dalla rete, contributo GSE, bolletta, manutenzione) sono calcolati come MEDIA dei soli anni precedenti già marcati “Reale”. Man mano che inserisci nuovi anni reali, queste medie si aggiornano automaticamente.</p>

    <h3>Come viene calcolato il risparmio annuo</h3>
    <p><b>Costo €/kWh</b> si calcola automaticamente per ogni bimestre come "costo energia" della bolletta ÷ kWh prelevati dalla rete in quel bimestre (si escludono di proposito spese di gestione, oneri di sistema e IVA, in gran parte costi fissi non proporzionali ai kWh — altrimenti un prelievo basso gonfierebbe il prezzo). Se un bimestre non ha prelievo, si usa la media dei bimestri calcolabili dello stesso anno. Puoi comunque sovrascrivere il valore per ogni singolo mese nella tabella "Dati mensili": in tal caso viene usato il tuo valore al posto di quello calcolato, e tutto (risparmio, pareggio, dashboard) si ricalcola di conseguenza. Per tornare al calcolo automatico basta svuotare il campo.</p>
    <p><b>Costo virtuale (senza impianto)</b> = per gli anni “Reale”, somma mese per mese di (kWh autoconsumati + kWh prelevati dalla rete del mese) × prezzo €/kWh del bimestre corrispondente — così ogni mese pesa col prezzo reale del suo bimestre invece che con una media dell'anno. È quanto avresti pagato per TUTTO il tuo consumo se non avessi il fotovoltaico. Per gli anni “Stima”: consumo annuo ipotizzato × prezzo €/kWh di mercato × (1 + % IVA).</p>
    <p><b>Risparmio energetico</b> = Costo virtuale − Costo bolletta realmente pagata − Spese di manutenzione + Contributo GSE ricevuto.</p>
    <p><b>Rata detrazione fiscale</b> = quota annua del contributo/detrazione sul costo dell'impianto, spalmata sui primi N anni (vedi Parametri).</p>
    <p><b>Beneficio totale annuo</b> = Risparmio energetico + Rata detrazione fiscale. <b>Beneficio cumulato</b> = somma progressiva del beneficio, anno dopo anno, confrontata con il costo iniziale LORDO dell'impianto per individuare l'anno di pareggio.</p>

    <h3>Bimestre Nov-Dic 2025 (Anno 0)</h3>
    <p>Un blocco separato “Anno 0” permette di inserire il bimestre Novembre-Dicembre, il periodo precedente all'Anno 1. Il suo risparmio energetico è una “testa di ponte” usata SOLO per determinare la data di pareggio: non si somma mai al Beneficio cumulato né al Cumulato senza detrazione, che restano puri Anno 1-N per tabelle, grafici e confronti.</p>

    <h3>Salvataggio dei dati</h3>
    <p>Tutti i dati inseriti vengono salvati automaticamente su un server condiviso: aprendo il sito da qualsiasi dispositivo vedrai sempre gli stessi dati aggiornati. Usa i pulsanti “Backup” / “Ripristina” nella barra laterale per esportare o importare un file di backup JSON, ad esempio come copia di sicurezza.</p>
  ` });
  root.appendChild(card);
}

/* ==========================================================================
   GRAFICI (Chart.js)
   ========================================================================== */
function chartTheme() {
  return {
    text: cssVar("--text-secondary"),
    muted: cssVar("--text-muted"),
    grid: cssVar("--gridline"),
    baseline: cssVar("--baseline"),
    surface: cssVar("--surface-1"),
    s1: cssVar("--series-1"), s2: cssVar("--series-2"), s3: cssVar("--series-3"),
    s4: cssVar("--series-4"), s5: cssVar("--series-5"), s6: cssVar("--series-6"),
    s7: cssVar("--series-7"), s8: cssVar("--series-8"),
  };
}
function baseScales(t, yLabel) {
  return {
    x: { grid: { color: t.grid, display: false }, ticks: { color: t.muted, font: { size: 11 } }, border: { color: t.baseline } },
    y: { grid: { color: t.grid }, ticks: { color: t.muted, font: { size: 11 } }, border: { display: false }, title: yLabel ? { display: true, text: yLabel, color: t.muted, font: { size: 11 } } : undefined },
  };
}
function baseLegend(t) {
  return { position: "bottom", labels: { color: t.text, boxWidth: 10, boxHeight: 10, padding: 16, font: { size: 12 } } };
}
function baseTooltip(t, currencyFields) {
  return {
    backgroundColor: t.surface, titleColor: t.text, bodyColor: t.text, borderColor: t.grid, borderWidth: 1, padding: 10,
    callbacks: currencyFields ? { label: (ctx) => `${ctx.dataset.label}: ${fmtEUR2(ctx.parsed.y)}` } : undefined,
  };
}

function drawMonthlyChart(id, mesiObj) {
  destroyChart(id);
  const t = chartTheme();
  const canvas = $("#" + id);
  if (!canvas) return;
  const labels = MESI.map(m => m.slice(0, 3));
  const prod = [], auto = [], ced = [];
  for (let m = 1; m <= 12; m++) {
    const mv = mesiObj[m] || {};
    prod.push(mv.kwhProdotti ?? null);
    auto.push(mv.kwhAutoconsumo ?? null);
    ced.push(mv.kwhCeduti ?? null);
  }
  charts[id] = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Prodotti", data: prod, backgroundColor: t.s1, borderRadius: 4 },
        { label: "Autoconsumo", data: auto, backgroundColor: t.s3, borderRadius: 4 },
        { label: "Ceduti GSE", data: ced, backgroundColor: t.s2, borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: baseScales(t, "kWh"),
      plugins: { legend: baseLegend(t), tooltip: { backgroundColor: t.surface, titleColor: t.text, bodyColor: t.text, borderColor: t.grid, borderWidth: 1, padding: 10 } },
    },
  });
}

function drawPaybackChart(id, model, opts) {
  destroyChart(id);
  const t = chartTheme();
  const canvas = $("#" + id);
  if (!canvas) return;
  const compact = opts && opts.compact;
  const labels = model.rows.map(r => String(r.annoSolare));
  const P = model.rows.map(r => r.P);
  const AB = model.rows.map(r => r.AB);
  const costo = state.parametri.costoIniziale;
  const soglia = model.rows.map(() => costo);
  const idx = model.payback.raggiuntoConDetr ? model.payback.idxConDetr - 1 : -1;
  const pointRadius = model.rows.map((_, i) => i === idx ? 6 : 0);
  const pointBg = model.rows.map((_, i) => i === idx ? t.s8 : t.s1);

  charts[id] = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Beneficio cumulato (con detrazione)", data: P, borderColor: t.s1, backgroundColor: t.s1 + "33", fill: true, tension: 0.15, borderWidth: 2, pointRadius, pointBackgroundColor: pointBg, pointBorderWidth: 0 },
        { label: "Cumulato senza detrazione fiscale", data: AB, borderColor: t.s7, borderDash: [6, 4], fill: false, tension: 0.15, borderWidth: 2, pointRadius: 0 },
        { label: "Costo iniziale impianto", data: soglia, borderColor: t.s8, borderDash: [3, 3], fill: false, borderWidth: 1.5, pointRadius: 0 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: baseScales(t, "€"),
      plugins: { legend: compact ? { display: false } : baseLegend(t), tooltip: baseTooltip(t, true) },
    },
  });
}

function drawBenefitChart(id, model) {
  destroyChart(id);
  const t = chartTheme();
  const canvas = $("#" + id);
  if (!canvas) return;
  const labels = model.rows.map(r => String(r.annoSolare));
  charts[id] = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Risparmio energetico", data: model.rows.map(r => r.M), backgroundColor: t.s1, stack: "b", borderRadius: { topLeft: 0, topRight: 0 } },
        { label: "Rata detrazione fiscale", data: model.rows.map(r => r.N), backgroundColor: t.s4, stack: "b", borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { ...baseScales(t, "€"), x: { ...baseScales(t).x, stacked: true }, y: { ...baseScales(t, "€").y, stacked: true } },
      plugins: { legend: baseLegend(t), tooltip: baseTooltip(t, true) },
    },
  });
}

function drawBillChart(id, model) {
  destroyChart(id);
  const t = chartTheme();
  const canvas = $("#" + id);
  if (!canvas) return;
  const labels = model.rows.map(r => String(r.annoSolare));
  charts[id] = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Costo energia", data: model.rows.map(r => r.V), backgroundColor: t.s1, stack: "c" },
        { label: "Spese gestione", data: model.rows.map(r => r.W), backgroundColor: t.s2, stack: "c" },
        { label: "Oneri di sistema", data: model.rows.map(r => r.Y), backgroundColor: t.s3, stack: "c" },
        { label: "IVA", data: model.rows.map(r => r.X), backgroundColor: t.s4, stack: "c", borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { ...baseScales(t, "€"), x: { ...baseScales(t).x, stacked: true }, y: { ...baseScales(t, "€").y, stacked: true } },
      plugins: { legend: baseLegend(t), tooltip: baseTooltip(t, true) },
    },
  });
}

function drawProductionChart(id, model) {
  destroyChart(id);
  const t = chartTheme();
  const canvas = $("#" + id);
  if (!canvas) return;
  const labels = model.rows.map(r => String(r.annoSolare));
  charts[id] = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Produzione", data: model.rows.map(r => r.D), backgroundColor: t.s1, borderRadius: 3 },
        { label: "Autoconsumo", data: model.rows.map(r => r.E), backgroundColor: t.s3, borderRadius: 3 },
        { label: "Immesso in rete", data: model.rows.map(r => r.F), backgroundColor: t.s2, borderRadius: 3 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: baseScales(t, "kWh"),
      plugins: { legend: baseLegend(t), tooltip: { backgroundColor: t.surface, titleColor: t.text, bodyColor: t.text, borderColor: t.grid, borderWidth: 1, padding: 10 } },
    },
  });
}

function renderGrafici(model) {
  const root = $("#tab-grafici");
  root.innerHTML = "";
  root.appendChild(h("h1", { class: "page-title" }, ["Grafici riepilogativi (" + state.parametri.durataAnalisi + " anni)"]));
  root.appendChild(h("p", { class: "page-sub" }, ["I valori esatti dei grafici sono riportati nella tabella subito sotto ciascuno."]));

  const specs = [
    { id: "chart-prod", title: "Produzione, autoconsumo e immissione in rete per anno", draw: (id) => drawProductionChart(id, model),
      cols: ["Anno solare", "Produzione (kWh)", "Autoconsumo (kWh)", "Immesso in rete (kWh)"],
      rows: model.rows.map(r => [r.annoSolare, fmtNum(r.D), fmtNum(r.E), fmtNum(r.F)]) },
    { id: "chart-payback", title: "Beneficio cumulato vs costo impianto (anno di pareggio)", draw: (id) => drawPaybackChart(id, model),
      cols: ["Anno solare", "Beneficio cumulato (€)", "Cumulato senza detrazione (€)"],
      rows: model.rows.map(r => [r.annoSolare, fmtEUR2(r.P), fmtEUR2(r.AB)]) },
    { id: "chart-benefit", title: "Composizione del beneficio annuo (risparmio + detrazione fiscale)", draw: (id) => drawBenefitChart(id, model),
      cols: ["Anno solare", "Risparmio energetico (€)", "Rata detrazione (€)", "Beneficio totale (€)"],
      rows: model.rows.map(r => [r.annoSolare, fmtEUR2(r.M), fmtEUR2(r.N), fmtEUR2(r.O)]) },
    { id: "chart-bill", title: "Composizione bolletta con impianto per anno", draw: (id) => drawBillChart(id, model),
      cols: ["Anno solare", "Costo energia (€)", "Spese gestione (€)", "Oneri di sistema (€)", "IVA (€)"],
      rows: model.rows.map(r => [r.annoSolare, fmtEUR2(r.V), fmtEUR2(r.W), fmtEUR2(r.Y), fmtEUR2(r.X)]) },
  ];

  specs.forEach(spec => {
    const card = h("div", { class: "section-card" });
    card.appendChild(h("h2", {}, [spec.title]));
    card.appendChild(h("div", { class: "chart-wrap tall" }, [h("canvas", { id: spec.id })]));
    const table = h("table", { class: "data-table" });
    table.appendChild(h("thead", {}, [h("tr", {}, spec.cols.map((c, i) => h("th", { class: i === 0 ? "left" : "" }, [c])))]));
    const tbody = h("tbody");
    spec.rows.forEach(r => tbody.appendChild(h("tr", {}, r.map((v, i) => h("td", { class: i === 0 ? "left" : "" }, [String(v)])))));
    table.appendChild(tbody);
    card.appendChild(h("div", { class: "table-scroll" }, [table]));
    root.appendChild(card);
  });

  specs.forEach(spec => spec.draw(spec.id));
}

/* ==========================================================================
   Import / Export
   ========================================================================== */
function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fotovoltaico-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Backup esportato");
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed.parametri) throw new Error("formato non valido");
      state = parsed;
      saveState();
      toast("Dati importati");
      renderCurrentTab();
    } catch (e) {
      toast("File non valido");
    }
  };
  reader.readAsText(file);
}

/* ==========================================================================
   Init
   ========================================================================== */
async function init() {
  const active = $(".tab.active");
  if (active) active.innerHTML = '<p class="loading-msg">Caricamento dati…</p>';

  state = await loadState();

  $all(".nav-item").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));
  $("#btn-export").addEventListener("click", exportBackup);
  $("#btn-import").addEventListener("click", () => $("#file-import").click());
  $("#file-import").addEventListener("change", (e) => { if (e.target.files[0]) importBackup(e.target.files[0]); e.target.value = ""; });

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => renderCurrentTab());

  renderCurrentTab();
}

document.addEventListener("DOMContentLoaded", init);
