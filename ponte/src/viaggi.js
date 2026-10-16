/* I viaggi pianificati di gdanav: stanno nella casa.
 *
 * «Se salvo il viaggio da PC me lo ritrovo su Android Auto e CarPlay?» Si',
 * perche' il viaggio non sta ne' nel PC ne' nel telefono: sta qui. La pagina
 * gdanav della plancia lo scrive, il navigatore sul telefono lo legge sul suo
 * filo, e la casa — che e' sempre accesa — fa le cose che vanno fatte
 * all'ora giusta anche col telefono in tasca e spento:
 *
 *   - **l'avviso**: «Parti fra 10 minuti», nella busta delle notifiche, solo
 *     ai telefoni di chi il viaggio l'ha fatto;
 *   - **il clima dell'auto**: acceso qualche minuto prima, con
 *     `homeassistant.turn_on` sull'entita' scelta;
 *   - **il garage**: mai da solo. Un garage che si apre perche' e' scoccata
 *     un'ora, con nessuno davanti, e' una porta aperta a chi passa: si mette
 *     un tasto nell'avviso, e lo preme chi parte.
 *
 * Quando partire lo dice la stima del viaggio. Il navigatore la porta col
 * traffico vero ogni volta che il telefono si collega; dalla plancia, senza
 * telefono, la fa la casa con la strada senza traffico (OSRM) e ci aggiunge
 * un margine. Le mete da PC si cercano con Photon, lo stesso che il
 * navigatore usa per le ricerche: nessuna chiave, niente da pagare.
 *
 * I viaggi sono **di chi li fa**: ognuno vede, cambia e riceve gli avvisi
 * solo dei suoi. Il pianificatore e' di gdanav Premium (o gdahome Premium,
 * che lo comprende): senza, la casa li tiene ma non avvisa e non accende
 * niente, e chi li apre si sente dire che serve Premium.
 *
 * Le ore sono quelle della casa: il fuso lo da' il Supervisor all'add-on,
 * come per le ore di silenzio delle notifiche.
 */

import { randomBytes } from "node:crypto";
import { join } from "node:path";

import { Archivio } from "./archivio.js";

const MINUTO = 60_000;
const ORA = 60 * MINUTO;
const GIORNO = 24 * ORA;

/* Quanti viaggi a testa, e quante tappe in un giro. */
export const VIAGGI_A_TESTA = 50;
export const TAPPE_AL_PIU = 10;

/* Senza il traffico vero la stima della strada vuota si allunga di tanto. */
export const MARGINE_SENZA_TRAFFICO = 1.15;
/* Una stima col traffico vale per qualche ora: dopo, torna il margine. */
export const STIMA_COL_TRAFFICO_VALE = 6 * ORA;

/* Ogni quanto si guarda l'orologio. */
const BATTITO = 30_000;

const TIPI = new Set(["una", "settimana", "tappe"]);
const ORA_BUONA = /^([01]\d|2[0-3]):[0-5]\d$/;
const GIORNO_BUONO = /^\d{4}-\d{2}-\d{2}$/;
const ENTITA_BUONA = /^[a-z_]+\.[a-z0-9_]+$/;

const testo = (valore, massimo) =>
  typeof valore === "string" ? valore.trim().replace(/\s+/g, " ").slice(0, massimo) : "";

function numero(valore) {
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
}

/* Un posto: un nome e le sue coordinate, buone. */
export function postoPulito(dato) {
  if (!dato || typeof dato !== "object") return null;
  const lat = numero(dato.lat);
  const lon = numero(dato.lon);
  if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const nome = testo(dato.nome, 120) || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  const sosta = Math.trunc(numero(dato.sostaMin) ?? 0);
  return {
    nome,
    lat,
    lon,
    ...(sosta > 0 ? { sostaMin: Math.min(sosta, 12 * 60) } : {}),
  };
}

/**
 * Un viaggio come arriva dalla plancia o dal telefono, ripulito. `null` se
 * non sta in piedi: senza una meta, senza un'ora, o con un giorno storto.
 */
export function viaggioPulito(dato) {
  if (!dato || typeof dato !== "object") return null;
  const tipo = TIPI.has(dato.tipo) ? dato.tipo : "una";
  const tappe = (Array.isArray(dato.tappe) ? dato.tappe : [])
    .map(postoPulito)
    .filter(Boolean)
    .slice(0, TAPPE_AL_PIU);
  if (!tappe.length) return null;
  if (tipo !== "tappe") tappe.splice(1);
  const quando = dato.quando && typeof dato.quando === "object" ? dato.quando : {};
  const ora = ORA_BUONA.test(quando.ora) ? quando.ora : null;
  if (!ora) return null;
  const modo = tipo === "tappe" ? "partenza" : quando.modo === "partenza" ? "partenza" : "arrivo";
  let giorno = null;
  let giorni = [];
  if (tipo === "settimana") {
    giorni = [...new Set((Array.isArray(quando.giorni) ? quando.giorni : []).map(Number))]
      .filter((g) => Number.isInteger(g) && g >= 1 && g <= 7)
      .sort((a, b) => a - b);
    if (!giorni.length) return null;
  } else {
    if (!GIORNO_BUONO.test(quando.giorno) || Number.isNaN(Date.parse(`${quando.giorno}T00:00`)))
      return null;
    giorno = quando.giorno;
  }
  const avvisoMin = Math.trunc(numero(dato.avviso?.minuti) ?? 10);
  const climaEntita = testo(dato.prepara?.clima?.entity, 100);
  const climaMin = Math.trunc(numero(dato.prepara?.clima?.minuti) ?? 10);
  const garage = testo(dato.prepara?.garage?.entity, 100);
  return {
    tipo,
    nome: testo(dato.nome, 80),
    da: postoPulito(dato.da),
    tappe,
    quando: { modo, ora, giorno, giorni },
    avviso: {
      acceso: dato.avviso?.acceso !== false,
      minuti: Math.max(0, Math.min(avvisoMin, 120)),
    },
    prepara: {
      clima: ENTITA_BUONA.test(climaEntita)
        ? { entity: climaEntita, minuti: Math.max(1, Math.min(climaMin, 60)) }
        : null,
      garage: ENTITA_BUONA.test(garage) && garage.startsWith("cover.") ? { entity: garage } : null,
    },
  };
}

/* Il giorno della settimana alla maniera di chi scrive: lunedi' 1, domenica 7. */
const giornoDellaSettimana = (data) => ((data.getDay() + 6) % 7) + 1;

function alleOre(data, ora) {
  const [h, m] = ora.split(":").map(Number);
  const fuori = new Date(data);
  fuori.setHours(h, m, 0, 0);
  return fuori;
}

const chiaveDelGiorno = (data) =>
  `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;

/**
 * Quanto ci vuole, in millisecondi, secondo la stima che c'e': col traffico
 * se e' fresca, altrimenti la strada vuota col margine. Le soste delle tappe
 * si sommano. `null` se una stima non c'e' ancora.
 */
export function durataDelViaggio(viaggio, adesso) {
  const stima = viaggio.stima;
  const secondi = numero(stima?.durataS);
  if (secondi === null || secondi <= 0) return null;
  const fresca =
    stima.fonte === "traffico" && adesso - (numero(stima.alle) ?? 0) < STIMA_COL_TRAFFICO_VALE;
  const guida = secondi * 1000 * (fresca ? 1 : MARGINE_SENZA_TRAFFICO);
  const soste = viaggio.tappe.slice(0, -1).reduce((somma, t) => somma + (t.sostaMin || 0), 0);
  return Math.round(guida + soste * MINUTO);
}

/**
 * La prossima volta di questo viaggio, da adesso: quando partire e quando si
 * arriva, in millisecondi, e il giorno a cui appartiene. Un viaggio gia'
 * passato da piu' di un'ora torna `null`.
 *
 * Con «arrivo entro» la partenza e' l'arrivo meno la durata; senza una stima,
 * la partenza e' l'ora stessa (si avvisa lo stesso, e lo si dice).
 */
export function prossimaVolta(viaggio, adesso) {
  const durata = durataDelViaggio(viaggio, adesso) ?? 0;
  const per = (data) => {
    const scritta = alleOre(data, viaggio.quando.ora).getTime();
    const partenza = viaggio.quando.modo === "arrivo" ? scritta - durata : scritta;
    const arrivo = viaggio.quando.modo === "arrivo" ? scritta : scritta + durata;
    return { giorno: chiaveDelGiorno(data), partenza, arrivo, stimata: durata > 0 };
  };
  if (viaggio.tipo !== "settimana") {
    const volta = per(new Date(`${viaggio.quando.giorno}T00:00`));
    return volta.arrivo < adesso - ORA ? null : volta;
  }
  const oggi = new Date(adesso);
  oggi.setHours(0, 0, 0, 0);
  for (let i = 0; i < 8; i += 1) {
    const data = new Date(oggi);
    data.setDate(oggi.getDate() + i);
    if (!viaggio.quando.giorni.includes(giornoDellaSettimana(data))) continue;
    const volta = per(data);
    if (volta.arrivo >= adesso - 5 * MINUTO) return volta;
  }
  return null;
}

const oraDetta = (ms) => {
  const d = new Date(ms);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export class Viaggi {
  constructor({
    cartella = "",
    casa = null,
    notifiche = null,
    licenze = null,
    registro = null,
    adesso = () => Date.now(),
    scarica = (indirizzo, opzioni) => fetch(indirizzo, opzioni),
    ogni = (quanto, cosa) => setInterval(cosa, quanto),
    smetti = (segno) => clearInterval(segno),
  } = {}) {
    this._suDisco = Boolean(cartella);
    this.archivio = new Archivio(cartella ? join(cartella, "viaggi.json") : "", {
      viaggi: [],
      fatti: {},
    });
    if (!Array.isArray(this.archivio.dati.viaggi)) this.archivio.dati.viaggi = [];
    if (!this.archivio.dati.fatti || typeof this.archivio.dati.fatti !== "object")
      this.archivio.dati.fatti = {};
    this.casa = casa;
    this.notifiche = notifiche;
    this.licenze = licenze;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.scarica = scarica;
    this._ogni = ogni;
    this._smetti = smetti;
    this._battito = null;
    this._dove = null;
  }

  /* Se il pianificatore e' sbloccato: gdanav Premium, o gdahome Premium che
   * lo comprende. Con le licenze spente — una casa senza chiave — si'. */
  get sbloccato() {
    try {
      if (!this.licenze?.attive) return true;
      return this.licenze.gdanav === true;
    } catch (_errore) {
      return false;
    }
  }

  get _tutti() {
    return this.archivio.dati.viaggi;
  }

  _salva() {
    if (!this._suDisco) return;
    try {
      this.archivio.salva();
    } catch (errore) {
      this.registro.attenzione(`viaggi non scritti: ${errore?.message || errore}`);
    }
  }

  /* Un viaggio come lo vede chi lo ha fatto: con la prossima volta gia'
   * calcolata, cosi' la plancia e il telefono non rifanno i conti. */
  _visto(viaggio) {
    const volta = prossimaVolta(viaggio, this.adesso());
    return { ...viaggio, prossima: volta };
  }

  /* ── quello che si chiede ─────────────────────────────────────────── */

  elenco(utente) {
    const chi = String(utente ?? "");
    const miei = this._tutti
      .filter((v) => v.utente === chi)
      .map((v) => this._visto(v))
      .filter((v) => v.tipo === "settimana" || v.prossima);
    miei.sort(
      (a, b) =>
        (a.prossima?.partenza ?? Infinity) - (b.prossima?.partenza ?? Infinity) ||
        a.creatoIl - b.creatoIl,
    );
    /* Dove sta la casa, se si sa gia': la mappa della pagina parte da li'
     * anche prima di scegliere una meta. */
    return { sbloccato: this.sbloccato, viaggi: miei, ...(this._dove ? { casa: this._dove } : {}) };
  }

  /* Salva un viaggio nuovo (senza `id`) o cambia uno dei propri. Torna il
   * viaggio salvato, o un errore detto in parole. */
  salva(utente, dato) {
    const chi = String(utente ?? "");
    if (!this.sbloccato) return { errore: "premium-richiesto" };
    const pulito = viaggioPulito(dato);
    if (!pulito) return { errore: "viaggio-non-valido" };
    const ora = this.adesso();
    const id = typeof dato?.id === "string" ? dato.id : "";
    const gia = id ? this._tutti.find((v) => v.id === id) : null;
    if (gia && gia.utente !== chi) return { errore: "non-trovato" };
    const stima = this._stimaPulita(dato?.stima, gia?.stima);
    /* Un viaggio cambiato di meta o di tappe non tiene la stima di prima. */
    const stessaStrada =
      gia &&
      JSON.stringify(gia.tappe) === JSON.stringify(pulito.tappe) &&
      JSON.stringify(gia.da) === JSON.stringify(pulito.da);
    const nuovo = {
      ...pulito,
      id: gia?.id ?? `v_${randomBytes(6).toString("hex")}`,
      utente: chi,
      stima: stima ?? (stessaStrada ? (gia?.stima ?? null) : null),
      creatoIl: gia?.creatoIl ?? ora,
      modificatoIl: ora,
    };
    if (gia) {
      this._tutti.splice(this._tutti.indexOf(gia), 1, nuovo);
    } else {
      if (this._tutti.filter((v) => v.utente === chi).length >= VIAGGI_A_TESTA)
        return { errore: "troppi-viaggi" };
      this._tutti.push(nuovo);
    }
    this._salva();
    return { viaggio: this._visto(nuovo) };
  }

  togli(utente, id) {
    const chi = String(utente ?? "");
    const quale = this._tutti.findIndex((v) => v.id === id && v.utente === chi);
    if (quale < 0) return { errore: "non-trovato" };
    this._tutti.splice(quale, 1);
    this._salva();
    return { tolto: id };
  }

  _stimaPulita(detta, prima = null) {
    if (!detta || typeof detta !== "object") return null;
    const durataS = numero(detta.durataS);
    if (durataS === null || durataS <= 0 || durataS > 3 * 24 * 3600) return prima;
    const km = numero(detta.km);
    return {
      durataS: Math.round(durataS),
      ...(km !== null && km >= 0 ? { km: Math.round(km * 10) / 10 } : {}),
      fonte: detta.fonte === "traffico" ? "traffico" : "strada",
      alle: this.adesso(),
    };
  }

  /* Il navigatore porta la stima col traffico vero. */
  stima(utente, id, detta) {
    const viaggio = this._tutti.find((v) => v.id === id && v.utente === String(utente ?? ""));
    if (!viaggio) return { errore: "non-trovato" };
    const stima = this._stimaPulita(detta);
    if (!stima) return { errore: "stima-non-valida" };
    viaggio.stima = stima;
    this._salva();
    return { viaggio: this._visto(viaggio) };
  }

  /* ── da PC: cercare una meta, e stimare la strada ────────────────── */

  async _casaQui() {
    if (this._dove) return this._dove;
    try {
      const config = await this.casa?.chiedi?.({ type: "get_config" });
      const lat = numero(config?.latitude);
      const lon = numero(config?.longitude);
      if (lat !== null && lon !== null) this._dove = { nome: "Casa", lat, lon };
    } catch (_errore) {
      /* Senza la posizione di casa si cerca dappertutto. */
    }
    return this._dove;
  }

  /* Le mete che somigliano a quello che si e' scritto, vicine a casa prima.
   *
   * «Il pianificatore non trova indirizzi»: la ricerca stava tutta su Photon,
   * e quando Photon non rispondeva — e' un servizio gratuito, a volte pieno o
   * fermo — la casa diceva «nessun posto» e la pagina restava muta, come se
   * Napoli non esistesse. Adesso se Photon non risponde, o non trova niente,
   * si chiede a Nominatim (lo stesso OpenStreetMap, un'altra porta); e se non
   * risponde nessuno dei due la risposta lo dice (`guasto`), cosi' la pagina
   * puo' dire «la ricerca non risponde» invece di tacere. */
  async cerca(testoCercato) {
    const cosa = testo(testoCercato, 120);
    if (cosa.length < 3) return { posti: [] };
    const casa = await this._casaQui();
    let guasti = 0;
    for (const fonte of [() => this._daPhoton(cosa, casa), () => this._daNominatim(cosa, casa)]) {
      const posti = await fonte();
      if (posti === null) {
        guasti += 1;
        continue;
      }
      if (posti.length) return { posti };
    }
    return guasti === 2 ? { posti: [], guasto: true } : { posti: [] };
  }

  /* Una fonte risponde con un elenco (anche vuoto), o con `null` se non
   * risponde: le due cose sono diverse, e la pagina le dice diverse. */
  async _chiediPosti(indirizzo, leggi, chi) {
    try {
      const risposta = await this.scarica(indirizzo, {
        headers: { "user-agent": "gdahome (Home Assistant add-on)", accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!risposta.ok) {
        this.registro.attenzione(`viaggi: ${chi} ha risposto ${risposta.status}`);
        return null;
      }
      return leggi(await risposta.json())
        .map(postoPulito)
        .filter(Boolean)
        .slice(0, 6);
    } catch (errore) {
      this.registro.attenzione(`viaggi: ${chi} non risponde (${errore?.message || errore})`);
      return null;
    }
  }

  _daPhoton(cosa, casa) {
    const indirizzo = new URL("https://photon.komoot.io/api/");
    indirizzo.searchParams.set("q", cosa);
    indirizzo.searchParams.set("limit", "6");
    indirizzo.searchParams.set("lang", "it");
    if (casa) {
      indirizzo.searchParams.set("lat", String(casa.lat));
      indirizzo.searchParams.set("lon", String(casa.lon));
    }
    return this._chiediPosti(
      indirizzo.toString(),
      (dati) =>
        (dati?.features || []).map((f) => {
          const p = f?.properties || {};
          const [lon, lat] = f?.geometry?.coordinates || [];
          const nome = [p.name || p.street, p.housenumber].filter(Boolean).join(" ");
          const dove = [p.city || p.town || p.village, p.state].filter(Boolean).join(", ");
          return { nome: [nome, dove].filter(Boolean).join(" · ") || dove, lat, lon };
        }),
      "Photon",
    );
  }

  _daNominatim(cosa, casa) {
    const indirizzo = new URL("https://nominatim.openstreetmap.org/search");
    indirizzo.searchParams.set("format", "jsonv2");
    indirizzo.searchParams.set("q", cosa);
    indirizzo.searchParams.set("limit", "6");
    indirizzo.searchParams.set("addressdetails", "1");
    indirizzo.searchParams.set("accept-language", "it");
    /* Vicino a casa prima, senza chiudere fuori il resto. */
    if (casa)
      indirizzo.searchParams.set(
        "viewbox",
        [casa.lon - 1, casa.lat + 1, casa.lon + 1, casa.lat - 1].map((n) => n.toFixed(4)).join(","),
      );
    return this._chiediPosti(
      indirizzo.toString(),
      (dati) =>
        (Array.isArray(dati) ? dati : []).map((r) => {
          const a = r?.address || {};
          const nome =
            [a.road || r?.name, a.house_number].filter(Boolean).join(" ") ||
            String(r?.display_name || "").split(",")[0];
          const dove = [a.city || a.town || a.village, a.state].filter(Boolean).join(", ");
          return {
            nome: [nome, dove].filter(Boolean).join(" · ") || dove,
            lat: Number(r?.lat),
            lon: Number(r?.lon),
          };
        }),
      "Nominatim",
    );
  }

  /* La strada senza traffico, dalla partenza (o da casa) per le tappe. */
  async strada(da, tappe) {
    const partenza = postoPulito(da) ?? (await this._casaQui());
    const fermate = (Array.isArray(tappe) ? tappe : []).map(postoPulito).filter(Boolean);
    if (!partenza || !fermate.length) return { errore: "manca-la-strada" };
    const punti = [partenza, ...fermate.slice(0, TAPPE_AL_PIU)]
      .map((p) => `${p.lon},${p.lat}`)
      .join(";");
    try {
      const risposta = await this.scarica(
        `https://router.project-osrm.org/route/v1/driving/${punti}?overview=simplified&geometries=geojson`,
        { headers: { "user-agent": "gdahome" }, signal: AbortSignal.timeout(10000) },
      );
      if (!risposta.ok) return { errore: "strada-non-trovata" };
      const dati = await risposta.json();
      const via = dati?.routes?.[0];
      if (!via) return { errore: "strada-non-trovata" };
      return {
        stima: {
          durataS: Math.round(via.duration),
          km: Math.round(via.distance / 100) / 10,
          fonte: "strada",
        },
        linea: (via.geometry?.coordinates || []).slice(0, 400),
        da: partenza,
      };
    } catch (_errore) {
      return { errore: "strada-non-trovata" };
    }
  }

  /* ── l'orologio della casa ────────────────────────────────────────── */

  parti() {
    if (this._battito) return;
    this._battito = this._ogni(BATTITO, () => {
      this.battito().catch((errore) =>
        this.registro.attenzione(`viaggi: ${errore?.message || errore}`),
      );
    });
    this._battito?.unref?.();
  }

  ferma() {
    if (this._battito) this._smetti(this._battito);
    this._battito = null;
  }

  /* Un giro dell'orologio: per ogni viaggio, se e' l'ora dell'avviso o del
   * clima e non e' gia' stato fatto per questa volta, si fa. I viaggi di una
   * volta gia' passati da un giorno si tolgono. */
  async battito() {
    const ora = this.adesso();
    const fatti = this.archivio.dati.fatti;
    let cambiato = false;
    for (const [chiave, quando] of Object.entries(fatti))
      if (ora - quando > 3 * GIORNO) {
        delete fatti[chiave];
        cambiato = true;
      }
    const restano = this._tutti.filter((v) => {
      if (v.tipo === "settimana") return true;
      return Date.parse(`${v.quando.giorno}T23:59`) > ora - GIORNO;
    });
    if (restano.length !== this._tutti.length) {
      this.archivio.dati.viaggi = restano;
      cambiato = true;
    }
    if (this.sbloccato) {
      for (const viaggio of this._tutti) {
        const volta = prossimaVolta(viaggio, ora);
        if (!volta) continue;
        const di = `${viaggio.id}|${volta.giorno}`;
        if (viaggio.avviso.acceso) {
          const quando = volta.partenza - viaggio.avviso.minuti * MINUTO;
          if (ora >= quando && ora < volta.partenza + 15 * MINUTO && !fatti[`${di}|avviso`]) {
            fatti[`${di}|avviso`] = ora;
            cambiato = true;
            await this._avvisa(viaggio, volta);
          }
        }
        const clima = viaggio.prepara.clima;
        if (clima) {
          const quando = volta.partenza - clima.minuti * MINUTO;
          if (ora >= quando && ora < volta.partenza + 10 * MINUTO && !fatti[`${di}|clima`]) {
            fatti[`${di}|clima`] = ora;
            cambiato = true;
            await this._accendiIlClima(viaggio, clima);
          }
        }
      }
    }
    if (cambiato) this._salva();
  }

  async _avvisa(viaggio, volta) {
    if (!this.notifiche?.consegna) return;
    const meta = viaggio.tappe[viaggio.tappe.length - 1]?.nome || "la meta";
    const minuti = Math.max(0, Math.round((volta.partenza - this.adesso()) / MINUTO));
    const titoloIt = minuti > 1 ? `Parti fra ${minuti} minuti` : "È ora di partire";
    const titoloEn = minuti > 1 ? `Leave in ${minuti} minutes` : "Time to leave";
    const nome = viaggio.nome || meta;
    const arrivoIt =
      viaggio.quando.modo === "arrivo"
        ? `arrivo entro le ${viaggio.quando.ora}`
        : `partenza alle ${oraDetta(volta.partenza)}`;
    const arrivoEn =
      viaggio.quando.modo === "arrivo"
        ? `arrive by ${viaggio.quando.ora}`
        : `leave at ${oraDetta(volta.partenza)}`;
    const senzaStima = volta.stimata ? "" : " Apri gdanav per il tempo col traffico.";
    const garage = viaggio.prepara.garage;
    try {
      await this.notifiche.consegna({
        tipo: "viaggi",
        chiave: `viaggio|${viaggio.id}`,
        urgenza: "normale",
        oltreIlSilenzio: true,
        solo: [viaggio.utente],
        parole: {
          it: { titolo: titoloIt, testo: `${nome}: ${arrivoIt}.${senzaStima}` },
          en: { titolo: titoloEn, testo: `${nome}: ${arrivoEn}.` },
        },
        azioni: garage
          ? [
              {
                id: "garage",
                parole: { it: "Apri il garage", en: "Open the garage" },
                servizio: {
                  domain: "cover",
                  service: "open_cover",
                  service_data: { entity_id: garage.entity },
                },
              },
            ]
          : [],
      });
    } catch (errore) {
      this.registro.attenzione(`l'avviso del viaggio non e' partito: ${errore?.message || errore}`);
    }
  }

  async _accendiIlClima(viaggio, clima) {
    try {
      await this.casa?.chiedi?.({
        type: "call_service",
        domain: "homeassistant",
        service: "turn_on",
        service_data: { entity_id: clima.entity },
      });
      this.registro.info(`viaggio: acceso ${clima.entity} prima di partire`);
    } catch (errore) {
      this.registro.attenzione(
        `${clima.entity}: il clima del viaggio non si accende: ${errore?.message || errore}`,
      );
    }
  }

  /* ── i comandi sul filo ───────────────────────────────────────────── */

  riconosce(tipo) {
    return typeof tipo === "string" && tipo.startsWith("ponte/viaggi/");
  }

  /* `utente`: chi sta dall'altra parte, gia' riconosciuto dal ponte. Non
   * solleva: un no e' una risposta. */
  async rispondi(detto, { utente = "" } = {}) {
    const id = detto?.id ?? null;
    const si = (result) => ({ id, type: "result", success: true, result });
    const no = (code, message) => ({
      id,
      type: "result",
      success: false,
      error: { code, message },
    });
    const esito = (fuori) => (fuori?.errore ? no(fuori.errore, fuori.errore) : si(fuori));
    try {
      switch (detto?.type) {
        case "ponte/viaggi/elenco":
          return si(this.elenco(utente));
        case "ponte/viaggi/salva":
          return esito(this.salva(utente, detto.viaggio));
        case "ponte/viaggi/togli":
          return esito(this.togli(utente, String(detto.viaggio ?? "")));
        case "ponte/viaggi/stima":
          return esito(this.stima(utente, String(detto.viaggio ?? ""), detto.stima));
        case "ponte/viaggi/cerca":
          if (!this.sbloccato) return no("premium-richiesto", "premium-richiesto");
          return si(await this.cerca(detto.testo));
        case "ponte/viaggi/strada":
          if (!this.sbloccato) return no("premium-richiesto", "premium-richiesto");
          return esito(await this.strada(detto.da, detto.tappe));
        default:
          return no("unknown_command", `non conosco ${detto?.type}`);
      }
    } catch (errore) {
      this.registro.errore(`viaggi: ${errore?.message || errore}`);
      return no("ponte_viaggi", "non ha funzionato");
    }
  }
}
