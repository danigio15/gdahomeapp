/* La configurazione della plancia: la tiene il ponte.
 *
 * La plancia si configura dall'app — la sua sezione Config, dentro il
 * riquadro — e quello che si configura deve stare da qualche parte che ogni
 * telefono di casa veda uguale. Nell'integrazione di Home Assistant quel posto
 * e' `config_store.py`; qui non c'e' nessuna integrazione, e quel posto e'
 * questo file, scritto per rispondere **esattamente** come risponde
 * l'integrazione: la pagina non deve accorgersi della differenza.
 *
 * Tre regole, e vengono tutte da perdite di dati vere:
 *
 *  - una scrittura che rimpiazzerebbe una plancia configurata con una vuota
 *    si rifiuta, a meno che non sia un azzeramento voluto. Era la forma
 *    della perdita: un telefono che non era riuscito a leggere si credeva
 *    padrone e spingeva il suo niente sopra la configurazione buona;
 *  - le ultime cinque revisioni configurate si tengono, cosi' una plancia
 *    svuotata si puo' rimettere a posto;
 *  - i conflitti si decidono sulla revisione del ponte, che cresce e basta,
 *    e mai sull'orologio di un telefono.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";

export const PROFILO_PRINCIPALE = "primary";

/* Quante revisioni si tengono per profilo: abbastanza da rimettere a posto
 * una plancia dopo una sincronizzazione storta, senza che il file cresca per
 * sempre. */
const REVISIONI_TENUTE = 5;

/* I limiti di uno scatto. Arriva dalla pagina: si controlla, non ci si fida. */
const CHIAVI_MASSIME = 256;
const VALORE_MASSIMO = 2 * 1024 * 1024;
const TOTALE_MASSIMO = 8 * 1024 * 1024;

/* Le chiavi di servizio non sono contenuto: uno scatto con dentro solo
 * queste e' una plancia vuota. */
const SENZA_CONTENUTO = new Set(["dm_schema_version", "dm_persistence_meta", "cd_sections"]);

export const STATO = Object.freeze({
  salvato: "saved",
  uguale: "unchanged",
  conflitto: "conflict",
  rifiutatoVuoto: "refused-empty",
});

const PROFILO_BUONO = /^[a-z0-9][a-z0-9-]{0,63}$/;

export class ScattoTroppoGrande extends Error {}

/* ─── Cosa conta come contenuto ──────────────────────────────────────────── */

function scalareChePesa(valore) {
  if (typeof valore === "string") return valore.trim().length > 0;
  if (typeof valore === "boolean") return valore;
  if (typeof valore === "number") return valore !== 0;
  return false;
}

function pesa(valore, { ignoraMetadata = false } = {}) {
  if (Array.isArray(valore)) return valore.some((uno) => pesa(uno));
  if (valore && typeof valore === "object") {
    return Object.entries(valore).some(
      ([chiave, figlio]) => !(ignoraMetadata && chiave === "metadata") && pesa(figlio),
    );
  }
  return scalareChePesa(valore);
}

/* Quante chiavi dello scatto portano davvero una plancia configurata.
 *
 * Rispecchia `meaningfulLocal` nella pagina: le bandiere di visibilita' e la
 * contabilita' dello schema non contano, e `dm_dashboard_state` si giudica
 * dalle sue sezioni, cosi' una busta vuota non passa per configurata. */
export function chiaviDiContenuto(valori) {
  if (!valori || typeof valori !== "object" || Array.isArray(valori)) return 0;
  let quante = 0;
  for (const [chiave, grezzo] of Object.entries(valori)) {
    if (SENZA_CONTENUTO.has(chiave)) continue;
    let letto = grezzo;
    if (typeof grezzo === "string") {
      try {
        letto = JSON.parse(grezzo);
      } catch (_errore) {
        letto = grezzo;
      }
    }
    if (chiave === "dm_dashboard_state") {
      const sezioni = letto && typeof letto === "object" ? letto.sections : null;
      if (
        sezioni &&
        typeof sezioni === "object" &&
        Object.entries(sezioni).some(([nome, valore]) =>
          pesa(valore, { ignoraMetadata: nome === "energy" }),
        )
      )
        quante += 1;
      continue;
    }
    if (pesa(letto)) quante += 1;
  }
  return quante;
}

export function eConfigurata(valori) {
  return chiaviDiContenuto(valori) > 0;
}

/* I valori accettati di uno scatto in arrivo: solo stringhe, entro i limiti. */
export function valoriBuoni(valori) {
  if (!valori || typeof valori !== "object" || Array.isArray(valori))
    throw new ScattoTroppoGrande("values must be an object");
  const chiavi = Object.keys(valori);
  if (chiavi.length > CHIAVI_MASSIME)
    throw new ScattoTroppoGrande(`too many keys: ${chiavi.length} > ${CHIAVI_MASSIME}`);
  let totale = 0;
  const accettati = {};
  for (const chiave of chiavi) {
    const valore = valori[chiave];
    if (typeof valore !== "string") continue;
    const quanto = Buffer.byteLength(valore, "utf8");
    if (quanto > VALORE_MASSIMO)
      throw new ScattoTroppoGrande(`${chiave} exceeds ${VALORE_MASSIMO} bytes`);
    totale += quanto;
    if (totale > TOTALE_MASSIMO)
      throw new ScattoTroppoGrande(`snapshot exceeds ${TOTALE_MASSIMO} bytes`);
    accettati[String(chiave)] = valore;
  }
  return accettati;
}

/* ─── Lo scatto, come lo vede la pagina ──────────────────────────────────── */

const intero = (valore) => {
  const numero = Number(valore);
  return Number.isFinite(numero) ? Math.trunc(numero) : 0;
};

function pubblico(scatto) {
  if (!scatto) return null;
  return {
    revision: intero(scatto.revision),
    updated_at: intero(scatto.updated_at),
    keys_revision: intero(scatto.keys_revision),
    writer_generation: intero(scatto.writer_generation),
    reset: Boolean(scatto.reset),
    values: { ...(scatto.values || {}) },
  };
}

/* Le revisioni tenute che potrebbero rimettere in piedi una plancia
 * configurata, dalla piu' recente. */
function recuperabili(scatto) {
  if (!scatto) return [];
  const voci = [];
  for (const revisione of scatto.history || []) {
    const valori = revisione.values || {};
    if (!eConfigurata(valori)) continue;
    voci.push({
      revision: intero(revisione.revision),
      updated_at: intero(revisione.updated_at),
      content_keys: chiaviDiContenuto(valori),
      reset: Boolean(revisione.reset),
    });
  }
  voci.sort((una, altra) => altra.revision - una.revision);
  return voci;
}

function ugualiValori(uno, altro) {
  const a = uno || {};
  const b = altro || {};
  const chiaviA = Object.keys(a);
  if (chiaviA.length !== Object.keys(b).length) return false;
  return chiaviA.every((chiave) => Object.hasOwn(b, chiave) && a[chiave] === b[chiave]);
}

/* ─── La cassetta ────────────────────────────────────────────────────────── */

export class Configurazione {
  constructor({ cartella, percorso = null, adesso = () => Date.now() } = {}) {
    this.archivio = new Archivio(percorso || join(cartella, "plancia.json"), { profiles: {} });
    this.adesso = adesso;
    if (!this.archivio.dati.profiles || typeof this.archivio.dati.profiles !== "object")
      this.archivio.dati.profiles = {};
  }

  get _profili() {
    return this.archivio.dati.profiles;
  }

  static profiloBuono(profilo) {
    return typeof profilo === "string" && PROFILO_BUONO.test(profilo);
  }

  /* Lo scatto condiviso di una plancia. */
  leggi(profilo = PROFILO_PRINCIPALE) {
    const scatto = this._profili[profilo];
    return {
      profile: profilo,
      requested_profile: null,
      snapshot: pubblico(scatto),
      recoverable: recuperabili(scatto),
      profiles: Object.keys(this._profili).sort(),
    };
  }

  /* Mette via uno scatto, rifiutando le scritture che perdevano dati. Puo'
   * sollevare [ScattoTroppoGrande]. */
  scrivi(
    profilo,
    valori,
    {
      keys_revision: revisioneDelleChiavi = 0,
      writer_generation: generazione = 0,
      updated_at: aggiornatoIl = 0,
      expected_revision: revisioneAttesa = null,
      reset = false,
    } = {},
  ) {
    const corrente = this._profili[profilo] || null;
    const accettati = valoriBuoni(valori);

    if (
      revisioneAttesa !== null &&
      revisioneAttesa !== undefined &&
      intero(revisioneAttesa) !== intero(corrente?.revision)
    ) {
      return this._risposta(STATO.conflitto, profilo, corrente);
    }

    /* La firma dell'azzeramento per sbaglio: chi non ha niente configurato
     * che scrive sopra una plancia configurata. Solo un azzeramento voluto
     * lo puo' fare. */
    if (!reset && corrente && eConfigurata(corrente.values) && !eConfigurata(accettati)) {
      return this._risposta(STATO.rifiutatoVuoto, profilo, corrente);
    }

    if (corrente && ugualiValori(corrente.values, accettati)) {
      /* Un salto di generazione su valori identici e' un aggiornamento di
       * metadati, non una scrittura: si timbra la busta com'e', senza
       * coniare una revisione nuova. */
      let timbrata = false;
      if (intero(generazione) > intero(corrente.writer_generation)) {
        corrente.writer_generation = intero(generazione);
        timbrata = true;
      }
      if (intero(revisioneDelleChiavi) > intero(corrente.keys_revision)) {
        corrente.keys_revision = intero(revisioneDelleChiavi);
        timbrata = true;
      }
      if (timbrata) this.archivio.salva();
      return this._risposta(STATO.uguale, profilo, corrente);
    }

    const storia = [...(corrente?.history || [])];
    if (corrente && eConfigurata(corrente.values)) {
      storia.unshift({
        revision: intero(corrente.revision),
        updated_at: intero(corrente.updated_at),
        keys_revision: intero(corrente.keys_revision),
        writer_generation: intero(corrente.writer_generation),
        reset: Boolean(corrente.reset),
        values: { ...(corrente.values || {}) },
      });
    }
    storia.length = Math.min(storia.length, REVISIONI_TENUTE);

    const scatto = {
      revision: intero(corrente?.revision) + 1,
      updated_at: intero(aggiornatoIl) || this.adesso(),
      keys_revision: intero(revisioneDelleChiavi),
      writer_generation: intero(generazione),
      reset: Boolean(reset),
      values: accettati,
      history: storia,
    };
    this._profili[profilo] = scatto;
    this.archivio.salva();
    return this._risposta(STATO.salvato, profilo, scatto);
  }

  /* Rimette a corrente una revisione tenuta. */
  ripristina(profilo, revisione) {
    const corrente = this._profili[profilo] || null;
    const voluta = (corrente?.history || []).find(
      (una) => intero(una.revision) === intero(revisione),
    );
    if (!voluta) return this._risposta(STATO.conflitto, profilo, corrente);
    return this.scrivi(
      profilo,
      { ...(voluta.values || {}) },
      {
        keys_revision: intero(voluta.keys_revision),
        writer_generation: intero(voluta.writer_generation),
        updated_at: this.adesso(),
      },
    );
  }

  /* Via il cassetto di una plancia che non c'e' piu'.
   *
   * Si chiama quando si toglie una plancia (`plance.js`), e non prima:
   * qui dentro c'e' il lavoro di chi si e' disegnato la casa, e l'unico
   * momento in cui si butta e' quello in cui si butta la plancia. Torna
   * `false` se non c'era niente da buttare — che non e' un errore: e' una
   * plancia aggiunta e mai configurata. */
  dimentica(profilo) {
    const quale = String(profilo || "");
    if (!Object.hasOwn(this._profili, quale)) return false;
    delete this._profili[quale];
    this.archivio.salva();
    return true;
  }

  _risposta(stato, profilo, scatto) {
    return {
      status: stato,
      profile: profilo,
      snapshot: pubblico(scatto),
      recoverable: recuperabili(scatto),
    };
  }
}
