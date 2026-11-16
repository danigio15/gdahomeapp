/* L'assistente di casa: quello che la casa ti direbbe, se potesse parlare.
 *
 * «Lo voglio molto molto intelligente, e sempre vivo, anche sul tablet a muro
 * con lo schermo sempre acceso.» Accanto alle persone, in Home, la casa dice
 * la cosa piu' importante da fare adesso — come un messaggio, con il tasto che
 * la fa — e tutte le altre in fila per urgenza.
 *
 * Non e' un modello linguistico: e' un motore di regole, e sta tutto qui.
 * Ogni rilevatore guarda una cosa sola — le luci accese con la casa vuota, la
 * finestra aperta col riscaldamento acceso, la pioggia in arrivo con le
 * finestre aperte, il bucato finito da un'ora — e se c'e' qualcosa da dire
 * propone un suggerimento: chi, quanto e' urgente, perche', e cosa fare. Poi
 * l'ordine: prima l'urgente, poi quello di oggi, poi le idee; dentro, prima la
 * sicurezza, poi i danni (acqua, pioggia, gelo), poi i soldi, poi il comfort
 * e in fondo la manutenzione; e a parita', quello che chi abita la casa di
 * solito accetta prima di quello che di solito scarta.
 *
 * «Perfeziona e rendi ancora piu' intelligente l'assistente di casa.» Le
 * regole guardano anche il contesto — chi c'e', che ora e', che tempo fa
 * fuori — per non dire cose inutili: niente «arieggia» quando piove o fuori
 * e' piu' umido, niente «apri le finestre» per il caldo quando fuori fa
 * ancora piu' caldo, niente bucato da stendere alle tre di notte, niente
 * «casa vuota» per chi e' appena sceso a buttare la spazzatura. Le cose
 * simili si dicono in una frase sola («3 finestre aperte: Bagno grande,
 * Studio e Cucina»), e le frasi concordano: il nome che sceglie chi abita la
 * casa non ha un genere che si possa indovinare («Lampadario», «Porta del
 * garage»), quindi la frase concorda con una parola nostra — finestra, luce,
 * serratura — e il nome viene dopo i due punti.
 *
 * Impara da chi lo usa, e lo ricorda per tutta la casa (`cd_assistente`): un
 * ✕ nasconde quel suggerimento finche' la situazione resta quella (e pesa sul
 * suo tipo), «Più tardi» lo rimanda — mai nel cuore della notte —, «Fatto» lo
 * toglie e dopo un po' ricontrolla: se la cosa c'e' ancora, lo dice con
 * garbo. Un tipo scartato spesso smette di farsi vedere; uno urgente —
 * l'acqua, il fumo — non smette mai.
 *
 * Il modulo e' puro: niente DOM, niente Home Assistant, niente orologio. Chi
 * chiama costruisce il contesto con quello che la plancia sa gia' (le tessere
 * della Home, le letture dell'energia, le previsioni) e dice che ora e'.
 */

import { fasciaInVigore, normalizzaLeFasce, oraDeiMinuti } from "./fasce-della-tariffa.js";
import { getLocale, intlLocale, pick } from "./i18n.js";

const pulito = (valore) => String(valore ?? "").trim();
const elenco = (valore) => (Array.isArray(valore) ? valore.filter(Boolean) : []);
const numero = (valore) => {
  if (valore === null || valore === undefined || valore === "") return null;
  const n = Number(valore);
  return Number.isFinite(n) ? n : null;
};

const MINUTO = 60_000;
const ORA = 60 * MINUTO;
const GIORNO = 24 * ORA;

/* ── le scelte ────────────────────────────────────────────────────────────── */

/** Dove si scrivono le scelte e quello che l'assistente ha imparato. */
export const CHIAVE_ASSISTENTE = "cd_assistente";

/** Le famiglie di suggerimenti: si accendono e si spengono una per una. */
export const CATEGORIE = Object.freeze([
  "sicurezza",
  "risparmio",
  "elettrodomestici",
  "comfort",
  "promemoria",
  "manutenzione",
]);

/** Quanto parla: solo l'urgente e l'oggi, il normale, o proprio tutto. */
export const SENSIBILITA = Object.freeze(["poco", "normale", "tutto"]);

/**
 * Le scelte ripulite. Di serie tutte le famiglie accese, la notte dalle 23, e
 * una sensibilita' normale: le idee ci sono, ma un tipo scartato spesso tace.
 */
export function opzioniDellAssistente(salvate) {
  const dato = salvate && typeof salvate === "object" && !Array.isArray(salvate) ? salvate : {};
  const categorie = {};
  const scritte = dato.categorie && typeof dato.categorie === "object" ? dato.categorie : {};
  for (const categoria of CATEGORIE) categorie[categoria] = scritte[categoria] !== false;
  const notte = Math.round(Number(dato.notteDalle));
  return {
    categorie,
    notteDalle: Number.isFinite(notte) && notte >= 18 && notte <= 23 ? notte : 23,
    sensibilita: SENSIBILITA.includes(pulito(dato.sensibilita))
      ? pulito(dato.sensibilita)
      : "normale",
  };
}

/* ── le parole ────────────────────────────────────────────────────────────── */

/* Un tempo, corto: «25 min», «2 h», «3 giorni». */
function durata(ms, lingua) {
  const minuti = Math.max(1, Math.round(Number(ms) / MINUTO) || 1);
  if (minuti < 60) return `${minuti} ${pick("min", "min", lingua)}`;
  const ore = Math.round(minuti / 60);
  if (ore < 48) return `${ore} ${pick("h", "h", lingua)}`;
  return `${Math.round(ore / 24)} ${pick("giorni", "days", lingua)}`;
}

/* Il codice di lingua che capisce `Intl`: «it», «zh-Hans»… */
function linguaIntl(lingua) {
  try {
    return intlLocale(lingua || getLocale());
  } catch (_errore) {
    return undefined;
  }
}

/* Un numero con un decimale, con la virgola di chi guarda. */
function decimale(valore, lingua) {
  try {
    return Number(valore).toLocaleString(linguaIntl(lingua), {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  } catch (_errore) {
    return Number(valore).toFixed(1);
  }
}

/**
 * L'articolo davanti a un numero, in italiano: «al 45%», ma «all'8%»,
 * «all'11%», «all'80%» — si guarda come si pronuncia, non come si scrive.
 * Serve solo all'italiano, che e' l'unica lingua scritta qui dentro: le altre
 * le scrive il catalogo, e la frase inglese non ha articoli da accordare.
 */
export function conLArticolo(valore, articolo = "al") {
  const n = Math.round(Math.abs(Number(valore)));
  const vocale = n === 1 || n === 11 || /^8/.test(String(n));
  const apostrofo = articolo === "il" ? "l'" : `${articolo}l'`;
  return vocale ? `${apostrofo}${n}` : `${articolo} ${n}`;
}

/**
 * I nomi in fila, come li direbbe chi guarda: «Cucina», «Cucina e Bagno»,
 * «Bagno grande, Studio e Cucina» — fino a tre si scrivono tutti, oltre si
 * contano: «Bagno grande, Studio e altre 3». La congiunzione e le virgole
 * sono quelle della lingua (`Intl.ListFormat`): in giapponese non sono le
 * nostre. `genere` accorda il conto in italiano: «altre 3» finestre, «altri
 * 3» dispositivi.
 */
function nomi(voci, lingua, genere = "f") {
  const scritti = elenco(voci)
    .map((voce) => pulito(voce?.name || voce?.nome || voce?.entity))
    .filter(Boolean);
  let pezzi = scritti;
  if (scritti.length > 3) {
    const resto = scritti.length - 2;
    pezzi = [
      ...scritti.slice(0, 2),
      genere === "m"
        ? pick(`altri ${resto}`, `${resto} more`, lingua)
        : pick(`altre ${resto}`, `${resto} more`, lingua),
    ];
  }
  if (pezzi.length < 2) return pezzi.join("");
  try {
    return new Intl.ListFormat(linguaIntl(lingua), { type: "conjunction" }).format(pezzi);
  } catch (_errore) {
    return `${pezzi.slice(0, -1).join(", ")}${pick(" e ", " and ", lingua)}${pezzi.at(-1)}`;
  }
}

/* ── il tempo che fa e che fara' ─────────────────────────────────────────── */

const PIOVOSE = new Set([
  "rainy",
  "pouring",
  "lightning-rainy",
  "lightning",
  "hail",
  "snowy-rainy",
  "snowy",
]);

/**
 * Fra quanti minuti piove, dalle previsioni ora per ora di Home Assistant:
 * la prima ora con la condizione di pioggia o con la probabilita' dal 60% in
 * su, entro tre ore. Zero se piove adesso; `null` se non pioverà o non si sa.
 */
export function pioggiaFra(previsioni, adesso, condizioneDiAdesso = "") {
  if (PIOVOSE.has(pulito(condizioneDiAdesso))) return 0;
  for (const voce of elenco(previsioni)) {
    const quando = Date.parse(voce?.datetime || "");
    if (!Number.isFinite(quando)) continue;
    const fra = quando - adesso;
    if (fra < -ORA) continue;
    if (fra > 3 * ORA) break;
    const probabilita = numero(voce?.precipitation_probability);
    if (PIOVOSE.has(pulito(voce?.condition)) || (probabilita !== null && probabilita >= 60))
      return Math.max(0, Math.round(fra / MINUTO));
  }
  return null;
}

/**
 * Quanti grammi d'acqua ci sono in un metro cubo d'aria, a quella temperatura
 * e a quell'umidita' relativa (la formula di Magnus). Serve a una domanda
 * sola: aprire la finestra asciuga la stanza o la bagna? Il 70% a 22 gradi
 * dentro e il 90% a 8 gradi fuori sono fuori piu' secco: si arieggia.
 */
export function umiditaAssoluta(temperatura, relativa) {
  const t = numero(temperatura);
  const ur = numero(relativa);
  if (t === null || ur === null) return null;
  const pressione = 6.112 * Math.exp((17.67 * t) / (t + 243.5));
  return (pressione * ur * 2.1674) / (273.15 + t);
}

/* ── la tariffa ───────────────────────────────────────────────────────────── */

/**
 * Com'e' la tariffa adesso, dalle fasce scritte in Energia: se questa e' la
 * fascia piu' cara, e quando arriva la prossima piu' economica (entro sei
 * ore). `null` quando le fasce non ci sono o non hanno prezzi.
 */
export function tariffaDiAdesso(config, adesso) {
  const fasce = normalizzaLeFasce(config);
  if (!fasce.quante) return null;
  const prezzoDi = (istante) => {
    const quale = fasciaInVigore(fasce, new Date(istante));
    return quale < 0 ? null : numero(fasce.voci[quale]?.prezzo);
  };
  const prezzo = prezzoDi(adesso);
  if (prezzo === null) return null;
  const prezzi = fasce.voci.map((voce) => numero(voce.prezzo)).filter((p) => p !== null);
  const piuCara = prezzi.length > 1 && prezzo >= Math.max(...prezzi);
  /* Al quarto d'ora: le fasce cominciano all'ora o alla mezz'ora. */
  const passo = 15 * MINUTO;
  const primo = Math.ceil(adesso / passo) * passo;
  for (let istante = primo; istante <= adesso + 6 * ORA; istante += passo) {
    const dopo = prezzoDi(istante);
    if (dopo !== null && dopo < prezzo) {
      const data = new Date(istante);
      return {
        prezzo,
        piuCara,
        prossima: {
          fra: istante - adesso,
          prezzo: dopo,
          alle: oraDeiMinuti(data.getHours() * 60 + data.getMinutes()),
        },
      };
    }
  }
  return { prezzo, piuCara, prossima: null };
}

/* ── i rilevatori ─────────────────────────────────────────────────────────── */

const servizio = (dominio, nome, entita, dati = {}) => ({
  dominio,
  servizio: nome,
  dati: { entity_id: Array.isArray(entita) && entita.length === 1 ? entita[0] : entita, ...dati },
});

/* Le azioni piu' comuni, scritte una volta. */
const fatto = (lingua) => ({ etichetta: pick("Fatto", "Done", lingua), fatto: true });
const vedi = (lingua, pagina, tessera = "") => ({
  etichetta: pick("Vedi", "Show", lingua),
  vai: { pagina, tessera },
});

function eNotte(c, o) {
  const ora = numero(c.ora) ?? 12;
  return ora >= o.notteDalle || ora < 6;
}

/* Nessuno in casa: lo si dice solo quando le persone ci sono e si sa dove
 * sono **tutte**. Una casa senza persone configurate non e' una casa vuota,
 * e nemmeno una con qualcuno di cui non si sa niente («Sconosciuto»): li'
 * l'assistente tace, invece di proporre di spegnere le luci a chi e' in
 * salotto. */
function casaVuota(c) {
  const p = c.persone || {};
  return (
    (numero(p.totale) || 0) > 0 && (numero(p.inCasa) || 0) === 0 && (numero(p.incerte) || 0) === 0
  );
}

function daQuandoVuota(c) {
  const uscita = numero(c.persone?.ultimaUscita);
  return uscita ? Math.max(0, c.adesso - uscita) : null;
}

/* Vuota «davvero»: da almeno quel tanto. Chi scende a buttare la spazzatura
 * o va a prendere il pane non ha lasciato le luci accese in una casa vuota.
 * Quando non si sa da quando (nessuna uscita registrata) vale come vuota da
 * tempo, come prima. */
function vuotaDa(c, quanto) {
  if (!casaVuota(c)) return false;
  const da = daQuandoVuota(c);
  return da === null || da >= quanto;
}

/* Una stanza che si chiama come un posto fuori casa e' fuori casa anche senza
 * la spunta: «notifiche della temperatura del sensore che ho in giardino»,
 * «non mi deve suggerire di attivare il riscaldamento». */
const ALL_APERTO =
  /estern|outdoor|outside|exterior|fuori|giardin|garden|jardin|garten|balcon|terrazz|terrac|cortil|courtyard|patio|veranda|portic|loggia|pergol|gazebo|tettoi|backyard|meteo|weather|(^|[^a-z])(orto|prato|yard|lawn|tetto|roof)([^a-z]|$)/i;

/* Le stanze da tenere comode: quelle di casa. Il balcone, il terrazzo, il
 * giardino segnati «All'aperto» (#251) — o che si chiamano cosi' — si
 * leggono, ma non si scaldano, non si rinfrescano e non si arieggiano — e a
 * sei gradi d'inverno sono soltanto fuori. */
const stanzeDiCasa = (c) =>
  elenco(c.stanze).filter((s) => s.fuori !== true && !ALL_APERTO.test(pulito(s.name)));

/* Il nome di una zona che e' la casa: «Casa», «Home», «Casa mia»… Chi ha
 * fatto in Home Assistant una zona sua per la casa, accanto a quella di
 * serie, la vede scritta «Casa» sulla scheda: per l'assistente e' casa. */
const ZONA_DI_CASA = /^(?:a\s+)?(?:casa|home)(?:\s+(?:mia|nostra|\S+))?$/i;

/* Chi e' in casa, da come si vedono le persone (`personViewModel`): a
 * casa, in una zona che si chiama casa, o collegato alla stessa rete Wi‑Fi
 * di qualcuno che e' a casa. Chi non si sa dove sia e' «incerto». */
export function chiEInCasa(viste) {
  const aCasa = (v) =>
    v?.presence === "home" ||
    (v?.presence === "zone" && ZONA_DI_CASA.test(String(v.zone || "").trim()));
  const reti = new Set(
    viste
      .filter(aCasa)
      .map((v) => String(v?.wifi || "").trim())
      .filter(Boolean),
  );
  let inCasa = 0;
  let incerte = 0;
  const fuori = [];
  for (const v of viste) {
    if (aCasa(v) || (v?.wifi && reti.has(String(v.wifi).trim()))) inCasa += 1;
    else if (!v?.known) incerte += 1;
    else fuori.push(v);
  }
  return { totale: viste.length, inCasa, incerte, fuori };
}

/* Lo stesso confronto di stanza dappertutto: il nome, senza maiuscole. */
const stessaStanza = (a, b) => pulito(a).toLowerCase() === pulito(b).toLowerCase() && pulito(a);

/* Le finestre di una stanza: quelle della sua area di Home Assistant, o
 * quelle che si chiamano come lei. */
const finestreDi = (c, stanza) =>
  elenco(c.finestre).filter((f) => stessaStanza(f.stanza, stanza) || stessaStanza(f.name, stanza));

/* La temperatura e l'umidita' di fuori, quando la plancia le sa. */
const tempFuori = (c) => numero(c.meteo?.fuori?.temperatura);
const umidFuori = (c) => numero(c.meteo?.fuori?.umidita);
const pioveFra = (c) => numero(c.meteo?.pioggiaFra);

/*
 * Quanto conta l'ambito, a parita' di urgenza: prima la sicurezza delle
 * persone e della casa, poi i danni (l'acqua, la pioggia, il gelo), poi i
 * soldi, poi il comfort e i promemoria, e in fondo la manutenzione. Il fumo e
 * l'antifurto che suona stanno sopra a tutto.
 */
const AMBITO = Object.freeze({
  fumo: 9,
  "antifurto-scattato": 9,
  acqua: 8,
  gelo: 7,
  serrature: 6,
  garage: 6,
  "vuota-antifurto": 6,
  "vuota-aperture": 6,
  pioggia: 5,
  "frigo-aperto": 5,
  "finestra-clima": 4,
  "rete-alta": 4,
  "vuota-clima": 4,
  "vuota-luci": 4,
  "vuota-media": 4,
  "fascia-cara": 3,
  "notte-luci": 3,
  "vuota-tapparelle": 3,
  "sole-elettrodomestico": 3,
  "sole-auto": 3,
  evento: 3,
  rifiuti: 2,
  finito: 2,
  comfort: 2,
  aria: 2,
  batterie: 1,
  "non-rispondono": 1,
  aggiornamenti: 1,
});

const RILEVATORI = [];
const rilevatore = (tipo, categoria, guarda) => RILEVATORI.push({ tipo, categoria, guarda });

/* 1. L'acqua dove non deve esserci. Prima di tutto il resto. */
rilevatore("acqua", "sicurezza", (c, o, l) => {
  const bagnati = elenco(c.allagamenti);
  if (!bagnati.length) return [];
  const valvola = elenco(c.valvole).find((v) => v.aperta);
  const uno = bagnati.length === 1;
  return [
    {
      urgenza: "urgente",
      disegno: "water",
      titolo: pick(`Acqua rilevata: ${nomi(bagnati, l)}`, `Water detected: ${nomi(bagnati, l)}`, l),
      motivo: valvola
        ? uno
          ? pick(
              "Il sensore di allagamento è bagnato: chiudo la valvola?",
              "The leak sensor is wet: shall I close the valve?",
              l,
            )
          : pick(
              "I sensori di allagamento sono bagnati: chiudo la valvola?",
              "The leak sensors are wet: shall I close the valve?",
              l,
            )
        : uno
          ? pick("Il sensore di allagamento è bagnato.", "The leak sensor is wet.", l)
          : pick("I sensori di allagamento sono bagnati.", "The leak sensors are wet.", l),
      azioni: [
        valvola
          ? {
              etichetta: pick("Chiudi l'acqua", "Shut the water", l),
              servizio: valvola.chiudi,
            }
          : vedi(l, "", "allagamenti"),
      ],
      entita: bagnati.map((b) => b.entity),
    },
  ];
});

/* 2. Il fumo, il gas. */
rilevatore("fumo", "sicurezza", (c, o, l) => {
  const accesi = elenco(c.fumo);
  if (!accesi.length) return [];
  return [
    {
      urgenza: "urgente",
      disegno: "smoke",
      titolo: pick(`Allarme: ${nomi(accesi, l)}`, `Alarm: ${nomi(accesi, l)}`, l),
      motivo:
        accesi.length === 1
          ? pick(
              "Un rilevatore di fumo o gas sta suonando.",
              "A smoke or gas detector is going off.",
              l,
            )
          : pick(
              "Più rilevatori di fumo o gas stanno suonando.",
              "Several smoke or gas detectors are going off.",
              l,
            ),
      azioni: [vedi(l, "", "fumo")],
      entita: accesi.map((a) => a.entity),
    },
  ];
});

/* 3. L'antifurto che suona. */
rilevatore("antifurto-scattato", "sicurezza", (c, o, l) => {
  if (!c.antifurto?.scattato) return [];
  return [
    {
      urgenza: "urgente",
      disegno: "security",
      titolo: pick("L'antifurto sta suonando", "The alarm is going off", l),
      motivo: pick("È scattato l'allarme.", "The alarm has been triggered.", l),
      azioni: [vedi(l, "security", "sicurezza")],
      entita: [c.antifurto.entity].filter(Boolean),
    },
  ];
});

/* 4. Il frigo o il congelatore aperto. Il nome lo sceglie chi abita la casa
 * («Porta frigo», «Congelatore»): la frase parla dello sportello, che ha il
 * suo genere, e il nome sta davanti. */
rilevatore("frigo-aperto", "sicurezza", (c, o, l) =>
  elenco(c.frigo)
    .filter((f) => f.aperto && (numero(f.daMs) || 0) >= 3 * MINUTO)
    .map((f) => ({
      urgenza: "urgente",
      disegno: "info",
      titolo: pick(
        `${f.name}: sportello aperto da ${durata(f.daMs, l)}`,
        `${f.name}: door open for ${durata(f.daMs, l)}`,
        l,
      ),
      motivo: pick(
        "Chiudilo prima che il freddo se ne vada.",
        "Close it before the cold escapes.",
        l,
      ),
      azioni: [fatto(l)],
      entita: [f.entity],
    })),
);

/* Le luci che restano accese per conto loro, e che l'assistente non propone
 * mai di spegnere: «se c'e' un acquario in casa e ha la luce accesa non mi
 * puo' dire che la spengo, quella e' cosi' e tale resta». Dal nome (acquario,
 * terrario, notturna, giardino), dalle sezioni della plancia che le
 * possiedono (Animali) — `c.lasciate` — e da quelle che chi abita la casa ha
 * detto di lasciare stare. Lo stesso criterio delle notifiche del ponte
 * (`ponte/src/capire-la-casa.js`). */
const LUCE_CHE_RESTA =
  /acquari|aquari|vasca\s*pesci|fish\s*tank|terrari|rettil|paludari|vivari|notturn|night\s*light|segnapasso|luce\s*(di\s*)?cortesia|\bnotte\b|giardin|esterno|esterne|esterni|outdoor|garden|vialett|cortil|crepuscol/i;
export function luceDaLasciare(luce, c = {}) {
  const id = pulito(luce?.entity);
  if (elenco(c.lasciate).includes(id)) return true;
  return LUCE_CHE_RESTA.test(`${id.replace(/[._]/g, " ")} ${pulito(luce?.name)}`);
}

/* Quanto aspettare dopo l'ultima uscita prima di dire «casa vuota». */
const VUOTA_DA_POCO = 10 * MINUTO;
/* Per la porta e il garage meno: e' sicurezza, ma chi esce chiude dietro di
 * se' in un minuto o due — dirlo subito sarebbe dirlo a chi sta chiudendo. */
const VUOTA_PER_LA_SICUREZZA = 3 * MINUTO;

/* 5. Casa vuota e luci accese. */
rilevatore("vuota-luci", "risparmio", (c, o, l) => {
  if (!vuotaDa(c, VUOTA_DA_POCO)) return [];
  const accese = elenco(c.luci).filter((x) => x.on && !luceDaLasciare(x, c));
  if (!accese.length) return [];
  const da = daQuandoVuota(c);
  return [
    {
      urgenza: "oggi",
      disegno: "lights",
      titolo:
        accese.length === 1
          ? pick(
              `Non c'è nessuno in casa, ma una luce è accesa: ${nomi(accese, l)}`,
              `Nobody is home, but a light is on: ${nomi(accese, l)}`,
              l,
            )
          : pick(
              `Non c'è nessuno in casa, ma ${accese.length} luci sono accese: ${nomi(accese, l)}`,
              `Nobody is home, but ${accese.length} lights are on: ${nomi(accese, l)}`,
              l,
            ),
      motivo: da
        ? accese.length === 1
          ? pick(
              `Casa vuota da ${durata(da, l)}: la spengo?`,
              `Empty for ${durata(da, l)}: turn it off?`,
              l,
            )
          : pick(
              `Casa vuota da ${durata(da, l)}: le spengo?`,
              `Empty for ${durata(da, l)}: turn them off?`,
              l,
            )
        : accese.length === 1
          ? pick("La spengo?", "Turn it off?", l)
          : pick("Le spengo?", "Turn them off?", l),
      azioni: [
        {
          etichetta: pick("Spegni", "Turn off", l),
          servizio: servizio(
            "light",
            "turn_off",
            accese.map((x) => x.entity),
          ),
        },
      ],
      entita: accese.map((x) => x.entity),
    },
  ];
});

/* 6. Casa vuota e clima acceso. */
rilevatore("vuota-clima", "risparmio", (c, o, l) => {
  if (!vuotaDa(c, VUOTA_DA_POCO)) return [];
  const accesi = elenco(c.clima).filter((x) => x.on);
  if (!accesi.length) return [];
  return [
    {
      urgenza: "oggi",
      disegno: "radiator",
      titolo: pick(
        `Non c'è nessuno, ma il clima è acceso: ${nomi(accesi, l, "m")}`,
        `Nobody is home, but the climate is on: ${nomi(accesi, l, "m")}`,
        l,
      ),
      motivo: pick("Lo spengo finché non torna qualcuno?", "Turn it off until someone is back?", l),
      azioni: [
        {
          etichetta: pick("Spegni", "Turn off", l),
          servizio: servizio(
            "climate",
            "turn_off",
            accesi.map((x) => x.entity),
          ),
        },
      ],
      entita: accesi.map((x) => x.entity),
    },
  ];
});

/* 7. Casa vuota e TV o musica accese. Un lettore o tanti: «sta suonando» e
 * «stanno suonando» non sono la stessa frase. */
rilevatore("vuota-media", "risparmio", (c, o, l) => {
  if (!vuotaDa(c, VUOTA_DA_POCO)) return [];
  const accesi = elenco(c.media).filter((x) => x.entity);
  if (!accesi.length) return [];
  const uno = accesi.length === 1;
  return [
    {
      urgenza: "oggi",
      disegno: "speaker",
      titolo: uno
        ? pick(
            `Non c'è nessuno in casa, ma qualcosa sta suonando: ${nomi(accesi, l, "m")}`,
            `Nobody is home, but something is playing: ${nomi(accesi, l, "m")}`,
            l,
          )
        : pick(
            `Non c'è nessuno in casa, ma ${accesi.length} lettori stanno suonando: ${nomi(accesi, l, "m")}`,
            `Nobody is home, but ${accesi.length} players are playing: ${nomi(accesi, l, "m")}`,
            l,
          ),
      motivo: uno ? pick("Lo spengo?", "Turn it off?", l) : pick("Li spengo?", "Turn them off?", l),
      azioni: [
        {
          etichetta: pick("Spegni", "Turn off", l),
          servizio: servizio(
            "media_player",
            "turn_off",
            accesi.map((x) => x.entity),
          ),
        },
      ],
      entita: accesi.map((x) => x.entity),
    },
  ];
});

/* 8. Uscendo: l'antifurto non e' inserito. Chi abita da solo non «e' uscito
 * tutti»: la frase dice la casa, non le persone. Inserirlo chiede conferma. */
rilevatore("vuota-antifurto", "sicurezza", (c, o, l) => {
  const a = c.antifurto;
  if (!vuotaDa(c, VUOTA_DA_POCO) || !a?.entity || a.inserito || a.scattato) return [];
  return [
    {
      urgenza: "oggi",
      disegno: "security",
      titolo: pick(
        "Non c'è nessuno in casa e l'antifurto è spento",
        "Nobody is home and the alarm is off",
        l,
      ),
      motivo: pick("Lo inserisco in modalità fuori casa?", "Arm it in away mode?", l),
      azioni: [
        a.serveIlCodice
          ? {
              etichetta: pick("Inserisci", "Arm", l),
              vai: { pagina: "security", tessera: "sicurezza" },
            }
          : {
              etichetta: pick("Inserisci", "Arm", l),
              conferma: pick("Sì, inserisci", "Yes, arm it", l),
              servizio: servizio("alarm_control_panel", "alarm_arm_away", [a.entity]),
            },
      ],
      entita: [a.entity],
    },
  ];
});

/* 9. Serrature aperte: uscendo, o di notte. La frase parla della serratura
 * («Serratura aperta: Portone»): il nome della porta ha il genere che vuole
 * chi l'ha scritto. Chiuderla a chiave da qui chiede conferma. */
rilevatore("serrature", "sicurezza", (c, o, l) => {
  const aperte = elenco(c.serrature).filter((s) => s.aperta);
  if (!aperte.length) return [];
  const vuota = vuotaDa(c, VUOTA_PER_LA_SICUREZZA);
  const notte = eNotte(c, o);
  if (!vuota && !notte) return [];
  const chiudibili = aperte.filter((s) => pulito(s.entity).startsWith("lock."));
  const una = aperte.length === 1;
  let motivo;
  if (!chiudibili.length)
    motivo = vuota
      ? pick("Non c'è nessuno in casa: meglio controllare.", "Nobody is home: worth a check.", l)
      : pick("È notte: meglio controllare.", "It's night: worth a check.", l);
  else if (vuota)
    motivo = una
      ? pick("Non c'è nessuno in casa: la chiudo a chiave?", "Nobody is home: lock it?", l)
      : pick("Non c'è nessuno in casa: le chiudo a chiave?", "Nobody is home: lock them?", l);
  else
    motivo = una
      ? pick("È notte: la chiudo a chiave?", "It's night: lock it?", l)
      : pick("È notte: le chiudo a chiave?", "It's night: lock them?", l);
  return [
    {
      urgenza: vuota ? "urgente" : "oggi",
      disegno: "lock",
      titolo: una
        ? pick(`Serratura aperta: ${nomi(aperte, l)}`, `Unlocked: ${nomi(aperte, l)}`, l)
        : pick(
            `${aperte.length} serrature aperte: ${nomi(aperte, l)}`,
            `${aperte.length} locks unlocked: ${nomi(aperte, l)}`,
            l,
          ),
      motivo,
      azioni: [
        chiudibili.length
          ? {
              etichetta: pick("Chiudi", "Lock", l),
              conferma: pick("Sì, chiudi a chiave", "Yes, lock", l),
              servizio: servizio(
                "lock",
                "lock",
                chiudibili.map((s) => s.entity),
              ),
            }
          : vedi(l, "", "porte"),
      ],
      entita: aperte.map((s) => s.entity),
    },
  ];
});

/* 10. Garage o cancello aperto: uscendo, o di notte. Tutti insieme, con la
 * parola giusta: un garage, dei garage, un cancello, dei cancelli. */
rilevatore("garage", "sicurezza", (c, o, l) => {
  const aperti = elenco(c.garage).filter((g) => g.aperto);
  if (!aperti.length) return [];
  const vuota = vuotaDa(c, VUOTA_PER_LA_SICUREZZA);
  if (!vuota && !eNotte(c, o)) return [];
  const cancelli = aperti.filter((g) => g.classe === "gate").length;
  const uno = aperti.length === 1;
  const elencati = nomi(aperti, l, "m");
  let titolo;
  if (!cancelli)
    titolo = uno
      ? pick(`Garage aperto: ${elencati}`, `Garage open: ${elencati}`, l)
      : pick(`Garage aperti: ${elencati}`, `Garages open: ${elencati}`, l);
  else if (cancelli === aperti.length)
    titolo = uno
      ? pick(`Cancello aperto: ${elencati}`, `Gate open: ${elencati}`, l)
      : pick(`Cancelli aperti: ${elencati}`, `Gates open: ${elencati}`, l);
  else
    titolo = pick(`Garage e cancelli aperti: ${elencati}`, `Garage and gates open: ${elencati}`, l);
  return [
    {
      urgenza: vuota ? "urgente" : "oggi",
      disegno: "gate",
      titolo,
      motivo: vuota
        ? uno
          ? pick("Non c'è nessuno in casa: lo chiudo?", "Nobody is home: close it?", l)
          : pick("Non c'è nessuno in casa: li chiudo?", "Nobody is home: close them?", l)
        : uno
          ? pick("È notte: lo chiudo?", "It's night: close it?", l)
          : pick("È notte: li chiudo?", "It's night: close them?", l),
      azioni: [
        {
          etichetta: pick("Chiudi", "Close", l),
          conferma: pick("Sì, chiudi", "Yes, close", l),
          servizio: servizio(
            "cover",
            "close_cover",
            aperti.map((g) => g.entity),
          ),
        },
      ],
      entita: aperti.map((g) => g.entity),
    },
  ];
});

/* Il titolo delle finestre e delle porte aperte: concorda con «finestra» e
 * «porta», che sono parole nostre, e i nomi vengono dopo. */
function titoloDelleAperture(finestre, porte, l) {
  const tutte = [...finestre, ...porte];
  const elencati = nomi(tutte, l);
  if (finestre.length && porte.length)
    return pick(`Finestre e porte aperte: ${elencati}`, `Windows and doors open: ${elencati}`, l);
  if (porte.length)
    return porte.length === 1
      ? pick(`Porta aperta: ${elencati}`, `Door open: ${elencati}`, l)
      : pick(
          `${porte.length} porte aperte: ${elencati}`,
          `${porte.length} doors open: ${elencati}`,
          l,
        );
  return finestre.length === 1
    ? pick(`Finestra aperta: ${elencati}`, `Window open: ${elencati}`, l)
    : pick(
        `${finestre.length} finestre aperte: ${elencati}`,
        `${finestre.length} windows open: ${elencati}`,
        l,
      );
}

/* 11. Casa vuota e finestre o porte aperte: non si chiudono da qui, si dice.
 * «Siete usciti con Bagno grande e altre 2 aperta» non concordava ne' col
 * numero ne' col genere: adesso «3 finestre aperte: Bagno grande, Studio e
 * Cucina». */
rilevatore("vuota-aperture", "sicurezza", (c, o, l) => {
  if (!vuotaDa(c, VUOTA_DA_POCO)) return [];
  const finestre = elenco(c.finestre);
  const porte = elenco(c.porte);
  if (!finestre.length && !porte.length) return [];
  return [
    {
      urgenza: "oggi",
      disegno: "window",
      titolo: titoloDelleAperture(finestre, porte, l),
      motivo: pick(
        "Non c'è nessuno in casa: meglio controllare.",
        "Nobody is home: worth a check.",
        l,
      ),
      azioni: [vedi(l, "", "varchi")],
      entita: [...finestre, ...porte].map((a) => a.entity),
    },
  ];
});

/* Una finestra aperta da poco e' una finestra che si sta arieggiando: e' la
 * cosa giusta da fare, anche col riscaldamento acceso. Se ne parla dopo. */
const ARIEGGIARE = 10 * MINUTO;

/* 12. Finestra aperta col clima acceso nella stessa stanza. */
rilevatore("finestra-clima", "risparmio", (c, o, l) => {
  const fuori = [];
  for (const unita of elenco(c.clima).filter((x) => x.on && x.stanza)) {
    const finestra = elenco(c.finestre).find(
      (f) =>
        stessaStanza(f.stanza, unita.stanza) &&
        (numero(f.daMs) === null || numero(f.daMs) >= ARIEGGIARE),
    );
    if (!finestra) continue;
    const caldo = /heat/.test(pulito(unita.mode));
    const da = numero(finestra.daMs);
    fuori.push({
      urgenza: "oggi",
      disegno: "window",
      titolo: caldo
        ? pick(
            `${unita.stanza}: finestra aperta e riscaldamento acceso`,
            `${unita.stanza}: window open and heating on`,
            l,
          )
        : pick(
            `${unita.stanza}: finestra aperta e clima acceso`,
            `${unita.stanza}: window open and climate on`,
            l,
          ),
      motivo:
        da !== null
          ? pick(
              `Finestra aperta da ${durata(da, l)} (${finestra.name}): spengo ${unita.name} finché non la chiudi?`,
              `Window open for ${durata(da, l)} (${finestra.name}): turn off ${unita.name} until you close it?`,
              l,
            )
          : pick(
              `Finestra aperta (${finestra.name}): spengo ${unita.name} finché non la chiudi?`,
              `Window open (${finestra.name}): turn off ${unita.name} until you close it?`,
              l,
            ),
      azioni: [
        {
          etichetta: pick("Spegni il clima", "Turn off climate", l),
          servizio: servizio("climate", "turn_off", [unita.entity]),
        },
      ],
      entita: [unita.entity, finestra.entity],
    });
  }
  return fuori;
});

/* 13. Pioggia in arrivo con le finestre aperte o la tenda fuori. */
rilevatore("pioggia", "comfort", (c, o, l) => {
  const fra = pioveFra(c);
  if (fra === null || fra > 120) return [];
  const finestre = elenco(c.finestre);
  const tende = elenco(c.tende).filter((t) => t.aperta);
  const fuori = [];
  const quando =
    fra <= 5
      ? pick("Sta piovendo", "It's raining", l)
      : pick(`Pioggia fra ${durata(fra * MINUTO, l)}`, `Rain in ${durata(fra * MINUTO, l)}`, l);
  /* Una finestra «è aperta», due o più «sono aperte».
   *
   * Dal campo, con la schermata: «Pioggia fra 2 h e Bagno Grande e altre 4 è
   * aperta. Meglio chiuderla prima.» Il soggetto sono cinque finestre, e la
   * frase le trattava come una. Le frasi sono due e intere, non un verbo
   * attaccato a meta': ogni lingua le traduce come le dice lei (in polacco e
   * in russo cambia anche il genere), e una frase spezzata non si traduce.
   *
   * E il soggetto e' «una finestra», non il suo nome: «Bagno grande è
   * aperta» non e' italiano. I nomi vengono dopo i due punti. */
  if (finestre.length)
    fuori.push({
      urgenza: fra <= 30 ? "urgente" : "oggi",
      disegno: "storm",
      titolo:
        finestre.length === 1
          ? pick(
              `${quando} e una finestra è aperta: ${nomi(finestre, l)}`,
              `${quando} and a window is open: ${nomi(finestre, l)}`,
              l,
            )
          : pick(
              `${quando} e ${finestre.length} finestre sono aperte: ${nomi(finestre, l)}`,
              `${quando} and ${finestre.length} windows are open: ${nomi(finestre, l)}`,
              l,
            ),
      motivo:
        finestre.length === 1
          ? pick("Meglio chiuderla prima.", "Better close it first.", l)
          : pick("Meglio chiuderle prima.", "Better close them first.", l),
      azioni: [fatto(l)],
      entita: finestre.map((f) => f.entity),
    });
  /* E lo stesso per le tende da sole: una «è aperta», piu' d'una «sono
   * aperte» — e il nome, anche qui, dopo i due punti. */
  if (tende.length)
    fuori.push({
      urgenza: fra <= 30 ? "urgente" : "oggi",
      disegno: "storm",
      titolo:
        tende.length === 1
          ? pick(
              `${quando} e una tenda da sole è aperta: ${nomi(tende, l)}`,
              `${quando} and an awning is out: ${nomi(tende, l)}`,
              l,
            )
          : pick(
              `${quando} e ${tende.length} tende da sole sono aperte: ${nomi(tende, l)}`,
              `${quando} and ${tende.length} awnings are out: ${nomi(tende, l)}`,
              l,
            ),
      motivo:
        tende.length === 1
          ? pick("La ritiro?", "Retract it?", l)
          : pick("Le ritiro?", "Retract them?", l),
      azioni: [
        {
          etichetta: pick("Ritira", "Retract", l),
          servizio: servizio(
            "cover",
            "close_cover",
            tende.map((t) => t.entity),
          ),
        },
      ],
      entita: tende.map((t) => t.entity),
    });
  return fuori;
});

/* 14. Il gelo: fuori sotto zero e una finestra aperta da un pezzo. Non e'
 * comfort, e' un danno — i tubi, i termosifoni, il riscaldamento che lavora
 * per niente. Una finestra aperta da pochi minuti si sta arieggiando. */
rilevatore("gelo", "comfort", (c, o, l) => {
  const gradi = tempFuori(c);
  if (gradi === null || gradi > 0) return [];
  const aperte = elenco(c.finestre).filter((f) => (numero(f.daMs) ?? 0) >= 20 * MINUTO);
  if (!aperte.length) return [];
  const lunga = Math.max(...aperte.map((f) => numero(f.daMs) || 0));
  const scritti = decimale(gradi, l);
  return [
    {
      urgenza: lunga >= 2 * ORA || gradi <= -3 ? "urgente" : "oggi",
      disegno: "thermometer",
      titolo:
        aperte.length === 1
          ? pick(
              `Fuori gela e una finestra è aperta: ${nomi(aperte, l)}`,
              `It's freezing outside and a window is open: ${nomi(aperte, l)}`,
              l,
            )
          : pick(
              `Fuori gela e ${aperte.length} finestre sono aperte: ${nomi(aperte, l)}`,
              `It's freezing outside and ${aperte.length} windows are open: ${nomi(aperte, l)}`,
              l,
            ),
      motivo:
        aperte.length === 1
          ? pick(
              `Fuori ci sono ${scritti}°: meglio chiuderla.`,
              `It's ${scritti}° outside: better close it.`,
              l,
            )
          : pick(
              `Fuori ci sono ${scritti}°: meglio chiuderle.`,
              `It's ${scritti}° outside: better close them.`,
              l,
            ),
      azioni: [fatto(l)],
      entita: aperte.map((f) => f.entity),
    },
  ];
});

/* 15. Di notte, luci accese dove non c'e' nessuno. */
rilevatore("notte-luci", "risparmio", (c, o, l) => {
  if (!eNotte(c, o) || casaVuota(c)) return [];
  const occupate = new Set(elenco(c.stanzeOccupate).map((s) => pulito(s).toLowerCase()));
  /* Senza sensori di presenza non si sa dove c'e' qualcuno: di notte si
   * guardano solo le luci accese da piu' di un'ora. */
  const sapere = Boolean(c.ciSonoPresenze);
  const accese = elenco(c.luci).filter(
    (x) =>
      x.on &&
      !luceDaLasciare(x, c) &&
      (sapere
        ? x.stanza && !occupate.has(pulito(x.stanza).toLowerCase())
        : (numero(x.daMs) || 0) >= ORA),
  );
  if (!accese.length) return [];
  const una = accese.length === 1;
  return [
    {
      urgenza: "idea",
      disegno: "moon",
      titolo: una
        ? pick(
            `È tardi e una luce è ancora accesa: ${nomi(accese, l)}`,
            `It's late and a light is still on: ${nomi(accese, l)}`,
            l,
          )
        : pick(
            `È tardi e ${accese.length} luci sono ancora accese: ${nomi(accese, l)}`,
            `It's late and ${accese.length} lights are still on: ${nomi(accese, l)}`,
            l,
          ),
      motivo: sapere
        ? una
          ? pick("In quella stanza non c'è nessuno.", "Nobody is in that room.", l)
          : pick("In quelle stanze non c'è nessuno.", "Nobody is in those rooms.", l)
        : pick("Accese da più di un'ora.", "On for over an hour.", l),
      azioni: [
        {
          etichetta: pick("Spegni", "Turn off", l),
          servizio: servizio(
            "light",
            "turn_off",
            accese.map((x) => x.entity),
          ),
        },
      ],
      entita: accese.map((x) => x.entity),
    },
  ];
});

/* 16. La sera, con la casa vuota, le tapparelle ancora alzate: si chiudono
 * tutte con un tasto, quello che la pagina Finestre ha gia'. Di giorno no:
 * le tapparelle su sono una casa normale. */
rilevatore("vuota-tapparelle", "risparmio", (c, o, l) => {
  const ora = numero(c.ora) ?? 12;
  if (!vuotaDa(c, VUOTA_DA_POCO) || !(ora >= 20 || eNotte(c, o))) return [];
  const alzate = elenco(c.tapparelle).filter((t) => t.entity);
  if (!alzate.length) return [];
  const una = alzate.length === 1;
  return [
    {
      urgenza: "idea",
      disegno: "window",
      titolo: una
        ? pick(
            `È sera e una tapparella è ancora alzata: ${nomi(alzate, l)}`,
            `It's evening and a shutter is still up: ${nomi(alzate, l)}`,
            l,
          )
        : pick(
            `È sera e ${alzate.length} tapparelle sono ancora alzate: ${nomi(alzate, l)}`,
            `It's evening and ${alzate.length} shutters are still up: ${nomi(alzate, l)}`,
            l,
          ),
      motivo: una
        ? pick("Non c'è nessuno in casa: la abbasso?", "Nobody is home: lower it?", l)
        : pick("Non c'è nessuno in casa: le abbasso?", "Nobody is home: lower them?", l),
      azioni: [
        {
          etichetta: una ? pick("Chiudi", "Close", l) : pick("Chiudi tutte", "Close all", l),
          servizio: servizio(
            "cover",
            "close_cover",
            alzate.map((t) => t.entity),
          ),
        },
      ],
      entita: alzate.map((t) => t.entity),
    },
  ];
});

/* 17. Il bucato (o i piatti) finito e ancora dentro. */
const PAROLE_DEL_FINITO = {
  lavatrice: ["Stendi il bucato", "Hang out the laundry"],
  asciugatrice: ["Togli i panni dall'asciugatrice", "Empty the dryer"],
  lavastoviglie: ["Svuota la lavastoviglie", "Empty the dishwasher"],
};
/* Il frigo, il congelatore, il clima, il boiler non «finiscono»: vanno sempre,
 * e si fermano e ripartono da soli. Che il compressore si sia fermato non e'
 * una cosa da fare. */
const SEMPRE_ACCESI =
  /(frig|fridge|refriger|freez|congel|cantinett|wine|cooler|air-conditioner|condizion|clima|fan|ventil|boiler|scaldabagn|pompa di calore|heat ?pump|deumid|dehumid|acquari|router|server|\bnas\b)/i;
const eUnCiclo = (f) => !SEMPRE_ACCESI.test(`${f.tipo || ""} ${f.name || ""} ${f.id || ""}`);

/* Da quando ha senso dirlo: il bucato finito alle tre di notte (l'avvio
 * ritardato) si dice alle sette, e le sei ore per stenderlo cominciano li'. */
function daQuandoDirlo(finitoIl, o) {
  const data = new Date(finitoIl);
  const ora = data.getHours();
  if (ora >= 6 && ora < o.notteDalle) return finitoIl;
  const mattina = new Date(data);
  if (ora >= 6) mattina.setDate(mattina.getDate() + 1);
  mattina.setHours(7, 0, 0, 0);
  return mattina.getTime();
}

rilevatore("finito", "elettrodomestici", (c, o, l) => {
  if (eNotte(c, o) && (numero(c.ora) ?? 12) < 6) return [];
  return elenco(c.finiti)
    .filter((f) => eUnCiclo(f))
    .filter((f) => {
      const da = daQuandoDirlo(f.finitoIl, o);
      return c.adesso >= da && c.adesso - da < 6 * ORA;
    })
    .map((f) => {
      const parole = PAROLE_DEL_FINITO[f.tipo];
      const da = c.adesso - f.finitoIl;
      return {
        urgenza: da > 45 * MINUTO ? "oggi" : "idea",
        disegno: "check",
        titolo: parole
          ? pick(parole[0], parole[1], l)
          : pick(`${f.name} ha finito`, `${f.name} is done`, l),
        /* Il titolo col nome lo dice gia': sotto basta quando. */
        motivo: parole
          ? pick(
              `${f.name} ha finito ${durata(da, l)} fa.`,
              `${f.name} finished ${durata(da, l)} ago.`,
              l,
            )
          : pick(`Finito ${durata(da, l)} fa.`, `Finished ${durata(da, l)} ago.`, l),
        azioni: [fatto(l)],
        entita: [f.entity || f.id],
        /* «Fatto» qui vuol dire «l'ho svuotata»: la casa non lo vede, e non
         * lo ridice finche' la macchina non riparte. */
        verificabile: false,
      };
    });
});

/* Quanto sole avanza adesso, in watt: la produzione meno quello che la casa
 * consuma, o quello che si sta regalando alla rete. */
export function soleCheAvanza(energia = {}) {
  const solare = numero(energia.solare);
  const casa = numero(energia.casa);
  const rete = numero(energia.rete);
  const daiConti = solare !== null && casa !== null ? solare - casa : null;
  const venduti = rete !== null && rete < 0 ? -rete : null;
  return Math.max(daiConti ?? 0, venduti ?? 0);
}

const SOLE_CHE_BASTA = 1200;

function giorno(c) {
  const ora = numero(c.ora) ?? 12;
  return ora >= 8 && ora < 19;
}

/* Il sole tiene anche nelle prossime ore? Lo dicono le previsioni. */
function soleCheDura(c) {
  return Boolean(c.meteo?.soleNelleProssimeOre);
}

const A_CICLO = ["lavatrice", "lavastoviglie", "asciugatrice"];

/* Una macchina che si puo' far partire adesso: ferma o in attesa, non
 * irraggiungibile, e non piena di un bucato appena finito — proporre «Avvia
 * la lavatrice» accanto a «Stendi il bucato» era dire due cose che non
 * stanno insieme. */
function prontaDaAvviare(c, a) {
  if (!A_CICLO.includes(a.tipo) || !["off", "standby"].includes(pulito(a.mode))) return false;
  const id = pulito(a.id || a.entity);
  const piena = elenco(c.finiti).some(
    (f) => pulito(f.id || f.entity) === id && c.adesso - (numero(f.finitoIl) || 0) < 6 * ORA,
  );
  return !piena;
}

/* 18. Il sole avanza: e' il momento della lavatrice, della lavastoviglie. */
rilevatore("sole-elettrodomestico", "risparmio", (c, o, l) => {
  const avanza = soleCheAvanza(c.energia);
  if (avanza < SOLE_CHE_BASTA || !giorno(c)) return [];
  /* Con nessuno in casa si propone solo quello che parte da remoto. */
  const pronti = elenco(c.elettrodomestici).filter((a) => a.avvia && prontaDaAvviare(c, a));
  const kw = decimale(avanza / 1000, l);
  return pronti.slice(0, 2).map((a) => ({
    urgenza: "idea",
    disegno: "solar",
    titolo: pick(`Avvia ${a.name} col sole`, `Start ${a.name} on solar`, l),
    motivo: soleCheDura(c)
      ? pick(
          `Avanzano ${kw} kW e il sole tiene anche nelle prossime ore.`,
          `${kw} kW to spare, and the sun holds for the next hours.`,
          l,
        )
      : pick(
          `Adesso avanzano ${kw} kW dal fotovoltaico.`,
          `${kw} kW of solar to spare right now.`,
          l,
        ),
    azioni: [{ etichetta: pick("Avvia", "Start", l), servizio: a.avvia }],
    entita: [a.entity || a.id],
  }));
});

/* 19. La fascia piu' cara e una macchina appena accesa: fra poco costa meno.
 * «Appena accesa» e' quella passata da spenta a pronta negli ultimi venti
 * minuti — chi l'ha caricata sta per farla partire. Col sole che avanza il
 * conto lo fa il sole, e questa tace. */
rilevatore("fascia-cara", "risparmio", (c, o, l) => {
  const tariffa = c.tariffa;
  const dopo = tariffa?.prossima;
  if (!tariffa?.piuCara || !dopo || dopo.fra > 4 * ORA) return [];
  const prezzo = numero(tariffa.prezzo);
  const risparmio = prezzo > 0 ? Math.round((1 - numero(dopo.prezzo) / prezzo) * 100) : 0;
  if (risparmio < 20) return [];
  if (soleCheAvanza(c.energia) >= SOLE_CHE_BASTA && giorno(c)) return [];
  const pronte = elenco(c.elettrodomestici).filter(
    (a) =>
      prontaDaAvviare(c, a) &&
      pulito(a.mode) === "standby" &&
      numero(a.prontaDa) !== null &&
      c.adesso - numero(a.prontaDa) <= 20 * MINUTO,
  );
  const alle = pulito(dopo.alle);
  return pronte.slice(0, 1).map((a) => ({
    urgenza: "oggi",
    disegno: "power",
    titolo: pick(
      `${a.name}: meglio aspettare le ${alle}`,
      `${a.name}: better wait until ${alle}`,
      l,
    ),
    motivo: pick(
      `Adesso è la fascia più cara: dalle ${alle} costa ${conLArticolo(risparmio, "il")}% in meno.`,
      `This is the priciest band: from ${alle} it costs ${risparmio}% less.`,
      l,
    ),
    azioni: [fatto(l)],
    entita: [a.entity || a.id],
    verificabile: false,
  }));
});

/* 20. Il sole avanza e l'auto e' attaccata ma non carica. */
rilevatore("sole-auto", "risparmio", (c, o, l) => {
  const avanza = soleCheAvanza(c.energia);
  if (avanza < SOLE_CHE_BASTA * 1.5 || !giorno(c)) return [];
  const kw = decimale(avanza / 1000, l);
  return elenco(c.auto)
    .filter(
      (v) =>
        v.attaccata &&
        !((numero(v.kw) || 0) > 0.2) &&
        (numero(v.percentuale) ?? 0) < (numero(v.target) ?? 100),
    )
    .slice(0, 1)
    .map((v) => ({ v, auto: pulito(v.nome) || pick("l'auto", "the car", l) }))
    .map(({ v, auto }) => ({
      urgenza: "idea",
      disegno: "ev",
      titolo: pick(`Carica ${auto} col sole`, `Charge ${auto} on solar`, l),
      motivo: pick(
        `È attaccata e avanzano ${kw} kW.`,
        `It's plugged in and ${kw} kW are spare.`,
        l,
      ),
      azioni: [vedi(l, "ev", "ev")],
      entita: [`auto:${pulito(v.nome)}`],
    }));
});

/* 21. La rete tira troppo mentre qualcosa di rimandabile lavora. «Vicino» e
 * «sopra» la soglia non sono la stessa cosa; e senza una soglia scritta da
 * chi abita la casa (tremila watt per supposizione) non si grida «urgente». */
rilevatore("rete-alta", "risparmio", (c, o, l) => {
  const rete = numero(c.energia?.rete);
  const scritta = numero(c.energia?.soglia);
  const soglia = scritta || 3000;
  if (rete === null || rete < soglia * 0.85) return [];
  const accesi = elenco(c.elettrodomestici).filter((a) => a.mode === "running");
  const kw = decimale(rete / 1000, l);
  const sopra = rete >= soglia;
  const stato = sopra
    ? pick("Hai superato la soglia del contatore.", "You're over the meter's limit.", l)
    : pick("Sei vicino alla soglia del contatore.", "You're near the meter's limit.", l);
  const domanda = !accesi.length
    ? ""
    : accesi.length === 1
      ? pick(`Si può rimandare ${nomi(accesi, l, "m")}?`, `Can ${nomi(accesi, l, "m")} wait?`, l)
      : pick(
          `Si possono rimandare ${nomi(accesi, l, "m")}?`,
          `Can ${nomi(accesi, l, "m")} wait?`,
          l,
        );
  return [
    {
      urgenza: sopra && scritta ? "urgente" : "oggi",
      disegno: "power",
      titolo: pick(
        `La casa prende ${kw} kW dalla rete`,
        `The house is drawing ${kw} kW from the grid`,
        l,
      ),
      motivo: domanda ? `${stato} ${domanda}` : stato,
      azioni: [vedi(l, "energy")],
      entita: ["energia:rete"],
    },
  ];
});

/* 22. Il ritiro dei rifiuti: stasera per domani, o stamattina per oggi. Due
 * sacchi lo stesso giorno sono un promemoria solo: «Porta fuori: Plastica e
 * Carta». */
rilevatore("rifiuti", "promemoria", (c, o, l) => {
  const ora = numero(c.ora) ?? 12;
  const quando = elenco(c.rifiuti).filter(
    (r) => (r.quando === "domani" && ora >= 17) || (r.quando === "oggi" && ora < 10),
  );
  if (!quando.length) return [];
  /* Domani e oggi insieme non si mescolano: vince il piu' vicino. */
  const giorno = quando.some((r) => r.quando === "oggi") ? "oggi" : "domani";
  const sacchi = quando.filter((r) => r.quando === giorno);
  return [
    {
      urgenza: "oggi",
      disegno: "list",
      titolo: pick(`Porta fuori: ${nomi(sacchi, l, "m")}`, `Take out: ${nomi(sacchi, l, "m")}`, l),
      motivo:
        giorno === "domani"
          ? pick("Il ritiro è domani mattina.", "Collection is tomorrow morning.", l)
          : pick("Il ritiro è stamattina.", "Collection is this morning.", l),
      azioni: [fatto(l)],
      entita: sacchi.map((r) => `rifiuti:${pulito(r.name)}`),
      scade: c.adesso + 12 * ORA,
      verificabile: false,
    },
  ];
});

/* 23. Un appuntamento che sta per cominciare. */
rilevatore("evento", "promemoria", (c, o, l) =>
  elenco(c.eventi)
    .filter((e) => !e.tuttoIlGiorno && e.inizio > c.adesso && e.inizio - c.adesso <= 90 * MINUTO)
    .slice(0, 1)
    .map((e) => ({ e, cosa: pulito(e.summary) || pick("Un impegno", "An appointment", l) }))
    .map(({ e, cosa }) => ({
      urgenza: e.inizio - c.adesso <= 30 * MINUTO ? "oggi" : "idea",
      disegno: "calendar",
      titolo: pick(
        `${cosa} fra ${durata(e.inizio - c.adesso, l)}`,
        `${cosa} in ${durata(e.inizio - c.adesso, l)}`,
        l,
      ),
      motivo: pick("Dal calendario di casa.", "From the home calendar.", l),
      azioni: [vedi(l, "", "agenda")],
      entita: [`evento:${pulito(e.summary)}:${e.inizio}`],
      scade: e.inizio,
      verificabile: false,
    })),
);

/* 24. Stanze troppo calde o troppo fredde, con qualcuno in casa. Tutte in
 * una frase, e con il perche' che serve: la finestra aperta nella stanza
 * fredda, il fresco di fuori per la stanza calda — o il caldo di fuori, che
 * dice di tenere chiuso. «Studio è fredda» non concordava: adesso «Studio:
 * fa freddo, 16,0°». Una stanza col suo riscaldamento acceso si sta gia'
 * scaldando, e non se ne parla. */
rilevatore("comfort", "comfort", (c, o, l) => {
  if (casaVuota(c)) return [];
  const notte = eNotte(c, o);
  const sotto = notte ? 16 : 17;
  const sopra = 28;
  const scalda = (stanza) =>
    elenco(c.clima).some(
      (u) => u.on && /heat|auto/.test(pulito(u.mode)) && stessaStanza(u.stanza, stanza),
    );
  const misurate = stanzeDiCasa(c)
    .map((s) => ({ ...s, t: numero(s.temperatura) }))
    .filter((s) => s.t !== null);
  const fredde = misurate.filter((s) => s.t < sotto && !scalda(s.name));
  const calde = misurate.filter((s) => s.t > sopra);
  const conGradi = (stanze) =>
    stanze.map((s) => ({ name: `${s.name} ${decimale(s.t, l)}°`, entity: s.entity }));
  const fuori = [];
  if (fredde.length) {
    const aperta = fredde.some((s) => finestreDi(c, s.name).length);
    const una = fredde.length === 1;
    const gradi = decimale(fredde[0].t, l);
    fuori.push({
      urgenza: "idea",
      disegno: "thermometer",
      titolo: una
        ? pick(
            `${fredde[0].name}: fa freddo, ${gradi}°`,
            `${fredde[0].name}: it's cold, ${gradi}°`,
            l,
          )
        : pick(
            `Fa freddo in ${fredde.length} stanze: ${nomi(conGradi(fredde), l)}`,
            `It's cold in ${fredde.length} rooms: ${nomi(conGradi(fredde), l)}`,
            l,
          ),
      motivo: aperta
        ? pick(
            "C'è una finestra aperta: meglio chiuderla.",
            "A window is open: better close it.",
            l,
          )
        : pick("Vuoi regolare il clima?", "Adjust the climate?", l),
      azioni: [vedi(l, "clima", "clima")],
      entita: fredde.map((s) => s.entity || `stanza:${pulito(s.name)}`),
    });
  }
  if (calde.length) {
    const una = calde.length === 1;
    const gradi = decimale(calde[0].t, l);
    const esterni = tempFuori(c);
    const piove = (pioveFra(c) ?? Infinity) <= 60;
    const piuFresca = Math.min(...calde.map((s) => s.t));
    let motivo = pick("Vuoi regolare il clima?", "Adjust the climate?", l);
    if (esterni !== null && esterni <= piuFresca - 3 && !piove)
      motivo = pick(
        `Fuori ci sono ${decimale(esterni, l)}°: apri le finestre per rinfrescare.`,
        `It's ${decimale(esterni, l)}° outside: open the windows to cool down.`,
        l,
      );
    else if (esterni !== null && esterni >= piuFresca)
      motivo = pick(
        `Fuori fa ancora più caldo (${decimale(esterni, l)}°): tieni chiuso e abbassa le tapparelle.`,
        `It's even hotter outside (${decimale(esterni, l)}°): keep closed and lower the shutters.`,
        l,
      );
    fuori.push({
      urgenza: "idea",
      disegno: "thermometer",
      titolo: una
        ? pick(`${calde[0].name}: fa caldo, ${gradi}°`, `${calde[0].name}: it's hot, ${gradi}°`, l)
        : pick(
            `Fa caldo in ${calde.length} stanze: ${nomi(conGradi(calde), l)}`,
            `It's hot in ${calde.length} rooms: ${nomi(conGradi(calde), l)}`,
            l,
          ),
      motivo,
      azioni: [vedi(l, "clima", "clima")],
      entita: calde.map((s) => s.entity || `stanza:${pulito(s.name)}`),
    });
  }
  return fuori;
});

/* L'umidita' oltre la quale si dice di arieggiare: quella scritta da chi
 * abita la casa per le finestre (`cd_umidita_soglia`), o settanta. `null`
 * vuol dire che l'ha spenta. */
function sogliaDellUmidita(c) {
  if (c.sogliaUmidita === null) return null;
  return numero(c.sogliaUmidita) ?? 70;
}

/* Arieggiare asciuga la stanza solo se fuori l'aria e' piu' secca — non
 * l'umidita' relativa, i grammi d'acqua: il 90% a 8 gradi e' piu' secco del
 * 65% a 22. E sotto la pioggia non si apre. */
function arieggiareAsciuga(c, stanza) {
  if ((pioveFra(c) ?? Infinity) === 0) return false;
  const dentro = umiditaAssoluta(stanza.temperatura, stanza.umidita);
  const fuori = umiditaAssoluta(tempFuori(c), umidFuori(c));
  if (dentro === null || fuori === null) return true;
  return fuori < dentro * 0.9;
}

/* 25. Aria da cambiare: CO2 alta o troppa umidita'. Non in una stanza che ha
 * gia' la finestra aperta: sta gia' arieggiando. */
rilevatore("aria", "comfort", (c, o, l) => {
  if (casaVuota(c)) return [];
  const fuori = [];
  const co2 = stanzeDiCasa(c)
    .filter((s) => (numero(s.co2) || 0) >= 1200 && !finestreDi(c, s.name).length)
    .sort((a, b) => numero(b.co2) - numero(a.co2))[0];
  const ppm = co2 ? Math.round(co2.co2) : 0;
  if (co2)
    fuori.push({
      urgenza: ppm >= 1600 ? "oggi" : "idea",
      disegno: "wind",
      titolo: pick(`${co2.name}: aria pesante`, `${co2.name}: stale air`, l),
      motivo: pick(
        `CO₂ a ${ppm} ppm: apri la finestra per qualche minuto.`,
        `CO₂ at ${ppm} ppm: open a window for a few minutes.`,
        l,
      ),
      azioni: [fatto(l)],
      entita: [co2.entityCo2 || `co2:${pulito(co2.name)}`],
    });
  const soglia = sogliaDellUmidita(c);
  const umida =
    soglia === null
      ? null
      : stanzeDiCasa(c)
          .filter((s) => (numero(s.umidita) || 0) >= soglia && !finestreDi(c, s.name).length)
          .filter((s) => arieggiareAsciuga(c, s))
          .sort((a, b) => numero(b.umidita) - numero(a.umidita))[0];
  const percento = umida ? Math.round(umida.umidita) : 0;
  if (umida)
    fuori.push({
      urgenza: "idea",
      disegno: "humidity",
      titolo: pick(
        `${umida.name}: umidità ${conLArticolo(percento)}%`,
        `${umida.name}: humidity at ${percento}%`,
        l,
      ),
      motivo:
        umidFuori(c) !== null
          ? pick(
              "Fuori l'aria è più secca: arieggia qualche minuto.",
              "The air outside is drier: let some air in for a few minutes.",
              l,
            )
          : pick("Arieggia un po'.", "Let some air in.", l),
      azioni: [fatto(l)],
      entita: [`umidita:${pulito(umida.name)}`],
    });
  return fuori;
});

/* 26. Batterie dei sensori scariche. Sotto il dieci per cento non e' piu'
 * un'idea: e' una cosa da fare oggi. */
rilevatore("batterie", "manutenzione", (c, o, l) => {
  const scariche = elenco(c.batterie)
    .filter((b) => numero(b.level) !== null)
    .sort((a, b) => numero(a.level) - numero(b.level));
  if (!scariche.length) return [];
  const prima = scariche[0];
  const livello = Math.round(prima.level);
  return [
    {
      urgenza: livello <= 10 ? "oggi" : "idea",
      disegno: "battery",
      titolo:
        scariche.length === 1
          ? pick(`Batteria quasi scarica: ${prima.name}`, `Battery low: ${prima.name}`, l)
          : pick(
              `${scariche.length} batterie quasi scariche`,
              `${scariche.length} batteries low`,
              l,
            ),
      motivo:
        scariche.length === 1
          ? pick(
              `${prima.name} è ${conLArticolo(livello)}%.`,
              `${prima.name} is at ${livello}%.`,
              l,
            )
          : pick(
              `La più scarica è ${prima.name}, ${conLArticolo(livello)}%.`,
              `The lowest is ${prima.name}, at ${livello}%.`,
              l,
            ),
      azioni: [vedi(l, "", "batterie")],
      entita: scariche.map((b) => pulito(b.entity) || `batteria:${pulito(b.name)}`),
    },
  ];
});

/* 27. Dispositivi che non rispondono da ore. */
rilevatore("non-rispondono", "manutenzione", (c, o, l) => {
  const muti = elenco(c.nonRispondono).filter(
    (m) => !numero(m.da) || c.adesso - numero(m.da) >= 2 * ORA,
  );
  if (!muti.length) return [];
  return [
    {
      urgenza: "idea",
      disegno: "warning",
      titolo:
        muti.length === 1
          ? pick(`${muti[0].name} non risponde`, `${muti[0].name} is not answering`, l)
          : pick(
              `${muti.length} dispositivi non rispondono`,
              `${muti.length} devices are not answering`,
              l,
            ),
      motivo: pick("Da più di due ore.", "For more than two hours.", l),
      azioni: [vedi(l, "", "nonrisponde")],
      entita: muti.map((m) => pulito(m.entity) || `muto:${pulito(m.name)}`),
    },
  ];
});

/* 28. Aggiornamenti in attesa. */
rilevatore("aggiornamenti", "manutenzione", (c, o, l) => {
  const tutti = elenco(c.aggiornamenti);
  const quanti = tutti.length;
  if (!quanti) return [];
  return [
    {
      urgenza: "idea",
      disegno: "refresh",
      titolo:
        quanti === 1
          ? pick("C'è un aggiornamento da installare", "There is an update to install", l)
          : pick(
              `Ci sono ${quanti} aggiornamenti da installare`,
              `There are ${quanti} updates to install`,
              l,
            ),
      motivo: pick("Con calma, quando hai un minuto.", "No rush, when you have a minute.", l),
      azioni: [vedi(l, "", "aggiornamenti")],
      /* Un aggiornamento nuovo e' una situazione nuova: lo ✕ di quelli di
       * prima non lo copre. */
      entita: tutti.map((a, i) => pulito(a.entity) || `aggiornamento:${i}`),
    },
  ];
});

/** I tipi che il motore sa riconoscere, nell'ordine in cui guarda. */
export const TIPI_DI_SUGGERIMENTO = Object.freeze(RILEVATORI.map((r) => r.tipo));

/* ── la memoria: quello che la casa ha imparato ──────────────────────────── */

/* Uno ✕ pesa per due settimane, poi si dimentica piano. */
const DIMENTICA_IN = 14 * GIORNO;
/* Scartato con la ✕, quel suggerimento tace finche' la situazione resta
 * quella — ma non oltre tre giorni, e non se nel frattempo e' diventato piu'
 * urgente (la batteria dal 15 al 5 per cento). */
const NASCOSTO_DOPO_UN_NO = 3 * GIORNO;
/* Un tipo scartato spesso tace, ma non per sempre: un'ora dopo l'ultimo ✕
 * la casa torna a guardare, e se la cosa c'e' ancora lo ridice. Scartarlo di
 * nuovo lo fa tacere un'altra ora. */
const TIPO_TACE_PER = ORA;
/* Un «Fatto» copre la cosa per un'ora; se dopo un'ora e' ancora li', la casa
 * lo ridice, con garbo: «Avevi segnato Fatto, ma è ancora così». Quello che
 * la casa non puo' vedere (il bucato steso, il sacco portato fuori) resta
 * fatto finche' la cosa non smette. */
const FATTO_VALE_PER = ORA;
/* L'urgente — l'acqua, il fumo, la porta aperta con la casa vuota — non si
 * rimanda e non si impara a tacerlo: uno ✕ lo toglie dalla vista per un quarto
 * d'ora, il tempo di andare a vedere, e poi torna se la cosa c'e' ancora. */
const URGENTE_TACE_PER = 15 * MINUTO;
/* Una cosa che sparisce per un giro (un sensore che perde il segnale per un
 * attimo) non e' finita: la memoria la lascia andare dopo cinque minuti. */
const ASSENTE_PER = 5 * MINUTO;
/* Le istanze ricordate non crescono per sempre. */
const ISTANZE_MASSIME = 60;

const URGENZE = ["idea", "oggi", "urgente"];
const grado = (urgenza) => URGENZE.indexOf(pulito(urgenza));

/** La memoria ripulita. */
export function memoriaPulita(salvata) {
  const dato = salvata && typeof salvata === "object" && !Array.isArray(salvata) ? salvata : {};
  const tipi = {};
  for (const [tipo, voce] of Object.entries(
    dato.tipi && typeof dato.tipi === "object" ? dato.tipi : {},
  )) {
    if (!TIPI_DI_SUGGERIMENTO.includes(tipo)) continue;
    tipi[tipo] = {
      no: Math.max(0, numero(voce?.no) || 0),
      si: Math.max(0, numero(voce?.si) || 0),
      ultimo: numero(voce?.ultimo) || 0,
    };
  }
  const istanze = {};
  for (const [id, voce] of Object.entries(
    dato.istanze && typeof dato.istanze === "object" ? dato.istanze : {},
  ).slice(-ISTANZE_MASSIME)) {
    const fino = numero(voce?.fino) || 0;
    const fatto = voce?.fatto === true;
    if (!(fino > 0 || fatto)) continue;
    const pulita = { fino, fatto };
    if (voce?.no === true) pulita.no = true;
    if (URGENZE.includes(pulito(voce?.urgenza))) pulita.urgenza = pulito(voce.urgenza);
    if (fatto && ["fatto", "si"].includes(pulito(voce?.come))) pulita.come = pulito(voce.come);
    if (numero(voce?.via)) pulita.via = numero(voce.via);
    istanze[pulito(id)] = pulita;
  }
  return { tipi, istanze };
}

/**
 * Quanto pesa un tipo per questa casa: 1 nuovo, meno se scartato spesso.
 * Uno ✕ lo porta a meta', due a un terzo, tre sotto la soglia del silenzio;
 * ogni volta che lo si e' usato lo rialza.
 */
export function pesoDelTipo(memoria, tipo, adesso) {
  const voce = memoriaPulita(memoria).tipi[tipo];
  if (!voce) return 1;
  const vecchiaia = Math.max(0, adesso - voce.ultimo) / DIMENTICA_IN;
  const no = voce.no * 0.5 ** vecchiaia;
  return Math.min(1, (1 + voce.si) / (1 + voce.si + no));
}

/**
 * La memoria dopo una risposta: `no` (✕), `tardi` (con `fino`), `fatto`, o
 * `si` (l'azione principale eseguita).
 */
export function conLaRisposta(memoria, suggerimento, risposta, adesso, fino = 0) {
  const m = memoriaPulita(memoria);
  const tipo = pulito(suggerimento?.tipo);
  const id = pulito(suggerimento?.id);
  if (!id) return m;
  const voce = m.tipi[tipo] || { no: 0, si: 0, ultimo: 0 };
  /* Chi riscrive la stessa istanza la mette in fondo: e' la piu' fresca, e
   * l'ultima a essere dimenticata quando le istanze sono troppe. */
  delete m.istanze[id];
  if (suggerimento?.urgenza === "urgente" && (risposta === "no" || risposta === "tardi")) {
    m.istanze[id] = { fino: adesso + URGENTE_TACE_PER, fatto: false };
  } else if (risposta === "no") {
    const vecchiaia = Math.max(0, adesso - voce.ultimo) / DIMENTICA_IN;
    m.tipi[tipo] = { ...voce, no: voce.no * 0.5 ** vecchiaia + 1, ultimo: adesso };
    m.istanze[id] = {
      fino: adesso + NASCOSTO_DOPO_UN_NO,
      fatto: false,
      no: true,
      urgenza: URGENZE.includes(pulito(suggerimento?.urgenza))
        ? pulito(suggerimento.urgenza)
        : "idea",
    };
  } else if (risposta === "tardi") {
    m.istanze[id] = { fino: Math.max(adesso + MINUTO, numero(fino) || adesso + ORA), fatto: false };
  } else if (risposta === "fatto" || risposta === "si") {
    m.tipi[tipo] = { ...voce, si: voce.si + 1, ultimo: adesso };
    m.istanze[id] = { fino: adesso + FATTO_VALE_PER, fatto: true, come: risposta };
  }
  if (!TIPI_DI_SUGGERIMENTO.includes(tipo)) delete m.tipi[tipo];
  return memoriaPulita(m);
}

/* L'ora di quell'istante, nel fuso di chi guarda, e lo stesso giorno a
 * un'altra ora. */
const oraDi = (istante) => new Date(istante).getHours() + new Date(istante).getMinutes() / 60;
function alleOre(istante, ore, giorniDopo = 0) {
  const data = new Date(istante);
  data.setDate(data.getDate() + giorniDopo);
  data.setHours(ore, 0, 0, 0);
  return data.getTime();
}

/**
 * Le scelte di «Più tardi» che hanno senso adesso. Di giorno: fra un'ora,
 * stasera, domani. Dalle sei e mezza di sera «stasera» e' gia' adesso, e
 * resta fra un'ora o domani. Di notte (dalle 23 alle 7) un'ora dopo e' ancora
 * notte: si rimanda a domattina, e basta.
 */
export function rinviPossibili(adesso) {
  const ora = oraDi(adesso);
  if (ora >= 23 || ora < 7) return ["domattina"];
  if (ora >= 18.5) return ["ora", "domani"];
  return ["ora", "stasera", "domani"];
}

/**
 * Fino a quando rimandare: fra un'ora, stasera alle 19 (o fra un'ora se e'
 * gia' sera), domani alle 8, domattina alle 8. Mai nel cuore della notte: un
 * rinvio che cadrebbe fra mezzanotte e le sette va alle otto. `adesso` e' un
 * istante; i conti delle ore si fanno nel fuso di chi guarda.
 */
export function finoA(scelta, adesso) {
  let fino;
  if (scelta === "stasera") {
    const sera = alleOre(adesso, 19);
    fino = sera > adesso + 30 * MINUTO ? sera : adesso + ORA;
  } else if (scelta === "domani") fino = alleOre(adesso, 8, 1);
  else if (scelta === "domattina") fino = alleOre(adesso, 8, oraDi(adesso) < 8 ? 0 : 1);
  else fino = adesso + ORA;
  if (oraDi(fino) < 7) fino = alleOre(fino, 8);
  return fino;
}

/**
 * La memoria senza le istanze che non servono piu': un «Fatto» o uno ✕
 * valgono finche' la cosa c'e'; quando smette di esserci (per piu' di
 * cinque minuti: un sensore che sparisce per un giro non conta), la volta
 * dopo torna a farsi vedere. Un rinvio scaduto non serve piu'.
 */
export function memoriaDopo(memoria, idPresenti, adesso) {
  const m = memoriaPulita(memoria);
  const presenti = new Set(idPresenti);
  for (const [id, voce] of Object.entries(m.istanze)) {
    const ricorda = voce.fatto || voce.no;
    if (ricorda && !presenti.has(id)) {
      if (!voce.via) voce.via = adesso;
      else if (adesso - voce.via >= ASSENTE_PER) {
        delete m.istanze[id];
        continue;
      }
    } else delete voce.via;
    if (!voce.fatto && voce.fino <= adesso) delete m.istanze[id];
  }
  return m;
}

/* ── l'ordine ─────────────────────────────────────────────────────────────── */

const PESO_URGENZA = { urgente: 3, oggi: 2, idea: 1 };

/* Un'identita' ferma per ogni suggerimento: il tipo e le cose di cui parla.
 * E' quella che la memoria ricorda: la stessa luce accesa domani e' lo stesso
 * suggerimento, e un «Fatto» di ieri lo copre finche' la cosa non smette. */
function identita(tipo, entita) {
  return `${tipo}:${[...entita].sort().join(",")}`;
}

/* Quello che la memoria dice di un suggerimento: nascosto, o da ridire con
 * garbo perche' era «Fatto» e la cosa c'e' ancora. */
function comeLoRicorda(s, istanza, adesso) {
  if (!istanza) return "visibile";
  if (istanza.no) {
    if (istanza.fino > adesso && grado(s.urgenza) <= grado(istanza.urgenza || "urgente"))
      return "nascosto";
    return "visibile";
  }
  if (istanza.fatto) {
    if (s.verificabile === false || istanza.fino > adesso) return "nascosto";
    return "ancora";
  }
  return istanza.fino > adesso ? "nascosto" : "visibile";
}

/**
 * Tutti i suggerimenti di adesso, in ordine: il primo e' quello da dire.
 *
 * `contesto` e' quello che la casa sa; `memoria` quello che ha imparato;
 * `opzioni` quello che chi la abita ha scelto.
 */
export function suggerimentiDellaCasa(
  contesto = {},
  memoria = {},
  opzioni = {},
  lingua = getLocale(),
) {
  const o = opzioniDellAssistente(opzioni);
  const m = memoriaPulita(memoria);
  const c = { ...contesto, adesso: numero(contesto.adesso) ?? Date.now() };
  const notte = eNotte(c, o);
  const tutti = [];
  for (const r of RILEVATORI) {
    if (!o.categorie[r.categoria]) continue;
    let trovati = [];
    try {
      trovati = r.guarda(c, o, lingua) || [];
    } catch (_errore) {
      trovati = [];
    }
    for (const s of trovati) {
      const entita = elenco(s.entita).map(pulito).filter(Boolean);
      tutti.push({
        ...s,
        tipo: r.tipo,
        categoria: r.categoria,
        entita,
        id: identita(r.tipo, entita),
      });
    }
  }
  const visibili = [];
  for (const s of tutti) {
    const come = comeLoRicorda(s, m.istanze[s.id], c.adesso);
    if (come === "nascosto") continue;
    if (s.scade && s.scade < c.adesso) continue;
    if (o.sensibilita === "poco" && s.urgenza === "idea") continue;
    /* Di notte le idee del comfort e della manutenzione aspettano il
     * mattino: un aggiornamento da installare alle tre non e' un consiglio. */
    if (
      notte &&
      o.sensibilita !== "tutto" &&
      s.urgenza === "idea" &&
      ["comfort", "manutenzione"].includes(s.categoria)
    )
      continue;
    if (come === "ancora") {
      const nota =
        m.istanze[s.id].come === "si"
          ? pick("Ci ho provato, ma è ancora così.", "I tried, but it's still the case.", lingua)
          : pick(
              "L'avevi segnato come fatto, ma è ancora così.",
              "You marked it as done, but it's still the case.",
              lingua,
            );
      visibili.push({ ...s, ancora: true, motivo: `${nota} ${s.motivo}` });
    } else visibili.push(s);
  }
  const conPunti = visibili.map((s) => {
    const peso = pesoDelTipo(m, s.tipo, c.adesso);
    return {
      ...s,
      peso,
      punti: PESO_URGENZA[s.urgenza] * 1000 + (AMBITO[s.tipo] || 0) * 100 + peso * 50,
    };
  });
  /* Un tipo scartato quasi sempre tace — l'urgente no, mai — a meno che non
   * si sia chiesto di vedere tutto, o che sia passata un'ora dall'ultimo ✕. */
  const ascoltati = conPunti.filter(
    (s) =>
      s.urgenza === "urgente" ||
      o.sensibilita === "tutto" ||
      s.peso >= 0.3 ||
      c.adesso - (m.tipi[s.tipo]?.ultimo || 0) >= TIPO_TACE_PER,
  );
  ascoltati.sort((a, b) => b.punti - a.punti || a.titolo.localeCompare(b.titolo));
  /* Una cosa, un suggerimento: la luce che e' accesa con la casa vuota non si
   * propone di nuovo come luce accesa di notte. Vince il primo in ordine. */
  const viste = new Set();
  const fuori = [];
  for (const s of ascoltati) {
    if (s.entita.some((e) => viste.has(e))) continue;
    for (const e of s.entita) viste.add(e);
    fuori.push(s);
  }
  return fuori;
}

/* ── le macchine che finiscono ───────────────────────────────────────────── */

/**
 * Quando ha finito ognuna: si ricorda chi lavorava al giro prima, e chi
 * smette di lavorare ha finito adesso. Chi riparte non ha piu' finito.
 * Chi non risponde («unavailable») non ha finito niente: resta com'era —
 * una lavatrice che perde il Wi‑Fi a meta' giro non e' un bucato da stendere.
 * E chi passa da spenta a pronta («standby») si segna l'ora (`pronta`): e'
 * una macchina caricata, che sta per partire.
 * `prima` e `fuori` sono `{ [id]: { lavora, finitoIl, ferma?, pronta? } }`.
 */
export function conIFiniti(prima, macchine, adesso) {
  const fuori = {};
  const vecchie = prima && typeof prima === "object" ? prima : {};
  for (const m of elenco(macchine)) {
    const id = pulito(m.id || m.entity);
    if (!id) continue;
    const era = vecchie[id] || {};
    const modo = pulito(m.mode);
    if (modo === "unavailable" || modo === "unknown") {
      fuori[id] = { lavora: Boolean(era.lavora), finitoIl: numero(era.finitoIl) || 0 };
      if (era.ferma) fuori[id].ferma = true;
      if (numero(era.pronta)) fuori[id].pronta = numero(era.pronta);
      continue;
    }
    const lavora = modo === "running";
    fuori[id] = {
      lavora,
      finitoIl: lavora ? 0 : era.lavora ? adesso : numero(era.finitoIl) || 0,
    };
    if (modo === "off") fuori[id].ferma = true;
    if (modo === "standby" && !era.lavora && (era.ferma || numero(era.pronta)))
      fuori[id].pronta = numero(era.pronta) || adesso;
  }
  return fuori;
}
