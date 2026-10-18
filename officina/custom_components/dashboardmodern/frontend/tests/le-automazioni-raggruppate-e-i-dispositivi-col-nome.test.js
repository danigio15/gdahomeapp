/* Le automazioni raggruppate, e i dispositivi col loro nome.
 *
 * Dal campo, sulla pagina Automazioni: «fai in modo che le automazioni escono
 * raggruppate e se uno vuole le espande, non mettere per default espanso». E
 * nella stessa pagina, sotto il nome di piu' di un'automazione: «Da un
 * dispositivo (eddd506f61c3e0…)». Quelle cifre sono l'id di un dispositivo o
 * di una voce del registro delle entita': un'automazione fatta col
 * «Dispositivo» di Home Assistant le porta al posto degli entity_id, e a chi
 * abita non dicono niente.
 *
 * Queste prove tengono ferme le due cose: i gruppi partono chiusi e si
 * ricordano quelli aperti (in questo browser, non nella casa); e un pezzo
 * «device» si dice col suo verbo e col nome di cio' di cui parla, mai con le
 * cifre.
 */
import assert from "node:assert/strict";
import test from "node:test";

const magazzino = new Map();
const disco = {
  getItem: (k) => (magazzino.has(k) ? magazzino.get(k) : null),
  setItem: (k, v) => magazzino.set(k, String(v)),
  removeItem: (k) => magazzino.delete(k),
};
globalThis.localStorage = disco;

/* Le mappe dei dispositivi come le lascia il pannello: prima che la sezione
 * le legga la prima volta. */
magazzino.set(
  "dm_dispositivi_di_home_assistant",
  JSON.stringify({
    di: { "switch.lavatrice": "eddd506f61c3e0aa11bb22cc33dd44ee" },
    nomi: { eddd506f61c3e0aa11bb22cc33dd44ee: "Lavatrice", "4f94e6a6aa11bb22": "Interruttore cucina" },
  }),
);

const { CHIAVE_GRUPPI_APERTI, alternaIlGruppo, gruppiCompattiHtml, riassuntoDi } = await import(
  `../src/sections/automazioni-section.js?raggruppate=${Date.now()}`
);
const {
  azioneDelDispositivoInParole,
  condizioneDelDispositivoInParole,
  eUnIdCrudo,
  innescoDelDispositivoInParole,
  nomeDaId,
} = await import("../src/core/parole-dei-servizi.js");

const ELENCO = [
  { entity_id: "automation.a", nome: "Luce ingresso", attiva: true, categoria: "luci", riassunto: { it: "x", en: "x" } },
  { entity_id: "automation.b", nome: "Termostato", attiva: false, categoria: "clima", riassunto: { it: "y", en: "y" } },
];
const chiusi = (html) => (html.match(/class="aug chiuso"/g) || []).length;
const righe = (html) => (html.match(/class="aug-riga/g) || []).length;

/* ── i gruppi ─────────────────────────────────────────────────────────── */

test("i gruppi partono chiusi: ▸, aria-expanded falso, nessuna riga", () => {
  magazzino.delete(CHIAVE_GRUPPI_APERTI);
  const html = gruppiCompattiHtml(ELENCO, { per: "tipo" });
  assert.equal(chiusi(html), 2);
  assert.equal(righe(html), 0);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /aria-expanded="true"/);
  assert.doesNotMatch(html, /▾/);
});

test("si ricordano quelli APERTI, nella chiave nuova; la vecchia dei chiusi non conta", () => {
  magazzino.delete(CHIAVE_GRUPPI_APERTI);
  assert.equal(CHIAVE_GRUPPI_APERTI, "dm_automazioni_gruppi_aperti");
  /* Chi aveva chiuso dei gruppi con la versione di prima: non li ritrova
   * aperti tutti gli altri. */
  magazzino.set("dm_automazioni_gruppi_chiusi", JSON.stringify(["tipo:luci"]));
  assert.equal(chiusi(gruppiCompattiHtml(ELENCO, { per: "tipo" })), 2);
  alternaIlGruppo("tipo:luci");
  assert.deepEqual(JSON.parse(magazzino.get(CHIAVE_GRUPPI_APERTI)), ["tipo:luci"]);
  const html = gruppiCompattiHtml(ELENCO, { per: "tipo" });
  assert.equal(chiusi(html), 1);
  assert.equal(righe(html), 1);
  assert.match(html, /data-aug="tipo:luci"[^]*?aria-expanded="true"/);
  alternaIlGruppo("tipo:luci");
  assert.deepEqual(JSON.parse(magazzino.get(CHIAVE_GRUPPI_APERTI)), []);
  assert.equal(chiusi(gruppiCompattiHtml(ELENCO, { per: "tipo" })), 2);
  magazzino.delete("dm_automazioni_gruppi_chiusi");
});

test("con una ricerca in corso i gruppi stanno aperti", () => {
  magazzino.delete(CHIAVE_GRUPPI_APERTI);
  const html = gruppiCompattiHtml(ELENCO, { per: "tipo", cerca: "e" });
  assert.equal(chiusi(html), 0);
  assert.equal(righe(html), 2);
});

test("senza disco (finestra privata, dati bloccati) si disegna lo stesso, chiuso", () => {
  globalThis.localStorage = {
    getItem() {
      throw new Error("bloccato");
    },
    setItem() {
      throw new Error("bloccato");
    },
  };
  try {
    assert.equal(chiusi(gruppiCompattiHtml(ELENCO, { per: "tipo" })), 2);
    assert.doesNotThrow(() => alternaIlGruppo("tipo:luci"));
  } finally {
    globalThis.localStorage = disco;
  }
});

/* ── i dispositivi ────────────────────────────────────────────────────── */

test("un id crudo non si dice mai", () => {
  assert.equal(eUnIdCrudo("eddd506f61c3e0aa11bb22cc33dd44ee"), true);
  assert.equal(eUnIdCrudo("4f94e6a6-1b2c-4d3e-8f90-a1b2c3d4e5f6"), true);
  assert.equal(eUnIdCrudo("switch.lavatrice"), false);
  assert.equal(eUnIdCrudo("Lavatrice"), false);
  assert.equal(nomeDaId("eddd506f61c3e0aa11bb22cc33dd44ee"), "");
  assert.equal(nomeDaId("light.cabina_armadio"), "cabina armadio");
});

test("un innesco «device» si dice col suo verbo", () => {
  const it = (x, chi) => innescoDelDispositivoInParole(x, chi)?.it ?? null;
  const en = (x, chi) => innescoDelDispositivoInParole(x, chi)?.en ?? null;
  assert.equal(it({ type: "turned_on" }, "Lavatrice"), "Lavatrice si accende");
  assert.equal(en({ type: "turned_on" }, "Lavatrice"), "Lavatrice turns on");
  assert.equal(it({ type: "turned_off" }, "Lavatrice"), "Lavatrice si spegne");
  assert.equal(it({ type: "opened" }, "Porta"), "Porta si apre");
  assert.equal(it({ type: "motion" }, "Corridoio"), "c'è movimento in Corridoio");
  assert.equal(it({ type: "no_motion" }, "Corridoio"), "non c'è più movimento in Corridoio");
  assert.equal(
    it({ type: "remote_button_short_press", subtype: "turn_on" }, "Interruttore cucina"),
    "si preme il pulsante Interruttore cucina",
  );
  assert.equal(
    it({ type: "remote_button_double_press", subtype: "button_2" }, "Interruttore cucina"),
    "si preme due volte il pulsante Interruttore cucina (tasto 2)",
  );
  assert.equal(it({ type: "remote_button_long_press" }, "Interruttore cucina"), "si tiene premuto il pulsante Interruttore cucina");
  assert.equal(en({ type: "pressed" }, ""), "a button is pressed");
  assert.equal(it({ type: "power", above: 5 }, "Lavatrice"), "Lavatrice supera 5");
  assert.equal(it({ type: "temperature", below: 0 }, "Esterno"), "Esterno scende sotto 0");
  assert.equal(it({ type: "turned_on" }, ""), "un dispositivo si accende");
  /* Uno che non si sa dire: chi chiama dice solo da chi viene. */
  assert.equal(innescoDelDispositivoInParole({ type: "qualcosa_di_strano" }, "Lavatrice"), null);
});

test("una condizione e un'azione «device» col loro verbo", () => {
  assert.equal(condizioneDelDispositivoInParole({ type: "is_on" }, "Lavatrice").it, "Lavatrice è acceso");
  assert.equal(condizioneDelDispositivoInParole({ type: "is_open" }, "Porta").en, "Porta is open");
  assert.equal(condizioneDelDispositivoInParole({ type: "boh" }, "Porta"), null);
  assert.equal(
    azioneDelDispositivoInParole({ domain: "switch", type: "turn_off" }, "Lavatrice").it,
    "spegni Lavatrice",
  );
  assert.equal(azioneDelDispositivoInParole({ domain: "cover", type: "open" }, "Tenda").it, "apri Tenda");
  assert.equal(
    azioneDelDispositivoInParole({ domain: "mobile_app", type: "notify" }, "Telefono").it,
    "manda una notifica a Telefono",
  );
  assert.equal(
    azioneDelDispositivoInParole({ domain: "zha", type: "turn_on" }, "").it,
    "accendi un dispositivo",
  );
  assert.equal(azioneDelDispositivoInParole({ domain: "zha", type: "issue_command" }, "X"), null);
});

test("il riassunto di una complessa: i dispositivi col nome ricordato, mai le cifre", () => {
  const r = riassuntoDi({
    triggers: [
      /* L'entita' scritta come voce del registro: si dice il dispositivo. */
      {
        trigger: "device",
        device_id: "eddd506f61c3e0aa11bb22cc33dd44ee",
        entity_id: "4f94e6a6aa11bb22cc33dd44ee556677",
        domain: "switch",
        type: "turned_on",
      },
      { trigger: "device", device_id: "4f94e6a6aa11bb22", domain: "zha", type: "remote_button_short_press" },
      { trigger: "device", device_id: "4f94e6a6aa11bb22", domain: "zha", type: "qualcosa" },
      { trigger: "device", device_id: "ffffffffffffffffffff", domain: "zha", type: "qualcosa" },
    ],
    conditions: [{ condition: "device", device_id: "eddd506f61c3e0aa11bb22cc33dd44ee", domain: "switch", type: "is_off" }],
    actions: [
      { device_id: "eddd506f61c3e0aa11bb22cc33dd44ee", domain: "switch", entity_id: "abcdef0123456789abcdef", type: "turn_off" },
      { device_id: "ffffffffffffffffffff", domain: "zha", type: "issue_command" },
    ],
  });
  assert.deepEqual(
    r.quando.map((q) => q.testo),
    [
      "Lavatrice si accende",
      "si preme il pulsante Interruttore cucina",
      "Interruttore cucina fa qualcosa",
      "un dispositivo fa qualcosa",
    ],
  );
  assert.equal(r.soloSe[0].testo, "Lavatrice è spento");
  assert.deepEqual(
    r.allora.map((a) => a.testo),
    ["spegni Lavatrice", "un'azione di un dispositivo"],
  );
  assert.doesNotMatch(JSON.stringify(r), /[0-9a-f]{8,}/);
});
