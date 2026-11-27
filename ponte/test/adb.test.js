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

/* Un adb finto che risponde secondo il comando: serve ai casi in cui il
 * «connect» e il «get-state» dicono cose diverse. `risposte` mappa un pezzo
 * degli argomenti ("connect", "get-state", …) in { fuori, errore, codice }. */
function fintoPerComando(risposte) {
  const avvia = (_programma, argomenti) => {
    const chiave = Object.keys(risposte).find((k) => argomenti.includes(k)) ?? "*";
    const { fuori = "", errore = "", codice = 0 } = risposte[chiave] ?? {};
    const p = new EventEmitter();
    p.stdout = new EventEmitter();
    p.stderr = new EventEmitter();
    p.stdin = { end() {}, on() {} };
    p.kill = () => {};
    queueMicrotask(() => {
      if (fuori) p.stdout.emit("data", Buffer.from(fuori));
      if (errore) p.stderr.emit("data", Buffer.from(errore));
      p.emit("close", codice);
    });
    return p;
  };
  return avvia;
}

test("il server di adb che non parte non diventa «non risponde»: lancia «demone»", async () => {
  /* E' il guasto vero visto dal campo: senza la cartella della chiave il
   * server si fermava, e la ricerca diceva «nessun dispositivo» su 254. */
  const adb = new Adb({
    avvia: finto({
      errore:
        "* daemon not running; starting now at tcp:5037\nADB server didn't ACK\nCannot mkdir '/data/adb/.android': No such file or directory\n* failed to start daemon\nerror: cannot connect to daemon",
      codice: 1,
    }).avvia,
    chiave: null,
  });
  await assert.rejects(
    () => adb.provaCollegamento("192.168.1.120"),
    (e) => {
      assert.equal(e.causa, "demone");
      return true;
    },
  );
  await assert.rejects(
    () => adb.avviaServer(),
    (e) => e.causa === "demone",
  );
});

test("la cartella della chiave si crea prima di lanciare adb", async () => {
  const { mkdtempSync, existsSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const base = mkdtempSync(join(tmpdir(), "chiave-"));
  const chiave = join(base, "adb");
  try {
    const adb = new Adb({ avvia: finto({ fuori: "Android Debug Bridge" }).avvia, chiave });
    await adb.comando(["version"]);
    assert.equal(existsSync(join(chiave, ".android")), true);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("«failed to authenticate» e' un pannello che aspetta il Consenti", async () => {
  const adb = new Adb({
    avvia: fintoPerComando({ connect: { fuori: "failed to authenticate to 192.168.1.120:5555" } }),
    chiave: null,
  });
  assert.deepEqual(await adb.provaCollegamento("192.168.1.120"), {
    ok: false,
    causa: "non_autorizzato",
  });
});

test("collegato ma «unauthorized» non e' pronto: aspetta il Consenti", async () => {
  const adb = new Adb({
    avvia: fintoPerComando({
      connect: { fuori: "connected to 192.168.1.120:5555" },
      "get-state": { errore: "error: device unauthorized.", codice: 1 },
    }),
    chiave: null,
  });
  assert.deepEqual(await adb.provaCollegamento("192.168.1.120"), {
    ok: false,
    causa: "non_autorizzato",
  });
});

test("porta aperta ma muta: adb dice «failed to connect» e lo tiene «offline» — non e' «non risponde»", async () => {
  /* Visto con un adb vero: una 5555 aperta che non ha ancora risposto come si
   * deve da' «failed to connect to …» senza «refused», e resta nell'elenco
   * come «offline». Un indirizzo che non risponde, invece, non c'e'. */
  const aperta = new Adb({
    avvia: fintoPerComando({
      connect: { fuori: "failed to connect to 192.168.1.120:5555" },
      "get-state": { errore: "error: device offline", codice: 1 },
    }),
    chiave: null,
  });
  assert.deepEqual(await aperta.provaCollegamento("192.168.1.120"), {
    ok: false,
    causa: "non_autorizzato",
  });
  const vuota = new Adb({
    avvia: fintoPerComando({
      connect: { fuori: "failed to connect to 192.168.1.200:5555" },
      "get-state": { errore: "error: device '192.168.1.200:5555' not found", codice: 1 },
    }),
    chiave: null,
  });
  assert.deepEqual(await vuota.provaCollegamento("192.168.1.200"), {
    ok: false,
    causa: "irraggiungibile",
  });
});

test("copiaInFile scrive l'uscita man mano, e ne torna byte e md5", async () => {
  const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createHash } = await import("node:crypto");
  const dir = mkdtempSync(join(tmpdir(), "copia-"));
  try {
    const pezzi = [Buffer.alloc(70_000, 1), Buffer.alloc(30_000, 2)];
    const avvia = () => {
      const p = new EventEmitter();
      p.stdout = new EventEmitter();
      p.stdout.pause = () => {};
      p.stdout.resume = () => {};
      p.stderr = new EventEmitter();
      p.kill = () => {};
      queueMicrotask(() => {
        for (const x of pezzi) p.stdout.emit("data", x);
        p.emit("close", 0);
      });
      return p;
    };
    const adb = new Adb({ avvia, chiave: null });
    const dove = join(dir, "system.img");
    const esito = await adb.copiaInFile("1.2.3.4", "dd if=/dev/block/by-name/system", dove);
    const tutto = Buffer.concat(pezzi);
    assert.equal(esito.byte, tutto.length);
    assert.equal(esito.md5, createHash("md5").update(tutto).digest("hex"));
    assert.deepEqual(readFileSync(dove), tutto);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("copiaInFile con un limite tiene solo i primi byte, e la coda la conta e basta", async () => {
  const { mkdtempSync, readFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "copia-"));
  try {
    const dati = Buffer.alloc(5000, 9);
    const coda = Buffer.alloc(3000, 0);
    const avvia = () => {
      const p = new EventEmitter();
      p.stdout = new EventEmitter();
      p.stdout.pause = () => {};
      p.stdout.resume = () => {};
      p.stderr = new EventEmitter();
      p.kill = () => {};
      queueMicrotask(() => {
        p.stdout.emit("data", Buffer.concat([dati.subarray(0, 4000)]));
        p.stdout.emit("data", Buffer.concat([dati.subarray(4000), coda]));
        p.emit("close", 0);
      });
      return p;
    };
    const adb = new Adb({ avvia, chiave: null });
    const dove = join(dir, "p.img");
    const esito = await adb.copiaInFile("1.2.3.4", "x", dove, { limite: 5000 });
    assert.equal(esito.byte, 5000);
    assert.equal(esito.ricevuti, 8000);
    assert.deepEqual(readFileSync(dove), dati);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("una copia che si ferma la chiude il guardiano, e l'avanzamento si sente", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "copia-"));
  try {
    let ucciso = false;
    const avvia = () => {
      const p = new EventEmitter();
      p.stdout = new EventEmitter();
      p.stdout.pause = () => {};
      p.stdout.resume = () => {};
      p.stderr = new EventEmitter();
      p.kill = () => {
        ucciso = true;
      };
      /* Un pezzo, poi piu' niente: il pannello si e' fermato. */
      queueMicrotask(() => p.stdout.emit("data", Buffer.alloc(1000, 1)));
      return p;
    };
    const visti = [];
    const adb = new Adb({ avvia, chiave: null, fermoDellaCopia: 150 });
    await assert.rejects(
      () =>
        adb.copiaInFile("1.2.3.4", "dd", join(dir, "x.img"), {
          avanzamento: (b) => visti.push(b),
        }),
      (e) => e.causa === "fermo",
    );
    assert.equal(ucciso, true);
    assert.deepEqual(visti, [1000]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
