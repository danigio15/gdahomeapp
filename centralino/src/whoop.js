/* Lo sportello di WHOOP: lo scambio dei token, col secret che sta qui.
 *
 * «Collega WHOOP», nell'app, e' un OAuth2 col codice
 * (`app/lib/salute/whoop/collegamento_whoop.dart`). WHOOP vuole che lo
 * scambio del codice e il rinnovo dei token portino il `client_secret`, e un
 * secret dentro un'app non e' un secret: un'app si smonta. Allora l'app
 * chiede qui, e qui si aggiungono `client_id` e `client_secret` e si gira la
 * domanda a WHOOP, cosi' com'e'. La risposta torna all'app cosi' come WHOOP
 * l'ha data.
 *
 *     POST /whoop/token   {grant_type: "authorization_code", code, redirect_uri, code_verifier?}
 *     POST /whoop/token   {grant_type: "refresh_token", refresh_token, scope?}
 *
 * Il corpo e' JSON — e' quello che manda l'app — o un modulo
 * (`application/x-www-form-urlencoded`), che e' come lo vuole WHOOP.
 *
 * Qui **non si tiene niente**: ne' i codici, ne' i token, ne' chi li ha
 * chiesti. I token stanno solo sul telefono. Nel registro vanno i conti e i
 * guasti, mai un pezzo di quello che passa.
 *
 * Due cose sole si lasciano passare, e quelle due si controllano:
 *
 *  - lo scambio del codice, e solo col ritorno dell'app (`gdahome://whoop`).
 *    Un codice preso da un'altra parte, con un altro ritorno, qui non si
 *    trasforma in token: WHOOP lo rifiuterebbe comunque, ma non si chiede
 *    nemmeno;
 *  - il rinnovo col `refresh_token`.
 *
 * La revoca no: l'app la chiede a WHOOP da se', col token dell'utente
 * (`DELETE /v2/user/access`), e li' il secret non serve.
 */

import { Freno } from "./freno.js";
import { daChi } from "./indirizzo.js";
import { RichiestaSbagliata } from "./segnalazioni.js";
import { byteDi, json } from "./sportello.js";

export const VIA_DEI_TOKEN = "/whoop/token";

/* Dove WHOOP scambia e rinnova. */
export const TOKEN_DI_WHOOP = "https://api.prod.whoop.com/oauth/oauth2/token";

/* L'unico ritorno che si accetta, di serie: quello scritto nell'app e nel
 * portale di WHOOP. */
export const RITORNO_DI_SERIE = "gdahome://whoop";

/* Un codice, un token e un verificatore sono poche centinaia di lettere: un
 * corpo di otto kilobyte e' gia' largo. */
export const CORPO_MASSIMO = 8 * 1024;
const CAMPO_MASSIMO = 2048;

/* Il verificatore del PKCE, com'e' scritto nella sua regola (RFC 7636): da 43
 * a 128 lettere fra queste. */
const VERIFICATORE = /^[A-Za-z0-9\-._~]{43,128}$/;
const SCOPE = /^[A-Za-z0-9_:. ]{1,200}$/;

/* Quante richieste in un'ora. Un telefono rinnova circa una volta l'ora — il
 * token d'accesso dura un'ora — e si collega una volta: sessanta da uno
 * stesso indirizzo bastano a una famiglia dietro lo stesso router, e fermano
 * chi prova a usare lo sportello come un rubinetto. Il tetto in tutto tiene
 * il client di GdAHome lontano dai limiti di WHOOP. */
export const RICHIESTE_PER_INDIRIZZO = 60;
export const RICHIESTE_IN_TUTTO = 6000;

/* Quanto si aspetta WHOOP: l'app ne aspetta venti. */
export const ATTESA_DI_WHOOP = 15_000;

const INTESTAZIONI_DEL_BROWSER = Object.freeze({
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "600",
});

export class SportelloDiWhoop {
  constructor({
    clientId = "",
    clientSecret = "",
    ritorno = RITORNO_DI_SERIE,
    dove = TOKEN_DI_WHOOP,
    freno = new Freno({ perChi: RICHIESTE_PER_INDIRIZZO, inTutto: RICHIESTE_IN_TUTTO }),
    attesa = ATTESA_DI_WHOOP,
    fetch: prendi = globalThis.fetch,
    registro = null,
  } = {}) {
    this.clientId = String(clientId || "").trim();
    this.clientSecret = String(clientSecret || "").trim();
    this.ritorno = String(ritorno || "").trim() || RITORNO_DI_SERIE;
    this.dove = String(dove || "").trim() || TOKEN_DI_WHOOP;
    this.freno = freno;
    this.attesa = attesa;
    this.prendi = prendi;
    this.registro = registro;
    /* Per `/salute`: quante richieste, quante fermate, quante WHOOP non ha
     * risposto. Mai chi, mai cosa. */
    this.conti = { richieste: 0, fermate: 0, senza_risposta: 0 };
  }

  /* Se lo sportello ha il suo client: senza, risponde e dice che non e'
   * configurato, invece di far finta. */
  get pronto() {
    return Boolean(this.clientId && this.clientSecret);
  }

  /* Se la via e' questa, risponde e torna `true`; se no `false`, e passa. */
  async forseServe(richiesta, risposta, via) {
    if (via !== VIA_DEI_TOKEN) return false;
    for (const [nome, valore] of Object.entries(INTESTAZIONI_DEL_BROWSER)) {
      risposta.setHeader(nome, valore);
    }
    if (richiesta.method === "OPTIONS") {
      risposta.writeHead(204);
      risposta.end();
      return true;
    }
    if (richiesta.method !== "POST") {
      risposta.setHeader("allow", "POST, OPTIONS");
      json(risposta, { errore: "solo-post" }, 405);
      return true;
    }
    if (!this.pronto) {
      risposta.setHeader("retry-after", "3600");
      json(
        risposta,
        {
          errore: "whoop-non-configurato",
          spiegazione: "Il collegamento a WHOOP non e' configurato su questo centralino.",
        },
        503,
      );
      return true;
    }
    this.conti.richieste += 1;
    if (!this.freno.concedi(daChi(richiesta))) {
      this.conti.fermate += 1;
      risposta.setHeader("retry-after", "600");
      json(
        risposta,
        { errore: "troppe-richieste", spiegazione: "Troppe richieste: riprova piu' tardi." },
        429,
      );
      return true;
    }

    let campi;
    try {
      campi = this._campi(await leggiIlCorpo(richiesta));
    } catch (errore) {
      if (errore instanceof RichiestaSbagliata) {
        json(risposta, { errore: errore.codice, spiegazione: errore.message }, errore.stato);
        return true;
      }
      throw errore;
    }

    /* Il client si aggiunge per ultimo: quello che arriva dall'app non lo
     * puo' cambiare. */
    const modulo = new URLSearchParams({
      ...campi,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    let daWhoop;
    let corpo;
    try {
      daWhoop = await this.prendi(this.dove, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body: modulo.toString(),
        redirect: "manual",
        signal: AbortSignal.timeout(this.attesa),
      });
      corpo = Buffer.from(await daWhoop.arrayBuffer());
    } catch (errore) {
      this.conti.senza_risposta += 1;
      /* Il nome dell'errore e basta: il messaggio di `fetch` puo' portarsi
       * dietro pezzi della richiesta, e la richiesta ha il secret. */
      this.registro?.attenzione?.(
        `WHOOP non risponde allo scambio dei token (${errore?.name || "errore"})`,
      );
      json(
        risposta,
        { errore: "whoop-non-risponde", spiegazione: "WHOOP non risponde: riprova fra poco." },
        502,
      );
      return true;
    }

    /* La risposta di WHOOP, cosi' com'e': lo stato, il tipo e il corpo. Mai
     * tenuta in nessuna cache di mezzo. */
    risposta.writeHead(daWhoop.status, {
      "content-type": daWhoop.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store",
      pragma: "no-cache",
      "content-length": corpo.length,
    });
    risposta.end(corpo);
    return true;
  }

  /* Solo i campi che servono, e solo nelle due forme permesse. Quello che non
   * e' qui non passa: nemmeno un `client_id` o un `client_secret` mandato
   * dall'app. */
  _campi(letto) {
    const stringa = (nome, { serve = true } = {}) => {
      const valore = letto[nome];
      if (valore === undefined || valore === null || valore === "") {
        if (serve) throw new RichiestaSbagliata("manca-un-campo", `Manca «${nome}».`, 400);
        return undefined;
      }
      if (typeof valore !== "string" || valore.length > CAMPO_MASSIMO) {
        throw new RichiestaSbagliata("campo-sbagliato", `«${nome}» non va bene.`, 400);
      }
      return valore;
    };
    const tipo = letto.grant_type;
    if (tipo === "authorization_code") {
      const code = stringa("code");
      const ritorno = stringa("redirect_uri");
      if (ritorno !== this.ritorno) {
        throw new RichiestaSbagliata(
          "ritorno-non-permesso",
          "Questo redirect_uri non e' quello dell'app.",
          400,
        );
      }
      const verificatore = stringa("code_verifier", { serve: false });
      if (verificatore !== undefined && !VERIFICATORE.test(verificatore)) {
        throw new RichiestaSbagliata("campo-sbagliato", "«code_verifier» non va bene.", 400);
      }
      return {
        grant_type: tipo,
        code,
        redirect_uri: ritorno,
        ...(verificatore !== undefined ? { code_verifier: verificatore } : {}),
      };
    }
    if (tipo === "refresh_token") {
      const rinnovo = stringa("refresh_token");
      const scope = stringa("scope", { serve: false });
      if (scope !== undefined && !SCOPE.test(scope)) {
        throw new RichiestaSbagliata("campo-sbagliato", "«scope» non va bene.", 400);
      }
      return {
        grant_type: tipo,
        refresh_token: rinnovo,
        ...(scope !== undefined ? { scope } : {}),
      };
    }
    throw new RichiestaSbagliata(
      "grant-non-permesso",
      "Qui si scambia un codice o si rinnova un token, e basta.",
      400,
    );
  }
}

/* Il corpo, JSON o modulo, col suo tetto. */
async function leggiIlCorpo(richiesta) {
  const testo = (await byteDi(richiesta, CORPO_MASSIMO)).toString("utf8");
  const tipo = String(richiesta.headers["content-type"] || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (tipo === "application/x-www-form-urlencoded") {
    return Object.fromEntries(new URLSearchParams(testo));
  }
  try {
    const letto = JSON.parse(testo);
    if (letto && typeof letto === "object" && !Array.isArray(letto)) return letto;
  } catch (_errore) {
    /* sotto */
  }
  throw new RichiestaSbagliata("non-json", "Il corpo non e' JSON.", 400);
}
