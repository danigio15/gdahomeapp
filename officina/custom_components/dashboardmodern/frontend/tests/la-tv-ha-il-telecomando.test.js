/* Il telecomando della TV (#132).
 *
 * «Ho collegato le TV a Home Assistant, sarebbe possibile usarle anche qua per
 * spegnerle, accenderle ed usare il loro telecomando virtuale se disponibile?»
 *
 * Accendere e spegnere è uscito nella 1.6.8. Qui si tiene ferma l'altra metà:
 * che ogni tasto porta il nome che l'integrazione di quella TV gli dà, che
 * un'integrazione di cui non si sanno i tasti non ha telecomando, che da spenta
 * il telecomando non c'è, che il telecomando trovato per nome non si prende le
 * frecce di un'altra integrazione, e che LG webOS i tasti li manda al lettore.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  SA,
  bindLettoreToDevice,
  comandoDelLettore,
  letturaDelLettore,
  normalizzaLettore,
} from "../src/core/media-player.js";
import {
  TELECOMANDI,
  comandoDelTelecomando,
  entitaDaRiconoscere,
  esitoDelTelecomando,
  tastiDelTelecomando,
  telecomandoDelLettore,
  telecomandoGemello,
} from "../src/core/telecomando.js";

const { telecomandoMarkup } = await import(
  `../src/sections/media-player-section.js?telecomando=${Date.now()}`
);

const leggi = (percorso) => readFileSync(new URL(percorso, import.meta.url), "utf8");
const sezione = leggi("../src/sections/media-player-section.js");
const scheda = leggi("../src/sections/media-player-editor-section.js");

const TV = "media_player.tv_salotto";
const REMOTO = "remote.tv_salotto";
const SOLO_TV = SA.ACCENDI | SA.SPEGNI | SA.SORGENTE | SA.PASSI_VOLUME | SA.MUTO;

const stati = (tv = "on", remoto = "on") => ({
  [TV]: { state: tv, attributes: { friendly_name: "TV Salotto", supported_features: SOLO_TV } },
  [REMOTO]: { state: remoto, attributes: { friendly_name: "TV Salotto" } },
});

const SAMSUNG = { [TV]: "samsungtv", [REMOTO]: "samsungtv" };

test("una Samsung accesa ha le frecce, OK e i canali, coi nomi di Samsung", () => {
  const tele = telecomandoDelLettore({ entity: TV, acceso: true }, stati(), SAMSUNG);
  assert.equal(tele.via, "remote");
  assert.equal(tele.entity, REMOTO);
  assert.equal(tele.piattaforma, "samsungtv");
  assert.deepEqual(comandoDelTelecomando(tele, "su"), {
    domain: "remote",
    service: "send_command",
    data: { entity_id: REMOTO, command: "KEY_UP" },
  });
  assert.equal(comandoDelTelecomando(tele, "ok").data.command, "KEY_ENTER");
  assert.equal(comandoDelTelecomando(tele, "indietro").data.command, "KEY_RETURN");
  assert.equal(comandoDelTelecomando(tele, "canale_piu").data.command, "KEY_CHUP");
  /* Un tasto che non esiste non diventa una chiamata a vuoto. */
  assert.equal(comandoDelTelecomando(tele, "rosso"), null);
  assert.equal(comandoDelTelecomando(null, "su"), null);
});

test("da spenta, in standby o muta la TV il telecomando non ce l'ha", () => {
  assert.equal(telecomandoDelLettore({ entity: TV, acceso: false }, stati("off"), SAMSUNG), null);
  for (const stato of ["off", "standby", "unavailable"]) {
    const lettura = letturaDelLettore({ entity: TV }, stati(stato), undefined, SAMSUNG);
    assert.equal(lettura.telecomando, null, stato);
  }
  /* Accesa sì, e la lettura lo porta con sé. */
  const accesa = letturaDelLettore({ entity: TV }, stati("on"), undefined, SAMSUNG);
  assert.equal(accesa.telecomando?.entity, REMOTO);
  /* Il telecomando che non risponde non manda tasti. */
  assert.equal(
    telecomandoDelLettore({ entity: TV, acceso: true }, stati("on", "unavailable"), SAMSUNG),
    null,
  );
});

test("un'integrazione di cui non si sanno i tasti non ha telecomando", () => {
  /* Harmony, Broadlink: i comandi li impara chi li usa, e qui non si sanno. */
  const harmony = { [TV]: "samsungtv", [REMOTO]: "harmony" };
  assert.equal(
    telecomandoDelLettore({ entity: TV, telecomando: REMOTO, acceso: true }, stati(), harmony),
    null,
  );
  /* E finché il registro non ha risposto non si disegna niente. */
  assert.equal(telecomandoDelLettore({ entity: TV, acceso: true }, stati(), {}), null);
});

test("il telecomando trovato per nome vale solo se è della stessa integrazione", () => {
  /* Una cassa Sonos e una Android TV nella stessa stanza, chiamate tutte e due
   * «salotto»: le frecce della TV non vanno sulla scheda della cassa. */
  const CASSA = "media_player.salotto";
  const suo = { [CASSA]: { state: "playing", attributes: {} }, "remote.salotto": { state: "on" } };
  assert.equal(telecomandoGemello(CASSA, suo), "remote.salotto");
  const diversi = { [CASSA]: "sonos", "remote.salotto": "androidtv_remote" };
  assert.equal(telecomandoDelLettore({ entity: CASSA, acceso: true }, suo, diversi), null);
  /* Scelto nella scheda, invece, vale: l'ha detto chi configura. */
  const scelto = telecomandoDelLettore(
    { entity: CASSA, telecomando: "remote.salotto", acceso: true },
    suo,
    diversi,
  );
  assert.equal(scelto?.piattaforma, "androidtv_remote");
  assert.equal(comandoDelTelecomando(scelto, "ok").data.command, "DPAD_CENTER");
});

test("LG webOS i tasti li prende il lettore, con webostv.button", () => {
  const lg = { [TV]: "webostv", [REMOTO]: "webostv" };
  const tele = telecomandoDelLettore({ entity: TV, acceso: true }, stati(), lg);
  assert.equal(tele.via, "webostv");
  assert.equal(tele.entity, TV);
  assert.deepEqual(comandoDelTelecomando(tele, "giu"), {
    domain: "webostv",
    service: "button",
    data: { entity_id: TV, button: "DOWN" },
  });
  assert.equal(comandoDelTelecomando(tele, "canale_meno").data.button, "CHANNELDOWN");
});

test("ogni integrazione ha solo i tasti che documenta", () => {
  /* Apple TV: indietro è «menu», e i canali non ci sono. */
  const apple = tastiDelTelecomando({ tasti: TELECOMANDI.apple_tv.tasti });
  assert.ok(!apple.includes("canale_piu") && !apple.includes("menu"));
  assert.equal(TELECOMANDI.apple_tv.tasti.indietro, "menu");
  for (const [dominio, regola] of Object.entries(TELECOMANDI)) {
    for (const tasto of ["su", "giu", "sinistra", "destra", "ok", "indietro", "home"])
      assert.ok(regola.tasti[tasto], `${dominio} senza ${tasto}`);
    assert.ok(["remote", "webostv"].includes(regola.via), dominio);
  }
  /* Niente ADB: la riga di comando di un Android non è un tasto. */
  assert.equal(TELECOMANDI.androidtv, undefined);
});

test("si chiede l'integrazione solo dei lettori e dei loro telecomandi", () => {
  const voci = [
    { entity: TV, telecomando: "remote.scelto" },
    { entity: "media_player.cucina" },
    { entity: "" },
  ];
  assert.deepEqual(entitaDaRiconoscere(voci, stati()), [
    TV,
    "remote.scelto",
    REMOTO,
    "media_player.cucina",
  ]);
});

test("dal dispositivo il telecomando arriva scritto, e un'entità qualunque non lo è", () => {
  const nato = bindLettoreToDevice({
    device: { id: "tv-1", name: "TV Salotto" },
    entities: [
      { entity_id: TV, platform: "samsungtv" },
      { entity_id: REMOTO, platform: "samsungtv" },
    ],
    states: stati(),
  });
  assert.equal(nato.entity, TV);
  assert.equal(nato.telecomando, REMOTO);
  assert.equal(normalizzaLettore({ entity: TV, telecomando: "switch.tv" }).telecomando, "");
  assert.equal(normalizzaLettore({ entity: TV, telecomando: ` ${REMOTO} ` }).telecomando, REMOTO);
});

test("la scheda del Config dice cosa verrà fuori dal telecomando scelto", () => {
  const voce = { entity: TV, telecomando: REMOTO };
  assert.equal(esitoDelTelecomando(voce, SAMSUNG).esito, "pronto");
  assert.equal(esitoDelTelecomando(voce, { [TV]: "samsungtv" }).esito, "attesa");
  assert.equal(esitoDelTelecomando(voce, { [REMOTO]: "harmony" }).esito, "sconosciuto");
  assert.equal(
    esitoDelTelecomando({ entity: TV, telecomando: "switch.x" }, {}).esito,
    "non_remote",
  );
  assert.equal(esitoDelTelecomando({ entity: TV }, {}).esito, "nessuno");
  assert.equal(esitoDelTelecomando({ entity: TV }, { [TV]: "webostv" }).esito, "tv");
});

test("sulla scheda: la croce con OK, e sotto indietro, home, menu e i canali", () => {
  const riga = letturaDelLettore({ entity: TV }, stati(), undefined, SAMSUNG);
  const disegno = telecomandoMarkup(riga);
  assert.match(disegno, /class="dm-mp-tele" data-dm-mp-tele="media_player\.tv_salotto"/);
  const tasti = [...disegno.matchAll(/data-dm-tele="([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tasti, [
    "su",
    "sinistra",
    "ok",
    "destra",
    "giu",
    "indietro",
    "home",
    "menu",
    "canale_meno",
    "canale_piu",
  ]);
  assert.match(disegno, /data-dm-tele="ok"[^>]*>OK</);
  assert.match(disegno, /<span class="dm-mp-ch">CH<\/span><b>\+<\/b>/);
  /* Spenta, niente. */
  assert.equal(
    telecomandoMarkup(letturaDelLettore({ entity: TV }, stati("off"), undefined, SAMSUNG)),
    "",
  );
});

test("il tasto parte verso il telecomando riletto adesso, e l'integrazione si chiede con calma", () => {
  assert.match(sezione, /const riga = letturaDi\(clean\(tele\.dataset\.dmTeleLettore\)\);/);
  assert.match(
    sezione,
    /comandoDelTelecomando\(riga\?\.telecomando, clean\(tele\.dataset\.dmTele\)\)/,
  );
  assert.match(sezione, /const RICHIEDI_DOPO_MS = 60 \* 1000;/);
  assert.match(sezione, /root\.addEventListener\?\.\(EVENTO_PIATTAFORME, ridisegnaMediaPlayer\);/);
  /* Il telecomando sta nella firma della card: compare quando si sa di chi è. */
  assert.match(sezione, /riga\.telecomando\.via\}:\$\{riga\.telecomando\.entity\}/);
  /* Nella scheda del Config l'esito si riscrive al suo posto, senza rifare la
   * riga sotto le dita di chi scrive. */
  assert.match(scheda, /root\.addEventListener\?\.\(EVENTO_PIATTAFORME, aggiornaGliEsiti\);/);
  assert.match(scheda, /data-mp-campo="telecomando"/);
});

test("il volume un passo alla volta, per chi non lo sa mettere a un numero", () => {
  assert.equal(comandoDelLettore("alza"), "volume_up");
  assert.equal(comandoDelLettore("abbassa"), "volume_down");
  assert.match(
    sezione,
    /const aPassi = riga\.puo\.passiVolume && !riga\.puo\.volume && !riga\.spento && !riga\.muto;/,
  );
  assert.match(
    sezione,
    /tastoMarkup\(riga, "alza", t\("Alza il volume", "Volume up"\), GLIFI\.alza\)/,
  );
});
