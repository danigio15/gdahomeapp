// src/core/telecamera-dal-vivo.js
var pulito = (valore) => String(valore ?? "").trim();
var PORTA_ISTANTANEA = "/api/camera_proxy/";
var PORTA_FLUSSO = "/api/camera_proxy_stream/";
function vuoleIlVivo(cam = {}) {
  const scelta = cam?.vivo;
  return scelta === true || scelta === "true" || scelta === 1 || scelta === "1";
}
function flussoDaIstantanea(entityPicture) {
  const foto = pulito(entityPicture);
  if (!foto || !foto.includes(PORTA_ISTANTANEA)) return "";
  return foto.replace(PORTA_ISTANTANEA, PORTA_FLUSSO);
}
function percorsoDelFlusso(entity) {
  const nome = pulito(entity);
  return nome ? `${PORTA_FLUSSO}${encodeURIComponent(nome)}` : "";
}
function percorsoDellIstantanea(entity) {
  const nome = pulito(entity);
  return nome ? `${PORTA_ISTANTANEA}${encodeURIComponent(nome)}` : "";
}
function stessoFlusso(immagine, indirizzo) {
  if (!immagine || !indirizzo) return false;
  return pulito(immagine.dataset?.dmCameraStream) === pulito(indirizzo);
}
var PAUSA_DOPO_CADUTA_MS = 6e4;
function flussoInPausa(immagine, adesso = Date.now()) {
  const fino = Number(immagine?.dataset?.dmCameraStreamPausa);
  return Number.isFinite(fino) && fino > adesso;
}
function mettiInPausaIlFlusso(immagine, adesso = Date.now(), durata = PAUSA_DOPO_CADUTA_MS) {
  if (!immagine?.dataset) return 0;
  const fino = adesso + Math.max(0, Number(durata) || 0);
  immagine.dataset.dmCameraStreamPausa = String(fino);
  return fino;
}

// src/core/colpo-d-occhio.js
var CHIAVE_OCCHIO = "cd_occhio";
var TIPI_DI_RIQUADRO = Object.freeze(["energia", "telecamere", "antifurto", "apri"]);
var RIQUADRI_AL_MASSIMO = 12;
var TELECAMERE_AL_MASSIMO = 24;
var MODI_AL_MASSIMO = 6;
var SERIE_DEI_RIQUADRI = Object.freeze({
  energia: { disegno: "solar", colore: "#f59e0b" },
  telecamere: { disegno: "camera", colore: "#06b6d4" },
  antifurto: { disegno: "security", colore: "#7c3aed" },
  apri: { disegno: "gate", colore: "#059669" }
});
var COLORI_DEI_MODI = ["#7c3aed", "#f59e0b", "#06b6d4", "#e11d48", "#10b981", "#2563eb"];
var clean = (valore) => String(valore ?? "").trim();
var testo = (valore, quanto = 60) => clean(valore).slice(0, quanto);
var elenco = (valore) => Array.isArray(valore) ? valore : [];
var vero = (valore, ripiego) => typeof valore === "boolean" ? valore : ripiego;
function entita(valore) {
  const id = clean(valore);
  return /^[a-z_]+\.[a-z0-9_]+$/i.test(id) && id.length <= 255 ? id : "";
}
var dominio = (id) => entita(id).split(".")[0] || "";
var colore = (valore, ripiego) => {
  const c = clean(valore);
  return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : ripiego;
};
var disegno = (valore, ripiego) => {
  const d = clean(valore);
  return /^[a-z0-9_-]{1,32}$/i.test(d) ? d : ripiego;
};
var contatore = 0;
var nuovoId = () => `r${Date.now().toString(36)}${(contatore++).toString(36)}`.slice(0, 24);
function energiaPulita(grezza = {}) {
  const e = grezza && typeof grezza === "object" ? grezza : {};
  const periodo = (p = {}) => ({
    solare: entita(p?.solare),
    casa: entita(p?.casa),
    comprata: entita(p?.comprata),
    venduta: entita(p?.venduta),
    carica: entita(p?.carica),
    scarica: entita(p?.scarica)
  });
  return {
    solare: entita(e.solare),
    casa: entita(e.casa),
    /* La rete con segno — positiva quando si preleva — o due misure, una per
     * verso. Lo stesso per la batteria: positiva quando scarica. */
    rete: entita(e.rete),
    reteGirata: vero(e.reteGirata, false),
    prelievo: entita(e.prelievo),
    immissione: entita(e.immissione),
    batteria: entita(e.batteria),
    batteriaGirata: vero(e.batteriaGirata, false),
    carica: entita(e.carica),
    scarica: entita(e.scarica),
    soc: entita(e.soc),
    giorno: periodo(e.giorno),
    mese: periodo(e.mese)
  };
}
function modoPulito(grezzo = {}, indice = 0) {
  const m = grezzo && typeof grezzo === "object" ? grezzo : {};
  const id = entita(m.entita);
  if (!id) return null;
  return {
    entita: id,
    /* Dove si legge se e' inserito: di serie l'entita' stessa. */
    stato: entita(m.stato) || id,
    nome: testo(m.nome, 40),
    disegno: disegno(m.disegno, "security"),
    colore: colore(m.colore, COLORI_DEI_MODI[indice % COLORI_DEI_MODI.length])
  };
}
function riquadroPulito(grezzo = {}, indice = 0) {
  const r = grezzo && typeof grezzo === "object" ? grezzo : {};
  const tipo = TIPI_DI_RIQUADRO.includes(r.tipo) ? r.tipo : "";
  if (!tipo) return null;
  const serie = SERIE_DEI_RIQUADRI[tipo];
  return {
    id: /^[a-z0-9_-]{1,24}$/i.test(clean(r.id)) ? clean(r.id) : `r${indice + 1}`,
    tipo,
    nome: testo(r.nome, 30),
    disegno: disegno(r.disegno, serie.disegno),
    colore: colore(r.colore, serie.colore),
    /* Solo per «apri»: cosa si apre, e se chiede prima. */
    entita: tipo === "apri" ? entita(r.entita) : "",
    conferma: tipo === "apri" ? vero(r.conferma, false) : false
  };
}
var OCCHIO_VUOTO = Object.freeze({
  attiva: false,
  titolo: "",
  sottotitolo: "",
  meteo: "",
  riquadri: [],
  energia: energiaPulita({}),
  telecamere: [],
  antifurto: { centrale: "", modi: [] }
});
function occhioPulito(input) {
  let dentro = input;
  if (typeof dentro === "string") {
    try {
      dentro = JSON.parse(dentro);
    } catch {
      dentro = null;
    }
  }
  if (!dentro || typeof dentro !== "object" || Array.isArray(dentro)) dentro = {};
  const visti = /* @__PURE__ */ new Set();
  const riquadri = elenco(dentro.riquadri).slice(0, RIQUADRI_AL_MASSIMO).map((r, i) => riquadroPulito(r, i)).filter(Boolean).map((r, i) => {
    const fuori = visti.has(r.id) ? { ...r, id: `r${i + 1}${nuovoId()}`.slice(0, 24) } : r;
    visti.add(fuori.id);
    return fuori;
  });
  const telecamereViste = /* @__PURE__ */ new Set();
  const telecamere = elenco(dentro.telecamere).map((c) => ({
    entity: entita(c?.entity),
    nome: testo(c?.nome, 40),
    /* Il nome dello stream di go2rtc, per il video WebRTC: facoltativo. */
    stream: /^[a-z0-9_.-]{1,64}$/i.test(clean(c?.stream)) ? clean(c.stream) : "",
    /* «Dal vivo» come nella plancia principale: il flusso continuo al posto
     * delle istantanee ogni quattro secondi. */
    vivo: vero(c?.vivo, false)
  })).filter((c) => {
    if (dominio(c.entity) !== "camera" || telecamereViste.has(c.entity)) return false;
    telecamereViste.add(c.entity);
    return true;
  }).slice(0, TELECAMERE_AL_MASSIMO);
  const antifurto = dentro.antifurto && typeof dentro.antifurto === "object" ? dentro.antifurto : {};
  const centrale = entita(antifurto.centrale);
  return {
    attiva: vero(dentro.attiva, false),
    titolo: testo(dentro.titolo, 40),
    sottotitolo: testo(dentro.sottotitolo, 60),
    meteo: dominio(dentro.meteo) === "weather" ? entita(dentro.meteo) : "",
    riquadri,
    energia: energiaPulita(dentro.energia),
    telecamere,
    antifurto: {
      centrale: dominio(centrale) === "alarm_control_panel" ? centrale : "",
      modi: elenco(antifurto.modi).map((m, i) => modoPulito(m, i)).filter(Boolean).slice(0, MODI_AL_MASSIMO)
    }
  };
}
function nuovoRiquadro(tipo, campi = {}) {
  return riquadroPulito({ id: nuovoId(), tipo, ...campi });
}
var MUTI = /* @__PURE__ */ new Set(["unavailable", "unknown", "none", ""]);
function numeroDi(states, id) {
  const s = states?.[entita(id)];
  const v = clean(s?.state);
  if (!s || MUTI.has(v.toLowerCase())) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function watt(states, id) {
  const n = numeroDi(states, id);
  if (n === null) return null;
  const unita = clean(states?.[id]?.attributes?.unit_of_measurement).toLowerCase();
  return unita === "kw" ? n * 1e3 : unita === "mw" ? n * 1e6 : n;
}
function kwh(states, id) {
  const n = numeroDi(states, id);
  if (n === null) return null;
  const unita = clean(states?.[id]?.attributes?.unit_of_measurement).toLowerCase();
  return unita === "wh" ? n / 1e3 : unita === "mwh" ? n * 1e3 : n;
}
function dueVersi(states, conSegno, girata, unaParte, altraParte) {
  if (entita(unaParte) || entita(altraParte)) {
    return {
      uno: Math.max(0, watt(states, unaParte) ?? 0),
      altro: Math.max(0, watt(states, altraParte) ?? 0),
      noto: watt(states, unaParte) !== null || watt(states, altraParte) !== null
    };
  }
  const v = watt(states, conSegno);
  if (v === null) return { uno: 0, altro: 0, noto: false };
  const s = girata ? -v : v;
  return { uno: Math.max(0, s), altro: Math.max(0, -s), noto: true };
}
var SOGLIA_W = 30;
var SOGLIA_KWH = 0.05;
function flussoDellEnergia(config, states = {}, periodo = "adesso") {
  const e = energiaPulita(config?.energia || config || {});
  const soc = numeroDi(states, e.soc);
  if (periodo === "giorno" || periodo === "mese") {
    const p = e[periodo];
    const leggi = (id) => entita(id) ? kwh(states, id) : null;
    const n2 = {
      solare: leggi(p.solare),
      casa: leggi(p.casa),
      comprata: leggi(p.comprata),
      venduta: leggi(p.venduta),
      carica: leggi(p.carica),
      scarica: leggi(p.scarica)
    };
    const c2 = (v) => (v ?? 0) > SOGLIA_KWH;
    return {
      periodo,
      unita: "kWh",
      soc,
      nodi: n2,
      linee: {
        soleCasa: c2(n2.solare) && c2(n2.casa),
        soleRete: c2(n2.solare) && c2(n2.venduta),
        soleBatteria: c2(n2.solare) && c2(n2.carica),
        reteCasa: c2(n2.comprata),
        batteriaCasa: c2(n2.scarica)
      },
      configurato: Object.values(p).some(Boolean)
    };
  }
  const solare = watt(states, e.solare);
  const casa = watt(states, e.casa);
  const rete = dueVersi(states, e.rete, e.reteGirata, e.prelievo, e.immissione);
  const batt = dueVersi(states, e.batteria, e.batteriaGirata, e.scarica, e.carica);
  const n = {
    solare: solare === null ? null : Math.max(0, solare),
    casa: casa === null ? null : Math.max(0, casa),
    comprata: rete.noto ? rete.uno : null,
    venduta: rete.noto ? rete.altro : null,
    scarica: batt.noto ? batt.uno : null,
    carica: batt.noto ? batt.altro : null
  };
  const c = (v, soglia = SOGLIA_W) => (v ?? 0) > soglia;
  return {
    periodo: "adesso",
    unita: "W",
    soc,
    nodi: n,
    linee: {
      soleCasa: c(n.solare) && c(n.casa),
      soleRete: c(n.solare) && c(n.venduta, 50),
      soleBatteria: c(n.solare) && c(n.carica),
      reteCasa: c(n.comprata, 50),
      batteriaCasa: c(n.scarica)
    },
    configurato: Boolean(e.solare || e.casa || e.rete || e.prelievo || e.batteria || e.scarica)
  };
}
function periodiDellEnergia(config) {
  const e = energiaPulita(config?.energia || {});
  const fuori = [];
  if (e.solare || e.casa || e.rete || e.prelievo || e.batteria || e.scarica) fuori.push("adesso");
  if (Object.values(e.giorno).some(Boolean)) fuori.push("giorno");
  if (Object.values(e.mese).some(Boolean)) fuori.push("mese");
  return fuori;
}
function servizioPerAprire(id) {
  const d = dominio(id);
  if (d === "button" || d === "input_button") return { domain: d, service: "press" };
  if (d === "lock") return { domain: d, service: "unlock" };
  if (d === "cover") return { domain: d, service: "open_cover" };
  if (d === "script" || d === "scene") return { domain: d, service: "turn_on" };
  if (d === "switch" || d === "input_boolean") return { domain: d, service: "turn_on" };
  return null;
}
function servizioDelModo(modo, acceso) {
  const id = entita(modo?.entita);
  const d = dominio(id);
  if (d === "switch" || d === "input_boolean")
    return { domain: d, service: acceso ? "turn_off" : "turn_on" };
  if (d === "button" || d === "input_button") return { domain: d, service: "press" };
  if (d === "script" || d === "scene") return { domain: d, service: "turn_on" };
  if (d === "automation") return { domain: d, service: "trigger" };
  return null;
}
function modoInserito(modo, states = {}) {
  const v = clean(states?.[modo?.stato || modo?.entita]?.state).toLowerCase();
  return v === "on" || v === "armed" || v.startsWith("armed_");
}

// src/core/casa-3d.js
var CHIAVE_CASA3D = "cd_casa3d";
var VERSIONE_CASA3D = 1;
var PIANI_AL_MASSIMO = 12;
var STANZE_AL_MASSIMO = 60;
var ARREDI_AL_MASSIMO = 600;
var DISPOSITIVI_AL_MASSIMO = 400;
var APERTURE_AL_MASSIMO = 300;
var PASSO_SALVATO = 0.05;
var CELLE_AL_MASSIMO = 1200 * 1200;
var CELLA = Object.freeze({ fuori: -2, muro: -3, davanzale: -4, porta: -5 });
var DISPOSITIVI_3D = Object.freeze({
  luce: { icona: "💡", nome: ["Punto luce", "Light"], domini: ["light", "switch"], classi: [], parole: ["luce", "lamp", "light", "faretti", "plafon"], mont: "soffitto", tocco: "accendi" },
  telecamera: { icona: "📷", nome: ["Telecamera", "Camera"], domini: ["camera"], classi: [], parole: ["cam", "telecamera"], mont: "angolo", tocco: "guarda" },
  tapparella: { icona: "🪟", nome: ["Tapparella", "Shutter"], domini: ["cover"], classi: ["shutter", "blind", "window", "curtain", "awning", "shade"], parole: ["tapparella", "persiana", "tenda", "shutter"], mont: "finestra", tocco: "apri" },
  finestra: { icona: "🪟", nome: ["Sensore finestra", "Window sensor"], domini: ["binary_sensor"], classi: ["window", "opening"], parole: ["finestra", "window"], mont: "finestra", tocco: null },
  porta: { icona: "🚪", nome: ["Sensore porta", "Door sensor"], domini: ["binary_sensor", "lock"], classi: ["door", "garage_door", "opening"], parole: ["porta", "door", "ingresso", "portone"], mont: "porta", tocco: null },
  movimento: { icona: "🚶", nome: ["Sensore movimento", "Motion sensor"], domini: ["binary_sensor"], classi: ["motion", "occupancy"], parole: ["movimento", "motion", "pir"], mont: "angolo", tocco: null },
  presenza: { icona: "📡", nome: ["Sensore presenza", "Presence sensor"], domini: ["binary_sensor"], classi: ["occupancy", "presence"], parole: ["presenza", "presence", "mmwave", "occupancy"], mont: "soffitto", tocco: null },
  termometro: { icona: "🌡️", nome: ["Termometro", "Thermometer"], domini: ["sensor"], classi: ["temperature"], parole: ["temperatura", "temperature"], mont: "muro", tocco: null },
  clima: { icona: "❄️", nome: ["Climatizzatore", "Air conditioner"], domini: ["climate"], classi: [], parole: ["clima", "condizionatore", "split", "ac"], mont: "muro", tocco: "accendi" },
  termostato: { icona: "🔥", nome: ["Termostato", "Thermostat"], domini: ["climate"], classi: [], parole: ["termostato", "thermostat", "riscaldamento"], mont: "muro", tocco: null },
  fumo: { icona: "🚨", nome: ["Rilevatore fumo", "Smoke detector"], domini: ["binary_sensor"], classi: ["smoke", "gas", "carbon_monoxide"], parole: ["fumo", "smoke", "gas"], mont: "soffitto", tocco: null },
  acqua: { icona: "💧", nome: ["Sensore allagamento", "Leak sensor"], domini: ["binary_sensor"], classi: ["moisture"], parole: ["acqua", "allagamento", "leak", "water"], mont: "pavimento", tocco: null },
  presa: { icona: "🔌", nome: ["Presa", "Plug"], domini: ["switch"], classi: ["outlet"], parole: ["presa", "plug", "outlet"], mont: "muro", tocco: "accendi" },
  tv: { icona: "📺", nome: ["TV", "TV"], domini: ["media_player"], classi: ["tv"], parole: ["tv", "televisore"], mont: "muro", tocco: "accendi" },
  altoparlante: { icona: "🔊", nome: ["Altoparlante", "Speaker"], domini: ["media_player"], classi: ["speaker"], parole: ["echo", "speaker", "sonos", "altoparlante"], mont: "muro", tocco: null },
  antifurto: { icona: "🛡️", nome: ["Sirena / sensore allarme", "Alarm sensor"], domini: ["binary_sensor", "alarm_control_panel"], classi: ["motion", "tamper", "safety"], parole: ["allarme", "alarm", "sirena"], mont: "angolo", tocco: null },
  pannello: { icona: "🖲️", nome: ["Pannello / interruttore", "Wall panel"], domini: ["switch", "light", "button", "event"], classi: [], parole: ["pannello", "interruttore", "touch"], mont: "muro", tocco: null }
});
var TIPI_DI_DISPOSITIVO = Object.freeze(Object.keys(DISPOSITIVI_3D));
var clean2 = (v) => String(v ?? "").trim();
var testo2 = (v, quanto = 60) => clean2(v).slice(0, quanto);
var elenco2 = (v) => Array.isArray(v) ? v : [];
var numero = (v, min, max, ripiego) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : ripiego;
};
var colore2 = (v, ripiego = "") => /^#[0-9a-f]{6}$/i.test(clean2(v)) ? clean2(v).toLowerCase() : ripiego;
var chiave = (v, ripiego = "") => /^[a-z0-9_]{1,24}$/.test(clean2(v)) ? clean2(v) : ripiego;
var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function aBase64(byte) {
  let out = "";
  for (let i = 0; i < byte.length; i += 3) {
    const a = byte[i], b = byte[i + 1], c = byte[i + 2];
    out += B64[a >> 2] + B64[(a & 3) << 4 | (b ?? 0) >> 4];
    out += b === void 0 ? "=" : B64[(b & 15) << 2 | (c ?? 0) >> 6];
    out += c === void 0 ? "=" : B64[c & 63];
  }
  return out;
}
function daBase64(testo64) {
  const s = clean2(testo64).replace(/[^A-Za-z0-9+/]/g, "");
  const out = [];
  for (let i = 0; i < s.length; i += 4) {
    const n = [0, 1, 2, 3].map((k) => B64.indexOf(s[i + k] ?? "A"));
    out.push(n[0] << 2 | n[1] >> 4);
    if (i + 2 < s.length) out.push((n[1] & 15) << 4 | n[2] >> 2);
    if (i + 3 < s.length) out.push((n[2] & 3) << 6 | n[3]);
  }
  return out;
}
function comprimiGriglia(tipo) {
  const byte = [];
  const N = tipo.length;
  for (let i = 0; i < N; ) {
    const v = Math.max(-8, Math.min(247, tipo[i] | 0));
    let n = 1;
    while (i + n < N && Math.max(-8, Math.min(247, tipo[i + n] | 0)) === v) n++;
    byte.push(v + 8);
    let resto = n;
    do {
      let b = resto & 127;
      resto = Math.floor(resto / 128);
      if (resto > 0) b |= 128;
      byte.push(b);
    } while (resto > 0);
    i += n;
  }
  return aBase64(byte);
}
function espandiGriglia(testo64, N) {
  const tipo = new Int16Array(Math.max(0, Math.min(CELLE_AL_MASSIMO, N | 0))).fill(CELLA.fuori);
  const byte = daBase64(testo64);
  let i = 0, k = 0;
  while (k < byte.length && i < tipo.length) {
    const v = byte[k++] - 8;
    let n = 0, peso = 1, b;
    do {
      b = byte[k++] ?? 0;
      n += (b & 127) * peso;
      peso *= 128;
    } while (b & 128 && k < byte.length);
    const fine = Math.min(tipo.length, i + n);
    for (; i < fine; i++) tipo[i] = v;
  }
  return tipo;
}
function ricampiona({ W, H, passo, tipo }, nuovoPasso = PASSO_SALVATO) {
  const f = passo / nuovoPasso;
  const W2 = Math.max(1, Math.round(W * f)), H2 = Math.max(1, Math.round(H * f));
  const out = new Int16Array(W2 * H2);
  for (let y = 0; y < H2; y++) {
    const sy = Math.min(H - 1, Math.floor((y + 0.5) / f));
    for (let x = 0; x < W2; x++) {
      const sx = Math.min(W - 1, Math.floor((x + 0.5) / f));
      out[y * W2 + x] = tipo[sy * W + sx];
    }
  }
  return { W: W2, H: H2, passo: nuovoPasso, tipo: out };
}
var punto = (p) => ({ x: numero(p?.x, -500, 500, 0), y: numero(p?.y, -500, 500, 0) });
function stanzaPulita(s) {
  const id = Number(s?.id);
  if (!Number.isInteger(id) || id < 1 || id > 247) return null;
  return {
    id,
    nome: testo2(s?.nome, 40) || `Stanza ${id}`,
    area: testo2(s?.area, 64),
    // l'area di Home Assistant (area_id), se c'e'
    pavimento: s?.pavimento ? { tipo: chiave(s.pavimento.tipo, "gres60"), colore: colore2(s.pavimento.colore, "#d9cbb3"), colore2: colore2(s.pavimento.colore2), diagonale: s.pavimento.diagonale === true } : null,
    pareti: colore2(s?.pareti),
    fuori: s?.fuori === true
  };
}
function aperturaPulita(a) {
  const tipo = ["porta", "finestra"].includes(a?.tipo) ? a.tipo : null;
  if (!tipo) return null;
  return { tipo, ...punto({ x: a.cx ?? a.x, y: a.cy ?? a.y }), largo: numero(a?.largo, 0.4, 6, 0.9), orizz: a?.orizz !== false, verso: [-1, 0, 1].includes(a?.verso) ? a.verso : 0, portafinestra: a?.portafinestra === true, stanza: numero(a?.stanza, 0, 247, 0) | 0 };
}
function arredoPulito(a) {
  const k = chiave(a?.k);
  if (!k) return null;
  return { k, stanza: numero(a?.stanza, 0, 247, 0) | 0, ...punto(a), rot: numero(a?.rot, -100, 100, 0), tinta: colore2(a?.tinta), sotto: a?.sotto === true };
}
function dispositivoPulito(d) {
  const k = TIPI_DI_DISPOSITIVO.includes(d?.k) ? d.k : null;
  if (!k) return null;
  return {
    k,
    stanza: numero(d?.stanza, 0, 247, 0) | 0,
    ...punto(d),
    h: numero(d?.h, 0, 4, DISPOSITIVI_3D[k].mont === "soffitto" ? 2.9 : DISPOSITIVI_3D[k].mont === "pavimento" ? 0 : 2.3),
    rot: numero(d?.rot, -100, 100, 0),
    entity: entita(d?.entity),
    nome: testo2(d?.nome, 40),
    fov: k === "telecamera" ? numero(d?.fov, 40, 180, 100) : void 0,
    da: ["foto", "mano", "auto"].includes(d?.da) ? d.da : "mano"
  };
}
function pianoPulito(p, i) {
  const W = numero(p?.W, 1, 1200, 0) | 0, H = numero(p?.H, 1, 1200, 0) | 0;
  if (!W || !H || W * H > CELLE_AL_MASSIMO || !clean2(p?.griglia)) return null;
  const stanze = elenco2(p?.stanze).map(stanzaPulita).filter(Boolean).slice(0, STANZE_AL_MASSIMO);
  return {
    k: chiave(p?.k, `piano${i}`),
    nome: testo2(p?.nome, 30) || `Piano ${i}`,
    livello: numero(p?.livello, -3, 30, i) | 0,
    W,
    H,
    passo: numero(p?.passo, 0.02, 0.2, PASSO_SALVATO),
    griglia: clean2(p.griglia).slice(0, 2e6),
    stanze,
    aperture: elenco2(p?.aperture).map(aperturaPulita).filter(Boolean).slice(0, APERTURE_AL_MASSIMO),
    arredi: elenco2(p?.arredi).map(arredoPulito).filter(Boolean).slice(0, ARREDI_AL_MASSIMO),
    dispositivi: elenco2(p?.dispositivi).map(dispositivoPulito).filter(Boolean).slice(0, DISPOSITIVI_AL_MASSIMO)
  };
}
function casa3dPulita(raw) {
  const c = raw && typeof raw === "object" ? raw : {};
  const e = c.esterno && typeof c.esterno === "object" ? c.esterno : {};
  const tipo = c.tipo === "palazzo" ? "palazzo" : "villa";
  const piani = elenco2(c.piani).map(pianoPulito).filter(Boolean).slice(0, PIANI_AL_MASSIMO);
  return {
    versione: VERSIONE_CASA3D,
    attiva: c.attiva === true && piani.length > 0,
    tipo,
    esterno: {
      pianiPalazzo: numero(e.pianiPalazzo, 2, 20, 6) | 0,
      mioPiano: numero(e.mioPiano, 0, 19, 0) | 0,
      tetto: e.tetto === "piano" ? "piano" : "falde",
      facciata: colore2(e.facciata, "#e9d4ae"),
      persiane: colore2(e.persiane, "#3f6b4e"),
      coppi: colore2(e.coppi, "#b5532f"),
      giardino: e.giardino !== false,
      telecamere: elenco2(e.telecamere).map(dispositivoPulito).filter((d) => d && d.k === "telecamera").slice(0, 16)
    },
    piani
  };
}
var CASA3D_VUOTA = Object.freeze(casa3dPulita({}));
var parole = (s) => clean2(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 2);
function entitaCandidate(k, { stanza = "", area = "", states = {}, aree = {}, usate = [] } = {}) {
  const D = DISPOSITIVI_3D[k];
  if (!D) return [];
  const daStanza = /* @__PURE__ */ new Set([...parole(stanza), ...parole(area)]);
  const usateSet = new Set(usate);
  const out = [];
  for (const [id, st] of Object.entries(states || {})) {
    const dom = id.split(".")[0];
    if (!D.domini.includes(dom)) continue;
    const attr = st?.attributes || {};
    const classe = clean2(attr.device_class);
    if (D.classi.length && dom === "binary_sensor" && !D.classi.includes(classe)) continue;
    if (D.classi.length && dom === "sensor" && !D.classi.includes(classe)) continue;
    let punti = 10;
    if (D.classi.includes(classe)) punti += 20;
    const nome = `${id} ${attr.friendly_name || ""}`;
    const sue = parole(nome);
    if (sue.some((w) => D.parole.some((p) => w.startsWith(p)))) punti += 8;
    const suaArea = aree[id] || "";
    if (suaArea && area && suaArea === area) punti += 40;
    if (sue.some((w) => daStanza.has(w)) || parole(suaArea).some((w) => daStanza.has(w))) punti += 25;
    if (usateSet.has(id)) punti -= 50;
    if (st?.state === "unavailable") punti -= 5;
    out.push({ entity: id, nome: clean2(attr.friendly_name) || id, punti });
  }
  return out.sort((a, b) => b.punti - a.punti || a.nome.localeCompare(b.nome));
}
function entitaProposta(k, contesto) {
  const [prima] = entitaCandidate(k, contesto);
  return prima && prima.punti >= 35 ? prima.entity : "";
}
var ACCESO = /* @__PURE__ */ new Set(["on", "open", "opening", "detected", "home", "playing", "heat", "cool", "heat_cool", "auto", "dry", "fan_only", "triggered", "unlocked"]);
function statoDelDispositivo(k, st, italiano = true) {
  const D = DISPOSITIVI_3D[k];
  const s = clean2(st?.state);
  const L = (it, en) => italiano ? it : en;
  if (!D || !st) return { attivo: false, testo: D?.icona || "", tono: "spento", disponibile: false };
  if (s === "unavailable" || s === "unknown") return { attivo: false, testo: `${D.icona} ${L("non risponde", "offline")}`, tono: "spento", disponibile: false };
  const attr = st.attributes || {};
  switch (k) {
    case "luce":
    case "presa":
    case "tv": {
      const pct = typeof attr.brightness === "number" ? ` ${Math.round(attr.brightness / 255 * 100)}%` : "";
      return { attivo: s === "on" || s === "playing", testo: `${D.icona}${s === "on" ? pct || " " + L("accesa", "on") : s === "playing" ? " ▶" : ""}`, tono: s === "on" || s === "playing" ? "luce" : "spento", disponibile: true, luminosita: typeof attr.brightness === "number" ? attr.brightness / 255 : s === "on" ? 1 : 0 };
    }
    case "tapparella": {
      const pos = typeof attr.current_position === "number" ? attr.current_position : s === "open" ? 100 : s === "closed" ? 0 : 50;
      return { attivo: pos > 0, testo: `${D.icona} ${pos === 0 ? L("chiusa", "closed") : pos === 100 ? L("aperta", "open") : pos + "%"}`, tono: "neutro", disponibile: true, apertura: pos / 100 };
    }
    case "finestra":
    case "porta": {
      const aperta = s === "on" || s === "open" || s === "unlocked";
      return { attivo: aperta, testo: aperta ? `${D.icona} ${L("aperta", "open")}` : D.icona, tono: aperta ? "allarme" : "neutro", disponibile: true, apertura: aperta ? 1 : 0 };
    }
    case "movimento":
    case "presenza":
    case "antifurto":
      return { attivo: s === "on" || s === "triggered", testo: s === "on" || s === "triggered" ? `${D.icona} ${L("movimento", "motion")}` : D.icona, tono: s === "on" || s === "triggered" ? "movimento" : "neutro", disponibile: true };
    case "fumo":
    case "acqua":
      return { attivo: s === "on", testo: s === "on" ? `${D.icona} ${L("ALLARME", "ALARM")}` : D.icona, tono: s === "on" ? "allarme" : "ok", disponibile: true };
    case "termometro": {
      const v = Number(s);
      return { attivo: false, testo: Number.isFinite(v) ? `${D.icona} ${v.toFixed(1).replace(".", italiano ? "," : ".")}°` : D.icona, tono: "clima", disponibile: true };
    }
    case "clima":
    case "termostato": {
      const t = attr.current_temperature;
      return { attivo: ACCESO.has(s) && s !== "off", testo: `${D.icona}${typeof t === "number" ? " " + t.toFixed(1).replace(".", italiano ? "," : ".") + "°" : ""}${s === "off" ? "" : " · " + s}`, tono: s === "off" ? "spento" : "clima", disponibile: true };
    }
    case "telecamera":
      return { attivo: true, testo: `${D.icona} ${L("live", "live")}`, tono: "telecamera", disponibile: true };
    default:
      return { attivo: ACCESO.has(s), testo: D.icona, tono: "neutro", disponibile: true };
  }
}
function azioneDelTocco(k, entity, st) {
  const D = DISPOSITIVI_3D[k];
  const id = entita(entity);
  if (!D || !id) return null;
  const dom = id.split(".")[0];
  if (D.tocco === "guarda") return { pagina: "telecamera", entity: id };
  if (D.tocco === "accendi") {
    if (dom === "climate") return { domain: "climate", service: clean2(st?.state) === "off" ? "turn_on" : "turn_off", data: { entity_id: id } };
    if (["light", "switch", "media_player", "fan"].includes(dom)) return { domain: dom, service: "toggle", data: { entity_id: id } };
  }
  if (D.tocco === "apri" && dom === "cover") {
    const s = clean2(st?.state);
    return { domain: "cover", service: s === "opening" || s === "closing" ? "stop_cover" : s === "closed" ? "open_cover" : "close_cover", data: { entity_id: id } };
  }
  return null;
}
function contaCollegati(casa) {
  let tutti = 0, collegati = 0;
  for (const p of casa?.piani || []) for (const d of p.dispositivi || []) {
    tutti++;
    if (d.entity) collegati++;
  }
  for (const d of casa?.esterno?.telecamere || []) {
    tutti++;
    if (d.entity) collegati++;
  }
  return { tutti, collegati, mancano: tutti - collegati };
}

export {
  vuoleIlVivo,
  flussoDaIstantanea,
  percorsoDelFlusso,
  percorsoDellIstantanea,
  stessoFlusso,
  flussoInPausa,
  mettiInPausaIlFlusso,
  CHIAVE_OCCHIO,
  TIPI_DI_RIQUADRO,
  RIQUADRI_AL_MASSIMO,
  TELECAMERE_AL_MASSIMO,
  MODI_AL_MASSIMO,
  entita,
  occhioPulito,
  nuovoRiquadro,
  flussoDellEnergia,
  periodiDellEnergia,
  servizioPerAprire,
  servizioDelModo,
  modoInserito,
  CHIAVE_CASA3D,
  PIANI_AL_MASSIMO,
  PASSO_SALVATO,
  CELLA,
  DISPOSITIVI_3D,
  TIPI_DI_DISPOSITIVO,
  comprimiGriglia,
  espandiGriglia,
  ricampiona,
  dispositivoPulito,
  casa3dPulita,
  entitaCandidate,
  entitaProposta,
  statoDelDispositivo,
  azioneDelTocco,
  contaCollegati
};
