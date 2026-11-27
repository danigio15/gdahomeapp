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
  scriptDelRitocco,
  RITOCCO,
  DA_SALVARE,
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

/* Un pannello finto per la copia di sicurezza: due partizioni con la loro
 * misura e il loro md5, e uno scrittore che «copia» i byte che gli si dice. */
function pannelloDaCopiare({ md5Pannello = "a".repeat(32), byteCopiati = 1000 } = {}) {
  return {
    async shell(_i, c) {
      if (c.includes("by-name; do")) return "/dev/block/by-name\n";
      if (c.startsWith("ls ")) return "boot\nsystem\nuserdata\ncache\n";
      if (c.startsWith("blockdev")) return "1000";
      if (c.startsWith("md5sum")) return `${md5Pannello}  /dev/block/by-name/x`;
      return "";
    },
  };
}

test("la copia di sicurezza salva solo la partizione di sistema, compressa, e scrive MD5SUMS", async () => {
  const copie = mkdtempSync(join(tmpdir(), "copie-"));
  try {
    const scritte = [];
    const inst = new Installatore({
      adb: pannelloDaCopiare(),
      cartellaDelleCopie: copie,
      scriviCopia: async (_i, comando, dove) => {
        scritte.push([comando, dove.split("/").pop()]);
        return { byte: 1000, md5: "a".repeat(32) };
      },
    });
    const esito = await inst._copiaDiSicurezza("1.2.3.4", "Salone", () => {});
    assert.equal(esito.errore, undefined);
    assert.deepEqual(
      scritte.map(([, f]) => f),
      ["system.img.gz"],
    );
    /* Dopo i dati, 1 MB di zeri: se exec-out perde la fine, perde quelli. */
    assert.match(
      scritte[0][0],
      /^\{ dd if='\/dev\/block\/by-name\/system' bs=4194304; dd if=\/dev\/zero bs=1048576 count=1; \}/,
    );
    assert.match(readFileSync(join(esito.dir, "MD5SUMS"), "utf8"), /a{32} {2}system\.img/);
    assert.match(esito.dir, /Salone-\d{4}-\d{2}-\d{2}_\d{4}$/);
  } finally {
    rmSync(copie, { recursive: true, force: true });
  }
});

test("la copia si ferma se l'md5 non torna o se e' incompleta", async () => {
  const copie = mkdtempSync(join(tmpdir(), "copie-"));
  try {
    const diverso = new Installatore({
      adb: pannelloDaCopiare(),
      cartellaDelleCopie: copie,
      scriviCopia: async () => ({ byte: 1000, md5: "b".repeat(32) }),
    });
    assert.match((await diverso._copiaDiSicurezza("1.2.3.4", "x", () => {})).errore, /md5 diverso/);
    const corta = new Installatore({
      adb: pannelloDaCopiare(),
      cartellaDelleCopie: copie,
      scriviCopia: async () => ({ byte: 400, md5: "a".repeat(32) }),
    });
    assert.match((await corta._copiaDiSicurezza("1.2.3.4", "x", () => {})).errore, /incompleta/);
  } finally {
    rmSync(copie, { recursive: true, force: true });
  }
});

test("senza posto su Home Assistant la copia non comincia, e lo dice coi numeri", async () => {
  const copie = mkdtempSync(join(tmpdir(), "copie-"));
  try {
    let scritte = 0;
    const inst = new Installatore({
      adb: pannelloDaCopiare(),
      cartellaDelleCopie: copie,
      scriviCopia: async () => {
        scritte += 1;
        return { byte: 1000, md5: "a".repeat(32) };
      },
    });
    inst.spazioLibero = () => 1000;
    const esito = await inst._copiaDiSicurezza("1.2.3.4", "x", () => {});
    assert.match(esito.errore, /Non c'e' posto per la copia di sicurezza/);
    assert.equal(scritte, 0);
  } finally {
    rmSync(copie, { recursive: true, force: true });
  }
});

test("una copia troncata si riprova, e se non basta si scarica con adb pull", async () => {
  const copie = mkdtempSync(join(tmpdir(), "copie-"));
  try {
    /* Prima volta corta (come STSN sul 120), seconda buona. */
    let volte = 0;
    const riprova = new Installatore({
      adb: pannelloDaCopiare(),
      cartellaDelleCopie: copie,
      scriviCopia: async () => {
        volte += 1;
        return volte === 1
          ? { byte: 990, md5: "x".repeat(32) }
          : { byte: 1000, md5: "a".repeat(32) };
      },
    });
    assert.equal((await riprova._copiaDiSicurezza("1.2.3.4", "x", () => {})).errore, undefined);

    /* Sempre corta: piano B, la partizione in un file sul pannello e pull. */
    const contenuto = Buffer.alloc(1000, 7);
    const md5 = (await import("node:crypto")).createHash("md5").update(contenuto).digest("hex");
    const tirati = [];
    const adb = pannelloDaCopiare({ md5Pannello: md5 });
    const shellDiPrima = adb.shell;
    adb.shell = async (i, c) =>
      c.startsWith("df -k /data")
        ? "/dev/x 28000000 1000000 26000000 4% /data"
        : shellDiPrima(i, c);
    adb.pull = async (_i, remoto, locale) => {
      tirati.push(remoto);
      writeFileSync(locale, contenuto);
    };
    const pianoB = new Installatore({
      adb,
      cartellaDelleCopie: copie,
      scriviCopia: async () => ({ byte: 990, md5: "x".repeat(32) }),
    });
    const esito = await pianoB._copiaDiSicurezza("1.2.3.4", "y", () => {});
    assert.equal(esito.errore, undefined);
    assert.deepEqual(tirati, ["/data/local/tmp/gda-copia.img"]);
  } finally {
    rmSync(copie, { recursive: true, force: true });
  }
});

test("dopo il riavvio si aspetta il pannello e si guarda che GdAHome OS ci sia", async () => {
  const fatti = [];
  let giri = 0;
  const adb = (osCe) => ({
    async connetti() {
      giri += 1;
      return giri > 1;
    },
    async shell(_i, c) {
      fatti.push(c);
      if (c === "getprop sys.boot_completed") return "1";
      if (c === "pm path com.gdahome.os")
        return osCe ? "package:/system/app/GdAHomeOS/GdAHomeOS.apk" : "";
      return "";
    },
  });
  const buono = new Installatore({ adb: adb(true), cartellaDeiPezzi: tmpdir() });
  assert.deepEqual(await buono._dopoIlRiavvio("1.2.3.4", { attesa: 400, pausa: 10 }), {
    fatto: true,
  });
  assert.ok(fatti.includes("cmd package set-home-activity com.gdahome.os/.ui.AvvioActivity"));
  assert.ok(fatti.includes("appops set com.gdahome.os WRITE_SETTINGS allow"));
  giri = 0;
  const senza = new Installatore({ adb: adb(false), cartellaDeiPezzi: tmpdir() });
  assert.match(
    (await senza._dopoIlRiavvio("1.2.3.4", { attesa: 400, pausa: 10 })).errore,
    /GdAHome OS non risulta/,
  );
});

test("il foglietto arriva come file, e cartella e file sono dell'app", async () => {
  const fatti = [];
  const mandati = {};
  const adb = {
    async push(_i, locale, remoto) {
      mandati[remoto] = readFileSync(locale, "utf8");
    },
    async shell(_i, c) {
      fatti.push(c);
      if (c.startsWith("dumpsys package com.gdahome.muro")) return "    userId=10087";
      if (c.includes("abbinamento.json")) return "GDA_OK";
      return "";
    },
  };
  const inst = new Installatore({
    adb,
    cartellaDeiPezzi: tmpdir(),
    abbinaPannello: async () => ({
      dispositivo: "dm_1",
      segno: "s",
      chiave: "k",
      case: { centralino: "wss://c", casa: "h", indirizzi: ["192.168.1.174:8098"] },
    }),
  });
  const esito = await inst._abbina("1.2.3.4", { nome: "Salone", utente: "u", planciaId: "muro" });
  assert.equal(esito.errore, undefined);
  const foglietto = JSON.parse(mandati["/data/local/tmp/gda-abbinamento.json"]);
  assert.equal(foglietto.chiave, "k");
  assert.deepEqual(foglietto.case.indirizzi, ["192.168.1.174:8098"]);
  const intesta = fatti.find((c) => c.includes("chown"));
  assert.match(
    intesta,
    /chown 10087:10087 \/data\/data\/com\.gdahome\.muro\/files \/data\/data\/com\.gdahome\.muro\/files\/abbinamento\.json/,
  );
  assert.match(intesta, /restorecon -R \/data\/data\/com\.gdahome\.muro/);
});

test("la copia prova prima la diretta; se il pannello non si collega torna ad adb, e non la riprova", async () => {
  const copie = mkdtempSync(join(tmpdir(), "copie-"));
  try {
    const dirette = [];
    const viaAdb = [];
    const adb = pannelloDaCopiare();
    adb.ncSulPannello = async () => "/system/bin/nc";
    const inst = new Installatore({
      adb,
      cartellaDelleCopie: copie,
      indirizzoDiCasa: () => "192.168.1.174",
      copiaDiretta: async (_i, _c, dove, o) => {
        dirette.push([dove.split("/").pop(), o.verso, o.nc]);
        throw Object.assign(new Error("non si e' collegato"), { causa: "diretta" });
      },
      scriviCopia: async (_i, _c, dove) => {
        viaAdb.push(dove.split("/").pop());
        return { byte: 1000, md5: "a".repeat(32) };
      },
    });
    const esito = await inst._copiaDiSicurezza("1.2.3.4", "x", () => {});
    assert.equal(esito.errore, undefined);
    /* Provata una volta, sulla prima partizione; poi solo adb. */
    assert.deepEqual(dirette, [["system.img.gz", "192.168.1.174", "/system/bin/nc"]]);
    assert.deepEqual(viaAdb, ["system.img.gz"]);
  } finally {
    rmSync(copie, { recursive: true, force: true });
  }
});

test("l'animazione Sonoff di /oem si mette da parte, e il ripristino la rimette", () => {
  for (const s of [scriptDiSistema(), scriptDelRitocco()]) {
    /* /oem si apre in scrittura solo se si puo', e si richiude. */
    assert.match(s, /mount -o rw,remount \/oem/);
    assert.match(s, /mount -o ro,remount \/oem/);
    assert.match(s, /mv \/oem\/media\/bootanimation\.zip \$R\/oem-bootanimation\.zip\.orig/);
    /* Le app Sonoff in /oem si tolgono solo con /oem scrivibile. */
    assert.match(s, /\/oem\/\*\) \[ \$OEM = 1 \]/);
    assert.match(s, /echo GDA_OK$/);
  }
  /* Il ritocco non tocca GdAHome OS ne' il build.prop dell'ADB. */
  assert.doesNotMatch(scriptDelRitocco(), /GdAHome-OS\.apk|persist\.adb\.tcp\.port/);
  const r = scriptDelRipristino();
  assert.match(r, /mv \$R\/oem-bootanimation\.zip\.orig \/oem\/media\/bootanimation\.zip/);
  /* Rimette l'animazione PRIMA di cancellare la cartella delle cose tolte. */
  assert.ok(r.indexOf("oem-bootanimation") < r.indexOf("rm -rf $R"));
  /* La copia di sicurezza prende anche oem, che ora si modifica. */
  assert.ok(DA_SALVARE.test("oem") && DA_SALVARE.test("system_a") && !DA_SALVARE.test("userdata"));
});

/* Un pannello finto per il controllo dell'abbinamento: dice l'esito che gli
 * si da', e ricorda i comandi. */
function pannelloCheAbbina(esito = () => "") {
  const fatti = [];
  return {
    fatti,
    async shell(_i, c) {
      fatti.push(c);
      if (c.startsWith("cat /data/data/com.gdahome.muro/files/abbinamento.esito")) return esito();
      return "";
    },
  };
}

test("dopo il riavvio si guarda che il pannello sia entrato nella casa davvero", async () => {
  let visto = 0;
  const dispositivi = { elenco: () => [{ id: "dm_1", natoIl: 10, vistoIl: visto }] };
  const adb = pannelloCheAbbina(() => {
    visto = 99;
    return "OK dm_1\n";
  });
  const inst = new Installatore({ adb, cartellaDeiPezzi: tmpdir(), dispositivi });
  const esito = await inst._controllaLAbbinamento("1.2.3.4", {
    dispositivo: "dm_1",
    dal: 50,
    attesa: 500,
    pausa: 5,
  });
  assert.deepEqual(esito, { abbinato: true });
});

test("se GdAHome Muro scrive ERRORE, il perche' arriva alla console", async () => {
  const adb = pannelloCheAbbina(() => "ERRORE casa: keystore rotto\nGDA_FOGLIETTO\n");
  const inst = new Installatore({
    adb,
    cartellaDeiPezzi: tmpdir(),
    dispositivi: { elenco: () => [{ id: "dm_1", natoIl: 10, vistoIl: 10 }] },
  });
  const esito = await inst._controllaLAbbinamento("1.2.3.4", {
    dispositivo: "dm_1",
    dal: 50,
    attesa: 500,
    pausa: 5,
  });
  assert.equal(esito.abbinato, false);
  assert.match(esito.errore, /keystore rotto/);
});

test("se GdAHome Muro non legge il foglietto, lo si riapre; poi lo si dice", async () => {
  const adb = pannelloCheAbbina(() => "GDA_FOGLIETTO\n");
  const inst = new Installatore({
    adb,
    cartellaDeiPezzi: tmpdir(),
    dispositivi: { elenco: () => [{ id: "dm_1", natoIl: 10, vistoIl: 10 }] },
  });
  const esito = await inst._controllaLAbbinamento("1.2.3.4", {
    dispositivo: "dm_1",
    dal: 50,
    attesa: 90,
    pausa: 5,
  });
  assert.equal(esito.abbinato, false);
  assert.match(esito.errore, /non ha letto il foglietto/);
  assert.ok(adb.fatti.includes("am force-stop com.gdahome.muro"));
  assert.ok(adb.fatti.some((c) => c.startsWith("monkey -p com.gdahome.muro")));
});

test("riabbinare in un aggiornamento: stesso posto, nuovo foglietto, app riaperta", async () => {
  const dir = pezzi();
  try {
    const fatti = [];
    const chiesto = [];
    let visto = 10;
    const adb = {
      async connetti() {
        return true;
      },
      async stacca() {},
      async install() {},
      async push() {},
      async shell(_i, c) {
        fatti.push(c);
        if (c.startsWith("dumpsys package com.gdahome.muro | grep -m1 userId="))
          return "userId=10087";
        if (c.includes("[ -s /data/data/com.gdahome.muro/files/abbinamento.json ]"))
          return "GDA_OK";
        if (c.startsWith("sh /data/local/tmp/gda-ritocco.sh"))
          return "TOLTA animazione Sonoff (/oem)\nGDA_OK";
        if (c.startsWith("monkey")) visto = Date.now() + 1000;
        return "";
      },
    };
    const inst = new Installatore({
      adb,
      cartellaDeiPezzi: dir,
      dispositivi: { elenco: () => [{ id: "dm_1", natoIl: 10, vistoIl: visto }] },
      abbinaPannello: async (detto) => {
        chiesto.push(detto);
        return { dispositivo: "dm_1", segno: "s", chiave: "k", case: { indirizzi: ["h:8098"] } };
      },
      attesaDellAbbinamento: { attesa: 500, pausa: 5 },
    });
    const esito = await inst.aggiorna({
      indirizzo: "1.2.3.4",
      abbina: { dispositivo: "dm_1", nome: "Cucina", utente: "u", planciaId: "muro" },
    });
    assert.equal(esito.errore, undefined);
    assert.equal(esito.ritocco, RITOCCO);
    assert.deepEqual(esito.tolte, ["animazione Sonoff (/oem)"]);
    assert.equal(esito.abbinato, true);
    assert.equal(chiesto[0].sostituisce, "dm_1");
    /* L'esito vecchio si toglie prima di scrivere il foglietto nuovo. */
    assert.ok(
      fatti.some((c) => c.includes("rm -f /data/data/com.gdahome.muro/files/abbinamento.esito")),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("l'analisi chiede tutto, e una domanda che non risponde non ferma le altre", async () => {
  const chiesti = [];
  const adb = {
    async connetti() {
      return true;
    },
    async stacca() {},
    async shell(_i, c, opzioni) {
      chiesti.push([c, opzioni?.attesa]);
      if (c.startsWith("top ")) throw new Error("scaduto");
      if (c.startsWith("getprop ro.product.model")) return "NSPanel Pro\n8.1.0";
      return "";
    },
  };
  const inst = new Installatore({ adb, cartellaDeiPezzi: tmpdir() });
  const rapporto = await inst.analisi({ indirizzo: "1.2.3.4" });
  for (const titolo of [
    "Dispositivo",
    "Processore",
    "Memoria",
    "Temperatura",
    "Chi usa il processore",
    "Scheda video",
    "Disegno di GdAHome Muro",
    "Sensori",
    "Rete",
    "Abbinamento",
    "Animazione d'avvio",
    "Registro di GdAHome Muro",
  ])
    assert.match(rapporto, new RegExp(`== ${titolo} ==`));
  assert.match(rapporto, /NSPanel Pro/);
  assert.match(rapporto, /== Chi usa il processore ==\n\? scaduto/);
  assert.ok(chiesti.every(([, attesa]) => attesa === 20_000));
});

test("la velocita': processore e scheda video pronti, anche dopo il riavvio; il ripristino la toglie", () => {
  for (const s of [scriptDiSistema(), scriptDelRitocco()]) {
    /* I percorsi si cercano sul pannello. */
    assert.match(s, /scaling_available_frequencies/);
    assert.match(s, /\/sys\/class\/devfreq\/\*/);
    /* Scritto per init, che lo rilegge a ogni accensione. */
    assert.match(s, /RC=\/system\/etc\/init\/gdahome\.rc/);
    assert.match(s, /on property:sys\.boot_completed=1/);
    assert.match(s, /VELOCE cpu/);
    /* Prima di richiudere /system in sola lettura. */
    assert.ok(s.indexOf("gdahome.rc") < s.lastIndexOf("mount -o ro,remount /system"));
  }
  const r = scriptDelRipristino();
  assert.match(r, /\/system\/etc\/init\/gdahome\.rc/);
  assert.match(r, /webview-command-line/);
});
