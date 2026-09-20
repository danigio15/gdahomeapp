/* Le vesti delle plance: come chi installa da' un nome a ogni plancia.
 *
 * Dal cruscotto, per ogni plancia di una casa, l'installatore sceglie due
 * nomi: il **titolo**, che va nel menu laterale di Home Assistant e in cima
 * alla home, e la parola del **velo**, quella che compare col suo logo mentre
 * la pagina si apre. Il quadro le manda nella risposta al rapporto, plancia
 * per plancia; il ponte le tiene, le scrive su disco e le mette dove vanno.
 *
 * Quello che si tiene qui, in ordine di importanza:
 *
 *  1. che un nome arrivato dal quadro **non porti dentro dell'HTML**: finisce
 *     in una pagina e dentro uno `<script>`;
 *  2. che le vesti sopravvivano a un riavvio, e spariscano quando il quadro
 *     non le manda piu';
 *  3. che il runtime — un file solo per tutte le plance, in cache per un
 *     anno — lasci scegliere la parola alla pagina, e resti JavaScript buono;
 *  4. che il rapporto porti profilo e titolo di ogni plancia, e niente altro
 *     di quello che hanno dentro.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Installatore, vestiPulite } from "../src/installatore.js";
import { IL_VELO_SI_RIVESTE, laPagina, vestiDiGdahome } from "../src/marchio.js";
import { conLePremesse, leVesti } from "../src/premesse.js";
import { Plancia } from "../src/plancia.js";
import { fabbricaIlRapporto } from "../src/rapporto.js";

const ZITTO = { debug() {}, info() {}, attenzione() {}, errore() {} };
const CHI = "inst_0123456789abcdef";
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);

function unPosto() {
  const cartella = mkdtempSync(join(tmpdir(), "vesti-"));
  return { cartella, via: () => rmSync(cartella, { recursive: true, force: true }) };
}

const unInstallatore = (cartella) =>
  new Installatore({
    cartella,
    quadro: "https://quadro.invalid",
    registro: ZITTO,
    prendi: async () => ({ ok: true, status: 200, arrayBuffer: async () => PNG }),
  });

test("le vesti si ripuliscono: profili buoni, nomi corti, niente HTML, chiavi in ordine", () => {
  assert.deepEqual(
    vestiPulite({
      primary: { titolo: "  Casa   Rossi ", velo: '<b>Elettro</b> "Rossi"' },
      "Suocero!": { titolo: "no" },
      suocero: { titolo: "", velo: "   " },
      nonni: { velo: "x".repeat(80) },
    }),
    {
      nonni: { titolo: "", velo: "x".repeat(40) },
      primary: { titolo: "Casa Rossi", velo: "b Elettro /b Rossi" },
    },
  );
  /* «Nuova» — una plancia che la casa deve creare — passa solo se e' vero. */
  assert.deepEqual(vestiPulite({ taverna: { titolo: "Taverna", nuova: true } }), {
    taverna: { titolo: "Taverna", velo: "", nuova: true },
  });
  assert.deepEqual(vestiPulite({ taverna: { titolo: "Taverna", nuova: "si" } }), {
    taverna: { titolo: "Taverna", velo: "" },
  });
  assert.deepEqual(vestiPulite(null), {});
  assert.deepEqual(vestiPulite([]), {});
  assert.deepEqual(vestiPulite("primary"), {});
  assert.deepEqual(vestiPulite({ primary: "Casa" }), {});
});

test("il quadro dice le vesti: si tengono, si scrivono su disco, e le plance le sentono", async () => {
  const { cartella, via } = unPosto();
  try {
    const suo = unInstallatore(cartella);
    const sentite = [];
    suo.alVestire = (vesti) => sentite.push(vesti);
    await suo.dice({
      di: "Impianti Rossi",
      marchio: CHI,
      vesti: { primary: { titolo: "Casa Rossi", velo: "Rossi impianti" } },
    });
    assert.deepEqual(sentite, [{ primary: { titolo: "Casa Rossi", velo: "Rossi impianti" } }]);
    assert.deepEqual(suo.vestito("primary"), {
      nome: "Impianti Rossi",
      logo: PNG,
      tipo: "image/png",
      titolo: "Casa Rossi",
      velo: "Rossi impianti",
    });
    assert.equal(suo.vestito("altra").titolo, "");
    assert.equal(suo.vestito("altra").velo, "");

    /* Le stesse, al giro dopo, anche in un altro ordine: nessuno viene
     * avvisato di niente. */
    await suo.dice({
      di: "Impianti Rossi",
      marchio: CHI,
      vesti: { primary: { velo: "Rossi impianti", titolo: "Casa Rossi" } },
    });
    assert.equal(sentite.length, 1);

    /* Riacceso: le vesti ci sono gia', prima di qualunque rapporto, e si
     * indossano subito insieme al logo — il nome arriva col rapporto. */
    const dopo = unInstallatore(cartella);
    assert.deepEqual(dopo.vesti, { primary: { titolo: "Casa Rossi", velo: "Rossi impianti" } });
    assert.deepEqual(dopo.vestito("primary"), {
      nome: "",
      logo: PNG,
      tipo: "image/png",
      titolo: "Casa Rossi",
      velo: "Rossi impianti",
    });

    /* Una risposta senza vesti le toglie, e lo dice a chi ascolta. */
    await suo.dice({ di: "Impianti Rossi", marchio: CHI });
    assert.deepEqual(sentite[1], {});
    assert.equal(existsSync(join(cartella, "installatore", "vesti.json")), false);
    assert.deepEqual(unInstallatore(cartella).vesti, {});
  } finally {
    via();
  }
});

test("togliere il logo non toglie le vesti, e svestire toglie solo quelle", async () => {
  const { cartella, via } = unPosto();
  try {
    const suo = unInstallatore(cartella);
    await suo.dice({
      di: "Impianti Rossi",
      marchio: CHI,
      vesti: { primary: { titolo: "Casa Rossi", velo: "" } },
    });
    assert.deepEqual(suo.vestito("primary").logo, PNG);
    suo.dimentica();
    assert.equal(suo.vestito("primary").logo, null);
    assert.equal(suo.vestito("primary").titolo, "Casa Rossi");
    suo.svesti();
    assert.deepEqual(suo.vesti, {});
    assert.equal(suo.vestito("primary").titolo, "");
    assert.equal(existsSync(join(cartella, "installatore", "vesti.json")), false);
  } finally {
    via();
  }
});

test("la pagina porta in testa la parola del velo e la scritta della testata, in due pezzi", () => {
  assert.equal(leVesti(null), "");
  assert.equal(leVesti({ velo: "", testata: "" }), "");
  assert.equal(
    leVesti({ velo: "Rossi impianti", testata: "Casa Rossi" }),
    'window.__GDAHOME_VELO__="Rossi impianti";window.__GDAHOME_TESTATA__=["Casa","Rossi"];',
  );
  assert.equal(leVesti({ testata: "Casa" }), 'window.__GDAHOME_TESTATA__=["Casa",""];');
  /* Un `</script>` dentro un nome non chiude lo script. */
  assert.ok(!leVesti({ velo: "</script><script>alert(1)" }).includes("</script>"));

  const dentro = { base: "/b", lingua: "it", doveIlWebSocket: "/ws" };
  const pagina = conLePremesse("<html><head><title>x</title></head><body></body></html>", {
    ...dentro,
    vesti: { velo: "Rossi impianti", testata: "Casa Rossi" },
  });
  assert.match(pagina, /window\.__GDAHOME_VELO__="Rossi impianti";/);
  assert.match(pagina, /window\.__GDAHOME_TESTATA__=\["Casa","Rossi"\];/);
  const senza = conLePremesse("<html><head></head><body></body></html>", dentro);
  assert.ok(!senza.includes("__GDAHOME_VELO__"));
  assert.ok(!senza.includes("__GDAHOME_TESTATA__"));
});

test("il velo e la testata si rivestono dalla pagina, e il runtime resta JavaScript buono", () => {
  const pagina = laPagina(
    '<title>x</title><div id="cd-boot-overlay"><img src="data:a"><b>DashboardModern</b></div>',
    { nome: "Impianti Rossi" },
  );
  assert.match(pagina, /<b>Impianti Rossi<\/b><script>/);
  assert.ok(pagina.includes(IL_VELO_SI_RIVESTE));

  /* Con le vesti gia' in mano — la pagina dentro Home Assistant sa quale
   * plancia e' — la parola e il titolo sono quelli scelti. */
  const vestita = laPagina("<title>x</title><b>DashboardModern</b>", {
    nome: "Impianti Rossi",
    titolo: "Casa Rossi",
    velo: "Rossi impianti",
  });
  assert.match(vestita, /<b>Rossi impianti<\/b>/);
  assert.match(vestita, /<title>Casa Rossi<\/title>/);

  /* Il runtime: la scritta la sceglie la pagina, e di riserva c'e' solo
   * gdahome — mai il nome di chi installa, che puo' cambiare mentre il
   * runtime sta in cache un anno. Ed e' un pezzo di template literal che si
   * valuta davvero. */
  const runtime = vestiDiGdahome(
    "legacy/dashboard-runtime-it.js",
    Buffer.from('`<span>Dashboard</span><span class="b">MODERN</span>`', "utf8"),
    "text/javascript",
    { nome: "Impianti Rossi" },
  ).corpo.toString("utf8");
  assert.equal(
    runtime,
    '`<span>${(window.__GDAHOME_TESTATA__||["gda","home"])[0]}</span>' +
      '<span class="b">${(window.__GDAHOME_TESTATA__||["gda","home"])[1]}</span>`',
  );
  const valuta = (testata) =>
    new Function("window", `return ${runtime};`)({ __GDAHOME_TESTATA__: testata });
  assert.equal(valuta(undefined), '<span>gda</span><span class="b">home</span>');
  assert.equal(valuta(["Casa", "Rossi"]), '<span>Casa</span><span class="b">Rossi</span>');
  assert.equal(valuta(["Casa", ""]), '<span>Casa</span><span class="b"></span>');
});

test("chi serve la pagina sa le vesti di quella plancia, e l'app le legge nella descrizione", () => {
  const vesti = { primary: { titolo: "Casa Rossi", velo: "Rossi impianti" } };
  const plancia = new Plancia({
    installatore: (profilo) => ({
      nome: "Impianti Rossi",
      logo: null,
      tipo: "",
      titolo: vesti[profilo]?.titolo || "",
      velo: vesti[profilo]?.velo || "",
    }),
  });
  assert.deepEqual(plancia.vestiDi({ profilo: "primary" }), {
    velo: "Rossi impianti",
    testata: "Casa Rossi",
  });
  /* Senza una scelta, la pagina porta il nome di chi installa: e' la pagina
   * a dirlo, non il runtime. */
  assert.deepEqual(plancia.vestiDi({ profilo: "suocero" }), {
    velo: "Impianti Rossi",
    testata: "Impianti Rossi",
  });
  assert.deepEqual(plancia.vestiDi(null), { velo: "Impianti Rossi", testata: "Impianti Rossi" });
  const nessuno = new Plancia({ installatore: () => null });
  assert.equal(nessuno.vestiDi({ profilo: "primary" }), null);

  const detta = plancia.descrizione({
    profilo: "primary",
    titolo: "Casa Rossi",
    istanza: "gdahome",
    primaria: true,
  });
  assert.equal(detta.velo, "Rossi impianti");
  assert.equal(detta.testata, "Casa Rossi");
  const altra = plancia.descrizione({
    profilo: "suocero",
    titolo: "Suocero",
    istanza: "gdahome-suocero",
    primaria: false,
  });
  assert.equal(altra.velo, "Impianti Rossi");
  assert.equal(altra.testata, "Impianti Rossi");

  /* E la pagina letta sapendo quale plancia e' esce gia' con la sua parola. */
  if (plancia.cE) {
    const dove = `/dashboardmodern_static/${plancia.impronta}/legacy/dashboard.html`;
    assert.match(
      plancia.leggi(dove, { profilo: "primary" }).corpo.toString("utf8"),
      /<b>Rossi impianti<\/b>/,
    );
    assert.match(plancia.leggi(dove).corpo.toString("utf8"), /<b>Impianti Rossi<\/b>/);
  }
});

test("il rapporto porta l'elenco delle plance: profilo e titolo, e niente di quello che hanno dentro", async () => {
  const fabbrica = fabbricaIlRapporto({
    identita: { casa: "casa_abc" },
    casa: { chiedi: async () => [] },
    plance: {
      elenco: () => [
        { profilo: "primary", titolo: "gdahome", istanza: "gdahome", utenti: ["u1"] },
        { profilo: "suocero", titolo: "Suocero", istanza: "gdahome-suocero", utenti: [] },
      ],
    },
    /* Quello che `Configurazione.leggi` risponde davvero: sempre un foglio,
     * con dentro lo scatto. Configurata e' quella che nello scatto ha
     * qualcosa — una stanza — non quella per cui la risposta non e' vuota,
     * che sono tutte. */
    configurazione: {
      leggi: (profilo) => ({
        profile: profilo,
        snapshot: {
          revision: 3,
          values: profilo === "primary" ? { cd_stanze: JSON.stringify([{ nome: "Cucina" }]) } : {},
        },
      }),
    },
    registro: ZITTO,
  });
  const foglio = await fabbrica();
  assert.deepEqual(foglio.plance, {
    quante: 2,
    configurate: 1,
    elenco: [
      { profilo: "primary", titolo: "gdahome" },
      { profilo: "suocero", titolo: "Suocero" },
    ],
  });
});
