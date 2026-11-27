/* I pannelli a muro, dall'add-on.
 *
 * «Un inject semplice che puo' fare qualsiasi utente»: un Sonoff NSPanel Pro
 * (o un altro pannello Android) diventa un pannello GdAHome dalla pagina
 * dell'add-on, senza computer. L'utente scrive — o fa trovare — l'indirizzo,
 * e l'add-on fa tutto lui via ADB: guarda il pannello, ne salva una copia,
 * installa GdAHome OS e l'app GdAHome Muro, e lo fa entrare nella casa come
 * un telefono abbinato. Piu' d'uno per casa.
 *
 * Qui c'e' l'orchestrazione e lo stato: l'elenco (in `/data/pannelli.json`),
 * i lavori coi loro passi che la console segue, la scansione della rete, la
 * verifica. Il «come si parla» col pannello sta in `adb.js`; il lavoro grezzo
 * di installazione sta in un `Installatore` iniettabile, cosi' le prove gli
 * danno un finto e non serve un pannello vero.
 *
 * La plancia a muro e' Premium: un'installazione con la casa Base viene
 * rifiutata qui, dove la licenza si sa (`licenze.js`), non nell'app.
 */
import { Archivio } from "./archivio.js";
import { Adb, adbCE } from "./adb.js";
import { Installatore, RITOCCO } from "./installatore-pannelli.js";
import { join } from "node:path";

/* Riconosce il modello dal numero dei punti dello schermo. */
export function modelloDalloSchermo(schermo) {
  const s = String(schermo || "").replace(/[x×]/i, "x");
  if (s === "480x480") return "86";
  if (s === "750x1334" || s === "1334x750") return "120";
  return "";
}

function idNuovo() {
  let s = "pm_";
  for (let i = 0; i < 12; i += 1) s += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  return s;
}

/* Gli indirizzi di una rete /24, dal .1 al .254, a partire dall'indirizzo
 * della macchina (se e' 192.168.1.x, cerca 192.168.1.1..254). */
export function indirizziDellaRete(mio) {
  const m = /^(\d+\.\d+\.\d+)\.\d+$/.exec(String(mio || ""));
  if (!m) return [];
  const indirizzi = [];
  for (let n = 1; n <= 254; n += 1) indirizzi.push(`${m[1]}.${n}`);
  return indirizzi;
}

export class Pannelli {
  constructor({
    cartella = "/data",
    adb = null,
    installatore = null,
    licenze = null,
    reteDiCasa = null,
    dispositivi = null,
    abbinaPannello = null,
    plance = null,
    cartellaDeiPezzi = "/app/muro",
    avvia = undefined,
    adesso = () => Date.now(),
    riprovaDelRifiuto = { volte: 3, pausa: 3_000 },
    collegamenti = null,
  } = {}) {
    this.archivio = new Archivio(join(cartella, "pannelli.json"), { pannelli: [] });
    this.adb = adb || new Adb(avvia ? { avvia } : {});
    this.installatore =
      installatore ||
      new Installatore({
        adb: this.adb,
        cartellaDeiPezzi,
        abbinaPannello,
        dispositivi,
        /* Per la copia diretta: dove il pannello manda i dati. */
        indirizzoDiCasa: () => reteDiCasa?.indirizzo?.() || "",
      });
    this.licenze = licenze;
    this.reteDiCasa = reteDiCasa;
    this.dispositivi = dispositivi;
    this.plance = plance;
    this.adesso = adesso;
    /* I lavori in corso, per pannello: non si salvano su disco, vivono quanto
     * dura il lavoro. La console li segue. */
    this.lavori = new Map();
    /* Quante volte, e ogni quanto, si riprova un pannello che rifiuta. */
    this.riprovaDelRifiuto = riprovaDelRifiuto;
    /* Da dove e' collegato un dispositivo (`Ponte.comeECollegato`). */
    this.collegamenti = collegamenti;
  }

  _premium() {
    /* Senza `licenze` (sul banco) si fa come se fosse Premium: le prove
     * dell'orchestrazione non passano dalla licenza. In casa, `licenze`
     * c'e' sempre. */
    if (!this.licenze) return true;
    try {
      const stato = this.licenze.stato?.();
      return Boolean(stato?.gdahome?.attiva);
    } catch (_e) {
      return false;
    }
  }

  _trova(id) {
    return this.archivio.dati.pannelli.find((uno) => uno.id === id) || null;
  }

  _salva() {
    this.archivio.salva();
  }

  /* Cosa mostra la console: l'elenco coi lavori in corso attaccati, se e'
   * Premium, e se `adb` c'e'. */
  async elenco() {
    const adb = await adbCE(this.adb);
    const pannelli = this.archivio.dati.pannelli.map((uno) => {
      const lavoro = this.lavori.get(uno.id) || null;
      return {
        ...uno,
        lavoro: lavoro ? { ...lavoro, passi: lavoro.passi.map((p) => ({ ...p })) } : null,
      };
    });
    return { pannelli, premium: this._premium(), adb };
  }

  /* ─── La scansione della rete ─── */

  /* Cerca i pannelli con ADB acceso sulla rete di casa. Prova a collegarsi a
   * ogni indirizzo; quelli che rispondono e hanno l'aria di un pannello
   * tornano nell'elenco. Pochi alla volta, per non riempire la rete.
   *
   * Torna anche `contattati` e `rete`, che servono a capire «perche' niente»:
   *  - `contattati`: quanti indirizzi hanno dato una risposta TCP — collegati,
   *    o che hanno rifiutato la 5555. Se e' > 0 l'add-on arriva alla rete, e
   *    un pannello non trovato ha solo l'ADB di rete spento (o sta altrove);
   *    se e' 0 su una /24 intera, l'add-on non arriva a quella rete.
   *  - `rete`: la /24 guardata (es. "192.168.1"), per dirlo all'utente: se il
   *    pannello sta su un'altra sottorete, si vede subito. */
  rete(opzioni = {}) {
    /* Una ricerca alla volta: chi chiede mentre una e' in corso riceve quella.
     * Prima la console ne faceva partire una ogni 4 secondi, e una dura fino a
     * un minuto: dieci ricerche insieme, centinaia di connessioni sullo stesso
     * adb che intanto copiava un pannello («500 di 254»). */
    if (this._ricercaInCorso) return this._ricercaInCorso;
    /* E nessuna ricerca mentre si lavora su un pannello: adb serve a lui. */
    if ([...this.lavori.values()].some((l) => !l.finito))
      return Promise.resolve({ trovati: [], adb: true, occupato: true });
    this._ricercaInCorso = this._cercaInRete(opzioni).finally(() => {
      this._ricercaInCorso = null;
    });
    return this._ricercaInCorso;
  }

  async _cercaInRete({ concorrenti = 24 } = {}) {
    if (!(await adbCE(this.adb))) return { trovati: [], adb: false };
    /* Il server di adb, una volta, prima di tutto: se non parte, la ricerca
     * non ha senso e la ragione va detta (prima diceva «nessun dispositivo»). */
    const rotto = await this._serverDiAdb();
    if (rotto) return { trovati: [], adb: true, adbRotto: true, perche: rotto };
    const mio = this.reteDiCasa?.indirizzo?.() || this.reteDiCasa?.mio || "";
    const indirizzi = indirizziDellaRete(mio);
    if (!indirizzi.length) return { trovati: [], adb: true, senzaRete: true };
    const rete = /^(\d+\.\d+\.\d+)\.\d+$/.exec(mio)?.[1] || "";
    const gia = new Set(this.archivio.dati.pannelli.map((u) => u.indirizzo));
    const trovati = [];
    let contattati = 0;
    let i = 0;
    /* A che punto e': la console lo chiede mentre la ricerca va avanti
     * (`statoDellaRicerca`), cosi' si vede che sta cercando davvero. */
    /* Il suo stato, di questa ricerca e basta. */
    const stato = { fatti: 0, totale: indirizzi.length, trovati, rete, inCorso: true };
    this.ricerca = stato;
    const lavoratore = async () => {
      while (i < indirizzi.length) {
        const indirizzo = indirizzi[i++];
        try {
          const prova = await this.adb.provaCollegamento(indirizzo);
          /* Una risposta — collegato, «rifiutato» o «da autorizzare» — dice
           * che l'add-on arriva a quell'indirizzo: la rete e' raggiungibile. */
          if (prova.ok || prova.causa === "rifiutato" || prova.causa === "non_autorizzato")
            contattati += 1;
          /* L'ADB di rete e' acceso ma il pannello aspetta il permesso: non si
           * sa ancora che modello e', ma e' quasi certamente lui. Si mostra,
           * e il collegamento resta aperto perche' l'avviso resti a schermo. */
          if (prova.causa === "non_autorizzato") {
            trovati.push({ indirizzo, modello: "", daAutorizzare: true, gia: gia.has(indirizzo) });
            continue;
          }
          if (!prova.ok) continue;
          const modello = await this._modelloDi(indirizzo);
          if (modello.pannello)
            trovati.push({ indirizzo, modello: modello.modello, gia: gia.has(indirizzo) });
          await this.adb.stacca(indirizzo);
        } catch (_e) {
          /* Un indirizzo che non risponde non ferma la scansione. */
        } finally {
          stato.fatti += 1;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(concorrenti, indirizzi.length) }, lavoratore));
    trovati.sort((a, b) => a.indirizzo.localeCompare(b.indirizzo, undefined, { numeric: true }));
    stato.inCorso = false;
    return { trovati, adb: true, contattati, rete };
  }

  /* A che punto e' la ricerca in corso: { inCorso, fatti, totale, trovati, rete }. */
  statoDellaRicerca() {
    const r = this.ricerca;
    if (!r) return { inCorso: false, fatti: 0, totale: 0, trovati: 0, rete: "" };
    return {
      inCorso: r.inCorso,
      fatti: Math.min(r.fatti, r.totale),
      totale: r.totale,
      trovati: r.trovati.length,
      rete: r.rete,
    };
  }

  /* Fa partire il server di adb. Torna "" se e' su, o la frase da mostrare se
   * non parte. Un adb finto (le prove) senza `avviaServer` e' sempre su. */
  async _serverDiAdb() {
    if (typeof this.adb.avviaServer !== "function") return "";
    try {
      await this.adb.avviaServer();
      return "";
    } catch (errore) {
      return messaggioDelDemone(errore);
    }
  }

  async _modelloDi(indirizzo) {
    const marca =
      (await this.adb.getprop(indirizzo, "ro.product.manufacturer").catch(() => "")) || "";
    const schermo = await this._schermo(indirizzo).catch(() => "");
    const modello = modelloDalloSchermo(schermo);
    /* Un pannello: un NSPanel riconosciuto, o comunque un Android con lo
     * schermo piccolo che risponde ad ADB. */
    const pannello = Boolean(modello) || /sonoff|smatek|eachen|coolkit/i.test(marca);
    return { pannello, modello, schermo, marca };
  }

  async _schermo(indirizzo) {
    const detto = await this.adb.shell(indirizzo, "wm size", { root: false });
    const m = /(\d+)x(\d+)/.exec(String(detto).replace(/.*:/, ""));
    return m ? `${m[1]}x${m[2]}` : "";
  }

  /* ─── La verifica ─── */

  /* Guarda un pannello: che modello e', se e' sbloccato, se c'e' spazio per la
   * copia, com'e' la WebView. Dice se si puo' installare (`adatto`). */
  /* Un indirizzo fuori dalla rete di casa e' quasi sempre una cifra sbagliata
   * («192.198.1.120» per «192.168.1.120»): lo si dice, col probabile giusto
   * — la rete di casa con l'ultimo numero scritto. `""` se e' nella rete, o
   * se la rete non si sa. */
  _fuoriDallaRete(indirizzo) {
    const casa = this.reteDiCasa?.indirizzo?.() || "";
    const rete = casa.split(".").slice(0, 3).join(".");
    const scritto = String(indirizzo).split(":")[0].split(".");
    if (!rete || scritto.length !== 4 || scritto.slice(0, 3).join(".") === rete) return "";
    return `${scritto.join(".")} non e' nella rete di casa (${rete}.x): forse volevi ${rete}.${scritto[3]}? Controlla le cifre e riprova.`;
  }

  async verifica(indirizzo) {
    if (!(await adbCE(this.adb)))
      return {
        indirizzo,
        adatto: false,
        verifiche: [{ esito: "male", detto: "adb non e' in questo add-on" }],
      };
    const pulito = indirizzoPulito(indirizzo);
    if (!pulito) {
      const e = new Error("L'indirizzo non va bene: scrivi per esempio 192.168.1.50.");
      e.perUtente = true;
      throw e;
    }
    /* Un indirizzo che e' gia' un pannello GdAHome non si installa di nuovo:
     * lo si dice, invece di farlo ricominciare da capo. */
    const gia = this.archivio.dati.pannelli.find(
      (uno) => uno.indirizzo === pulito && uno.stato !== "sonoff",
    );
    if (gia) {
      const e = new Error(
        `${pulito} e' gia' «${gia.nome || "un pannello"}», con GdAHome OS: lo trovi nell'elenco dei pannelli, coi suoi aggiornamenti.`,
      );
      e.perUtente = true;
      e.causa = "gia_gdahome";
      throw e;
    }
    const rotto = await this._serverDiAdb();
    if (rotto) {
      const e = new Error(rotto);
      e.perUtente = true;
      e.causa = "adb_rotto";
      throw e;
    }
    let collegamento;
    try {
      collegamento = await this.adb.provaCollegamento(pulito);
      /* Un rifiuto puo' essere di un attimo — il pannello che riapre le sue
       * app, adb che si riavvia — e una volta sola non basta per dire
       * «spento»: si riprova per qualche secondo. */
      for (
        let k = 0;
        k < this.riprovaDelRifiuto.volte && collegamento.causa === "rifiutato";
        k += 1
      ) {
        await new Promise((fatto) => setTimeout(fatto, this.riprovaDelRifiuto.pausa));
        collegamento = await this.adb.provaCollegamento(pulito);
      }
    } catch (errore) {
      const e = new Error(messaggioDelDemone(errore));
      e.perUtente = true;
      e.causa = "adb_rotto";
      throw e;
    }
    if (collegamento.causa === "non_autorizzato") {
      const e = new Error(
        "Il pannello ha risposto e chiede il permesso: sul suo schermo c'e' «Consentire il debug USB?». Tocca «Consenti» (spunta «Consenti sempre da questo computer»), poi premi di nuovo «Controlla il pannello».",
      );
      e.perUtente = true;
      e.causa = "non_autorizzato";
      throw e;
    }
    if (!collegamento.ok) {
      const e = new Error(
        collegamento.causa === "rifiutato"
          ? `A ${pulito} risponde qualcosa che non accetta l'ADB (porta 5555 chiusa). Prima guarda l'indirizzo: il router puo' aver dato al pannello un indirizzo nuovo, e qui adesso c'e' un altro apparecchio. Lo trovi in eWeLink, nella pagina del pannello, o con «Cerca in rete». Se l'indirizzo e' giusto, e' l'ADB di rete del pannello a essere spento: vedi qui sotto.`
          : this._fuoriDallaRete(pulito) ||
              "Il pannello non risponde a questo indirizzo. Controlla che sia quello giusto, che il pannello sia acceso e sulla stessa rete.",
      );
      e.perUtente = true;
      e.causa = collegamento.causa;
      throw e;
    }
    /* Che pannello e': un NSPanel va per la strada completa (root, sistema,
     * copia di sicurezza); uno Shelly o un altro display Android per quella
     * leggera, che non tocca il sistema. */
    const chi =
      typeof this.installatore.riconosci === "function"
        ? await this.installatore.riconosci(pulito).catch(() => null)
        : null;
    if (chi?.percorso === "leggero") return this._verificaLeggera(pulito, chi);
    const android =
      (await this.adb.getprop(pulito, "ro.build.version.release").catch(() => "")) || "";
    const schermo = await this._schermo(pulito).catch(() => "");
    const modello = modelloDalloSchermo(schermo);
    const root = await this.adb.root(pulito);
    const verifiche = [];
    let adatto = true;

    if (root === "0") verifiche.push({ esito: "bene", detto: "ADB acceso, accesso root" });
    else {
      verifiche.push({
        esito: "male",
        detto: "Manca l'accesso root: GdAHome OS non si puo' installare",
      });
      adatto = false;
    }

    const sistema = await this._sistemaModificabile(pulito);
    if (sistema.ok) verifiche.push({ esito: "bene", detto: "Partizione di sistema modificabile" });
    else {
      verifiche.push({
        esito: "male",
        detto: sistema.detto || "La partizione di sistema non e' modificabile",
      });
      adatto = false;
    }

    const spazio = await this._spazio(pulito);
    if (spazio.ok) verifiche.push({ esito: "bene", detto: spazio.detto });
    else verifiche.push({ esito: spazio.grave ? "male" : "giallo", detto: spazio.detto });
    if (spazio.grave) adatto = false;
    verifiche.push(this._spazioPerLaCopia());

    const webview = await this._webview(pulito);
    verifiche.push(webview);

    await this.adb.stacca(pulito);
    return {
      indirizzo: pulito,
      modello,
      schermo,
      android,
      adatto,
      nome: "",
      verifiche,
      famiglia: "nspanel",
      percorso: "completo",
      nomeDelModello: modello ? `NSPanel Pro ${modello}` : "NSPanel Pro",
    };
  }

  /* La verifica di un pannello leggero (Shelly, display Android): ADB basta,
   * root non serve; Android 8 o piu' nuovo (l'app GdAHome Muro), un po' di
   * posto per le due app, una WebView recente. Niente copia di sicurezza. */
  async _verificaLeggera(pulito, chi) {
    const verifiche = [{ esito: "bene", detto: "ADB acceso: per questo pannello non serve root" }];
    let adatto = true;
    if (Number.parseInt(chi.android, 10) >= 8)
      verifiche.push({ esito: "bene", detto: `Android ${chi.android}` });
    else {
      verifiche.push({
        esito: "male",
        detto: `Android ${chi.android || "?"}: GdAHome Muro chiede Android 8 o piu' nuovo`,
      });
      adatto = false;
    }
    const spazio = await this._spazio(pulito, { root: false });
    verifiche.push({
      esito: spazio.ok ? "bene" : spazio.grave ? "male" : "giallo",
      detto: spazio.detto,
    });
    if (spazio.grave) adatto = false;
    verifiche.push(await this._webview(pulito));
    verifiche.push({
      esito: "bene",
      detto:
        "Senza root: il software del produttore si copia su Home Assistant e si spegne, e gira solo GdAHome. Per tornare indietro si riaccende",
    });
    verifiche.push(this._spazioPerLaCopia());
    if (chi.famiglia === "shelly")
      verifiche.push({
        esito: "giallo",
        detto:
          "Sullo Shelly l'app Shelly resta accesa: e' lei che comanda i rele' e legge i sensori, e senza root non la sostituisce nessuno",
      });
    await this.adb.stacca(pulito);
    return {
      indirizzo: pulito,
      modello: "",
      schermo: chi.schermo || "",
      android: chi.android || "",
      adatto,
      nome: "",
      verifiche,
      famiglia: chi.famiglia,
      percorso: "leggero",
      nomeDelModello: chi.nome || "Pannello Android",
    };
  }

  async _sistemaModificabile(indirizzo) {
    try {
      const detto = await this.adb.shell(indirizzo, "mount | grep -E ' /system | / ' | head -n1", {
        root: true,
      });
      if (/\/dev\/block\/dm-/.test(detto))
        return { ok: false, detto: "dm-verity attivo: /system non si puo' modificare" };
      return { ok: true };
    } catch (_e) {
      return { ok: false, detto: "Non riesco a leggere le partizioni" };
    }
  }

  async _spazio(indirizzo, { root = true } = {}) {
    try {
      const detto = await this.adb.shell(indirizzo, "df /data | tail -n1", { root });
      const col = detto.trim().split(/\s+/);
      /* df: … Avail … ; o in blocchi, o con la G/M. Si prende il penultimo o
       * terz'ultimo numero come «disponibile». */
      /* df: Filesystem  blocchi  usato  disponibile  uso%  montato.
       * Tolti il filesystem, l'uso% e il punto di montaggio restano tre
       * numeri — blocchi, usato, disponibile — e il disponibile e' l'ultimo. */
      const liberi = col.map((c) => leggiByte(c)).filter((n) => n != null);
      const gb = liberi.length ? liberi[liberi.length - 1] : null;
      if (gb == null) return { ok: true, detto: "Spazio: non misurato" };
      /* Sul pannello vanno solo i pezzi (una ventina di MB) e le app Sonoff
       * messe da parte: la copia di sicurezza va su Home Assistant. Prima qui
       * si chiedevano 2 GB, che sul pannello non servono. */
      const servono = 200 * 1024 * 1024;
      if (gb < servono)
        return {
          ok: false,
          grave: true,
          detto: `Poco spazio sul pannello: servono 200 MB, liberi ${mostraByte(gb)}`,
        };
      return { ok: true, detto: `Spazio sul pannello: liberi ${mostraByte(gb)}` };
    } catch (_e) {
      return { ok: true, detto: "Spazio sul pannello: non misurato" };
    }
  }

  /* Il posto per la copia di sicurezza, su Home Assistant (/share). Quanto
   * serve davvero si sa solo leggendo le partizioni, all'installazione: qui
   * si avvisa se e' chiaramente poco. */
  _spazioPerLaCopia() {
    const liberi = this.installatore.spazioLibero?.(this.installatore.copie);
    if (liberi == null)
      return { esito: "giallo", detto: "Spazio per la copia su Home Assistant: non misurato" };
    /* Si salvano solo system e oem (`DA_SALVARE`), compresse: finita la copia
     * restano poche centinaia di MB. Mentre si copia, per stare larghi, si
     * chiede il posto delle partizioni intere: su un NSPanel fino a ~2 GB.
     * Prima qui c'era «ne servono 2-4 GB», di quando si copiava tutto. */
    if (liberi < 2 * 1024 ** 3)
      return {
        esito: "giallo",
        detto: `Spazio per la copia su Home Assistant: liberi ${mostraByte(liberi)}; durante la copia ne servono fino a ~2 GB (poi, compressa, poche centinaia di MB)`,
      };
    return {
      esito: "bene",
      detto: `Spazio per la copia su Home Assistant: liberi ${mostraByte(liberi)} (la copia, compressa, ne occupa poche centinaia di MB)`,
    };
  }

  async _webview(indirizzo) {
    try {
      const detto = await this.adb.shell(indirizzo, "dumpsys webviewupdate", { root: false });
      const m = /current webview package.*?(\d+)\.[\d.]+/is.exec(detto);
      const grande = m ? Number(m[1]) : 0;
      if (!grande) return { esito: "giallo", detto: "Versione della WebView non letta" };
      if (grande < 108)
        return {
          esito: "giallo",
          detto: `WebView ${grande}: si aggiorna durante l'installazione`,
          webviewVecchia: true,
        };
      return { esito: "bene", detto: `WebView ${grande}` };
    } catch (_e) {
      return { esito: "giallo", detto: "Versione della WebView non letta" };
    }
  }

  /* ─── I lavori ─── */

  _lavoro(id, titolo, nomiDeiPassi) {
    const lavoro = {
      titolo,
      passi: nomiDeiPassi.map((p) => ({
        nome: typeof p === "string" ? p : p.nome,
        dettaglio: typeof p === "string" ? "" : p.dettaglio || "",
        stato: "dopo",
      })),
      finito: false,
      errore: "",
      iniziatoIl: this.adesso(),
    };
    this.lavori.set(id, lavoro);
    return {
      /* Segna il passo `i` «in corso», con un eventuale dettaglio e percento. */
      passo: (i, dettaglio, percento) => {
        for (let k = 0; k < i; k += 1) lavoro.passi[k].stato = "fatto";
        if (lavoro.passi[i]) {
          lavoro.passi[i].stato = "adesso";
          if (dettaglio != null) lavoro.passi[i].dettaglio = dettaglio;
          if (percento != null) lavoro.passi[i].percento = percento;
        }
      },
      finito: () => {
        lavoro.passi.forEach((p) => {
          if (p.stato !== "male") p.stato = "fatto";
        });
        lavoro.finito = true;
      },
      male: (i, messaggio) => {
        if (lavoro.passi[i]) lavoro.passi[i].stato = "male";
        lavoro.errore = messaggio;
        lavoro.finito = true;
      },
      oggetto: lavoro,
    };
  }

  /* Installa GdAHome OS su un pannello nuovo. Torna subito con l'id del
   * pannello creato; il lavoro va avanti per conto suo e la console lo segue. */
  async installa({ indirizzo, nome = "", plancia = "", utente = "" }) {
    if (!this._premium()) {
      const e = new Error("La plancia a muro fa parte di GdAHome Premium.");
      e.perUtente = true;
      throw e;
    }
    const pulito = indirizzoPulito(indirizzo);
    if (!pulito) {
      const e = new Error("L'indirizzo non va bene.");
      e.perUtente = true;
      throw e;
    }
    /* Un pannello gia' in elenco a questo indirizzo si riusa; se no, nuovo. */
    let pannello = this.archivio.dati.pannelli.find((u) => u.indirizzo === pulito);
    if (!pannello) {
      pannello = { id: idNuovo(), indirizzo: pulito, nome, stato: "sonoff", natoIl: this.adesso() };
      this.archivio.dati.pannelli.push(pannello);
    }
    if (nome) pannello.nome = nome;
    if (plancia) pannello.plancia = this._nomeDellaPlancia(plancia);
    if (utente) pannello.utente = utente;
    pannello.planciaId = plancia || pannello.planciaId;
    /* La strada: completa (NSPanel) o leggera (Shelly, display Android). Si
     * guarda il pannello, non quello che dice la console. */
    const chi =
      typeof this.installatore.riconosci === "function" &&
      (await this.adb.connetti?.(pulito).catch(() => false))
        ? await this.installatore.riconosci(pulito).catch(() => null)
        : null;
    if (chi) {
      pannello.percorso = chi.percorso;
      pannello.famiglia = chi.famiglia;
      pannello.nomeDelModello = chi.nome;
    }
    this._salva();

    const leggero = pannello.percorso === "leggero";
    const passi = leggero
      ? this._lavoro(pannello.id, "Installazione in corso…", [
          { nome: "Verifica", dettaglio: "" },
          { nome: "Copia del software", dettaglio: "le app del produttore, su Home Assistant" },
          { nome: "Installazione", dettaglio: "GdAHome, e il software del produttore spento" },
          { nome: "Abbinamento", dettaglio: "con la casa" },
          { nome: "Avvio", dettaglio: "il pannello apre GdAHome" },
        ])
      : this._lavoro(pannello.id, "Copia di sicurezza in corso…", [
          { nome: "Verifica", dettaglio: "" },
          { nome: "Copia di sicurezza", dettaglio: "" },
          { nome: "Installazione", dettaglio: "GdAHome OS, app GdAHome Muro, animazione d'avvio" },
          { nome: "Abbinamento", dettaglio: "con la casa" },
          { nome: "Riavvio", dettaglio: "il pannello si accende con GdAHome" },
        ]);

    /* Il lavoro gira da solo: non si aspetta che finisca per rispondere alla
     * console. Gli errori finiscono nel lavoro, che la console mostra. */
    this._esegui(pannello, passi).catch((errore) => {
      passi.oggetto.errore = messaggioDi(errore);
      passi.oggetto.finito = true;
    });
    return { id: pannello.id };
  }

  async _esegui(pannello, passi) {
    const leggero = pannello.percorso === "leggero";
    const esito = await this.installatore[leggero ? "installaLeggero" : "installa"]({
      indirizzo: pannello.indirizzo,
      planciaId: pannello.planciaId,
      utente: pannello.utente,
      nome: pannello.nome,
      avanti: ({ passo, dettaglio, percento }) => passi.passo(passo, dettaglio, percento),
    });
    if (esito.errore) {
      passi.male(esito.passoRotto ?? 0, esito.errore);
      /* Anche a meta' strada: cosa e' stato spento e dove sta la copia, per
       * poter tornare indietro. */
      if (esito.casaDiPrima) pannello.casaDiPrima = esito.casaDiPrima;
      if (esito.spente) pannello.spente = esito.spente;
      if (esito.copia) pannello.copia = esito.copia;
      pannello.stato = "errore";
      pannello.errore = esito.errore;
      this._salva();
      return;
    }
    pannello.stato = "pronto";
    pannello.acceso = true;
    pannello.os = esito.os || pannello.os;
    pannello.app = esito.app || pannello.app;
    pannello.modello = esito.modello || pannello.modello;
    if (esito.versioni) pannello.versioni = esito.versioni;
    pannello.schermo = esito.schermo || pannello.schermo;
    pannello.dispositivo = esito.dispositivo || pannello.dispositivo;
    pannello.ritocco = esito.ritocco ?? pannello.ritocco;
    if (esito.casaDiPrima) pannello.casaDiPrima = esito.casaDiPrima;
    if (esito.spente) pannello.spente = esito.spente;
    if (esito.copia) pannello.copia = esito.copia;
    if (esito.nomeDelModello) pannello.nomeDelModello = esito.nomeDelModello;
    if (esito.abbinatoIl) pannello.abbinatoIl = esito.abbinatoIl;
    pannello.errore = "";
    pannello.vistoIl = this.adesso();
    /* Installato, ma non entrato nella casa: si dice, e il giro degli
     * aggiornamenti riprova l'abbinamento da solo. */
    pannello.avviso = esito.avviso || "";
    if (esito.avviso) pannello.aggiornabile = true;
    this._salva();
    if (esito.avviso) {
      /* GdAHome OS e' a posto: i passi sono fatti, tranne l'abbinamento,
       * che dice cosa succede adesso. */
      const rotto = esito.passoRotto ?? 3;
      passi.oggetto.passi.forEach((p) => (p.stato = "fatto"));
      if (passi.oggetto.passi[rotto])
        passi.oggetto.passi[rotto].dettaglio = "non e' entrato nella casa: riprovo da solo";
      return void passi.male(rotto, esito.avviso);
    }
    passi.finito();
    /* Il lavoro finito resta un attimo a schermo, poi sparisce dal prossimo
     * elenco: la riga torna quella normale, accesa. */
    setTimeout(() => {
      const l = this.lavori.get(pannello.id);
      if (l && l.finito && !l.errore) this.lavori.delete(pannello.id);
    }, 8000).unref?.();
  }

  _nomeDellaPlancia(id) {
    /* L'elenco delle plance le chiama per `profilo` e le mostra col `titolo`. */
    const una = this.plance?.elenco?.()?.find?.((p) => p.profilo === id);
    return una ? una.titolo || una.profilo : id;
  }

  /* ─── Le azioni su un pannello gia' GdAHome ─── */

  async azione(id, cosa) {
    const pannello = this._trova(id);
    if (!pannello) {
      const e = new Error("Pannello non trovato.");
      e.perUtente = true;
      throw e;
    }
    if (cosa === "aggiorna") return this._aggiorna(pannello);
    if (cosa === "riavvia") return this._riavvia(pannello);
    if (cosa === "analisi") return this._analisi(pannello);
    if (cosa === "sonoff") return this._sonoff(pannello);
    const e = new Error("Azione sconosciuta.");
    e.perUtente = true;
    throw e;
  }

  /* Da che strada parla con la casa: dentro casa, o dal centralino (da
   * internet, che allunga ogni comando). Detto in chiaro per l'analisi. */
  _comeECollegato(pannello) {
    if (!pannello.dispositivo) return "nessun dispositivo abbinato";
    if (typeof this.collegamenti !== "function") return "(non si sa)";
    const fili = this.collegamenti(pannello.dispositivo) || [];
    if (!fili.length) return "non collegato adesso";
    return fili
      .map(
        (f) =>
          `${f.daCasa ? "dentro casa" : "da fuori (centralino)"} · da ${f.da} · ultimo segno ${f.vistoSecondiFa} s fa`,
      )
      .join("\n");
  }

  /* Il pannello e' entrato nella casa? Il suo dispositivo si e' fatto vedere
   * dopo l'abbinamento. `null` se non si puo' sapere: senza casa da guardare,
   * o un dispositivo che non c'e' piu' — tolto a mano dalla console, e allora
   * non lo si rimette dentro di nascosto. */
  _abbinato(pannello) {
    if (!pannello.dispositivo || typeof this.dispositivi?.elenco !== "function") return null;
    const uno = this.dispositivi.elenco().find((d) => d.id === pannello.dispositivo);
    if (!uno) return null;
    const dal = Number(pannello.abbinatoIl) || Number(uno.natoIl) || 0;
    return Number(uno.vistoIl) > dal;
  }

  /* C'e' da fare qualcosa sul pannello? Pezzi piu' nuovi, il ritocco di
   * Sonoff da rifare, o un abbinamento mai arrivato. */
  _daSistemare(pannello, sul, pezzi) {
    return (
      this.installatore.daAggiornare(sul, pezzi).length > 0 ||
      (pannello.percorso !== "leggero" && (Number(pannello.ritocco) || 0) < RITOCCO) ||
      this._abbinato(pannello) === false
    );
  }

  async _aggiorna(pannello) {
    const riabbina = this._abbinato(pannello) === false;
    const leggero = pannello.percorso === "leggero";
    const passi = this._lavoro(pannello.id, "Aggiornamento…", [
      "App GdAHome Muro",
      "GdAHome OS",
      leggero
        ? { nome: "Impostazioni", dettaglio: "schermata home e schermo acceso" }
        : { nome: "Pulizia", dettaglio: "quello che resta di Sonoff" },
      ...(riabbina ? [{ nome: "Abbinamento", dettaglio: "con la casa" }] : []),
    ]);
    const finito = this.installatore
      .aggiorna({
        indirizzo: pannello.indirizzo,
        percorso: pannello.percorso || "completo",
        avanti: ({ passo, dettaglio, percento }) => passi.passo(passo, dettaglio, percento),
        abbina: riabbina
          ? {
              dispositivo: pannello.dispositivo,
              nome: pannello.nome,
              utente: pannello.utente,
              planciaId: pannello.planciaId,
            }
          : null,
      })
      .then((esito) => {
        if (esito.errore) return passi.male(0, esito.errore);
        pannello.app = esito.app || pannello.app;
        pannello.os = esito.os || pannello.os;
        if (esito.versioni) pannello.versioni = esito.versioni;
        if (esito.ritocco) pannello.ritocco = esito.ritocco;
        if (esito.dispositivo) pannello.dispositivo = esito.dispositivo;
        if (esito.abbinatoIl) pannello.abbinatoIl = esito.abbinatoIl;
        pannello.avviso = esito.avviso || "";
        pannello.aggiornabile = Boolean(esito.avviso) || !esito.ritocco;
        pannello.aggiornatoIl = this.adesso();
        this._salva();
        if (esito.avviso) return void passi.male(3, esito.avviso);
        passi.finito();
        setTimeout(() => this.lavori.delete(pannello.id), 5000).unref?.();
      })
      .catch((e) => passi.male(0, messaggioDi(e)));
    return { avviato: true, finito };
  }

  /* ─── Gli aggiornamenti che arrivano da soli ───
   *
   * Un add-on nuovo porta con se' GdAHome OS e l'app GdAHome Muro piu' nuovi
   * (`/app/muro`, con `versioni.json`). Questo giro chiede a ogni pannello
   * gia' GdAHome che versioni ha, e quelli indietro li aggiorna installando
   * sopra: stessa firma, quindi restano dati, abbinamento e impostazioni.
   * Un pannello spento o fuori casa non e' un errore: si riprova al giro dopo,
   * e intanto la console lo mostra con «aggiornamento pronto». */
  async controllaGliAggiornamenti({ installaDaSolo = true } = {}) {
    const pezzi = this.installatore.versioniDeiPezzi?.();
    if (!pezzi) return { controllati: 0, aggiornati: 0 };
    let controllati = 0;
    let aggiornati = 0;
    for (const pannello of this.archivio.dati.pannelli) {
      if (pannello.stato !== "pronto" || this.lavori.has(pannello.id)) continue;
      const prova = await this.adb.provaCollegamento(pannello.indirizzo).catch(() => null);
      pannello.acceso = Boolean(prova?.ok);
      if (!prova?.ok) continue;
      controllati += 1;
      pannello.vistoIl = this.adesso();
      const sul = await this.installatore.versioniSulPannello(pannello.indirizzo);
      pannello.versioni = sul;
      if (sul.os?.nome) pannello.os = sul.os.nome;
      if (sul.muro?.nome) pannello.app = sul.muro.nome;
      pannello.aggiornabile = this._daSistemare(pannello, sul, pezzi);
      if (pannello.aggiornabile && installaDaSolo) {
        const { finito } = await this._aggiorna(pannello);
        await finito;
        aggiornati += 1;
      }
    }
    this._salva();
    return { controllati, aggiornati };
  }

  /* Il giro: poco dopo l'avvio — un add-on appena aggiornato porta pezzi
   * nuovi — e poi ogni tante ore. Non tiene sveglio il processo. */
  avviaIlGiro({ primaDopo = 2 * 60_000, ogni = 6 * 60 * 60_000 } = {}) {
    const giro = () =>
      this.controllaGliAggiornamenti().catch(() => {
        /* Un giro andato male non ferma i successivi. */
      });
    setTimeout(giro, primaDopo).unref?.();
    setInterval(giro, ogni).unref?.();
  }

  async _riavvia(pannello) {
    await this.installatore.riavvia({ indirizzo: pannello.indirizzo });
    return { fatto: true };
  }

  async _analisi(pannello) {
    let rapporto = await this.installatore.analisi({ indirizzo: pannello.indirizzo });
    rapporto += `\n\n== Collegamento con la casa ==\n${this._comeECollegato(pannello)}`;
    pannello.analisi = { quando: this.adesso() };
    this._salva();
    return { rapporto };
  }

  async _sonoff(pannello) {
    if (pannello.percorso === "leggero") return this._togliGdAHome(pannello);
    const passi = this._lavoro(pannello.id, "Rimetto il software Sonoff…", [
      "Ripristino",
      "Riavvio",
    ]);
    this.installatore
      .sonoff({ indirizzo: pannello.indirizzo, avanti: ({ passo }) => passi.passo(passo) })
      .then((esito) => {
        if (esito.errore) return passi.male(0, esito.errore);
        /* Rimesso Sonoff, il pannello esce dalla casa come un telefono tolto. */
        if (pannello.dispositivo) this.dispositivi?.stacca?.(pannello.dispositivo);
        this._rimuovi(pannello.id);
        passi.finito();
      })
      .catch((e) => passi.male(0, messaggioDi(e)));
    return { avviato: true };
  }

  /* Un pannello leggero torna com'era: la home di prima e le due app tolte.
   * Poi esce dalla casa come un telefono tolto. */
  async _togliGdAHome(pannello) {
    const passi = this._lavoro(pannello.id, "Rimetto il software del produttore…", [
      "Software del produttore",
      "App di GdAHome",
    ]);
    this.installatore
      .togliGdAHome({
        indirizzo: pannello.indirizzo,
        casaDiPrima: pannello.casaDiPrima || "",
        spente: pannello.spente || [],
        copia: pannello.copia || "",
        avanti: ({ passo, dettaglio }) => passi.passo(passo, dettaglio),
      })
      .then((esito) => {
        if (esito.errore) return passi.male(0, esito.errore);
        if (pannello.dispositivo) this.dispositivi?.stacca?.(pannello.dispositivo);
        this._rimuovi(pannello.id);
        passi.finito();
      })
      .catch((e) => passi.male(0, messaggioDi(e)));
    return { avviato: true };
  }

  /* ─── Rinomina e togli ─── */

  rinomina(id, nome) {
    const pannello = this._trova(id);
    if (!pannello) {
      const e = new Error("Pannello non trovato.");
      e.perUtente = true;
      throw e;
    }
    pannello.nome = String(nome || "").slice(0, 40);
    this._salva();
    return { nome: pannello.nome };
  }

  /* Togliere un pannello dall'elenco. Uno che ha GdAHome sopra non si toglie
   * e basta: resterebbe un pannello col nostro software e nessuno che lo
   * aggiorna o lo riporta indietro. Prima si rimette il software originale
   * («sonoff», che a lavoro finito lo toglie da solo). `forza` e' per un
   * pannello perso — rotto, buttato, mai piu' in rete — e lo dice la console. */
  togli(id, { forza = false } = {}) {
    const pannello = this._trova(id);
    if (pannello && pannello.stato !== "sonoff" && !forza) {
      const e = new Error(
        "Prima va rimesso il software originale del pannello: usa «Rimetti e togli», che lo fa e poi lo toglie.",
      );
      e.perUtente = true;
      e.causa = "prima_il_software";
      throw e;
    }
    if (pannello?.dispositivo) this.dispositivi?.stacca?.(pannello.dispositivo);
    this._rimuovi(id);
    return { tolto: true };
  }

  _rimuovi(id) {
    this.archivio.dati.pannelli = this.archivio.dati.pannelli.filter((u) => u.id !== id);
    this.lavori.delete(id);
    this._salva();
  }
}

/* ─── Aiutanti ─── */

export function indirizzoPulito(testo) {
  const t = String(testo || "").trim();
  if (!/^[0-9a-zA-Z.:-]{3,64}$/.test(t)) return "";
  /* Niente di piu' di cifre, punti, due punti, lettere e trattini: non ci
   * finisce dentro un comando. */
  return t;
}

/* La frase per quando il programma adb dell'add-on non parte: con la riga che
 * dice perche', se adb l'ha scritta (per esempio «Cannot mkdir …»). */
function messaggioDelDemone(errore) {
  const righe = `${errore?.uscita || ""}\n${errore?.message || ""}`
    .split("\n")
    .map((r) => r.trim());
  /* La riga piu' utile per prima: «Cannot mkdir …» dice il perche', «didn't
   * ACK» dice solo che non e' partito. */
  const riga = [/cannot mkdir|permission denied/i, /failed to start|didn't ack/i]
    .map((cerca) => righe.find((r) => cerca.test(r)))
    .find(Boolean);
  const dettaglio = riga ? ` (${riga.replace(/^.*?adb\s*:\s*\S+\s*/i, "").slice(0, 160)})` : "";
  return `Il programma adb dentro l'add-on non parte${dettaglio}. Riavvia l'add-on; se si ripete, mandaci il registro dell'add-on.`;
}

function messaggioDi(errore) {
  return errore?.perUtente ? errore.message : "Qualcosa non ha funzionato. Riprova.";
}

/* Legge "1.9G", "500M", "1024" in byte. `null` se non e' un numero. */
export function leggiByte(testo) {
  const m = /^([\d.]+)\s*([kmgt])?i?b?$/i.exec(String(testo).trim());
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const scala = { k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 }[(m[2] || "").toLowerCase()];
  /* Senza unita', df lo da' in blocchi da 1 KB. */
  return Math.round(n * (scala || 1024));
}

function mostraByte(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
  if (n >= 1024 ** 2) return `${Math.round(n / 1024 ** 2)} MB`;
  return `${Math.round(n / 1024)} KB`;
}
