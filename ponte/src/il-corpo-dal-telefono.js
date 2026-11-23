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
 *     telefono staccato dalla casa perde le sue misure al giro dopo — a meno
 *     che un altro telefono vivo della stessa persona stia gia' mandando le
 *     sue: allora i sensori della persona passano a lui (vedi «Dopo un
 *     riabbinamento», qui sotto).
 *   - **I SENSORI SONO DELLA PERSONA, NON DEL TELEFONO.** «Sei tu che hai
 *     cancellato qualcosa?»: riabbinato il telefono (i dati dell'app
 *     cancellati), per la casa era un telefono nuovo, e i sensori nascevano
 *     con un nome nuovo; quelli di prima sparivano e il loro storico restava
 *     orfano nel Recorder. Adesso il nome nato col primo telefono di un
 *     utente di Home Assistant resta suo (`radici`): il telefono che lo
 *     sostituisce scrive sugli stessi sensori, e lo storico continua. Due
 *     telefoni vivi della stessa persona hanno ognuno i suoi.
 *
 * ─── Dopo un riabbinamento ──────────────────────────────────────────────
 *
 * «Quando ho riassociato il telefono ho perso i dati salute.» Le `radici`
 * bastavano solo se il telefono nuovo mandava le misure DOPO che il vecchio
 * se n'era andato. Ma col tasto «Collega un'app nuova» il vecchio resta vivo
 * finche' il nuovo non lo stacca (`ponte/telefono/sostituisci`) o qualcuno
 * non lo toglie dalla console, e intanto il nuovo manda: due telefoni vivi,
 * due serie. Poi il vecchio si staccava, il giro dei dieci minuti cancellava
 * la serie della persona — quella con lo storico — e il nuovo restava per
 * sempre sulla sua, nata quel giorno. Adesso:
 *
 *   - **il telefono che sostituisce eredita.** Con `sostituisci` (il vecchio
 *     segno: e' lo stesso telefono) la serie passa subito al nuovo, senza
 *     cancellare niente in mezzo (`passaIlTelefono`). Solo fra telefoni della
 *     stessa persona.
 *   - **un telefono staccato non porta via la serie della persona** se un
 *     altro telefono vivo della stessa persona sta mandando: passa a lui (il
 *     piu' recente), e la serie di passaggio di quel telefono si toglie.
 *   - **chi ci e' gia' cascato si rimette a posto da solo.** A ogni giro, una
 *     persona la cui serie non e' di nessun telefono vivo la ridà al suo
 *     telefono che sta mandando. E una volta per avvio si guarda nel Recorder
 *     se c'e' una serie di GdAHome che il ponte non conosce piu' (staccata
 *     prima che ci fossero le `radici`): se porta il nome di una persona sola
 *     della casa, e quella persona ha un telefono che manda, torna sua.
 *   - **il nome della persona non si perde.** Un'app rimessa ha il nome
 *     vuoto: si tiene quello di prima, invece di «GdAHome» — che per la
 *     plancia era un'altra persona.
 *   - **un telefono passato a un'altra persona** (riabbinato per un altro
 *     utente) non scrive sui sensori di quella di prima.
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
/* Quante serie tolte apposta si ricordano (vedi `lasciate`). */
const LASCIATE_AL_MASSIMO = 50;
/* Un sensore della Salute di GdAHome: `sensor.gdahome_1a2b3c4d_passi`. */
const RADICE_NEL_SENSORE = /^sensor\.(gdahome_[0-9a-f]{8})_[a-z_]+$/;

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
  /* L'anello Attivita' e quello che Salute mostra accanto ai passi: tutte
   * «di oggi», contatori che ripartono a mezzanotte. Le calorie a riposo si
   * chiamano «Basal energy burned», come HealthKit: con «calories» nel nome
   * la plancia le confonderebbe con le attive. */
  calorieRiposo: {
    nome: "Basal energy burned",
    unita: "kcal",
    min: 0,
    max: 20_000,
    classe: "total_increasing",
    icona: "mdi:fire-circle",
  },
  distanza: {
    nome: "Walking running distance",
    unita: "km",
    /* 0,19 km: col decimale solo sarebbe 0,2. */
    cifre: 2,
    min: 0,
    max: 500,
    classe: "total_increasing",
    tipo: "distance",
    icona: "mdi:map-marker-distance",
  },
  piani: {
    nome: "Flights climbed",
    unita: "floors",
    min: 0,
    max: 2_000,
    classe: "total_increasing",
    icona: "mdi:stairs-up",
  },
  esercizio: {
    nome: "Exercise time",
    unita: "min",
    min: 0,
    max: 24 * 60,
    classe: "total_increasing",
    tipo: "duration",
    icona: "mdi:run-fast",
  },
  inPiedi: {
    nome: "Stand hours",
    unita: "h",
    min: 0,
    max: 24,
    classe: "total_increasing",
    icona: "mdi:human-handsup",
  },
  /* Quelle della notte che il WHOOP (e non solo) scrive in Salute e in
   * Health Connect, e quelle che da' solo l'account WHOOP collegato
   * nell'app: il recupero in percentuale e lo sforzo da 0 a 21. */
  hrv: {
    nome: "Heart rate variability",
    unita: "ms",
    min: 1,
    max: 400,
    classe: "measurement",
    icona: "mdi:heart-pulse",
  },
  respiro: {
    nome: "Respiratory rate",
    unita: "breaths/min",
    min: 2,
    max: 60,
    classe: "measurement",
    icona: "mdi:lungs",
  },
  temperaturaPelle: {
    nome: "Skin temperature",
    unita: "°C",
    min: 20,
    max: 45,
    classe: "measurement",
    tipo: "temperature",
    icona: "mdi:thermometer",
  },
  recupero: {
    nome: "Recovery",
    unita: "%",
    min: 0,
    max: 100,
    classe: "measurement",
    icona: "mdi:battery-heart-variant",
  },
  sforzo: {
    nome: "Strain",
    min: 0,
    max: 21,
    classe: "measurement",
    icona: "mdi:lightning-bolt",
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
    const scala = 10 ** (aspetto.cifre ?? 1);
    fuori[chiave] = { valore: Math.round(valore * scala) / scala, quando };
  }
  return fuori;
}

/* Il pezzo del nome dei sensori di un telefono: dall'identificativo, non dal
 * nome della persona — il nome si puo' cambiare, i sensori restano. */
export function radiceDelTelefono(id) {
  return `gdahome_${createHash("sha256").update(String(id)).digest("hex").slice(0, 8)}`;
}

/* Dalla storia del Recorder (`history/history_during_period`, nella forma
 * corta del filo: `{s, a, lu, lc}` coi secondi), per ogni serie: quando ha il
 * primo stato, quando l'ultimo, e il nome della persona che portava per
 * ultimo. */
function tempiDelleSerie(storia) {
  const tempi = new Map();
  for (const [entita, stati] of Object.entries(
    storia && typeof storia === "object" ? storia : {},
  )) {
    const radice = RADICE_NEL_SENSORE.exec(entita)?.[1];
    if (!radice || !Array.isArray(stati)) continue;
    const t = tempi.get(radice) || { prima: Infinity, ultima: 0, persona: "", quando: 0 };
    for (const stato of stati) {
      /* Un sensore tolto lascia nel Recorder una riga vuota: non e' una
       * misura, e non dice quando la serie ha smesso di averne. */
      const valore = String(stato?.s ?? stato?.state ?? "");
      if (!valore || valore === "unavailable" || valore === "unknown") continue;
      const secondi = Number(stato?.lu ?? stato?.lc);
      const quando = Number.isFinite(secondi)
        ? secondi * 1000
        : Date.parse(stato?.last_updated || stato?.last_changed || "") || 0;
      if (!quando) continue;
      t.prima = Math.min(t.prima, quando);
      t.ultima = Math.max(t.ultima, quando);
      const persona = personaPulita((stato?.a || stato?.attributes)?.gdahome_persona);
      if (persona && quando >= t.quando) {
        t.persona = persona;
        t.quando = quando;
      }
    }
    tempi.set(radice, t);
  }
  return tempi;
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

  /* Il nome dei sensori di ogni persona (l'utente di Home Assistant): quello
   * nato col suo primo telefono. */
  get radici() {
    const tutte = this.archivio.dati.radici;
    return tutte && typeof tutte === "object" ? tutte : (this.archivio.dati.radici = {});
  }

  /* Il nome con cui ogni persona si e' fatta chiamare l'ultima volta: un'app
   * rimessa lo ha vuoto, e senza questo i suoi sensori diventavano «GdAHome
   * Steps» — un'altra persona, per la plancia. */
  get nomi() {
    const tutti = this.archivio.dati.nomi;
    return tutti && typeof tutti === "object" ? tutti : (this.archivio.dati.nomi = {});
  }

  /* Le serie che il ponte ha tolto apposta — un telefono spento, uno
   * staccato senza nessuno a cui passarla, una di passaggio lasciata per
   * quella della persona — e che chi cerca le orfane nel Recorder
   * (`_cercaLeOrfane`) non deve riportare in vita. Quella di una persona non
   * ci va: la ricorda gia' `radici`. */
  get lasciate() {
    const tutte = this.archivio.dati.lasciate;
    return Array.isArray(tutte) ? tutte : (this.archivio.dati.lasciate = []);
  }

  _lascia(radice) {
    if (!radice || Object.values(this.radici).includes(radice)) return;
    const tenute = this.lasciate.filter((una) => una !== radice);
    tenute.push(radice);
    this.archivio.dati.lasciate = tenute.slice(-LASCIATE_AL_MASSIMO);
  }

  /* Il nome dei sensori di un telefono: il suo, o quello della persona che
   * ha ereditato. */
  _radiceDi(telefono) {
    return this.telefoni[telefono]?.radice || radiceDelTelefono(telefono);
  }

  /* I telefoni vivi della casa, con di chi sono e quando sono nati. `null`
   * senza l'elenco dei telefoni: allora non si sa chi e' vivo, e nel dubbio
   * non si passa niente a nessuno. */
  _vivi() {
    if (!this.dispositivi?.elenco) return null;
    return new Map(this.dispositivi.elenco().map((d) => [String(d.id), d]));
  }

  /* Di chi e' un telefono: per uno vivo lo dice l'elenco dei telefoni (e'
   * quello che conta, anche se e' stato riabbinato per un altro); poi la sua
   * voce; e per uno staccato scritto prima che le voci se lo ricordassero, la
   * persona di cui ha la serie. */
  _utenteDi(telefono, vivi = this._vivi()) {
    const detto = String(vivi?.get(telefono)?.utente || this.telefoni[telefono]?.utente || "");
    if (detto.trim()) return detto.trim();
    const radice = this._radiceDi(telefono);
    return Object.keys(this.radici).find((utente) => this.radici[utente] === radice) || "";
  }

  /* Che nome prende un telefono che manda: quello della sua persona, se
   * nessun altro telefono vivo suo lo sta usando — anche se il telefono ne
   * aveva gia' uno suo, nato mentre il vecchio era ancora in casa. `propria`
   * e' la serie che il telefono ha adesso (`""` se non manda ancora).
   * `eredita` e' la voce del telefono di prima, se la serie viene da li'. */
  _radicePer(telefono, utente, propria = "") {
    const tua = propria || this._radiceNuova(telefono, utente);
    const sua = utente ? this.radici[utente] : "";
    if (!sua || sua === tua) return { radice: tua, eredita: null };
    const vivi = this._vivi();
    const chiLaTiene = Object.keys(this.telefoni).filter(
      (altro) => altro !== telefono && this._radiceDi(altro) === sua,
    );
    /* Un telefono vivo della stessa persona la sta usando: due telefoni,
     * due nomi. Senza l'elenco dei telefoni non si sa chi e' vivo, e nel
     * dubbio non si prende. */
    if (!vivi || chiLaTiene.some((altro) => vivi.has(altro))) return { radice: tua, eredita: null };
    /* Il telefono di prima non c'e' piu': i suoi sensori passano a questo, e
     * la sua voce se ne va senza cancellarli (sono gli stessi). */
    let eredita = null;
    for (const altro of chiLaTiene) {
      eredita ||= this.telefoni[altro];
      delete this.telefoni[altro];
    }
    return { radice: sua, eredita };
  }

  /* Il nome di una serie nuova per un telefono: dal suo identificativo, a
   * meno che quel nome sia gia' preso — da un'altra persona (il telefono
   * riabbinato per qualcun altro tiene lo stesso identificativo, e non deve
   * scrivere sui sensori di chi lo aveva prima) o da un altro telefono (che
   * l'ha ereditato mentre questo aveva la Salute spenta). */
  _radiceNuova(telefono, utente) {
    const presa = (radice) =>
      Object.entries(this.radici).some(([chi, sua]) => sua === radice && chi !== utente) ||
      Object.keys(this.telefoni).some(
        (altro) => altro !== telefono && this._radiceDi(altro) === radice,
      );
    let radice = radiceDelTelefono(telefono);
    for (let giro = 1; giro <= 10 && presa(radice); giro += 1) {
      radice = radiceDelTelefono(`${telefono}\n${utente}\n${giro}`);
    }
    return radice;
  }

  /* Il telefono a cui passa la serie di una persona: un suo telefono vivo che
   * sta gia' mandando, il piu' recente (l'ultimo abbinato e' quello che ha
   * sostituito gli altri). Mai `tranne`. */
  _erede(utente, vivi, tranne = "") {
    if (!utente || !vivi) return "";
    const nato = (telefono) => Number(vivi.get(telefono)?.natoIl) || 0;
    const candidati = Object.keys(this.telefoni).filter(
      (telefono) =>
        telefono !== tranne && vivi.has(telefono) && this._utenteDi(telefono, vivi) === utente,
    );
    return candidati.sort((uno, altro) => nato(altro) - nato(uno))[0] || "";
  }

  /* Un telefono prende la serie `radice`. La sua di passaggio esce da Home
   * Assistant — sarebbe un doppione della stessa persona — e il Recorder ne
   * tiene lo storico come di ogni sensore che se ne va. */
  async _riprendi(telefono, radice) {
    const voce = this.telefoni[telefono];
    if (!voce) return;
    const sua = this._radiceDi(telefono);
    if (sua === radice) return;
    await this._cancellaLaRadice(sua, Object.keys(MISURE_DAL_TELEFONO));
    voce.radice = radice;
    this._lascia(sua);
    this._salva();
  }

  /* Un telefono che non scrive piu' per la sua persona — staccato, o passato
   * a un'altra. Se la sua serie e' quella della persona e un altro telefono
   * vivo suo sta mandando, passa a lui senza che niente si cancelli; se no
   * esce da Home Assistant, come sempre. */
  async _viaLaSerie(telefono, utente, vivi) {
    const radice = this._radiceDi(telefono);
    const erede =
      utente && this.radici[utente] === radice ? this._erede(utente, vivi, telefono) : "";
    if (erede) {
      delete this.telefoni[telefono];
      await this._riprendi(erede, radice);
    } else {
      await this._cancellaLaRadice(radice, Object.keys(MISURE_DAL_TELEFONO));
      delete this.telefoni[telefono];
      this._lascia(radice);
    }
    this._salva();
    return erede;
  }

  /* Una cosa alla volta: un invio, il giro dei dieci minuti e un telefono
   * che ne sostituisce un altro toccano le stesse voci, e fra un `await` e
   * l'altro non si devono pestare i piedi. */
  _inFila(cosa) {
    const fatto = (this._fila || Promise.resolve()).then(cosa, cosa);
    this._fila = fatto.catch(() => {});
    return fatto;
  }

  /**
   * Il telefono `vecchio` lascia il posto a `nuovo`: `ponte/telefono/
   * sostituisci`, col vecchio segno — e' lo stesso telefono, riabbinato con
   * un codice nuovo. La sua serie passa al nuovo subito, senza che il giro
   * dei dieci minuti la cancelli in mezzo, e solo fra telefoni della stessa
   * persona. `utente` e' di chi era il vecchio, detto prima di staccarlo.
   * Torna se e' passata.
   */
  passaIlTelefono(vecchio, nuovo, { utente = "" } = {}) {
    return this._inFila(async () => {
      const da = String(vecchio || "");
      const a = String(nuovo || "");
      const voce = this.telefoni[da];
      if (!voce || !a || da === a) return false;
      const vivi = this._vivi();
      const suo = String(utente || "").trim() || this._utenteDi(da, vivi);
      if (!suo || suo !== this._utenteDi(a, vivi)) return false;
      const radice = this._radiceDi(da);
      const dopo = this.telefoni[a];
      delete this.telefoni[da];
      if (dopo) {
        /* Il nuovo stava gia' mandando sulla sua di passaggio: riprende
         * quella della persona, e le misure piu' recenti restano. */
        await this._riprendi(a, radice);
        const misure = { ...(voce.misure || {}) };
        for (const [chiave, m] of Object.entries(dopo.misure || {})) {
          if (!misure[chiave] || (m?.quando || 0) >= (misure[chiave]?.quando || 0)) {
            misure[chiave] = m;
          }
        }
        dopo.misure = misure;
        dopo.utente = suo;
      } else {
        this.telefoni[a] = { ...voce, radice, utente: suo };
      }
      this._salva();
      if (this.sbloccato) await this._scrivi(a, this.telefoni[a]);
      this.registro.info("salute: un telefono riabbinato continua la serie di prima");
      return true;
    });
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

  /* Un no lo deve poter leggere chi assiste la casa: «non vanno nella
   * plancia» e nel registro dell'add-on niente diceva perche'. Una riga sola
   * per telefono e per motivo, finche' il ponte non riparte — l'app ritenta
   * ogni quarto d'ora — e mai un nome o un valore. */
  _diUnNo(telefono, motivo, perche) {
    const chiave = `${telefono}:${motivo}`;
    this._noDetti ||= new Set();
    if (this._noDetti.has(chiave)) return;
    this._noDetti.add(chiave);
    this.registro.attenzione(`salute: misure di un telefono rifiutate, ${perche}`);
  }

  riconosce(tipo) {
    return typeof tipo === "string" && tipo.startsWith(PREFISSO);
  }

  /* `dispositivo` e' il telefono del filo: lo dice `ponte.js`, non il
   * messaggio. */
  async rispondi(detto, { dispositivo = null } = {}) {
    const id = detto?.id ?? null;
    const telefono = String(dispositivo?.id || "");
    if (!telefono || !String(dispositivo?.utente || "").trim()) {
      this._diUnNo(
        telefono,
        "senza-utente",
        "non e' intestato a un utente di Home Assistant (va riabbinato)",
      );
      return no(
        id,
        "unauthorized",
        "la salute la manda solo un telefono intestato a chi e' entrato",
      );
    }
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
        if (!this.sbloccato) {
          this._diUnNo(telefono, "premium", "la casa non ha GdAHome Premium");
          return no(id, "premium-richiesto", "la salute dal telefono e' di GdAHome Premium");
        }
        return this._inFila(() => this._misure(id, detto, telefono, dispositivo));
      }
      case SALUTE_SPEGNI:
        return this._inFila(async () => {
          const voce = this.telefoni[telefono];
          if (voce) {
            const radice = this._radiceDi(telefono);
            await this._cancella(telefono, Object.keys(MISURE_DAL_TELEFONO));
            delete this.telefoni[telefono];
            this._lascia(radice);
            this._salva();
            this.registro.info("salute: un telefono ha spento la salute");
          }
          return si(id, { spento: true });
        });
      default:
        return no(id, "unknown_command", `non conosco ${detto?.type}`);
    }
  }

  async _misure(id, detto, telefono, dispositivo) {
    const misure = misurePulite(detto.misure, this.adesso());
    const utente = String(dispositivo?.utente || "").trim();
    let prima = this.telefoni[telefono];
    /* Riabbinato per un'altra persona (il QR del telefono, ma «per chi» e'
     * cambiato): la serie di prima era dell'altra, e non ci scrive. Passa a
     * un altro telefono di quella persona, se ne ha uno che manda, o si
     * toglie. */
    if (prima?.utente && prima.utente !== utente) {
      await this._viaLaSerie(telefono, prima.utente, this._vivi());
      prima = undefined;
    }
    const propria = prima ? this._radiceDi(telefono) : "";
    const { radice, eredita } = this._radicePer(telefono, utente, propria);
    /* La persona ricorda il nome dei suoi sensori, anche quello dei
     * telefoni abbinati prima di questa regola. */
    if (utente && !this.radici[utente]) this.radici[utente] = radice;
    /* Le misure che la serie aveva: le sue, o quelle del telefono di prima. */
    const base = radice === propria ? prima : eredita;
    /* Il nome: quello scritto nell'app; se e' vuoto (un'app rimessa) quello
     * di «Di chi e' questo telefono?», e poi quello che la persona aveva. */
    const persona =
      personaPulita(detto.persona) ||
      personaPulita(dispositivo?.proprietario) ||
      personaPulita(this._vivi()?.get(telefono)?.proprietario) ||
      personaPulita(base?.persona) ||
      personaPulita(prima?.persona) ||
      personaPulita(utente ? this.nomi[utente] : "") ||
      "GdAHome";
    if (utente && persona !== "GdAHome") this.nomi[utente] = persona;
    /* Una misura che non arriva piu' (si e' tolta dalle scelte nell'app)
     * si cancella anche da Home Assistant. */
    const tolte = Object.keys(base?.misure || {}).filter((k) => !(k in misure) && !detto.aggiungi);
    const voce = {
      persona,
      radice,
      ...(utente ? { utente } : {}),
      misure: detto.aggiungi ? { ...(base?.misure || {}), ...misure } : misure,
      aggiornato: this.adesso(),
    };
    /* Ripresa la serie della persona: quella di passaggio di questo
     * telefono se ne va, cosi' la plancia non ne vede due. */
    if (propria && propria !== radice) {
      await this._cancellaLaRadice(propria, Object.keys(MISURE_DAL_TELEFONO));
      this._lascia(propria);
      this.registro.info("salute: un telefono ha ripreso la serie della sua persona");
    }
    /* Cambiato il nome: i sensori restano, si riscrive il nome. */
    this.telefoni[telefono] = voce;
    this._salva();
    await this._cancella(telefono, tolte);
    await this._scrivi(telefono, voce);
    this.registro.info(`salute: arrivate ${Object.keys(misure).length} misure da un telefono`);
    return si(id, { scritte: Object.keys(misure) });
  }

  _entitaDi(radice, chiave) {
    return `sensor.${radice}_${chiave.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}`;
  }

  _entita(telefono, chiave) {
    return this._entitaDi(this._radiceDi(telefono), chiave);
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
    return this._cancellaLaRadice(this._radiceDi(telefono), chiavi);
  }

  async _cancellaLaRadice(radice, chiavi) {
    if (!this.casa?.api) return;
    for (const chiave of chiavi) {
      try {
        await this.casa.api("DELETE", `states/${this._entitaDi(radice, chiave)}`);
      } catch (_errore) {
        /* Gia' andato, o Home Assistant appena ripartito: non c'e' piu'. */
      }
    }
  }

  /* Ogni dieci minuti: si riscrive quello che si sa, e chi non e' piu' un
   * telefono di questa casa perde le sue misure — o le passa a un altro
   * telefono della stessa persona che sta mandando. */
  rimettiGliStati() {
    return this._inFila(async () => {
      const vivi = this._vivi();
      if (vivi) {
        for (const telefono of Object.keys(this.telefoni)) {
          if (vivi.has(telefono)) continue;
          await this._viaLaSerie(telefono, this._utenteDi(telefono, vivi), vivi);
        }
        await this._ridaiLeSerie(vivi);
        if (this.sbloccato) {
          try {
            await this._cercaLeOrfane(vivi);
          } catch (errore) {
            this.registro.attenzione(
              `salute: il Recorder non dice le serie di prima (${errore?.code || errore?.message || "?"})`,
            );
          }
        }
      }
      /* Senza Premium non si riscrive: Home Assistant le perde alla prima
       * ripartenza, e tornano col Premium al primo invio. */
      if (!this.sbloccato) return;
      for (const [telefono, voce] of Object.entries(this.telefoni)) {
        await this._scrivi(telefono, voce);
      }
    });
  }

  /* Chi ci e' gia' cascato: una persona la cui serie non e' di nessun
   * telefono — il vecchio staccato e cancellato dal ponte di prima — mentre
   * un suo telefono vivo manda su una serie sua, nata col riabbinamento. La
   * serie della persona torna a quel telefono, e col nome di prima torna
   * visibile anche lo storico che il Recorder ha tenuto. */
  async _ridaiLeSerie(vivi) {
    for (const [utente, radice] of Object.entries(this.radici)) {
      if (Object.keys(this.telefoni).some((telefono) => this._radiceDi(telefono) === radice)) {
        continue;
      }
      const erede = this._erede(utente, vivi);
      if (!erede) continue;
      await this._riprendi(erede, radice);
      this.registro.info("salute: la serie di una persona e' tornata al suo telefono");
    }
  }

  /* ─── Le serie che il ponte non ricorda piu' ───────────────────────────
   *
   * Un telefono staccato prima che le persone ricordassero la loro serie
   * (`radici`) se l'e' portata via: il ponte l'ha cancellata da Home
   * Assistant e dal disco, ma il Recorder ne tiene lo storico. Una volta per
   * avvio (e per persona) si chiede al Recorder quali serie di GdAHome
   * conosce; una che il ponte non sa di chi sia, e che non ha tolto apposta
   * (`lasciate`), torna alla persona di cui porta il nome se:
   *
   *   - quel nome e' di una persona sola della casa, con un telefono vivo
   *     che sta mandando;
   *   - la serie di adesso di quella persona e' nata DOPO l'ultima misura
   *     dell'orfana: e' quella del telefono che l'ha sostituita, non quella
   *     di un altro telefono che le stava accanto.
   *
   * Il Recorder tiene gli stati (e quindi il nome) per qualche giorno: una
   * serie piu' vecchia di cosi' non si sa di chi sia, e resta dov'e'. */
  async _cercaLeOrfane(vivi) {
    if (!this.casa?.chiedi) return;
    this._orfaneCercate ||= new Set();
    const perNome = new Map();
    for (const telefono of Object.keys(this.telefoni)) {
      if (!vivi.has(telefono)) continue;
      const utente = this._utenteDi(telefono, vivi);
      const nome = personaPulita(this.telefoni[telefono].persona).toLowerCase();
      if (!utente || !nome || nome === "gdahome") continue;
      perNome.set(nome, perNome.has(nome) && perNome.get(nome) !== utente ? "" : utente);
    }
    const daCercare = [...new Set(perNome.values())].filter(
      (utente) => utente && !this._orfaneCercate.has(utente),
    );
    if (!daCercare.length) return;
    const elenco = await this.casa.chiedi({ type: "recorder/list_statistic_ids" });
    for (const utente of daCercare) this._orfaneCercate.add(utente);
    const conosciute = new Set([
      ...Object.values(this.radici),
      ...this.lasciate,
      ...Object.keys(this.telefoni).map((telefono) => this._radiceDi(telefono)),
    ]);
    /* I sensori di GdAHome che il Recorder conosce, per serie. */
    const nelRecorder = new Map();
    for (const una of Array.isArray(elenco) ? elenco : []) {
      const id = String(una?.statistic_id || "");
      const radice = RADICE_NEL_SENSORE.exec(id)?.[1];
      if (radice) nelRecorder.set(radice, [...(nelRecorder.get(radice) || []), id]);
    }
    const orfane = [...nelRecorder.keys()].filter((radice) => !conosciute.has(radice));
    if (!orfane.length) return;
    /* Le serie di adesso delle persone che cercano: per sapere quando sono
     * nate. */
    const diAdesso = daCercare.map((utente) => this.radici[utente]).filter(Boolean);
    const fine = this.adesso();
    const storia = await this.casa.chiedi({
      type: "history/history_during_period",
      start_time: new Date(fine - VECCHIA).toISOString(),
      end_time: new Date(fine).toISOString(),
      entity_ids: [...orfane, ...diAdesso].flatMap((radice) => nelRecorder.get(radice) || []),
      minimal_response: false,
      no_attributes: false,
      significant_changes_only: false,
    });
    const tempi = tempiDelleSerie(storia);
    /* Per ogni persona l'orfana col suo nome piu' recente. */
    const scelte = new Map();
    for (const radice of orfane) {
      const t = tempi.get(radice);
      const utente = t?.persona ? perNome.get(t.persona.toLowerCase()) : "";
      if (!utente || !daCercare.includes(utente)) continue;
      const gia = scelte.get(utente);
      if (!gia || t.ultima > gia.ultima) scelte.set(utente, { radice, ultima: t.ultima });
    }
    for (const [utente, { radice, ultima }] of scelte) {
      const sua = this.radici[utente];
      const nata = sua ? tempi.get(sua)?.prima : 0;
      /* La serie di adesso deve essere nata dopo: senza saperlo, niente. */
      if (sua && !(Number.isFinite(nata) && nata >= ultima)) continue;
      const chi =
        Object.keys(this.telefoni).find(
          (telefono) =>
            vivi.has(telefono) &&
            this._radiceDi(telefono) === sua &&
            this._utenteDi(telefono, vivi) === utente,
        ) || this._erede(utente, vivi);
      if (!chi) continue;
      this.radici[utente] = radice;
      await this._riprendi(chi, radice);
      this.registro.info("salute: ritrovata nel Recorder la serie di prima di una persona");
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
