/* ENGIE Italia, dal ponte.
 *
 * E' il porto in JavaScript del client dell'integrazione «ENGIE Italia» di
 * Gabriele Pennacchia (https://github.com/GabboPenna/ha-engie-italia, commit
 * ec67d179 del 2026-10-19, cartella `custom_components/engie_italia/api`),
 * licenza MIT: il testo e' in `LICENZE.md`, accanto. Le stesse regole, che
 * erano gia' scritte per la sicurezza e qui restano:
 *
 *   - **la password non passa mai di qui.** Si entra dal sito di ENGIE, nel
 *     browser, e al ponte arriva solo l'indirizzo dove il browser e' tornato:
 *     un codice che vale una volta, legato a questo tentativo da `state` e da
 *     PKCE, e che senza il `verifier` — che resta qui — non apre niente.
 *   - **l'identita' si controlla**: il gettone `id_token` deve essere firmato
 *     da ENGIE (le chiavi pubbliche del suo `jwks.json`), per l'app di ENGIE,
 *     e col `nonce` di questo tentativo.
 *   - **solo letture**: le vie che si possono chiedere sono un elenco chiuso.
 *
 * La chiave dell'app (`API_KEY`) e l'identificativo del client sono quelli
 * dell'app nativa di ENGIE, gli stessi dell'integrazione originale: non sono
 * di nessuno e da soli non leggono niente.
 */

import { createHash, createPublicKey, randomBytes, timingSafeEqual, verify } from "node:crypto";

export const EMITTENTE = "https://login.engie.it/";
export const RITORNO = `${EMITTENTE}android/it.engie.appengie/callback`;
const PUBBLICO = "https://mobileapp.jwt";
export const CLIENT_ID = "vevw1dcH7a8Dheq4zWDDkoNwqtKWWlYF";
export const API_KEY = "L7PioCFoLN2WarD8ps3aq2G8lD151bjO5MSVkvo2";
const API = "https://api-mobileapp2022-prod.aws.engie.it/";
const GETTONI = `${EMITTENTE}oauth/token`;
const VIE = new Set(["contracts/v2/user", "contracts/v2/invoices"]);
const VITA_DEL_TENTATIVO = 600_000;
const ATTESA = 20_000;
const MASSIMO = 4 * 1024 * 1024;

export class ErroreEngie extends Error {}
export class AccessoNegato extends ErroreEngie {}
/* L'indirizzo incollato non e' quello del ritorno, o non e' di questo
 * tentativo. */
export class RitornoSbagliato extends AccessoNegato {}

const base64url = (byte) => Buffer.from(byte).toString("base64url");

function uguali(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

function unaCredenziale(valore) {
  if (typeof valore !== "string" || !valore.trim() || /[\x00-\x20\x7f]/.test(valore))
    throw new ErroreEngie("credenziale non valida");
  return valore;
}

/* ─── l'accesso dal browser ──────────────────────────────────────────────── */

export class Tentativo {
  constructor({ adesso = () => Date.now() } = {}) {
    this.adesso = adesso;
    this.verifier = base64url(randomBytes(48));
    this.state = base64url(randomBytes(24));
    this.nonce = base64url(randomBytes(24));
    this.nato = adesso();
    this.usato = false;
  }

  get link() {
    const sfida = base64url(createHash("sha256").update(this.verifier).digest());
    return `${EMITTENTE}authorize?${new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: "code",
      redirect_uri: RITORNO,
      scope: "openid profile email offline_access",
      audience: PUBBLICO,
      code_challenge: sfida,
      code_challenge_method: "S256",
      state: this.state,
      nonce: this.nonce,
      ui_locales: "it",
      prompt: "login",
    })}`;
  }

  get scaduto() {
    return this.adesso() - this.nato > VITA_DEL_TENTATIVO;
  }

  /* Il codice dal ritorno incollato, se e' proprio questo ritorno. */
  ilCodice(indirizzo) {
    if (this.usato || this.scaduto) throw new RitornoSbagliato("tentativo finito");
    let url;
    try {
      if (typeof indirizzo !== "string" || indirizzo.length > 8192) throw new Error();
      url = new URL(indirizzo.trim());
    } catch (_errore) {
      throw new RitornoSbagliato("indirizzo");
    }
    if (
      url.protocol !== "https:" ||
      url.host !== "login.engie.it" ||
      url.pathname !== "/android/it.engie.appengie/callback" ||
      url.hash
    )
      throw new RitornoSbagliato("indirizzo");
    const stati = url.searchParams.getAll("state");
    if (stati.length !== 1 || !uguali(stati[0], this.state)) throw new RitornoSbagliato("state");
    if (url.searchParams.has("error")) throw new RitornoSbagliato("rifiutato");
    const codici = url.searchParams.getAll("code");
    if (codici.length !== 1) throw new RitornoSbagliato("codice");
    return unaCredenziale(codici[0]);
  }
}

async function json(prendi, metodo, via, corpo = undefined) {
  let risposta;
  try {
    risposta = await prendi(`${EMITTENTE}${via}`, {
      method: metodo,
      headers: corpo ? { "content-type": "application/json" } : {},
      body: corpo ? JSON.stringify(corpo) : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(ATTESA),
    });
  } catch (_errore) {
    throw new ErroreEngie("rete");
  }
  if (risposta.status !== 200) {
    if ([400, 401, 403].includes(risposta.status)) throw new AccessoNegato("rifiutato");
    throw new ErroreEngie(`${risposta.status}`);
  }
  try {
    return await risposta.json();
  } catch (_errore) {
    throw new ErroreEngie("risposta illeggibile");
  }
}

/* Verifica l'`id_token` con le chiavi pubbliche di ENGIE: RS256, emesso da
 * ENGIE, per l'app di ENGIE, non scaduto, col nonce di questo tentativo. Torna
 * il `sub`. */
export function verificaLIdentita(idToken, chiavi, tentativo, adesso = Date.now()) {
  const pezzi = String(idToken || "").split(".");
  if (pezzi.length !== 3) throw new AccessoNegato("identita'");
  let testa;
  let corpo;
  try {
    testa = JSON.parse(Buffer.from(pezzi[0], "base64url").toString());
    corpo = JSON.parse(Buffer.from(pezzi[1], "base64url").toString());
  } catch (_errore) {
    throw new AccessoNegato("identita'");
  }
  if (testa?.alg !== "RS256") throw new AccessoNegato("identita'");
  const jwk = (Array.isArray(chiavi?.keys) ? chiavi.keys : []).find((k) => k?.kid === testa.kid);
  if (!jwk) throw new AccessoNegato("identita'");
  let buona = false;
  try {
    buona = verify(
      "RSA-SHA256",
      Buffer.from(`${pezzi[0]}.${pezzi[1]}`),
      createPublicKey({ key: jwk, format: "jwk" }),
      Buffer.from(pezzi[2], "base64url"),
    );
  } catch (_errore) {
    buona = false;
  }
  const ora = adesso / 1000;
  const pubblico = Array.isArray(corpo.aud) ? corpo.aud : [corpo.aud];
  if (
    !buona ||
    corpo.iss !== EMITTENTE ||
    !pubblico.includes(CLIENT_ID) ||
    !Number.isFinite(corpo.exp) ||
    !Number.isFinite(corpo.iat) ||
    corpo.exp + 30 < ora ||
    corpo.iat - 30 > ora ||
    typeof corpo.nonce !== "string" ||
    !uguali(corpo.nonce, tentativo.nonce) ||
    typeof corpo.sub !== "string" ||
    !corpo.sub
  )
    throw new AccessoNegato("identita'");
  return corpo.sub;
}

function gettoniDa(risposta, rinnovoDiPrima = null, adesso = Date.now()) {
  const vita = risposta?.expires_in;
  if (
    String(risposta?.token_type || "").toLowerCase() !== "bearer" ||
    !Number.isInteger(vita) ||
    vita <= 0
  )
    throw new AccessoNegato("gettoni");
  return {
    access_token: unaCredenziale(risposta.access_token),
    refresh_token: unaCredenziale(risposta.refresh_token ?? rinnovoDiPrima),
    expires_at: adesso + vita * 1000,
  };
}

/* Dal ritorno incollato ai gettoni. Torna `{ conto, gettoni }`: il conto e'
 * un'impronta del `sub`, non il `sub`, e serve solo a riconoscere lo stesso
 * account quando ci si ricollega. */
export async function completaLAccesso(tentativo, indirizzo, { prendi = globalThis.fetch } = {}) {
  tentativo.ilCodice(indirizzo);
  /* Le chiavi prima del codice: il codice vale una volta sola. */
  const chiavi = await json(prendi, "GET", ".well-known/jwks.json");
  const codice = tentativo.ilCodice(indirizzo);
  tentativo.usato = true;
  const verifier = tentativo.verifier;
  tentativo.verifier = "";
  let risposta;
  try {
    risposta = await json(prendi, "POST", "oauth/token", {
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code: codice,
      code_verifier: verifier,
      redirect_uri: RITORNO,
    });
  } catch (errore) {
    if (errore instanceof AccessoNegato) throw new RitornoSbagliato("scambio");
    throw errore;
  }
  const sub = verificaLIdentita(risposta?.id_token, chiavi, tentativo, tentativo.adesso());
  return {
    conto: createHash("sha256")
      .update(EMITTENTE + sub)
      .digest("hex"),
    gettoni: gettoniDa(risposta, null, tentativo.adesso()),
  };
}

/* ─── le letture ─────────────────────────────────────────────────────────── */

function unGiorno(valore) {
  return typeof valore === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valore) ? valore : null;
}

function riuscita(dato) {
  if (!dato || typeof dato !== "object" || Array.isArray(dato))
    throw new ErroreEngie("risposta illeggibile");
  if (dato.code !== "OK") throw new ErroreEngie("risposta KO");
  for (const chiave of ["errorCode", "detailedErrorCode"]) {
    const valore = dato[chiave];
    if (valore !== undefined && valore !== null && valore !== 0)
      throw new ErroreEngie("risposta KO");
  }
  return dato;
}

/* Le forniture del conto: luce col POD, gas col PDR. */
export function leForniture(dato) {
  const risposta = riuscita(dato);
  const forniture = [];
  const contratti = [];
  for (const contratto of Array.isArray(risposta.listaContratti) ? risposta.listaContratti : []) {
    if (typeof contratto?.codContr === "string" && contratto.codContr)
      contratti.push(contratto.codContr);
    for (const f of Array.isArray(contratto?.forniture) ? contratto.forniture : []) {
      const luce = f?.commodity === "Luce";
      if (!luce && f?.commodity !== "Gas") continue;
      const punto = f?.punto || {};
      const potenza = Number(punto.potenzaImpegnata);
      forniture.push({
        pod: String((luce ? punto.pod : punto.pdr) || ""),
        luce,
        attiva: f?.attiva === "y",
        potenza: Number.isFinite(potenza) && punto.potenzaImpegnata !== null ? potenza : null,
        fineOfferta: unGiorno(f?.fineCE),
      });
    }
  }
  return { forniture, contratti: [...new Set(contratti)] };
}

const STATI = new Set(["paid", "not_paid", "expired", "partially_paid"]);

/* Le fatture di un contratto. ENGIE puo' rispondere 200 «OK» insieme a un suo
 * errore: in quel caso una lista vuota non vuol dire «niente da pagare». */
export function leFatture(dato) {
  const risposta = riuscita(dato);
  for (const chiave of ["engieErrorCode", "engieDetailedErrorCode"]) {
    const valore = risposta[chiave];
    if (valore !== undefined && valore !== null && valore !== 0)
      throw new ErroreEngie("fatture KO");
  }
  const dentro = risposta.response || {};
  if (dentro.inMaintenance === true) throw new ErroreEngie("manutenzione");
  return (Array.isArray(dentro.invoices) ? dentro.invoices : []).map((riga) => {
    const stato = String(riga?.invoiceStatus || "").toLowerCase();
    const importo = Number(riga?.amount);
    const residuo = Number(riga?.unpaidRemainingAmount);
    return {
      riferimento: String(riga?.fiscalNumber || ""),
      importo: riga?.amount === null || !Number.isFinite(importo) ? null : importo,
      residuo: riga?.unpaidRemainingAmount === null || !Number.isFinite(residuo) ? null : residuo,
      emessa: unGiorno(riga?.emissionDate),
      scadenza: unGiorno(riga?.expiryDate),
      stato: STATI.has(stato) ? stato : "unknown",
    };
  });
}

/* Aperta, chiusa, o «non si sa»: una fattura pagata con un residuo non
 * cancella un debito in silenzio. */
export function eAperta(fattura) {
  if (fattura.stato === "unknown") return null;
  if (fattura.stato === "paid") return fattura.residuo > 0 ? null : false;
  if (fattura.residuo !== null && fattura.residuo < 0) return null;
  return true;
}

export class ClientEngie {
  constructor({
    gettoni,
    rinnovati = async () => {},
    prendi = globalThis.fetch,
    adesso = () => Date.now(),
  }) {
    this.accesso = unaCredenziale(gettoni?.access_token);
    this.rinnovo = unaCredenziale(gettoni?.refresh_token);
    this.scade = Number(gettoni?.expires_at) || 0;
    this.rinnovati = rinnovati;
    this.prendi = prendi;
    this.adesso = adesso;
  }

  async _rinnova() {
    let risposta;
    try {
      risposta = await this.prendi(GETTONI, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: CLIENT_ID,
          refresh_token: this.rinnovo,
        }),
        redirect: "manual",
        signal: AbortSignal.timeout(ATTESA),
      });
    } catch (_errore) {
      throw new ErroreEngie("rete");
    }
    if ([400, 401, 403].includes(risposta.status)) throw new AccessoNegato("rinnovo");
    if (risposta.status !== 200) throw new ErroreEngie(`${risposta.status}`);
    const nuovi = gettoniDa(await risposta.json(), this.rinnovo, this.adesso());
    this.accesso = nuovi.access_token;
    this.rinnovo = nuovi.refresh_token;
    this.scade = nuovi.expires_at;
    /* Il rinnovo ruota: quello nuovo va scritto prima di qualunque altra
     * domanda, o al prossimo riavvio resterebbe quello gia' usato. */
    await this.rinnovati(nuovi);
  }

  async _chiedi(via, domanda = null) {
    if (!VIE.has(via)) throw new ErroreEngie("via non permessa");
    let rinnovato = false;
    if (this.adesso() >= this.scade - 30_000) {
      await this._rinnova();
      rinnovato = true;
    }
    for (let giro = 0; giro < 2; giro += 1) {
      const indirizzo = new URL(`${API}${via}`);
      for (const [chiave, valore] of Object.entries(domanda || {}))
        indirizzo.searchParams.set(chiave, valore);
      let risposta;
      try {
        risposta = await this.prendi(indirizzo, {
          headers: {
            sessionToken: this.accesso,
            authorization: `Bearer ${this.accesso}`,
            "x-api-key": API_KEY,
            locale: "IT",
            accept: "application/json",
          },
          redirect: "manual",
          signal: AbortSignal.timeout(ATTESA),
        });
      } catch (_errore) {
        throw new ErroreEngie("rete");
      }
      if (risposta.status === 401) {
        if (rinnovato || giro) throw new AccessoNegato("gettone");
        await this._rinnova();
        rinnovato = true;
        continue;
      }
      if (risposta.status !== 200) throw new ErroreEngie(`${risposta.status}`);
      const testo = await risposta.text();
      if (testo.length > MASSIMO) throw new ErroreEngie("troppo grande");
      try {
        return JSON.parse(testo);
      } catch (_errore) {
        throw new ErroreEngie("risposta illeggibile");
      }
    }
    throw new AccessoNegato("gettone");
  }

  async forniture() {
    return leForniture(await this._chiedi("contracts/v2/user"));
  }

  async fatture(contratti) {
    const tutte = new Map();
    for (const contratto of contratti) {
      for (const fattura of leFatture(
        await this._chiedi("contracts/v2/invoices", { contractId: contratto }),
      ))
        tutte.set(fattura.riferimento || `${tutte.size}`, fattura);
    }
    return [...tutte.values()];
  }
}
