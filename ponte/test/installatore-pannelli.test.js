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
      if (comando.startsWith("pm install")) return "Success";
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
    assert.deepEqual(adb.fatti[0], ["push", "/data/local/tmp/gda-GdAHome-Muro.apk"]);
    assert.ok(
      adb.fatti.some(
        ([c, x]) => c === "shell" && /^pm install -r -g .*gda-GdAHome-Muro\.apk/.test(x),
      ),
    );
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
    const detti = [];
    let fatto = false;
    const adb = {
      async connetti() {
        return true;
      },
      async stacca() {},
      async push(_i, locale, remoto) {
        if (remoto.endsWith(".apk")) installati.push(locale.split("/").pop());
      },
      async shell(_i, c) {
        if (c.startsWith("pm install -r ")) {
          fatto = true;
          return "Success";
        }
        if (c.startsWith("stat -c %s")) return "1";
        if (c.includes("com.gdahome.os")) return "versionCode=620\nversionName=2.0.0";
        if (c.includes("com.gdahome.muro"))
          return fatto
            ? "versionCode=621\nversionName=1.19.37"
            : "versionCode=500\nversionName=1.19.30";
        return "";
      },
    };
    const inst = new Installatore({ adb, cartellaDeiPezzi: dir, passoDellaBarra: 1 });
    const esito = await inst.aggiorna({
      indirizzo: "1.2.3.4",
      avanti: ({ passo, dettaglio, percento }) => detti.push([passo, dettaglio, percento]),
    });
    assert.deepEqual(installati, ["GdAHome-Muro.apk"]);
    /* Ogni passo con la sua barra, fino al cento. */
    assert.ok(
      detti.some(([p, d, pc]) => p === 0 && /Fatto: l'app GdAHome Muro/.test(d) && pc === 100),
    );
    assert.ok(detti.some(([p, d]) => p === 1 && /ultima versione/.test(d)));
    assert.ok(detti.some(([p, , pc]) => p === 2 && pc === 100));
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
      if (c.startsWith("dumpsys cpuinfo")) throw new Error("scaduto");
      if (c.startsWith("getprop ro.product.model")) return "NSPanel Pro\n8.1.0";
      return "";
    },
  };
  const inst = new Installatore({
    adb,
    cartellaDeiPezzi: tmpdir(),
    indirizzoDiCasa: () => "192.168.1.174",
  });
  const rapporto = await inst.analisi({ indirizzo: "1.2.3.4" });
  /* Il tempo verso Home Assistant, per separare la rete dal pannello. */
  assert.match(rapporto, /== Rete verso Home Assistant ==/);
  assert.ok(chiesti.some(([c]) => c.startsWith("ping -c 5 -i 0.3 -W 1 192.168.1.174")));
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

test("un pezzo che non si installa dice perche'", async () => {
  const dir = pezzi();
  try {
    const adb = {
      async push() {},
      async shell(_i, c) {
        if (c.startsWith("pm install"))
          return "Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE: firma diversa]";
        return "";
      },
    };
    const inst = new Installatore({ adb, cartellaDeiPezzi: dir, passoDellaBarra: 1 });
    await assert.rejects(
      () => inst._installaConLaBarra("1.2.3.4", "GdAHome-OS.apk", { nome: "GdAHome OS" }),
      /GdAHome OS non si installa \(INSTALL_FAILED_UPDATE_INCOMPATIBLE/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("che pannello e': NSPanel dallo schermo, Shelly dal nome, il resto e' un display Android", async () => {
  const { famigliaDelPannello, percorsoDelPannello, nomeDelModello } =
    await import("../src/installatore-pannelli.js");
  /* L'NSPanel dal suo software, non dallo schermo. */
  assert.equal(
    famigliaDelPannello({ modello: "px30_evb", pacchetti: "package:com.eWeLinkNSPro.dev" }),
    "nspanel",
  );
  assert.equal(famigliaDelPannello({ modello: "px30_evb", gdahomeOs: "2" }), "nspanel");
  /* Un display cinese sulla stessa scheda, senza Sonoff: non e' un NSPanel. */
  assert.equal(famigliaDelPannello({ modello: "px30_evb" }), "android");
  assert.equal(famigliaDelPannello({ produttore: "Shelly", modello: "SAWD-0A1XX10EU1" }), "shelly");
  assert.equal(famigliaDelPannello({ marca: "rockchip", modello: "rk3566" }), "android");

  /* La strada la decide il pannello: root e sistema scrivibile. */
  assert.equal(percorsoDelPannello({ root: true, scrivibile: true }), "completo");
  assert.equal(percorsoDelPannello({ root: true, scrivibile: false }), "leggero");
  assert.equal(percorsoDelPannello({ root: false, scrivibile: false }), "leggero");
  assert.equal(nomeDelModello({ marca: "lenovo", modello: "TB-X606F" }), "Lenovo TB-X606F");
  assert.equal(nomeDelModello({ marca: "Samsung", modello: "Samsung SM-T500" }), "Samsung SM-T500");
});

/* Un display Android finto, senza root: ricorda i comandi, risponde come
 * risponderebbe Android. */
function displayAndroid({ broadcast = "Broadcast completed: result=-1" } = {}) {
  const fatti = [];
  const prop = {
    "ro.product.manufacturer": "Shelly",
    "ro.product.brand": "Shelly",
    "ro.product.model": "SAWD-0A1XX10EU1",
    "ro.build.version.release": "8.1.0",
  };
  return {
    fatti,
    async connetti() {
      return true;
    },
    async stacca() {},
    async push() {},
    tirati: [],
    async pull(_i, remoto, locale) {
      this.tirati.push(remoto);
      writeFileSync(locale, "apk");
    },
    async getprop(_i, nome) {
      return prop[nome] ?? "";
    },
    async shell(_i, c, opzioni = {}) {
      fatti.push([c, opzioni.root === true]);
      if (c === "wm size") return "Physical size: 480x480";
      if (c.startsWith("cmd package resolve-activity"))
        return "priority=0 preferredOrder=0\ncom.shelly.launcher/.MainActivity";
      if (c.startsWith("pm install")) return "Success";
      if (c.startsWith("am broadcast")) return broadcast;
      if (c === "pm list packages -e")
        return [
          "com.android.settings",
          "com.android.systemui",
          "com.shelly.launcher",
          "com.android.browser",
          "io.homeassistant.companion.android.minimal",
          "com.google.android.webview",
        ]
          .map((p) => `package:${p}`)
          .join("\n");
      if (c === "pm list packages -3 -e")
        return "package:io.homeassistant.companion.android.minimal";
      if (c.startsWith("pm path ")) return `package:/system/app/x/${c.slice(8)}.apk`;
      if (c.startsWith("pm enable ")) return `Package ${c.slice(10)} new state: enabled`;
      if (c.startsWith("dumpsys package")) return "versionCode=700 versionName=1.19.44";
      return "";
    },
  };
}

test("GdAHome leggero: due app, la home, lo schermo, il foglietto dall'app — mai root", async () => {
  const dir = pezzi();
  try {
    const adb = displayAndroid();
    let visto = 1;
    const detti = [];
    const inst = new Installatore({
      adb,
      cartellaDeiPezzi: dir,
      cartellaDelleCopie: join(dir, "copie"),
      passoDellaBarra: 1,
      dispositivi: { elenco: () => [{ id: "dm_1", natoIl: 1, vistoIl: visto }] },
      abbinaPannello: async () => {
        visto = Date.now() + 5000;
        return { dispositivo: "dm_1", segno: "s", chiave: "k", case: { indirizzi: ["h:8098"] } };
      },
      attesaDellAbbinamento: { attesa: 300, pausa: 5 },
    });
    const esito = await inst.installaLeggero({
      indirizzo: "1.2.3.4",
      planciaId: "muro",
      utente: "u",
      nome: "Cucina",
      avanti: ({ passo, dettaglio }) => detti.push([passo, dettaglio]),
    });
    assert.equal(esito.errore, undefined);
    assert.equal(esito.percorso, "leggero");
    assert.equal(esito.famiglia, "shelly");
    assert.equal(esito.casaDiPrima, "com.shelly.launcher/.MainActivity");
    assert.equal(esito.abbinato, true);
    const comandi = adb.fatti.map(([c]) => c);
    /* Mai root, mai partizioni, mai copia. */
    /* Mai root, se non per leggere l'esito (che senza root non c'e'). */
    assert.ok(
      adb.fatti.every(([c, root]) => !root || c.startsWith("cat /data/data/com.gdahome.muro")),
    );
    assert.ok(!comandi.some((c) => /remount|\/system|dd if=|md5sum/.test(c)));
    assert.ok(comandi.includes("cmd package set-home-activity com.gdahome.os/.ui.AvvioActivity"));
    /* Il foglietto va all'app col broadcast protetto, in base64. */
    const b = comandi.find((c) => c.startsWith("am broadcast"));
    assert.match(
      b,
      /-f 0x20 -n com\.gdahome\.muro\/com\.gdahome\.gdahome\.IlFoglietto -a com\.gdahome\.FOGLIETTO --es foglietto [A-Za-z0-9+/=]+$/,
    );
    const foglietto = JSON.parse(Buffer.from(b.split(" ").pop(), "base64").toString());
    assert.equal(foglietto.dispositivo, "dm_1");
    assert.equal(foglietto.plancia, "muro");
    assert.ok(detti.some(([p, d]) => p === 4 && /nella casa/.test(d)));
    /* Il software del produttore: copiato, poi spento. Lo Shelly tiene la
     * sua app (rele', sensori); il launcher che non e' Shelly, il browser e
     * l'app aggiunta si spengono. Android e la WebView mai. */
    assert.deepEqual(esito.spente.sort(), [
      "com.android.browser",
      "io.homeassistant.companion.android.minimal",
    ]);
    assert.ok(readFileSync(join(esito.copia, "app.json"), "utf8").includes("com.android.browser"));
    assert.ok(comandi.includes("pm disable-user --user 0 com.android.browser"));
    assert.ok(!comandi.some((c) => /disable-user .*(shelly|settings|systemui|webview)/.test(c)));
    /* Spento solo dopo che GdAHome e' la home. */
    assert.ok(
      comandi.indexOf("cmd package set-home-activity com.gdahome.os/.ui.AvvioActivity") <
        comandi.indexOf("pm disable-user --user 0 com.android.browser"),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("GdAHome leggero: un'app di prima che non prende il foglietto lo dice", async () => {
  const dir = pezzi();
  try {
    const inst = new Installatore({
      adb: displayAndroid({ broadcast: "Broadcast completed: result=0" }),
      cartellaDeiPezzi: dir,
      cartellaDelleCopie: join(dir, "copie"),
      passoDellaBarra: 1,
      abbinaPannello: async () => ({
        dispositivo: "dm_1",
        segno: "s",
        chiave: "k",
        case: { indirizzi: ["h:8098"] },
      }),
    });
    const esito = await inst.installaLeggero({ indirizzo: "1.2.3.4", avanti: () => {} });
    assert.equal(esito.passoRotto, 3);
    assert.match(esito.errore, /non ha preso il foglietto/);
    /* Anche fermi qui, si sa cosa e' spento: per poter tornare indietro. */
    assert.ok(esito.spente.length > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("togliere GdAHome leggero: la home di prima, lo schermo di prima, le due app tolte", async () => {
  const adb = displayAndroid();
  const inst = new Installatore({ adb, cartellaDeiPezzi: tmpdir() });
  const esito = await inst.togliGdAHome({
    indirizzo: "1.2.3.4",
    casaDiPrima: "com.shelly.launcher/.MainActivity",
    spente: ["com.android.browser"],
  });
  assert.deepEqual(esito, { fatto: true });
  const comandi = adb.fatti.map(([c]) => c);
  /* Prima il software del produttore torna acceso, poi si toglie GdAHome. */
  assert.ok(
    comandi.indexOf("pm enable com.android.browser") <
      comandi.indexOf("pm uninstall com.gdahome.os"),
  );
  assert.ok(comandi.includes("cmd package set-home-activity com.shelly.launcher/.MainActivity"));
  assert.ok(comandi.includes("pm uninstall com.gdahome.muro"));
  assert.ok(comandi.includes("pm uninstall com.gdahome.os"));
  /* Una home di prima scritta male non finisce in un comando. */
  const altro = displayAndroid();
  await new Installatore({ adb: altro, cartellaDeiPezzi: tmpdir() }).togliGdAHome({
    indirizzo: "1.2.3.4",
    casaDiPrima: "x; rm -rf /",
  });
  assert.ok(!altro.fatti.some(([c]) => c.includes("rm -rf")));
});

test("aggiornare un pannello leggero non fa il ritocco di sistema", async () => {
  const dir = pezzi();
  try {
    const adb = displayAndroid();
    const inst = new Installatore({ adb, cartellaDeiPezzi: dir, passoDellaBarra: 1 });
    const esito = await inst.aggiorna({ indirizzo: "1.2.3.4", percorso: "leggero" });
    assert.equal(esito.errore, undefined);
    assert.equal(esito.ritocco, RITOCCO);
    const comandi = adb.fatti.map(([c]) => c);
    assert.ok(!comandi.some((c) => c.includes("gda-ritocco.sh")));
    assert.ok(comandi.includes("cmd package set-home-activity com.gdahome.os/.ui.AvvioActivity"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("la strada diretta si ricorda per pannello: un inciampo su uno non rallenta gli altri", async () => {
  const dir = pezzi();
  try {
    const mandati = [];
    const spinti = [];
    const adb = {
      async ncSulPannello(ind) {
        return ind === "10.0.0.9" ? "" : "nc";
      },
      async mandaDiretto(ind, _l, remoto) {
        if (ind === "10.0.0.1") throw Object.assign(new Error("no"), { causa: "diretta" });
        mandati.push([ind, remoto]);
        return { byte: 1 };
      },
      async push(ind) {
        spinti.push(ind);
      },
      async shell(_i, c) {
        if (c.startsWith("stat -c %s")) return String("GdAHome-OS.apk".length);
        if (c.startsWith("pm install")) return "Success";
        return "";
      },
    };
    const inst = new Installatore({
      adb,
      cartellaDeiPezzi: dir,
      passoDellaBarra: 1,
      indirizzoDiCasa: () => "192.168.1.8",
    });
    const installa = (ind) =>
      inst._installaConLaBarra(ind, "GdAHome-OS.apk", { nome: "GdAHome OS" });
    await installa("10.0.0.1"); // la diretta non va: adb
    await installa("10.0.0.2"); // un altro pannello: diretta
    await installa("10.0.0.1"); // lo stesso di prima: adb, senza riprovare
    assert.deepEqual(spinti, ["10.0.0.1", "10.0.0.1"]);
    assert.deepEqual(
      mandati.map(([i]) => i),
      ["10.0.0.2"],
    );
    /* Senza `nc` si va con adb, e il «niente» non si ricorda: si richiede. */
    await installa("10.0.0.9");
    assert.equal(inst._nc.has("10.0.0.9"), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("l'NSPanel si chiama NSPanel, non come la sua scheda", async () => {
  const adb = {
    async getprop(_i, nome) {
      return { "ro.product.manufacturer": "rockchip", "ro.product.model": "px30_evb" }[nome] ?? "";
    },
    async shell(_i, c) {
      if (c === "wm size") return "Physical size: 480x480";
      if (c.startsWith("pm list packages")) return "package:com.eWeLinkNSPro.dev";
      return "";
    },
  };
  const chi = await new Installatore({ adb, cartellaDeiPezzi: tmpdir() }).riconosci("1.2.3.4");
  assert.equal(chi.famiglia, "nspanel");
  assert.equal(chi.nome, "NSPanel Pro 86");
});

/* Un pannello con posto in /data: la fotografia delle partizioni si fa li',
 * da memoria a memoria, e la copia verso Home Assistant parte dopo. */
function pannelloConPosto({ misura = 1000, liberi = 4 * 1024 ** 3 } = {}) {
  const comandi = [];
  const file = new Map();
  return {
    comandi,
    file,
    async shell(_i, c) {
      comandi.push(c);
      if (c.includes("by-name; do")) return "/dev/block/by-name\n";
      if (c.startsWith("ls ")) return "boot\nsystem\nuserdata\n";
      if (c.startsWith("blockdev")) return String(misura);
      if (c.startsWith("df -k /data"))
        return `/dev/x 28000000 1000000 ${Math.floor(liberi / 1024)} 4% /data`;
      const dd = /^dd if=\S+ of=(\S+) /.exec(c);
      if (dd) {
        file.set(dd[1], misura);
        return `${misura}\n`;
      }
      if (c.startsWith("stat -c %s")) return String(misura);
      if (c.startsWith("md5sum")) return `${"a".repeat(32)}  x`;
      if (c.includes("|| echo MANCA"))
        return [...c.matchAll(/\[ -f (\S+) \]/g)].some(([, f]) => !file.has(f))
          ? "MANCA\nFINE"
          : "FINE";
      return "";
    },
    async connetti() {
      return true;
    },
  };
}

test("la copia di sicurezza si fotografa sul pannello: niente rete, si installa subito", async () => {
  const adb = pannelloConPosto();
  let scritte = 0;
  const inst = new Installatore({
    adb,
    passoDellaBarra: 1,
    scriviCopia: async () => {
      scritte += 1;
      return { byte: 1000, md5: "a".repeat(32) };
    },
  });
  const detti = [];
  const esito = await inst._fotoSulPannello("1.2.3.4", (d, p) => detti.push([d, p]));
  assert.equal(esito.errore, undefined);
  assert.deepEqual(esito.foto.partizioni, { system: 1000 });
  assert.equal(esito.foto.cartella, "/data/local/tmp/gdahome-copia");
  assert.ok(
    adb.comandi.some((c) =>
      c.startsWith(
        "dd if='/dev/block/by-name/system' of=/data/local/tmp/gdahome-copia/system.img bs=4194304",
      ),
    ),
  );
  /* Niente verso Home Assistant, niente impronta adesso: quelle sono dopo. */
  assert.equal(scritte, 0);
  assert.ok(!adb.comandi.some((c) => c.startsWith("md5sum")));
  assert.ok(detti.some(([d]) => /sul pannello/.test(d)));
});

test("senza posto sul pannello la fotografia non si fa, e la copia va come prima", async () => {
  const poco = new Installatore({ adb: pannelloConPosto({ liberi: 100 * 1024 ** 2 }) });
  assert.equal((await poco._fotoSulPannello("1.2.3.4")).nonCiSta, true);
  /* Una fotografia che non viene intera si toglie, e lo si dice. */
  const adb = pannelloConPosto();
  const shell = adb.shell;
  adb.shell = async (i, c) => (/^dd if=/.test(c) ? "400\n" : shell(i, c));
  const rotta = await new Installatore({ adb })._fotoSulPannello("1.2.3.4");
  assert.match(rotta.errore, /non e' completa/);
  assert.ok(adb.comandi.includes("rm -rf /data/local/tmp/gdahome-copia"));
});

test("la fotografia va su Home Assistant dopo, dai file del pannello, e poi si toglie", async () => {
  const copie = mkdtempSync(join(tmpdir(), "copie-"));
  try {
    const adb = pannelloConPosto();
    adb.file.set("/data/local/tmp/gdahome-copia/system.img", 1000);
    const comandi = [];
    const inst = new Installatore({
      adb,
      cartellaDelleCopie: copie,
      scriviCopia: async (_i, comando) => {
        comandi.push(comando);
        return { byte: 1000, md5: "a".repeat(32) };
      },
    });
    const foto = {
      cartella: "/data/local/tmp/gdahome-copia",
      partizioni: { system: 1000 },
      quando: "2026-11-28T05:40:00.000Z",
    };
    const esito = await inst.portaLaCopia({ indirizzo: "1.2.3.4", nome: "Corridoio", foto });
    assert.equal(esito.errore, undefined);
    assert.match(comandi[0], /dd if='\/data\/local\/tmp\/gdahome-copia\/system\.img'/);
    assert.match(readFileSync(join(esito.dir, "MD5SUMS"), "utf8"), /a{32} {2}system\.img/);
    assert.match(esito.dir, /Corridoio-2026-11-28_\d{4}$/);
    assert.equal(adb.comandi.at(-1), "rm -rf /data/local/tmp/gdahome-copia");

    /* Se sul pannello non c'e' piu', e' persa: non si riprova per sempre. */
    adb.file.clear();
    const persa = await inst.portaLaCopia({ indirizzo: "1.2.3.4", nome: "x", foto });
    assert.equal(persa.persa, true);
  } finally {
    rmSync(copie, { recursive: true, force: true });
  }
});

test("tornare a Sonoff toglie anche la fotografia rimasta sul pannello", () => {
  assert.ok(scriptDelRipristino().includes("rm -rf /data/local/tmp/gdahome-copia"));
});

test("un errore inatteso nell'installazione dice il perche' e il passo, non sempre la Verifica", async () => {
  const dir = pezzi();
  try {
    const adb = pannelloConPosto();
    adb.root = async () => "0";
    adb.getprop = async () => "8.1.0";
    adb.connetti = async () => true;
    const shell = adb.shell;
    adb.shell = async (i, c) => {
      if (c.startsWith("pm install") || c.startsWith("pm path")) throw new Error("pm si e' rotto");
      return shell(i, c);
    };
    adb.install = async () => {
      throw new Error("pm si e' rotto");
    };
    adb.push = async () => {};
    const inst = new Installatore({ adb, cartellaDeiPezzi: dir, passoDellaBarra: 1 });
    inst.riconosci = async () => ({ famiglia: "nspanel" });
    inst._installaOs = async () => {
      throw new Error("pm si e' rotto");
    };
    const esito = await inst.installa({ indirizzo: "1.2.3.4", nome: "x", avanti: () => {} });
    assert.match(esito.errore, /\(pm si e' rotto\)/);
    assert.equal(esito.passoRotto, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("se la fotografia sul pannello inciampa, l'installazione va avanti con la copia per la rete", async () => {
  const adb = pannelloConPosto();
  const shell = adb.shell;
  adb.shell = async (i, c) => {
    if (c.startsWith("rm -rf /data/local/tmp/gdahome-copia; mkdir")) throw new Error("niente su");
    return shell(i, c);
  };
  const esito = await new Installatore({ adb })._fotoSulPannello("1.2.3.4");
  assert.equal(esito.nonCiSta, true);
  assert.match(esito.perche, /niente su/);
});

test("un nuovo tentativo riusa la fotografia di prima: il sistema puo' essere gia' cambiato", async () => {
  const dir = pezzi();
  try {
    const adb = pannelloConPosto();
    adb.root = async () => "0";
    adb.getprop = async () => "8.1.0";
    adb.file.set("/data/local/tmp/gdahome-copia/system.img", 1000);
    const inst = new Installatore({ adb, cartellaDeiPezzi: dir, passoDellaBarra: 1 });
    inst.riconosci = async () => ({ famiglia: "nspanel" });
    inst._installaOs = async () => ({ errore: "si ferma qui" });
    const foto = { cartella: "/data/local/tmp/gdahome-copia", partizioni: { system: 1000 } };
    const detti = [];
    const esito = await inst.installa({
      indirizzo: "1.2.3.4",
      nome: "x",
      avanti: ({ passo, dettaglio }) => detti.push([passo, dettaglio]),
      fotoDiPrima: foto,
    });
    assert.equal(esito.errore, "si ferma qui");
    assert.ok(!adb.comandi.some((c) => /^dd if=/.test(c) || /^rm -rf .*gdahome-copia/.test(c)));
    assert.ok(detti.some(([p, d]) => p === 1 && /tentativo di prima/.test(d)));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
