/* La fotografia che il telefono lascia all'auto.
 *
 * In macchina si guarda, non si studia: tre numeri, chi c'è in casa, sei
 * tasti. Quello che conta qui è che non esca mai una schermata che sembra
 * piena e non lo è — in auto chi guarda non ha modo di accorgersene.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  AZIONI_AL_MASSIMO,
  MISURE_AL_MASSIMO,
  eInCasa,
  firmaDellaFoto,
  ilTastoDelComando,
  laFotoPerLAuto,
  laRicettaDellAzione,
  DISPOSITIVI_AL_MASSIMO,
  iDispositiviPerLAuto,
  laRicettaDelDispositivo,
  leRicetteDeiDispositivi,
  leRicettePerLAuto,
} from "../src/core/la-foto-per-lauto.js";

const leggi = (quale) => readFileSync(new URL(quale, import.meta.url), "utf8");

const ENERGIA = {
  nome: "Energia",
  valore: "725 W",
  righe: [
    { nome: "Casa", valore: "725 W" },
    { nome: "Solare", valore: "485 W" },
    { nome: "Rete", valore: "240 W" },
    { nome: "Batteria", valore: "0 W · 87%" },
  ],
};

test("senza niente da mostrare non si scrive nessuna fotografia", () => {
  /* Un file vuoto farebbe credere all'auto di avere una fotografia quando non
   * ce l'ha: la schermata direbbe «casa» e sotto non ci sarebbe niente, e non
   * si capirebbe se la casa è spenta o se il telefono non ha mandato. */
  assert.equal(laFotoPerLAuto(), null);
  assert.equal(laFotoPerLAuto({ casa: "Casa mia" }), null);
  assert.equal(laFotoPerLAuto({ casa: "Casa mia", energia: { valore: "" }, persone: [] }), null);
});

test("in auto vanno le sorgenti, non lo stesso numero due volte", () => {
  const foto = laFotoPerLAuto({ casa: "Casa mia", energia: ENERGIA });
  assert.equal(foto.casa, "Casa mia");
  /* Il numero grande della tessera E' la potenza della casa, ed e' la stessa
   * cosa che dice la prima riga: messo anche in cima usciva «Energia 725 W»
   * sopra «Casa 725 W» — lo stesso numero due volte su tre righe — e la rete
   * restava fuori per fargli posto. */
  assert.deepEqual(foto.fotovoltaico, [
    { nome: "Casa", valore: "725 W" },
    { nome: "Solare", valore: "485 W" },
    { nome: "Rete", valore: "240 W" },
  ]);
  /* Tre: la quarta non si legge, e il pannello di Android ne mette comunque
   * due grosse in cima. */
  assert.equal(foto.fotovoltaico.length, MISURE_AL_MASSIMO);
});

test("senza righe resta il numero grande, che e' meglio di niente", () => {
  /* Una casa con un contatore solo e nient'altro mappato: una riga sola, e
   * quella. */
  assert.deepEqual(laFotoPerLAuto({ energia: { nome: "Energia", valore: "725 W" } }).fotovoltaico, [
    { nome: "Energia", valore: "725 W" },
  ]);
  /* E senza nome non esce una riga anonima. */
  assert.deepEqual(laFotoPerLAuto({ energia: { nome: " ", valore: "725 W" } }).fotovoltaico, [
    { nome: "Energia", valore: "725 W" },
  ]);
});

test("una riga senza nome o senza valore non entra", () => {
  const foto = laFotoPerLAuto({
    energia: {
      nome: "Energia",
      valore: "725 W",
      righe: [{ nome: "Solare", valore: "" }, { nome: "", valore: "485 W" }, null],
    },
  });
  /* Nessuna riga buona: resta il numero grande. */
  assert.deepEqual(foto.fotovoltaico, [{ nome: "Energia", valore: "725 W" }]);
});

test("chi è in casa lo dice lo stato, non l'elenco", () => {
  const states = {
    "person.gio": { state: "home" },
    "person.ada": { state: "not_home" },
    "person.leo": { state: "Ufficio" },
    "device_tracker.nina": { state: "HOME" },
  };
  assert.equal(eInCasa("person.gio", states), true);
  assert.equal(eInCasa("person.ada", states), false);
  /* Il nome di una zona vuol dire «non è qui»: è fuori, in un posto che ha un
   * nome. */
  assert.equal(eInCasa("person.leo", states), false);
  assert.equal(eInCasa("device_tracker.nina", states), true);
  /* Una persona senza entità, o un'entità che non c'è, non è in casa: e non
   * solleva niente. */
  assert.equal(eInCasa("", states), false);
  assert.equal(eInCasa("person.chi", states), false);
  assert.equal(eInCasa("person.gio"), false);
});

test("chi è nascosto in Home resta nascosto anche in auto", () => {
  /* È una scelta già fatta nella plancia: rifarla qui vorrebbe dire chiederla
   * due volte, e il giorno che si scostano uno sparisce da una parte sola. */
  const foto = laFotoPerLAuto({
    persone: [
      { name: "Gio", entity: "person.gio" },
      { name: "Chi non c'è più", entity: "person.ex", nascosta: true },
      { name: "", entity: "person.senza" },
    ],
    states: { "person.gio": { state: "home" } },
  });
  assert.deepEqual(foto.persone, [{ nome: "Gio", inCasa: true }]);
});

test("le azioni sono sei, col posto e il nome nel segno", () => {
  const azioni = Array.from({ length: 9 }, (_, i) => ({ name: `Azione ${i}`, icon: "💡" }));
  const foto = laFotoPerLAuto({ azioni });
  assert.equal(foto.azioni.length, AZIONI_AL_MASSIMO);
  /* Le prime sei: sono quelle che chi ha la casa ha messo davanti. */
  assert.deepEqual(foto.azioni[0], {
    id: "0|Azione 0",
    nome: "Azione 0",
    segno: "💡",
    subito: false,
  });
  assert.equal(foto.azioni.at(-1).id, "5|Azione 5");
});

test("un tasto senza nome non si disegna, e non sposta gli altri", () => {
  /* Un tasto muto in macchina non si preme: si preme quello sbagliato accanto.
   * Ma il posto di chi viene dopo resta quello dell'elenco vero, o premere
   * «Cancello» aprirebbe un'altra cosa. */
  const foto = laFotoPerLAuto({
    azioni: [{ name: " " }, { name: "Cancello", icon: "🚧" }],
  });
  assert.deepEqual(foto.azioni, [
    { id: "1|Cancello", nome: "Cancello", segno: "🚧", subito: false },
  ]);
});

test("il comando torna al tasto giusto, o a nessuno", () => {
  const azioni = [
    { name: "Buonanotte", icon: "🌙" },
    { name: "Cancello", icon: "🚧" },
  ];
  assert.deepEqual(ilTastoDelComando("1|Cancello", azioni), { posto: 1, nome: "Cancello" });
  assert.deepEqual(ilTastoDelComando("0|Buonanotte", azioni), { posto: 0, nome: "Buonanotte" });

  /* Riordinate: in macchina c'era scritto «Cancello» al posto 1, adesso al
   * posto 1 c'è un'altra cosa. Non si preme niente — un tasto che fa un'altra
   * cosa è peggio di un tasto che non fa niente, e nessuno se ne accorge
   * finché non è successo. */
  assert.equal(ilTastoDelComando("1|Cancello", [azioni[1], azioni[0]]), null);
  /* Cancellata. */
  assert.equal(ilTastoDelComando("1|Cancello", [azioni[0]]), null);
  /* Rinominata. */
  assert.equal(ilTastoDelComando("1|Cancello", [azioni[0], { name: "Portone" }]), null);
  /* E niente di storto passa. */
  for (const storto of ["", " ", "1", "Cancello", "1|", "|Cancello", null, undefined])
    assert.equal(ilTastoDelComando(storto, azioni), null, `${storto}`);
  assert.equal(ilTastoDelComando("1|Cancello", null), null);
});

test("la fotografia porta il momento in cui è stata scattata", () => {
  /* Invecchia in fretta, e una schermata che mostra numeri di mezz'ora fa
   * facendo credere che siano adesso è peggio di una schermata vuota: magari
   * uno decide di non passare da casa. */
  const foto = laFotoPerLAuto({ energia: ENERGIA, adesso: 1_700_000_000_000 });
  assert.equal(foto.quando, 1_700_000_000_000);
  const adesso = laFotoPerLAuto({ energia: ENERGIA, adesso: NaN });
  assert.ok(Number.isFinite(adesso.quando) && adesso.quando > 0);
});

test("si rimanda solo quando cambia davvero", () => {
  /* Gli stati arrivano a mazzetti più volte al secondo: riscrivere il file a
   * ogni mazzetto vorrebbe dire scrivere sul disco tutto il giorno per dire la
   * stessa cosa. */
  const prima = laFotoPerLAuto({ casa: "Casa mia", energia: ENERGIA, adesso: 1000 });
  const dopo = laFotoPerLAuto({ casa: "Casa mia", energia: ENERGIA, adesso: 999_000 });
  assert.equal(firmaDellaFoto(prima), firmaDellaFoto(dopo));
  const cambiata = laFotoPerLAuto({
    casa: "Casa mia",
    energia: {
      ...ENERGIA,
      righe: [{ nome: "Casa", valore: "1,2 kW" }, ...ENERGIA.righe.slice(1)],
    },
    adesso: 1000,
  });
  assert.notEqual(firmaDellaFoto(prima), firmaDellaFoto(cambiata));
  assert.equal(firmaDellaFoto(null), "");
});

test("il nucleo non legge il deposito e non scrive niente", () => {
  /* È puro: entrano le misure già scritte, esce l'oggetto che diventa un
   * file. Chi legge la plancia e chi scrive il file stanno nella sezione. */
  const nucleo = leggi("../src/core/la-foto-per-lauto.js");
  assert.doesNotMatch(nucleo, /readJson|localStorage|postMessage|document/);
});

test("quello che esce è la forma che l'auto sa leggere", () => {
  /* Dall'altra parte c'è Kotlin, e legge campo per campo: un nome cambiato qui
   * è una schermata vuota in macchina, senza nessun errore da nessuna parte. */
  const auto = leggi(
    "../../../../../app/android/app/src/main/kotlin/com/gdahome/gdahome/auto/LaFotoDellaCasa.kt",
  );
  const foto = laFotoPerLAuto({
    casa: "Casa mia",
    energia: ENERGIA,
    persone: [{ name: "Gio", entity: "person.gio" }],
    states: { "person.gio": { state: "home" } },
    azioni: [{ name: "Buonanotte", icon: "🌙" }],
  });
  for (const campo of ["casa", "quando", "fotovoltaico", "persone", "azioni"])
    assert.match(auto, new RegExp(`"${campo}"`), `l'auto deve leggere ${campo}`);
  for (const campo of Object.keys(foto.fotovoltaico[0]))
    assert.match(auto, new RegExp(`"${campo}"`));
  for (const campo of Object.keys(foto.persone[0])) assert.match(auto, new RegExp(`"${campo}"`));
  for (const campo of Object.keys(foto.azioni[0])) assert.match(auto, new RegExp(`"${campo}"`));
});

/* ── Quello che può partire a schermo spento ─────────────────────────────── */

/* La plancia sa cos'è un'azione; il nucleo decide se può partire da sola. Quel
 * «da sola» vuol dire: nessuno che guardi, nessuno a cui chiedere, e uno
 * schermo spento in tasca. */
const RISOLVI = (azione) => ({
  entita: azione.entity || "",
  servizio: azione.servizio || "",
  dati: azione.dati || {},
});

test("un tasto normale parte da solo, con la sua ricetta", () => {
  assert.deepEqual(laRicettaDellAzione({ name: "Cancello", entity: "switch.cancello" }, RISOLVI), {
    dominio: "switch",
    servizio: "toggle",
    entita: "switch.cancello",
    dati: {},
  });
  /* Il servizio giusto lo dice la plancia, che ha la sua tabella: qui non se
   * ne fa una seconda. */
  assert.deepEqual(
    laRicettaDellAzione(
      { name: "Campanello", entity: "button.campanello", servizio: "press" },
      RISOLVI,
    ),
    { dominio: "button", servizio: "press", entita: "button.campanello", dati: {} },
  );
  /* Uno script dichiarato tale chiama `script.turn_on`, e il dominio non si
   * indovina dall'entità: indovinandolo si chiamerebbe un servizio che non
   * esiste. */
  assert.deepEqual(
    laRicettaDellAzione({ name: "Notte", type: "script", entity: "script.notte" }, RISOLVI),
    { dominio: "script", servizio: "turn_on", entita: "script.notte", dati: {} },
  );
});

test("una conferma vuol dire che qualcuno deve guardare", () => {
  /* La conferma è il segno che chi l'ha messa voleva essere guardato in faccia
   * prima: a schermo spento quella domanda non la vede nessuno, e saltarla
   * sarebbe toglierla. */
  assert.equal(
    laRicettaDellAzione(
      { name: "Cancello", entity: "switch.cancello", confirm: "Apro il cancello?" },
      RISOLVI,
    ),
    null,
  );
});

test("quello che apre qualcosa nella plancia non parte da solo", () => {
  /* Senza plancia non c'è niente da aprire. */
  for (const tipo of ["builtin", "luci_group"])
    assert.equal(
      laRicettaDellAzione({ name: "X", type: tipo, entity: "light.x" }, RISOLVI),
      null,
      tipo,
    );
  /* E senza un'entità non c'è niente da chiamare. */
  assert.equal(laRicettaDellAzione({ name: "X" }, RISOLVI), null);
  assert.equal(laRicettaDellAzione({ name: "X", entity: "senzapunto" }, RISOLVI), null);
  assert.equal(laRicettaDellAzione(null, RISOLVI), null);
});

test("il menu parte solo se la voce è già scelta", () => {
  /* Scegliere vuol dire un dito su uno schermo. */
  assert.equal(
    laRicettaDellAzione(
      { name: "Modo", entity: "select.modo", servizio: "select_option" },
      RISOLVI,
    ),
    null,
  );
  assert.deepEqual(
    laRicettaDellAzione(
      {
        name: "Notte",
        entity: "select.modo",
        servizio: "select_option",
        dati: { option: "Notte" },
      },
      RISOLVI,
    ),
    {
      dominio: "select",
      servizio: "select_option",
      entita: "select.modo",
      dati: { option: "Notte" },
    },
  );
});

test("serratura e lettore aspettano l'app, perché dipendono da adesso", () => {
  /* Lì il servizio giusto dipende da com'è messa l'entità ADESSO, e la ricetta
   * è scritta prima: una ricetta che congela lo stato di mezz'ora fa
   * chiuderebbe una porta che intanto qualcuno ha aperto. */
  for (const entita of ["lock.ingresso", "media_player.salotto"])
    assert.equal(
      laRicettaDellAzione({ name: "X", entity: entita, servizio: "lock" }, RISOLVI),
      null,
      entita,
    );
});

test("la fotografia dice quali tasti partono da soli, e le ricette stanno fuori", () => {
  const azioni = [
    { name: "Cancello", icon: "🚧", entity: "switch.cancello" },
    { name: "Portone", icon: "🚪", entity: "lock.portone" },
    { name: "Luci", icon: "💡", entity: "light.tutte", confirm: "Spengo tutto?" },
  ];
  const foto = laFotoPerLAuto({ azioni, risolvi: RISOLVI });
  assert.deepEqual(foto.azioni, [
    { id: "0|Cancello", nome: "Cancello", segno: "🚧", subito: true },
    { id: "1|Portone", nome: "Portone", segno: "🚪", subito: false },
    { id: "2|Luci", nome: "Luci", segno: "💡", subito: false },
  ]);
  /* Nel file che legge l'auto ci vanno i nomi, e nomi e basta: un cruscotto in
   * macchina non ha niente da farsene di «switch.cancello». */
  assert.doesNotMatch(JSON.stringify(foto), /switch\.cancello/);

  const ricette = leRicettePerLAuto(azioni, RISOLVI);
  assert.deepEqual(ricette, [
    {
      id: "0|Cancello",
      dominio: "switch",
      servizio: "toggle",
      entita: "switch.cancello",
      dati: {},
    },
  ]);
});

test("senza sapere come si esegue, nessun tasto promette di partire da solo", () => {
  /* È la risposta prudente: chi non ha passato il modo di eseguire non ha
   * detto che si può, e un tasto che promette e non fa è peggio di uno che
   * dice di aspettare. */
  const foto = laFotoPerLAuto({ azioni: [{ name: "Cancello", entity: "switch.cancello" }] });
  assert.equal(foto.azioni[0].subito, false);
  assert.deepEqual(leRicettePerLAuto([{ name: "Cancello", entity: "switch.cancello" }]), []);
});

/* ── I dispositivi (la categoria IOT) ────────────────────────────────────
 *
 * «View current device state» e «simple, one-touch on/off controls» sono le
 * due cose che Google mette per prime fra quello che un'app di questa
 * categoria può fare guidando. Finché in auto c'erano tre numeri e chi è in
 * casa, non ce n'era nessuna delle due — ed è la ragione per cui la revisione
 * non passava.
 *
 * Qui si prova la scelta, che è l'unica cosa che questo nucleo decide: quali
 * dispositivi entrano, in che ordine, e quali restano fuori. Le parole e gli
 * stati arrivano già scritti dalle tessere, come i numeri del fotovoltaico.
 */

const CANCELLO = {
  entity: "cover.cancello",
  nome: "Cancello",
  genere: "porta",
  acceso: false,
  stato: "Chiuso",
};
const FINESTRA = {
  entity: "cover.finestra_cucina",
  nome: "Finestra cucina",
  genere: "varco",
  acceso: true,
  stato: "Aperto",
};
const SALONE = {
  entity: "light.salone",
  nome: "Salone",
  genere: "luce",
  acceso: true,
  stato: "Accesa",
};
const CANTINA = {
  entity: "light.cantina",
  nome: "Cantina",
  genere: "luce",
  acceso: false,
  stato: "Spenta",
};

const idDi = (elenco) => elenco.map((uno) => uno.id);

test("una porta entra anche chiusa: il tasto serve proprio quando è chiusa", () => {
  const [uno, ...altri] = iDispositiviPerLAuto([CANCELLO]);
  assert.deepEqual(altri, []);
  assert.equal(uno.id, "cover.cancello");
  assert.equal(uno.nome, "Cancello");
  assert.equal(uno.genere, "porta");
  assert.equal(uno.acceso, false);
  assert.equal(uno.stato, "Chiuso");
});

test("una luce spenta no: sarebbe un tasto che non risponde a nessuna domanda", () => {
  /* Una casa ha quaranta luci e la griglia ne mostra sei. Quelle accese sono
   * poche e sono quelle che uno cerca partendo; sei spente a caso sono sei
   * tasti buttati. */
  assert.deepEqual(idDi(iDispositiviPerLAuto([SALONE, CANTINA])), ["light.salone"]);
});

test("l'ordine è quello che conta guidando: prima quello che si apre", () => {
  /* Il cancello è la ragione per cui uno prende in mano il telefono in
   * macchina. Se sta in fondo alla griglia, la griglia non serve. */
  const dentro = iDispositiviPerLAuto([SALONE, FINESTRA, CANCELLO]);
  assert.deepEqual(idDi(dentro), ["cover.cancello", "cover.finestra_cucina", "light.salone"]);
});

test("sei e non di più, e si tagliano gli ultimi, non i primi", () => {
  const tante = Array.from({ length: 9 }, (_v, i) => ({
    ...SALONE,
    entity: `light.stanza_${i}`,
    nome: `Stanza ${i}`,
  }));
  const dentro = iDispositiviPerLAuto([CANCELLO, ...tante]);
  assert.equal(dentro.length, DISPOSITIVI_AL_MASSIMO);
  assert.equal(dentro[0].id, "cover.cancello");
  assert.equal(dentro.at(-1).id, "light.stanza_4");
});

test("la stessa luce in due gruppi resta una luce sola", () => {
  assert.deepEqual(idDi(iDispositiviPerLAuto([SALONE, { ...SALONE, nome: "Salone (bis)" }])), [
    "light.salone",
  ]);
});

test("quello che questa casa non lascia comandare non diventa un tasto", () => {
  assert.deepEqual(iDispositiviPerLAuto([{ ...CANCELLO, comando: false }]), []);
});

test("una serratura resta fuori: il servizio giusto dipende da com'è messa adesso", () => {
  /* È la stessa regola dei tasti rapidi, per la stessa ragione: una ricetta
   * scritta mezz'ora fa chiuderebbe una porta che intanto qualcuno ha aperto.
   * E un `lock` un `toggle` non ce l'ha proprio. */
  assert.deepEqual(iDispositiviPerLAuto([{ ...CANCELLO, entity: "lock.portone" }]), []);
  assert.equal(laRicettaDelDispositivo("lock.portone"), null);
  assert.equal(laRicettaDelDispositivo("media_player.salotto"), null);
});

test("un tasto non è un dispositivo: non ha uno stato da guardare", () => {
  assert.equal(laRicettaDelDispositivo("button.riavvia"), null);
  assert.equal(laRicettaDelDispositivo("scene.buonanotte"), null);
  assert.equal(laRicettaDelDispositivo("sensor.temperatura"), null);
});

test("quelli che si commutano davvero hanno la loro ricetta", () => {
  for (const entita of [
    "light.salone",
    "switch.presa",
    "input_boolean.modo_notte",
    "fan.camera",
    "cover.cancello",
  ]) {
    assert.deepEqual(laRicettaDelDispositivo(entita), {
      dominio: entita.split(".")[0],
      servizio: "toggle",
      entita,
      dati: { entity_id: entita },
    });
  }
  assert.equal(laRicettaDelDispositivo("niente"), null);
  assert.equal(laRicettaDelDispositivo(""), null);
});

test("la sostituzione di entità vale anche qui", () => {
  /* Chi ha rimappato una luce a mano la ha rimappata per tutta la plancia, e
   * l'auto non è un posto dove quella scelta si dimentica. */
  const risolvi = (entita) =>
    entita === "light.salone" ? { entita: "light.salone_vero" } : { entita };
  assert.equal(laRicettaDelDispositivo("light.salone", risolvi).entita, "light.salone_vero");
  assert.equal(iDispositiviPerLAuto([SALONE], risolvi)[0].ricetta.entita, "light.salone_vero");
});

test("nel file che legge l'auto vanno i nomi, non le ricette", () => {
  /* Come per i tasti: il file dell'auto porta quello che si legge e si preme,
   * e non una riga che dica come si entra in casa. */
  const foto = laFotoPerLAuto({ dispositivi: [CANCELLO, SALONE], adesso: 1 });
  assert.equal(foto.dispositivi.length, 2);
  for (const uno of foto.dispositivi) {
    assert.deepEqual(Object.keys(uno).sort(), ["acceso", "genere", "id", "nome", "stato"]);
    assert.equal(uno.ricetta, undefined);
  }
  assert.ok(!JSON.stringify(foto).includes("toggle"));
});

test("le ricette dei dispositivi viaggiano nello stesso elenco dei tasti", () => {
  const ricette = leRicetteDeiDispositivi([CANCELLO, SALONE]);
  assert.deepEqual(
    ricette.map((una) => una.id),
    ["cover.cancello", "light.salone"],
  );
  assert.equal(ricette[0].servizio, "toggle");
  /* E gli identificativi non si pestano con quelli dei tasti, che la barra ce
   * l'hanno sempre dentro. */
  for (const una of ricette) assert.ok(!una.id.includes("|"));
});

test("con i soli dispositivi la fotografia c'è: non serve altro per essere utile", () => {
  const foto = laFotoPerLAuto({ dispositivi: [CANCELLO], adesso: 7 });
  assert.ok(foto);
  assert.deepEqual(foto.fotovoltaico, []);
  assert.deepEqual(foto.persone, []);
  assert.deepEqual(foto.azioni, []);
  /* E senza niente resta `null`: un file vuoto farebbe credere all'auto di
   * avere una fotografia quando non ce l'ha. */
  assert.equal(laFotoPerLAuto({ adesso: 7 }), null);
});

test("un cancello che si apre fa rimandare la fotografia", () => {
  /* Se la firma non li guardasse, in macchina si leggerebbe «Chiuso» su un
   * cancello aperto finché non cambia qualcos'altro. */
  const chiuso = laFotoPerLAuto({ dispositivi: [CANCELLO], adesso: 1 });
  const aperto = laFotoPerLAuto({
    dispositivi: [{ ...CANCELLO, acceso: true, stato: "Aperto" }],
    adesso: 1,
  });
  assert.notEqual(firmaDellaFoto(chiuso), firmaDellaFoto(aperto));
});
