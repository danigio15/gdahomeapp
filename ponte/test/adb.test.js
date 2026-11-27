/* ADB, con un `spawn` finto: nessun vero adb, nessun pannello. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Adb, adbCE, scappa, ErroreAdb } from "../src/adb.js";

/* Un processo finto: risponde `fuori` su stdout, `errore` su stderr, esce con
 * `codice`, e ricorda cosa gli e' stato chiesto. */
function finto({ fuori = "", errore = "", codice = 0, maiFinire = false, erraAvvio = null } = {}) {
  const chiamate = [];
  const avvia = (programma, argomenti) => {
    chiamate.push({ programma, argomenti });
    if (erraAvvio) {
      const p = new EventEmitter();
      p.stdin = { end() {}, on() {} };
      queueMicrotask(() => p.emit("error", erraAvvio));
      return p;
    }
    const p = new EventEmitter();
    p.stdout = new EventEmitter();
    p.stderr = new EventEmitter();
    p.stdin = { end() {}, on() {} };
    p.kill = () => {};
    if (!maiFinire)
      queueMicrotask(() => {
        if (fuori) p.stdout.emit("data", Buffer.from(fuori));
        if (errore) p.stderr.emit("data", Buffer.from(errore));
        p.emit("close", codice);
      });
    return p;
  };
  return { avvia, chiamate };
}

test("scappa mette fra apici e non lascia scappare un apice", () => {
  assert.equal(scappa("ciao"), "'ciao'");
  assert.equal(scappa("l'ora"), "'l'\\''ora'");
  /* Un «a'; rm -rf /» resta un pezzo solo, chiuso fra apici: il «; rm» c'e'
   * ma e' dentro gli apici, non diventa un secondo comando. */
  assert.equal(scappa("a'; rm -rf /"), "'a'\\''; rm -rf /'");
});

test("connetti torna true quando adb dice connected", async () => {
  const { avvia } = finto({ fuori: "connected to 192.168.1.5:5555" });
  const adb = new Adb({ avvia, chiave: null });
  assert.equal(await adb.connetti("192.168.1.5"), true);
});

test("connetti torna false, non lancia, quando il pannello non risponde", async () => {
  const { avvia } = finto({
    fuori: "",
    errore: "failed to connect to '192.168.1.9:5555'",
    codice: 1,
  });
  const adb = new Adb({ avvia, chiave: null });
  assert.equal(await adb.connetti("192.168.1.9"), false);
});

test("shell root avvolge in su -c con l'apice giusto", async () => {
  const { avvia, chiamate } = finto({ fuori: "0" });
  const adb = new Adb({ avvia, chiave: null });
  const detto = await adb.shell("1.2.3.4", "id -u", { root: true });
  assert.equal(detto, "0");
  const ultima = chiamate.at(-1).argomenti.join(" ");
  assert.match(ultima, /exec-out su -c 'id -u'/);
  assert.match(ultima, /-s 1\.2\.3\.4:5555/);
});

test("comando lancia ErroreAdb quando adb esce male", async () => {
  const { avvia } = finto({ errore: "device offline", codice: 1 });
  const adb = new Adb({ avvia, chiave: null });
  await assert.rejects(
    () => adb.comando(["-s", "x", "shell", "echo"]),
    (e) => {
      assert.ok(e instanceof ErroreAdb);
      assert.equal(e.causa, "offline");
      return true;
    },
  );
});

test("adb che non c'e' diventa causa niente_adb, e adbCE torna false", async () => {
  const { avvia } = finto({
    erraAvvio: Object.assign(new Error("spawn adb ENOENT"), { code: "ENOENT" }),
  });
  const adb = new Adb({ avvia, chiave: null });
  assert.equal(await adbCE(adb), false);
});

test("un comando che non finisce scade e lancia, non resta appeso", async () => {
  const { avvia } = finto({ maiFinire: true });
  const adb = new Adb({ avvia, chiave: null });
  await assert.rejects(
    () => adb.comando(["version"], { attesa: 30 }),
    (e) => {
      assert.equal(e.causa, "tempo");
      return true;
    },
  );
});

test("root torna la stringa di id -u, o vuoto se non va", async () => {
  const si = new Adb({ avvia: finto({ fuori: "0\n" }).avvia, chiave: null });
  assert.equal(await si.root("1.2.3.4"), "0");
  const no = new Adb({ avvia: finto({ errore: "no su", codice: 1 }).avvia, chiave: null });
  assert.equal(await no.root("1.2.3.4"), "");
});

test("provaCollegamento distingue rifiutato da irraggiungibile", async () => {
  const rifiuta = new Adb({
    avvia: finto({ errore: "failed to connect to '1.2.3.4:5555': Connection refused", codice: 1 })
      .avvia,
    chiave: null,
  });
  assert.deepEqual(await rifiuta.provaCollegamento("1.2.3.4"), { ok: false, causa: "rifiutato" });
  const muto = new Adb({
    avvia: finto({ errore: "failed to connect to '1.2.3.4:5555': Operation timed out", codice: 1 })
      .avvia,
    chiave: null,
  });
  assert.deepEqual(await muto.provaCollegamento("1.2.3.4"), {
    ok: false,
    causa: "irraggiungibile",
  });
  const ok = new Adb({ avvia: finto({ fuori: "connected to 1.2.3.4:5555" }).avvia, chiave: null });
  assert.deepEqual(await ok.provaCollegamento("1.2.3.4"), { ok: true, causa: "" });
});
