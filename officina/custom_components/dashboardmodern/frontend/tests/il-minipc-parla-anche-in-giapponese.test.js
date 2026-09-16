/* La tessera del MiniPC sceglie le misure, non le parole.
 *
 * La didascalia della tessera mostra RAM e disco accanto alla CPU, e per
 * sapere quali righe fossero le tre quote leggeva l'etichetta: `CPU`, `RAM`,
 * `Disco`, `Disk`. Ma l'etichetta e' testo tradotto — in giapponese la RAM si
 * chiama メモリ e il disco ディスク, in arabo الذاكرة e القرص — e li' nessuna
 * riga superava quel confronto: la tessera aveva le letture in mano e non
 * scriveva niente sotto il numero. Segnalato in revisione sulla PR #251.
 *
 * Adesso ogni riga si porta dietro il nome della misura — `cpu`, `ram`,
 * `disco` — che non cambia con la lingua, e la didascalia sceglie da li'.
 * Queste prove guardano la tessera in tre lingue: l'italiano in cui e'
 * scritta, e due che non condividono nemmeno l'alfabeto.
 */
import assert from "node:assert/strict";
import test from "node:test";

/* Il minimo perche' la tessera possa lavorare fuori da un browser: dove
 * tenere le preferenze dei widget, e come si risolve un riferimento mappato
 * nell'entita' vera. */
globalThis.localStorage = {
  valori: new Map(),
  getItem(chiave) {
    return this.valori.has(chiave) ? this.valori.get(chiave) : null;
  },
  setItem(chiave, valore) {
    this.valori.set(chiave, String(valore));
  },
  removeItem(chiave) {
    this.valori.delete(chiave);
  },
};

const MAPPATURA = {
  "dm.server_cpu": "sensor.minipc_cpu",
  "dm.server_ram": "sensor.minipc_ram",
  "dm.server_disco": "sensor.minipc_disco",
};
globalThis.resolveEntity = (riferimento) => MAPPATURA[riferimento] || riferimento;

const STATI = {
  "sensor.minipc_cpu": { state: "42" },
  "sensor.minipc_ram": { state: "61" },
  "sensor.minipc_disco": { state: "77" },
};

const { setLocale, resetLocale } = await import("../src/core/i18n.js");
const { minipcModel } = await import("../src/sections/home-widgets-section.js");

test("in italiano la didascalia porta le altre due quote", () => {
  resetLocale();
  const tessera = minipcModel(STATI);
  assert.equal(tessera.value, "42%");
  assert.equal(tessera.caption, "RAM 61% · Disco 77%");
});

test("in giapponese e in arabo la didascalia c'e' lo stesso", async () => {
  for (const lingua of ["ja", "ar"]) {
    await setLocale(lingua, { persist: false, apply: false });
    const tessera = minipcModel(STATI);

    // La CPU resta il numero in grande, in ogni lingua.
    assert.equal(tessera.value, "42%", `${lingua}: la CPU in grande`);

    // E sotto ci sono due quote, non zero: e' esattamente quello che si
    // perdeva quando la scelta passava dalle etichette.
    const pezzi = tessera.caption.split(" · ");
    assert.equal(pezzi.length, 2, `${lingua}: due quote in didascalia, non «${tessera.caption}»`);
    assert.ok(pezzi[0].endsWith(" 61%"), `${lingua}: la RAM con il suo valore`);
    assert.ok(pezzi[1].endsWith(" 77%"), `${lingua}: il disco con il suo valore`);

    // Le parole sono tradotte davvero: se restassero in inglese questa prova
    // passerebbe anche col difetto, e non proverebbe niente.
    assert.doesNotMatch(tessera.caption, /RAM|Disco|Disk/, `${lingua}: etichette tradotte`);
  }
  resetLocale();
});

test("le righe portano il nome della misura, che non si traduce", async () => {
  await setLocale("ja", { persist: false, apply: false });
  const chiavi = minipcModel(STATI).rows.map((riga) => riga.chiave);
  assert.deepEqual(chiavi, ["cpu", "ram", "disco"]);
  resetLocale();
});

/* La misura si scrive nell'unità che dichiara il sensore.
 *
 * «Nella scheda mini pc mi dà la ram al 5,8gb e invece nella home dei widget mi
 * dà 5928%» (marco95a, sulla #553).
 *
 * Le caselle della tessera si portano dietro l'unità che si ASPETTANO — «%» per
 * la RAM — e la scrivevano addosso al numero senza guardare cosa fosse quel
 * numero. Chi la RAM la misura in megabyte si vedeva una percentuale di niente,
 * mentre la sua sezione — che l'unità la legge — diceva la cosa giusta: lo
 * stesso sensore raccontato in due modi a mezzo schermo di distanza.
 */
test("la RAM in megabyte non diventa una percentuale (#553)", () => {
  resetLocale();
  const tessera = minipcModel({
    "sensor.minipc_cpu": { state: "42", attributes: { unit_of_measurement: "%" } },
    "sensor.minipc_ram": { state: "5928", attributes: { unit_of_measurement: "MB" } },
    "sensor.minipc_disco": { state: "77" },
  });
  assert.equal(tessera.caption, "RAM 5928 MB · Disco 77%");
  /* Il numero grande e la ghiera restano quelli della CPU, che una percentuale
   * lo è davvero. */
  assert.equal(tessera.value, "42%");
  assert.equal(tessera.ring, 42);
});

test("un'unità diversa si porta dietro il suo decimo", () => {
  /* Le cifre della casella sono tarate sull'unità della casella: «61%» si
   * scrive intero perché mezzo punto percentuale non cambia niente a nessuno.
   * Su 5,8 GB quel mezzo punto è mezzo giga, e arrotondarlo a «6 GB» sarebbe
   * scrivere un numero che il sensore non ha mai detto. */
  resetLocale();
  const tessera = minipcModel({
    "sensor.minipc_cpu": { state: "42" },
    "sensor.minipc_ram": { state: "5.8", attributes: { unit_of_measurement: "GB" } },
    "sensor.minipc_disco": { state: "77" },
  });
  assert.equal(tessera.caption, "RAM 5,8 GB · Disco 77%");
});

test("una CPU che non è una percentuale non riempie la ghiera", () => {
  /* Una ghiera piena al 5928% non vuol dire niente, e il numero grande della
   * tessera nemmeno. Quando la lettura non è un tanto per cento, il posto
   * grande lo prende la prima misura che c'è, scritta per quello che è. */
  resetLocale();
  const tessera = minipcModel({
    "sensor.minipc_cpu": { state: "2400", attributes: { unit_of_measurement: "MHz" } },
    "sensor.minipc_ram": { state: "61" },
    "sensor.minipc_disco": { state: "77" },
  });
  assert.equal(tessera.ring, null);
  assert.equal(tessera.value, "2400 MHz");
});

test("chi non dichiara l'unità resta esattamente com'era", () => {
  /* La regola che rende sicura questa correzione per tutte le case a cui la
   * tessera andava già bene: una percentuale senza `unit_of_measurement` è il
   * caso normale, ed è quello che queste caselle hanno sempre significato. */
  resetLocale();
  const tessera = minipcModel(STATI);
  assert.equal(tessera.value, "42%");
  assert.equal(tessera.caption, "RAM 61% · Disco 77%");
});
