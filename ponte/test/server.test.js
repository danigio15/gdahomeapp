/* Le prove delle due porte, con il ponte intero acceso.
 *
 * Qui si accende davvero tutto quanto — `alzaIlPonte` — contro una Home
 * Assistant finta, e si guarda la cosa che conta di piu' di tutto l'add-on:
 * che dalla porta esposta non si possa fabbricare un codice di abbinamento.
 * Se quella riga si rompesse, chiunque arrivi alla porta entrerebbe in casa.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { accetta } from "../src/presa.js";
import { alzaIlPonte } from "../src/index.js";
import { rotta } from "../src/server.js";

const SEGNO_DEL_SUPERVISOR = "segno-finto-del-supervisor";

async function casaFinta() {
  const prese = [];
  const server = createServer((_r, risposta) => {
    risposta.writeHead(200, { "content-type": "application/json" });
    risposta.end('{"message":"API running."}');
  });
  server.on("upgrade", (richiesta, socket) => {
    const presa = accetta(richiesta, socket, {
      onMessaggio: (testo) => {
        const detto = JSON.parse(testo);
        if (detto.type !== "auth") return;
        presa.manda(
          JSON.stringify(
            detto.access_token === SEGNO_DEL_SUPERVISOR
              ? { type: "auth_ok", ha_version: "2025.1.0" }
              : { type: "auth_invalid" },
          ),
        );
      },
    });
    if (!presa) return;
    prese.push(presa);
    presa.manda(JSON.stringify({ type: "auth_required", ha_version: "2025.1.0" }));
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    indirizzo: `http://127.0.0.1:${server.address().port}`,
    spegni: async () => {
      for (const presa of prese) presa.chiudi();
      await new Promise((ok) => server.close(ok));
    },
  };
}

async function banco() {
  const cartella = mkdtempSync(join(tmpdir(), "ponte-server-"));
  const ha = await casaFinta();
  const primaCasa = process.env.PONTE_CASA;
  const primoSegno = process.env.SUPERVISOR_TOKEN;
  process.env.PONTE_CASA = ha.indirizzo;
  process.env.SUPERVISOR_TOKEN = SEGNO_DEL_SUPERVISOR;

  const avviato = await alzaIlPonte({
    cartella,
    portaDellApp: 0,
    portaDellaConsole: 0,
    dispositiviMassimi: 3,
    minutiDelCodice: 5,
    giorniDiSilenzio: 90,
    registro: "errore",
    console: fileURLToPath(new URL("../console", import.meta.url)),
  });

  const app = `http://127.0.0.1:${avviato.app.address().port}`;
  const consolle = `http://127.0.0.1:${avviato.console.address().port}`;
  return {
    ...avviato,
    app,
    consolle,
    filo: app.replace("http", "ws"),
    spegni: async () => {
      await avviato.abbassa();
      await ha.spegni();
      rmSync(cartella, { recursive: true, force: true });
      if (primaCasa === undefined) delete process.env.PONTE_CASA;
      else process.env.PONTE_CASA = primaCasa;
      if (primoSegno === undefined) delete process.env.SUPERVISOR_TOKEN;
      else process.env.SUPERVISOR_TOKEN = primoSegno;
    },
  };
}

const prendi = (via, opzioni = {}) =>
  fetch(via, {
    ...opzioni,
    headers: { "content-type": "application/json", ...(opzioni.headers || {}) },
  });

/* ─── Il taglio del prefisso dell'ingress ────────────────────────────────── */

test("il prefisso dell'ingress si toglie, e senza prefisso non si tocca niente", () => {
  const gettone = "/api/hassio_ingress/AbCdEf123";
  assert.equal(
    rotta({ url: `${gettone}/api/stato`, headers: { "x-ingress-path": gettone } }),
    "/api/stato",
  );
  assert.equal(rotta({ url: `${gettone}/`, headers: { "x-ingress-path": gettone } }), "/");
  assert.equal(rotta({ url: gettone, headers: { "x-ingress-path": gettone } }), "/");
  assert.equal(rotta({ url: "/api/stato", headers: {} }), "/api/stato");
  assert.equal(rotta({ url: "/salute", headers: {} }), "/salute");
});

/* ─── La porta dell'app ──────────────────────────────────────────────────── */

test("la porta dell'app dice solo se e' viva", async () => {
  const b = await banco();
  try {
    const risposta = await prendi(`${b.app}/salute`);
    assert.equal(risposta.status, 200);
    const detto = await risposta.json();
    assert.equal(detto.vivo, true);
    assert.equal(detto.dispositivi, 0);
  } finally {
    await b.spegni();
  }
});

test("dalla porta dell'app non si fabbrica un codice, e non si vede niente della console", async () => {
  const b = await banco();
  try {
    for (const [metodo, via] of [
      ["POST", "/api/codice"],
      ["GET", "/api/stato"],
      ["GET", "/api/dispositivi"],
      ["GET", "/"],
      ["GET", "/index.html"],
      ["DELETE", "/api/dispositivi/dm_qualunque"],
    ]) {
      const risposta = await prendi(`${b.app}${via}`, { method: metodo });
      assert.equal(risposta.status, 404, `${metodo} ${via} non deve esistere sulla porta dell'app`);
    }
    assert.equal(b.abbinamento.stato().attivo, false);
  } finally {
    await b.spegni();
  }
});

test("il codice della console abbina il telefono, e vale una volta sola", async () => {
  const b = await banco();
  try {
    const { codice } = await (await prendi(`${b.consolle}/api/codice`, { method: "POST" })).json();
    assert.match(codice, /^[0-9A-Z]{8}$/);

    const risposta = await prendi(`${b.app}/abbinamento`, {
      method: "POST",
      body: JSON.stringify({ codice, nome: "iPhone di Anna", sistema: "ios" }),
    });
    assert.equal(risposta.status, 201);
    const fatto = await risposta.json();
    assert.match(fatto.segno, /^[0-9a-f]{64}$/);
    assert.equal(fatto.dispositivo.nome, "iPhone di Anna");

    const seconda = await prendi(`${b.app}/abbinamento`, {
      method: "POST",
      body: JSON.stringify({ codice, nome: "un altro" }),
    });
    assert.equal(seconda.status, 403);
    assert.equal(b.dispositivi.quanti(), 1);
  } finally {
    await b.spegni();
  }
});

test("un codice sbagliato non abbina, e dopo dieci tentativi la porta si chiude", async () => {
  const b = await banco();
  try {
    await prendi(`${b.consolle}/api/codice`, { method: "POST" });
    for (let i = 0; i < 10; i += 1) {
      const risposta = await prendi(`${b.app}/abbinamento`, {
        method: "POST",
        body: JSON.stringify({ codice: "SBAGLIA2" }),
      });
      assert.equal(risposta.status, 403);
    }
    const undicesima = await prendi(`${b.app}/abbinamento`, {
      method: "POST",
      body: JSON.stringify({ codice: "SBAGLIA2" }),
    });
    assert.equal(undicesima.status, 429);
    assert.equal(b.dispositivi.quanti(), 0);
  } finally {
    await b.spegni();
  }
});

test("un corpo che non e' JSON, o troppo grande, non passa", async () => {
  const b = await banco();
  try {
    const storto = await prendi(`${b.app}/abbinamento`, { method: "POST", body: "non json" });
    assert.equal(storto.status, 400);
    const enorme = await prendi(`${b.app}/abbinamento`, {
      method: "POST",
      body: JSON.stringify({ codice: "A".repeat(10_000) }),
    });
    assert.equal(enorme.status, 400);
  } finally {
    await b.spegni();
  }
});

test("oltre il numero massimo la console non fabbrica piu' codici", async () => {
  const b = await banco();
  try {
    for (let i = 0; i < 3; i += 1) {
      const { codice } = await (
        await prendi(`${b.consolle}/api/codice`, { method: "POST" })
      ).json();
      const risposta = await prendi(`${b.app}/abbinamento`, {
        method: "POST",
        body: JSON.stringify({ codice, nome: `telefono ${i}` }),
      });
      assert.equal(risposta.status, 201);
    }
    const troppi = await prendi(`${b.consolle}/api/codice`, { method: "POST" });
    assert.equal(troppi.status, 409);
  } finally {
    await b.spegni();
  }
});

/* ─── Dal codice al filo, tutto di seguito ───────────────────────────────── */

test("abbinato dalla console, il telefono entra dal filo e parla con la casa", async () => {
  const b = await banco();
  try {
    const { codice } = await (await prendi(`${b.consolle}/api/codice`, { method: "POST" })).json();
    const { segno } = await (
      await prendi(`${b.app}/abbinamento`, {
        method: "POST",
        body: JSON.stringify({ codice, nome: "Pixel", sistema: "android" }),
      })
    ).json();

    const presa = new WebSocket(`${b.filo}/casa`);
    const detti = [];
    presa.addEventListener("message", (evento) => detti.push(JSON.parse(evento.data)));
    await new Promise((ok, no) => {
      presa.addEventListener("open", ok);
      presa.addEventListener("error", () => no(new Error("non entra")));
    });
    await attendi(() => detti.some((uno) => uno.type === "auth_required"));
    presa.send(JSON.stringify({ type: "auth", access_token: segno }));
    await attendi(() => detti.some((uno) => uno.type === "auth_ok"));

    const stato = await (await prendi(`${b.consolle}/api/stato`)).json();
    assert.equal(stato.dispositivi[0].collegati, 1);
    assert.equal(stato.casa.viva, true);
    presa.close();
  } finally {
    await b.spegni();
  }
});

test("una salita su una via che non e' /casa non diventa un filo", async () => {
  const b = await banco();
  try {
    const presa = new WebSocket(`${b.filo}/altrove`);
    const finita = await new Promise((ok) => {
      presa.addEventListener("error", () => ok("errore"));
      presa.addEventListener("close", () => ok("chiusa"));
      presa.addEventListener("open", () => ok("aperta"));
    });
    assert.notEqual(finita, "aperta");
  } finally {
    await b.spegni();
  }
});

/* ─── La console ─────────────────────────────────────────────────────────── */

test("la console serve la sua pagina e non esce dalla sua cartella", async () => {
  const b = await banco();
  try {
    const pagina = await prendi(`${b.consolle}/`);
    assert.equal(pagina.status, 200);
    assert.match(await pagina.text(), /Il ponte/);

    const fuori = mkdtempSync(join(tmpdir(), "fuori-"));
    writeFileSync(join(fuori, "segreto.txt"), "questo non si deve leggere", "utf8");
    try {
      for (const tentativo of [
        "/../../etc/passwd",
        "/..%2f..%2fetc%2fpasswd",
        `/../${fuori.split("/").pop()}/segreto.txt`,
      ]) {
        const risposta = await prendi(`${b.consolle}${tentativo}`);
        assert.notEqual(risposta.status, 200, `${tentativo} non deve leggersi`);
      }
    } finally {
      rmSync(fuori, { recursive: true, force: true });
    }
  } finally {
    await b.spegni();
  }
});

test("la console stacca un telefono e ne butta giu' il filo", async () => {
  const b = await banco();
  try {
    const { codice } = await (await prendi(`${b.consolle}/api/codice`, { method: "POST" })).json();
    const { segno, dispositivo } = await (
      await prendi(`${b.app}/abbinamento`, {
        method: "POST",
        body: JSON.stringify({ codice, nome: "via" }),
      })
    ).json();

    const presa = new WebSocket(`${b.filo}/casa`);
    const detti = [];
    presa.addEventListener("message", (evento) => detti.push(JSON.parse(evento.data)));
    const chiusa = new Promise((ok) => presa.addEventListener("close", ok));
    await new Promise((ok) => presa.addEventListener("open", ok));
    await attendi(() => detti.some((uno) => uno.type === "auth_required"));
    presa.send(JSON.stringify({ type: "auth", access_token: segno }));
    await attendi(() => detti.some((uno) => uno.type === "auth_ok"));

    const staccato = await prendi(`${b.consolle}/api/dispositivi/${dispositivo.id}`, {
      method: "DELETE",
    });
    assert.equal(staccato.status, 200);
    assert.equal((await staccato.json()).filiChiusi, 1);
    await chiusa;

    /* E con quel segno non si rientra. */
    const riprova = new WebSocket(`${b.filo}/casa`);
    const ridetti = [];
    riprova.addEventListener("message", (evento) => ridetti.push(JSON.parse(evento.data)));
    await new Promise((ok) => riprova.addEventListener("open", ok));
    await attendi(() => ridetti.some((uno) => uno.type === "auth_required"));
    riprova.send(JSON.stringify({ type: "auth", access_token: segno }));
    await attendi(() => ridetti.some((uno) => uno.type === "auth_invalid"));
    riprova.close();
  } finally {
    await b.spegni();
  }
});

test("la console rinomina, e annulla un codice", async () => {
  const b = await banco();
  try {
    const { codice } = await (await prendi(`${b.consolle}/api/codice`, { method: "POST" })).json();
    const { dispositivo } = await (
      await prendi(`${b.app}/abbinamento`, {
        method: "POST",
        body: JSON.stringify({ codice, nome: "prima" }),
      })
    ).json();

    const rinominato = await prendi(`${b.consolle}/api/dispositivi/${dispositivo.id}`, {
      method: "PATCH",
      body: JSON.stringify({ nome: "dopo" }),
    });
    assert.equal(rinominato.status, 200);
    assert.equal(b.dispositivi.elenco()[0].nome, "dopo");

    await prendi(`${b.consolle}/api/codice`, { method: "POST" });
    const annullato = await prendi(`${b.consolle}/api/codice`, { method: "DELETE" });
    assert.equal((await annullato.json()).annullato, true);
    assert.equal(b.abbinamento.stato().attivo, false);
  } finally {
    await b.spegni();
  }
});

test("una via che non esiste sulla console risponde 404, non 500", async () => {
  const b = await banco();
  try {
    assert.equal((await prendi(`${b.consolle}/api/inventata`)).status, 404);
    assert.equal(
      (await prendi(`${b.consolle}/api/dispositivi/dm_nonesiste`, { method: "DELETE" })).status,
      404,
    );
  } finally {
    await b.spegni();
  }
});

/* ─── Attese ─────────────────────────────────────────────────────────────── */

const nuovoGiro = (millesimi = 5) => new Promise((ok) => setTimeout(ok, millesimi));

async function attendi(condizione, entro = 5000) {
  const fine = Date.now() + entro;
  while (Date.now() < fine) {
    const risultato = condizione();
    if (risultato) return risultato;
    await nuovoGiro();
  }
  throw new Error("l'attesa e' scaduta");
}
