/* Octopus Energy Italia, dal ponte.
 *
 * E' il porto in JavaScript del modo di parlare con Octopus dell'integrazione
 * «Octopus Energy Italy» (https://github.com/samuelebistoletti/HomeAssistant-OctopusEnergyIT,
 * cartella `custom_components/octopus_energy_it`), licenza MIT: il testo e' in
 * `LICENZE.md`, accanto. Octopus parla GraphQL, sulla piattaforma Kraken: le
 * domande qui sotto sono quelle dell'integrazione, ristrette a quello che
 * serve alla linguetta Bollette.
 *
 * Le regole, le stesse di E.ON:
 *
 *   - **la password serve una volta.** Con email e password si chiede a
 *     Kraken un gettone; da li' in poi si tiene solo il gettone di rinnovo
 *     (`refreshToken`), e la password non si scrive da nessuna parte.
 *     L'integrazione originale tiene la password per rientrare quando vuole;
 *     qui no: quando il rinnovo scade, la scheda dice «da ricollegare».
 *   - **solo letture**: le domande sono un elenco chiuso, e nessuna cambia
 *     niente sul conto.
 *   - **nel registro niente**: ne' le risposte di Octopus ne' i gettoni.
 */

export const API = "https://api.oeit-kraken.energy/v1/graphql/";
const ATTESA = 20_000;
/* Il gettone si rinnova cinque minuti prima che scada. */
const MARGINE = 300_000;

export class ErroreOctopus extends Error {}
/** Le credenziali o il rinnovo non valgono piu': bisogna ricollegarsi. */
export class AccessoNegato extends ErroreOctopus {}

/* I codici di Kraken che vogliono dire «chi sei?»: credenziali sbagliate
 * (1138), gettone scaduto o non valido (1124, 1111, 1112), rinnovo scaduto
 * (1135, 1134). */
const NON_SEI_TU = new Set([
  "KT-CT-1111",
  "KT-CT-1112",
  "KT-CT-1124",
  "KT-CT-1134",
  "KT-CT-1135",
  "KT-CT-1138",
]);
const GETTONE_SCADUTO = "KT-CT-1124";

const ENTRA = `mutation entra($input: ObtainJSONWebTokenInput!) {
  obtainKrakenToken(input: $input) { token payload refreshToken refreshExpiresIn }
}`;

const CONTI = `query conti {
  viewer { accounts { number ledgers { balance ledgerType } } }
}`;

const CONTO = `query conto($accountNumber: String!) {
  account(accountNumber: $accountNumber) {
    ledgers { balance ledgerType }
    properties {
      id
      electricitySupplyPoints {
        pod
        status
        product {
          __typename
          ... on ElectricityProductType {
            displayName
            validTo
            prices { consumptionCharge consumptionChargeUnits annualStandingCharge }
          }
        }
        agreements(first: 10) {
          edges { node { validFrom validTo isActive } }
        }
      }
    }
  }
}`;

const LETTURE = `query letture($propertyId: ID!, $pod: String!, $last: Int) {
  property(id: $propertyId) {
    measurements(
      last: $last
      utilityFilters: [
        {
          electricityFilters: {
            marketSupplyPointId: $pod
            readingFrequencyType: POINT_IN_TIME
            readingDirection: CONSUMPTION
          }
        }
      ]
    ) {
      edges { node { value unit readAt } }
    }
  }
}`;

const numero = (valore) => {
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

const giorno = (valore) => {
  const testo = String(valore || "");
  return /^\d{4}-\d{2}-\d{2}/.test(testo) ? testo.slice(0, 10) : null;
};

function scadenzaDelGettone(payload, adesso) {
  const exp = numero(payload?.exp);
  return exp ? exp * 1000 : adesso + 3_600_000;
}

/* Una domanda a Kraken. Gli errori di GraphQL arrivano con 200: si guardano
 * dentro, e quelli di «chi sei?» diventano `AccessoNegato`. */
async function domanda(prendi, query, variabili, gettone = "") {
  let risposta;
  try {
    risposta = await prendi(API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(gettone ? { authorization: gettone } : {}),
      },
      body: JSON.stringify({ query, variables: variabili || {} }),
      signal: AbortSignal.timeout(ATTESA),
    });
  } catch (_errore) {
    throw new ErroreOctopus("rete");
  }
  if (risposta.status === 401 || risposta.status === 403) throw new AccessoNegato("gettone");
  if (risposta.status < 200 || risposta.status >= 300)
    throw new ErroreOctopus(`${risposta.status}`);
  let dati;
  try {
    dati = JSON.parse(await risposta.text());
  } catch (_errore) {
    throw new ErroreOctopus("risposta illeggibile");
  }
  const errori = Array.isArray(dati?.errors) ? dati.errors : [];
  if (errori.length) {
    const codici = errori.map((e) => String(e?.extensions?.errorCode || ""));
    const errore = codici.some((c) => NON_SEI_TU.has(c))
      ? new AccessoNegato(codici.find((c) => NON_SEI_TU.has(c)))
      : new ErroreOctopus(codici.find(Boolean) || "graphql");
    errore.codice = codici.find(Boolean) || "";
    throw errore;
  }
  return dati?.data || {};
}

/** Entra con email e password: tornano i gettoni, la password resta qui. */
export async function entra(
  email,
  password,
  { prendi = globalThis.fetch, adesso = () => Date.now() } = {},
) {
  const dati = await domanda(prendi, ENTRA, { input: { email, password } });
  const fatto = dati?.obtainKrakenToken;
  if (!fatto?.token || !fatto?.refreshToken) throw new AccessoNegato("niente gettoni");
  return {
    token: String(fatto.token),
    refreshToken: String(fatto.refreshToken),
    scade: scadenzaDelGettone(fatto.payload, adesso()),
  };
}

/** Il saldo in euro del conto della luce (Kraken lo tiene in centesimi). */
export function ilSaldo(ledgers) {
  const elenco = Array.isArray(ledgers) ? ledgers : [];
  const luce =
    elenco.find((l) => String(l?.ledgerType || "").includes("ELECTRICITY")) || elenco[0] || null;
  const centesimi = numero(luce?.balance);
  return centesimi === null ? null : Math.round(centesimi) / 100;
}

/** La fornitura della luce di un conto: il POD, il prezzo, la fine dell'offerta. */
export function laFornitura(conto) {
  for (const casa of Array.isArray(conto?.properties) ? conto.properties : []) {
    for (const punto of Array.isArray(casa?.electricitySupplyPoints)
      ? casa.electricitySupplyPoints
      : []) {
      if (!punto?.pod) continue;
      const prodotto = punto.product || {};
      const accordi = (punto.agreements?.edges || []).map((e) => e?.node).filter(Boolean);
      const attivo = accordi.find((a) => a.isActive) || accordi[0] || null;
      return {
        casa: String(casa.id || ""),
        pod: String(punto.pod),
        prezzo: numero(prodotto.prices?.consumptionCharge),
        fineOfferta: giorno(attivo?.validTo) || giorno(prodotto.validTo),
      };
    }
  }
  return null;
}

/** Il consumo fra le ultime due letture del contatore, e il giorno della seconda. */
export function lUltimoConsumo(letture) {
  const elenco = (Array.isArray(letture) ? letture : [])
    .map((l) => ({ valore: numero(l?.value), alle: String(l?.readAt || "") }))
    .filter((l) => l.valore !== null && l.alle)
    .sort((a, b) => (a.alle < b.alle ? -1 : 1));
  if (elenco.length < 2) return null;
  const [prima, dopo] = elenco.slice(-2);
  const consumo = dopo.valore - prima.valore;
  if (consumo < 0) return null;
  return { totale: Math.round(consumo * 1000) / 1000, giorno: giorno(dopo.alle) };
}

/* Le letture coi gettoni di chi e' entrato. `rinnovati` si chiama coi gettoni
 * nuovi ogni volta che si rinnovano: vanno scritti subito. */
export class ClientOctopus {
  constructor({
    gettoni,
    rinnovati = () => {},
    prendi = globalThis.fetch,
    adesso = () => Date.now(),
  }) {
    this.accesso = String(gettoni?.token || "");
    this.rinnovo = String(gettoni?.refreshToken || "");
    this.scade = Number(gettoni?.scade) || 0;
    this.rinnovati = rinnovati;
    this.prendi = prendi;
    this.adesso = adesso;
  }

  async _rinnova() {
    if (!this.rinnovo) throw new AccessoNegato("niente rinnovo");
    const dati = await domanda(this.prendi, ENTRA, { input: { refreshToken: this.rinnovo } });
    const fatto = dati?.obtainKrakenToken;
    if (!fatto?.token) throw new AccessoNegato("rinnovo vuoto");
    this.accesso = String(fatto.token);
    if (fatto.refreshToken) this.rinnovo = String(fatto.refreshToken);
    this.scade = scadenzaDelGettone(fatto.payload, this.adesso());
    await this.rinnovati({ token: this.accesso, refreshToken: this.rinnovo, scade: this.scade });
  }

  async _chiedi(query, variabili, riprova = true) {
    if (!this.accesso || (this.scade && this.adesso() >= this.scade - MARGINE))
      await this._rinnova();
    try {
      return await domanda(this.prendi, query, variabili, this.accesso);
    } catch (errore) {
      /* Il gettone e' scaduto prima del previsto: si rinnova una volta. */
      if (riprova && errore instanceof AccessoNegato && errore.codice === GETTONE_SCADUTO) {
        await this._rinnova();
        return this._chiedi(query, variabili, false);
      }
      throw errore;
    }
  }

  async conti() {
    const dati = await this._chiedi(CONTI, {});
    return (dati?.viewer?.accounts || [])
      .filter((c) => c?.number)
      .map((c) => ({ numero: String(c.number), saldo: ilSaldo(c.ledgers) }));
  }

  async conto(numeroDelConto) {
    const dati = await this._chiedi(CONTO, { accountNumber: numeroDelConto });
    const conto = dati?.account || {};
    return { saldo: ilSaldo(conto.ledgers), fornitura: laFornitura(conto) };
  }

  async letture(casa, pod) {
    const dati = await this._chiedi(LETTURE, { propertyId: casa, pod, last: 2 });
    return (dati?.property?.measurements?.edges || []).map((e) => e?.node).filter(Boolean);
  }
}
