/* ==========================================================================
   calc.js — motore di calcolo, replica fedele delle formule del foglio
   "Ammortamento_Impianto_Fotovoltaico" (fogli Parametri / Dati mensili /
   Bollette bimestrali / Manutenzione annua / Riepilogo annuale / Dashboard).
   ========================================================================== */

const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno",
              "Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const BIMESTRI = ["Gen-Feb","Mar-Apr","Mag-Giu","Lug-Ago","Set-Ott","Nov-Dic"];

function isLeapYear(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function daysInYear(y) { return isLeapYear(y) ? 366 : 365; }

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

/* --- helpers su "Dati mensili" di un anno: oggetto {1: {...}, 2: {...}, ...} --- */
function meseCompilato(m) {
  return m && m.kwhProdotti !== null && m.kwhProdotti !== undefined && m.kwhProdotti !== "";
}
function contaMesiCompilati(mesiObj) {
  if (!mesiObj) return 0;
  let n = 0;
  for (let k = 1; k <= 12; k++) if (meseCompilato(mesiObj[k])) n++;
  return n;
}
function sumMese(mesiObj, field) {
  if (!mesiObj) return 0;
  let s = 0;
  for (let k = 1; k <= 12; k++) {
    const m = mesiObj[k];
    if (m && m[field] !== null && m[field] !== undefined && m[field] !== "") s += Number(m[field]) || 0;
  }
  return s;
}
function avgMese(mesiObj, field) {
  if (!mesiObj) return 0;
  let s = 0, n = 0;
  for (let k = 1; k <= 12; k++) {
    const m = mesiObj[k];
    if (m && m[field] !== null && m[field] !== undefined && m[field] !== "") { s += Number(m[field]) || 0; n++; }
  }
  return n ? s / n : 0;
}

/* --- helpers su "Bollette bimestrali" di un anno: {1:{...}..6:{...}} --- */
function totaleBimestre(b) {
  if (!b) return 0;
  const e = Number(b.costoEnergia) || 0, g = Number(b.speseGestione) || 0, o = Number(b.oneriSistema) || 0, i = Number(b.iva) || 0;
  return e + g + o + i;
}
function sumBollette(bimObj, field) {
  if (!bimObj) return 0;
  let s = 0;
  for (let k = 1; k <= 6; k++) {
    const b = bimObj[k];
    if (!b) continue;
    s += field === "totale" ? totaleBimestre(b) : (Number(b[field]) || 0);
  }
  return s;
}

function avgOrZero(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/* ==========================================================================
   computeModel(state) → { rows[1..25], bridge, payback, dashboard, monthlyByYear }
   ========================================================================== */
function computeModel(state) {
  const p = state.parametri;
  const durata = p.durataAnalisi;

  const realHist = { G: [], J: [], K: [], L: [], V: [], W: [], Y: [], X: [] };
  const rows = [];
  let prevP = 0, prevAB = 0;

  for (let anno = 1; anno <= durata; anno++) {
    const annoSolare = p.annoSolareIniziale + anno - 1;
    const mesi = state.datiMensili[anno] || {};
    const nCompilati = contaMesiCompilati(mesi);
    const stato = nCompilati === 12 ? "Reale" : "Stima";

    let D, E, F, G, H, I, J, K, L, V, W, Y, X;

    if (stato === "Reale") {
      D = sumMese(mesi, "kwhProdotti");
      E = sumMese(mesi, "kwhAutoconsumo");
      F = sumMese(mesi, "kwhCeduti");
      G = sumMese(mesi, "kwhPrelevati");
      H = avgMese(mesi, "costoKwh");
      I = (E + G) * H;
      const bim = state.bollette[anno] || {};
      J = sumBollette(bim, "totale");
      K = sumMese(mesi, "contributoGse");
      L = Number((state.manutenzione[anno] ?? 0)) || 0;
      V = sumBollette(bim, "costoEnergia");
      W = sumBollette(bim, "speseGestione");
      Y = sumBollette(bim, "oneriSistema");
      X = sumBollette(bim, "iva");
    } else {
      D = p.producibilitaAnnuaNominale;
      E = p.autoconsumoStima;
      F = p.immissioneStima;
      G = avgOrZero(realHist.G);
      H = p.costoMercatoStima;
      I = p.consumoStima * p.costoMercatoStima * (1 + p.pctIvaStima);
      J = avgOrZero(realHist.J);
      K = avgOrZero(realHist.K);
      L = avgOrZero(realHist.L);
      V = avgOrZero(realHist.V);
      W = avgOrZero(realHist.W);
      Y = avgOrZero(realHist.Y);
      X = avgOrZero(realHist.X);
    }

    const M = I - J - L + K;
    const N = anno <= p.numRateDetrazione ? p.rataAnnuaDetrazione : 0;
    const O = M + N;
    const P = prevP + O;
    const Q = p.costoIniziale - P;
    const S = I - M;
    const AB = prevAB + M;

    const row = { anno, annoSolare, stato, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R: p.costoIniziale, S, V, W, Y, X, AB };
    rows.push(row);

    if (stato === "Reale") {
      realHist.G.push(G); realHist.J.push(J); realHist.K.push(K); realHist.L.push(L);
      realHist.V.push(V); realHist.W.push(W); realHist.Y.push(Y); realHist.X.push(X);
    }
    prevP = P; prevAB = AB;
  }

  /* --- Bridge Anno 0 (bimestre Nov-Dic 2025) --- */
  const mesi0 = state.datiMensili[0] || {};
  const D0 = sumMese(mesi0, "kwhProdotti");
  const E0 = sumMese(mesi0, "kwhAutoconsumo");
  const F0 = sumMese(mesi0, "kwhCeduti");
  const G0 = sumMese(mesi0, "kwhPrelevati");
  const H0 = avgMese(mesi0, "costoKwh");
  const I0 = (E0 + G0) * H0;
  const bim0 = state.bollette[0] || {};
  const J0 = sumBollette(bim0, "totale");
  const K0 = sumMese(mesi0, "contributoGse");
  const L0 = Number((state.manutenzione[0] ?? 0)) || 0;
  const bridgeRisparmio = I0 - J0 - L0 + K0;
  const bridge = { D0, E0, F0, G0, H0, I0, J0, K0, L0, bridgeRisparmio };

  rows.forEach(r => { r.AC = r.P + bridgeRisparmio; r.AD = r.AB + bridgeRisparmio; });

  /* --- Payback --- */
  const idxConDetr = rows.filter(r => r.AC < p.costoIniziale).length + 1;
  const idxSenzaDetr = rows.filter(r => r.AD < p.costoIniziale).length + 1;
  const raggiuntoConDetr = idxConDetr <= durata;
  const raggiuntoSenzaDetr = idxSenzaDetr <= durata;

  const payback = {
    idxConDetr,
    annoSolareConDetr: raggiuntoConDetr ? rows[idxConDetr - 1].annoSolare : null,
    raggiuntoConDetr,
    idxSenzaDetr,
    annoSolareSenzaDetr: raggiuntoSenzaDetr ? rows[idxSenzaDetr - 1].annoSolare : null,
    raggiuntoSenzaDetr,
    anniAnticipo: (raggiuntoConDetr && raggiuntoSenzaDetr) ? (idxSenzaDetr - idxConDetr) : null,
  };

  /* --- Dashboard: interpolazione data di pareggio --- */
  let dashboardPayback = null;
  if (raggiuntoConDetr) {
    const idx = idxConDetr;
    const beneficioFinoAnnoPrec = idx >= 2 ? rows[idx - 2].P : 0;
    const beneficioAnnoPareggio = rows[idx - 1].O;
    const quotaMancante = p.costoIniziale - beneficioFinoAnnoPrec;
    const frazione = beneficioAnnoPareggio !== 0 ? quotaMancante / beneficioAnnoPareggio : 0;
    const annoSolare = rows[idx - 1].annoSolare;
    const nDays = daysInYear(annoSolare);
    const dayOffset = Math.round(Math.max(0, Math.min(1, frazione)) * nDays);
    const date = new Date(Date.UTC(annoSolare, 0, 1));
    date.setUTCDate(date.getUTCDate() + dayOffset);
    dashboardPayback = {
      idx, annoSolare, beneficioFinoAnnoPrec, beneficioAnnoPareggio, quotaMancante, frazione, date
    };
  }

  /* --- Totali "ad oggi" (Dashboard): somma dei soli mesi realmente inseriti, tutti gli anni --- */
  let kwhProdottiOggi = 0, kwhAutoconsumoOggi = 0, kwhCedutiOggi = 0;
  for (let anno = 0; anno <= durata; anno++) {
    const mesi = state.datiMensili[anno] || {};
    kwhProdottiOggi += sumMese(mesi, "kwhProdotti");
    kwhAutoconsumoOggi += sumMese(mesi, "kwhAutoconsumo");
    kwhCedutiOggi += sumMese(mesi, "kwhCeduti");
  }

  const ultimoAnnoReale = [...rows].reverse().find(r => r.stato === "Reale") || null;

  const totale25 = {
    costoVirtuale: rows.reduce((a, r) => a + r.I, 0),
    costoConImpianto: rows.reduce((a, r) => a + r.S, 0),
    risparmioEnergetico: rows.reduce((a, r) => a + r.M, 0),
    beneficioTotale: rows.reduce((a, r) => a + r.O, 0),
  };

  return {
    rows, bridge, payback, dashboardPayback,
    kwhProdottiOggi, kwhAutoconsumoOggi, kwhCedutiOggi,
    ultimoAnnoReale, totale25,
  };
}

/* ==========================================================================
   Mesi Top/Bottom — per ogni anno "Reale": top/bottom 3 mesi per varie metriche
   ========================================================================== */
function computeTopBottom(state, model) {
  const out = [];
  for (const row of model.rows) {
    if (row.stato !== "Reale") continue;
    const mesi = state.datiMensili[row.anno] || {};
    const list = [];
    for (let k = 1; k <= 12; k++) {
      const m = mesi[k];
      if (!meseCompilato(m)) continue;
      list.push({
        mese: MESI[k - 1],
        kwhProdotti: Number(m.kwhProdotti) || 0,
        kwhCeduti: Number(m.kwhCeduti) || 0,
        kwhAutoconsumo: Number(m.kwhAutoconsumo) || 0,
      });
    }
    if (!list.length) continue;
    const topN = (arr, field, n, dir) => {
      const sorted = [...arr].sort((a, b) => dir === "desc" ? b[field] - a[field] : a[field] - b[field]);
      return sorted.slice(0, n);
    };
    out.push({
      anno: row.anno,
      annoSolare: row.annoSolare,
      prodAlta: topN(list, "kwhProdotti", 3, "desc"),
      prodBassa: topN(list, "kwhProdotti", 3, "asc"),
      cessioneAlta: topN(list, "kwhCeduti", 3, "desc"),
      autoconsumoAlta: topN(list, "kwhAutoconsumo", 3, "desc"),
    });
  }
  return out;
}

/* ==========================================================================
   Formattazione
   ========================================================================== */
const fmtEUR = (n) => (Number(n) || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const fmtEUR2 = (n) => (Number(n) || 0).toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
const fmtKWh = (n) => (Number(n) || 0).toLocaleString("it-IT", { maximumFractionDigits: 0 }) + " kWh";
const fmtNum = (n, d = 0) => (Number(n) || 0).toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtDate = (d) => d ? d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "—";
const fmtPct = (n) => ((Number(n) || 0) * 100).toLocaleString("it-IT", { maximumFractionDigits: 0 }) + "%";
