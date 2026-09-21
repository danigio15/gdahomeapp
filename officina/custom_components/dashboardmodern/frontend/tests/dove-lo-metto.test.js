/* Dove va a finire un dispositivo appena entrato (#54, passo 4).
 *
 * «Vorrei poter abbinare un dispositivo zigbee direttamente dall'app.»
 * Abbinarlo è metà del lavoro: dopo, quel dispositivo è in Home Assistant e
 * nella plancia non c'è.
 *
 * Qui si prova la metà che decide — in che sezione va, e cosa ci finirà
 * scritto — che è quella che non tocca né il documento né il deposito.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  LE_SEZIONI,
  comeLoScrivo,
  cosaAltroPorta,
  dominioDi,
  entitaPrincipale,
  laSezioneGiusta,
  laVoceDaScrivere,
  puoDecidere,
  sezione,
  vuoleLaStanza,
} from "../src/core/dove-lo-metto.js";
import { nomeDellaSezione } from "../src/core/lelenco-delle-sezioni.js";

/* ── la proposta ────────────────────────────────────────────────────────── */

test("una lampadina è una lampadina: non c'è niente da indovinare", () => {
  assert.deepEqual(laSezioneGiusta({ entity: "light.lampadario_cucina" }), {
    chiave: "luci",
    perche: "lampadina",
    /* Quale entità ha deciso: su un dispositivo con sei entità serve a dire
     * anche quali sono le altre. */
    entity: "light.lampadario_cucina",
  });
  assert.equal(laSezioneGiusta({ entity: "climate.salone" }).chiave, "clima");
  assert.equal(laSezioneGiusta({ entity: "cover.tapparella_cucina" }).chiave, "tapparelle");
  assert.equal(
    laSezioneGiusta({ entity: "switch.presa_lavatrice", device_class: "outlet" }).chiave,
    "prese",
  );
});

test("su una rete Zigbee entra di tutto, e ognuno va al suo posto", () => {
  /* «In zigbee si inserisce di tutto: prese, sensori, presenza, temperatura.» */
  const dove = (entity, device_class) => laSezioneGiusta({ entity, device_class })?.chiave ?? null;
  assert.equal(dove("binary_sensor.porta_ingresso", "door"), "varchi");
  assert.equal(dove("binary_sensor.finestra_cucina", "window"), "varchi");
  assert.equal(dove("lock.portoncino"), "varchi");
  assert.equal(dove("binary_sensor.movimento_corridoio", "motion"), "presenza");
  assert.equal(dove("binary_sensor.presenza_studio", "occupancy"), "presenza");
  assert.equal(dove("sensor.temperatura_camera", "temperature"), "temp");
  assert.equal(dove("sensor.umidita_bagno", "humidity"), "temp");
});

test("un interruttore che non dice cosa comanda non si propone", () => {
  /* Può essere una presa, il relay di una caldaia o l'abilitazione di
   * un'automazione: chi accetta di fretta si ritrova il relay della caldaia
   * fra le prese di casa. Una proposta sbagliata costa più di una proposta
   * mancante. */
  assert.equal(laSezioneGiusta({ entity: "switch.qualcosa" }), null);
  /* E un sensore che misura qualcosa senza un posto suo: la qualità dell'aria,
   * la luce ambiente. */
  assert.equal(laSezioneGiusta({ entity: "sensor.luce_ambiente", device_class: "illuminance" }), null);
  assert.equal(laSezioneGiusta({ entity: "binary_sensor.boh" }), null);
  assert.equal(laSezioneGiusta({}), null);
});

/* ── un dispositivo, sei entità ─────────────────────────────────────────── */

test("quello che un dispositivo dice di sé non decide dove va", () => {
  /* Batteria, segnale, tensione: non è quello che fa. E l'aggiornamento del
   * firmware o il tasto «identificati» servono a governarlo, non a farne
   * qualcosa. */
  assert.equal(puoDecidere({ entity: "sensor.presa_batteria", device_class: "battery" }), false);
  assert.equal(puoDecidere({ entity: "sensor.presa_lqi", device_class: "signal_strength" }), false);
  assert.equal(puoDecidere({ entity: "update.presa_firmware" }), false);
  assert.equal(puoDecidere({ entity: "button.presa_identificati" }), false);
  /* E quello che Home Assistant marca da sé: l'ha già deciso lui. */
  assert.equal(puoDecidere({ entity: "sensor.x", entity_category: "diagnostic" }), false);
  assert.equal(puoDecidere({ entity: "switch.presa" }), true);
});

test("fra le sei entità di una presa decide l'interruttore, non la prima", () => {
  /* L'ordine in cui arrivano non è garantito: prendere la prima vorrebbe dire
   * che la stessa presa finisce fra le prese in una casa e fra i sensori in
   * un'altra. */
  const presa = {
    entities: [
      { entity: "sensor.presa_potenza", device_class: "power" },
      { entity: "sensor.presa_batteria", device_class: "battery" },
      { entity: "switch.presa_lavatrice", device_class: "outlet" },
      { entity: "sensor.presa_energia", device_class: "energy" },
      { entity: "update.presa_firmware" },
    ],
  };
  assert.equal(entitaPrincipale(presa.entities).entity, "switch.presa_lavatrice");
  const proposta = laSezioneGiusta(presa);
  assert.equal(proposta.chiave, "prese");
  assert.equal(proposta.entity, "switch.presa_lavatrice");
});

test("un sensore di presenza porta anche la luce e la batteria, e lo si dice", () => {
  /* Metterne una in una sezione non vuol dire che le altre siano sparite: chi
   * lo sa non va a cercarle credendo di averle perse. */
  const sensore = {
    entities: [
      { entity: "binary_sensor.corridoio_occupazione", device_class: "occupancy" },
      { entity: "sensor.corridoio_luce", device_class: "illuminance" },
      { entity: "sensor.corridoio_temperatura", device_class: "temperature" },
      { entity: "sensor.corridoio_batteria", device_class: "battery" },
    ],
  };
  const proposta = laSezioneGiusta(sensore);
  assert.equal(proposta.chiave, "presenza");
  const altro = cosaAltroPorta(sensore, proposta.entity);
  assert.equal(altro.quante, 3);
  /* Di quelle tre, una ha un posto suo: la temperatura va addosso a una
   * stanza. La luce e la batteria no. */
  assert.deepEqual(altro.daMettere, ["sensor.corridoio_temperatura"]);
});

test("un ripetitore di sola diagnostica non ha niente da proporre", () => {
  /* E non è un caso strano: un ripetitore Zigbee è esattamente questo. */
  const ripetitore = {
    entities: [
      { entity: "sensor.ripetitore_lqi", device_class: "signal_strength" },
      { entity: "update.ripetitore_firmware" },
    ],
  };
  assert.equal(laSezioneGiusta(ripetitore), null);
  /* Ma un'entità da scrivere a schermo c'è lo stesso: chi disegna non resta
   * senza niente da dire. */
  assert.ok(entitaPrincipale(ripetitore.entities).entity);
});

test("la copertura dice di che tipo è, quando lo sa", () => {
  /* «È una tenda da sole» e «è una copertura» non sono la stessa frase per
   * chi sta decidendo se accettare. */
  assert.equal(laSezioneGiusta({ entity: "cover.x", device_class: "awning" }).perche, "awning");
  assert.equal(laSezioneGiusta({ entity: "cover.x" }).perche, "copertura");
});

test("il dominio è quello che sta prima del punto", () => {
  assert.equal(dominioDi("light.salone"), "light");
  assert.equal(dominioDi("LIGHT.Salone"), "light");
  assert.equal(dominioDi("senzapunto"), "");
  assert.equal(dominioDi(""), "");
});

/* ── cosa si sta per scrivere ───────────────────────────────────────────── */

test("prima di toccare la configurazione si fa vedere cosa ci finisce", () => {
  /* È l'unico momento in cui chi guarda può accorgersi che il nome è
   * sbagliato: correggerlo costa un tocco adesso e un giro nell'editor dopo. */
  assert.deepEqual(
    comeLoScrivo("luci", {
      entity: "light.lampadario_cucina",
      nome: "Lampadario cucina",
      stanza: "Cucina",
    }),
    [
      { campo: "entity", valore: "light.lampadario_cucina" },
      { campo: "nome", valore: "Lampadario cucina" },
      { campo: "stanza", valore: "Cucina" },
    ],
  );
  /* Le prese e le voci proprie tengono anche l'icona; le luci e il clima la
   * prendono dal loro disegno. */
  const presa = comeLoScrivo("prese", { entity: "switch.x", nome: "Presa", stanza: "Cucina" });
  assert.deepEqual(presa.at(-1), { campo: "icona", valore: "🔌" });
  /* Il clima la stanza non la vuole: la sua unità si chiama già col nome
   * della stanza. */
  assert.equal(
    comeLoScrivo("clima", { entity: "climate.x", nome: "Salone", stanza: "Salone" }).some(
      (riga) => riga.campo === "stanza",
    ),
    false,
  );
  /* Una riga vuota non si scrive: dice «non c'è niente qui», che è rumore. */
  assert.equal(
    comeLoScrivo("luci", { entity: "light.x" }).some((riga) => riga.campo === "stanza"),
    false,
  );
  assert.deepEqual(comeLoScrivo("boh", {}), []);
});

/* ── le tre forme, che sono il motivo di tutto ──────────────────────────── */

test("la luce va in una mappa, e la sua stanza in un'altra", () => {
  /* È l'unica sezione fatta così, ed è per questo che scrivere dall'app
   * vorrebbe dire scrivere due volte tre forme diverse. */
  const scritto = laVoceDaScrivere(
    "luci",
    { entity: "light.cucina", nome: "Lampadario", stanza_id: "room_a" },
    { cd_luci: { "light.salone": "Salone" } },
  );
  assert.deepEqual(scritto.cd_luci, { "light.salone": "Salone", "light.cucina": "Lampadario" });
  assert.deepEqual(scritto.cd_luci_rooms, { "light.cucina": "room_a" });
  /* Senza stanza la mappa non si tocca: una mappa con dentro una stringa
   * vuota è una stanza chiamata «». */
  const nuda = laVoceDaScrivere("luci", { entity: "light.cucina", nome: "L" }, {});
  assert.equal("cd_luci_rooms" in nuda, false);
});

test("la presa è una riga con la stanza addosso", () => {
  const scritto = laVoceDaScrivere(
    "prese",
    { entity: "switch.lavatrice", nome: "Presa lavatrice", stanza_id: "room_b" },
    { cd_prese: [{ entity: "switch.altra", name: "Altra" }] },
  );
  assert.equal(scritto.cd_prese.length, 2);
  assert.deepEqual(scritto.cd_prese[1], {
    entity: "switch.lavatrice",
    name: "Presa lavatrice",
    icon: "🔌",
    room_id: "room_b",
  });
});

test("il clima porta anche di che tipo è", () => {
  const scritto = laVoceDaScrivere("clima", { entity: "climate.salone", nome: "Salone" }, {});
  assert.deepEqual(scritto.cd_clima_units, [
    { name: "Salone", entity: "climate.salone", type: "clima" },
  ]);
});

test("una voce propria finisce in una pagina, o non si vede da nessuna parte", () => {
  const scritto = laVoceDaScrivere("entita_mie", { entity: "sensor.x", nome: "Il mio" }, {});
  assert.equal(scritto.cd_entita_mie[0].sezione, "home");
  assert.equal(scritto.cd_entita_mie[0].icona, "⭐");
  /* E dove uno la vuole, se lo dice. */
  assert.equal(
    laVoceDaScrivere("entita_mie", { entity: "sensor.x", dove: "energy" }, {}).cd_entita_mie[0].sezione,
    "energy",
  );
});

test("rifare il giro corregge, non duplica", () => {
  /* Un dispositivo riabbinato tiene la sua entità: chi rifà il giro sta
   * correggendo qualcosa, non creando un doppione. */
  const prima = laVoceDaScrivere("prese", { entity: "switch.x", nome: "Vecchio" }, {});
  const dopo = laVoceDaScrivere("prese", { entity: "switch.x", nome: "Nuovo" }, prima);
  assert.equal(dopo.cd_prese.length, 1);
  assert.equal(dopo.cd_prese[0].name, "Nuovo");

  const clima = laVoceDaScrivere("clima", { entity: "climate.x", nome: "A" }, {});
  assert.equal(laVoceDaScrivere("clima", { entity: "climate.x", nome: "B" }, clima).cd_clima_units.length, 1);
});

test("senza entità non si scrive niente", () => {
  assert.equal(laVoceDaScrivere("luci", {}, {}), null);
  assert.equal(laVoceDaScrivere("boh", { entity: "light.x" }, {}), null);
});

test("ogni sezione dichiara i cassetti che tocca", () => {
  /* Servono a chi disegna per dire cosa sta per succedere, e a chi scrive per
   * sapere cosa rileggere: una sezione che ne tocca uno senza dichiararlo
   * scriverebbe sopra quello che c'era. */
  for (const voce of LE_SEZIONI) {
    assert.ok(voce.chiavi.length, voce.chiave);
    const scritto = laVoceDaScrivere(
      voce.chiave,
      { entity: "light.x", nome: "X", stanza_id: "r" },
      /* La sezione che vuole la stanza vuole anche che quella stanza esista. */
      { cd_stanze: [{ id: "r", name: "Stanza" }] },
    );
    assert.ok(scritto, voce.chiave);
    for (const cassetto of Object.keys(scritto))
      assert.ok(voce.chiavi.includes(cassetto), `${voce.chiave} tocca ${cassetto} senza dirlo`);
  }
  assert.equal(sezione("boh"), null);
  /* E chi la stanza la vuole lo dichiara, invece di farlo sapere a memoria a
   * chi disegna. */
  assert.equal(vuoleLaStanza("temp"), true);
  assert.equal(vuoleLaStanza("luci"), false);
});

/* Il nome di una sezione e' quello che il Config le da'.
 *
 * Altrimenti il foglietto dice «Tapparelle» e nel Config c'e' scritto
 * «Finestre»: chi accetta la proposta e poi va a cercare quella scheda non la
 * trova, e la cerca dove non c'e'. Le sei che una scheda ce l'hanno la parola
 * la prendono da li'; le due che non ce l'hanno se la portano, ma in tutte e
 * due le lingue — a schermo ci va quella che si parla.
 */
test("ogni sezione porta le due meta' del nome, e quelle del Config sono le sue", () => {
  for (const voce of LE_SEZIONI) {
    assert.equal(typeof voce.it, "string", `${voce.chiave}: manca l'italiano`);
    assert.equal(typeof voce.en, "string", `${voce.chiave}: manca l'inglese`);
    assert.ok(voce.it && voce.en, `${voce.chiave}: una meta' e' vuota`);
    const suo = nomeDellaSezione(voce.chiave);
    if (suo) assert.deepEqual({ it: voce.it, en: voce.en }, suo, `${voce.chiave}: nome diverso dal Config`);
  }
  /* E le due che il Config non conosce sono proprio quelle due: se un domani
   * le prese avessero una scheda, questa riga lo dice invece di lasciare due
   * nomi che si allontanano in silenzio. */
  assert.deepEqual(
    LE_SEZIONI.filter((voce) => !nomeDellaSezione(voce.chiave)).map((voce) => voce.chiave),
    ["prese", "entita_mie"],
  );
});

/* ── le due forme nuove: il foglietto e la stanza ───────────────────────── */

test("una porta si aggiunge al foglietto dei varchi, e si toglie dagli scarti", () => {
  /* Non un elenco di righe: un foglietto di correzioni — «questa è un varco
   * anche se Home Assistant non lo dice», «questa no» — più i nomi. */
  const scritto = laVoceDaScrivere(
    "varchi",
    { entity: "binary_sensor.porta", nome: "Porta d'ingresso" },
    { cd_varchi: { escluse: ["binary_sensor.porta"], aggiunte: [], nomi: {} } },
  );
  assert.deepEqual(scritto.cd_varchi.aggiunte, ["binary_sensor.porta"]);
  /* Toglierla dagli scarti è il modo di cambiare idea su qualcosa che si era
   * scartato: restandoci, l'aggiunta non varrebbe niente. */
  assert.deepEqual(scritto.cd_varchi.escluse, []);
  assert.equal(scritto.cd_varchi.nomi["binary_sensor.porta"], "Porta d'ingresso");
  /* Rifarlo non la scrive due volte. */
  const ancora = laVoceDaScrivere("varchi", { entity: "binary_sensor.porta", nome: "Porta" }, scritto);
  assert.equal(ancora.cd_varchi.aggiunte.length, 1);
});

test("un rilevatore di presenza passa dallo stesso foglietto, nel suo cassetto", () => {
  const scritto = laVoceDaScrivere(
    "presenza",
    { entity: "binary_sensor.movimento", nome: "Corridoio" },
    {},
  );
  assert.deepEqual(scritto.cd_presenza.aggiunte, ["binary_sensor.movimento"]);
  assert.equal("cd_varchi" in scritto, false);
});

test("una sonda va addosso a una stanza, e senza stanza non va da nessuna parte", () => {
  /* È la forma più diversa di tutte: non un elenco, una casella su una riga
   * delle Stanze. */
  const stanze = [{ id: "room_a", name: "Camera" }];
  const primo = laVoceDaScrivere(
    "temp",
    { entity: "sensor.camera_temp", nome: "Camera", stanza_id: "room_a", classe: "temperature" },
    { cd_stanze: stanze },
  );
  assert.equal(primo.cd_stanze[0].temp, "sensor.camera_temp");
  assert.equal(primo.cd_stanze[0].temp_name, "Camera");

  /* L'umidità ha la sua casella. */
  const conUmido = laVoceDaScrivere(
    "temp",
    { entity: "sensor.camera_hum", nome: "Camera", stanza_id: "room_a", classe: "humidity" },
    primo,
  );
  assert.equal(conUmido.cd_stanze[0].hum, "sensor.camera_hum");

  /* La seconda sonda della stessa stanza non sovrascrive la prima: va
   * nell'elenco delle sonde in più, che una stanza ha da quando può avere il
   * comodino e il termostato a muro. */
  const seconda = laVoceDaScrivere(
    "temp",
    { entity: "sensor.comodino", nome: "Comodino", stanza_id: "room_a", classe: "temperature" },
    conUmido,
  );
  assert.equal(seconda.cd_stanze[0].temp, "sensor.camera_temp");
  assert.deepEqual(seconda.cd_stanze[0].metadata.temperature_entries, [
    { id: "temperature-extra-1", name: "Comodino", temp: "sensor.comodino" },
  ]);

  /* Senza una stanza scelta non c'è dove metterla, e chi chiama se lo sente
   * dire invece di scrivere a vuoto. */
  assert.equal(
    laVoceDaScrivere("temp", { entity: "sensor.x", classe: "temperature" }, { cd_stanze: stanze }),
    null,
  );
  /* E se la stanza scelta non esiste più. */
  assert.equal(
    laVoceDaScrivere("temp", { entity: "sensor.x", stanza_id: "room_z" }, { cd_stanze: stanze }),
    null,
  );
});

test("un elenco di entità vuoto non è un dispositivo", () => {
  /* Chi quell'elenco lo tiene sempre — anche quando non ha niente da metterci
   * — passava di qui e si sentiva rispondere «non lo so» per tutto: si
   * cercava chi decide dentro il nulla. */
  assert.equal(laSezioneGiusta({ entity: "light.x", entities: [] }).chiave, "luci");
  assert.equal(laSezioneGiusta({ entity: "binary_sensor.p", device_class: "door", entities: [] }).chiave, "varchi");
});
