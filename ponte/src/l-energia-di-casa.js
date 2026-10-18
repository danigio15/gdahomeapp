/* Il taccuino dell'energia: quanto ha preso dal sole, quanto dalla rete, e
 * quanto e' costato.
 *
 * «Quando un elettrodomestico ha terminato il ciclo mostra anche per quanto
 * tempo e' stato in funzione e quanto e' stato il costo, ovviamente in base
 * al fotovoltaico se presente.» E il riepilogo della sera: quanti kWh ha fatto
 * il sole, quanti ne sono rimasti in casa, quanto si e' risparmiato.
 *
 * Nessuno di questi numeri sta in Home Assistant gia' fatto: il costo di un
 * lavaggio dipende da quanto sole c'era minuto per minuto mentre girava, e
 * dalla fascia in cui e' caduto ogni minuto preso dalla rete. Qui si annotano,
 * a ogni battito della sentinella (mezzo minuto), le potenze di adesso — sole,
 * rete, casa, e ogni elettrodomestico che gira — e se ne fanno i conti.
 *
 * ─── La regola della quota di sole ────────────────────────────────────────
 *
 * Un minuto di lavatrice a 2000 W, con la casa che preleva 500 W dalla rete:
 * 500 W li paga la rete, 1500 W no. Prima si guarda la rete — e' la cosa che
 * si paga, ed e' il sensore che ce l'hanno quasi tutti — e il resto viene da
 * casa: dal sole finche' il sole c'e', dalla batteria per quello che il sole
 * non copre. Chi non ha un sensore della rete ma ha sole e casa si fa il conto
 * dell'eccedenza (sole meno il resto della casa); chi non ha niente paga
 * tutto alla rete, che e' la risposta prudente.
 *
 * Il verso della batteria qui non serve, ed e' una scelta: meta' dei sensori
 * scrive positivo quando si carica e meta' quando si scarica, e un conto che
 * dipendesse da quel segno sbaglierebbe a meta' delle case senza dirlo.
 *
 * ─── Cosa sta sul disco ───────────────────────────────────────────────────
 *
 * `/data/energia-di-casa.json`: la giornata in corso (cosi' un riavvio
 * dell'add-on alle tre del pomeriggio non azzera il riepilogo della sera) e i
 * totali dei giorni passati — un anno — per «+12% su ieri» e per i record.
 * Solo numeri: niente nomi, niente entita'.
 */

import { join } from "node:path";

import { Archivio } from "./archivio.js";
import {
  fasciaInVigore,
  nomeDellaFascia,
  normalizzaLeFasce,
} from "../plancia/src/core/fasce-della-tariffa.js";
import { wattsFromState } from "../plancia/src/core/signed-energy.js";

const MINUTO = 60 * 1000;
const ORA = 60 * MINUTO;

/* Fra due battiti non si contano piu' di due minuti: un ponte fermo per
 * un'ora non sa cosa e' successo in quell'ora, e moltiplicare l'ultima
 * potenza vista per sessanta minuti inventerebbe un conto. */
const PASSO_MASSIMO = 2 * MINUTO;

/* Sopra questa potenza un elettrodomestico gira (la stessa soglia della
 * sentinella). */
export const GIRA_DA_WATT = 15;

/* Quanti giorni passati si tengono: un anno, per i record del mese e
 * dell'anno. */
const GIORNI_TENUTI = 400;

/* Quanti punti al piu' ha la curva di un ciclo nella scheda della notifica. */
export const PUNTI_DELLA_CURVA = 32;

/* Le caselle della plancia da cui si leggono le potenze e i contatori. Sono
 * le stesse della pagina Energia (`core/energy-projection.js`). */
export const CASELLE_DELL_ENERGIA = Object.freeze({
  sole: "dm.energy_potenza_fotovoltaico",
  casa: "dm.energy_potenza_consumo_casa",
  rete: "dm.energy_potenza_scambio_rete",
  carica: "dm.energy_stato_carica_batteria",
  soleOggi: "dm.energy_produzione_solare_oggi",
  casaOggi: "dm.energy_consumo_casa_oggi",
  preseOggi: "dm.energy_energia_prelevata_oggi",
  cedutiOggi: "dm.energy_energia_immessa_oggi",
});

const numero = (valore) => {
  const n = Number(String(valore ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const kwhDi = (stato) => {
  const n = numero(stato?.state);
  if (n === null) return null;
  const unita = String(stato?.attributes?.unit_of_measurement || "").toLowerCase();
  if (unita === "wh") return n / 1000;
  if (unita === "mwh") return n * 1000;
  return n;
};

const arrotonda = (valore, cifre = 2) => {
  if (valore === null || valore === undefined || !Number.isFinite(valore)) return null;
  const f = 10 ** cifre;
  return Math.round(valore * f) / f;
};

const oraDi = (istante) => {
  const d = new Date(istante);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/* Il giorno di casa, «2026-10-17», nell'ora locale del ponte. */
export function giornoDi(istante) {
  const d = new Date(istante);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ─── Il prezzo ─────────────────────────────────────────────────────────── */

/**
 * Il prezzo della corrente in quell'istante, letto dalle impostazioni della
 * plancia: la fascia in vigore (`cd_fasce_kwh`), e se la fascia non ha prezzo
 * o le fasce sono spente la tariffa unica (`cd_costo_kwh`: un numero o
 * un'entita'). `{prezzo: null}` quando non c'e' niente: allora il costo non
 * si dice, invece di inventarlo.
 */
export function prezzoAllOra({ fasce, costo, stato = () => null }, istante) {
  let config = fasce;
  if (typeof config === "string") {
    try {
      config = JSON.parse(config);
    } catch (_errore) {
      config = null;
    }
  }
  const normali = normalizzaLeFasce(config || {});
  const quale = fasciaInVigore(normali, new Date(istante));
  const suo = quale >= 0 ? normali.voci[quale]?.prezzo : null;
  if (suo) return { prezzo: suo, fascia: nomeDellaFascia(quale), indice: quale };
  let unica = null;
  const scritto = typeof costo === "string" ? costo.trim() : costo;
  if (typeof scritto === "number") unica = scritto > 0 ? scritto : null;
  else if (typeof scritto === "string" && /^[a-z_]+\.[a-z0-9_]+$/.test(scritto))
    unica = numero(stato(scritto)?.state);
  else if (typeof scritto === "string") unica = numero(scritto.replace(/^"|"$/g, ""));
  if (unica !== null && unica > 0 && unica < 10) return { prezzo: unica, fascia: "", indice: -1 };
  return { prezzo: null, fascia: "", indice: -1 };
}

/**
 * La fascia che costa meno, quando ce n'e' piu' d'una con un prezzo: per il
 * consiglio «partita dopo le 23 sarebbe costata…».
 */
export function fasciaPiuBassa(fasce) {
  let config = fasce;
  if (typeof config === "string") {
    try {
      config = JSON.parse(config);
    } catch (_errore) {
      config = null;
    }
  }
  const normali = normalizzaLeFasce(config || {});
  let migliore = null;
  normali.voci.forEach((voce, indice) => {
    if (voce.prezzo === null) return;
    if (!migliore || voce.prezzo < migliore.prezzo)
      migliore = { indice, prezzo: voce.prezzo, dalle: voce.dalle, nome: nomeDellaFascia(indice) };
  });
  return migliore;
}

/* ─── Quanto di un elettrodomestico viene dal sole ─────────────────────── */

/**
 * Come si divide la potenza di un elettrodomestico in quell'istante: watt
 * dal sole, dalla batteria, dalla rete. Vedi la regola in cima al file.
 *
 * `rete` col segno: positivo e' prelievo (il verso del runtime della plancia).
 */
export function quoteDelMomento({ app, sole = null, casa = null, rete = null }) {
  const w = Math.max(0, Number(app) || 0);
  if (!w) return { sole: 0, batteria: 0, rete: 0 };
  if (rete !== null && Number.isFinite(rete)) {
    const dallaRete = Math.min(w, Math.max(0, rete));
    const resto = w - dallaRete;
    /* Senza un sensore del sole non si sa se il resto e' sole o batteria: si
     * dice sole, che e' quello che si vede di giorno in quasi tutte le case
     * che non prelevano. */
    const dalSole = sole === null ? resto : Math.min(resto, Math.max(0, sole));
    return { sole: dalSole, batteria: resto - dalSole, rete: dallaRete };
  }
  if (sole !== null && casa !== null) {
    const eccedenza = sole - Math.max(0, casa - w);
    const dalSole = Math.min(w, Math.max(0, eccedenza));
    return { sole: dalSole, batteria: 0, rete: w - dalSole };
  }
  return { sole: 0, batteria: 0, rete: w };
}

/* La curva di un ciclo ridotta a `punti` valori: medie dei pezzi uguali. */
export function curvaCompatta(campioni, punti = PUNTI_DELLA_CURVA) {
  const elenco = Array.isArray(campioni) ? campioni : [];
  if (!elenco.length) return [];
  if (elenco.length <= punti) return elenco.map((v) => Math.round(v));
  const fuori = [];
  for (let i = 0; i < punti; i += 1) {
    const da = Math.floor((i * elenco.length) / punti);
    const a = Math.max(da + 1, Math.floor(((i + 1) * elenco.length) / punti));
    const pezzo = elenco.slice(da, a);
    fuori.push(Math.round(pezzo.reduce((s, v) => s + v, 0) / pezzo.length));
  }
  return fuori;
}

function cicloNuovo(ora) {
  return {
    da: ora,
    ultimo: ora,
    wh: 0,
    whSole: 0,
    whBatteria: 0,
    whRete: 0,
    euroRete: 0,
    euroSenza: 0,
    conPrezzo: true,
    w: [],
    s: [],
  };
}

function giornataNuova(giorno) {
  return {
    d: giorno,
    /* Wh integrati: sole, casa, presi, ceduti, sole usato in casa. */
    sole: 0,
    casa: 0,
    presi: 0,
    ceduti: 0,
    usato: 0,
    /* Euro integrati: la rete pagata, e il sole usato a prezzo di rete. */
    euroRete: 0,
    risparmio: 0,
    /* Wh per ora del giorno. */
    p: Array(24).fill(0),
    c: Array(24).fill(0),
    /* La rete per fascia: Wh per indice di fascia. */
    perFascia: {},
    picco: 0,
    piccoIl: 0,
    /* I cicli finiti oggi, per «la lavatrice e' andata col sole». */
    cicli: [],
    /* Ogni carico che si misura, per «chi ha consumato di piu'»: Wh, quanti
     * dal sole, dalla batteria e dalla rete, e gli euro della rete. Come i
     * cicli, ma per tutta la giornata e anche per cio' che non fa cicli (la
     * pompa di calore, il forno). Le chiavi sono entita': restano in casa. */
    perCarico: {},
  };
}

/* Quanti carichi al piu' si contano in un giorno: una casa vera ne ha una
 * ventina, e un elenco senza fine sul disco non serve a nessuno. */
const CARICHI_AL_MASSIMO = 80;
/* Quanti se ne tengono nei giorni passati, i piu' grossi. */
export const CARICHI_NEI_GIORNI = 5;

/* I carichi di una giornata, dal piu' grosso: `[{id, kwh, eur, sole}]`.
 * `eur` e' `null` quando non c'era mai un prezzo; `sole` e' la quota (0–1)
 * venuta dal sole. Sotto i 10 Wh non vale la pena dirlo. */
export function carichiDellaGiornata(perCarico = {}) {
  return Object.entries(perCarico || {})
    .filter(([, c]) => c && c.wh >= 10)
    .map(([id, c]) => ({
      id,
      kwh: arrotonda(c.wh / 1000, 2),
      eur: c.conPrezzo ? arrotonda(c.eur, 2) : null,
      sole: c.wh > 0 ? arrotonda(c.sole / c.wh, 2) : 0,
    }))
    .sort((a, b) => b.kwh - a.kwh || a.id.localeCompare(b.id));
}

/**
 * Il taccuino. `letture()` dice le potenze di adesso; `prezzo(istante)` il
 * prezzo di quel momento. Tutto il resto lo tiene lui.
 */
export class TaccuinoDellEnergia {
  constructor({ cartella = "", adesso = () => Date.now(), registro = null } = {}) {
    this._suDisco = Boolean(cartella);
    this.archivio = new Archivio(cartella ? join(cartella, "energia-di-casa.json") : "", {
      oggi: null,
      giorni: [],
    });
    if (!Array.isArray(this.archivio.dati.giorni)) this.archivio.dati.giorni = [];
    this.adesso = adesso;
    this.registro = registro;
    /** I cicli aperti, per entita' della potenza. */
    this.cicli = new Map();
    this._ultimo = null;
    this._scrittoIl = 0;
  }

  get oggi() {
    return this.archivio.dati.oggi;
  }

  get giorni() {
    return this.archivio.dati.giorni;
  }

  /* La giornata di oggi, nuova se il giorno e' cambiato: quella di ieri
   * finisce fra i giorni passati con i suoi totali. */
  _laGiornata(ora) {
    const giorno = giornoDi(ora);
    const prima = this.archivio.dati.oggi;
    if (prima?.d === giorno) return prima;
    if (prima?.d) this._chiudiLaGiornata(prima);
    const nuova = giornataNuova(giorno);
    this.archivio.dati.oggi = nuova;
    return nuova;
  }

  _chiudiLaGiornata(g) {
    const giorni = this.archivio.dati.giorni.filter((uno) => uno?.d !== g.d);
    giorni.push({
      d: g.d,
      pk: arrotonda((g.soleOggiLetto ?? g.sole / 1000) || 0, 2),
      casa: arrotonda((g.casaOggiLetto ?? g.casa / 1000) || 0, 2),
      eur: arrotonda(g.euroRete, 2),
      ris: arrotonda(g.risparmio, 2),
      /* I piu' grossi, per «la settimana»: [id, kWh, €, quota di sole]. */
      top: carichiDellaGiornata(g.perCarico)
        .slice(0, CARICHI_NEI_GIORNI)
        .map((c) => [c.id, c.kwh, c.eur, c.sole]),
    });
    giorni.sort((a, b) => (a.d < b.d ? -1 : 1));
    this.archivio.dati.giorni = giorni.slice(-GIORNI_TENUTI);
  }

  /**
   * Un campione. `letture`: `{sole, casa, rete, apparecchi: {id: watt}}`, in
   * watt, `null` dove non c'e' un sensore. `prezzo(istante)` → `{prezzo,
   * indice}`. I contatori del giorno (`soleOggi`…, in kWh) si ricordano cosi'
   * come sono: alla fine valgono loro, se ci sono.
   */
  campiona(letture = {}, prezzo = () => ({ prezzo: null, indice: -1 })) {
    const ora = this.adesso();
    const g = this._laGiornata(ora);
    const dt = this._ultimo === null ? 0 : Math.min(PASSO_MASSIMO, Math.max(0, ora - this._ultimo));
    this._ultimo = ora;
    const { prezzo: euro, indice } = prezzo(ora) || {};
    const conPrezzo = euro !== null && euro !== undefined;
    const ore = dt / ORA;

    const sole = letture.sole ?? null;
    const rete = letture.rete ?? null;
    let casa = letture.casa ?? null;
    if (casa === null && sole !== null && rete !== null) casa = Math.max(0, sole + rete);

    if (dt > 0) {
      const ora24 = new Date(ora).getHours();
      if (sole !== null) {
        g.sole += Math.max(0, sole) * ore;
        g.p[ora24] += Math.max(0, sole) * ore;
      }
      if (casa !== null) {
        g.casa += Math.max(0, casa) * ore;
        g.c[ora24] += Math.max(0, casa) * ore;
      }
      if (rete !== null) {
        const presi = Math.max(0, rete) * ore;
        g.presi += presi;
        g.ceduti += Math.max(0, -rete) * ore;
        if (conPrezzo) g.euroRete += (presi / 1000) * euro;
        if (indice !== undefined && indice >= 0)
          g.perFascia[indice] = (g.perFascia[indice] || 0) + presi;
      } else if (casa !== null && sole === null) {
        /* Niente sole e niente rete: tutta la casa e' rete. */
        const presi = Math.max(0, casa) * ore;
        g.presi += presi;
        if (conPrezzo) g.euroRete += (presi / 1000) * euro;
        if (indice !== undefined && indice >= 0)
          g.perFascia[indice] = (g.perFascia[indice] || 0) + presi;
      }
      if (sole !== null) {
        const ceduti = rete !== null ? Math.max(0, -rete) : 0;
        const usato = Math.max(0, sole - ceduti) * ore;
        g.usato += usato;
        if (conPrezzo) g.risparmio += (usato / 1000) * euro;
      }
    }
    if (sole !== null && sole > g.picco) {
      g.picco = sole;
      g.piccoIl = ora;
    }
    for (const chiave of ["soleOggi", "casaOggi", "preseOggi", "cedutiOggi"])
      if (letture[chiave] !== null && letture[chiave] !== undefined)
        g[`${chiave}Letto`] = letture[chiave];

    /* Ogni carico misurato, tutto il giorno: la stessa divisione fra sole,
     * batteria e rete dei cicli. `carichi` (tutte le potenze della plancia)
     * quando c'e', altrimenti gli elettrodomestici. */
    if (dt > 0) {
      if (!g.perCarico || typeof g.perCarico !== "object") g.perCarico = {};
      const carichi = letture.carichi || letture.apparecchi || {};
      for (const [id, w] of Object.entries(carichi)) {
        if (w === null || w === undefined || !(w > 0)) continue;
        let c = g.perCarico[id];
        if (!c) {
          if (Object.keys(g.perCarico).length >= CARICHI_AL_MASSIMO) continue;
          c = g.perCarico[id] = { wh: 0, sole: 0, batt: 0, rete: 0, eur: 0, conPrezzo: false };
        }
        const q = quoteDelMomento({ app: w, sole, casa, rete });
        c.wh += w * ore;
        c.sole += q.sole * ore;
        c.batt += q.batteria * ore;
        c.rete += q.rete * ore;
        if (conPrezzo) {
          c.eur += ((q.rete * ore) / 1000) * euro;
          c.conPrezzo = true;
        }
      }
    }

    /* Gli elettrodomestici: un ciclo si apre sopra la soglia e si integra
     * finche' qualcuno non lo chiude (`chiudiIlCiclo`). */
    for (const [id, w] of Object.entries(letture.apparecchi || {})) {
      if (w === null || w === undefined) continue;
      let ciclo = this.cicli.get(id);
      if (!ciclo) {
        if (w < GIRA_DA_WATT) continue;
        ciclo = cicloNuovo(ora);
        this.cicli.set(id, ciclo);
        continue;
      }
      /* Dodici ore non sono un lavaggio: e' una presa che resta accesa, e il
       * suo «ciclo» non finira' mai. Si lascia andare. */
      if (ora - ciclo.da > 12 * ORA) {
        this.cicli.delete(id);
        continue;
      }
      const passo = Math.min(PASSO_MASSIMO, Math.max(0, ora - ciclo.ultimo)) / ORA;
      ciclo.ultimo = ora;
      const q = quoteDelMomento({ app: w, sole, casa, rete });
      ciclo.wh += Math.max(0, w) * passo;
      ciclo.whSole += q.sole * passo;
      ciclo.whBatteria += q.batteria * passo;
      ciclo.whRete += q.rete * passo;
      if (conPrezzo) {
        ciclo.euroRete += ((q.rete * passo) / 1000) * euro;
        ciclo.euroSenza += ((Math.max(0, w) * passo) / 1000) * euro;
      } else ciclo.conPrezzo = false;
      ciclo.w.push(Math.max(0, w));
      ciclo.s.push(q.sole);
      /* Un ciclo lungo tiene al piu' mille punti: dimezzati, la forma resta. */
      if (ciclo.w.length > 1000) {
        ciclo.w = curvaCompatta(ciclo.w, 500);
        ciclo.s = curvaCompatta(ciclo.s, 500);
      }
    }
    if (ora - this._scrittoIl >= 5 * MINUTO) this.scrivi();
  }

  /** Se per quell'entita' c'e' un ciclo aperto. */
  haUnCiclo(id) {
    return this.cicli.has(id);
  }

  /**
   * Chiude il ciclo di quell'entita' e ne dice i conti, o `null` se non c'era
   * (o era troppo poco per dirne qualcosa). `finitoIl`: quando la potenza e'
   * scesa davvero — la sentinella aspetta cinque minuti per esserne sicura,
   * e quei cinque minuti non sono lavaggio.
   */
  chiudiIlCiclo(id, { finitoIl = null, prezzoMigliore = null } = {}) {
    const ciclo = this.cicli.get(id);
    this.cicli.delete(id);
    if (!ciclo || ciclo.wh < 1) return null;
    const a = finitoIl && finitoIl > ciclo.da ? finitoIl : ciclo.ultimo;
    const kwh = ciclo.wh / 1000;
    const sole = ciclo.wh > 0 ? ciclo.whSole / ciclo.wh : 0;
    const batteria = ciclo.wh > 0 ? ciclo.whBatteria / ciclo.wh : 0;
    const fuori = {
      da: oraDi(ciclo.da),
      a: oraDi(a),
      min: Math.max(1, Math.round((a - ciclo.da) / MINUTO)),
      kwh: arrotonda(kwh, 2),
      sole: arrotonda(sole, 2),
      batt: arrotonda(batteria, 2),
      rkwh: arrotonda(ciclo.whRete / 1000, 2),
      eur: ciclo.conPrezzo ? arrotonda(ciclo.euroRete, 2) : null,
      reur: ciclo.conPrezzo ? arrotonda(ciclo.euroRete, 2) : null,
      senza: ciclo.conPrezzo ? arrotonda(ciclo.euroSenza, 2) : null,
      w: curvaCompatta(ciclo.w),
      s: curvaCompatta(ciclo.s),
      /* Partito nella fascia che costa meno, quanto sarebbe costato: solo se
       * il risparmio c'e' davvero (almeno il dieci per cento e un centesimo). */
      meglio: null,
    };
    if (prezzoMigliore && ciclo.conPrezzo && kwh > 0) {
      const costerebbe = (ciclo.whRete / 1000) * prezzoMigliore.prezzo;
      if (fuori.reur !== null && fuori.reur - costerebbe >= 0.01 && costerebbe <= fuori.reur * 0.9)
        fuori.meglio = {
          eur: arrotonda(costerebbe, 2),
          dalle: `${String(Math.floor(prezzoMigliore.dalle / 60)).padStart(2, "0")}:${String(prezzoMigliore.dalle % 60).padStart(2, "0")}`,
          fascia: prezzoMigliore.nome,
        };
    }
    const g = this._laGiornata(this.adesso());
    g.cicli.push({ id, kwh: fuori.kwh, sole: fuori.sole, eur: fuori.eur });
    if (g.cicli.length > 40) g.cicli.splice(0, g.cicli.length - 40);
    return fuori;
  }

  /** Lascia stare un ciclo che non era un ciclo (un'accensione breve). */
  dimentica(id) {
    this.cicli.delete(id);
  }

  /**
   * La giornata, per il riepilogo della sera. I contatori di Home Assistant
   * valgono piu' dell'integrale quando ci sono: il ponte puo' essere stato
   * spento per un'ora, il contatore no.
   */
  laGiornata() {
    const g = this.archivio.dati.oggi;
    if (!g) return null;
    const letto = (chiave, integrato) => {
      const v = g[`${chiave}Letto`];
      return v !== undefined && v !== null && v >= 0 ? v : integrato / 1000;
    };
    const sole = g.soleOggiLetto ?? (g.sole > 0 ? g.sole / 1000 : null);
    const ceduti = letto("cedutiOggi", g.ceduti);
    const presi = letto("preseOggi", g.presi);
    const casa = letto("casaOggi", g.casa);
    /* Gli euro si scalano sul contatore quando il contatore c'e': il prezzo
     * per minuto viene dall'integrale, la quantita' dal contatore. */
    const scala = (euro, integrato, vero) =>
      integrato > 0 && vero !== null ? euro * (vero / (integrato / 1000)) : euro;
    const usato = sole !== null ? Math.max(0, sole - (ceduti || 0)) : null;
    return {
      d: g.d,
      sole: sole !== null && sole > 0.05 ? arrotonda(sole, 1) : null,
      casa: casa > 0 ? arrotonda(casa, 1) : null,
      presi: arrotonda(presi, 1),
      ceduti: arrotonda(ceduti, 1),
      usato: usato !== null ? arrotonda(usato, 1) : null,
      quotaInCasa: sole && usato !== null ? arrotonda(Math.min(1, usato / sole), 2) : null,
      euroRete: arrotonda(scala(g.euroRete, g.presi, presi), 2),
      risparmio: arrotonda(scala(g.risparmio, g.usato, usato), 2),
      picco: g.picco > 0 ? arrotonda(g.picco / 1000, 1) : null,
      piccoIl: g.piccoIl ? oraDi(g.piccoIl) : null,
      p: g.p.map((wh) => Math.round(wh / 100)),
      c: g.c.map((wh) => Math.round(wh / 100)),
      perFascia: Object.fromEntries(
        Object.entries(g.perFascia).map(([k, wh]) => [k, arrotonda(wh / 1000, 1)]),
      ),
      cicli: g.cicli.slice(),
      carichi: carichiDellaGiornata(g.perCarico),
    };
  }

  /** I totali dei giorni passati (senza oggi). */
  giorniPassati() {
    return this.archivio.dati.giorni.slice();
  }

  scrivi() {
    this._scrittoIl = this.adesso();
    if (!this._suDisco) return;
    try {
      this.archivio.salva();
    } catch (errore) {
      this.registro?.attenzione?.(
        `il taccuino dell'energia non si scrive: ${errore?.message || errore}`,
      );
    }
  }
}

/**
 * I carichi che la plancia misura: elettrodomestici e carichi della pagina
 * Energia, ognuno con l'entita' della sua potenza e il nome che gli ha dato
 * chi abita. `[{id, nome}]`, senza doppioni. Si legge da
 * `dm_dashboard_state` cosi' com'e' salvato (oggetto o testo).
 */
export function carichiDellaPlancia(valori = {}) {
  let stato = valori?.dm_dashboard_state;
  if (typeof stato === "string") {
    try {
      stato = JSON.parse(stato);
    } catch (_errore) {
      stato = null;
    }
  }
  const sezioni = stato && typeof stato === "object" ? stato.sections || {} : {};
  const visti = new Set();
  const fuori = [];
  for (const sezione of ["appliances", "loads"]) {
    const elenco = Array.isArray(sezioni[sezione]) ? sezioni[sezione] : [];
    for (const voce of elenco) {
      const id = String(voce?.power_entity || voce?.power || "").trim();
      if (!/^[a-z_]+\.[a-z0-9_]+$/.test(id) || visti.has(id)) continue;
      visti.add(id);
      fuori.push({ id, nome: String(voce?.name || voce?.report_label || "").trim() });
    }
  }
  return fuori;
}

/**
 * Le potenze di adesso, lette dalle caselle della plancia. `risolvi(casella)`
 * → entita'; `stato(entita)` → `{state, attributes}`.
 */
export function letturaDellEnergia(risolvi, stato) {
  const leggi = (casella, comeKwh = false) => {
    const id = risolvi(casella);
    if (!id) return null;
    const s = stato(id);
    if (!s || ["unavailable", "unknown", ""].includes(String(s.state))) return null;
    return comeKwh ? kwhDi(s) : wattsFromState(s);
  };
  const c = CASELLE_DELL_ENERGIA;
  return {
    sole: leggi(c.sole),
    casa: leggi(c.casa),
    rete: leggi(c.rete),
    carica: (() => {
      const id = risolvi(c.carica);
      return id ? numero(stato(id)?.state) : null;
    })(),
    soleOggi: leggi(c.soleOggi, true),
    casaOggi: leggi(c.casaOggi, true),
    preseOggi: leggi(c.preseOggi, true),
    cedutiOggi: leggi(c.cedutiOggi, true),
  };
}
