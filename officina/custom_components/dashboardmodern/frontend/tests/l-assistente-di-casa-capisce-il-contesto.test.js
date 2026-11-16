/* L'assistente di casa capisce il contesto, e parla bene.
 *
 * «Perfeziona e rendi ancora più intelligente l'assistente di casa.» Qui si
 * tiene fermo quello che e' cambiato, situazione per situazione:
 *
 * - le frasi concordano in genere e numero, in italiano e nelle altre lingue:
 *   la frase concorda con una parola nostra (finestra, luce, serratura) e il
 *   nome scelto da chi abita la casa viene dopo i due punti;
 * - le cose simili si dicono in una frase sola («3 finestre aperte: Bagno
 *   grande, Studio e Cucina»);
 * - il contesto: chi e' in casa e da quanto e' uscito, l'ora, il tempo che fa
 *   fuori, la tariffa; e niente consigli inutili o in conflitto fra loro;
 * - la priorita': sicurezza, danni, soldi, comfort, manutenzione;
 * - «Fatto», «Più tardi», ✕ e la conferma per serrature, antifurto e garage;
 * - e che non parli a vuoto.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  conIFiniti,
  conLArticolo,
  conLaRisposta,
  finoA,
  rinviPossibili,
  suggerimentiDellaCasa,
  tariffaDiAdesso,
  umiditaAssoluta,
} from "../src/core/assistente-di-casa.js";
import { loadCatalog } from "../src/core/i18n.js";

const MINUTO = 60_000;
const ORA = 60 * MINUTO;

/* Un mercoledi' qualunque (14 ottobre 2026), all'ora che serve. */
function alle(ora, minuti = 0, giorno = 14) {
  return new Date(2026, 9, giorno, ora, minuti, 0).getTime();
}

function casa(ora, resto = {}, minuti = 0) {
  return {
    adesso: alle(ora, minuti),
    ora,
    persone: { totale: 2, inCasa: 2, incerte: 0, ultimaUscita: 0 },
    luci: [],
    clima: [],
    media: [],
    finestre: [],
    porte: [],
    serrature: [],
    garage: [],
    tende: [],
    tapparelle: [],
    meteo: { pioggiaFra: null, soleNelleProssimeOre: false },
    elettrodomestici: [],
    finiti: [],
    energia: {},
    auto: [],
    antifurto: null,
    batterie: [],
    nonRispondono: [],
    aggiornamenti: [],
    rifiuti: [],
    eventi: [],
    allagamenti: [],
    valvole: [],
    fumo: [],
    stanze: [],
    frigo: [],
    stanzeOccupate: [],
    ciSonoPresenze: false,
    ...resto,
  };
}

/* La casa vuota da tanto cosi', a quell'ora. */
const vuota = (da, ora = 15) => ({
  totale: 2,
  inCasa: 0,
  incerte: 0,
  ultimaUscita: alle(ora) - da,
});

const dice = (contesto, lingua = "it", opzioni = {}, memoria = {}) =>
  suggerimentiDellaCasa(contesto, memoria, opzioni, lingua);
const di = (elenco, tipo) => elenco.find((s) => s.tipo === tipo);

const TRE_FINESTRE = [
  { entity: "binary_sensor.f_bagno", name: "Bagno grande" },
  { entity: "binary_sensor.f_studio", name: "Studio" },
  { entity: "binary_sensor.f_cucina", name: "Cucina" },
];

/* ── le parole ──────────────────────────────────────────────────────────── */

test("l'articolo davanti al numero si accorda con come si pronuncia", () => {
  assert.equal(conLArticolo(45), "al 45");
  assert.equal(conLArticolo(8), "all'8");
  assert.equal(conLArticolo(11), "all'11");
  assert.equal(conLArticolo(80), "all'80");
  assert.equal(conLArticolo(1), "all'1");
  assert.equal(conLArticolo(18), "al 18");
  assert.equal(conLArticolo(30, "il"), "il 30");
  assert.equal(conLArticolo(85, "il"), "l'85");
});

test("«Siete usciti con Bagno grande e altre 2 aperta»: adesso «3 finestre aperte: …»", async () => {
  const situazione = casa(15, { persone: vuota(ORA), finestre: TRE_FINESTRE });
  const [s] = dice(situazione);
  assert.equal(s.tipo, "vuota-aperture");
  assert.equal(s.titolo, "3 finestre aperte: Bagno grande, Studio e Cucina");
  assert.equal(s.motivo, "Non c'è nessuno in casa: meglio controllare.");
  assert.equal(
    dice(situazione, "en")[0].titolo,
    "3 windows open: Bagno grande, Studio, and Cucina",
  );
  /* Una sola, e una porta: il singolare concorda con «finestra» e «porta». */
  const una = dice(casa(15, { persone: vuota(ORA), finestre: TRE_FINESTRE.slice(0, 1) }));
  assert.equal(una[0].titolo, "Finestra aperta: Bagno grande");
  const porta = dice(
    casa(15, { persone: vuota(ORA), porte: [{ entity: "binary_sensor.p", name: "Ingresso" }] }),
  );
  assert.equal(porta[0].titolo, "Porta aperta: Ingresso");
  /* Insieme: niente conto da accordare. */
  const misto = dice(
    casa(15, {
      persone: vuota(ORA),
      finestre: TRE_FINESTRE.slice(0, 1),
      porte: [{ entity: "binary_sensor.p", name: "Ingresso" }],
    }),
  );
  assert.equal(misto[0].titolo, "Finestre e porte aperte: Bagno grande e Ingresso");
  /* Oltre tre nomi si contano, col genere giusto. */
  const cinque = dice(
    casa(15, {
      persone: vuota(ORA),
      finestre: [
        ...TRE_FINESTRE,
        { entity: "b.4", name: "Sala" },
        { entity: "b.5", name: "Camera" },
      ],
    }),
  );
  assert.equal(cinque[0].titolo, "5 finestre aperte: Bagno grande, Studio e altre 3");
  /* Nelle altre lingue, con il conto dove la lingua lo regge. */
  const attese = {
    de: "3 Fenster offen: Bagno grande, Studio und Cucina",
    fr: "3 fenêtres ouvertes : Bagno grande, Studio et Cucina",
    es: "3 ventanas abiertas: Bagno grande, Studio y Cucina",
    pl: "Otwarte okna (3): Bagno grande, Studio i Cucina",
    ru: "Открытые окна (3): Bagno grande, Studio и Cucina",
    ja: "開いている窓が3つ：Bagno grande、Studio、Cucina",
  };
  for (const [lingua, frase] of Object.entries(attese)) {
    await loadCatalog(lingua);
    assert.equal(dice(situazione, lingua)[0].titolo, frase, lingua);
  }
});

test("le serrature: la frase parla della serratura, al singolare e al plurale", async () => {
  const serrature = [
    { entity: "lock.portone", name: "Portone", aperta: true },
    { entity: "lock.retro", name: "Porta del retro", aperta: true },
  ];
  const [notte] = dice(casa(23, { serrature }));
  assert.equal(notte.titolo, "2 serrature aperte: Portone e Porta del retro");
  assert.equal(notte.motivo, "È notte: le chiudo a chiave?");
  assert.equal(notte.urgenza, "oggi");
  const [fuori] = dice(casa(15, { serrature: serrature.slice(0, 1), persone: vuota(ORA) }));
  assert.equal(fuori.titolo, "Serratura aperta: Portone");
  assert.equal(fuori.motivo, "Non c'è nessuno in casa: la chiudo a chiave?");
  assert.equal(fuori.urgenza, "urgente");
  const [inglese] = dice(casa(23, { serrature }), "en");
  assert.equal(inglese.titolo, "2 locks unlocked: Portone and Porta del retro");
  assert.equal(inglese.motivo, "It's night: lock them?");
  await loadCatalog("fr");
  assert.equal(dice(casa(23, { serrature }), "fr")[0].motivo, "Il fait nuit : je les verrouille ?");
  /* Un varco che non e' una serratura non si chiude da qui: si va a vedere. */
  const [portone] = dice(
    casa(23, { serrature: [{ entity: "cover.portone", name: "Portone", aperta: true }] }),
  );
  assert.equal(portone.motivo, "È notte: meglio controllare.");
});

test("TV e musica: «sta suonando» e «stanno suonando» non sono la stessa frase", () => {
  const una = dice(casa(15, { persone: vuota(ORA), media: [{ entity: "m.tv", name: "TV" }] }));
  assert.equal(una[0].titolo, "Non c'è nessuno in casa, ma qualcosa sta suonando: TV");
  assert.equal(una[0].motivo, "Lo spengo?");
  const due = dice(
    casa(15, {
      persone: vuota(ORA),
      media: [
        { entity: "m.tv", name: "TV" },
        { entity: "m.cucina", name: "Altoparlante cucina" },
      ],
    }),
  );
  assert.equal(
    due[0].titolo,
    "Non c'è nessuno in casa, ma 2 lettori stanno suonando: TV e Altoparlante cucina",
  );
  assert.equal(due[0].motivo, "Li spengo?");
});

test("garage e cancelli: la parola giusta, una frase sola, e il tasto chiede conferma", () => {
  const [g] = dice(
    casa(23, {
      garage: [{ entity: "cover.g", name: "Basculante", aperto: true, classe: "garage" }],
    }),
  );
  assert.equal(g.titolo, "Garage aperto: Basculante");
  assert.equal(g.motivo, "È notte: lo chiudo?");
  assert.equal(g.azioni[0].conferma, "Sì, chiudi");
  const [due] = dice(
    casa(23, {
      garage: [
        { entity: "cover.g", name: "Basculante", aperto: true, classe: "garage" },
        { entity: "cover.c", name: "Carraio", aperto: true, classe: "gate" },
      ],
    }),
  );
  assert.equal(due.titolo, "Garage e cancelli aperti: Basculante e Carraio");
  assert.equal(due.motivo, "È notte: li chiudo?");
  assert.deepEqual(due.azioni[0].servizio.dati, { entity_id: ["cover.g", "cover.c"] });
  const [cancello] = dice(
    casa(23, { garage: [{ entity: "cover.c", name: "Carraio", aperto: true, classe: "gate" }] }),
    "en",
  );
  assert.equal(cancello.titolo, "Gate open: Carraio");
});

test("l'antifurto si inserisce con conferma, e la frase va bene anche per chi vive da solo", () => {
  const [a] = dice(
    casa(15, {
      persone: { totale: 1, inCasa: 0, incerte: 0, ultimaUscita: alle(15) - ORA },
      antifurto: { entity: "alarm_control_panel.casa", inserito: false, serveIlCodice: false },
    }),
  );
  assert.equal(a.titolo, "Non c'è nessuno in casa e l'antifurto è spento");
  assert.equal(a.azioni[0].conferma, "Sì, inserisci");
  /* Le luci si spengono senza conferma: non e' sicurezza. */
  const [luci] = dice(
    casa(15, { persone: vuota(ORA), luci: [{ entity: "light.a", name: "A", on: true }] }),
  );
  assert.equal(luci.azioni[0].conferma, undefined);
});

test("fumo, acqua e frigo parlano al numero giusto, e del frigo dice lo sportello", () => {
  const fumo = dice(
    casa(10, {
      fumo: [
        { entity: "b.f1", name: "Cucina", on: true },
        { entity: "b.f2", name: "Sala", on: true },
      ],
    }),
  );
  assert.equal(fumo[0].motivo, "Più rilevatori di fumo o gas stanno suonando.");
  const acqua = dice(
    casa(10, {
      allagamenti: [
        { entity: "b.a1", name: "Bagno", on: true },
        { entity: "b.a2", name: "Cucina", on: true },
      ],
    }),
  );
  assert.equal(acqua[0].motivo, "I sensori di allagamento sono bagnati.");
  const [frigo] = dice(
    casa(10, {
      frigo: [{ entity: "b.frigo", name: "Porta frigo", aperto: true, daMs: 5 * MINUTO }],
    }),
  );
  assert.equal(frigo.titolo, "Porta frigo: sportello aperto da 5 min");
  assert.equal(frigo.motivo, "Chiudilo prima che il freddo se ne vada.");
});

/* ── chi c'e', e da quando ──────────────────────────────────────────────── */

test("chi e' appena uscito non ha lasciato le luci in una casa vuota", () => {
  const luci = [{ entity: "light.sala", name: "Sala", on: true }];
  assert.equal(dice(casa(15, { persone: vuota(3 * MINUTO), luci })).length, 0);
  assert.equal(dice(casa(15, { persone: vuota(12 * MINUTO), luci }))[0].tipo, "vuota-luci");
  /* La porta aperta si dice prima: tre minuti, il tempo di chiudere dietro di se'. */
  const serrature = [{ entity: "lock.portone", name: "Portone", aperta: true }];
  assert.equal(dice(casa(15, { persone: vuota(MINUTO), serrature })).length, 0);
  assert.equal(dice(casa(15, { persone: vuota(4 * MINUTO), serrature }))[0].urgenza, "urgente");
});

test("la finestra aperta col riscaldamento: dieci minuti sono arieggiare, poi se ne parla", () => {
  const clima = [
    { entity: "climate.studio", name: "Termosifone", stanza: "Studio", on: true, mode: "heat" },
  ];
  const finestra = (daMs) => [{ entity: "b.f", name: "Finestra studio", stanza: "Studio", daMs }];
  assert.equal(dice(casa(10, { clima, finestre: finestra(4 * MINUTO) })).length, 0);
  const [s] = dice(casa(10, { clima, finestre: finestra(25 * MINUTO) }));
  assert.equal(s.tipo, "finestra-clima");
  assert.equal(
    s.motivo,
    "Finestra aperta da 25 min (Finestra studio): spengo Termosifone finché non la chiudi?",
  );
});

/* ── il tempo che fa fuori ──────────────────────────────────────────────── */

test("il gelo: fuori sotto zero e una finestra aperta da un pezzo", () => {
  const meteo = (gradi) => ({ pioggiaFra: null, fuori: { temperatura: gradi, umidita: 80 } });
  const finestre = [{ entity: "b.f", name: "Bagno", daMs: 30 * MINUTO }];
  const [s] = dice(casa(10, { meteo: meteo(-2), finestre }));
  assert.equal(s.tipo, "gelo");
  assert.equal(s.urgenza, "oggi");
  assert.equal(s.titolo, "Fuori gela e una finestra è aperta: Bagno");
  assert.equal(s.motivo, "Fuori ci sono -2,0°: meglio chiuderla.");
  /* Da due ore e' urgente. */
  assert.equal(
    dice(casa(10, { meteo: meteo(-2), finestre: [{ ...finestre[0], daMs: 2 * ORA }] }))[0].urgenza,
    "urgente",
  );
  /* Aperta da cinque minuti si sta arieggiando; a tre gradi non gela. */
  assert.equal(
    dice(casa(10, { meteo: meteo(-2), finestre: [{ ...finestre[0], daMs: 5 * MINUTO }] })).length,
    0,
  );
  assert.equal(dice(casa(10, { meteo: meteo(3), finestre })).length, 0);
});

test("il caldo: apri se fuori e' piu' fresco, tieni chiuso se e' piu' caldo, niente se piove", () => {
  const stanze = [{ name: "Studio", entity: "sensor.t_studio", temperatura: 29.4 }];
  const con = (meteo) =>
    di(dice(casa(14, { stanze, meteo }), "it", { sensibilita: "tutto" }), "comfort");
  const fresco = con({ pioggiaFra: null, fuori: { temperatura: 22 } });
  assert.equal(fresco.titolo, "Studio: fa caldo, 29,4°");
  assert.equal(fresco.motivo, "Fuori ci sono 22,0°: apri le finestre per rinfrescare.");
  const torrido = con({ pioggiaFra: null, fuori: { temperatura: 34 } });
  assert.equal(
    torrido.motivo,
    "Fuori fa ancora più caldo (34,0°): tieni chiuso e abbassa le tapparelle.",
  );
  /* Con la pioggia fra mezz'ora non si dice di aprire. */
  const piove = con({ pioggiaFra: 30, fuori: { temperatura: 22 } });
  assert.equal(piove.motivo, "Vuoi regolare il clima?");
});

test("il freddo: le stanze insieme, la finestra aperta, il riscaldamento che sta gia' lavorando", () => {
  const fredde = [
    { name: "Camera", entity: "sensor.t_camera", temperatura: 15.5 },
    { name: "Studio", entity: "sensor.t_studio", temperatura: 16.2 },
  ];
  const [s] = dice(casa(10, { stanze: fredde }), "it", { sensibilita: "tutto" });
  assert.equal(s.titolo, "Fa freddo in 2 stanze: Camera 15,5° e Studio 16,2°");
  const [finestra] = dice(
    casa(10, {
      stanze: fredde.slice(0, 1),
      finestre: [{ entity: "b.f", name: "Finestra", stanza: "Camera", daMs: 5 * MINUTO }],
    }),
    "it",
    { sensibilita: "tutto" },
  );
  assert.equal(finestra.motivo, "C'è una finestra aperta: meglio chiuderla.");
  /* Il termosifone della camera e' acceso: si sta scaldando, non se ne parla. */
  const scalda = dice(
    casa(10, {
      stanze: fredde.slice(0, 1),
      clima: [{ entity: "climate.camera", name: "T", stanza: "Camera", on: true, mode: "heat" }],
    }),
    "it",
    { sensibilita: "tutto" },
  );
  assert.equal(di(scalda, "comfort"), undefined);
});

test("l'umidita': arieggiare solo se fuori l'aria e' piu' secca, e mai sotto la pioggia", () => {
  assert.ok(umiditaAssoluta(8, 90) < umiditaAssoluta(22, 70));
  const bagno = [{ name: "Bagno", temperatura: 22, umidita: 78 }];
  const umida = (resto) =>
    di(dice(casa(10, { stanze: bagno, ...resto }), "it", { sensibilita: "tutto" }), "aria");
  /* Fuori 8 gradi e 90%: piu' secco in grammi. Si arieggia. */
  const secco = umida({ meteo: { pioggiaFra: null, fuori: { temperatura: 8, umidita: 90 } } });
  assert.equal(secco.titolo, "Bagno: umidità al 78%");
  assert.equal(secco.motivo, "Fuori l'aria è più secca: arieggia qualche minuto.");
  /* Fuori 30 gradi e 70%: piu' umido. Aprire bagnerebbe. */
  assert.equal(
    umida({ meteo: { pioggiaFra: null, fuori: { temperatura: 30, umidita: 70 } } }),
    undefined,
  );
  /* Piove adesso: non si apre. */
  assert.equal(umida({ meteo: { pioggiaFra: 0 } }), undefined);
  /* La finestra del bagno e' gia' aperta: sta arieggiando. */
  assert.equal(
    umida({ finestre: [{ entity: "b.f", name: "Finestra", stanza: "Bagno" }] }),
    undefined,
  );
  /* La soglia e' quella scritta da chi abita la casa, e spenta e' spenta. */
  const settanta = [{ name: "Bagno", temperatura: 22, umidita: 65 }];
  assert.equal(
    di(dice(casa(10, { stanze: settanta }), "it", { sensibilita: "tutto" }), "aria"),
    undefined,
  );
  assert.ok(
    di(
      dice(casa(10, { stanze: settanta, sogliaUmidita: 60 }), "it", { sensibilita: "tutto" }),
      "aria",
    ),
  );
  assert.equal(
    di(
      dice(casa(10, { stanze: bagno, sogliaUmidita: null }), "it", { sensibilita: "tutto" }),
      "aria",
    ),
    undefined,
  );
  /* L'articolo: «all'80%», non «al 80%». */
  const ottanta = di(
    dice(casa(10, { stanze: [{ name: "Bagno", umidita: 81 }] }), "it", { sensibilita: "tutto" }),
    "aria",
  );
  assert.equal(ottanta.titolo, "Bagno: umidità all'81%");
});

test("la CO2: sopra 1200 e' un'idea, sopra 1600 una cosa di oggi", () => {
  const co2 = (ppm) => di(dice(casa(10, { stanze: [{ name: "Studio", co2: ppm }] })), "aria");
  assert.equal(co2(1100), undefined);
  assert.equal(co2(1300).urgenza, "idea");
  assert.equal(co2(1700).urgenza, "oggi");
});

/* ── l'ora ──────────────────────────────────────────────────────────────── */

test("di notte le idee della manutenzione e del comfort aspettano il mattino", () => {
  const situazione = (ora) => casa(ora, { aggiornamenti: [{ entity: "update.a" }] });
  assert.equal(dice(situazione(2)).length, 0);
  assert.equal(dice(situazione(9)).length, 1);
  /* Chi ha chiesto «tutto» le vede anche di notte. */
  assert.equal(dice(situazione(2), "it", { sensibilita: "tutto" }).length, 1);
  /* La batteria sotto il 10% non e' un'idea: si dice anche di notte. */
  const batteria = casa(2, { batterie: [{ entity: "s.b", name: "Sensore", level: 6 }] });
  assert.equal(dice(batteria)[0].urgenza, "oggi");
});

test("il bucato finito alle tre di notte si dice alle sette, non alle tre", () => {
  const finito = alle(3);
  const finiti = [
    { id: "lav", entity: "s.lav", name: "Lavatrice", tipo: "lavatrice", finitoIl: finito },
  ];
  const a = (ora, minuti = 0) => ({ ...casa(ora, { finiti }, minuti) });
  assert.equal(dice(a(4)).length, 0, "alle quattro tace");
  const [mattina] = dice(a(7, 30));
  assert.equal(mattina.titolo, "Stendi il bucato");
  /* Le sei ore per stenderlo cominciano alle sette. */
  assert.equal(dice(a(12, 30)).length, 1);
  assert.equal(dice(a(13, 30)).length, 0);
});

test("«Più tardi» non rimanda nel cuore della notte", () => {
  assert.deepEqual(rinviPossibili(alle(10)), ["ora", "stasera", "domani"]);
  assert.deepEqual(rinviPossibili(alle(20)), ["ora", "domani"]);
  assert.deepEqual(rinviPossibili(alle(23, 30)), ["domattina"]);
  assert.deepEqual(rinviPossibili(alle(2)), ["domattina"]);
  /* Domattina: alle otto di oggi se e' notte fonda, di domani se e' sera. */
  assert.equal(finoA("domattina", alle(2)), alle(8));
  assert.equal(finoA("domattina", alle(23, 30)), alle(8, 0, 15));
  /* «Fra un'ora» alle undici e mezza di sera cadrebbe a mezzanotte e mezza:
   * va alle otto. */
  assert.equal(finoA("ora", alle(23, 30)), alle(8, 0, 15));
  assert.equal(finoA("ora", alle(22)), alle(23));
});

/* ── conflitti ──────────────────────────────────────────────────────────── */

test("«Avvia la lavatrice col sole» non sta accanto a «Stendi il bucato»", () => {
  const avvia = { dominio: "button", servizio: "press", dati: { entity_id: "button.lav" } };
  const lavatrice = (mode) => ({
    id: "lav",
    entity: "s.lav",
    name: "Lavatrice",
    mode,
    tipo: "lavatrice",
    avvia,
  });
  const sole = { solare: 4200, casa: 900, rete: -3300 };
  const piena = dice(
    casa(11, {
      energia: sole,
      elettrodomestici: [lavatrice("standby")],
      finiti: [{ ...lavatrice("standby"), finitoIl: alle(10) }],
    }),
  );
  assert.equal(di(piena, "sole-elettrodomestico"), undefined);
  assert.equal(di(piena, "finito").titolo, "Stendi il bucato");
  /* Una lavatrice che non risponde non si avvia. */
  assert.equal(
    di(
      dice(casa(11, { energia: sole, elettrodomestici: [lavatrice("unavailable")] })),
      "sole-elettrodomestico",
    ),
    undefined,
  );
  assert.ok(
    di(
      dice(casa(11, { energia: sole, elettrodomestici: [lavatrice("standby")] })),
      "sole-elettrodomestico",
    ),
  );
});

test("una lavatrice che perde il Wi‑Fi a meta' giro non ha finito", () => {
  let memoria = conIFiniti({}, [{ id: "lav", mode: "running" }], alle(10));
  memoria = conIFiniti(memoria, [{ id: "lav", mode: "unavailable" }], alle(10, 30));
  assert.deepEqual(memoria.lav, { lavora: true, finitoIl: 0 });
  memoria = conIFiniti(memoria, [{ id: "lav", mode: "off" }], alle(11));
  assert.equal(memoria.lav.finitoIl, alle(11));
  /* Da spenta a pronta: caricata, sta per partire. */
  memoria = conIFiniti(memoria, [{ id: "lav", mode: "standby" }], alle(18));
  assert.equal(memoria.lav.pronta, alle(18));
  memoria = conIFiniti(memoria, [{ id: "lav", mode: "standby" }], alle(18, 5));
  assert.equal(memoria.lav.pronta, alle(18), "l'ora resta quella di quando si e' accesa");
});

/* ── i soldi ────────────────────────────────────────────────────────────── */

const FASCE = {
  quante: 2,
  voci: [
    { dalle: "08:00", prezzo: 0.32 },
    { dalle: "19:00", prezzo: 0.22 },
  ],
};

test("la tariffa: la fascia piu' cara e quando arriva quella che costa meno", () => {
  const giorno = tariffaDiAdesso(FASCE, alle(17, 10));
  assert.equal(giorno.piuCara, true);
  assert.equal(giorno.prossima.alle, "19:00");
  assert.equal(giorno.prossima.fra, 110 * MINUTO);
  const sera = tariffaDiAdesso(FASCE, alle(20));
  assert.equal(sera.piuCara, false);
  assert.equal(tariffaDiAdesso({}, alle(10)), null);
});

test("il picco di prezzo con la lavastoviglie appena accesa: meglio aspettare", () => {
  const lsv = (prontaDa) => ({
    id: "lsv",
    entity: "s.lsv",
    name: "Lavastoviglie",
    mode: "standby",
    tipo: "lavastoviglie",
    prontaDa,
  });
  const adesso = alle(17, 10);
  const situazione = (macchina, resto = {}) =>
    casa(
      17,
      { tariffa: tariffaDiAdesso(FASCE, adesso), elettrodomestici: [macchina], ...resto },
      10,
    );
  const [s] = dice(situazione(lsv(adesso - 5 * MINUTO)));
  assert.equal(s.tipo, "fascia-cara");
  assert.equal(s.titolo, "Lavastoviglie: meglio aspettare le 19:00");
  assert.equal(s.motivo, "Adesso è la fascia più cara: dalle 19:00 costa il 31% in meno.");
  assert.equal(
    dice(situazione(lsv(adesso - 5 * MINUTO)), "en")[0].motivo,
    "This is the priciest band: from 19:00 it costs 31% less.",
  );
  /* Accesa da un'ora: non e' «in partenza». Col sole che avanza, conta il sole. */
  assert.equal(dice(situazione(lsv(adesso - ORA))).length, 0);
  assert.equal(
    di(
      dice(situazione(lsv(adesso - 5 * MINUTO), { energia: { solare: 4000, casa: 800 } })),
      "fascia-cara",
    ),
    undefined,
  );
});

test("la rete: vicino e sopra la soglia non sono la stessa frase, e il plurale concorda", () => {
  const macchine = [
    { id: "f", name: "Forno", mode: "running" },
    { id: "l", name: "Lavatrice", mode: "running" },
  ];
  const [vicino] = dice(
    casa(19, { energia: { rete: 2700, soglia: 3000 }, elettrodomestici: macchine }),
  );
  assert.equal(
    vicino.motivo,
    "Sei vicino alla soglia del contatore. Si possono rimandare Forno e Lavatrice?",
  );
  assert.equal(vicino.urgenza, "oggi");
  /* Senza una soglia scritta (tremila per supposizione) non si grida. */
  const [senza] = dice(casa(19, { energia: { rete: 3200 } }));
  assert.equal(senza.urgenza, "oggi");
  assert.equal(senza.motivo, "Hai superato la soglia del contatore.");
});

test("la sera, con la casa vuota, le tapparelle alzate si chiudono tutte con un tasto", () => {
  const tapparelle = [
    { entity: "cover.sala", name: "Sala" },
    { entity: "cover.camera", name: "Camera" },
  ];
  const [s] = dice(casa(21, { persone: vuota(ORA, 21), tapparelle }));
  assert.equal(s.tipo, "vuota-tapparelle");
  assert.equal(s.titolo, "È sera e 2 tapparelle sono ancora alzate: Sala e Camera");
  assert.equal(s.motivo, "Non c'è nessuno in casa: le abbasso?");
  assert.equal(s.azioni[0].etichetta, "Chiudi tutte");
  assert.deepEqual(s.azioni[0].servizio, {
    dominio: "cover",
    servizio: "close_cover",
    dati: { entity_id: ["cover.sala", "cover.camera"] },
  });
  /* Di giorno, o con qualcuno in casa, le tapparelle su sono una casa normale. */
  assert.equal(dice(casa(15, { persone: vuota(ORA), tapparelle })).length, 0);
  assert.equal(dice(casa(21, { tapparelle })).length, 0);
});

/* ── raggruppare ────────────────────────────────────────────────────────── */

test("due sacchi lo stesso giorno sono un promemoria solo", () => {
  const [s] = dice(
    casa(20, {
      rifiuti: [
        { name: "Plastica", quando: "domani" },
        { name: "Carta", quando: "domani" },
      ],
    }),
  );
  assert.equal(s.titolo, "Porta fuori: Plastica e Carta");
});

test("le batterie: la piu' scarica per prima, con l'articolo giusto", () => {
  const [s] = dice(
    casa(10, {
      batterie: [
        { entity: "s.a", name: "Porta", level: 18 },
        { entity: "s.b", name: "Fumo cucina", level: 8 },
        { entity: "s.c", name: "Muto", level: null },
      ],
    }),
  );
  assert.equal(s.titolo, "2 batterie quasi scariche");
  assert.equal(s.motivo, "La più scarica è Fumo cucina, all'8%.");
  assert.equal(s.urgenza, "oggi");
});

/* ── la priorita' ───────────────────────────────────────────────────────── */

test("a parita' di urgenza: prima la sicurezza, poi i danni, i soldi, il comfort, la manutenzione", () => {
  const fuori = dice(
    casa(23, {
      serrature: [{ entity: "lock.p", name: "Portone", aperta: true }],
      meteo: { pioggiaFra: 90 },
      finestre: [{ entity: "b.f", name: "Bagno" }],
      rifiuti: [{ name: "Carta", quando: "domani" }],
      batterie: [{ entity: "s.b", name: "Sensore", level: 7 }],
      clima: [{ entity: "climate.s", name: "Stufa", stanza: "Sala", on: true, mode: "heat" }],
      porte: [],
    }),
  );
  assert.deepEqual(
    fuori.map((s) => s.tipo),
    ["serrature", "pioggia", "rifiuti", "batterie"],
  );
  assert.ok(fuori.every((s) => s.urgenza === "oggi"));
});

/* ── la memoria ─────────────────────────────────────────────────────────── */

test("«Fatto» dopo un comando: se dopo un'ora e' ancora cosi', la casa lo dice", () => {
  const situazione = casa(15, {
    persone: vuota(ORA),
    luci: [{ entity: "light.sala", name: "Sala", on: true }],
  });
  const [s] = dice(situazione);
  const memoria = conLaRisposta({}, s, "si", alle(15));
  assert.equal(dice(situazione, "it", {}, memoria).length, 0);
  const [ancora] = dice({ ...situazione, adesso: alle(16, 30) }, "it", {}, memoria);
  assert.equal(ancora.ancora, true);
  assert.match(ancora.motivo, /^Ci ho provato, ma è ancora così\. /);
});

/* ── non parlare a vuoto ────────────────────────────────────────────────── */

test("con niente da dire non dice niente, anche con dati che mancano o non tornano", () => {
  assert.deepEqual(suggerimentiDellaCasa({}, {}, {}, "it"), []);
  assert.deepEqual(dice(casa(10)), []);
  assert.deepEqual(dice(casa(3)), []);
  assert.deepEqual(
    dice(
      casa(10, {
        persone: { totale: 0, inCasa: 0 },
        luci: [{ entity: "light.a", name: "A", on: true }],
        meteo: { pioggiaFra: null, fuori: { temperatura: null, umidita: "unknown" } },
        finestre: [{ entity: "b.f", name: "F", daMs: null }],
        stanze: [{ name: "Sala", temperatura: "unavailable", umidita: null, co2: "" }],
        batterie: [{ entity: "s.b", name: "B", level: "unknown" }],
        elettrodomestici: [{ id: "x", name: "X", mode: "unavailable", tipo: "lavatrice" }],
        energia: { solare: null, rete: "unavailable" },
        tariffa: null,
      }),
      "it",
      { sensibilita: "tutto" },
    ).map((s) => s.tipo),
    [],
    "niente consigli su entita' che non rispondono",
  );
});
