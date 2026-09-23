/* Chi c'e' nella rete, e come si toglie.
 *
 * «Voglio vedere elenco completo dei dispositivi e poterli eliminare.»
 *
 * Le due reti l'elenco lo danno in due modi diversi — ZHA risponde a una
 * domanda sul filo, Zigbee2MQTT lo tiene scritto in una cassetta — e quello
 * che esce dal ponte deve essere una forma sola: se chi disegna dovesse sapere
 * quale rete c'è in casa, ogni schermata andrebbe scritta due volte, e il
 * giorno che una delle due cambia le due direbbero cose diverse.
 *
 * E l'elimina si controlla. Non perché sia prudente: perché la rinomina ha già
 * insegnato, dal campo, quanto vale un «fatto» che nessuno ha guardato — «in
 * Home Assistant non ha cambiato il nome», mentre la schermata diceva che sì.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  comeSiChiedeLElenco,
  comeSiElimina,
  COORDINATORE,
  laCassettaDellElenco,
  laPotenza,
  laRigaDiZ2M,
  laRigaDiZha,
  lElencoDellaRete,
  leStradePerEliminare,
  ROUTER,
  TERMINALE,
  Z2M,
  ZHA,
  Zigbee,
} from "../src/zigbee.js";

const zitto = { debug() {}, info() {}, attenzione() {}, errore() {} };

/* Come le scrive ZHA. */
const DA_ZHA = [
  {
    ieee: "00:12:4B:00:1C:A1:B2:C3",
    user_given_name: "Presa garage",
    name: "lumi.plug",
    manufacturer: "LUMI",
    model: "lumi.plug.maeu01",
    device_type: "Router",
    power_source: "Mains",
    device_reg_id: "dev-presa",
    neighbors: [{ ieee: "00:12:4b:00:00:00:00:01", lqi: 180 }],
  },
  {
    ieee: "00:12:4B:00:00:00:00:01",
    name: "Coordinator",
    device_type: "Coordinator",
    power_source: "Mains",
  },
  {
    ieee: "00:15:8D:00:0A:BB:CC:DD",
    user_given_name: "Sensore cantina",
    manufacturer: "Aqara",
    model: "RTCGQ11LM",
    device_type: "EndDevice",
    power_source: "Battery or Unknown",
  },
];

/* E come li scrive Zigbee2MQTT. */
const DA_Z2M = [
  {
    ieee_address: "0x00124b001ca1b2c3",
    friendly_name: "Presa garage",
    type: "Router",
    power_source: "Mains (single phase)",
    definition: { vendor: "Xiaomi", model: "ZNCZ12LM" },
  },
  {
    ieee_address: "0x00158d000abbccdd",
    friendly_name: "Sensore cantina",
    type: "EndDevice",
    power_source: "Battery",
    definition: { vendor: "Aqara", model: "RTCGQ11LM" },
  },
];

test("una riga di ZHA e una di Zigbee2MQTT escono con la stessa faccia", () => {
  const zha = laRigaDiZha(DA_ZHA[0]);
  const z2m = laRigaDiZ2M(DA_Z2M[0]);
  assert.deepEqual(Object.keys(zha).sort(), Object.keys(z2m).sort());
  /* Il nome, il tipo e come va alimentato sono gli stessi fatti detti in due
   * dialetti: qui diventano una lingua sola. */
  for (const chiave of ["nome", "tipo", "potenza"]) assert.equal(zha[chiave], z2m[chiave]);
  assert.equal(zha.nome, "Presa garage");
  assert.equal(zha.tipo, ROUTER);
  assert.equal(zha.potenza, "rete");
});

test("la targa si scrive in un modo solo, anche se le due la scrivono diversa", () => {
  /* ZHA la scrive coi due punti e in maiuscolo, Zigbee2MQTT tutta attaccata
   * con lo «0x» davanti. Sono lo stesso apparecchio, e per la plancia devono
   * esserlo: se no lo stesso coso comparirebbe due volte. */
  assert.equal(laRigaDiZha(DA_ZHA[0]).id, "00:12:4b:00:1c:a1:b2:c3");
  assert.equal(laRigaDiZ2M(DA_Z2M[0]).id, "0x00124b001ca1b2c3");
});

test("i tre tipi si riconoscono in tutt'e due i dialetti", () => {
  assert.equal(
    lElencoDellaRete(ZHA, DA_ZHA).find((una) => una.tipo === COORDINATORE).nome,
    "Coordinator",
  );
  assert.equal(laRigaDiZha(DA_ZHA[2]).tipo, TERMINALE);
  assert.equal(laRigaDiZ2M(DA_Z2M[1]).tipo, TERMINALE);
});

test("a batteria o a corrente, e «non si sa» resta vuoto", () => {
  /* Sapere chi va a batteria è metà del mestiere quando una rete fa i
   * capricci. Chi non lo dice però non lo si inventa: vuoto è vuoto, ed è
   * diverso da «a corrente». */
  assert.equal(laPotenza("Battery or Unknown"), "batteria");
  assert.equal(laPotenza("Mains (single phase)"), "rete");
  assert.equal(laPotenza("DC Source"), "rete");
  assert.equal(laPotenza(""), "");
  assert.equal(laPotenza("boh"), "");
});

test("l'elenco esce in ordine di nome, che è l'unica cosa che uno riconosce", () => {
  const righe = lElencoDellaRete(ZHA, DA_ZHA);
  assert.deepEqual(
    righe.map((una) => una.nome),
    ["Coordinator", "Presa garage", "Sensore cantina"],
  );
});

test("una riga senza targa non entra: non si saprebbe di chi parla", () => {
  assert.equal(laRigaDiZha({ name: "Boh" }), null);
  assert.equal(lElencoDellaRete(Z2M, [{ friendly_name: "Boh" }]).length, 0);
});

test("i vicini si tengono, e servono alla mappa", () => {
  assert.deepEqual(laRigaDiZha(DA_ZHA[0]).vicini, [
    { id: "00:12:4b:00:00:00:00:01", qualita: 180 },
  ]);
  /* Chi non li ha non ha una mappa, e non è un guasto: la topologia si legge
   * quando qualcuno l'ha guardata. */
  assert.deepEqual(laRigaDiZha(DA_ZHA[1]).vicini, []);
});

test("a ZHA l'elenco si chiede, a Zigbee2MQTT si va a leggere", () => {
  assert.deepEqual(comeSiChiedeLElenco({ quale: ZHA }), { type: "zha/devices" });
  assert.equal(comeSiChiedeLElenco({ quale: Z2M }), null);
  assert.equal(laCassettaDellElenco("zigbee2mqtt"), "zigbee2mqtt/bridge/devices");
  assert.equal(laCassettaDellElenco("casa/zigbee"), "casa/zigbee/bridge/devices");
  assert.equal(laCassettaDellElenco(""), "");
});

test("togliere uno: il servizio per primo, e il comando interno dopo", () => {
  /* Stessa ragione di «apri»: il servizio è la superficie pubblica e si rompe
   * molto più di rado del comando interno, perché romperlo vuol dire rompere
   * le automazioni di chiunque. */
  const strade = leStradePerEliminare({ quale: ZHA }, "00:12:4B:00:1C:A1:B2:C3");
  assert.equal(strade.length, 2);
  assert.equal(strade[0].domain, "zha");
  assert.equal(strade[0].service, "remove");
  assert.equal(strade[0].service_data.ieee, "00:12:4b:00:1c:a1:b2:c3");
  assert.equal(strade[1].type, "zha/remove");
});

test("su Zigbee2MQTT si imbuca, e non si forza", () => {
  const comando = comeSiElimina({ quale: Z2M, cassetta: "zigbee2mqtt" }, "0x00124b001ca1b2c3");
  assert.equal(comando.service_data.topic, "zigbee2mqtt/bridge/request/device/remove");
  const scritto = JSON.parse(comando.service_data.payload);
  assert.equal(scritto.id, "0x00124b001ca1b2c3");
  /* Forzare toglie la riga senza che l'apparecchio lo sappia, e quello resta
   * appeso a cercare un coordinatore che non gli risponde più. */
  assert.equal(scritto.force, false);
});

test("senza rete non si toglie niente da nessuna parte", () => {
  assert.equal(comeSiElimina({ quale: "" }, "0x01"), null);
  assert.equal(comeSiElimina({ quale: Z2M, cassetta: "" }, "0x01"), null);
  assert.deepEqual(leStradePerEliminare({ quale: "" }, "0x01"), []);
});

/* ── E il giro vero, con una casa finta ────────────────────────────────── */

/* `toglie: false` e' una rete che non lo toglie mai; `dopoQuantiSguardi` e' una
 * rete che ci mette un po' — che e' quello che fa una rete vera, perche'
 * l'ordine viaggia via radio e l'elenco si riscrive dopo. */
function casaConZha({ righe = DA_ZHA, toglie = null, dopoQuantiSguardi = 0 } = {}) {
  const detto = [];
  let dentro = righe.slice();
  let daTogliere = null;
  let sguardi = 0;
  return {
    detto,
    async chiedi(comando) {
      detto.push(comando);
      if (comando.type === "config_entries/get") return [{ domain: "zha", state: "loaded" }];
      if (comando.type === "zha/devices") {
        if (daTogliere !== null && sguardi++ >= dopoQuantiSguardi) {
          dentro = dentro.filter((una) => una.ieee.toLowerCase() !== daTogliere);
          daTogliere = null;
        }
        return dentro;
      }
      if (comando.domain === "zha" && comando.service === "remove") {
        if (toglie === false) return null;
        daTogliere = comando.service_data.ieee.toLowerCase();
        return null;
      }
      return null;
    },
    async ascoltaIl() {
      return async () => {};
    },
  };
}

/* Nelle prove non si aspetta davvero: il tempo vero lo mette la rete, e qui la
 * rete e' finta. */
const subito = async () => {};

test("l'elenco arriva davvero, passando per il giro", async () => {
  const casa = casaConZha();
  const zigbee = new Zigbee({ casa, registro: zitto });
  const fuori = await zigbee.elenco();
  assert.equal(fuori.quale, ZHA);
  assert.equal(fuori.righe.length, 3);
  assert.equal(fuori.perche, "");
});

test("in una casa senza Zigbee l'elenco è vuoto e lo dice, invece di rompersi", async () => {
  const casa = {
    async chiedi(comando) {
      if (comando.type === "config_entries/get") return [];
      return null;
    },
    async ascoltaIl() {
      return async () => {};
    },
  };
  const fuori = await new Zigbee({ casa, registro: zitto }).elenco();
  assert.deepEqual(fuori.righe, []);
  assert.match(fuori.perche, /non c'e' una rete Zigbee/);
});

test("tolto uno, l'elenco che torna non ce l'ha più", async () => {
  const casa = casaConZha();
  const zigbee = new Zigbee({ casa, registro: zitto, aspetta: subito });
  const fuori = await zigbee.elimina("00:15:8D:00:0A:BB:CC:DD");
  assert.equal(fuori.fatto, true);
  assert.ok(!fuori.righe.some((una) => una.nome === "Sensore cantina"));
  assert.equal(fuori.righe.length, 2);
});

test("chi esce dopo qualche secondo è uscito: non si annuncia un guaio che non c'è", async () => {
  /* Dal campo, con lo scatto: «Ho provato ad eliminare un dispositivo ma e
   * uscito questo messaggio» — e il messaggio diceva che era ancora lì. Lo
   * era: l'elenco veniva riletto nell'istante in cui l'ordine partiva, e un
   * ordine Zigbee viaggia via radio. Un minuto dopo non c'era più.
   *
   * Qui la rete finta lo toglie al terzo sguardo, come farebbe una vera. */
  const casa = casaConZha({ dopoQuantiSguardi: 3 });
  const fuori = await new Zigbee({ casa, registro: zitto, aspetta: subito }).elimina(
    "00:15:8D:00:0A:BB:CC:DD",
  );
  assert.equal(fuori.fatto, true, fuori.perche);
  assert.equal(fuori.righe.length, 2);
});

test("se la rete dice sì e non lo toglie mai, non si dice «fatto» — e si dice cosa fare", async () => {
  /* È la lezione della rinomina, applicata prima che costi una segnalazione:
   * nessuna delle due reti conferma quello che è successo dopo — rispondono
   * di aver mandato l'ordine. L'unica conferma è riguardare l'elenco. */
  const casa = casaConZha({ toglie: false });
  const fuori = await new Zigbee({ casa, registro: zitto, aspetta: subito }).elimina(
    "00:15:8D:00:0A:BB:CC:DD",
  );
  assert.equal(fuori.fatto, false);
  assert.equal(fuori.righe.length, 3);
  /* E la frase non si ferma a «non è andata»: dice quant'è che si guarda,
   * perché quasi sempre succede, e cosa può fare chi ha il telefono in mano. */
  assert.match(fuori.perche, /ancora nell'elenco/);
  assert.match(fuori.perche, /12 secondi/);
  assert.match(fuori.perche, /dorme/);
  assert.match(fuori.perche, /sveglialo/);
  /* E si è guardato più di una volta: guardare una volta sola è il difetto. */
  const sguardi = casa.detto.filter((uno) => uno.type === "zha/devices").length;
  assert.ok(sguardi > 1, `si è guardato ${sguardi} volta`);
});

test("senza targa non si tocca niente", async () => {
  const casa = casaConZha();
  const fuori = await new Zigbee({ casa, registro: zitto }).elimina("");
  assert.equal(fuori.fatto, false);
  assert.equal(casa.detto.length, 0, "non si chiede nemmeno che rete c'è");
});

/* ── E la mappa ──────────────────────────────────────────────────────────
 *
 * «Crea inoltre la possibilità di mostrare la mappa di collegamento dei
 * dispositivi.»
 *
 * Chiedere a una rete Zigbee con chi parla ognuno non è una lettura: è un giro
 * di domande che il coordinatore fa a ogni ripetitore, uno alla volta, e su
 * una rete di venti cose ci mette fino a un minuto. Mentre lo fa la rete è
 * occupata. Per questo la mappa **si chiede**, e non si disegna da sola
 * aprendo la schermata — se no aprire la sezione Zigbee rallenterebbe le luci
 * di casa.
 */

import {
  ATTESA_DELLA_MAPPA,
  comeSiChiedeLaMappa,
  leCassetteDellaMappa,
  leRigheDallaMappaDiZ2M,
} from "../src/zigbee.js";
import {
  aCapo,
  DEBOLE,
  iFili,
  iNodi,
  iRami,
  laMappaDisegnata,
  LATO_MINIMO,
  quantoGrosso,
  quantoVuole,
} from "../src/mappa-zigbee.js";

test("a ZHA si dice di guardarsi, a Zigbee2MQTT si imbuca la domanda", () => {
  assert.deepEqual(comeSiChiedeLaMappa({ quale: ZHA }), { type: "zha/topology/update" });
  const z2m = comeSiChiedeLaMappa({ quale: Z2M, cassetta: "zigbee2mqtt" });
  assert.equal(z2m.service_data.topic, "zigbee2mqtt/bridge/request/networkmap");
  const chiesto = JSON.parse(z2m.service_data.payload);
  assert.equal(chiesto.type, "raw");
  /* I percorsi no: sono un'altra domanda — chi passa per dove — e costano un
   * secondo giro. Qui serve chi vede chi. */
  assert.equal(chiesto.routes, false);
  assert.deepEqual(leCassetteDellaMappa("casa/zigbee"), {
    chiedi: "casa/zigbee/bridge/request/networkmap",
    risponde: "casa/zigbee/bridge/response/networkmap",
  });
  assert.equal(leCassetteDellaMappa(""), null);
  assert.equal(ATTESA_DELLA_MAPPA, 90_000);
});

test("la mappa di Zigbee2MQTT arriva in due pezzi, e tornano insieme", () => {
  const righe = leRigheDallaMappaDiZ2M({
    data: {
      value: {
        nodes: [
          { ieeeAddr: "0x01", friendlyName: "Antenna", type: "Coordinator" },
          { ieeeAddr: "0x02", friendlyName: "Presa cucina", type: "Router" },
        ],
        links: [{ source: { ieeeAddr: "0x02" }, target: { ieeeAddr: "0x01" }, linkquality: 190 }],
      },
    },
  });
  assert.equal(righe.length, 2);
  const presa = righe.find((una) => una.nome === "Presa cucina");
  assert.deepEqual(presa.vicini, [{ id: "0x01", qualita: 190 }]);
});

test("un collegamento si conta una volta sola, con la misura peggiore", () => {
  /* La radio non è simmetrica: A può sentire B benissimo e B non sentire A.
   * Un filo vale quanto il suo verso più debole — se si disegnasse la media,
   * un ramo che in un verso non regge sembrerebbe buono. */
  const fili = iFili([
    { id: "a", nome: "A", vicini: [{ id: "b", qualita: 200 }] },
    { id: "b", nome: "B", vicini: [{ id: "a", qualita: 40 }] },
  ]);
  assert.equal(fili.length, 1);
  assert.equal(fili[0].qualita, 40);
  assert.ok(fili[0].qualita < DEBOLE, "e sotto la soglia si disegna tratteggiato");
});

test("un vicino che nell'elenco non c'è non si disegna", () => {
  /* Sarebbe un pallino senza nome, e in una mappa un pallino senza nome non
   * dice niente. */
  assert.deepEqual(iFili([{ id: "a", nome: "A", vicini: [{ id: "fantasma", qualita: 200 }] }]), []);
});

test("chi non parla con nessuno sta in fondo, e non finge di essere attaccato", () => {
  const righe = [
    { id: "c", nome: "Antenna", tipo: "coordinatore", vicini: [{ id: "r", qualita: 200 }] },
    { id: "r", nome: "Ripetitore", tipo: "router", vicini: [{ id: "c", qualita: 200 }] },
    { id: "s", nome: "Sensore muto", tipo: "terminale", vicini: [] },
  ];
  const { nodi, lato } = iNodi(righe);
  const solo = nodi.find((uno) => uno.id === "s");
  assert.equal(solo.solo, true);
  /* Sta sotto il quadrato dei cerchi, nella fascia sua. Il confronto e' col
   * lato del quadrato e non con novecento: il quadrato adesso cresce con la
   * rete, e un numero scritto a mano qui direbbe il vero solo per le case
   * piccole. */
  assert.ok(solo.y > lato, "fuori dal quadrato dei collegamenti");
  assert.equal(nodi.find((uno) => uno.id === "c").solo, false);
});

/* ─── Che una rete vera ci stia ─────────────────────────────────────────────
 *
 * Dal campo, con lo scatto: «La mappa dopo vari tentativi si e caricata ma non
 * si vede nulla». Quella casa ha ottanta apparecchi, e i due cerchi erano due
 * numeri fissi tarati su una dozzina: quarantacinque ripetitori su un cerchio
 * di centottantacinque hanno ventisei pixel di arco a testa ed erano larghi
 * cinquantaquattro. Misurato: centoventitre coppie di anelli uno sopra
 * l'altro.
 *
 * Questa prova non guarda il disegno: misura le distanze. E' l'unica cosa che
 * sa distinguere una mappa da una macchia. */
function unaReteDa(quantiRouter, quantiTerminali) {
  const righe = [
    { id: "0x0000", nome: "Antenna", tipo: COORDINATORE, potenza: "corrente", vicini: [] },
  ];
  for (let quale = 0; quale < quantiRouter; quale++) {
    righe.push({
      id: `0xr${quale}`,
      nome: `Presa della stanza ${quale}`,
      tipo: ROUTER,
      potenza: "corrente",
      vicini: [{ id: "0x0000", qualita: 180 }],
    });
    righe[0].vicini.push({ id: `0xr${quale}`, qualita: 180 });
  }
  for (let quale = 0; quale < quantiTerminali; quale++) {
    const padre = `0xr${quale % Math.max(1, quantiRouter)}`;
    righe.push({
      id: `0xt${quale}`,
      nome: `Sensore perdita acqua numero ${quale}`,
      tipo: TERMINALE,
      potenza: "batteria",
      vicini: [{ id: padre, qualita: 120 }],
    });
    righe.find((una) => una.id === padre)?.vicini.push({ id: `0xt${quale}`, qualita: 120 });
  }
  return righe;
}

test("ottanta apparecchi non si impilano: i cerchi crescono con la rete", () => {
  const { nodi, lato } = iNodi(unaReteDa(45, 34));
  const attaccati = nodi.filter((uno) => !uno.solo);
  let addosso = 0;
  for (let i = 0; i < attaccati.length; i++)
    for (let j = i + 1; j < attaccati.length; j++) {
      const uno = attaccati[i];
      const altro = attaccati[j];
      const quanto = Math.hypot(uno.x - altro.x, uno.y - altro.y);
      if (quanto < quantoGrosso(uno) + quantoGrosso(altro)) addosso++;
    }
  assert.equal(addosso, 0, "due anelli uno sopra l'altro");
  /* E la tela e' cresciuta: con ottanta apparecchi non ci si sta in novecento,
   * e fingere di si' e' proprio il difetto segnalato. */
  assert.ok(lato > LATO_MINIMO, `la tela e' rimasta ${lato}`);
  /* Nessuno esce dal foglio. */
  for (const nodo of nodi) {
    assert.ok(nodo.x >= 0 && nodo.x <= lato, `${nodo.nome} e' fuori di lato`);
    assert.ok(nodo.y >= 0, `${nodo.nome} e' sopra il foglio`);
  }
});

test("e i nomi non si mangiano: ognuno ha sul cerchio il posto che occupa", () => {
  /* Il posto che uno vuole e' il suo nome piu' un po' d'aria. Due vicini di
   * cerchio devono stare almeno alla meta' della somma dei loro posti: e'
   * esattamente la condizione che rende impossibile a due scritte toccarsi. */
  const { nodi } = iNodi(unaReteDa(45, 34));
  const cerchio = nodi.filter((uno) => uno.tipo === ROUTER);
  const inGiro = [...cerchio].sort(
    (uno, altro) => Math.atan2(uno.y, uno.x) - Math.atan2(altro.y, altro.x),
  );
  for (let quale = 1; quale < inGiro.length; quale++) {
    const uno = inGiro[quale - 1];
    const altro = inGiro[quale];
    const serve = (quantoVuole(uno) + quantoVuole(altro)) / 2;
    const quanto = Math.hypot(uno.x - altro.x, uno.y - altro.y);
    /* La corda e' un filo piu' corta dell'arco: il novanta per cento di quello
     * che serve e' la stessa condizione, senza pretendere che una retta sia
     * lunga come una curva. */
    assert.ok(quanto > serve * 0.9, `«${uno.nome}» e «${altro.nome}» a ${Math.round(quanto)}px`);
  }
});

test("la rete si legge anche a righe: l'antenna, i rami, e cosa gli sta appeso", () => {
  /* Il disegno di una casa con ottanta apparecchi e' largo due metri di
   * schermo: sul telefono o si guarda tutto e non si legge niente, o si legge
   * un pezzo per volta e ci si perde. Le stesse cose scritte in righe le
   * scorre chiunque — ed e' lo stesso conto del disegno, non un secondo. */
  const righe = [
    { id: "0x00", nome: "Antenna", tipo: COORDINATORE, potenza: "corrente", vicini: [] },
    {
      id: "0x01",
      nome: "Presa cucina",
      tipo: ROUTER,
      potenza: "corrente",
      vicini: [{ id: "0x00", qualita: 200 }],
    },
    {
      id: "0x02",
      nome: "Presa garage",
      tipo: ROUTER,
      potenza: "corrente",
      vicini: [{ id: "0x00", qualita: 60 }],
    },
    /* Questo ne vede due: sta sul ramo di chi sente meglio, non sull'altro. */
    {
      id: "0x03",
      nome: "Fumo cucina",
      tipo: TERMINALE,
      potenza: "batteria",
      vicini: [
        { id: "0x02", qualita: 40 },
        { id: "0x01", qualita: 180 },
      ],
    },
    {
      id: "0x04",
      nome: "Termostato cucina",
      tipo: TERMINALE,
      potenza: "batteria",
      vicini: [{ id: "0x01", qualita: 150 }],
    },
    { id: "0x05", nome: "Sensore muto", tipo: TERMINALE, potenza: "batteria", vicini: [] },
  ];
  const { rami, soli } = iRami(righe);
  /* Prima l'antenna, poi i rami piu' carichi: chi apre questo elenco cerca di
   * chi e' figlio un sensore, e i rami grossi sono dove si guarda. */
  assert.deepEqual(
    rami.map((uno) => uno.nome),
    ["Antenna", "Presa cucina", "Presa garage"],
  );
  const cucina = rami.find((uno) => uno.nome === "Presa cucina");
  assert.deepEqual(
    cucina.appesi.map((uno) => uno.nome),
    ["Fumo cucina", "Termostato cucina"],
  );
  /* La misura del filo verso chi lo regge viaggia con lui: e' quella che dice
   * se un ramo tiene o no. */
  assert.equal(cucina.appesi[0].qualita, 180);
  assert.equal(cucina.qualita, 200);
  assert.equal(rami.find((uno) => uno.nome === "Presa garage").appesi.length, 0);
  assert.deepEqual(
    soli.map((uno) => uno.nome),
    ["Sensore muto"],
  );
});

test("una casa piccola ha la mappa di sempre: la tela non cresce per niente", () => {
  /* La correzione non deve cambiare quello che gia' andava bene. */
  const { lato } = iNodi(unaReteDa(6, 8));
  assert.equal(lato, LATO_MINIMO);
});

test("il nome va a capo invece di essere tagliato", () => {
  /* Con una riga sola «Termostato cucina» diventava «Termostato cuc…», e un
   * nome tagliato in una mappa che serve a riconoscere le cose è un nome che
   * non serve. */
  assert.deepEqual(aCapo("Termostato cucina"), ["Termostato", "cucina"]);
  assert.deepEqual(aCapo("Antenna"), ["Antenna"]);
  /* Oltre le due righe si taglia davvero. */
  const tante = aCapo("Sensore di movimento della taverna di sotto");
  assert.equal(tante.length, 2);
  assert.ok(tante[1].endsWith("…"));
  /* E una parola sola più lunga di una riga si taglia, non si spezza a metà. */
  assert.equal(aCapo("Elettrodomesticissimo")[0].endsWith("…"), true);
});

test("il disegno è un SVG, e un nome con dentro una parentesi angolare non lo rompe", () => {
  const svg = laMappaDisegnata([
    {
      id: "c",
      nome: 'Antenna <"del" & garage>',
      tipo: "coordinatore",
      vicini: [{ id: "r", qualita: 9 }],
    },
    { id: "r", nome: "Ripetitore", tipo: "router", vicini: [{ id: "c", qualita: 9 }] },
  ]);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<\/svg>$/);
  assert.ok(!svg.includes('<"del"'), "il nome va scappato: lo scrive chi abita");
  assert.match(svg, /&amp;/);
});

test("le due vesti danno due fondi diversi, e nessuna scritta nera su nero", () => {
  const righe = [
    { id: "c", nome: "Antenna", tipo: "coordinatore", vicini: [{ id: "r", qualita: 9 }] },
    { id: "r", nome: "R", tipo: "router", vicini: [{ id: "c", qualita: 9 }] },
  ];
  assert.match(laMappaDisegnata(righe, { scuro: false }), /fill="#f8fafc"/);
  assert.match(laMappaDisegnata(righe, { scuro: true }), /fill="#0b1220"/);
});

test("senza rifare, su Zigbee2MQTT la mappa si dice invece di inventarla", async () => {
  /* Nella cassetta dei dispositivi i vicini non ci sono affatto: disegnare
   * una mappa vuota sembrerebbe una rete a pezzi. */
  const casa = {
    async chiedi(comando) {
      if (comando.type === "config_entries/get") return [];
      return null;
    },
    async ascoltaIl(comando, onEvento) {
      if (comando.topic.includes("bridge/info"))
        queueMicrotask(() => onEvento({ topic: "zigbee2mqtt/bridge/info" }));
      return async () => {};
    },
  };
  const fuori = await new Zigbee({ casa, registro: zitto }).mappa();
  assert.equal(fuori.quale, Z2M);
  assert.deepEqual(fuori.righe, []);
  assert.match(fuori.perche, /va chiesta/);
});

test("su ZHA la mappa si vede anche senza rifare il giro", async () => {
  const casa = casaConZha();
  const fuori = await new Zigbee({ casa, registro: zitto }).mappa();
  assert.equal(fuori.righe.length, 3);
  assert.equal(fuori.perche, "");
  assert.ok(
    !casa.detto.some((uno) => uno.type === "zha/topology/update"),
    "senza «rifai» non si fa aspettare nessuno",
  );
});

test("con «rifai» il giro parte, e poi si rilegge", async () => {
  const casa = casaConZha();
  await new Zigbee({ casa, registro: zitto }).mappa({ rifai: true });
  assert.ok(casa.detto.some((uno) => uno.type === "zha/topology/update"));
  assert.ok(casa.detto.some((uno) => uno.type === "zha/devices"));
});

/* ── I disegni veri ───────────────────────────────────────────────────────
 *
 * «La mappa deve essere fatta con icona dispositivi reali.»
 *
 * I disegni non si inventano: sono i centoventiquattro del catalogo della
 * plancia, quelli che si vedono sulle tessere e nelle schede. Una presa deve
 * essere la stessa presa dappertutto, se no in una casa ci sono due lingue.
 *
 * Quale disegno tocca a chi si sceglie dal nome, che è imperfetto e si sa —
 * ma è l'unica cosa che le due reti dicono tutte e due allo stesso modo. I due
 * casi qui sotto sono sbagli veri, visti rendendo la mappa e non leggendo il
 * codice: sono il motivo per cui queste prove esistono.
 */

import { ilDisegnoDi } from "../src/mappa-zigbee.js";
import { Commissioni } from "../src/commissioni.js";

test("il nome dice l'oggetto, e la stanza non glielo ruba", () => {
  /* «Presa garage» è una presa che sta in garage, non una porta di garage.
   * Con le stanze davanti nell'elenco si prendeva il basculante — e un'icona
   * sbagliata è peggio di un'icona generica, perché la prima la si crede. */
  assert.equal(ilDisegnoDi({ nome: "Presa garage", tipo: TERMINALE }), "socket");
  assert.equal(ilDisegnoDi({ nome: "Portone garage", tipo: TERMINALE }), "garage-door");
  assert.equal(ilDisegnoDi({ nome: "Luce cantina", tipo: TERMINALE }), "lights");
});

test("i nostri sono prefissi: «termostat» aggancia «Termostato»", () => {
  /* Col confine di parola anche in coda, «Termostato cucina» e «Finestra
   * salotto» restavano senza disegno: la regola c'era e non scattava mai. */
  assert.equal(ilDisegnoDi({ nome: "Termostato cucina", tipo: TERMINALE }), "thermometer");
  assert.equal(ilDisegnoDi({ nome: "Finestra salotto", tipo: TERMINALE }), "window");
  assert.equal(ilDisegnoDi({ nome: "Ripetitore taverna", tipo: ROUTER }), "router");
  assert.equal(ilDisegnoDi({ nome: "Telecomando salotto", tipo: TERMINALE }), "toggle");
});

test("chi non si riconosce prende il neutro del suo mestiere, non uno a caso", () => {
  assert.equal(ilDisegnoDi({ nome: "Coso 3", tipo: TERMINALE }), "sliders");
  assert.equal(ilDisegnoDi({ nome: "Coso 4", tipo: ROUTER }), "socket");
  assert.equal(ilDisegnoDi({ nome: "Coso 5", tipo: COORDINATORE }), "router");
});

test("ogni disegno che nominiamo esiste davvero nel catalogo", async () => {
  /* Un nome sbagliato qui non si vedrebbe come errore: uscirebbe un pallino
   * vuoto, e nessuno saprebbe perché. */
  const { chiaviDisegnate } = await import("../plancia/src/core/catalogo-disegni.js");
  const cE = new Set(chiaviDisegnate());
  const nomi = [
    "Presa",
    "Luce",
    "Fumo",
    "Movimento",
    "Allagamento",
    "Termostato",
    "Radiatore",
    "Serratura",
    "Telecomando",
    "Campanello",
    "Telecamera",
    "Altoparlante",
    "Ripetitore",
    "Pompa",
    "Irrigazione",
    "Caminetto",
    "Vibrazione",
    "Tapparella",
    "Finestra",
    "Portone garage",
    "Cancello",
    "Porta",
    "Coso",
  ];
  for (const nome of nomi)
    for (const tipo of [COORDINATORE, ROUTER, TERMINALE]) {
      const disegno = ilDisegnoDi({ nome, tipo });
      assert.ok(cE.has(disegno), `«${nome}» chiede «${disegno}», che nel catalogo non c'è`);
    }
});

test("il disegno finisce dentro la mappa, e non in uno «span» che l'SVG non sa", () => {
  /* Il catalogo consegna il disegno dentro uno `<span>`: dentro un SVG non ci
   * può stare, e `foreignObject` su `flutter_svg` sarebbe un buco bianco sul
   * telefono. Si tiene l'`<svg>` di dentro, che annidato è SVG valido. */
  const svg = laMappaDisegnata([
    { id: "c", nome: "Antenna", tipo: COORDINATORE, vicini: [{ id: "p", qualita: 200 }] },
    { id: "p", nome: "Presa cucina", tipo: ROUTER, vicini: [{ id: "c", qualita: 200 }] },
  ]);
  assert.ok(!svg.includes("<span"), "nessuno span dentro la figura");
  assert.ok(!svg.includes("foreignObject"));
  assert.match(svg, /data-dm-art="socket"/, "la presa ha il disegno della presa");
  assert.match(svg, /data-dm-art="router"/, "e l'antenna quello dell'antenna");
});

test("di un dispositivo che c'è già si sanno le entità, per la plancia", async () => {
  /* È la riga che rende vero il tasto «Mettilo nella plancia» partendo
   * dall'elenco invece che dall'abbinamento: il foglietto «Dove lo metto?»
   * decide la sezione dall'ENTITÀ — una lampadina va nelle Luci, un contatto
   * di porta nei Varchi — e di un dispositivo senza entità non sa dire niente.
   *
   * Le entità stanno nei registri, che questo ponte legge già per il rapporto:
   * nessuna domanda in più a Home Assistant. */
  const { Registri } = await import("../src/registri.js");
  const casa = {
    async chiedi(comando) {
      if (comando.type === "config/device_registry/list")
        return [{ id: "dev-porta", name: "Aqara MCCGQ11LM", name_by_user: "Porta ingresso" }];
      if (comando.type === "config/entity_registry/list")
        return [
          {
            entity_id: "binary_sensor.porta_ingresso",
            device_id: "dev-porta",
            device_class: "door",
          },
          {
            entity_id: "sensor.porta_batteria",
            device_id: "dev-porta",
            entity_category: "diagnostic",
          },
          { entity_id: "light.altro", device_id: "dev-altro" },
        ];
      return null;
    },
  };
  const commissioni = new Commissioni({
    casa: { async chiedi() {} },
    registro: zitto,
    registri: new Registri({ casa }),
  });
  const detta = await commissioni.rispondi({
    id: 4,
    type: "ponte/zigbee/dimmi",
    dispositivo: "dev-porta",
  });
  assert.equal(detta.success, true);
  const suo = detta.result.dispositivo;
  assert.equal(suo.nome, "Porta ingresso");
  assert.equal(suo.entita.length, 2, "le sue, e non quelle di un altro");
  assert.equal(suo.entita[0].classe, "door");
  /* La diagnostica arriva lo stesso: a saltarla è la plancia, che le sue
   * sezioni le conosce. Deciderlo qui vorrebbe dire due posti che scelgono. */
  assert.equal(suo.entita[1].categoria, "diagnostic");
});

test("un dispositivo che questa casa non ha si dice, invece di uno vuoto", async () => {
  const { Registri } = await import("../src/registri.js");
  const commissioni = new Commissioni({
    casa: { async chiedi() {} },
    registro: zitto,
    registri: new Registri({
      casa: {
        async chiedi() {
          return [];
        },
      },
    }),
  });
  const detta = await commissioni.rispondi({
    id: 5,
    type: "ponte/zigbee/dimmi",
    dispositivo: "dev-fantasma",
  });
  assert.equal(detta.success, false);
  assert.equal(detta.error.code, "not_found");
});

/* ─── Che le icone si vedano anche nell'app ─────────────────────────────────
 *
 * «La mappa deve essere fatta con icona dispositivi reali.»
 *
 * Le icone c'erano, e nel browser si vedevano: erano un `<svg>` dentro
 * l'altro, che e' SVG valido. Sul telefono pero' la mappa usciva con gli
 * anelli colorati vuoti — `flutter_svg` gli `<svg>` annidati li salta. Si e'
 * scoperto guardando lo scatto della schermata, non il codice.
 *
 * Qui si difende la forma che disegnano tutti e due: niente `<svg>` dentro
 * l'`<svg>`, e ogni apparecchio col suo disegno messo in un `<g>` spostato. */
test("i disegni non sono «svg» annidati: quelli sul telefono non si vedono", () => {
  const svg = laMappaDisegnata([
    { id: "0x00", nome: "Antenna", tipo: "coordinatore", vicini: [{ id: "0x01" }] },
    { id: "0x01", nome: "Presa cucina", tipo: "router", vicini: [{ id: "0x00" }] },
  ]);
  /* Uno solo: quello che apre il documento. */
  assert.equal(svg.match(/<svg/g).length, 1);
  assert.equal(svg.includes("</svg>"), true);
});

test("ogni apparecchio porta il suo disegno, spostato e ridotto al punto giusto", () => {
  const svg = laMappaDisegnata([
    { id: "0x00", nome: "Antenna", tipo: "coordinatore", vicini: [{ id: "0x01" }] },
    { id: "0x01", nome: "Presa cucina", tipo: "router", vicini: [{ id: "0x00" }] },
    { id: "0x02", nome: "Porta ingresso", tipo: "terminale", vicini: [{ id: "0x01" }] },
  ]);
  const gruppi = [
    ...svg.matchAll(
      /<g data-dm-art="([^"]+)" transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)"/g,
    ),
  ];
  assert.equal(gruppi.length, 3);
  assert.deepEqual(
    gruppi.map((uno) => uno[1]),
    ["router", "socket", "front-door"],
  );
  /* Rimpicciolito, non ingrandito: i disegni del catalogo sono grandi
   * novantasei e un anello e' largo poche decine. */
  for (const uno of gruppi) {
    const quanto = Number(uno[4]);
    assert.equal(quanto > 0 && quanto < 1, true, `scala fuori posto: ${quanto}`);
  }
});
