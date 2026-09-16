/* La provenienza: una plancia toccata lo dice.
 *
 * Sono le prove che contano quando quello che si difende e' la paternita' di
 * un lavoro: una copia intatta deve dire «intatta», una con un byte cambiato
 * deve dirlo e dire **quale**, e una firmata da un'altra chiave non deve
 * passare per firmata.
 */

import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";

import { STATO, firmaBuona, guardaLaPlancia, improntaDi, sigilloDi } from "../src/provenienza.js";

const LA_PLANCIA = join(dirname(dirname(fileURLToPath(import.meta.url))), "plancia");

const daButtare = [];
after(() => daButtare.forEach((dove) => rmSync(dove, { recursive: true, force: true })));

/* Una plancia finta: due file veri, con le loro impronte e il loro sigillo. */
function unaPlancia({ firma = "", rompi = null, sigilloStorto = false } = {}) {
  const dove = mkdtempSync(join(tmpdir(), "plancia-"));
  daButtare.push(dove);
  mkdirSync(join(dove, "legacy"), { recursive: true });
  mkdirSync(join(dove, "src"), { recursive: true });
  const file = {
    "legacy/dashboard.html": "<html>la plancia</html>",
    "legacy/dashboard-runtime-it.js": "var DASHBOARD_VERSION = '0.14.0';",
    "src/moduli.js": "export const uno = 1;",
  };
  const impronte = {};
  for (const [nome, dentro] of Object.entries(file)) {
    writeFileSync(join(dove, nome), dentro);
    impronte[nome] = improntaDi(Buffer.from(dentro));
  }
  const sigillo = sigilloDi(impronte);
  writeFileSync(
    join(dove, "ORIGINE.json"),
    JSON.stringify({
      repository: "danigio15/gdahomeapp",
      commit: "0".repeat(40),
      versione: "1.4.11",
      portata_il: new Date().toISOString(),
      file: Object.keys(file).length,
      byte: 100,
      sigillo: sigilloStorto ? "f".repeat(64) : sigillo,
      firma,
      impronte,
    }),
  );
  if (rompi) writeFileSync(join(dove, rompi), "qualcun altro e' passato di qui");
  return { dove, sigillo };
}

describe("la provenienza della plancia", () => {
  it("una copia intatta senza chiave: i file tornano, e lo dice", () => {
    const { dove } = unaPlancia();
    const detto = guardaLaPlancia(dove, { chiave: "" });
    assert.equal(detto.stato, STATO.nonFirmata);
    assert.equal(detto.quanti, 0);
    assert.equal(detto.versione, "1.4.11");
  });

  it("un file cambiato si vede, e si sa quale", () => {
    const { dove } = unaPlancia({ rompi: "src/moduli.js" });
    const detto = guardaLaPlancia(dove, { chiave: "" });
    assert.equal(detto.stato, STATO.modificata);
    assert.equal(detto.cambiati, 1);
    assert.deepEqual(detto.quali, ["src/moduli.js"]);
  });

  it("un file aggiunto si vede: non basta non toccare quelli che ci sono", () => {
    const { dove } = unaPlancia();
    writeFileSync(join(dove, "src", "mio.js"), "// il mio");
    const detto = guardaLaPlancia(dove, { chiave: "" });
    assert.equal(detto.stato, STATO.modificata);
    assert.equal(detto.aggiunti, 1);
  });

  it("un file sparito si vede", () => {
    const { dove } = unaPlancia();
    rmSync(join(dove, "src", "moduli.js"));
    const detto = guardaLaPlancia(dove, { chiave: "" });
    assert.equal(detto.stato, STATO.modificata);
    assert.equal(detto.mancanti, 1);
  });

  it("un sigillo che non torna con le sue impronte non passa", () => {
    /* E' il caso di chi cambia un'impronta a mano per far tornare i conti:
     * la lista e il sigillo si contraddicono, e si vede. */
    const { dove } = unaPlancia({ sigilloStorto: true });
    const detto = guardaLaPlancia(dove, { chiave: "" });
    assert.equal(detto.stato, STATO.modificata);
    assert.match(detto.perche, /sigillo/);
  });

  it("senza ORIGINE.json non si finge niente", () => {
    const dove = mkdtempSync(join(tmpdir(), "plancia-"));
    daButtare.push(dove);
    const detto = guardaLaPlancia(dove, { chiave: "" });
    assert.equal(detto.stato, STATO.senzaOrigine);
  });

  it("con la firma giusta e' originale", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const prima = unaPlancia();
    const firma = sign(null, Buffer.from(prima.sigillo, "utf8"), privateKey).toString("base64");
    const { dove } = unaPlancia({ firma });
    const detto = guardaLaPlancia(dove, {
      chiave: publicKey.export({ type: "spki", format: "pem" }).toString(),
    });
    assert.equal(detto.stato, STATO.originale);
    assert.equal(detto.firmata, true);
  });

  it("la firma di un'altra chiave non passa per buona", () => {
    /* E' il punto di tutto: chi rifa' le impronte e il sigillo non puo' rifare
     * la firma, e la sua copia resta riconoscibile. */
    const nostra = generateKeyPairSync("ed25519");
    const sua = generateKeyPairSync("ed25519");
    const prima = unaPlancia();
    const firma = sign(null, Buffer.from(prima.sigillo, "utf8"), sua.privateKey).toString("base64");
    const { dove } = unaPlancia({ firma });
    const detto = guardaLaPlancia(dove, {
      chiave: nostra.publicKey.export({ type: "spki", format: "pem" }).toString(),
    });
    assert.equal(detto.stato, STATO.nonFirmata);
    assert.equal(detto.firmata, false);
  });

  it("una firma su una plancia poi modificata non la salva", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const prima = unaPlancia();
    const firma = sign(null, Buffer.from(prima.sigillo, "utf8"), privateKey).toString("base64");
    const { dove } = unaPlancia({ firma, rompi: "legacy/dashboard.html" });
    const detto = guardaLaPlancia(dove, {
      chiave: publicKey.export({ type: "spki", format: "pem" }).toString(),
    });
    assert.equal(detto.stato, STATO.modificata);
  });

  it("una firma storta non fa cadere niente", () => {
    assert.equal(firmaBuona("abc", "non-e-base64-vera!!", "nemmeno-una-chiave"), false);
    assert.equal(firmaBuona("abc", "", ""), false);
  });

  /* E quella vera, che sta in questa repository.
   *
   * E' la prova che serve da quando la plancia e' **nostra**. Prima arrivava
   * sigillata da fuori e nessuno la toccava: il sigillo non poteva sfasarsi.
   * Adesso i suoi difetti si correggono qui, e chi corregge un file e si
   * dimentica di risigillare (`strumenti/sigilla-la-plancia.mjs`) manda a
   * tutte le case una plancia che il loro ponte dichiara «modificata» — un
   * allarme che suona quando non e' successo niente, e che si impara a non
   * sentire proprio in tempo per il giorno che suona per davvero.
   *
   * Qui si guarda solo che le impronte tornino: se sia **firmata** o no
   * dipende da una chiave privata che in una prova non c'e', e non e' quello
   * che questa prova difende. */
  it("la plancia di questa repository torna col suo sigillo", (t) => {
    if (!existsSync(join(LA_PLANCIA, "ORIGINE.json"))) {
      return t.skip("qui la plancia non c'e'");
    }
    const detto = guardaLaPlancia(LA_PLANCIA, { chiave: "" });
    assert.notEqual(
      detto.stato,
      STATO.senzaOrigine,
      "la plancia non dice da dove viene: manca ORIGINE.json, o e' illeggibile",
    );
    assert.notEqual(
      detto.stato,
      STATO.modificata,
      `${detto.perche || "le impronte non tornano"} — ` +
        "rifai il sigillo con «node strumenti/sigilla-la-plancia.mjs»",
    );
  });
});
