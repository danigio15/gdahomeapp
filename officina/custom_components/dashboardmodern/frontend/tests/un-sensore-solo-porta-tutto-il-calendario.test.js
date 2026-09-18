/* «Molte integrazioni non forniscono un calendario vero e proprio ma dei
 *  sensori sensor.xxx. Sarebbe bello poterli usare» (#443).
 *
 * Un sensore PER MATERIALE la plancia lo legge da sempre: è la riga, con la
 * sua data. Quello che mancava è l'altro modo, che in Italia è il più
 * diffuso: UN sensore che porta l'intero elenco dei prossimi ritiri negli
 * attributi — il `sensor.savno_conegliano_prossimi_ritiri` della segnalazione
 * — dove ogni voce ha una data e il nome della frazione.
 *
 * Un dialetto solo non c'è: chi scrive queste integrazioni mette un elenco di
 * oggetti, o un elenco di frasi, o una mappa frazione → data. Qui si provano
 * tutte e tre, e si prova soprattutto quello che NON deve succedere: una voce
 * senza data non diventa una riga muta, e un elenco che non dice niente lascia
 * il campo al modo di prima invece di cancellarlo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { letturaRifiuti, ritiriDaUnElenco } from "../src/core/rifiuti-model.js";

const ADESSO = Date.parse("2026-09-08T18:00:00Z");
const giorno = (quanti) => new Date(ADESSO + quanti * 86400000).toISOString().slice(0, 10);
const materiali = (righe) => righe.map((riga) => riga.materiale);

test("un elenco di oggetti: ogni voce ha la sua data e la sua frazione", () => {
  const righe = ritiriDaUnElenco(
    {
      state: giorno(1),
      attributes: {
        prossimi_ritiri: [
          { data: giorno(2), tipo: "Carta e cartone" },
          { data: giorno(1), tipo: "Plastica e lattine" },
          { data: giorno(4), tipo: "Secco residuo" },
        ],
      },
    },
    ADESSO,
  );
  assert.deepEqual(materiali(righe), ["plastica", "carta", "indifferenziato"]);
  assert.deepEqual(
    righe.map((riga) => riga.giorni),
    [1, 2, 4],
  );
  /* Il nome dell'integrazione non si ripete quando dice quello che dice già il
   * materiale: la riga ha il suo nome di casa. */
  assert.equal(righe[0].nome, "");
});

test("un elenco di frasi, con la data scritta dentro", () => {
  const righe = ritiriDaUnElenco(
    {
      state: "ok",
      attributes: { upcoming: [`${giorno(3)} Vetro`, `Organico ${giorno(1)}`] },
    },
    ADESSO,
  );
  assert.deepEqual(materiali(righe), ["organico", "vetro"]);
});

test("una mappa frazione → data", () => {
  const righe = ritiriDaUnElenco(
    { state: "ok", attributes: { raccolte: { plastica: giorno(5), umido: giorno(0) } } },
    ADESSO,
  );
  assert.deepEqual(materiali(righe), ["organico", "plastica"]);
  assert.equal(righe[0].quando, "oggi");
});

test("i ritiri già passati restano fuori, e di ogni materiale si tiene il primo", () => {
  const righe = ritiriDaUnElenco(
    {
      state: "ok",
      attributes: {
        prossimi_ritiri: [
          { date: giorno(-3), type: "Plastica" },
          { date: giorno(2), type: "Plastica" },
          { date: giorno(9), type: "Plastica" },
        ],
      },
    },
    ADESSO,
  );
  assert.deepEqual(materiali(righe), ["plastica"]);
  assert.equal(righe[0].giorni, 2);
});

test("una voce senza data sparisce: non diventa una riga muta", () => {
  const righe = ritiriDaUnElenco(
    {
      state: "ok",
      attributes: {
        prossimi_ritiri: [{ tipo: "Plastica" }, { data: giorno(1), tipo: "Carta" }],
      },
    },
    ADESSO,
  );
  assert.deepEqual(materiali(righe), ["carta"]);
});

test("niente attributi, niente elenco: nessuna riga inventata", () => {
  assert.deepEqual(ritiriDaUnElenco(null, ADESSO), []);
  assert.deepEqual(ritiriDaUnElenco({ state: giorno(1) }, ADESSO), []);
  assert.deepEqual(
    ritiriDaUnElenco({ state: "ok", attributes: { icon: "mdi:trash" } }, ADESSO),
    [],
  );
});

test("nella lettura le voci dell'elenco diventano righe come le altre", () => {
  const lettura = letturaRifiuti(
    { calendario: "sensor.savno_prossimi_ritiri" },
    {
      "sensor.savno_prossimi_ritiri": {
        state: giorno(1),
        attributes: {
          prossimi_ritiri: [
            { data: giorno(1), tipo: "Plastica" },
            { data: giorno(3), tipo: "Vetro" },
          ],
        },
      },
    },
    (v) => v,
    ADESSO,
  );
  assert.deepEqual(materiali(lettura.righe), ["plastica", "vetro"]);
  assert.deepEqual(materiali(lettura.domani), ["plastica"]);
  /* E la riga unica del «Calendario dei ritiri» non si aggiunge sopra: direbbe
   * una seconda volta la prima delle righe. */
  assert.equal(lettura.calendario, null);
});

test("un sensore che dice una data sola continua a leggersi come prima", () => {
  /* La correzione non toglie niente a chi funzionava: un `calendar.*` con il
   * suo `start_time`, o un sensore la cui data sta nello stato, restano la
   * riga unica di sempre. */
  const lettura = letturaRifiuti(
    { calendario: "calendar.rifiuti" },
    {
      "calendar.rifiuti": {
        state: "off",
        attributes: { start_time: `${giorno(2)} 06:00:00`, message: "Raccolta carta" },
      },
    },
    (v) => v,
    ADESSO,
  );
  assert.ok(lettura.calendario, "la riga del calendario c'è ancora");
  assert.equal(lettura.calendario.materiale, "carta");
  assert.equal(lettura.calendario.giorni, 2);
});

test("un materiale che ha già il suo sensore non si ripete dall'elenco", () => {
  const lettura = letturaRifiuti(
    {
      calendario: "sensor.elenco",
      righe: [{ materiale: "plastica", entity: "sensor.plastica" }],
    },
    {
      "sensor.plastica": { state: giorno(6) },
      "sensor.elenco": {
        state: "ok",
        attributes: {
          prossimi_ritiri: [
            { data: giorno(1), tipo: "Plastica" },
            { data: giorno(2), tipo: "Carta" },
          ],
        },
      },
    },
    (v) => v,
    ADESSO,
  );
  const plastiche = lettura.righe.filter((riga) => riga.materiale === "plastica");
  assert.equal(plastiche.length, 1);
  assert.equal(plastiche[0].entity, "sensor.plastica");
  assert.equal(plastiche[0].giorni, 6);
});

/* Il materiale dedotto conta come materiale, anche per l'esclusione.
 *
 * Chi configura un sensore per materiale ma non sceglie QUALE materiale lascia
 * «altro», e il materiale vero lo dice il sensore: Waste Collection Schedule
 * scrive `types`, altri `waste_type`, altri ancora solo il nome amichevole.
 * Quella traduzione la faceva soltanto il disegno delle righe; l'elenco delle
 * esclusioni, che decide se il calendario può portare la SUA plastica, restava
 * fermo su «altro».
 *
 * Risultato: due righe dello stesso bidone — una dal sensore, una dal
 * calendario — con due date diverse. Che è precisamente la cosa che
 * l'esclusione esiste per impedire.
 */
test("un sensore col materiale dedotto zittisce il calendario su quel materiale", () => {
  const lettura = letturaRifiuti(
    {
      calendario: "sensor.savno_prossimi_ritiri",
      righe: [{ entity: "sensor.raccolta_plastica", materiale: "altro" }],
    },
    {
      /* Il sensore non dice «plastica» nella configurazione: lo dice da sé. */
      "sensor.raccolta_plastica": {
        state: giorno(4),
        attributes: { friendly_name: "Raccolta plastica", waste_type: "Plastica" },
      },
      "sensor.savno_prossimi_ritiri": {
        state: giorno(1),
        attributes: {
          prossimi_ritiri: [
            { data: giorno(1), tipo: "Plastica" },
            { data: giorno(3), tipo: "Vetro" },
          ],
        },
      },
    },
    (v) => v,
    ADESSO,
  );
  const plastiche = lettura.righe.filter((riga) => riga.materiale === "plastica");
  assert.equal(
    plastiche.length,
    1,
    "due plastiche con due date diverse: l'esclusione ha guardato «altro» invece del materiale vero",
  );
  /* E quella che resta è quella del sensore, che sa la data vera. */
  assert.equal(plastiche[0].entity, "sensor.raccolta_plastica");
  /* Il vetro invece il sensore non ce l'ha, e il calendario lo porta. */
  assert.ok(materiali(lettura.righe).includes("vetro"));
});

/* «Purtroppo anche dopo l'aggiornamento ancora non legge il sensore» (#443),
 * con `sensor.savno_conegliano_prossimi_ritiri` nella foto.
 *
 * L'elenco la plancia lo sapeva già leggere — ma solo dalla casella in fondo,
 * quella del calendario. Chi ha UN sensore per tutta la raccolta lo scrive dove
 * c'è scritto «Sensore o calendario del ritiro», cioè in una riga: è la casella
 * che si incontra per prima, e dice proprio il suo nome.
 *
 * Lì quel sensore veniva letto come una riga qualunque — si cercava una data
 * nel suo stato, non c'era, e restava un trattino muto — mentre il suo elenco,
 * con dentro tutti i ritiri, non lo guardava nessuno.
 */
test("un sensore con l'elenco messo in una riga viene letto lo stesso", () => {
  const stati = {
    "sensor.savno_conegliano_prossimi_ritiri": {
      state: "Prossimi ritiri",
      attributes: {
        friendly_name: "SAVNO Conegliano prossimi ritiri",
        prossimi_ritiri: [
          { date: "2026-09-12", type: "Secco" },
          { date: "2026-09-14", type: "Plastica e lattine" },
          { date: "2026-09-16", type: "Organico" },
        ],
      },
    },
  };
  const lettura = letturaRifiuti(
    { righe: [{ entity: "sensor.savno_conegliano_prossimi_ritiri" }] },
    stati,
    (value) => value,
    Date.parse("2026-09-11T08:00:00"),
  );
  const materiali = lettura.righe.map((riga) => riga.materiale);
  // «Secco» è il nome che usa il comune per l'indifferenziato: lo traduce
  // `materialeDalNome`, come per gli eventi del calendario.
  assert.ok(materiali.includes("indifferenziato"), "il secco esce dall'elenco");
  assert.ok(materiali.includes("plastica"));
  assert.ok(materiali.includes("organico"));
  assert.equal(
    lettura.righe.filter((riga) => riga.muto).length,
    0,
    "e la riga non resta il trattino muto di prima",
  );
});

test("una riga da cui una data esce davvero resta la riga che è", () => {
  /* Lì il materiale l'ha scelto chi configura e la data c'è: non si va a
   * cercare nessun elenco, e nessuno si ritrova bidoni che non aveva messo. */
  const stati = {
    "sensor.plastica": {
      state: "2026-09-14",
      attributes: {
        friendly_name: "Plastica",
        prossimi_ritiri: [{ date: "2026-09-12", type: "Secco" }],
      },
    },
  };
  const lettura = letturaRifiuti(
    { righe: [{ entity: "sensor.plastica", materiale: "plastica" }] },
    stati,
    (value) => value,
    Date.parse("2026-09-11T08:00:00"),
  );
  assert.deepEqual(
    lettura.righe.map((riga) => riga.materiale),
    ["plastica"],
  );
});

test("lo stesso materiale non esce due volte da due elenchi", () => {
  /* Quello scritto in una riga l'ha scelto chi configura, e comanda su quello
   * della casella in fondo. */
  const elenco = (nome) => ({
    state: "Prossimi ritiri",
    attributes: {
      friendly_name: nome,
      prossimi_ritiri: [{ date: "2026-09-12", type: "Secco" }],
    },
  });
  const lettura = letturaRifiuti(
    {
      righe: [{ entity: "sensor.in_riga" }],
      calendario: "sensor.in_fondo",
    },
    { "sensor.in_riga": elenco("In riga"), "sensor.in_fondo": elenco("In fondo") },
    (value) => value,
    Date.parse("2026-09-11T08:00:00"),
  );
  assert.equal(lettura.righe.filter((riga) => riga.materiale === "indifferenziato").length, 1);
});

/* Il SAVNO di Conegliano, con gli attributi veri della segnalazione #28.
 *
 * «Il sensore continua a non riportare alcun dato»: riportava una riga sola, e
 * generica. La data la leggeva — `data` era già fra i nomi noti — ma la
 * frazione no: quel sensore la scrive in `cosa` e in `rifiuti`, e nessuno dei
 * due era fra i nomi che si guardavano. Sette ritiri diventavano sette
 * «Altro», e siccome di ogni materiale si tiene la prima occasione, di sette
 * ne restava uno.
 */
const SAVNO = Object.freeze({
  state: "2026-09-18",
  attributes: {
    ritiri: [
      {
        giorno_settimana: "Venerdì",
        quando: "Oggi",
        data: "2026-09-18",
        giorni_mancanti: 0,
        cosa: "Umido + Secco",
        rifiuti: ["Umido", "Secco"],
      },
      {
        giorno_settimana: "Lunedì",
        quando: "21/09",
        data: "2026-09-21",
        giorni_mancanti: 3,
        cosa: "Verde Zona B",
        rifiuti: ["Verde Zona B"],
      },
      {
        giorno_settimana: "Giovedì",
        quando: "24/09",
        data: "2026-09-24",
        giorni_mancanti: 6,
        cosa: "Carta + Vetro 2",
        rifiuti: ["Carta", "Vetro 2"],
      },
    ],
    numero_ritiri: 3,
    comune: "Conegliano",
    icon: "mdi:calendar-clock",
    friendly_name: "SAVNO Conegliano Prossimi ritiri",
  },
});
const IL_GIORNO_DEL_SAVNO = Date.parse("2026-09-18T09:00:00+02:00");

test("il sensore del comune scrive «cosa» e «rifiuti», e adesso si leggono", () => {
  const righe = ritiriDaUnElenco(SAVNO, IL_GIORNO_DEL_SAVNO);
  assert.deepEqual(materiali(righe), ["organico", "indifferenziato", "verde", "carta", "vetro"]);
  assert.deepEqual(
    righe.map((riga) => riga.giorni),
    [0, 0, 3, 6, 6],
  );
  /* Nessuna riga «Altro»: se ne salta fuori una, vuol dire che una frazione
   * non è stata riconosciuta. */
  assert.ok(!materiali(righe).includes("altro"));
});

test("un ritiro che porta via due frazioni sono due bidoni, non uno", () => {
  /* «Umido + Secco» stasera: chi guarda deve vederli tutti e due, perché sono
   * due bidoni da mettere fuori. Indovinarne uno solo dal testo ne perdeva uno
   * — e il perso era sempre lo stesso, quello scritto dopo. */
  const righe = ritiriDaUnElenco(SAVNO, IL_GIORNO_DEL_SAVNO).filter((riga) => riga.giorni === 0);
  assert.deepEqual(materiali(righe), ["organico", "indifferenziato"]);
});

test("la «e» non divide: «Plastica e lattine» resta un bidone solo", () => {
  /* L'errore opposto, e sarebbe peggio: una frazione sola contata due volte
   * riempie la sera di bidoni che non esistono. Si divide sui segni che
   * separano — più, barra, virgola — non sulle congiunzioni. */
  const righe = ritiriDaUnElenco(
    { state: "ok", attributes: { prossimi_ritiri: [{ data: giorno(1), tipo: "Plastica e lattine" }] } },
    ADESSO,
  );
  assert.deepEqual(materiali(righe), ["plastica"]);
});

test("una voce con la sola data resta una riga, come prima", () => {
  /* Muta, ma con la sua data: un sensore che dice solo quando passa dice
   * comunque qualcosa, e toglierla sarebbe una perdita. */
  const righe = ritiriDaUnElenco(
    { state: "ok", attributes: { prossimi_ritiri: [{ data: giorno(2) }] } },
    ADESSO,
  );
  assert.deepEqual(materiali(righe), ["altro"]);
  assert.equal(righe[0].giorni, 2);
});
