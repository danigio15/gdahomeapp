/* Le due voci di gdahome nella barra laterale di Home Assistant.
 *
 * Sono due — il cruscotto di chi installa e la gestione di chi tiene il quadro
 * — e tutte e due sono plance di Lovelace, non pannelli di un'integrazione. La prima
 * stesura lo faceva fare all'integrazione — sembrava il posto giusto, perche' i
 * pannelli li registrano le integrazioni — e non arrivava a nessuno:
 * l'integrazione nelle case non ci va piu'. Quello che segue prova la strada
 * che invece ci arriva, cioe' quella che il ponte usa gia' per le Plance.
 *
 * Le cose che si provano, in ordine di quanto farebbero male:
 *
 *  1. **che non lampeggi.** Salvare una plancia manda un `lovelace_updated` a
 *     tutte le pagine aperte, che si ridisegnano. Riscrivere a ogni accensione
 *     la stessa cosa vuol dire far lampeggiare il tablet in cucina per niente;
 *  2. **che spegnere l'interruttore la tolga davvero**, e subito;
 *  3. **che si riprovi**: all'avvio Home Assistant sta ancora partendo e i
 *     comandi di Lovelace arrivano a nessuno. Fermarsi al primo tentativo vuol
 *     dire un installatore che accende l'interruttore e non vede niente;
 *  4. **che la vedano solo gli amministratori**: porta agli impianti dei
 *     clienti di qualcuno, e Home Assistant in casa lo aprono anche i familiari.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { IL_CRUSCOTTO, LA_GESTIONE, RIQUADRO, VoceNellaBarra } from "../src/voci-nella-barra.js";

const QUADRO = "https://quadro.gdahome.org";

/* Una Home Assistant finta: tiene le plance in una lista, e registra tutto
 * quello che le si chiede. */
function casaFinta({ gia = [], configurazione = null, rompe = null } = {}) {
  const plance = [...gia];
  const chieste = [];
  let salvata = configurazione;
  return {
    chieste,
    get plance() {
      return plance;
    },
    get salvata() {
      return salvata;
    },
    chiedi: async (comando) => {
      chieste.push(comando);
      if (rompe && rompe(comando)) throw new Error("Home Assistant sta ancora partendo");
      switch (comando.type) {
        case "lovelace/dashboards/list":
          return plance;
        case "lovelace/dashboards/create": {
          /* Un identificativo diverso per ognuna, come fa Home Assistant.
           * Dandone uno solo a tutte, cancellarne una ne toglieva un'altra — e
           * la prova delle due voci se n'e' accorta. */
          const nuova = { id: `d${plance.length + 1}`, ...comando };
          plance.push(nuova);
          return nuova;
        }
        case "lovelace/dashboards/update": {
          const quale = plance.find((una) => una.id === comando.dashboard_id);
          if (quale) Object.assign(quale, comando);
          return quale;
        }
        case "lovelace/dashboards/delete": {
          const dove = plance.findIndex((una) => una.id === comando.dashboard_id);
          if (dove >= 0) plance.splice(dove, 1);
          return true;
        }
        case "lovelace/config":
          if (salvata === null) throw new Error("config not found");
          return salvata;
        case "lovelace/config/save":
          salvata = comando.config;
          return true;
        default:
          return null;
      }
    },
  };
}

const zitto = { info() {}, attenzione() {}, errore() {} };
const aspettaDavvero = (quanto) => new Promise((ok) => setTimeout(ok, quanto));

const laVoce = (casa, dentro = {}) =>
  new VoceNellaBarra({
    casa,
    quale: IL_CRUSCOTTO,
    acceso: true,
    quadro: QUADRO,
    registro: zitto,
    aspetta: aspettaDavvero,
    ...dentro,
  });

test("acceso, la voce compare nella barra laterale col cruscotto dentro", async () => {
  const casa = casaFinta();
  assert.equal((await laVoce(casa).dillo()).fatto, true);

  const fatta = casa.chieste.find((c) => c.type === "lovelace/dashboards/create");
  assert.ok(fatta, "non ha creato nessuna plancia");
  assert.equal(fatta.url_path, IL_CRUSCOTTO.dove);
  assert.equal(fatta.title, IL_CRUSCOTTO.titolo);
  assert.equal(fatta.show_in_sidebar, true);
  assert.equal(fatta.require_admin, true, "la vedrebbero tutti quelli che entrano");

  /* E dentro c'e' il cruscotto vero, non una copia rifatta — con la tessera
   * nostra e non l'`iframe` di Home Assistant, che sopra si tiene la barra
   * della dashboard. */
  const carta = casa.salvata.views[0].cards[0];
  assert.equal(carta.type, `custom:${RIQUADRO}`);
  assert.equal(carta.dove, `${QUADRO}/console/`);
  assert.equal(casa.salvata.views[0].panel, true, "a pagina intera, non una tessera");
});

test("ridirlo uguale non riscrive niente: se no il tablet in cucina lampeggia", async () => {
  const casa = casaFinta();
  await laVoce(casa).dillo();
  const scritte = () => casa.chieste.filter((c) => c.type === "lovelace/config/save").length;
  assert.equal(scritte(), 1);

  await laVoce(casa).dillo();
  assert.equal(scritte(), 1, "ha riscritto la stessa pagina una seconda volta");
  assert.equal(
    casa.chieste.filter((c) => c.type === "lovelace/dashboards/create").length,
    1,
    "ha creato la plancia due volte",
  );
});

test("cambiando l'indirizzo del quadro la pagina si riscrive", async () => {
  const casa = casaFinta();
  await laVoce(casa).dillo();
  await laVoce(casa, { quadro: "https://altro.example" }).dillo();

  assert.equal(casa.salvata.views[0].cards[0].dove, "https://altro.example/console/");
  assert.equal(casa.chieste.filter((c) => c.type === "lovelace/config/save").length, 2);
});

test("spegnere l'interruttore toglie la voce, subito", async () => {
  const casa = casaFinta();
  await laVoce(casa).dillo();
  assert.equal(casa.plance.length, 1);

  assert.equal((await laVoce(casa, { acceso: false }).dillo()).fatto, true);
  assert.equal(casa.plance.length, 0, "la voce e' rimasta appesa");
});

test("spento e senza voce, non si lamenta e non fa niente", async () => {
  const casa = casaFinta();
  assert.equal((await laVoce(casa, { acceso: false }).dillo()).fatto, true);
  assert.equal(casa.chieste.filter((c) => c.type.startsWith("lovelace/dashboards/d")).length, 0);
});

test("una plancia rimasta con un titolo vecchio si raddrizza", async () => {
  const casa = casaFinta({
    gia: [{ id: "d9", url_path: IL_CRUSCOTTO.dove, title: "Cruscotto", require_admin: false }],
  });
  await laVoce(casa).dillo();

  const raddrizzata = casa.chieste.find((c) => c.type === "lovelace/dashboards/update");
  assert.ok(raddrizzata, "l'ha lasciata com'era");
  assert.equal(raddrizzata.title, IL_CRUSCOTTO.titolo);
  assert.equal(raddrizzata.require_admin, true, "restava aperta a tutti");
});

test("un indirizzo che non e' https non si mette in nessuna pagina", async () => {
  for (const storto of ["", "http://quadro.gdahome.org", "javascript:alert(1)"]) {
    const casa = casaFinta();
    const esito = await laVoce(casa, { quadro: storto }).dillo();
    assert.equal(esito.fatto, false, `ha accettato «${storto}»`);
    assert.equal(casa.plance.length, 0);
  }
});

test("se la prima volta Home Assistant stava partendo, si riprova", async () => {
  let primo = true;
  const casa = casaFinta({
    rompe: (c) => {
      if (c.type === "lovelace/dashboards/list" && primo) {
        primo = false;
        return true;
      }
      return false;
    },
  });
  const esito = await laVoce(casa).dilloConCalma([1]);
  assert.equal(esito.fatto, true);
  assert.equal(casa.plance.length, 1);
});

test("non si riprova per sempre, e alla fine lo dice una volta sola", async () => {
  const casa = casaFinta({ rompe: () => true });
  const detto = [];
  const voce = laVoce(casa, {
    registro: { ...zitto, attenzione: (t) => detto.push(t) },
  });

  assert.equal((await voce.dilloConCalma([1, 1])).fatto, false);
  assert.equal(detto.length, 1, "un add-on che non ci riesce non deve gridare");
});

test("fermarlo interrompe i tentativi: il ponte si abbassa e non resta niente dietro", async () => {
  const casa = casaFinta({ rompe: () => true });
  const voce = laVoce(casa);
  const giro = voce.dilloConCalma([20, 20]);
  voce.ferma();
  await giro;
  assert.equal(
    casa.chieste.filter((c) => c.type === "lovelace/dashboards/list").length,
    1,
    "dopo il primo non ci ha piu' provato",
  );
});

test("senza nessuno a cui dirlo non si schianta", async () => {
  const voce = new VoceNellaBarra({
    casa: null,
    quale: IL_CRUSCOTTO,
    acceso: true,
    quadro: QUADRO,
    registro: zitto,
  });
  assert.equal((await voce.dillo()).fatto, false);
});

test("le due voci sono due, e non si pestano i piedi", async () => {
  /* Stesso filo, stessa macchina, due plance diverse: se si contendessero
   * l'indirizzo, accendere la gestione spegnerebbe il cruscotto. */
  const casa = casaFinta();
  await laVoce(casa).dillo();
  await laVoce(casa, { quale: LA_GESTIONE }).dillo();

  assert.equal(casa.plance.length, 2);
  assert.deepEqual(
    casa.plance.map((una) => una.url_path).sort(),
    [IL_CRUSCOTTO.dove, LA_GESTIONE.dove].sort(),
  );
});

test("la gestione apre /gestore/, non la console", async () => {
  /* Le due pagine del quadro sono due, e mandare chi tiene il quadro sulla
   * console dell'installatore vorrebbe dire una voce che non fa quello che
   * dice. */
  const casa = casaFinta();
  await laVoce(casa, { quale: LA_GESTIONE }).dillo();

  assert.equal(casa.salvata.views[0].cards[0].dove, `${QUADRO}/gestore/`);
  assert.equal(casa.salvata.views[0].title, LA_GESTIONE.titolo);
});

test("spegnere una non tocca l'altra", async () => {
  const casa = casaFinta();
  await laVoce(casa).dillo();
  await laVoce(casa, { quale: LA_GESTIONE }).dillo();
  await laVoce(casa, { quale: LA_GESTIONE, acceso: false }).dillo();

  assert.deepEqual(
    casa.plance.map((una) => una.url_path),
    [IL_CRUSCOTTO.dove],
    "spegnendo la gestione se n'e' andato anche il cruscotto",
  );
});

test("la tessera che la voce chiede e' la stessa che la cartina registra", () => {
  /* Due file e un nome. Qui si scrive `custom:gdahome-riquadro` dentro la
   * configurazione di una plancia; la' `customElements.define` decide come si
   * chiama davvero. Se si scollano, Home Assistant non si lamenta con nessuno:
   * disegna «Custom element doesn't exist» dentro un riquadro, e chi lo vede
   * non ha modo di sapere da dove viene.
   *
   * Si guarda anche che la cartina tolga la barra a tutt'e due — plancia e
   * riquadro — perche' e' l'unica ragione per cui questa tessera esiste invece
   * dell'`iframe` di Home Assistant: senza quella riga tanto valeva l'altra. */
  const cartina = readFileSync(
    fileURLToPath(new URL("../carta/plancia.js", import.meta.url)),
    "utf8",
  );
  assert.match(
    cartina,
    new RegExp(`const RIQUADRO = "${RIQUADRO}";`),
    "la cartina deve registrare proprio questo nome",
  );
  assert.match(
    cartina,
    /customElements\.define\(RIQUADRO, RiquadroDiGdahome\)/,
    "e deve registrarlo davvero, non solo nominarlo",
  );
  assert.equal(
    (cartina.match(/senzaLaBarra\(this/g) || []).length,
    2,
    "la barra la tolgono tutt'e due: la plancia e il riquadro",
  );
});
