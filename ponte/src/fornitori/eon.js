/* E.ON Energia Italia, dal ponte.
 *
 * E' il porto in JavaScript di `pyeonenergia`, la libreria dell'integrazione
 * «E.ON Energia Italia» di Federico Zivolo
 * (https://github.com/FezVrasta/eon-energia-italia-hass, commit 52f76e66 del
 * 2026-09-25), licenza MIT: il testo e' in `LICENZE.md`, accanto. Le stesse
 * chiamate, gli stessi passi dell'accesso, le stesse letture: chi aggiorna
 * guarda la loro libreria e porta qui quello che e' cambiato.
 *
 * Due cose sono diverse apposta, e tutte e due per la sicurezza:
 *
 *   - **la password non si tiene.** La loro integrazione la salvava per
 *     rientrare da sola quando i gettoni scadevano; qui serve una volta, per
 *     entrare, e poi se ne va. Quando E.ON non rinnova piu' i gettoni il
 *     collegamento dice «da ricollegare».
 *   - **nel registro non va niente di E.ON**: ne' gli indirizzi dei passi
 *     dell'accesso, ne' le risposte. Solo il tipo dell'errore.
 *
 * E.ON non ha un'API pubblica: questa e' quella che usano la sua app e la sua
 * area clienti, coi dati di chi entra.
 */

import { createDecipheriv, scryptSync } from "node:crypto";

export const DOMINIO_DELL_ACCESSO = "https://auth.eon-energia.com";
/* Il client dell'app nativa: accetta il ritorno su uno schema suo, ed e' quello
 * che rende possibile l'accesso dal browser. L'accesso con la sola password
 * su di lui e' spento (`unauthorized_client`): il giro del browser e' l'unica
 * porta, anche quando lo fa il ponte da solo. */
export const CLIENT_ID = "vEZ41cyr2pOHux9EKoN8dDgGb7UZc7EB";
export const RITORNO =
  "com.eon-energia.eon.auth0://auth.eon-energia.com/ios/com.eon-energia.eon/callback";
const AMBITO = "openid profile email offline_access";
const GETTONI = `${DOMINIO_DELL_ACCESSO}/oauth/token`;

const AREA_CLIENTI = "https://myeon.eon-energia.com";
const CONFIGURAZIONE_JS = `${AREA_CLIENTI}/content/eon-scsi/it/login.scsiconfig.js`;

const FATTURE = "/scsi/invoices/v1.0/getInvoiceDvc";
const FORNITURE = "/scsi/point-of-deliveries/v1.0";
const CONSUMI = "/DeeperConsumption/v1.0/ExtDailyConsumption";

/* Si rinnova cinque minuti prima che scada: i gettoni vivono due ore. */
const MARGINE = 300_000;
const ATTESA = 20_000;

const UN_TELEFONO =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/139.0.0.0 Mobile Safari/537.36";
const UN_COMPUTER =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36";

/* ─── gli errori ─────────────────────────────────────────────────────────── */

export class ErroreEon extends Error {}
/* L'accesso non va, e senza chi usa la casa non si sistema. */
export class AccessoNegato extends ErroreEon {}
/* Il controllo «non sei un robot»: senza un browser non lo si passa. */
export class ServeIlBrowser extends AccessoNegato {}
/* Serve il codice SMS. Porta con se' l'accesso a meta'. */
export class ServeIlCodice extends AccessoNegato {
  constructor(sessione) {
    super("serve il codice");
    this.sessione = sessione;
  }
}

/* ─── la configurazione dell'area clienti ────────────────────────────────── */

/* L'indirizzo dell'API e la chiave dell'abbonamento li mette E.ON nella sua
 * pagina, e da li' si leggono. Quando la pagina sta dietro il controllo di
 * Cloudflare si usa la coppia sigillata dell'integrazione originale: la
 * passphrase sta accanto al blob, quindi non e' un segreto — serve solo a non
 * farla trovare a chi cerca nel codice. */
const SIGILLATA =
  "DANZnie8zvh0hfs1bUNYuxwnnMj6bOt/Ia3+NCAxwSxnsypaxeYaKAU0TLINpJIPnlsN+UmI" +
  "bRf22nIES6nytX2ay3M9eVyjpLq18KaZnoZp2WXJLBghrYaueIQFfAtFO+v/p0gnaFqqI1k4" +
  "bPQivXfbmGzin95Q63aewW3XvYK7t9hN/6GV9MJG";
const PASSPHRASE = "eon_energia:api-config-fallback:v1";

let aperta = null;
export function laCoppiaDiRiserva() {
  if (aperta) return aperta;
  const grezzo = Buffer.from(SIGILLATA, "base64");
  const sale = grezzo.subarray(0, 16);
  const nonce = grezzo.subarray(16, 28);
  const cifrato = grezzo.subarray(28);
  const chiave = scryptSync(PASSPHRASE, sale, 32, { N: 2 ** 14, r: 8, p: 1 });
  const apri = createDecipheriv("aes-256-gcm", chiave, nonce);
  apri.setAuthTag(cifrato.subarray(cifrato.length - 16));
  const chiaro = Buffer.concat([
    apri.update(cifrato.subarray(0, cifrato.length - 16)),
    apri.final(),
  ]);
  aperta = Object.freeze(JSON.parse(chiaro.toString("utf8")));
  return aperta;
}

/* Dal file di configurazione dell'area clienti: `"apicrm.url":"https://…"` e
 * `"subscription.key":"<32 esadecimali>"`. Solo quel file: cercare una chiave
 * qualsiasi nei pacchetti trova quella sbagliata, e l'API risponde 500. */
export function leggiLaConfigurazione(js) {
  let indirizzo = "";
  for (const forma of [/"apicrm\.url"\s*:\s*"([^"]+)"/, /"api\.url"\s*:\s*"([^"]+)"/]) {
    const trovato = String(js).match(forma);
    if (!trovato) continue;
    indirizzo = trovato[1]
      .replace(/\\\//g, "/")
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    if (indirizzo.endsWith("/scsi")) indirizzo = indirizzo.slice(0, -5);
    break;
  }
  let chiave = "";
  for (const forma of [
    /"subscription\.key"\s*:\s*"([a-f0-9]{32})"/,
    /"crm\.apim\.key"\s*:\s*"([a-f0-9]{32})"/,
  ]) {
    const trovato = String(js).match(forma);
    if (trovato) {
      chiave = trovato[1];
      break;
    }
  }
  return indirizzo && chiave ? { base_url: indirizzo, subscription_key: chiave } : null;
}

const UN_GIORNO = 86_400_000;
const UN_ORA = 3_600_000;

export class ConfigurazioneEon {
  constructor({ prendi = globalThis.fetch, adesso = () => Date.now() } = {}) {
    this.prendi = prendi;
    this.adesso = adesso;
    this._config = null;
    this._scade = 0;
  }

  async leggi() {
    if (this._config && this.adesso() < this._scade) return this._config;
    try {
      const risposta = await this.prendi(CONFIGURAZIONE_JS, {
        headers: { "user-agent": UN_COMPUTER, accept: "*/*", "accept-language": "it-IT,it;q=0.9" },
        signal: AbortSignal.timeout(ATTESA),
      });
      const letta = risposta.ok ? leggiLaConfigurazione(await risposta.text()) : null;
      if (!letta) throw new ErroreEon("configurazione illeggibile");
      this._config = letta;
      this._scade = this.adesso() + UN_GIORNO;
    } catch (_errore) {
      /* La pagina non risponde (Cloudflare, la rete): si usa la coppia nota, e
       * si riprova fra un'ora invece che fra un giorno. */
      this._config = laCoppiaDiRiserva();
      this._scade = this.adesso() + UN_ORA;
    }
    return this._config;
  }
}

/* ─── l'accesso ──────────────────────────────────────────────────────────── */

/* I biscotti di Auth0, per un dominio solo. `fetch` non li tiene: l'accesso
 * di E.ON e' una catena di pagine che si passano lo stato coi biscotti, e
 * senza la seconda pagina non riconosce la prima. */
export class Biscotti {
  constructor(iniziali = {}) {
    this.tutti = new Map(Object.entries(iniziali));
  }

  prendiDa(risposta) {
    const righe =
      typeof risposta.headers?.getSetCookie === "function"
        ? risposta.headers.getSetCookie()
        : [risposta.headers?.get?.("set-cookie")].filter(Boolean);
    for (const riga of righe) {
      const [coppia] = String(riga).split(";");
      const uguale = coppia.indexOf("=");
      if (uguale <= 0) continue;
      const nome = coppia.slice(0, uguale).trim();
      const valore = coppia.slice(uguale + 1).trim();
      if (!valore || /max-age=0|expires=thu, 01 jan 1970/i.test(riga)) this.tutti.delete(nome);
      else this.tutti.set(nome, valore);
    }
  }

  riga() {
    return [...this.tutti].map(([nome, valore]) => `${nome}=${valore}`).join("; ");
  }

  comeOggetto() {
    return Object.fromEntries(this.tutti);
  }
}

export function campiNascosti(html) {
  const campi = {};
  for (const [campo] of String(html).matchAll(/<input[^>]+type=["']hidden["'][^>]*>/gi)) {
    const nome = campo.match(/name=["']([^"']+)["']/);
    const valore = campo.match(/value=["']([^"']*)["']/);
    if (nome) campi[nome[1]] = valore ? valore[1] : "";
  }
  return campi;
}

function azioneDelModulo(html, invece) {
  const trovata = String(html).match(/<form[^>]+action=["']([^"']+)["']/);
  if (!trovata) return invece;
  return trovata[1].startsWith("/") ? DOMINIO_DELL_ACCESSO + trovata[1] : trovata[1];
}

function haIlControllo(html) {
  if (!html) return false;
  if ("captcha" in campiNascosti(html)) return true;
  return /turnstile|recaptcha|hcaptcha/i.test(html);
}

function assoluto(indirizzo) {
  return indirizzo.startsWith("/") ? DOMINIO_DELL_ACCESSO + indirizzo : indirizzo;
}

/* Il codice dell'accesso, da qualunque cosa si sia riusciti a copiare: il
 * ritorno ha uno schema che il browser non apre, quindi c'e' chi incolla
 * l'indirizzo, chi la riga intera della console («Failed to launch
 * 'com.eon-energia…?code=abc' because…»), chi il codice da solo. */
export function ilCodiceDa(testo) {
  const pulito = String(testo || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
  if (!pulito) return null;
  const trovato = pulito.match(/[?&#]code=([^&\s'"]+)/);
  if (trovato) {
    try {
      return decodeURIComponent(trovato[1]);
    } catch (_errore) {
      return trovato[1];
    }
  }
  return /^[A-Za-z0-9_\-.~]{20,}$/.test(pulito) ? pulito : null;
}

function ilCodiceNelRitorno(indirizzo) {
  if (!indirizzo) return null;
  if (!indirizzo.startsWith(RITORNO) && !indirizzo.includes("code=")) return null;
  return ilCodiceDa(indirizzo);
}

export class AccessoEon {
  constructor({ prendi = globalThis.fetch, configurazione } = {}) {
    this.prendi = prendi;
    this.configurazione = configurazione ?? new ConfigurazioneEon({ prendi });
  }

  async linkDelBrowser() {
    const { base_url } = await this.configurazione.leggi();
    const domanda = new URLSearchParams({
      os: "ios",
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: RITORNO,
      scope: AMBITO,
      audience: base_url,
    });
    return `${DOMINIO_DELL_ACCESSO}/authorize?${domanda}`;
  }

  async _chiedi(indirizzo, biscotti, { metodo = "GET", modulo = null } = {}) {
    const intestazioni = {
      "user-agent": UN_TELEFONO,
      origin: DOMINIO_DELL_ACCESSO,
      referer: `${DOMINIO_DELL_ACCESSO}/`,
    };
    const riga = biscotti.riga();
    if (riga) intestazioni.cookie = riga;
    if (modulo) intestazioni["content-type"] = "application/x-www-form-urlencoded";
    const risposta = await this.prendi(indirizzo, {
      method: metodo,
      headers: intestazioni,
      body: modulo ? new URLSearchParams(modulo).toString() : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(ATTESA),
    });
    biscotti.prendiDa(risposta);
    return risposta;
  }

  /* Come `allow_redirects=True`: si seguono i rimandi a mano, per tenere i
   * biscotti di ogni passo. */
  async _segui(indirizzo, biscotti, opzioni = {}) {
    let risposta = await this._chiedi(indirizzo, biscotti, opzioni);
    let dove = indirizzo;
    for (let giro = 0; giro < 10; giro += 1) {
      const prossimo = risposta.headers.get("location");
      if (!(risposta.status >= 300 && risposta.status < 400) || !prossimo) break;
      if (prossimo.startsWith(RITORNO)) return { risposta, dove: prossimo, testo: "" };
      dove = new URL(prossimo, dove).toString();
      risposta = await this._chiedi(dove, biscotti);
    }
    return { risposta, dove, testo: await risposta.text() };
  }

  async _scambia(codice) {
    const risposta = await this.prendi(GETTONI, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        code: codice,
        redirect_uri: RITORNO,
      }),
      signal: AbortSignal.timeout(ATTESA),
    });
    if (risposta.status !== 200) throw new AccessoNegato("scambio rifiutato");
    const gettoni = await risposta.json();
    if (!gettoni?.access_token) throw new AccessoNegato("nessun gettone");
    return gettoni;
  }

  async scambiaIlCodice(codice) {
    return this._scambia(codice);
  }

  /* Email e password, come le scrive chi entra nell'area clienti. Torna i
   * gettoni, o solleva `ServeIlCodice` (con l'accesso a meta'), `ServeIlBrowser`
   * o `AccessoNegato`. */
  async entra(email, password) {
    const { base_url } = await this.configurazione.leggi();
    const biscotti = new Biscotti();
    const autorizza = `${DOMINIO_DELL_ACCESSO}/authorize?${new URLSearchParams({
      os: "ios",
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: RITORNO,
      scope: AMBITO,
      audience: base_url,
    })}`;
    const inizio = await this._segui(autorizza, biscotti);
    const stato = new URL(inizio.dove).searchParams.get("state");
    if (!stato) throw new AccessoNegato("nessuno stato");

    const identita = await this._segui(
      `${DOMINIO_DELL_ACCESSO}/u/login/identifier?state=${encodeURIComponent(stato)}`,
      biscotti,
      {
        metodo: "POST",
        modulo: {
          ...campiNascosti(inizio.testo),
          state: stato,
          username: email,
          action: "default",
        },
      },
    );
    if (!identita.dove.includes("/u/login/password")) {
      if ("captcha" in campiNascosti(identita.testo)) throw new ServeIlBrowser("controllo");
      throw new AccessoNegato("utente");
    }
    const nascosti = campiNascosti(identita.testo);
    /* Con il controllo nella pagina la password non partirebbe verso un modulo
     * che non puo' riuscire: e l'errore sembrerebbe una password sbagliata. */
    if ("captcha" in nascosti) throw new ServeIlBrowser("controllo");

    const dopo = await this._chiedi(
      `${DOMINIO_DELL_ACCESSO}/u/login/password?state=${encodeURIComponent(stato)}`,
      biscotti,
      {
        metodo: "POST",
        modulo: { ...nascosti, state: stato, username: email, password, action: "default" },
      },
    );
    const rimando = dopo.headers.get("location");
    if (!rimando) {
      if (haIlControllo(await dopo.text())) throw new ServeIlBrowser("controllo");
      throw new AccessoNegato("password");
    }
    if (rimando.includes("/u/login")) throw new AccessoNegato("password");
    const codice = await this._finoAlCodice(rimando, biscotti, stato);
    return this._scambia(codice);
  }

  /* Dalla password al codice: i rimandi, la pagina che chiede cosa sa fare il
   * browser, il consenso all'app, e — se E.ON lo chiede — il codice SMS. */
  async _finoAlCodice(primo, biscotti, stato) {
    let dove = primo;
    for (let giro = 0; giro < 10 && dove; giro += 1) {
      const codice = ilCodiceNelRitorno(dove);
      if (codice) return codice;
      const pagina = assoluto(dove);
      const risposta = await this._chiedi(pagina, biscotti);
      let prossimo = risposta.headers.get("location");
      if (risposta.status === 200) {
        const html = await risposta.text();
        if (pagina.includes("mfa-detect")) {
          const passo = await this._chiedi(azioneDelModulo(html, pagina), biscotti, {
            metodo: "POST",
            modulo: {
              ...campiNascosti(html),
              "js-available": "true",
              "webauthn-available": "false",
              "is-brave": "false",
              "webauthn-platform-available": "false",
              action: "default",
            },
          });
          prossimo = passo.headers.get("location");
        } else if (pagina.includes("/u/consent")) {
          const passo = await this._chiedi(azioneDelModulo(html, pagina), biscotti, {
            metodo: "POST",
            modulo: { ...campiNascosti(html), state: stato, action: "accept" },
          });
          prossimo = passo.headers.get("location");
        } else if (/mfa-sms|mfa-otp/.test(pagina) || /enter code|verification code/i.test(html)) {
          throw new ServeIlCodice({
            indirizzo: azioneDelModulo(html, pagina),
            nascosti: campiNascosti(html),
            biscotti: biscotti.comeOggetto(),
            stato,
          });
        } else {
          break;
        }
      }
      if (!prossimo) break;
      dove = prossimo;
    }
    const codice = ilCodiceNelRitorno(dove);
    if (!codice) throw new AccessoNegato("nessun codice");
    return codice;
  }

  /* Il codice SMS, sull'accesso lasciato a meta'. */
  async conIlCodice(codiceSms, sessione) {
    const biscotti = new Biscotti(sessione?.biscotti || {});
    const risposta = await this._chiedi(sessione.indirizzo, biscotti, {
      metodo: "POST",
      modulo: { ...sessione.nascosti, code: codiceSms, action: "default" },
    });
    const rimando = risposta.headers.get("location");
    if (!rimando || rimando.includes("/u/login") || /mfa/i.test(rimando))
      throw new AccessoNegato("codice");
    let codice;
    try {
      codice = await this._finoAlCodice(rimando, biscotti, sessione.stato);
    } catch (errore) {
      if (errore instanceof ServeIlCodice) throw new AccessoNegato("codice");
      throw errore;
    }
    return this._scambia(codice);
  }
}

/* ─── le letture ─────────────────────────────────────────────────────────── */

function testo(dato, ...chiavi) {
  for (const chiave of chiavi) {
    const valore = dato?.[chiave];
    if (valore !== undefined && valore !== null && valore !== "" && valore !== "null")
      return String(valore).trim();
  }
  return null;
}

/* Gli importi arrivano come testo: `98.00`, o `1.234,50` all'italiana. */
export function numero(dato, ...chiavi) {
  for (const chiave of chiavi) {
    const valore = dato?.[chiave];
    if (valore === undefined || valore === null || valore === "" || valore === "null") continue;
    let scritto = String(valore).trim();
    if (scritto.includes(",")) scritto = scritto.replace(/\./g, "").replace(",", ".");
    const n = Number(scritto);
    if (scritto !== "" && Number.isFinite(n)) return n;
  }
  return null;
}

/* `GG/MM/AAAA`, anche con l'ora dietro: torna `AAAA-MM-GG`, o null. */
export function giornoItaliano(valore) {
  const trovato = String(valore || "")
    .trim()
    .split(" ")[0]
    .match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!trovato) return null;
  const [, g, m, a] = trovato;
  const giorno = new Date(Date.UTC(+a, +m - 1, +g));
  if (giorno.getUTCDate() !== +g || giorno.getUTCMonth() !== +m - 1) return null;
  return `${a}-${m}-${g}`;
}

export function unaFattura(dato) {
  const stato = testo(dato, "StatoPagamento", "StatoDocumento");
  return {
    importo: numero(dato, "Importo"),
    residuo: numero(dato, "ImportoResiduo"),
    emessa: giornoItaliano(testo(dato, "DataEmissione")),
    scadenza: giornoItaliano(testo(dato, "DataScadenza")),
    dal: giornoItaliano(testo(dato, "PeriodoCompetenzaInizio")),
    al: giornoItaliano(testo(dato, "PeriodoCompetenzaFine")),
    pagata: !["NOT_PAID", "UNPAID", ""].includes(String(stato || "").toUpperCase()),
    forniture: (Array.isArray(dato?.ListaForniture) ? dato.ListaForniture : []).flatMap((f) => [
      String(f?.CodiceFornitura || ""),
      String(f?.CodicePDR_POD || ""),
    ]),
  };
}

export function unaFornitura(dato) {
  const impianto = dato?.Installation || {};
  const tecnica = dato?.TechDataElectricity || {};
  const prodotto = dato?.ProductInformation || {};
  return {
    pod: testo(dato, "PODID", "PRID"),
    attiva: String(testo(impianto, "Status") || "").toUpperCase() === "ACTIVE",
    luce: String(testo(impianto, "Type") || "").toUpperCase() === "POWER",
    potenza: numero(tecnica, "ContractualPower"),
    fineOfferta: giornoItaliano(testo(prodotto, "EndDate")),
  };
}

export function unGiornoDiConsumi(dato) {
  const scritto = testo(dato, "data");
  let giorno = null;
  if (scritto && /^\d{4}-\d{2}-\d{2}$/.test(scritto)) giorno = scritto;
  else giorno = giornoItaliano(scritto);
  let totale = 0;
  for (let ora = 1; ora <= 24; ora += 1) {
    totale += numero(dato, `valore_h${String(ora).padStart(2, "0")}`) ?? 0;
  }
  return { giorno, totale: Math.round(totale * 1000) / 1000 };
}

function scadenzaDelGettone(gettone) {
  try {
    const corpo = JSON.parse(Buffer.from(String(gettone).split(".")[1], "base64url").toString());
    return Number.isFinite(corpo?.exp) ? corpo.exp * 1000 : 0;
  } catch (_errore) {
    return 0;
  }
}

function aMano(giorno) {
  const d = new Date(giorno);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

function iso(giorno) {
  return new Date(giorno).toISOString().slice(0, 10);
}

/* Le letture coi gettoni di chi e' entrato. `rinnovati` si chiama coi gettoni
 * nuovi ogni volta che E.ON li ruota: vanno scritti subito, perche' quello
 * vecchio non vale piu'. */
export class ClientEon {
  constructor({
    gettoni,
    rinnovati = () => {},
    prendi = globalThis.fetch,
    configurazione,
    adesso = () => Date.now(),
  }) {
    this.accesso = String(gettoni?.access_token || "");
    this.rinnovo = gettoni?.refresh_token ? String(gettoni.refresh_token) : "";
    this.rinnovati = rinnovati;
    this.prendi = prendi;
    this.configurazione = configurazione ?? new ConfigurazioneEon({ prendi });
    this.adesso = adesso;
    this.scade = scadenzaDelGettone(this.accesso);
  }

  async _rinnova() {
    if (!this.rinnovo) throw new AccessoNegato("niente rinnovo");
    let risposta;
    try {
      risposta = await this.prendi(GETTONI, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: CLIENT_ID,
          refresh_token: this.rinnovo,
        }).toString(),
        signal: AbortSignal.timeout(ATTESA),
      });
    } catch (_errore) {
      throw new ErroreEon("rete");
    }
    if (risposta.status !== 200) {
      /* Rifiutato: il rinnovo e' scaduto o e' gia' stato usato. */
      if (risposta.status >= 400 && risposta.status < 500) throw new AccessoNegato("rinnovo");
      throw new ErroreEon(`rinnovo ${risposta.status}`);
    }
    const nuovi = await risposta.json();
    if (!nuovi?.access_token) throw new AccessoNegato("rinnovo vuoto");
    this.accesso = nuovi.access_token;
    if (nuovi.refresh_token) this.rinnovo = nuovi.refresh_token;
    this.scade = Number(nuovi.expires_in)
      ? this.adesso() + Number(nuovi.expires_in) * 1000
      : scadenzaDelGettone(this.accesso);
    await this.rinnovati({ access_token: this.accesso, refresh_token: this.rinnovo });
  }

  /* Una domanda all'API. E.ON risponde 500, e non 401, a un gettone scaduto:
   * un 500 vale come «forse e' il gettone», si rinnova e si riprova una volta.
   * E la lista delle fatture risponde 202 col contenuto: va bene tutto il 2xx. */
  async _chiedi(metodo, via, { corpo = null, domanda = null } = {}, riprova = true) {
    const { base_url, subscription_key } = await this.configurazione.leggi();
    if (riprova && this.scade && this.adesso() >= this.scade - MARGINE && this.rinnovo)
      await this._rinnova();
    const indirizzo = new URL(`${base_url}${via}`);
    for (const [chiave, valore] of Object.entries(domanda || {}))
      indirizzo.searchParams.set(chiave, valore);
    let risposta;
    try {
      risposta = await this.prendi(indirizzo, {
        method: metodo,
        headers: {
          authorization: `Bearer ${this.accesso}`,
          "content-type": "application/json",
          "ocp-apim-subscription-key": subscription_key,
        },
        body: corpo ? JSON.stringify(corpo) : undefined,
        signal: AbortSignal.timeout(ATTESA),
      });
    } catch (_errore) {
      throw new ErroreEon("rete");
    }
    if (risposta.status === 401 || risposta.status === 500) {
      if (riprova) {
        await this._rinnova();
        return this._chiedi(metodo, via, { corpo, domanda }, false);
      }
      if (risposta.status === 401) throw new AccessoNegato("gettone");
      throw new ErroreEon("500");
    }
    if (risposta.status < 200 || risposta.status >= 300) throw new ErroreEon(`${risposta.status}`);
    try {
      return JSON.parse(await risposta.text());
    } catch (_errore) {
      throw new ErroreEon("risposta illeggibile");
    }
  }

  async forniture() {
    const dati = await this._chiedi("GET", FORNITURE);
    return (Array.isArray(dati) ? dati : []).map(unaFornitura);
  }

  async fornitura(pod) {
    return unaFornitura(
      (await this._chiedi("GET", `${FORNITURE}/${encodeURIComponent(pod)}`)) || {},
    );
  }

  async fatture(pod, { giorni = 400 } = {}) {
    const oggi = this.adesso();
    const dati = await this._chiedi("GET", FATTURE, {
      domanda: {
        apiversion: "v1.0",
        documentoDal: aMano(oggi - giorni * 86_400_000),
        documentoAl: aMano(oggi),
      },
    });
    const tutte = (Array.isArray(dati?.ListaFatture) ? dati.ListaFatture : []).map(unaFattura);
    return tutte.filter((f) => f.forniture.includes(pod));
  }

  async consumi(pod, { dal, al }) {
    const dati = await this._chiedi("POST", CONSUMI, {
      corpo: { DataInizio: iso(dal), DataFine: iso(al), PR: pod, Type: "H", Misura: "Ea" },
    });
    return (Array.isArray(dati) ? dati : []).map(unGiornoDiConsumi);
  }
}
