/* Le colonnine rapide d'Italia, nella casa: per le soste di ricarica.
 *
 * Il pianificatore dei viaggi (`viaggi.js`) calcola le soste di un'auto
 * elettrica (`soste.js`), e per dire «fermati all'area di servizio tale» deve
 * sapere dove sono le colonnine. Le sa gdanav: il navigatore porta con se'
 * l'archivio di OpenStreetMap e della Piattaforma Unica Nazionale (PUN), e la
 * sua officina ne pubblica ogni settimana la parte che serve qui — le sole
 * colonnine con almeno una presa da 50 kW in su — nella release «anteprima»:
 *
 *   https://github.com/danigio15/gdanav/releases/download/anteprima/colonnine-rapide.json.gz
 *
 * La casa lo scarica UNA volta a settimana — e alla prima richiesta, se non
 * l'ha — e lo tiene in `/data` (la cartella che sopravvive agli
 * aggiornamenti dell'add-on). Le soste si cercano in casa, sull'archivio:
 * nessuna chiave, e nessuna domanda che dica a qualcuno da dove si parte e
 * dove si va — si scarica tutta l'Italia, uguale per tutti. Nell'immagine
 * dell'add-on non c'e' niente: l'add-on resta leggero.
 *
 * Se l'archivio non c'e', non si scarica o e' rotto, nessuno resta fermo: le
 * soste si dicono a chilometro («Sosta intorno al km 268»), e si riprova piu'
 * tardi. Un archivio rotto non sostituisce mai uno buono.
 *
 * IL FORMATO. E' quello dell'archivio dell'app (`ArchivioColonnine.scrivi` in
 * gdanav), compresso con gzip:
 *
 *   { "v": 1,
 *     "generato": "2026-09-29T05:10:58Z",   quando l'ha fatto l'officina
 *     "evseInOrdine": true,                  gli EVSE ID (ottavo campo) sono
 *                                            nell'ordine delle prese: il
 *                                            punto i-esimo e' la presa
 *                                            i-esima. Serve all'app per lo
 *                                            stato presa per presa; qui no
 *     "q": [[riga, colonna], …],             i riquadri di mezzo grado
 *                                            (floor(lat / 0.5),
 *                                            floor(lon / 0.5)) cercati
 *                                            davvero, anche vuoti: dove non
 *                                            c'e' una rapida, e' vero che non
 *                                            ce ne sono
 *     "c": [[lat, lon, "osm-node-…", "nome", "operatore",
 *            [[tipo, kW, quante], …],        tipo: 0 CCS2, 1 CHAdeMO,
 *                                            2 Tipo 2, 3 Tesla
 *            "fonte"?, [evse…]?, 0?], …] }   facoltativi: la fonte («pun»,
 *                                            «osm+pun»; senza, OpenStreetMap),
 *                                            gli EVSE ID della PUN, e 0 se lo
 *                                            stato che la PUN ne da' e' fisso
 *
 * Qui si tengono posizione, id, nome, operatore e la presa piu' potente; il
 * resto lo usa l'app in viaggio, per vedere se sono libere.
 *
 * LE FONTI E LA LICENZA. I dati sono di OpenStreetMap (© i suoi
 * collaboratori, ODbL 1.0) e della Piattaforma Unica Nazionale dei punti di
 * ricarica (CC BY 4.0): vanno citati dove si vedono, e la pagina lo fa con
 * `FONTI_DELLE_COLONNINE`.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { chilometriDellaLinea, CORRIDOIO_KM, distanzaKm, lineaBuona, sullaLinea } from "./soste.js";

export const INDIRIZZO_DELLE_COLONNINE =
  "https://github.com/danigio15/gdanav/releases/download/anteprima/colonnine-rapide.json.gz";

/* Le fonti da citare dove le colonnine si vedono. */
export const FONTI_DELLE_COLONNINE = Object.freeze({
  dati: Object.freeze([
    Object.freeze({
      nome: "OpenStreetMap",
      licenza: "ODbL 1.0",
      indirizzo: "https://www.openstreetmap.org/copyright",
    }),
    Object.freeze({
      nome: "Piattaforma Unica Nazionale (PUN)",
      licenza: "CC BY 4.0",
      indirizzo: "https://www.piattaformaunicanazionale.it",
    }),
  ]),
});

const MINUTO = 60_000;
const ORA = 60 * MINUTO;
const GIORNO = 24 * ORA;

/* Ogni quanto si riscarica, e dopo quanto si riprova se non e' andata. */
export const OGNI_QUANTO = 7 * GIORNO;
export const RIPROVA_DOPO = ORA;

/* Il file compresso che si accetta, e quanto puo' diventare aperto. Quello
 * vero e' meno di un megabyte, e due aperto: sono tetti, non misure. */
export const PESO_MASSIMO = 10 * 1024 * 1024;
export const APERTO_AL_PIU = 40 * 1024 * 1024;

/* Il riquadro dell'archivio: mezzo grado, come nell'app. */
const LATO = 0.5;

const FILE_COMPRESSO = "colonnine-rapide.json.gz";
const FILE_DEL_SEGNO = "colonnine.json";

const numero = (valore) => {
  if (typeof valore !== "number") return null;
  return Number.isFinite(valore) ? valore : null;
};

const testo = (valore, massimo) =>
  typeof valore === "string" ? valore.trim().replace(/\s+/g, " ").slice(0, massimo) : "";

/* ── leggere l'archivio ─────────────────────────────────────────────────── */

/** Una riga dell'archivio, ripulita: `null` se non sta in piedi. */
export function colonninaPulita(riga) {
  if (!Array.isArray(riga) || riga.length < 6) return null;
  const lat = numero(riga[0]);
  const lon = numero(riga[1]);
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  if (!Array.isArray(riga[5])) return null;
  let kw = 0;
  for (const presa of riga[5].slice(0, 64)) {
    if (!Array.isArray(presa)) continue;
    const potenza = numero(presa[1]);
    if (potenza !== null && potenza > 0 && potenza <= 1000) kw = Math.max(kw, potenza);
  }
  if (!kw) return null;
  return {
    lat,
    lon,
    id: testo(riga[2], 80),
    nome: testo(riga[3], 120),
    operatore: testo(riga[4], 80),
    kw,
  };
}

/**
 * L'archivio aperto, verificato: `{ generato, evseInOrdine, colonnine }`, o
 * `null` se non e' quello che deve essere — un'altra versione, niente righe
 * buone. Le righe storte si saltano una per una.
 */
export function archivioPulito(dati) {
  if (!dati || typeof dati !== "object" || Array.isArray(dati)) return null;
  if (dati.v !== 1 || !Array.isArray(dati.c)) return null;
  const colonnine = dati.c.map(colonninaPulita).filter(Boolean);
  if (!colonnine.length) return null;
  return {
    generato: testo(dati.generato, 40),
    evseInOrdine: dati.evseInOrdine === true,
    colonnine,
  };
}

/** I byte scaricati (gzip, o JSON in chiaro) diventano un archivio, o `null`. */
export function apriLArchivio(byte) {
  try {
    if (!byte || byte.length > PESO_MASSIMO) return null;
    const compresso = byte[0] === 0x1f && byte[1] === 0x8b;
    const aperto = compresso ? gunzipSync(byte, { maxOutputLength: APERTO_AL_PIU }) : byte;
    if (aperto.length > APERTO_AL_PIU) return null;
    return archivioPulito(JSON.parse(Buffer.from(aperto).toString("utf8")));
  } catch (_errore) {
    return null;
  }
}

/* ── cercare vicino a una strada ────────────────────────────────────────── */

const riquadro = (lat, lon) => `${Math.floor(lat / LATO)},${Math.floor(lon / LATO)}`;

/** Le colonnine divise per riquadri, per cercare solo dove passa la strada. */
export function indice(colonnine) {
  const perRiquadro = new Map();
  for (const c of colonnine) {
    const chiave = riquadro(c.lat, c.lon);
    if (!perRiquadro.has(chiave)) perRiquadro.set(chiave, []);
    perRiquadro.get(chiave).push(c);
  }
  return perRiquadro;
}

/**
 * Le colonnine entro `corridoioKm` dalla strada, ognuna con `km` (dove cade
 * lungo la strada, sui `kmTotali` di OSRM) e `scostoKm`, in ordine di strada.
 */
export function vicinoAllaLinea(
  perRiquadro,
  linea,
  { kmTotali = null, corridoioKm = CORRIDOIO_KM } = {},
) {
  const strada = lineaBuona(linea);
  if (strada.length < 2 || !perRiquadro?.size) return [];
  const progressivi = chilometriDellaLinea(strada, kmTotali);
  /* I riquadri toccati: si cammina la strada a passi di 5 km al piu', e
   * intorno a ogni passo si guarda quanto il corridoio. */
  const toccati = new Set();
  const margineLat = corridoioKm / 110.574 + 0.01;
  for (let i = 1; i < strada.length; i += 1) {
    const [a, b] = [strada[i - 1], strada[i]];
    const passi = Math.max(1, Math.ceil(distanzaKm(a, b) / 5));
    for (let p = 0; p <= passi; p += 1) {
      const lon = a[0] + ((b[0] - a[0]) * p) / passi;
      const lat = a[1] + ((b[1] - a[1]) * p) / passi;
      const margineLon =
        corridoioKm / (111.32 * Math.max(0.1, Math.cos((lat * Math.PI) / 180))) + 0.01;
      for (const dLat of [-margineLat, 0, margineLat])
        for (const dLon of [-margineLon, 0, margineLon])
          toccati.add(riquadro(lat + dLat, lon + dLon));
    }
  }
  const trovate = [];
  for (const chiave of toccati) {
    for (const c of perRiquadro.get(chiave) || []) {
      const dove = sullaLinea(strada, progressivi, c.lat, c.lon);
      if (dove && dove.scostoKm <= corridoioKm) trovate.push({ ...c, ...dove });
    }
  }
  return trovate.sort((a, b) => a.km - b.km);
}

/* ── tenerlo in casa ────────────────────────────────────────────────────── */

/* Il corpo della risposta, ma non oltre `tetto` byte: un server che manda un
 * file senza fine non riempie la memoria della casa. `null` se e' troppo. */
async function leggiAlPiu(risposta, tetto) {
  const lettore = risposta.body?.getReader?.();
  if (!lettore) {
    const tutto = Buffer.from(await risposta.arrayBuffer());
    return tutto.length > tetto ? null : tutto;
  }
  const pezzi = [];
  let quanti = 0;
  for (;;) {
    const { done, value } = await lettore.read();
    if (done) break;
    quanti += value.length;
    if (quanti > tetto) {
      await lettore.cancel().catch(() => {});
      return null;
    }
    pezzi.push(value);
  }
  return Buffer.concat(pezzi);
}

export class Colonnine {
  constructor({
    cartella = "",
    scarica = (indirizzo, opzioni) => fetch(indirizzo, opzioni),
    adesso = () => Date.now(),
    registro = null,
    indirizzo = INDIRIZZO_DELLE_COLONNINE,
  } = {}) {
    this.cartella = cartella;
    this.scarica = scarica;
    this.adesso = adesso;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.indirizzo = indirizzo;
    this._archivio = null;
    this._indice = null;
    this._scaricatoIl = 0;
    this._tentatoIl = 0;
    this._inCorso = null;
    this._lettoDalDisco = false;
  }

  /* Il segno di quando lo si e' scaricato, accanto al file. */
  _segno() {
    try {
      const letto = JSON.parse(readFileSync(join(this.cartella, FILE_DEL_SEGNO), "utf8"));
      return letto && typeof letto === "object" ? letto : {};
    } catch (_errore) {
      return {};
    }
  }

  _dalDisco() {
    if (this._lettoDalDisco || !this.cartella) return;
    this._lettoDalDisco = true;
    try {
      const archivio = apriLArchivio(readFileSync(join(this.cartella, FILE_COMPRESSO)));
      if (!archivio) return;
      this._metti(archivio);
      const quando = Number(this._segno().scaricatoIl);
      this._scaricatoIl = Number.isFinite(quando) ? quando : 0;
    } catch (_errore) {
      /* Non c'e' ancora: si scarichera'. */
    }
  }

  _metti(archivio) {
    this._archivio = archivio;
    this._indice = indice(archivio.colonnine);
  }

  _suDisco(byte, archivio) {
    if (!this.cartella) return;
    try {
      mkdirSync(this.cartella, { recursive: true });
      const diFianco = join(this.cartella, `.${Date.now()}.colonnine.parziale`);
      writeFileSync(diFianco, byte);
      renameSync(diFianco, join(this.cartella, FILE_COMPRESSO));
      const segno = join(this.cartella, `.${Date.now()}.segno.parziale`);
      writeFileSync(
        segno,
        JSON.stringify({
          scaricatoIl: this._scaricatoIl,
          generato: archivio.generato,
          quante: archivio.colonnine.length,
          peso: byte.length,
        }),
      );
      renameSync(segno, join(this.cartella, FILE_DEL_SEGNO));
    } catch (errore) {
      this.registro.attenzione(`colonnine non scritte: ${errore?.message || errore}`);
    }
  }

  async _scaricaOra() {
    this._tentatoIl = this.adesso();
    try {
      const risposta = await this.scarica(this.indirizzo, {
        headers: { "user-agent": "gdahome (Home Assistant add-on)" },
        signal: AbortSignal.timeout(60_000),
      });
      if (!risposta?.ok) {
        this.registro.attenzione(`colonnine: l'archivio ha risposto ${risposta?.status}`);
        return;
      }
      const dichiarato = Number(risposta.headers?.get?.("content-length"));
      if (Number.isFinite(dichiarato) && dichiarato > PESO_MASSIMO) {
        this.registro.attenzione(`colonnine: l'archivio e' troppo grande (${dichiarato} byte)`);
        return;
      }
      const byte = await leggiAlPiu(risposta, PESO_MASSIMO);
      if (!byte) {
        this.registro.attenzione("colonnine: l'archivio e' troppo grande, non lo prendo");
        return;
      }
      const archivio = apriLArchivio(byte);
      if (!archivio) {
        this.registro.attenzione(
          "colonnine: l'archivio scaricato non e' buono, tengo quello di prima",
        );
        return;
      }
      this._scaricatoIl = this.adesso();
      this._metti(archivio);
      this._suDisco(byte, archivio);
      this.registro.info(`colonnine: ${archivio.colonnine.length} rapide (${archivio.generato})`);
    } catch (errore) {
      this.registro.attenzione(
        `colonnine: l'archivio non si scarica (${errore?.message || errore})`,
      );
    }
  }

  /** Se e' ora di riscaricare: mai scaricato, o piu' vecchio di una settimana. */
  daRifare() {
    const ora = this.adesso();
    if (this._inCorso) return false;
    if (this._tentatoIl && ora - this._tentatoIl < RIPROVA_DOPO) return false;
    return !this._archivio || ora - this._scaricatoIl >= OGNI_QUANTO;
  }

  /**
   * L'archivio, se c'e'. Se e' da scaricare lo si scarica, ma non si aspetta
   * piu' di `attesaMs`: chi chiede la strada riceve le soste a chilometro, e
   * la prossima volta le colonnine. Non solleva mai.
   */
  async pronto({ attesaMs = 5000 } = {}) {
    this._dalDisco();
    if (this.daRifare()) {
      this._inCorso = this._scaricaOra().finally(() => {
        this._inCorso = null;
      });
    }
    if (this._inCorso && !this._archivio) {
      let timer = null;
      await Promise.race([
        this._inCorso,
        new Promise((fine) => {
          timer = setTimeout(fine, attesaMs);
        }),
      ]);
      clearTimeout(timer);
    }
    return this._archivio;
  }

  /** Le colonnine vicino alla strada: `[]` se l'archivio non c'e'. */
  async lungo(linea, { kmTotali = null, corridoioKm = CORRIDOIO_KM, attesaMs = 5000 } = {}) {
    const archivio = await this.pronto({ attesaMs });
    if (!archivio) return { colonnine: [], archivio: false };
    return {
      colonnine: vicinoAllaLinea(this._indice, linea, { kmTotali, corridoioKm }),
      archivio: true,
    };
  }
}
