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
/* Prezzo €/kWh derivato dalla bolletta, un valore per bimestre (1..6):
   solo "costo energia" del bimestre / kWh prelevati dalla rete nel bimestre.
   Si esclude di proposito spese di gestione, oneri di sistema e IVA: sono
   in gran parte costi fissi non proporzionali ai kWh, e dividerli per un
   prelievo basso gonfierebbe artificialmente il prezzo. Se un bimestre non
   ha prelievo (quindi il rapporto non e' calcolabile), si usa la media dei
   bimestri calcolabili dello stesso anno. */
function prezziPerBimestre(mesiObj, bimObj) {
  const prezzi = {};
  for (let b = 1; b <= 6; b++) {
    const m1 = mesiObj && mesiObj[2 * b - 1], m2 = mesiObj && mesiObj[2 * b];
    const prelievo = (Number(m1 && m1.kwhPrelevati) || 0) + (Number(m2 && m2.kwhPrelevati) || 0);
    const bim = bimObj && bimObj[b];
    const costoEnergia = Number(bim && bim.costoEnergia) || 0;
    prezzi[b] = prelievo > 0 ? costoEnergia / prelievo : null;
  }
  const validi = Object.values(prezzi).filter(v => v !== null);
  const media = validi.length ? validi.reduce((a, c) => a + c, 0) / validi.length : 0;
  for (let b = 1; b <= 6; b++) if (prezzi[b] === null) prezzi[b] = media;
  return prezzi;
}

/* Prezzo €/kWh EFFETTIVO di un mese: se l'utente lo ha inserito a mano nel
   campo "costo €/kWh" del mese, si usa quello; altrimenti si usa il prezzo
   derivato dalla bolletta del bimestre (vedi prezziPerBimestre). Cosi' il
   valore automatico resta il default, ma resta sempre possibile correggerlo
   mese per mese e far ricalcolare tutto di conseguenza. */
function prezzoEffettivoMese(m, prezziBim, k) {
  const manuale = m && m.costoKwh;
  if (manuale !== null && manuale !== undefined && manuale !== "") return Number(manuale) || 0;
  return prezziBim[Math.ceil(k / 2)];
}

/* Costo virtuale (senza impianto) calcolato mese per mese, col prezzo
   effettivo di ogni mese (manuale se inserito, altrimenti derivato dalla
   bolletta del bimestre): (autoconsumo_mese + prelievo_mese) x prezzo,
   sommato sui 12 mesi. Piu' preciso se il prezzo varia nel corso dell'anno. */
function costoVirtualeMensile(mesiObj, bimObj) {
  if (!mesiObj) return 0;
  const prezziBim = prezziPerBimestre(mesiObj, bimObj);
  let s = 0;
  for (let k = 1; k <= 12; k++) {
    const m = mesiObj[k];
    if (!m) continue;
    const autoc = Number(m.kwhAutoconsumo) || 0;
    const prel = Number(m.kwhPrelevati) || 0;
    const prezzo = prezzoEffettivoMese(m, prezziBim, k);
    s += (autoc + prel) * prezzo;
  }
  return s;
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
      const bim = state.bollette[anno] || {};
      D = sumMese(mesi, "kwhProdotti");
      E = sumMese(mesi, "kwhAutoconsumo");
      F = sumMese(mesi, "kwhCeduti");
      G = sumMese(mesi, "kwhPrelevati");
      I = costoVirtualeMensile(mesi, bim); // somma mese per mese, prezzo effettivo (manuale se inserito, altrimenti dalla bolletta)
      H = (E + G) > 0 ? I / (E + G) : 0; // prezzo medio EFFETTIVO realmente usato, solo informativo
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
  const bim0 = state.bollette[0] || {};
  const I0 = costoVirtualeMensile(mesi0, bim0);
  const H0 = (E0 + G0) > 0 ? I0 / (E0 + G0) : 0;
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
