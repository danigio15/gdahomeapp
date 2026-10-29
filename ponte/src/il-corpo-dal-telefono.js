/* Il corpo dal telefono: la Salute che l'app GdAHome legge e porta a casa.
 *
 * «Tutto questo non lo possiamo gestire direttamente da app gdahome?» Si':
 * l'app legge Apple Salute sull'iPhone (HealthKit, quindi anche l'Apple
 * Watch) e Health Connect su Android (Galaxy Watch, Pixel Watch, Fitbit,
 * Amazfit/Zepp, Withings, Garmin…), e manda le ultime misure al ponte. Il
 * ponte le scrive in Home Assistant come sensori — come scrive le bollette
 * (`fornitori.js`) — e la pagina Salute della plancia li trova da sola.
 *
 * ─── Le regole, e sono decisioni ─────────────────────────────────────────
 *
 *   - **SOLO UN TELEFONO ABBINATO E INTESTATO.** I comandi `ponte/salute/*`
 *     arrivano solo dal filo di un telefono (`ponte.js`), mai dalla plancia, e
 *     solo da un telefono intestato a un utente di Home Assistant: un
 *     telefono senza utente si sente dire di no e non scrive niente.
 *   - **OGNUNO SOLO LE SUE.** Il telefono non dice chi e': lo dice il filo.
 *     Le misure stanno sotto il suo identificativo, i sensori portano un
 *     nome che nasce da quello, e un telefono non puo' scrivere, leggere o
 *     spegnere le misure di un altro.
 *   - **NIENTE VA DA NESSUN'ALTRA PARTE.** Le misure viaggiano cifrate dal
 *     telefono al ponte (il centralino, da fuori casa, vede solo byte
 *     cifrati), e dal ponte a Home Assistant. Stanno in
 *     `/data/il-corpo.json`, che legge solo il ponte (0600).
 *   - **NEL PONTE NON SI VEDE NULLA.** Nessuna pagina, nessuna console. Il
 *     registro dice «arrivate N misure» e basta: mai un valore, mai un nome.
 *   - **E' DI GDAHOME PREMIUM.** Senza, `ponte/salute/misure` risponde
 *     `premium-richiesto` e non scrive niente, con lo stesso criterio delle
 *     automazioni e degli aiutanti (`sbloccato`: Premium, o le licenze
 *     spente). Spegnere e chiedere lo stato si puo' sempre: chi perde il
 *     Premium deve poter togliere le sue misure. Quando il Premium finisce
 *     il ponte smette di riscriverle, e Home Assistant le perde alla prima
 *     ripartenza; quando torna, ricompaiono al primo invio.
 *   - **SPEGNERE E' TOGLIERE.** Dall'app si spegne con un interruttore: il
 *     ponte cancella i sensori da Home Assistant e le misure dal disco. Un
 *     telefono staccato dalla casa perde le sue misure al giro dopo.
 *
 * I sensori si chiamano «Marco Steps», «Marco Heart rate»…: il nome della
 * persona (quello che si e' scritto nell'app) e la misura in inglese, come li
 * chiama Health Connect, perche' la Salute li riconosce cosi' e chi scrive
 * un'automazione li ritrova. Uno stato scritto dall'API REST Home Assistant
 * non lo tiene dopo un suo riavvio: il ponte lo riscrive ogni dieci minuti.
 */

import { createHash } from "node:crypto";
import { join } from "node:path";

import { Archivio } from "./archivio.js";

export const PREFISSO = "ponte/salute/";
export const SALUTE_MISURE = "ponte/salute/misure";
export const SALUTE_SPEGNI = "ponte/salute/spegni";
export const SALUTE_STATO = "ponte/salute/stato";

const SPECCHIO = 10 * 60_000;
const UN_GIORNO = 86_400_000;
/* Una misura piu' vecchia di cosi' non e' «l'ultima»: non si scrive. */
const VECCHIA = 45 * UN_GIORNO;

/* Le misure che si accettano: il nome inglese del sensore, l'unita', i
 * limiti di un valore vero (fuori, si butta), e come Home Assistant le deve
 * contare. I passi e le calorie ripartono ogni mattina: `total_increasing`,
 * e Home Assistant legge la discesa di mezzanotte come un nuovo giro. */
export const MISURE_DAL_TELEFONO = Object.freeze({
  passi: {
    nome: "Steps",
    unita: "steps",
    min: 0,
    max: 200_000,
    classe: "total_increasing",
    icona: "mdi:walk",
  },
  battito: {
    nome: "Heart rate",
    unita: "bpm",
    min: 20,
    max: 250,
    classe: "measurement",
    icona: "mdi:heart-pulse",
  },
  battitoRiposo: {
    nome: "Resting heart rate",
    unita: "bpm",
    min: 20,
    max: 200,
    classe: "measurement",
    icona: "mdi:heart",
  },
  peso: {
    nome: "Weight",
    unita: "kg",
    min: 1,
    max: 400,
    classe: "measurement",
    tipo: "weight",
    icona: "mdi:scale-bathroom",
  },
  grasso: {
    nome: "Body fat",
    unita: "%",
    min: 1,
    max: 80,
    classe: "measurement",
    icona: "mdi:percent",
  },
  sistolica: {
    nome: "Blood pressure systolic",
    unita: "mmHg",
    min: 50,
    max: 260,
    classe: "measurement",
    icona: "mdi:heart-flash",
  },
  diastolica: {
    nome: "Blood pressure diastolic",
    unita: "mmHg",
    min: 30,
    max: 180,
    classe: "measurement",
    icona: "mdi:heart-flash",
  },
  ossigeno: {
    nome: "Oxygen saturation",
    unita: "%",
    min: 50,
    max: 100,
    classe: "measurement",
    icona: "mdi:lungs",
  },
  sonno: {
    nome: "Sleep duration",
    unita: "min",
    min: 0,
    max: 24 * 60,
    classe: "measurement",
    tipo: "duration",
    icona: "mdi:sleep",
  },
  calorie: {
    nome: "Active calories burned",
    unita: "kcal",
    min: 0,
    max: 20_000,
    classe: "total_increasing",
    icona: "mdi:fire",
  },
});

const no = (id, code, message) => ({
  id,
  type: "result",
  success: false,
  error: { code, message },
});
const si = (id, result) => ({ id, type: "result", success: true, result });

/* Un nome di persona: parole corte, niente segni strani. */
export function personaPulita(valore) {
  return String(valore ?? "")
    .replace(/[\u0000-\u001f<>"'`\\{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30);
}

/* L'istante di una misura: millisecondi, o una data ISO. */
function istante(valore) {
  if (typeof valore === "number" && Number.isFinite(valore)) return valore;
  const t = Date.parse(String(valore ?? ""));
  return Number.isFinite(t) ? t : null;
}

/**
 * Le misure di un messaggio, solo quelle che si conoscono e coi valori veri:
 * `{passi: {valore, quando}, …}`. Una misura del futuro, troppo vecchia o
 * fuori dai limiti non c'e'.
 */
export function misurePulite(grezze, adesso = Date.now()) {
  const fuori = {};
  if (!grezze || typeof grezze !== "object") return fuori;
  for (const [chiave, aspetto] of Object.entries(MISURE_DAL_TELEFONO)) {
    const m = grezze[chiave];
    if (!m || typeof m !== "object") continue;
    const valore = Number(m.valore);
    const quando = istante(m.quando);
    if (!Number.isFinite(valore) || valore < aspetto.min || valore > aspetto.max) continue;
    if (quando === null || quando > adesso + 10 * 60_000 || quando < adesso - VECCHIA) continue;
    fuori[chiave] = { valore: Math.round(valore * 10) / 10, quando };
  }
  return fuori;
}

/* Il pezzo del nome dei sensori di un telefono: dall'identificativo, non dal
 * nome della persona — il nome si puo' cambiare, i sensori restano. */
export function radiceDelTelefono(id) {
  return `gdahome_${createHash("sha256").update(String(id)).digest("hex").slice(0, 8)}`;
}

export class IlCorpoDalTelefono {
  constructor({
    cartella = "/data",
    casa = null,
    dispositivi = null,
    licenze = null,
    registro = null,
    adesso = () => Date.now(),
  } = {}) {
    this.archivio = new Archivio(
      join(cartella, "il-corpo.json"),
      { telefoni: {} },
      { modo: 0o600 },
    );
    this.casa = casa;
    this.dispositivi = dispositivi;
    this.licenze = licenze;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.adesso = adesso;
    this.timer = [];
  }

  get telefoni() {
    const tutti = this.archivio.dati.telefoni;
    return tutti && typeof tutti === "object" ? tutti : (this.archivio.dati.telefoni = {});
  }

  _salva() {
    try {
      this.archivio.salva();
    } catch (errore) {
      this.registro.errore(`salute: non riesco a scrivere (${errore?.code || "?"})`);
    }
  }

  /* GdAHome Premium, o le licenze spente: lo stesso criterio di
   * `aiutanti.js` e `automazioni.js`. */
  get sbloccato() {
    try {
      if (!this.licenze?.attive) return true;
      return this.licenze.premium === true;
    } catch (_errore) {
      return false;
    }
  }

  riconosce(tipo) {
    return typeof tipo === "string" && tipo.startsWith(PREFISSO);
  }

  /* `dispositivo` e' il telefono del filo: lo dice `ponte.js`, non il
   * messaggio. */
  async rispondi(detto, { dispositivo = null } = {}) {
    const id = detto?.id ?? null;
    const telefono = String(dispositivo?.id || "");
    if (!telefono || !String(dispositivo?.utente || "").trim())
      return no(
        id,
        "unauthorized",
        "la salute la manda solo un telefono intestato a chi e' entrato",
      );
    switch (detto?.type) {
      case SALUTE_STATO: {
        const voce = this.telefoni[telefono];
        return si(id, {
          acceso: Boolean(voce),
          premium: this.sbloccato,
          persona: voce?.persona || "",
          misure: Object.keys(voce?.misure || {}),
          aggiornato: voce?.aggiornato || 0,
        });
      }
      case SALUTE_MISURE: {
        if (!this.sbloccato)
          return no(id, "premium-richiesto", "la salute dal telefono e' di GdAHome Premium");
        const misure = misurePulite(detto.misure, this.adesso());
        const persona =
          personaPulita(detto.persona) || personaPulita(dispositivo?.proprietario) || "GdAHome";
        const prima = this.telefoni[telefono];
        /* Una misura che non arriva piu' (si e' tolta dalle scelte nell'app)
         * si cancella anche da Home Assistant. */
        const tolte = Object.keys(prima?.misure || {}).filter(
          (k) => !(k in misure) && !detto.aggiungi,
        );
        const voce = {
          persona,
          misure: detto.aggiungi ? { ...(prima?.misure || {}), ...misure } : misure,
          aggiornato: this.adesso(),
        };
        /* Cambiato il nome: i sensori restano, si riscrive il nome. */
        this.telefoni[telefono] = voce;
        this._salva();
        await this._cancella(telefono, tolte);
        await this._scrivi(telefono, voce);
        this.registro.info(`salute: arrivate ${Object.keys(misure).length} misure da un telefono`);
        return si(id, { scritte: Object.keys(misure) });
      }
      case SALUTE_SPEGNI: {
        const voce = this.telefoni[telefono];
        if (voce) {
          await this._cancella(telefono, Object.keys(MISURE_DAL_TELEFONO));
          delete this.telefoni[telefono];
          this._salva();
          this.registro.info("salute: un telefono ha spento la salute");
        }
        return si(id, { spento: true });
      }
      default:
        return no(id, "unknown_command", `non conosco ${detto?.type}`);
    }
  }

  _entita(telefono, chiave) {
    return `sensor.${radiceDelTelefono(telefono)}_${chiave.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`;
  }

  async _scrivi(telefono, voce) {
    if (!this.casa?.api) return;
    for (const [chiave, m] of Object.entries(voce.misure || {})) {
      const aspetto = MISURE_DAL_TELEFONO[chiave];
      if (!aspetto) continue;
      try {
        await this.casa.api("POST", `states/${this._entita(telefono, chiave)}`, {
          state: String(m.valore),
          attributes: {
            friendly_name: `${voce.persona} ${aspetto.nome}`,
            unit_of_measurement: aspetto.unita,
            state_class: aspetto.classe,
            icon: aspetto.icona,
            ...(aspetto.tipo ? { device_class: aspetto.tipo } : {}),
            /* Quando e' stata presa, non quando e' arrivata: la pagina
             * Salute scrive «alle 07:12» da qui. */
            misurato_il: new Date(m.quando).toISOString(),
            gdahome_persona: voce.persona,
            attribution: "Dal telefono, con GdAHome",
          },
        });
      } catch (errore) {
        this.registro.attenzione(
          `salute: Home Assistant non prende i sensori (${errore?.code || "?"})`,
        );
        return;
      }
    }
  }

  async _cancella(telefono, chiavi) {
    if (!this.casa?.api) return;
    for (const chiave of chiavi) {
      try {
        await this.casa.api("DELETE", `states/${this._entita(telefono, chiave)}`);
      } catch (_errore) {
        /* Gia' andato, o Home Assistant appena ripartito: non c'e' piu'. */
      }
    }
  }

  /* Ogni dieci minuti: si riscrive quello che si sa, e chi non e' piu' un
   * telefono di questa casa perde le sue misure. */
  async rimettiGliStati() {
    const vivi = this.dispositivi?.elenco
      ? new Set(this.dispositivi.elenco().map((d) => String(d.id)))
      : null;
    for (const [telefono, voce] of Object.entries(this.telefoni)) {
      if (vivi && !vivi.has(telefono)) {
        await this._cancella(telefono, Object.keys(MISURE_DAL_TELEFONO));
        delete this.telefoni[telefono];
        this._salva();
        continue;
      }
      /* Senza Premium non si riscrive: Home Assistant le perde alla prima
       * ripartenza, e tornano col Premium al primo invio. */
      if (this.sbloccato) await this._scrivi(telefono, voce);
    }
  }

  avvia() {
    this.ferma();
    const specchio = setInterval(() => this.rimettiGliStati().catch(() => {}), SPECCHIO);
    specchio.unref?.();
    const primo = setTimeout(() => this.rimettiGliStati().catch(() => {}), 30_000);
    primo.unref?.();
    this.timer = [specchio, primo];
  }

  ferma() {
    for (const t of this.timer) clearInterval(t);
    this.timer = [];
  }
}
