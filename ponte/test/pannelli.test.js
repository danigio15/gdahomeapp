/* I pannelli a muro: l'orchestrazione, con un adb e un installatore finti.
 * Nessun pannello vero, nessun file di GdAHome OS. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Pannelli,
  indirizziDellaRete,
  modelloDalloSchermo,
  indirizzoPulito,
  leggiByte,
} from "../src/pannelli.js";
import { RITOCCO } from "../src/installatore-pannelli.js";

function cartella() {
  return mkdtempSync(join(tmpdir(), "pannelli-"));
}

/* Un adb finto guidato da una tabella «comando → risposta». */
function adbFinto(tabella = {}) {
  const chiamate = [];
  const rispondi = (chiave) => {
    const v = tabella[chiave];
    return typeof v === "function" ? v() : v;
  };
  return {
    chiamate,
    async connetti(ind) {
      chiamate.push(["connetti", ind]);
      return tabella[`connetti ${ind}`] ?? tabella.connetti ?? true;
    },
    async provaCollegamento(ind) {
      const ok = tabella[`connetti ${ind}`] ?? tabella.connetti ?? true;
      return { ok, causa: ok ? "" : (tabella.causa ?? "irraggiungibile") };
    },
    async stacca() {},
    async getprop(ind, nome) {
      return rispondi(`getprop ${nome}`) ?? "";
    },
    async shell(ind, comando) {
      chiamate.push(["shell", comando]);
      for (const chiave of Object.keys(tabella))
        if (chiave.startsWith("shell:") && comando.includes(chiave.slice(6)))
          return rispondi(chiave);
      return "";
    },
    async root(ind) {
      return tabella.root ?? "0";
    },
  };
}

/* Un installatore finto: segna i passi e torna quello che gli si dice. */
function installatoreFinto(esito = {}) {
  const fatti = [];
  return {
    fatti,
    async installa({ avanti }) {
      for (let i = 0; i < 5; i += 1) avanti({ passo: i });
      fatti.push("installa");
      return esito.installa ?? { os: "2.0.0", app: "1.19.33", modello: "86", dispositivo: "dm_x" };
    },
    async aggiorna({ avanti }) {
      avanti({ passo: 0 });
      avanti({ passo: 1 });
      fatti.push("aggiorna");
      return esito.aggiorna ?? { app: "1.19.34", os: "2.0.1" };
    },
    async riavvia() {
      fatti.push("riavvia");
      return { fatto: true };
    },
    async analisi() {
      fatti.push("analisi");
      return "== Dispositivo ==\nNSPanel Pro 86";
    },
    async sonoff({ avanti }) {
      avanti({ passo: 0 });
      avanti({ passo: 1 });
      fatti.push("sonoff");
      return esito.sonoff ?? { fatto: true };
    },
  };
}

const premium = { stato: () => ({ gdahome: { attiva: true } }) };
const base = { stato: () => ({ gdahome: { attiva: false } }) };

/* Aspetta che il lavoro del pannello sia finito (gira da solo). */
async function finoAllaFine(pannelli, id) {
  for (let i = 0; i < 100; i += 1) {
    const l = pannelli.lavori.get(id);
    if (!l || l.finito) return l;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error("il lavoro non finisce");
}

test("modelloDalloSchermo riconosce 86 e 120", () => {
  assert.equal(modelloDalloSchermo("480x480"), "86");
  assert.equal(modelloDalloSchermo("750x1334"), "120");
  assert.equal(modelloDalloSchermo("1334x750"), "120");
  assert.equal(modelloDalloSchermo("1024x600"), "");
});

test("indirizziDellaRete da' .1..254 della /24", () => {
  const i = indirizziDellaRete("192.168.1.42");
  assert.equal(i.length, 254);
  assert.equal(i[0], "192.168.1.1");
  assert.equal(i.at(-1), "192.168.1.254");
  assert.deepEqual(indirizziDellaRete("non-un-ip"), []);
});

test("indirizzoPulito accetta un ip e rifiuta un comando", () => {
  assert.equal(indirizzoPulito(" 192.168.1.5 "), "192.168.1.5");
  assert.equal(indirizzoPulito("a; rm -rf /"), "");
  assert.equal(indirizzoPulito(""), "");
});

test("leggiByte legge le unita'", () => {
  assert.equal(leggiByte("1.9G"), Math.round(1.9 * 1024 ** 3));
  assert.equal(leggiByte("500M"), 500 * 1024 ** 2);
  assert.equal(leggiByte("1024"), 1024 * 1024);
  assert.equal(leggiByte("boh"), null);
});

test("con Base, installare e' rifiutato prima di toccare il pannello", async () => {
  const dir = cartella();
  try {
    const inst = installatoreFinto();
    const pannelli = new Pannelli({ cartella: dir, installatore: inst, licenze: base });
    await assert.rejects(() => pannelli.installa({ indirizzo: "192.168.1.5" }), /Premium/);
    assert.deepEqual(inst.fatti, []);
    const { premium: p } = await pannelli.elenco();
    assert.equal(p, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("installa crea il pannello, segue i passi, e lo lascia pronto", async () => {
  const dir = cartella();
  try {
    const inst = installatoreFinto();
    /* La forma vera di `plance.elenco()`: `profilo` e `titolo`. */
    const plance = { elenco: () => [{ profilo: "soggiorno", titolo: "Soggiorno" }] };
    const pannelli = new Pannelli({ cartella: dir, installatore: inst, licenze: premium, plance });
    const { id } = await pannelli.installa({
      indirizzo: "192.168.1.5",
      nome: "Soggiorno",
      plancia: "soggiorno",
      utente: "u1",
    });
    assert.ok(id.startsWith("pm_"));
    /* Durante il lavoro la riga mostra i passi. */
    const durante = (await pannelli.elenco()).pannelli.find((p) => p.id === id);
    assert.ok(durante.lavoro);
    assert.equal(durante.lavoro.passi.length, 5);
    await finoAllaFine(pannelli, id);
    assert.deepEqual(inst.fatti, ["installa"]);
    const dopo = (await pannelli.elenco()).pannelli.find((p) => p.id === id);
    assert.equal(dopo.stato, "pronto");
    assert.equal(dopo.os, "2.0.0");
    assert.equal(dopo.plancia, "Soggiorno");
    assert.equal(dopo.utente, "u1");
    assert.equal(dopo.dispositivo, "dm_x");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("un'installazione fallita lascia il pannello in errore, non a meta'", async () => {
  const dir = cartella();
  try {
    const inst = installatoreFinto({
      installa: { errore: "Il pannello non risponde piu'.", passoRotto: 1 },
    });
    const pannelli = new Pannelli({ cartella: dir, installatore: inst, licenze: premium });
    const { id } = await pannelli.installa({ indirizzo: "192.168.1.5" });
    const l = await finoAllaFine(pannelli, id);
    assert.equal(l.errore, "Il pannello non risponde piu'.");
    assert.equal(l.passi[1].stato, "male");
    const dopo = (await pannelli.elenco()).pannelli.find((p) => p.id === id);
    assert.equal(dopo.stato, "errore");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("l'elenco si salva e torna dopo un riavvio dell'add-on", async () => {
  const dir = cartella();
  try {
    const inst = installatoreFinto();
    const uno = new Pannelli({ cartella: dir, installatore: inst, licenze: premium });
    const { id } = await uno.installa({ indirizzo: "192.168.1.5", nome: "Ingresso" });
    await finoAllaFine(uno, id);
    /* Un secondo gestore legge lo stesso file. */
    const due = new Pannelli({
      cartella: dir,
      installatore: installatoreFinto(),
      licenze: premium,
    });
    const trovato = (await due.elenco()).pannelli.find((p) => p.id === id);
    assert.ok(trovato, "il pannello e' sul disco");
    assert.equal(trovato.nome, "Ingresso");
    assert.equal(trovato.lavoro, null, "un lavoro finito non si salva");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rimetti Sonoff stacca il dispositivo e toglie il pannello", async () => {
  const dir = cartella();
  try {
    const staccati = [];
    const dispositivi = { stacca: (id) => staccati.push(id) };
    const pannelli = new Pannelli({
      cartella: dir,
      installatore: installatoreFinto(),
      licenze: premium,
      dispositivi,
    });
    const { id } = await pannelli.installa({ indirizzo: "192.168.1.5" });
    await finoAllaFine(pannelli, id);
    await pannelli.azione(id, "sonoff");
    await finoAllaFine(pannelli, id);
    assert.deepEqual(staccati, ["dm_x"]);
    const resta = (await pannelli.elenco()).pannelli.find((p) => p.id === id);
    assert.equal(resta, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("la scansione della rete trova i pannelli che rispondono", async () => {
  const dir = cartella();
  try {
    const adb = adbFinto({
      connetti: false,
      "connetti 10.0.0.5": true,
      "connetti 10.0.0.9": true,
      "getprop ro.product.manufacturer": "Sonoff",
      "shell:wm size": "Physical size: 480x480",
    });
    const reteDiCasa = { indirizzo: () => "10.0.0.2" };
    const pannelli = new Pannelli({
      cartella: dir,
      adb,
      installatore: installatoreFinto(),
      licenze: premium,
      reteDiCasa,
    });
    const { trovati } = await pannelli.rete({ concorrenti: 8 });
    const indirizzi = trovati.map((t) => t.indirizzo);
    assert.ok(indirizzi.includes("10.0.0.5"));
    assert.ok(indirizzi.includes("10.0.0.9"));
    assert.equal(
      trovati.every((t) => t.modello === "86"),
      true,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("la scansione dice quanti ne ha contattati e su che rete (per capire «perche' niente»)", async () => {
  const dir = cartella();
  try {
    /* Tutti rispondono «rifiutato»: raggiunti, ma nessuno con l'ADB di rete
     * aperto. `contattati` alto dice «e' la rete e' a posto, e' il pannello». */
    const raggiunti = new Pannelli({
      cartella: dir,
      adb: adbFinto({ connetti: false, causa: "rifiutato" }),
      installatore: installatoreFinto(),
      licenze: premium,
      reteDiCasa: { indirizzo: () => "192.168.1.174" },
    });
    const a = await raggiunti.rete({ concorrenti: 16 });
    assert.equal(a.trovati.length, 0);
    assert.equal(a.rete, "192.168.1");
    assert.equal(a.contattati, 254);

    /* Nessuna risposta su tutta la /24: l'add-on non arriva a quella rete. */
    const muti = new Pannelli({
      cartella: dir,
      adb: adbFinto({ connetti: false, causa: "irraggiungibile" }),
      installatore: installatoreFinto(),
      licenze: premium,
      reteDiCasa: { indirizzo: () => "192.168.1.174" },
    });
    const b = await muti.rete({ concorrenti: 16 });
    assert.equal(b.contattati, 0);
    assert.equal(b.rete, "192.168.1");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("se adb non parte, la ricerca e la verifica lo dicono (non «nessun dispositivo»)", async () => {
  const dir = cartella();
  try {
    const adb = adbFinto({});
    adb.avviaServer = async () => {
      throw Object.assign(new Error("* failed to start daemon"), {
        causa: "demone",
        uscita: "Cannot mkdir '/data/adb/.android': No such file or directory",
      });
    };
    const pannelli = new Pannelli({
      cartella: dir,
      adb,
      installatore: installatoreFinto(),
      licenze: premium,
      reteDiCasa: { indirizzo: () => "192.168.1.174" },
    });
    const r = await pannelli.rete();
    assert.equal(r.adbRotto, true);
    assert.match(r.perche, /adb dentro l'add-on non parte/);
    assert.match(r.perche, /Cannot mkdir/);
    await assert.rejects(
      () => pannelli.verifica("192.168.1.120"),
      (e) => e.causa === "adb_rotto" && e.perUtente === true,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("un pannello che aspetta il Consenti si trova, e la verifica dice di toccarlo", async () => {
  const dir = cartella();
  try {
    const adb = adbFinto({ connetti: false, causa: "irraggiungibile" });
    const prima = adb.provaCollegamento;
    adb.provaCollegamento = async (ind) =>
      ind === "192.168.1.120" ? { ok: false, causa: "non_autorizzato" } : prima(ind);
    const pannelli = new Pannelli({
      cartella: dir,
      adb,
      installatore: installatoreFinto(),
      licenze: premium,
      reteDiCasa: { indirizzo: () => "192.168.1.174" },
    });
    const r = await pannelli.rete({ concorrenti: 16 });
    assert.deepEqual(r.trovati, [
      { indirizzo: "192.168.1.120", modello: "", daAutorizzare: true, gia: false },
    ]);
    assert.equal(r.contattati, 1);
    await assert.rejects(
      () => pannelli.verifica("192.168.1.120"),
      (e) => {
        assert.equal(e.causa, "non_autorizzato");
        assert.match(e.message, /Consenti/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifica dice adatto quando root, sistema e spazio ci sono", async () => {
  const dir = cartella();
  try {
    const adb = adbFinto({
      "getprop ro.build.version.release": "8.1.0",
      "shell:wm size": "Physical size: 480x480",
      "shell:mount": "/dev/block/mmcblk0p20 /system ext4 ro",
      "shell:df /data": "/dev/x 28000000 1000000 26000000 4% /data",
      "shell:dumpsys webviewupdate":
        "Current WebView package (name, version): (com.android.webview, 61.0.3163.98)",
      root: "0",
    });
    const pannelli = new Pannelli({
      cartella: dir,
      adb,
      installatore: installatoreFinto(),
      licenze: premium,
    });
    const v = await pannelli.verifica("192.168.1.5");
    assert.equal(v.adatto, true);
    assert.equal(v.modello, "86");
    assert.equal(v.android, "8.1.0");
    /* La WebView vecchia e' un avviso giallo, non un no. */
    const wv = v.verifiche.find((r) => /WebView/.test(r.detto));
    assert.equal(wv.esito, "giallo");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifica dice NON adatto senza root", async () => {
  const dir = cartella();
  try {
    const adb = adbFinto({ "shell:wm size": "Physical size: 480x480", root: "" });
    const pannelli = new Pannelli({
      cartella: dir,
      adb,
      installatore: installatoreFinto(),
      licenze: premium,
    });
    const v = await pannelli.verifica("192.168.1.5");
    assert.equal(v.adatto, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifica spiega quando l'ADB di rete e' spento (5555 rifiutata)", async () => {
  const dir = cartella();
  try {
    const adb = adbFinto({ connetti: false, causa: "rifiutato" });
    let prove = 0;
    const prova = adb.provaCollegamento;
    adb.provaCollegamento = (ind) => {
      prove += 1;
      return prova(ind);
    };
    const pannelli = new Pannelli({
      cartella: dir,
      adb,
      installatore: installatoreFinto(),
      licenze: premium,
      riprovaDelRifiuto: { volte: 2, pausa: 1 },
    });
    await assert.rejects(
      () => pannelli.verifica("192.168.1.5"),
      (e) => {
        /* Un rifiuto si riprova prima di dirlo. */
        assert.equal(prove, 3);
        /* Prima l'indirizzo, che il router puo' aver cambiato; poi l'ADB. */
        assert.match(e.message, /indirizzo nuovo/);
        assert.match(e.message, /ADB di rete/);
        assert.equal(e.perUtente, true);
        /* Il codice-macchina arriva fino alla console, che su «rifiutato»
         * (e non su un indirizzo sbagliato) mostra la guida eWeLink. */
        assert.equal(e.causa, "rifiutato");
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifica: un rifiuto di un attimo non e' «ADB spento»", async () => {
  const dir = cartella();
  try {
    let volta = 0;
    const adb = adbFinto({ "getprop ro.build.version.release": "8.1.0" });
    adb.provaCollegamento = async () =>
      (volta += 1) === 1 ? { ok: false, causa: "rifiutato" } : { ok: true, causa: "" };
    const pannelli = new Pannelli({
      cartella: dir,
      adb,
      installatore: installatoreFinto(),
      licenze: premium,
      riprovaDelRifiuto: { volte: 3, pausa: 1 },
    });
    const v = await pannelli.verifica("192.168.1.5");
    assert.equal(volta, 2);
    assert.equal(v.indirizzo ?? "192.168.1.5", "192.168.1.5");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifica: un indirizzo che e' gia' un pannello GdAHome non si reinstalla", async () => {
  const dir = cartella();
  try {
    const pannelli = new Pannelli({
      cartella: dir,
      adb: adbFinto(),
      installatore: installatoreFinto(),
      licenze: premium,
    });
    pannelli.archivio.dati.pannelli.push({
      id: "pm_a",
      indirizzo: "192.168.1.100",
      nome: "Salone",
      stato: "pronto",
    });
    await assert.rejects(
      () => pannelli.verifica("192.168.1.100"),
      (e) => e.causa === "gia_gdahome" && /Salone/.test(e.message),
    );
    /* Uno la cui installazione e' andata male si riprova: niente blocco. */
    pannelli.archivio.dati.pannelli.push({
      id: "pm_b",
      indirizzo: "192.168.1.120",
      nome: "Corridoio",
      stato: "errore",
    });
    const v = await pannelli.verifica("192.168.1.120");
    assert.equal(v.indirizzo, "192.168.1.120");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifica: una cifra sbagliata fuori dalla rete di casa si dice, col probabile giusto", async () => {
  const dir = cartella();
  try {
    const pannelli = new Pannelli({
      cartella: dir,
      adb: adbFinto({ connetti: false, causa: "irraggiungibile" }),
      installatore: installatoreFinto(),
      licenze: premium,
      reteDiCasa: { indirizzo: () => "192.168.1.174" },
    });
    await assert.rejects(
      () => pannelli.verifica("192.198.1.120"),
      (e) => /forse volevi 192\.168\.1\.120/.test(e.message) && e.causa === "irraggiungibile",
    );
    /* Nella rete di casa resta il messaggio di sempre. */
    await assert.rejects(
      () => pannelli.verifica("192.168.1.121"),
      (e) => /non risponde a questo indirizzo/.test(e.message),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifica: un indirizzo muto da' causa «irraggiungibile», non «rifiutato»", async () => {
  const dir = cartella();
  try {
    const adb = adbFinto({ connetti: false, causa: "irraggiungibile" });
    const pannelli = new Pannelli({
      cartella: dir,
      adb,
      installatore: installatoreFinto(),
      licenze: premium,
    });
    await assert.rejects(
      () => pannelli.verifica("192.168.1.5"),
      (e) => {
        assert.equal(e.causa, "irraggiungibile");
        assert.doesNotMatch(e.message, /ADB di rete/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("il giro degli aggiornamenti aggiorna da solo i pannelli indietro, e salta quelli spenti", async () => {
  const dir = cartella();
  try {
    const aggiornati = [];
    const pezzi = { os: { codice: 620, nome: "2.0.0" }, muro: { codice: 621, nome: "1.19.37" } };
    const installatore = {
      versioniDeiPezzi: () => pezzi,
      async versioniSulPannello() {
        return { os: { codice: 620, nome: "2.0.0" }, muro: { codice: 600, nome: "1.19.36" } };
      },
      daAggiornare: (sul, p) => (sul.muro.codice < p.muro.codice ? ["muro"] : []),
      async aggiorna({ indirizzo }) {
        aggiornati.push(indirizzo);
        return {
          app: "1.19.37",
          os: "2.0.0",
          versioni: pezzi,
          aggiornati: ["muro"],
          ritocco: RITOCCO,
        };
      },
    };
    const adb = {
      async provaCollegamento(ind) {
        return ind === "192.168.1.120"
          ? { ok: true, causa: "" }
          : { ok: false, causa: "irraggiungibile" };
      },
    };
    const pannelli = new Pannelli({ cartella: dir, adb, installatore, licenze: premium });
    pannelli.archivio.dati.pannelli.push(
      { id: "pm_a", indirizzo: "192.168.1.120", stato: "pronto" },
      { id: "pm_b", indirizzo: "192.168.1.100", stato: "pronto" },
      { id: "pm_c", indirizzo: "192.168.1.130", stato: "sonoff" },
    );
    const esito = await pannelli.controllaGliAggiornamenti();
    assert.deepEqual(esito, { controllati: 1, aggiornati: 1 });
    assert.deepEqual(aggiornati, ["192.168.1.120"]);
    const [a, b] = pannelli.archivio.dati.pannelli;
    assert.equal(a.app, "1.19.37");
    assert.equal(a.aggiornabile, false);
    assert.equal(b.acceso, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("un pannello mai entrato nella casa si riabbina da solo; uno gia' dentro no", async () => {
  const dir = cartella();
  try {
    const chiesti = [];
    const pezzi = { os: { codice: 620, nome: "2.0.0" }, muro: { codice: 621, nome: "1.19.37" } };
    const installatore = {
      versioniDeiPezzi: () => pezzi,
      async versioniSulPannello() {
        return pezzi;
      },
      daAggiornare: () => [],
      async aggiorna({ indirizzo, abbina }) {
        chiesti.push([indirizzo, abbina]);
        return abbina
          ? {
              versioni: pezzi,
              ritocco: RITOCCO,
              abbinato: true,
              dispositivo: abbina.dispositivo,
              abbinatoIl: 5000,
            }
          : { versioni: pezzi, ritocco: RITOCCO };
      },
    };
    const adb = {
      async provaCollegamento() {
        return { ok: true, causa: "" };
      },
    };
    /* dm_muto: abbinato all'installazione e mai piu' visto; dm_vivo: si e'
     * collegato dopo. */
    const dispositivi = {
      elenco: () => [
        { id: "dm_muto", natoIl: 1000, vistoIl: 1000 },
        { id: "dm_vivo", natoIl: 1000, vistoIl: 4000 },
      ],
    };
    const pannelli = new Pannelli({
      cartella: dir,
      adb,
      installatore,
      licenze: premium,
      dispositivi,
    });
    pannelli.archivio.dati.pannelli.push(
      {
        id: "pm_a",
        indirizzo: "192.168.1.100",
        stato: "pronto",
        dispositivo: "dm_muto",
        nome: "Cucina",
        planciaId: "muro",
        ritocco: RITOCCO,
      },
      {
        id: "pm_b",
        indirizzo: "192.168.1.120",
        stato: "pronto",
        dispositivo: "dm_vivo",
        ritocco: RITOCCO,
      },
    );
    const esito = await pannelli.controllaGliAggiornamenti();
    assert.deepEqual(esito, { controllati: 2, aggiornati: 1 });
    assert.equal(chiesti.length, 1);
    assert.equal(chiesti[0][0], "192.168.1.100");
    assert.equal(chiesti[0][1].dispositivo, "dm_muto");
    assert.equal(chiesti[0][1].planciaId, "muro");
    const [a] = pannelli.archivio.dati.pannelli;
    assert.equal(a.abbinatoIl, 5000);
    assert.equal(a.aggiornabile, false);
    assert.equal(a.avviso, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("un pannello installato prima del ritocco lo rifa' al giro, anche coi pezzi gia' giusti", async () => {
  const dir = cartella();
  try {
    let chiamato = 0;
    const pezzi = { os: { codice: 620 }, muro: { codice: 621 } };
    const installatore = {
      versioniDeiPezzi: () => pezzi,
      versioniSulPannello: async () => pezzi,
      daAggiornare: () => [],
      async aggiorna() {
        chiamato += 1;
        return { versioni: pezzi, ritocco: RITOCCO };
      },
    };
    const adb = { provaCollegamento: async () => ({ ok: true }) };
    const pannelli = new Pannelli({ cartella: dir, adb, installatore, licenze: premium });
    pannelli.archivio.dati.pannelli.push({ id: "pm_a", indirizzo: "10.0.0.5", stato: "pronto" });
    await pannelli.controllaGliAggiornamenti();
    assert.equal(chiamato, 1);
    assert.equal(pannelli.archivio.dati.pannelli[0].ritocco, RITOCCO);
    /* Al giro dopo non c'e' piu' niente da fare. */
    await pannelli.controllaGliAggiornamenti();
    assert.equal(chiamato, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("la ricerca dice a che punto e', mentre va", async () => {
  const dir = cartella();
  try {
    let visto = null;
    let pannelli;
    const adb = {
      async provaCollegamento(ind) {
        if (ind === "10.0.0.100") visto = pannelli.statoDellaRicerca();
        return { ok: false, causa: "rifiutato" };
      },
    };
    pannelli = new Pannelli({
      cartella: dir,
      adb,
      installatore: installatoreFinto(),
      licenze: premium,
      reteDiCasa: { indirizzo: () => "10.0.0.2" },
    });
    pannelli.adb.comando = async () => "";
    await pannelli.rete({ concorrenti: 1 });
    assert.equal(visto.inCorso, true);
    assert.equal(visto.totale, 254);
    assert.equal(visto.fatti, 99);
    assert.equal(visto.rete, "10.0.0");
    assert.equal(pannelli.statoDellaRicerca().inCorso, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("una ricerca alla volta, e nessuna mentre si lavora su un pannello", async () => {
  const dir = cartella();
  try {
    let connessioni = 0;
    const adb = {
      async comando() {
        return "";
      },
      async provaCollegamento() {
        connessioni += 1;
        await new Promise((r) => setTimeout(r, 1));
        return { ok: false, causa: "rifiutato" };
      },
    };
    const pannelli = new Pannelli({
      cartella: dir,
      adb,
      installatore: installatoreFinto(),
      licenze: premium,
      reteDiCasa: { indirizzo: () => "10.0.0.2" },
    });
    /* Due richieste insieme (la console che chiede, e chiede ancora): una
     * ricerca sola, 254 indirizzi e non 508. */
    const [a, b] = await Promise.all([pannelli.rete(), pannelli.rete()]);
    assert.equal(a, b);
    assert.equal(connessioni, 254);
    assert.equal(pannelli.statoDellaRicerca().fatti, 254);
    /* Con un'installazione in corso non si cerca: adb serve al pannello. */
    pannelli.lavori.set("pm_x", { finito: false, passi: [] });
    const occupato = await pannelli.rete();
    assert.equal(occupato.occupato, true);
    assert.equal(connessioni, 254);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("l'analisi dice da che strada il pannello parla con la casa", async () => {
  const dir = cartella();
  try {
    const installatore = {
      ...installatoreFinto(),
      analisi: async () => "== Dispositivo ==\nNSPanel",
    };
    const fili = {
      dm_casa: [{ da: "192.168.1.100", daCasa: true, vistoSecondiFa: 2 }],
      dm_fuori: [{ da: "centralino", daCasa: false, vistoSecondiFa: 1 }],
    };
    const pannelli = new Pannelli({
      cartella: dir,
      adb: adbFinto(),
      installatore,
      licenze: premium,
      collegamenti: (id) => fili[id] || [],
    });
    pannelli.archivio.dati.pannelli.push(
      { id: "pm_a", indirizzo: "192.168.1.100", stato: "pronto", dispositivo: "dm_casa" },
      { id: "pm_b", indirizzo: "192.168.1.101", stato: "pronto", dispositivo: "dm_fuori" },
      { id: "pm_c", indirizzo: "192.168.1.102", stato: "pronto", dispositivo: "dm_spento" },
    );
    const a = await pannelli.azione("pm_a", "analisi");
    assert.match(a.rapporto, /== Collegamento con la casa ==\ndentro casa · da 192\.168\.1\.100/);
    const b = await pannelli.azione("pm_b", "analisi");
    assert.match(b.rapporto, /da fuori \(centralino\)/);
    const c = await pannelli.azione("pm_c", "analisi");
    assert.match(c.rapporto, /non collegato adesso/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("togliere un pannello con GdAHome sopra: prima il software originale, o «forza» per uno perso", () => {
  const dir = cartella();
  try {
    const staccati = [];
    const pannelli = new Pannelli({
      cartella: dir,
      adb: adbFinto(),
      installatore: installatoreFinto(),
      licenze: premium,
      dispositivi: { stacca: (id) => staccati.push(id) },
    });
    pannelli.archivio.dati.pannelli.push(
      { id: "pm_a", indirizzo: "10.0.0.1", stato: "pronto", dispositivo: "dm_a" },
      { id: "pm_b", indirizzo: "10.0.0.2", stato: "sonoff" },
      { id: "pm_c", indirizzo: "10.0.0.3", stato: "errore", dispositivo: "dm_c" },
    );
    assert.throws(
      () => pannelli.togli("pm_a"),
      (e) => e.causa === "prima_il_software",
    );
    assert.throws(
      () => pannelli.togli("pm_c"),
      (e) => e.causa === "prima_il_software",
    );
    /* Uno mai installato esce e basta. */
    assert.deepEqual(pannelli.togli("pm_b"), { tolto: true });
    /* Un pannello perso: forzato, esce dalla casa e dall'elenco. */
    assert.deepEqual(pannelli.togli("pm_a", { forza: true }), { tolto: true });
    assert.deepEqual(staccati, ["dm_a"]);
    assert.deepEqual(
      pannelli.archivio.dati.pannelli.map((p) => p.id),
      ["pm_c"],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("verifica di un display senza root: niente root richiesto, copia del software del produttore", async () => {
  const dir = cartella();
  try {
    const installatore = {
      ...installatoreFinto(),
      riconosci: async () => ({
        famiglia: "shelly",
        percorso: "leggero",
        nome: "Shelly Wall Display",
        schermo: "480x480",
        android: "8.1.0",
      }),
    };
    const pannelli = new Pannelli({
      cartella: dir,
      adb: adbFinto({ root: "1" }),
      installatore,
      licenze: premium,
    });
    const v = await pannelli.verifica("192.168.1.30");
    assert.equal(v.percorso, "leggero");
    assert.equal(v.adatto, true);
    assert.equal(v.nomeDelModello, "Shelly Wall Display");
    const detti = v.verifiche.map((x) => x.detto).join("\n");
    assert.match(detti, /non serve root/);
    assert.match(detti, /si copia su Home Assistant e si spegne/);
    assert.match(detti, /app Shelly resta accesa/);
    assert.doesNotMatch(detti, /Manca l'accesso root/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("la copia fotografata sul pannello va su Home Assistant dopo, in sottofondo, con la sua barra", async () => {
  const dir = cartella();
  try {
    const foto = { cartella: "/data/local/tmp/gdahome-copia", partizioni: { system: 1000 } };
    const inst = installatoreFinto({
      installa: { os: "2.0.0", app: "1.19.47", modello: "86", copiaDaPortare: foto },
    });
    let lascia;
    const arrivata = new Promise((r) => (lascia = r));
    const viaggi = [];
    inst.portaLaCopia = async ({ foto: f, avanti }) => {
      viaggi.push(f);
      avanti("system · 500 B di 1000 B", 50);
      await arrivata;
      return { dir: "/share/gdahome-os/Corridoio-2026-11-28_0540" };
    };
    inst.versioniDeiPezzi = () => ({});
    inst.versioniSulPannello = async () => ({});
    inst.daAggiornare = () => [];
    const pannelli = new Pannelli({
      cartella: dir,
      installatore: inst,
      licenze: premium,
      adb: adbFinto(),
    });
    const { id } = await pannelli.installa({ indirizzo: "192.168.1.120", nome: "Corridoio" });
    await finoAllaFine(pannelli, id);
    /* L'installazione e' finita, la copia viaggia: la console la vede. */
    const durante = (await pannelli.elenco()).pannelli.find((p) => p.id === id);
    assert.equal(durante.stato, "pronto");
    assert.deepEqual(durante.viaggio, {
      percento: 50,
      detto: "system · 500 B di 1000 B",
      errore: "",
    });
    assert.deepEqual(durante.copiaDaPortare, foto);
    /* Il giro non ne fa partire una seconda mentre la prima e' in viaggio. */
    pannelli.lavori.delete(id);
    const giro = await pannelli.controllaGliAggiornamenti({ installaDaSolo: false });
    assert.equal(giro.controllati, 1);
    assert.equal(viaggi.length, 1);
    lascia();
    await pannelli._inViaggio.get(id)?.lavoro;
    const dopo = (await pannelli.elenco()).pannelli.find((p) => p.id === id);
    assert.equal(dopo.viaggio, null);
    assert.equal(dopo.copiaDaPortare, undefined);
    assert.equal(dopo.copia, "/share/gdahome-os/Corridoio-2026-11-28_0540");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("un lavoro sul pannello mette in pausa la copia in viaggio, che riparte dopo", async () => {
  const dir = cartella();
  try {
    const foto = { cartella: "/data/local/tmp/gdahome-copia", partizioni: { system: 1000 } };
    const inst = installatoreFinto();
    const fermate = [];
    let viaggi = 0;
    const sblocchi = [];
    inst.fermaLaCopia = async (ind) => {
      fermate.push(ind);
      sblocchi.shift()?.({ errore: "nessun dato" });
    };
    inst.portaLaCopia = () => {
      viaggi += 1;
      return new Promise((r) => sblocchi.push(r));
    };
    const pannelli = new Pannelli({ cartella: dir, installatore: inst, licenze: premium });
    pannelli.archivio.dati.pannelli.push({
      id: "pm_c",
      indirizzo: "192.168.1.120",
      stato: "errore",
      copiaDaPortare: foto,
    });
    const pannello = pannelli._trova("pm_c");
    pannelli._portaLaCopia(pannello, { riprova: 0, attesa: 5 });
    assert.equal(viaggi, 1);
    /* Parte un lavoro: la copia si ferma, e non riparte finche' dura. */
    const passi = pannelli._lavoro("pm_c", "Installazione…", ["Verifica"]);
    assert.deepEqual(fermate, ["192.168.1.120"]);
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(viaggi, 1);
    assert.equal(pannello.copiaNonArrivata, undefined);
    /* Finito il lavoro, riparte da sola. */
    passi.finito();
    await new Promise((r) => setTimeout(r, 30));
    assert.equal(viaggi, 2);
    sblocchi.shift()?.({ dir: "/share/gdahome-os/x" });
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(pannello.copia, "/share/gdahome-os/x");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("l'analisi in sottofondo: «analizza» la fa partire, «rapporto» la segue fino alla fine", async () => {
  const dir = cartella();
  try {
    let lascia;
    const inst = installatoreFinto();
    inst.analisi = () => new Promise((r) => (lascia = r));
    const pannelli = new Pannelli({ cartella: dir, installatore: inst, licenze: premium });
    pannelli.archivio.dati.pannelli.push({ id: "pm_a", indirizzo: "10.0.0.1", stato: "pronto" });
    assert.equal((await pannelli.azione("pm_a", "analizza")).avviata, true);
    /* Una seconda richiesta non ne fa partire un'altra. */
    await pannelli.azione("pm_a", "analizza");
    assert.equal((await pannelli.azione("pm_a", "rapporto")).fatto, false);
    lascia("== Dispositivo ==\nNSPanel");
    await new Promise((r) => setTimeout(r, 5));
    const r = await pannelli.azione("pm_a", "rapporto");
    assert.equal(r.fatto, true);
    assert.match(r.rapporto, /NSPanel/);
    assert.match(r.rapporto, /Collegamento con la casa/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fra i telefoni collegati il pannello si chiama come qui, non col modello della scheda", async () => {
  const dir = cartella();
  try {
    const rinominati = [];
    const elenco = [{ id: "dm_s", nome: "px30_evb", rinominato: false }];
    const dispositivi = {
      elenco: () => elenco,
      rinomina: (id, nome) => {
        rinominati.push([id, nome]);
        Object.assign(
          elenco.find((d) => d.id === id),
          { nome, rinominato: true },
        );
      },
    };
    const inst = installatoreFinto();
    inst.versioniDeiPezzi = () => ({});
    inst.versioniSulPannello = async () => ({});
    inst.daAggiornare = () => [];
    const pannelli = new Pannelli({
      cartella: dir,
      installatore: inst,
      licenze: premium,
      dispositivi,
      adb: adbFinto(),
    });
    pannelli.archivio.dati.pannelli.push({
      id: "pm_s",
      indirizzo: "10.0.0.1",
      nome: "Salone",
      stato: "pronto",
      dispositivo: "dm_s",
    });
    await pannelli.controllaGliAggiornamenti({ installaDaSolo: false });
    assert.deepEqual(rinominati, [["dm_s", "Salone"]]);
    /* Gia' a posto: non si riscrive a ogni giro. */
    await pannelli.controllaGliAggiornamenti({ installaDaSolo: false });
    assert.equal(rinominati.length, 1);
    /* Rinominare il pannello rinomina anche lui. */
    pannelli.rinomina("pm_s", "Soggiorno");
    assert.deepEqual(rinominati.at(-1), ["dm_s", "Soggiorno"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("il pannello chiede alla casa di riavviarsi o dello Zigbee: solo per se stesso", async () => {
  const dir = cartella();
  try {
    const inst = installatoreFinto();
    inst.zigbee = async ({ indirizzo, attivo }) => ({ indirizzo, attivo });
    const pannelli = new Pannelli({ cartella: dir, installatore: inst, licenze: premium });
    pannelli.archivio.dati.pannelli.push({
      id: "pm_s",
      indirizzo: "10.0.0.1",
      stato: "pronto",
      dispositivo: "dm_s",
    });
    assert.deepEqual(await pannelli.dalPannello("dm_s", { cosa: "riavvia" }), { fatto: true });
    assert.deepEqual(inst.fatti, ["riavvia"]);
    assert.deepEqual(await pannelli.dalPannello("dm_s", { cosa: "zigbee", attivo: true }), {
      indirizzo: "10.0.0.1",
      attivo: true,
    });
    assert.deepEqual(await pannelli.dalPannello("dm_s", { cosa: "zigbee" }), {
      indirizzo: "10.0.0.1",
      attivo: null,
    });
    /* Un telefono non e' un pannello. */
    await assert.rejects(
      () => pannelli.dalPannello("dm_telefono", { cosa: "riavvia" }),
      /non e' un pannello/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
