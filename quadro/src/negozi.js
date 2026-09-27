/* I negozi: chiedere a Google e ad Apple se una ricevuta e' vera.
 *
 * L'app gdahome compra nel negozio del telefono, manda la ricevuta alla casa
 * sul filo cifrato, e la casa la gira qui. Una ricevuta, da sola, e' una
 * stringa che chiunque puo' scrivere: vale solo quello che il negozio dice di
 * lei, chiesto **da qui**, con le chiavi di chi vende. Percio' questo file non
 * crede a niente di quello che arriva nel corpo — ne' al prodotto, ne' alla
 * scadenza — e prende tutto dalla risposta del negozio.
 *
 * ─── Google Play ─────────────────────────────────────────────────────────
 *
 * `purchases.subscriptionsv2.get`, con un service account della Play Console
 * (`QUADRO_GOOGLE_SERVICE_ACCOUNT`, il JSON intero). Il service account firma
 * un JWT RS256 e lo scambia con un gettone d'accesso a
 * `oauth2.googleapis.com`; il gettone si tiene finche' vale. La ricevuta e' il
 * `purchaseToken`.
 *
 * Un abbonamento Play va **riconosciuto** entro tre giorni, se no Google lo
 * rimborsa da se'. Lo fa gia' l'app quando chiude l'acquisto; se qui arriva
 * ancora da riconoscere, lo si riconosce anche da qui — una volta in piu' non
 * costa niente, una in meno costa un cliente.
 *
 * ─── App Store ───────────────────────────────────────────────────────────
 *
 * App Store Server API, `GET /inApps/v1/transactions/{id}`, con un JWT ES256
 * fatto con la chiave `.p8` di App Store Connect (`QUADRO_APPLE_CHIAVE`,
 * `QUADRO_APPLE_KEY_ID`, `QUADRO_APPLE_ISSUER`, `QUADRO_APPLE_BUNDLE`). Si
 * prova la produzione e, se non la conosce, il sandbox: le build di TestFlight
 * comprano li'. La ricevuta e' l'identificativo della transazione, o la JWS
 * che StoreKit 2 da' all'app: da quella si prende solo l'identificativo, e il
 * resto si richiede ad Apple.
 *
 * La risposta di Apple e' a sua volta una JWS: si verifica la firma con il
 * certificato che porta (`x5c`), la catena fino alla radice, e la radice
 * contro l'impronta di «Apple Root CA - G3». La strada e' gia' TLS verso Apple,
 * quindi e' una cintura in piu', non l'unica.
 *
 * ─── I rinnovi ───────────────────────────────────────────────────────────
 *
 * Un abbonamento si paga un periodo alla volta: la scadenza che il negozio
 * dice oggi e' la fine della prova gratuita o del mese, non dell'abbonamento.
 * Per questo il quadro tiene l'identificativo dell'acquisto (il token di
 * Google, la transazione originale di Apple) e, vicino alla scadenza, lo
 * richiede al negozio da se' (`ricontrolla`): Google con lo stesso
 * `subscriptionsv2.get`, Apple con «Get All Subscription Statuses»
 * (`GET /inApps/v1/subscriptions/{originalTransactionId}`).
 *
 * ─── La prova gratuita ───────────────────────────────────────────────────
 *
 * gdahome e gdanav hanno quattordici giorni di prova la prima volta. Si
 * riconosce da quello che dice il negozio: Google con `offerPhase.freeTrial`
 * nella riga (e, se la fase non c'e', dai tag o dal nome dell'offerta), Apple
 * con `offerType` 1 e `offerDiscountType` «FREE_TRIAL».
 *
 * Senza chiavi, `configurato` dice di no e il server risponde 503: i regali
 * funzionano lo stesso.
 */

import { createPrivateKey, sign, verify, X509Certificate } from "node:crypto";

/** I prodotti, e di quale app sono. Quello che non comincia cosi' non e' nostro. */
export function laAppDel(prodotto) {
  const detto = String(prodotto ?? "");
  if (/^gdahome_premium(\b|_|:|$)/.test(detto)) return "gdahome";
  if (/^gdanav_premium(\b|_|:|$)/.test(detto)) return "gdanav";
  return null;
}

/** L'impronta SHA-256 di «Apple Root CA - G3», quella che firma le JWS dello StoreKit. */
export const RADICE_APPLE = "63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179";

const GOOGLE_API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const APPLE_PRODUZIONE = "https://api.storekit.itunes.apple.com";
const APPLE_SANDBOX = "https://api.storekit-sandbox.itunes.apple.com";

/* Gli stati di un abbonamento Play in cui chi l'ha pagato e' ancora dentro.
 * Annullato vuol dire «non si rinnova», non «finito»: vale fino alla scadenza. */
const GOOGLE_VALIDI = new Set([
  "SUBSCRIPTION_STATE_ACTIVE",
  "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
  "SUBSCRIPTION_STATE_CANCELED",
]);

/** Una ricevuta che il negozio non riconosce, o non per quello che si dice. */
export class RicevutaNonValida extends Error {
  constructor(perche) {
    super(perche);
    this.errore = perche;
  }
}

/** Il negozio non ha risposto come doveva: non e' colpa della ricevuta. */
export class NegozioGiu extends Error {}

const b64u = (cosa) => Buffer.from(cosa).toString("base64url");
const ilJwt = (testa, corpo) => `${b64u(JSON.stringify(testa))}.${b64u(JSON.stringify(corpo))}`;

/* Una riga di Google e' in prova gratuita? La fase dell'offerta lo dice
 * chiaro; se manca, si guarda come si chiama l'offerta: nella Play Console
 * quella della prova ha il tag (o il nome) «prova» o «trial». */
function inProvaSuGoogle(riga) {
  const fase = riga?.offerPhase;
  if (fase && typeof fase === "object")
    return Boolean(fase.freeTrial && typeof fase.freeTrial === "object");
  const offerta = riga?.offerDetails || {};
  const parla = (detto) => /prova|trial/i.test(String(detto ?? ""));
  return (
    (Array.isArray(offerta.offerTags) && offerta.offerTags.some(parla)) || parla(offerta.offerId)
  );
}

/* Una transazione di Apple e' in prova gratuita: un'offerta introduttiva
 * (`offerType` 1) che non costa niente. */
const inProvaSuApple = (t) => t?.offerType === 1 && t?.offerDiscountType === "FREE_TRIAL";

/** Il corpo di una JWS, **senza** verificarla. Chi lo usa sa perche'. */
export function ilCorpoDi(jws) {
  const pezzi = String(jws ?? "").split(".");
  if (pezzi.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(pezzi[1], "base64url").toString("utf8"));
  } catch (_errore) {
    return null;
  }
}

/**
 * Verifica una JWS di Apple: firma ES256 col primo certificato di `x5c`, ogni
 * certificato firmato dal successivo, e l'ultimo con l'impronta della radice.
 * Torna il corpo, o solleva.
 */
export function verificaLaJwsDiApple(jws, radice = RADICE_APPLE, adesso = Date.now()) {
  const pezzi = String(jws ?? "").split(".");
  if (pezzi.length !== 3) throw new RicevutaNonValida("risposta-apple-illeggibile");
  let testa;
  try {
    testa = JSON.parse(Buffer.from(pezzi[0], "base64url").toString("utf8"));
  } catch (_errore) {
    throw new RicevutaNonValida("risposta-apple-illeggibile");
  }
  if (testa?.alg !== "ES256" || !Array.isArray(testa.x5c) || testa.x5c.length < 2)
    throw new RicevutaNonValida("risposta-apple-senza-catena");
  const catena = testa.x5c.map((uno) => new X509Certificate(Buffer.from(uno, "base64")));
  for (let i = 0; i < catena.length; i += 1) {
    const uno = catena[i];
    if (Date.parse(uno.validFrom) > adesso || Date.parse(uno.validTo) < adesso)
      throw new RicevutaNonValida("risposta-apple-certificato-scaduto");
    const sopra = catena[i + 1] ?? uno;
    if (!uno.verify(sopra.publicKey)) throw new RicevutaNonValida("risposta-apple-catena-rotta");
  }
  const impronta = catena.at(-1).fingerprint256.replace(/:/g, "").toUpperCase();
  if (impronta !== String(radice).replace(/:/g, "").toUpperCase())
    throw new RicevutaNonValida("risposta-apple-radice-sconosciuta");
  const firmata = Buffer.from(`${pezzi[0]}.${pezzi[1]}`, "ascii");
  const buona = verify(
    "sha256",
    firmata,
    { key: catena[0].publicKey, dsaEncoding: "ieee-p1363" },
    Buffer.from(pezzi[2], "base64url"),
  );
  if (!buona) throw new RicevutaNonValida("risposta-apple-firma-sbagliata");
  return JSON.parse(Buffer.from(pezzi[1], "base64url").toString("utf8"));
}

export class Negozi {
  /**
   * Tutto si puo' passare da fuori, per le prove: le chiavi e soprattutto
   * `fetch`, che nelle prove risponde come Google e come Apple senza
   * uscire dalla macchina.
   */
  constructor({
    ambiente = process.env,
    fetch: chiama = globalThis.fetch,
    adesso = () => Date.now(),
    registro = { debug() {}, info() {}, attenzione() {}, errore() {} },
  } = {}) {
    this.chiama = chiama;
    this.adesso = adesso;
    this.registro = registro;
    this.google = null;
    this.apple = null;
    this.gettoneGoogle = null;

    const conto = String(ambiente.QUADRO_GOOGLE_SERVICE_ACCOUNT || "").trim();
    if (conto) {
      try {
        const letto = JSON.parse(conto);
        if (letto.client_email && letto.private_key) {
          this.google = {
            email: letto.client_email,
            chiave: createPrivateKey(letto.private_key),
            token: letto.token_uri || GOOGLE_TOKEN,
            pacchetto: String(ambiente.QUADRO_GOOGLE_PACCHETTO || "com.gdahome.gdahome"),
          };
        }
      } catch (errore) {
        registro.attenzione(`il service account di Google non si legge: ${errore?.message}`);
      }
    }

    const p8 = String(ambiente.QUADRO_APPLE_CHIAVE || "")
      .replace(/\\n/g, "\n")
      .trim();
    if (p8 && ambiente.QUADRO_APPLE_KEY_ID && ambiente.QUADRO_APPLE_ISSUER) {
      try {
        this.apple = {
          chiave: createPrivateKey(p8),
          kid: String(ambiente.QUADRO_APPLE_KEY_ID),
          iss: String(ambiente.QUADRO_APPLE_ISSUER),
          bundle: String(ambiente.QUADRO_APPLE_BUNDLE || "com.gdahome.gdahome"),
          radice: String(ambiente.QUADRO_APPLE_RADICE || RADICE_APPLE),
        };
      } catch (errore) {
        registro.attenzione(`la chiave di App Store Connect non si legge: ${errore?.message}`);
      }
    }
  }

  /** Se si sa chiedere a quel negozio. */
  configurato(piattaforma) {
    return piattaforma === "android"
      ? Boolean(this.google)
      : piattaforma === "ios"
        ? Boolean(this.apple)
        : false;
  }

  /**
   * Controlla una ricevuta. Torna `{app, prodotto, scade, acquisto, prima,
   * prova, ricevuta}`: di quale app e', fino a quando vale, l'identificativo
   * con cui si riconosce lo stesso acquisto la volta dopo, se e' in prova
   * gratuita, e quello che serve per richiederlo al negozio (`ricontrolla`).
   * Solleva `RicevutaNonValida` (402) o `NegozioGiu` (502).
   */
  async controlla({ piattaforma, prodotto, ricevuta }) {
    if (piattaforma === "android")
      return this._google(String(prodotto ?? ""), String(ricevuta ?? ""));
    if (piattaforma === "ios") return this._apple(String(prodotto ?? ""), String(ricevuta ?? ""));
    throw new RicevutaNonValida("piattaforma-non-valida");
  }

  /**
   * Richiede al negozio un abbonamento gia' visto, con quello che se ne e'
   * tenuto (`ricevuta` come la torna `controlla`): Google il token e il
   * prodotto, Apple la transazione originale. Torna e solleva come
   * `controlla`.
   */
  async ricontrolla({ piattaforma, ricevuta }) {
    if (piattaforma === "android")
      return this._google(String(ricevuta?.prodotto ?? ""), String(ricevuta?.token ?? ""));
    if (piattaforma === "ios") return this._appleDiNuovo(String(ricevuta?.originale ?? ""));
    throw new RicevutaNonValida("piattaforma-non-valida");
  }

  /* ─── Google ────────────────────────────────────────────────────────── */

  async _gettoneGoogle() {
    const ora = this.adesso();
    if (this.gettoneGoogle && this.gettoneGoogle.fino > ora + 60 * 1000)
      return this.gettoneGoogle.valore;
    const secondi = Math.floor(ora / 1000);
    const firmare = ilJwt(
      { alg: "RS256", typ: "JWT" },
      {
        iss: this.google.email,
        scope: GOOGLE_SCOPE,
        aud: this.google.token,
        iat: secondi,
        exp: secondi + 3600,
      },
    );
    const firma = sign("sha256", Buffer.from(firmare), this.google.chiave);
    const risposta = await this.chiama(this.google.token, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: `${firmare}.${b64u(firma)}`,
      }).toString(),
    });
    if (!risposta.ok) throw new NegozioGiu(`google non da' il gettone: ${risposta.status}`);
    const detto = await risposta.json();
    if (!detto?.access_token) throw new NegozioGiu("google non da' il gettone");
    this.gettoneGoogle = {
      valore: detto.access_token,
      fino: ora + (Number(detto.expires_in) || 3600) * 1000,
    };
    return this.gettoneGoogle.valore;
  }

  async _google(prodotto, token) {
    if (!/^[A-Za-z0-9._:-]{10,1000}$/.test(token))
      throw new RicevutaNonValida("ricevuta-illeggibile");
    const gettone = await this._gettoneGoogle();
    const base = `${GOOGLE_API}/${encodeURIComponent(this.google.pacchetto)}/purchases`;
    const risposta = await this.chiama(
      `${base}/subscriptionsv2/tokens/${encodeURIComponent(token)}`,
      {
        headers: { authorization: `Bearer ${gettone}` },
      },
    );
    /* 400 e 404 vogliono dire «questo token non lo conosco», e 410 «non c'e'
     * piu'»: la ricevuta non vale. Tutto il resto e' Google che non risponde. */
    if ([400, 404, 410].includes(risposta.status))
      throw new RicevutaNonValida("ricevuta-sconosciuta");
    if (!risposta.ok) throw new NegozioGiu(`google risponde ${risposta.status}`);
    const detto = await risposta.json();
    const righe = (Array.isArray(detto?.lineItems) ? detto.lineItems : []).filter((una) =>
      laAppDel(una?.productId),
    );
    if (!righe.length) throw new RicevutaNonValida("prodotto-sconosciuto");
    /* Il prodotto dice di quale app e'. Quello che ha detto l'app nel corpo
     * serve solo a scegliere la riga, se ce ne fossero due. */
    const riga =
      righe.find((una) => una.productId === prodotto || prodotto.startsWith(`${una.productId}:`)) ??
      righe[0];
    const app = laAppDel(riga.productId);
    const sue = righe.filter((una) => laAppDel(una.productId) === app);
    const scade = Math.max(...sue.map((una) => Date.parse(una.expiryTime) || 0));
    /* La prova la dice la riga che dura di piu': quella del periodo in corso. */
    const ultima = sue.find((una) => (Date.parse(una.expiryTime) || 0) === scade) ?? riga;
    if (!scade) throw new RicevutaNonValida("ricevuta-senza-scadenza");
    if (!GOOGLE_VALIDI.has(detto.subscriptionState) || scade <= this.adesso())
      throw new RicevutaNonValida("abbonamento-scaduto");

    if (detto.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING") {
      try {
        await this.chiama(
          `${base}/subscriptions/${encodeURIComponent(riga.productId)}/tokens/${encodeURIComponent(token)}:acknowledge`,
          {
            method: "POST",
            headers: { authorization: `Bearer ${gettone}`, "content-type": "application/json" },
            body: "{}",
          },
        );
      } catch (errore) {
        this.registro.attenzione(
          `google: riconoscere l'abbonamento non e' andato: ${errore?.message}`,
        );
      }
    }

    return {
      app,
      prodotto: riga.productId,
      scade,
      acquisto: token,
      prima: detto.linkedPurchaseToken || null,
      prova: inProvaSuGoogle(ultima),
      ricevuta: { token, prodotto: riga.productId },
    };
  }

  /* ─── Apple ─────────────────────────────────────────────────────────── */

  _jwtApple() {
    const secondi = Math.floor(this.adesso() / 1000);
    const firmare = ilJwt(
      { alg: "ES256", kid: this.apple.kid, typ: "JWT" },
      {
        iss: this.apple.iss,
        iat: secondi,
        exp: secondi + 20 * 60,
        aud: "appstoreconnect-v1",
        bid: this.apple.bundle,
      },
    );
    const firma = sign("sha256", Buffer.from(firmare), {
      key: this.apple.chiave,
      dsaEncoding: "ieee-p1363",
    });
    return `${firmare}.${b64u(firma)}`;
  }

  async _apple(prodotto, ricevuta) {
    /* La JWS che StoreKit 2 da' all'app: se ne legge solo l'identificativo,
     * e tutto il resto lo si chiede ad Apple. */
    let id = ricevuta.trim();
    if (id.split(".").length === 3) id = String(ilCorpoDi(id)?.transactionId ?? "");
    if (!/^\d{1,40}$/.test(id)) throw new RicevutaNonValida("ricevuta-illeggibile");

    const jwt = this._jwtApple();
    let firmata = null;
    for (const dove of [APPLE_PRODUZIONE, APPLE_SANDBOX]) {
      const risposta = await this.chiama(`${dove}/inApps/v1/transactions/${id}`, {
        headers: { authorization: `Bearer ${jwt}` },
      });
      if (risposta.status === 404) continue;
      if (risposta.status === 400) throw new RicevutaNonValida("ricevuta-sconosciuta");
      if (!risposta.ok) throw new NegozioGiu(`apple risponde ${risposta.status}`);
      firmata = (await risposta.json())?.signedTransactionInfo;
      break;
    }
    if (!firmata) throw new RicevutaNonValida("ricevuta-sconosciuta");

    return this._laTransazione(verificaLaJwsDiApple(firmata, this.apple.radice, this.adesso()));
  }

  /**
   * «Get All Subscription Statuses»: lo stato di adesso di un abbonamento,
   * dalla sua transazione originale. Di ogni gruppo Apple da' l'ultima
   * transazione: si prende quella con la stessa originale.
   */
  async _appleDiNuovo(originale) {
    if (!/^\d{1,40}$/.test(originale)) throw new RicevutaNonValida("ricevuta-illeggibile");
    const jwt = this._jwtApple();
    let detto = null;
    for (const dove of [APPLE_PRODUZIONE, APPLE_SANDBOX]) {
      const risposta = await this.chiama(`${dove}/inApps/v1/subscriptions/${originale}`, {
        headers: { authorization: `Bearer ${jwt}` },
      });
      if (risposta.status === 404) continue;
      if (risposta.status === 400) throw new RicevutaNonValida("ricevuta-sconosciuta");
      if (!risposta.ok) throw new NegozioGiu(`apple risponde ${risposta.status}`);
      detto = await risposta.json();
      break;
    }
    const ultime = (Array.isArray(detto?.data) ? detto.data : []).flatMap((gruppo) =>
      Array.isArray(gruppo?.lastTransactions) ? gruppo.lastTransactions : [],
    );
    const sua = ultime.find((una) => String(una?.originalTransactionId) === originale);
    if (!sua?.signedTransactionInfo) throw new RicevutaNonValida("ricevuta-sconosciuta");
    const t = verificaLaJwsDiApple(sua.signedTransactionInfo, this.apple.radice, this.adesso());
    if (String(t.originalTransactionId) !== originale)
      throw new RicevutaNonValida("ricevuta-sconosciuta");
    return this._laTransazione(t);
  }

  /** Una transazione di Apple gia' verificata, nella forma di `controlla`. */
  _laTransazione(t) {
    if (t.bundleId !== this.apple.bundle) throw new RicevutaNonValida("ricevuta-di-un-altra-app");
    const app = laAppDel(t.productId);
    if (!app) throw new RicevutaNonValida("prodotto-sconosciuto");
    if (t.revocationDate) throw new RicevutaNonValida("acquisto-rimborsato");
    const scade = Number(t.expiresDate) || 0;
    if (!scade) throw new RicevutaNonValida("ricevuta-senza-scadenza");
    if (scade <= this.adesso()) throw new RicevutaNonValida("abbonamento-scaduto");
    return {
      app,
      prodotto: t.productId,
      scade,
      /* La transazione **originale**: resta la stessa a ogni rinnovo, e fa
       * ritrovare la stessa licenza. */
      acquisto: String(t.originalTransactionId || t.transactionId),
      prima: null,
      prova: inProvaSuApple(t),
      ricevuta: { originale: String(t.originalTransactionId || t.transactionId) },
    };
  }
}
