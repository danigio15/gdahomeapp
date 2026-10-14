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
 * l'ordine: prima l'urgente, poi quello di oggi, poi le idee; e dentro, quello
 * che chi abita la casa di solito accetta prima di quello che di solito
 * scarta.
 *
 * Impara da chi lo usa, e lo ricorda per tutta la casa (`cd_assistente`): un
 * ✕ nasconde quel suggerimento per un po' e pesa sul suo tipo, «Più tardi» lo
 * rimanda, «Fatto» lo toglie finche' la cosa non si ripresenta. Un tipo
 * scartato spesso smette di farsi vedere; uno urgente — l'acqua, il fumo —
 * non smette mai.
 *
 * Il modulo e' puro: niente DOM, niente Home Assistant, niente orologio. Chi
 * chiama costruisce il contesto con quello che la plancia sa gia' (le tessere
 * della Home, le letture dell'energia, le previsioni) e dice che ora e'.
 */

import { getLocale, pick } from "./i18n.js";

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

/* Un numero con un decimale, con la virgola di chi guarda. */
function decimale(valore, lingua) {
  try {
    return Number(valore).toLocaleString(lingua || undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  } catch (_errore) {
    return Number(valore).toFixed(1);
  }
}

/* Due nomi si scrivono, oltre si conta: «Cucina e Bagno», «Cucina e altre 2». */
function nomi(voci, lingua) {
  const scritti = voci.map((voce) => pulito(voce?.name || voce?.nome || voce?.entity));
  if (scritti.length <= 2) return scritti.join(pick(" e ", " and ", lingua));
  const altre = scritti.length - 1;
  return `${scritti[0]} ${pick(`e altre ${altre}`, `and ${altre} more`, lingua)}`;
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
 * sono. Una casa senza persone configurate non e' una casa vuota. */
function casaVuota(c) {
  const p = c.persone || {};
  return (numero(p.totale) || 0) > 0 && (numero(p.inCasa) || 0) === 0;
}

function daQuandoVuota(c) {
  const uscita = numero(c.persone?.ultimaUscita);
  return uscita ? Math.max(0, c.adesso - uscita) : null;
}

/* Lo stesso confronto di stanza dappertutto: il nome, senza maiuscole. */
const stessaStanza = (a, b) => pulito(a).toLowerCase() === pulito(b).toLowerCase() && pulito(a);

const RILEVATORI = [];
const rilevatore = (tipo, categoria, guarda) => RILEVATORI.push({ tipo, categoria, guarda });

/* 1. L'acqua dove non deve esserci. Prima di tutto il resto. */
rilevatore("acqua", "sicurezza", (c, o, l) => {
  const bagnati = elenco(c.allagamenti);
  if (!bagnati.length) return [];
  const valvola = elenco(c.valvole).find((v) => v.aperta);
  return [
    {
      urgenza: "urgente",
      disegno: "water",
      titolo: pick(`Acqua rilevata: ${nomi(bagnati, l)}`, `Water detected: ${nomi(bagnati, l)}`, l),
      motivo: valvola
        ? pick(
            "Il sensore di allagamento è bagnato: chiudo la valvola?",
            "The leak sensor is wet: shall I close the valve?",
            l,
          )
        : pick("Il sensore di allagamento è bagnato.", "The leak sensor is wet.", l),
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
      motivo: pick(
        "Un rilevatore di fumo o gas sta suonando.",
        "A smoke or gas detector is going off.",
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

/* 4. Il frigo o il congelatore aperto. */
rilevatore("frigo-aperto", "sicurezza", (c, o, l) =>
  elenco(c.frigo)
    .filter((f) => f.aperto && (numero(f.daMs) || 0) >= 3 * MINUTO)
    .map((f) => ({
      urgenza: "urgente",
      disegno: "info",
      titolo: pick(`${f.name} è aperto`, `${f.name} is open`, l),
      motivo: pick(`Da ${durata(f.daMs, l)}.`, `For ${durata(f.daMs, l)}.`, l),
      azioni: [fatto(l)],
      entita: [f.entity],
    })),
);

/* 5. Casa vuota e luci accese. */
rilevatore("vuota-luci", "risparmio", (c, o, l) => {
  if (!casaVuota(c)) return [];
  const accese = elenco(c.luci).filter((x) => x.on);
  if (!accese.length) return [];
  const da = daQuandoVuota(c);
  return [
    {
      urgenza: "oggi",
      disegno: "lights",
      titolo:
        accese.length === 1
          ? pick(
              `Non c'è nessuno in casa, ma ${accese[0].name} è accesa`,
              `Nobody is home, but ${accese[0].name} is on`,
              l,
            )
          : pick(
              `Non c'è nessuno in casa, ma ${accese.length} luci sono accese`,
              `Nobody is home, but ${accese.length} lights are on`,
              l,
            ),
      motivo: da
        ? pick(
            `Casa vuota da ${durata(da, l)}: le spengo?`,
            `Empty for ${durata(da, l)}: turn them off?`,
            l,
          )
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
  if (!casaVuota(c)) return [];
  const accesi = elenco(c.clima).filter((x) => x.on);
  if (!accesi.length) return [];
  return [
    {
      urgenza: "oggi",
      disegno: "radiator",
      titolo: pick(
        `Non c'è nessuno, ma il clima è acceso: ${nomi(accesi, l)}`,
        `Nobody is home, but the climate is on: ${nomi(accesi, l)}`,
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

/* 7. Casa vuota e TV o musica accese. */
rilevatore("vuota-media", "risparmio", (c, o, l) => {
  if (!casaVuota(c)) return [];
  const accesi = elenco(c.media).filter((x) => x.entity);
  if (!accesi.length) return [];
  return [
    {
      urgenza: "oggi",
      disegno: "speaker",
      titolo: pick(
        `Non c'è nessuno, ma ${nomi(accesi, l)} sta suonando`,
        `Nobody is home, but ${nomi(accesi, l)} is playing`,
        l,
      ),
      motivo: pick("La spengo?", "Turn it off?", l),
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

/* 8. Uscendo: l'antifurto non e' inserito. */
rilevatore("vuota-antifurto", "sicurezza", (c, o, l) => {
  const a = c.antifurto;
  if (!casaVuota(c) || !a?.entity || a.inserito || a.scattato) return [];
  return [
    {
      urgenza: "oggi",
      disegno: "security",
      titolo: pick(
        "Siete usciti tutti, ma l'antifurto è spento",
        "Everyone has left, but the alarm is off",
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
              servizio: servizio("alarm_control_panel", "alarm_arm_away", [a.entity]),
            },
      ],
      entita: [a.entity],
    },
  ];
});

/* 9. Serrature aperte: uscendo, o di notte. */
rilevatore("serrature", "sicurezza", (c, o, l) => {
  const aperte = elenco(c.serrature).filter((s) => s.aperta);
  if (!aperte.length) return [];
  const vuota = casaVuota(c);
  const notte = eNotte(c, o);
  if (!vuota && !notte) return [];
  const chiudibili = aperte.filter((s) => pulito(s.entity).startsWith("lock."));
  return [
    {
      urgenza: vuota ? "urgente" : "oggi",
      disegno: "lock",
      titolo: vuota
        ? pick(
            `Casa vuota e ${nomi(aperte, l)} non è chiusa a chiave`,
            `The house is empty and ${nomi(aperte, l)} is unlocked`,
            l,
          )
        : pick(
            `È notte e ${nomi(aperte, l)} non è chiusa a chiave`,
            `It's night and ${nomi(aperte, l)} is unlocked`,
            l,
          ),
      motivo: pick("La chiudo?", "Lock it?", l),
      azioni: [
        chiudibili.length
          ? {
              etichetta: pick("Chiudi", "Lock", l),
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

/* 10. Garage o cancello aperto: uscendo, o di notte. */
rilevatore("garage", "sicurezza", (c, o, l) => {
  const aperti = elenco(c.garage).filter((g) => g.aperto);
  if (!aperti.length) return [];
  const vuota = casaVuota(c);
  if (!vuota && !eNotte(c, o)) return [];
  return aperti.map((g) => ({
    urgenza: vuota ? "urgente" : "oggi",
    disegno: "gate",
    titolo: vuota
      ? pick(`Siete fuori e ${g.name} è aperto`, `You're out and ${g.name} is open`, l)
      : pick(`È notte e ${g.name} è aperto`, `It's night and ${g.name} is open`, l),
    motivo: pick("Lo chiudo?", "Close it?", l),
    azioni: [
      {
        etichetta: pick("Chiudi", "Close", l),
        servizio: servizio("cover", "close_cover", [g.entity]),
      },
    ],
    entita: [g.entity],
  }));
});

/* 11. Casa vuota e finestre o porte aperte: non si chiudono da qui, si dice. */
rilevatore("vuota-aperture", "sicurezza", (c, o, l) => {
  if (!casaVuota(c)) return [];
  const aperte = [...elenco(c.finestre), ...elenco(c.porte)];
  if (!aperte.length) return [];
  return [
    {
      urgenza: "oggi",
      disegno: "window",
      titolo: pick(
        `Siete usciti con ${nomi(aperte, l)} aperta`,
        `You left with ${nomi(aperte, l)} open`,
        l,
      ),
      motivo: pick("Meglio controllare.", "Worth a check.", l),
      azioni: [vedi(l, "", "varchi")],
      entita: aperte.map((a) => a.entity),
    },
  ];
});

/* 12. Finestra aperta col clima acceso nella stessa stanza. */
rilevatore("finestra-clima", "risparmio", (c, o, l) => {
  const fuori = [];
  for (const unita of elenco(c.clima).filter((x) => x.on && x.stanza)) {
    const finestra = elenco(c.finestre).find((f) => stessaStanza(f.stanza, unita.stanza));
    if (!finestra) continue;
    const caldo = /heat/.test(pulito(unita.mode));
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
      motivo: pick(
        `${finestra.name} è aperta: spengo ${unita.name} finché non la chiudi?`,
        `${finestra.name} is open: turn off ${unita.name} until you close it?`,
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
  const fra = numero(c.meteo?.pioggiaFra);
  if (fra === null || fra > 120) return [];
  const finestre = elenco(c.finestre);
  const tende = elenco(c.tende).filter((t) => t.aperta);
  const fuori = [];
  const quando =
    fra <= 5
      ? pick("Sta piovendo", "It's raining", l)
      : pick(`Pioggia fra ${durata(fra * MINUTO, l)}`, `Rain in ${durata(fra * MINUTO, l)}`, l);
  if (finestre.length)
    fuori.push({
      urgenza: fra <= 30 ? "urgente" : "oggi",
      disegno: "storm",
      titolo: pick(
        `${quando} e ${nomi(finestre, l)} è aperta`,
        `${quando} and ${nomi(finestre, l)} is open`,
        l,
      ),
      motivo: pick("Meglio chiuderla prima.", "Better close it first.", l),
      azioni: [fatto(l)],
      entita: finestre.map((f) => f.entity),
    });
  if (tende.length)
    fuori.push({
      urgenza: fra <= 30 ? "urgente" : "oggi",
      disegno: "storm",
      titolo: pick(
        `${quando} e ${nomi(tende, l)} è fuori`,
        `${quando} and ${nomi(tende, l)} is out`,
        l,
      ),
      motivo: pick("La ritiro?", "Retract it?", l),
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

/* 14. Di notte, luci accese dove non c'e' nessuno. */
rilevatore("notte-luci", "risparmio", (c, o, l) => {
  if (!eNotte(c, o) || casaVuota(c)) return [];
  const occupate = new Set(elenco(c.stanzeOccupate).map((s) => pulito(s).toLowerCase()));
  /* Senza sensori di presenza non si sa dove c'e' qualcuno: di notte si
   * guardano solo le luci accese da piu' di un'ora. */
  const sapere = Boolean(c.ciSonoPresenze);
  const accese = elenco(c.luci).filter(
    (x) =>
      x.on &&
      (sapere
        ? x.stanza && !occupate.has(pulito(x.stanza).toLowerCase())
        : (numero(x.daMs) || 0) >= ORA),
  );
  if (!accese.length) return [];
  return [
    {
      urgenza: "idea",
      disegno: "moon",
      titolo:
        accese.length === 1
          ? pick(
              `È tardi e ${accese[0].name} è ancora accesa`,
              `It's late and ${accese[0].name} is still on`,
              l,
            )
          : pick(
              `È tardi e ${accese.length} luci sono ancora accese`,
              `It's late and ${accese.length} lights are still on`,
              l,
            ),
      motivo: sapere
        ? pick("In quelle stanze non c'è nessuno.", "Nobody is in those rooms.", l)
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

/* 15. Il bucato (o i piatti) finito e ancora dentro. */
const PAROLE_DEL_FINITO = {
  lavatrice: ["Stendi il bucato", "Hang out the laundry"],
  asciugatrice: ["Togli i panni dall'asciugatrice", "Empty the dryer"],
  lavastoviglie: ["Svuota la lavastoviglie", "Empty the dishwasher"],
};
rilevatore("finito", "elettrodomestici", (c, o, l) =>
  elenco(c.finiti)
    .filter((f) => c.adesso - f.finitoIl < 6 * ORA)
    .map((f) => {
      const parole = PAROLE_DEL_FINITO[f.tipo];
      const da = c.adesso - f.finitoIl;
      return {
        urgenza: da > 45 * MINUTO ? "oggi" : "idea",
        disegno: "check",
        titolo: parole
          ? pick(parole[0], parole[1], l)
          : pick(`${f.name} ha finito`, `${f.name} is done`, l),
        motivo: pick(
          `${f.name} ha finito ${durata(da, l)} fa.`,
          `${f.name} finished ${durata(da, l)} ago.`,
          l,
        ),
        azioni: [fatto(l)],
        entita: [f.entity || f.id],
      };
    }),
);

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

/* 16. Il sole avanza: e' il momento della lavatrice, della lavastoviglie. */
rilevatore("sole-elettrodomestico", "risparmio", (c, o, l) => {
  const avanza = soleCheAvanza(c.energia);
  if (avanza < SOLE_CHE_BASTA || !giorno(c)) return [];
  /* Con nessuno in casa si propone solo quello che parte da remoto. */
  const pronti = elenco(c.elettrodomestici).filter(
    (a) =>
      a.avvia &&
      a.mode !== "running" &&
      ["lavatrice", "lavastoviglie", "asciugatrice"].includes(a.tipo),
  );
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

/* 17. Il sole avanza e l'auto e' attaccata ma non carica. */
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

/* 18. La rete tira troppo mentre qualcosa di rimandabile lavora. */
rilevatore("rete-alta", "risparmio", (c, o, l) => {
  const rete = numero(c.energia?.rete);
  const soglia = numero(c.energia?.soglia) || 3000;
  if (rete === null || rete < soglia * 0.85) return [];
  const accesi = elenco(c.elettrodomestici).filter((a) => a.mode === "running");
  const kw = decimale(rete / 1000, l);
  return [
    {
      urgenza: rete >= soglia ? "urgente" : "oggi",
      disegno: "power",
      titolo: pick(
        `La casa prende ${kw} kW dalla rete`,
        `The house is drawing ${kw} kW from the grid`,
        l,
      ),
      motivo: accesi.length
        ? pick(
            `Sei vicino alla soglia: ${nomi(accesi, l)} si può rimandare?`,
            `You're near the limit: can ${nomi(accesi, l)} wait?`,
            l,
          )
        : pick("Sei vicino alla soglia del contatore.", "You're near the meter's limit.", l),
      azioni: [vedi(l, "energy")],
      entita: ["energia:rete"],
    },
  ];
});

/* 19. Il ritiro dei rifiuti: stasera per domani, o stamattina per oggi. */
rilevatore("rifiuti", "promemoria", (c, o, l) => {
  const ora = numero(c.ora) ?? 12;
  return elenco(c.rifiuti)
    .filter((r) => (r.quando === "domani" && ora >= 17) || (r.quando === "oggi" && ora < 10))
    .slice(0, 1)
    .map((r) => ({
      urgenza: "oggi",
      disegno: "list",
      titolo: pick(`Porta fuori: ${r.name}`, `Take out: ${r.name}`, l),
      motivo:
        r.quando === "domani"
          ? pick("Il ritiro è domani mattina.", "Collection is tomorrow morning.", l)
          : pick("Il ritiro è stamattina.", "Collection is this morning.", l),
      azioni: [fatto(l)],
      entita: [`rifiuti:${pulito(r.name)}`],
      scade: c.adesso + 12 * ORA,
    }));
});

/* 20. Un appuntamento che sta per cominciare. */
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
    })),
);

/* 21. Stanze troppo calde o troppo fredde, con qualcuno in casa. */
rilevatore("comfort", "comfort", (c, o, l) => {
  if (casaVuota(c)) return [];
  return elenco(c.stanze)
    .filter((s) => {
      const t = numero(s.temperatura);
      return t !== null && (t < 17 || t > 28);
    })
    .slice(0, 1)
    .map((s) => {
      const t = numero(s.temperatura);
      const fredda = t < 17;
      const gradi = decimale(t, l);
      return {
        urgenza: "idea",
        disegno: "thermometer",
        titolo: fredda
          ? pick(`${s.name} è fredda: ${gradi}°`, `${s.name} is cold: ${gradi}°`, l)
          : pick(`${s.name} è calda: ${gradi}°`, `${s.name} is hot: ${gradi}°`, l),
        motivo: pick("Vuoi regolare il clima?", "Adjust the climate?", l),
        azioni: [vedi(l, "clima", "clima")],
        entita: [s.entity || `stanza:${pulito(s.name)}`],
      };
    });
});

/* 22. Aria da cambiare: CO2 alta o troppa umidita'. */
rilevatore("aria", "comfort", (c, o, l) => {
  if (casaVuota(c)) return [];
  const fuori = [];
  const co2 = elenco(c.stanze).find((s) => (numero(s.co2) || 0) >= 1200);
  const ppm = co2 ? Math.round(co2.co2) : 0;
  if (co2)
    fuori.push({
      urgenza: "oggi",
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
  const umida = elenco(c.stanze).find((s) => (numero(s.umidita) || 0) >= 70);
  const percento = umida ? Math.round(umida.umidita) : 0;
  if (umida)
    fuori.push({
      urgenza: "idea",
      disegno: "humidity",
      titolo: pick(
        `${umida.name}: umidità al ${percento}%`,
        `${umida.name}: humidity at ${percento}%`,
        l,
      ),
      motivo: pick("Arieggia un po'.", "Let some air in.", l),
      azioni: [fatto(l)],
      entita: [`umidita:${pulito(umida.name)}`],
    });
  return fuori;
});

/* 23. Batterie dei sensori scariche. */
rilevatore("batterie", "manutenzione", (c, o, l) => {
  const scariche = elenco(c.batterie);
  if (!scariche.length) return [];
  const prima = scariche[0];
  const livello = Math.round(prima.level);
  return [
    {
      urgenza: "idea",
      disegno: "battery",
      titolo:
        scariche.length === 1
          ? pick(`Batteria quasi scarica: ${prima.name}`, `Battery low: ${prima.name}`, l)
          : pick(
              `${scariche.length} batterie quasi scariche`,
              `${scariche.length} batteries low`,
              l,
            ),
      motivo: pick(`${prima.name} è al ${livello}%.`, `${prima.name} is at ${livello}%.`, l),
      azioni: [vedi(l, "", "batterie")],
      entita: ["batterie"],
    },
  ];
});

/* 24. Dispositivi che non rispondono da ore. */
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
      entita: ["non-rispondono"],
    },
  ];
});

/* 25. Aggiornamenti in attesa. */
rilevatore("aggiornamenti", "manutenzione", (c, o, l) => {
  const quanti = elenco(c.aggiornamenti).length;
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
      entita: ["aggiornamenti"],
    },
  ];
});

/** I tipi che il motore sa riconoscere, nell'ordine in cui guarda. */
export const TIPI_DI_SUGGERIMENTO = Object.freeze(RILEVATORI.map((r) => r.tipo));

/* ── la memoria: quello che la casa ha imparato ──────────────────────────── */

/* Uno ✕ pesa per due settimane, poi si dimentica piano. */
const DIMENTICA_IN = 14 * GIORNO;
const NASCOSTO_DOPO_UN_NO = 4 * ORA;
/* L'urgente — l'acqua, il fumo, la porta aperta con la casa vuota — non si
 * rimanda e non si impara a tacerlo: uno ✕ lo toglie dalla vista per un quarto
 * d'ora, il tempo di andare a vedere, e poi torna se la cosa c'e' ancora. */
const URGENTE_TACE_PER = 15 * MINUTO;
/* Le istanze ricordate non crescono per sempre. */
const ISTANZE_MASSIME = 60;

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
    if (fino > 0 || fatto) istanze[pulito(id)] = { fino, fatto };
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
  if (suggerimento?.urgenza === "urgente" && (risposta === "no" || risposta === "tardi")) {
    m.istanze[id] = { fino: adesso + URGENTE_TACE_PER, fatto: false };
  } else if (risposta === "no") {
    const vecchiaia = Math.max(0, adesso - voce.ultimo) / DIMENTICA_IN;
    m.tipi[tipo] = { ...voce, no: voce.no * 0.5 ** vecchiaia + 1, ultimo: adesso };
    m.istanze[id] = { fino: adesso + NASCOSTO_DOPO_UN_NO, fatto: false };
  } else if (risposta === "tardi") {
    m.istanze[id] = { fino: Math.max(adesso + MINUTO, numero(fino) || adesso + ORA), fatto: false };
  } else if (risposta === "fatto" || risposta === "si") {
    m.tipi[tipo] = { ...voce, si: voce.si + 1, ultimo: adesso };
    m.istanze[id] = { fino: 0, fatto: true };
  }
  if (!TIPI_DI_SUGGERIMENTO.includes(tipo)) delete m.tipi[tipo];
  return memoriaPulita(m);
}

/**
 * Fino a quando rimandare: fra un'ora, stasera alle 19 (o fra un'ora se e'
 * gia' sera), domani alle 8. `adesso` e' un istante; i conti delle ore si
 * fanno nel fuso di chi guarda.
 */
export function finoA(scelta, adesso) {
  const data = new Date(adesso);
  if (scelta === "stasera") {
    const sera = new Date(data);
    sera.setHours(19, 0, 0, 0);
    return sera.getTime() > adesso + 30 * MINUTO ? sera.getTime() : adesso + ORA;
  }
  if (scelta === "domani") {
    const domani = new Date(data);
    domani.setDate(domani.getDate() + 1);
    domani.setHours(8, 0, 0, 0);
    return domani.getTime();
  }
  return adesso + ORA;
}

/**
 * La memoria senza le istanze che non servono piu': un «Fatto» vale finche'
 * la cosa c'e'; quando smette di esserci, la volta dopo torna a farsi vedere.
 * Un rinvio scaduto non serve piu'.
 */
export function memoriaDopo(memoria, idPresenti, adesso) {
  const m = memoriaPulita(memoria);
  const presenti = new Set(idPresenti);
  for (const [id, voce] of Object.entries(m.istanze)) {
    if (voce.fatto && !presenti.has(id)) delete m.istanze[id];
    else if (!voce.fatto && voce.fino <= adesso) delete m.istanze[id];
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
  const visibili = tutti.filter((s) => {
    const istanza = m.istanze[s.id];
    if (istanza?.fatto) return false;
    if (istanza && istanza.fino > c.adesso) return false;
    if (s.scade && s.scade < c.adesso) return false;
    if (o.sensibilita === "poco" && s.urgenza === "idea") return false;
    return true;
  });
  const conPunti = visibili.map((s) => {
    const peso = pesoDelTipo(m, s.tipo, c.adesso);
    return { ...s, peso, punti: PESO_URGENZA[s.urgenza] * 100 + peso * 50 };
  });
  /* Un tipo scartato quasi sempre tace — l'urgente no, mai — a meno che non
   * si sia chiesto di vedere tutto. */
  const ascoltati = conPunti.filter(
    (s) => s.urgenza === "urgente" || o.sensibilita === "tutto" || s.peso >= 0.3,
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
 * `prima` e `fuori` sono `{ [id]: { lavora, finitoIl } }`.
 */
export function conIFiniti(prima, macchine, adesso) {
  const fuori = {};
  const vecchie = prima && typeof prima === "object" ? prima : {};
  for (const m of elenco(macchine)) {
    const id = pulito(m.id || m.entity);
    if (!id) continue;
    const lavora = m.mode === "running";
    const era = vecchie[id] || {};
    fuori[id] = {
      lavora,
      finitoIl: lavora ? 0 : era.lavora ? adesso : numero(era.finitoIl) || 0,
    };
  }
  return fuori;
}
