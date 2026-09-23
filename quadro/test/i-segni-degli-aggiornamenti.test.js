/* L'icona vera di un aggiornamento, e le sue note intere.
 *
 * Il giro, per intero: la casa manda i byte dentro il rapporto, il quadro li
 * tiene, e li serve dal **suo** indirizzo. Il browser di chi installa non va
 * piu' a farsi vedere su `brands.home-assistant.io`, e quello che vede e'
 * l'icona giusta invece del logo di HACS.
 *
 * Quello che si prova davvero e' la parte che costa: **un'icona viaggia una
 * volta sola**. Il quadro dice quali segni non ha, la casa manda quelli e
 * nessun altro. Senza, sarebbe qualche megabyte al giorno per casa per roba
 * che non cambia mai — e chi rompe quella riga non se ne accorge guardando lo
 * schermo, perche' a schermo funziona uguale.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { alzaIlQuadro } from "../src/index.js";
import { ilSegnoDi } from "../../ponte/src/segni.js";

const CHIAVE_DEL_GESTORE = "una-chiave-lunga-abbastanza-per-il-gestore";
const UNA = "casa_a3f19c74e05b2d8890fa4c1e6b73d052";
const ALTRA = "casa_71cd3a6e884b09f25de4a1c7b3608e14";

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 7),
]);

const SEGNO = ilSegnoDi("Mosquitto broker", "6.5.1");

const rapporto = (piu = {}) => ({
  quando: new Date().toISOString(),
  ogni: 1,
  ponte: "1.5.9.4",
  aggiornamenti: {
    quanti: 1,
    ha: false,
    gdahome: false,
    addon: 1,
    firmware: 0,
    elenco: [
      {
        nome: "Mosquitto broker",
        da: "6.4.0",
        a: "6.5.1",
        nostra: false,
        installabile: true,
        segno: SEGNO,
        ...piu,
      },
    ],
  },
});

async function banco() {
  const cartella = mkdtempSync(join(tmpdir(), "segni-"));
  const acceso = await alzaIlQuadro({
    porta: 0,
    cartella,
    livello: "errore",
    chiaveDelGestore: CHIAVE_DEL_GESTORE,
  });
  const dove = `http://127.0.0.1:${acceso.porta}`;
  const gestore = (via, opzioni = {}) =>
    fetch(`${dove}/gestore${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${CHIAVE_DEL_GESTORE}`,
        "content-type": "application/json",
        ...(opzioni.headers || {}),
      },
    });
  const suo = await (
    await gestore("/installatori", {
      method: "POST",
      body: JSON.stringify({ nome: "Impianti Rossi" }),
    })
  ).json();
  const retro = (via, opzioni = {}) =>
    fetch(`${dove}/console${via}`, {
      ...opzioni,
      headers: {
        authorization: `Bearer ${suo.chiave}`,
        "content-type": "application/json",
        ...(opzioni.headers || {}),
      },
    });
  const unCodice = async (per = "") =>
    (await (await retro("/inviti", { method: "POST", body: JSON.stringify({ per }) })).json())
      .codice;
  return {
    ...acceso,
    dove,
    /* L'installatore: le icone stanno nella sua cartella, e l'indirizzo lo
     * porta davanti (`/segno/<inst_…>/<segno>`). */
    chi: suo.chi,
    retro,
    gestore,
    unCodice,
    deposita: (casa, chiave, carta) =>
      fetch(`${dove}/rapporto`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${chiave}`,
          "content-type": "application/json",
          "x-casa": casa,
        },
        body: JSON.stringify(carta),
      }),
    chiudi: async () => {
      await acceso.spegni();
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

test("il quadro dice cosa gli manca, e poi non lo richiede piu'", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice("Rossi");

    /* Primo rapporto: il segno c'e', l'icona no. Il quadro la chiede. */
    const primo = await (await b.deposita(UNA, codice, rapporto())).json();
    assert.deepEqual(primo.manca, [SEGNO]);

    /* La casa la manda. */
    const secondo = await (
      await b.deposita(
        UNA,
        codice,
        rapporto({
          logo: PNG.toString("base64"),
          logoTipo: "image/png",
          leNote: "## 6.5.1\nRoba.",
        }),
      )
    ).json();
    assert.equal(secondo.manca, undefined, "la richiede ancora, e viaggerebbe per sempre");

    /* E da li' in poi non la chiede piu'. */
    const terzo = await (await b.deposita(UNA, codice, rapporto())).json();
    assert.equal(terzo.manca, undefined);
  } finally {
    await b.chiudi();
  }
});

test("l'icona si serve dall'indirizzo del quadro, e senza chiave", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice("Rossi");
    await b.deposita(
      UNA,
      codice,
      rapporto({ logo: PNG.toString("base64"), logoTipo: "image/png" }),
    );

    /* Senza chiave: quel disegno deve arrivare nel browser di chi installa, e
     * sedici cifre esadecimali non si indovinano. */
    const presa = await fetch(`${b.dove}/segno/${b.chi}/${SEGNO}`);
    assert.equal(presa.status, 200);
    assert.equal(presa.headers.get("content-type"), "image/png");
    assert.equal(presa.headers.get("x-content-type-options"), "nosniff");
    assert.ok(presa.headers.get("content-security-policy")?.includes("sandbox"));
    assert.deepEqual(Buffer.from(await presa.arrayBuffer()), PNG);

    /* Un segno che non c'e' e' un 404, non un mezzo disegno. */
    assert.equal((await fetch(`${b.dove}/segno/${b.chi}/${"0".repeat(16)}`)).status, 404);
    assert.equal((await fetch(`${b.dove}/segno/${b.chi}/non-un-segno`)).status, 404);
  } finally {
    await b.chiudi();
  }
});

test("quello che non e' un'immagine non diventa un'immagine", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice("Rossi");
    /* Il controllo lo fa gia' la casa. Rifarlo qui non e' diffidenza verso
     * quella casa: fra le due macchine c'e' una rete, e un controllo da una
     * parte sola non e' un controllo. */
    await b.deposita(
      UNA,
      codice,
      rapporto({ logo: Buffer.from("<html>ciao</html>").toString("base64") }),
    );
    assert.equal((await fetch(`${b.dove}/segno/${b.chi}/${SEGNO}`)).status, 404);
    /* E siccome non l'ha presa, la richiede: non si segna «arrivata». */
    const dopo = await (await b.deposita(UNA, codice, rapporto())).json();
    assert.deepEqual(dopo.manca, [SEGNO]);
  } finally {
    await b.chiudi();
  }
});

test("due case che aspettano lo stesso aggiornamento ne fanno una copia sola", async () => {
  /* E' il motivo per cui il segno viene dal nome e dalla versione e non dalla
   * casa: quaranta case con lo stesso Mosquitto da aggiornare tengono qui
   * un'icona, non quaranta. */
  const b = await banco();
  try {
    const una = await b.unCodice("Rossi");
    const altra = await b.unCodice("Bianchi");
    /* `senzaNote` perche' un segno e' finito quando si sa di tutt'e due le
     * meta': l'icona c'e', e di note non ce ne sono. Senza quel «non ce ne
     * sono» il quadro le richiederebbe per sempre. */
    await b.deposita(UNA, una, rapporto({ logo: PNG.toString("base64"), senzaNote: true }));
    /* La seconda casa non se la sente nemmeno chiedere. */
    const detto = await (await b.deposita(ALTRA, altra, rapporto())).json();
    assert.equal(detto.manca, undefined);
  } finally {
    await b.chiudi();
  }
});

test("le note intere si leggono dal cruscotto, con la chiave", async () => {
  const b = await banco();
  try {
    const codice = await b.unCodice("Rossi");
    await b.deposita(
      UNA,
      codice,
      rapporto({ leNote: "## 6.5.1\n\n- una cosa\n- un'altra", senzaLogo: true }),
    );

    /* La pagina sa quali aggiornamenti hanno qualcosa da aprire. */
    const sue = await (await b.retro("/case")).json();
    assert.deepEqual(sue.note, [SEGNO]);

    const dette = await (await b.retro(`/note/${SEGNO}`)).json();
    assert.match(dette.note, /una cosa/);

    /* Un CHANGELOG e' testo che qualcuno ha scritto, e vuole la chiave: non e'
     * un disegno come l'icona. */
    assert.equal((await fetch(`${b.dove}/console/note/${SEGNO}`)).status, 401);
    assert.equal((await b.retro(`/note/${"0".repeat(16)}`)).status, 404);
  } finally {
    await b.chiudi();
  }
});

test("chi tiene il quadro legge le stesse note, con la chiave della gestione", async () => {
  /* Le note le ha prese la casa da Home Assistant e le tiene il quadro: chi
   * lo tiene le legge dalla sua porta, uguali. Senza chiave restano chiuse,
   * come dal cruscotto — e' testo che qualcuno ha scritto. */
  const b = await banco();
  try {
    const codice = await b.unCodice("Rossi");
    await b.deposita(
      UNA,
      codice,
      rapporto({ leNote: "## 6.5.1\n\n- una cosa\n- un'altra", senzaLogo: true }),
    );
    const dette = await (await b.gestore(`/installatore/${b.chi}/note/${SEGNO}`)).json();
    assert.match(dette.note, /una cosa/);
    assert.equal(
      (await fetch(`${b.dove}/gestore/installatore/${b.chi}/note/${SEGNO}`)).status,
      401,
    );
    assert.equal((await b.gestore(`/installatore/${b.chi}/note/${"0".repeat(16)}`)).status, 404);
  } finally {
    await b.chiudi();
  }
});

test("l'entita' di una casa non passa di qui", async () => {
  /* Il segno e' un'impronta di quello che nel rapporto c'e' gia' — il nome e
   * la versione — e non aggiunge niente a quello che il quadro sa. Se un
   * giorno ci finisse dentro l'entita', sarebbe `update.camera_di_marco`: chi
   * ci abita, e in quale stanza. */
  assert.equal(ilSegnoDi("Mosquitto broker", "6.5.1"), SEGNO);
  assert.notEqual(ilSegnoDi("Mosquitto broker", "6.5.2"), SEGNO);
  assert.match(SEGNO, /^[0-9a-f]{16}$/);
});

/* ─── Le prove che mancavano ──────────────────────────────────────────────
 *
 * Tutto quello che sta qui sopra passava anche quando la faccenda, in casa di
 * un cliente vero, non funzionava per niente: le prove fabbricavano il
 * rapporto a mano, col segno gia' dentro, e provavano il quadro contro un
 * rapporto che il ponte non ha mai saputo scrivere. Il ponte il segno non lo
 * metteva proprio — `iConti` lo prendeva come terzo argomento e la sua firma
 * ne dichiarava due — e quindi il quadro non ne vedeva mai uno, non ne
 * chiedeva mai uno, e un'icona non arrivava mai.
 *
 * Una prova che si fabbrica da se' quello che dovrebbe verificare non
 * verifica niente. Queste partono da `fabbricaIlRapporto`, cioe' da quello che
 * la casa manda davvero.
 */

test("il rapporto che scrive la casa porta il segno di ogni aggiornamento", async () => {
  const { fabbricaIlRapporto } = await import("../../ponte/src/rapporto.js");
  /* Torna **una funzione**: il postino la chiama a ogni giro, cosi' ogni
   * rapporto e' di adesso e non di quando il ponte si e' acceso. */
  const scrivi = fabbricaIlRapporto({
    identita: { casa: UNA },
    aggiornamenti: {
      async elenco() {
        return [
          {
            entita: "update.mosquitto_broker",
            nome: "Mosquitto broker",
            da: "6.4.0",
            a: "6.5.1",
            installabile: true,
          },
        ];
      },
      async marchioDi() {
        return "mosquitto";
      },
    },
    adesso: () => Date.now(),
  });
  const carta = await scrivi();
  const riga = carta.aggiornamenti.elenco[0];
  assert.equal(riga.segno, SEGNO, "senza il segno il quadro non chiede niente, e basta");
  /* E l'entita' no: quella direbbe chi ci abita e in quale stanza. */
  assert.equal(JSON.stringify(carta).includes("update.mosquitto_broker"), false);
});

test("una casa non puo' avvelenare l'icona che vedono gli altri installatori", async () => {
  /* Un segno e' `sha256(nome + versione)` di roba pubblica: chi sa che esiste
   * «Mosquitto broker 6.5.1» sa anche che segno fa. E la cartella e' una sola
   * per tutti, e chi scrive per primo vince.
   *
   * Quindi una casa qualunque poteva mandare il segno di un aggiornamento che
   * non ha, con dentro l'immagine e le note che voleva, e quella roba sarebbe
   * comparsa nella pagina di tutti gli altri installatori sotto il nome di
   * un'applicazione vera. */
  const b = await banco();
  try {
    const codice = await b.unCodice("Rossi");
    /* La riga dice di essere un'altra cosa, il segno dice Mosquitto. */
    await b.deposita(UNA, codice, {
      quando: new Date().toISOString(),
      ogni: 1,
      aggiornamenti: {
        quanti: 1,
        elenco: [
          {
            nome: "Una cosa che non c'entra niente",
            da: "1.0.0",
            a: "1.0.1",
            segno: SEGNO,
            logo: PNG.toString("base64"),
            leNote: "AVVELENATO",
          },
        ],
      },
    });
    /* Niente si e' scritto sotto il segno di Mosquitto. */
    assert.equal((await fetch(`${b.dove}/segno/${b.chi}/${SEGNO}`)).status, 404);
    const dette = await b.retro(`/note/${SEGNO}`);
    assert.equal(dette.status, 404, "le note avvelenate si leggono");
  } finally {
    await b.chiudi();
  }
});

test("se arriva solo una delle due meta', l'altra si richiede", async () => {
  /* C'era un `||`: bastava una delle due per dire «ce l'ho tutto». Arrivavano
   * le note e l'icona no — succede, e' uno scarico che va storto — e da quel
   * momento il segno risultava completo: quell'icona non sarebbe arrivata mai
   * piu'. */
  const b = await banco();
  try {
    const codice = await b.unCodice("Rossi");
    await b.deposita(UNA, codice, rapporto({ leNote: "## 6.5.1\nRoba." }));
    const dopo = await (await b.deposita(UNA, codice, rapporto())).json();
    assert.deepEqual(dopo.manca, [SEGNO], "l'icona non si richiede piu', e non arrivera' mai");

    /* E adesso arriva. */
    await b.deposita(UNA, codice, rapporto({ logo: PNG.toString("base64") }));
    const finito = await (await b.deposita(UNA, codice, rapporto())).json();
    assert.equal(finito.manca, undefined);
  } finally {
    await b.chiudi();
  }
});

test("«questa icona non esiste» si dice una volta, e non si richiede piu'", async () => {
  /* Un firmware un'icona non ce l'ha da nessuna parte. Senza un modo di dirlo,
   * il quadro la richiederebbe a ogni rapporto per sempre — e con un `&&` al
   * posto del `||` sarebbe stato esattamente questo il guasto nuovo. */
  const b = await banco();
  try {
    const codice = await b.unCodice("Rossi");
    const detto = await (
      await b.deposita(UNA, codice, rapporto({ senzaLogo: true, senzaNote: true }))
    ).json();
    assert.equal(detto.manca, undefined);
    const dopo = await (await b.deposita(UNA, codice, rapporto())).json();
    assert.equal(dopo.manca, undefined, "richiede per sempre una cosa che non c'e'");
    /* E resta un 404: «non esiste» non e' un'immagine vuota. */
    assert.equal((await fetch(`${b.dove}/segno/${b.chi}/${SEGNO}`)).status, 404);
  } finally {
    await b.chiudi();
  }
});

test("quello che la casa e' disposta a mandare ci sta in quello che il quadro accetta", async () => {
  /* I due numeri stanno in due file di due macchine diverse, e non si vedono
   * fra loro. Se il tetto di la' e' piu' alto di quello di qua non salta
   * l'icona: salta **tutto il rapporto**, con un 413. E siccome la casa si
   * tiene l'elenco di quello che le e' stato chiesto, al minuto dopo rimanda
   * lo stesso pacco e si ribecca lo stesso 413. Quella casa smette di dire
   * come sta, per sempre, per un'icona.
   *
   * Era esattamente cosi': 64 KiB accettati qui, 192 KiB di byte veri
   * mandati di la' — che in base64 fanno 256. Bastava un'icona sola. */
  const { IN_TUTTO_AL_MASSIMO } = await import("../../ponte/src/segni.js");
  const laCasa = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  const ilQuadro = Number(/RAPPORTO_MASSIMA = (\d+) \* 1024/.exec(laCasa)?.[1]) * 1024;
  assert.ok(ilQuadro > 0, "il tetto del rapporto non si legge piu'");
  /* Con l'aria per il rapporto vero, che sotto i quattro KiB ci sta comodo ma
   * con quaranta aggiornamenti in elenco cresce. */
  assert.ok(
    ilQuadro >= IN_TUTTO_AL_MASSIMO * 2,
    `il quadro accetta ${ilQuadro} e la casa manda fino a ${IN_TUTTO_AL_MASSIMO}: non ci sta`,
  );
});

test("un rapporto pieno di icone fino al tetto della casa non si becca un 413", async () => {
  /* La stessa cosa provata invece che calcolata: si riempie fino a quanto la
   * casa e' disposta a mandare, e deve passare. */
  const { IN_TUTTO_AL_MASSIMO } = await import("../../ponte/src/segni.js");
  const b = await banco();
  try {
    const codice = await b.unCodice("Rossi");
    const grossa = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(18 * 1024, 3),
    ]);
    const inBase64 = grossa.toString("base64");
    const quante = Math.floor(IN_TUTTO_AL_MASSIMO / inBase64.length);
    assert.ok(quante >= 2, "il tetto non basta nemmeno per due icone");
    const elenco = [];
    for (let i = 0; i < quante; i += 1) {
      elenco.push({
        nome: `Applicazione ${i}`,
        da: "1.0.0",
        a: "2.0.0",
        installabile: true,
        logo: inBase64,
        senzaNote: true,
      });
    }
    const risposta = await b.deposita(UNA, codice, {
      quando: new Date().toISOString(),
      ogni: 1,
      aggiornamenti: { quanti: elenco.length, elenco },
    });
    assert.notEqual(risposta.status, 413, "il rapporto e' troppo grosso e la casa si spegne");
    assert.equal(risposta.status, 200);
    /* E le icone ci sono davvero. */
    const suo = ilSegnoDi("Applicazione 0", "2.0.0");
    assert.equal((await fetch(`${b.dove}/segno/${b.chi}/${suo}`)).status, 200);
  } finally {
    await b.chiudi();
  }
});

test("la potatura butta quello che non serve piu', non quello che serve adesso", async () => {
  /* Prima l'ordine era alfabetico, che essendo impronte sembrava caso puro. Ma
   * il caso, se e' sempre lo stesso, e' una regola: un segno che casca oltre
   * il taglio ci casca tutte le volte. Arriva, si salva, si butta; il rapporto
   * dopo lo ritrova mancante, lo richiede, la casa lo rimanda, si salva, si
   * butta. Ogni minuto, per sempre. */
  const { Segni, QUANTI_SE_NE_TENGONO } = await import("../src/segni.js");
  const cartella = mkdtempSync(join(tmpdir(), "potatura-"));
  try {
    let quando = 1_000_000;
    const segni = new Segni({ cartella, adesso: () => quando });
    /* `senzaNote` perche' di un segno contano tutt'e due le meta': senza,
     * risulterebbero mancanti per le note e questa prova non direbbe niente
     * sulla potatura. */
    const riga = (n) => ({
      nome: `App ${n}`,
      a: "1.0.0",
      logo: PNG.toString("base64"),
      senzaNote: true,
    });
    /* Se ne mettono piu' del tetto, uno per volta e con l'orologio che cammina. */
    for (let i = 0; i < QUANTI_SE_NE_TENGONO + 20; i += 1) {
      quando += 1000;
      segni.metti([riga(i)]);
    }
    /* Adesso una casa nomina di nuovo i primi dieci: sono i piu' vecchi, e
     * senza il rinfresco sarebbero i primi a andarsene. */
    const iPrimi = [];
    for (let i = 0; i < 10; i += 1) iPrimi.push(riga(i));
    quando += 1000;
    segni.metti(iPrimi);
    /* E poi ne arrivano altri dieci nuovi, che fanno scattare la potatura. */
    for (let i = 0; i < 10; i += 1) {
      quando += 1000;
      segni.metti([riga(QUANTI_SE_NE_TENGONO + 100 + i)]);
    }
    /* Quelli di cui si e' appena parlato ci devono essere ancora: se no la
     * casa li rimanderebbe al giro dopo, e al giro dopo ancora, per sempre. */
    assert.deepEqual(
      segni.quelliCheMancano(iPrimi),
      [],
      "li richiede, e da qui in poi li richiede per sempre",
    );
    /* E il tetto vale lo stesso: qualcosa se n'e' andato davvero. */
    const vecchi = [];
    for (let i = 10; i < 30; i += 1) vecchi.push(riga(i));
    assert.ok(
      segni.quelliCheMancano(vecchi).length > 0,
      "non ha buttato niente: il tetto non tiene",
    );
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("le due copie di «come si fa un segno» dicono la stessa cosa", async () => {
  /* Ce ne sono due, una per macchina: `ponte/src/segni.js` e
   * `quadro/src/segni.js`. Quattro righe copiate sono meglio di un pacchetto
   * condiviso fra due macchine che si aggiornano in momenti diversi — ma due
   * copie si scollano, e il giorno che si scollano succede questo: la casa
   * manda un'icona sotto un segno, il quadro la cerca sotto un altro, e non
   * arriva niente. Senza che niente si rompa in modo visibile.
   *
   * Qui si confrontano, e si pianta un valore noto: se cambia **il modo**, non
   * basta cambiarlo di qua. */
  const dellaCasa = ilSegnoDi;
  const { ilSegnoDi: delQuadro } = await import("../src/segni.js");
  for (const [nome, a] of [
    ["Mosquitto broker", "6.5.1"],
    ["Home Assistant Core", "2026.9.1"],
    ["  spazi  intorno  ", " 1.0 "],
    ["", ""],
    ["solo il nome", ""],
  ]) {
    assert.equal(delQuadro(nome, a), dellaCasa(nome, a), `«${nome}» / «${a}» non combaciano`);
  }
  /* E il valore, piantato: cambiarlo vuol dire che tutte le icone gia' in giro
   * non si ritrovano piu'. */
  assert.equal(delQuadro("Mosquitto broker", "6.5.1"), "e574160d1c8dc4e2");
  /* Il nome da solo non basta: due versioni della stessa cosa sono due segni,
   * se no l'icona di ieri resterebbe attaccata a quella di domani. */
  assert.notEqual(delQuadro("Mosquitto broker", "6.5.2"), delQuadro("Mosquitto broker", "6.5.1"));
});

test("un «quell'icona non esiste» scade, e uno vecchio senza data vale come scaduto", async () => {
  /* Il no e' la risposta che nessuno rimette mai in discussione, ed e'
   * esattamente per questo che va rimessa in discussione ogni tanto.
   *
   * Il ponte per un pezzo ha detto «non esiste» a ogni icona che stesse
   * dentro Home Assistant — il Core, il sistema operativo, Frigate, il
   * firmware del minipc — e qui quel no si scriveva per sempre. Sistemare il
   * ponte non sarebbe bastato: la cartella se li era gia' segnati. */
  const { Segni, UN_NO_DURA } = await import("../src/segni.js");
  const { writeFileSync } = await import("node:fs");
  const cartella = mkdtempSync(join(tmpdir(), "un-no-"));
  try {
    let quando = 1_000_000_000;
    const segni = new Segni({ cartella, adesso: () => quando });
    const riga = { nome: "Frigate", a: "0.14.1", senzaLogo: true, senzaNote: true };
    const quale = ilSegnoDi(riga.nome, riga.a);

    segni.metti([riga]);
    assert.deepEqual(segni.quelliCheMancano([riga]), [], "appena detto, non si richiede");

    /* Un'ora dopo vale ancora: richiederlo ogni minuto sarebbe il giro che il
     * no serve a evitare. */
    quando += 60 * 60 * 1000;
    assert.deepEqual(segni.quelliCheMancano([riga]), [], "dopo un'ora vale ancora");

    /* Passato il tempo si richiede una volta: se il no e' vero torna uguale. */
    quando += UN_NO_DURA;
    assert.deepEqual(segni.quelliCheMancano([riga]), [quale], "scaduto, si richiede");

    /* E la casa lo ridice: da li' riparte il conto, non si richiede piu'. */
    segni.metti([riga]);
    assert.deepEqual(segni.quelliCheMancano([riga]), [], "ridetto, riparte il conto");

    /* Un no scritto com'erano scritti prima — un file vuoto — non ha data, e
     * senza data non c'e' niente da credere: si richiede. */
    writeFileSync(join(segni.cartella, `${quale}.senza-logo`), "");
    assert.deepEqual(segni.quelliCheMancano([riga]), [quale], "quello vecchio si richiede");
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});

test("nominare un segno non allunga la vita al suo «non esiste»", async () => {
  /* La data del file la rinfresca `_visto` a ogni rapporto che nomina quel
   * segno — serve alla potatura, che deve buttare quello che nessuno chiede
   * piu'. Se il no si fidasse di quella, un aggiornamento che una casa ha
   * sempre in elenco non scadrebbe mai: il no piu' sbagliato, quello che
   * nessuno rimette in discussione, sarebbe anche quello piu' difficile da
   * togliere. Percio' la data sta dentro il file. */
  const { Segni, UN_NO_DURA } = await import("../src/segni.js");
  const cartella = mkdtempSync(join(tmpdir(), "un-no-visto-"));
  try {
    let quando = 1_000_000_000;
    const segni = new Segni({ cartella, adesso: () => quando });
    const riga = { nome: "Frigate", a: "0.14.1", senzaLogo: true, senzaNote: true };
    const quale = ilSegnoDi(riga.nome, riga.a);
    segni.metti([riga]);
    /* Il rapporto arriva ogni minuto e lo nomina sempre. */
    for (let i = 0; i < 200; i += 1) {
      quando += 60 * 1000;
      segni.metti([{ nome: riga.nome, a: riga.a }]);
    }
    assert.ok(quando - 1_000_000_000 > UN_NO_DURA, "il tempo e' passato davvero");
    assert.deepEqual(segni.quelliCheMancano([riga]), [quale], "scaduto lo stesso");
  } finally {
    rmSync(cartella, { recursive: true, force: true });
  }
});
