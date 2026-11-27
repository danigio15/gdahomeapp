/* L'installatore di GdAHome OS: cosa manda al pannello e cosa ci lancia. Con
 * un adb finto e dei pezzi finti: nessun pannello vero. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Installatore,
  scriptDiSistema,
  scriptDelRipristino,
  DI_SONOFF,
} from "../src/installatore-pannelli.js";

function pezzi() {
  const dir = mkdtempSync(join(tmpdir(), "pezzi-"));
  for (const p of [
    "GdAHome-OS.apk",
    "GdAHome-Muro.apk",
    "gdaserial-arm64-v8a",
    "bootanimation-86.zip",
    "bootanimation-120.zip",
  ])
    writeFileSync(join(dir, p), p);
  return dir;
}

/* Un adb che ricorda tutto, e di uno script mandato col push si tiene il testo. */
function adbCheRicorda(esitoDelloScript = "TOLTA com.sonoff.launcher (Sonoff)\nGDA_OK") {
  const fatti = [];
  const mandati = {};
  return {
    fatti,
    mandati,
    async install(_ind, apk) {
      fatti.push(["install", apk.split("/").pop()]);
    },
    async push(_ind, locale, remoto) {
      fatti.push(["push", remoto]);
      if (remoto.endsWith(".sh")) mandati[remoto] = readFileSync(locale, "utf8");
    },
    async shell(_ind, comando) {
      fatti.push(["shell", comando]);
      return comando.startsWith("sh ") ? esitoDelloScript : "";
    },
    async connetti() {
      return true;
    },
    async stacca() {},
  };
}

test("lo script di sistema toglie il software Sonoff e le app superflue, e tiene il resto", () => {
  const s = scriptDiSistema();
  assert.ok(s.includes(DI_SONOFF), "riconosce le app Sonoff");
  assert.match(s, /SUPERFLUE='\^com\\\.android\\\.\(browser/);
  /* Quelle di base non si toccano mai: Impostazioni, WebView, GdAHome. */
  assert.match(s, /TENERE='\^\(android\|com\\\.android\\\.\(systemui\|settings/);
  assert.match(s, /com\\\.gdahome\\\.\.\*\)\$'/);
  /* Tutto quello che si toglie si mette da parte, per il ripristino. */
  assert.match(s, /manifest\.txt/);
  assert.match(s, /bootanimation\.zip\.orig/);
  assert.match(s, /build\.prop\.orig/);
  assert.match(s, /setprop persist\.adb\.tcp\.port 5555/);
  assert.match(s, /echo GDA_OK$/);
});

test("installare manda lo script come file, lo lancia, e conta le app tolte", async () => {
  const dir = pezzi();
  try {
    const adb = adbCheRicorda(
      "TOLTA com.sonoff.launcher (Sonoff)\nTOLTA com.coolkit.ewelink (Sonoff)\nGDA_OK",
    );
    const inst = new Installatore({ adb, cartellaDeiPezzi: dir });
    const esito = await inst._installaOs(
      "192.168.1.120",
      "86",
      "GdAHome-OS.apk",
      "GdAHome-Muro.apk",
    );
    assert.equal(esito.errore, undefined);
    assert.equal(esito.tolte, 2);
    /* Prima l'interfaccia, poi i pezzi di sistema, poi lo script. */
    assert.deepEqual(adb.fatti[0], ["install", "GdAHome-Muro.apk"]);
    assert.ok(adb.mandati["/data/local/tmp/gda-os.sh"].includes(DI_SONOFF));
    assert.ok(adb.fatti.some(([c, x]) => c === "shell" && x === "sh /data/local/tmp/gda-os.sh"));
    /* L'86 riceve la sua animazione, e GdAHome OS diventa la schermata home. */
    assert.ok(
      adb.fatti.some(([c, x]) => c === "push" && x === "/data/local/tmp/bootanimation.zip"),
    );
    assert.ok(adb.fatti.some(([, x]) => /set-home-activity com\.gdahome\.os/.test(x)));
    assert.ok(adb.fatti.some(([, x]) => x === "dumpsys deviceidle whitelist +com.gdahome.muro"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("se lo script dice GDA_ERR, l'errore porta il perche'", async () => {
  const dir = pezzi();
  try {
    const adb = adbCheRicorda("GDA_ERR /system non si puo' scrivere");
    const inst = new Installatore({ adb, cartellaDeiPezzi: dir });
    const esito = await inst._installaOs("1.2.3.4", "120", "GdAHome-OS.apk", "GdAHome-Muro.apk");
    assert.match(esito.errore, /\/system non si puo' scrivere/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rimettere Sonoff rimette anche le app che stavano in /data", async () => {
  const s = scriptDelRipristino();
  assert.match(s, /pm install -r \$D\/\$pkg\.apk/);
  assert.match(s, /mv \$R\/\$pkg\.removed "\$via"/);
  const adb = adbCheRicorda("RIMESSA com.sonoff.launcher\nGDA_OK");
  const inst = new Installatore({ adb, cartellaDeiPezzi: tmpdir() });
  const esito = await inst.sonoff({ indirizzo: "1.2.3.4", avanti: () => {} });
  assert.deepEqual(esito, { fatto: true });
  assert.ok(adb.mandati["/data/local/tmp/gda-ripristino.sh"].includes("RIMESSA"));
  assert.ok(adb.fatti.some(([, x]) => x === "pm uninstall com.gdahome.os"));
});

test("aggiornare: si installa solo quello che e' indietro, mai un numero piu' basso", () => {
  const inst = new Installatore({ adb: {}, cartellaDeiPezzi: tmpdir() });
  const pezzi = { os: { codice: 620, nome: "2.0.0" }, muro: { codice: 621, nome: "1.19.37" } };
  assert.deepEqual(inst.daAggiornare({ os: { codice: 616 }, muro: { codice: 621 } }, pezzi), [
    "os",
  ]);
  assert.deepEqual(inst.daAggiornare({ os: { codice: 700 }, muro: { codice: 700 } }, pezzi), []);
  /* Un pezzo che sul pannello manca si rimette. */
  assert.deepEqual(inst.daAggiornare({ os: { codice: 620 }, muro: null }, pezzi), ["muro"]);
  /* Senza versioni.json non si tocca niente. */
  assert.deepEqual(inst.daAggiornare({ os: null, muro: null }, null), []);
});

test("le versioni si leggono da versioni.json e da dumpsys del pannello", async () => {
  const dir = pezzi();
  try {
    writeFileSync(
      join(dir, "versioni.json"),
      JSON.stringify({
        "com.gdahome.os": { codice: 620, nome: "2.0.0" },
        "com.gdahome.muro": { codice: 621, nome: "1.19.37" },
      }),
    );
    const adb = {
      async shell(_i, c) {
        if (c.includes("com.gdahome.os"))
          return "    versionCode=616 minSdk=26 targetSdk=34\n    versionName=2.0.0";
        return "";
      },
    };
    const inst = new Installatore({ adb, cartellaDeiPezzi: dir });
    assert.deepEqual(inst.versioniDeiPezzi(), {
      os: { codice: 620, nome: "2.0.0" },
      muro: { codice: 621, nome: "1.19.37" },
    });
    assert.deepEqual(await inst.versioniSulPannello("1.2.3.4"), {
      os: { codice: 616, nome: "2.0.0" },
      muro: null,
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("aggiornare installa sopra solo i pezzi indietro", async () => {
  const dir = pezzi();
  try {
    writeFileSync(
      join(dir, "versioni.json"),
      JSON.stringify({
        "com.gdahome.os": { codice: 620, nome: "2.0.0" },
        "com.gdahome.muro": { codice: 621, nome: "1.19.37" },
      }),
    );
    const installati = [];
    let fatto = false;
    const adb = {
      async connetti() {
        return true;
      },
      async stacca() {},
      async install(_i, apk) {
        installati.push(apk.split("/").pop());
        fatto = true;
      },
      async shell(_i, c) {
        if (c.includes("com.gdahome.os")) return "versionCode=620\nversionName=2.0.0";
        if (c.includes("com.gdahome.muro"))
          return fatto
            ? "versionCode=621\nversionName=1.19.37"
            : "versionCode=500\nversionName=1.19.30";
        return "";
      },
    };
    const inst = new Installatore({ adb, cartellaDeiPezzi: dir });
    const esito = await inst.aggiorna({ indirizzo: "1.2.3.4" });
    assert.deepEqual(installati, ["GdAHome-Muro.apk"]);
    assert.deepEqual(esito.aggiornati, ["muro"]);
    assert.equal(esito.app, "1.19.37");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
