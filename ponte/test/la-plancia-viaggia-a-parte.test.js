/* Com'e' fatta una plancia viaggia a parte, e solo se la casa lo permette.
 *
 * Il rapporto ha un tetto e una plancia configurata lo passa: quindi nel
 * rapporto ci va un numero — la revisione — e il contenuto lo porta la casa su
 * una strada sua, quando il quadro dice di non averlo. Senza i flussi delle
 * telecamere, che da casa non escono. E la configurazione scritta dal quadro
 * la casa la va a prendere lei, con la sua chiave, per il lavoro con quell'id.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Postino, fabbricaIlRapporto } from "../src/rapporto.js";

const ZITTO = { debug() {}, info() {}, attenzione() {}, errore() {} };

const configurazioneFinta = (revision = 12) => ({
  leggi: (profilo) => ({
    profile: profilo,
    snapshot: { revision, values: { cd_stanze: JSON.stringify([{ name: "Cucina" }]) } },
  }),
});

const fabbricaCon = ({ permesso }) =>
  fabbricaIlRapporto({
    identita: { casa: "casa_abc" },
    casa: { chiedi: async () => [] },
    plance: { elenco: () => [{ profilo: "primary", titolo: "Casa" }] },
    configurazione: configurazioneFinta(12),
    configurazionePlancia: () => permesso,
    registro: ZITTO,
  });

test("il rapporto dice se il terzo interruttore e' acceso, e allora porta la revisione di ogni plancia", async () => {
  const aperto = await fabbricaCon({ permesso: true })();
  assert.equal(aperto.configurazione, true);
  assert.deepEqual(aperto.plance.elenco, [{ profilo: "primary", titolo: "Casa", revisione: 12 }]);
  /* Un numero, non un contenuto: della configurazione nel rapporto non c'e'
   * altro. */
  assert.ok(!JSON.stringify(aperto).includes("Cucina"));

  const chiuso = await fabbricaCon({ permesso: false })();
  assert.equal(chiuso.configurazione, false);
  assert.deepEqual(chiuso.plance.elenco, [{ profilo: "primary", titolo: "Casa" }]);
});

/* La plancia di casa vista dal postino: se il permesso c'e', e lo scatto di un
 * profilo. Dentro c'e' un flusso apposta, per vedere che non parte. */
const planciaFinta = ({ attiva = true } = {}) => ({
  attiva: () => attiva,
  /* L'inventario di casa, gia' passato dal setaccio (`inventario.js`): qui
   * si guarda che parta col primo scatto e con quello soltanto. */
  inventario: async () => ({
    stati: [
      { entity_id: "light.cucina", state: "unknown", attributes: { friendly_name: "Cucina" } },
    ],
    entita: [],
    dispositivi: [],
    stanze: [{ area_id: "cucina", name: "Cucina" }],
    piani: [],
  }),
  scatta: (profilo) =>
    profilo === "primary" || profilo === "suocero"
      ? {
          titolo: profilo === "primary" ? "Casa" : "Suocero",
          revisione: 12,
          chiavi: 4,
          generazione: 2,
          aggiornataIl: 1700000000000,
          valori: {
            cd_stanze: JSON.stringify([{ name: "Cucina" }]),
            cd_telecamere: JSON.stringify([
              { entity: "camera.ingresso", stream: "rtsp://u:p@192.168.1.9/ingresso" },
            ]),
          },
        }
      : null,
});

function postinoCon({ plancia, risposta }) {
  const viste = [];
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "K7M2-9XQF-3BHT-R4VN",
    casa: "casa_abc",
    fabbrica: () => ({ casa: "casa_abc", configurazione: true }),
    registro: ZITTO,
    plancia,
    fetch: async (dove, come) => {
      viste.push({ dove, come });
      if (dove.endsWith("/rapporto")) return { ok: true, json: async () => risposta };
      return { ok: true, json: async () => ({}) };
    },
  });
  return { postino, viste };
}

test("quando il quadro chiede una plancia, la casa gliela manda: senza flussi, e solo quelle chieste", async () => {
  const { postino, viste } = postinoCon({
    plancia: planciaFinta(),
    risposta: { presa: true, vuoleLaPlancia: ["primary", "suocero", "../furbo"] },
  });
  assert.equal(await postino.manda(), true);
  postino.ferma();
  const mandate = viste.filter((una) => una.dove === "https://quadro.it/plancia");
  assert.equal(mandate.length, 2, "partono le plance che ci sono e che sono state chieste");
  const [una, altra] = mandate;
  assert.equal(una.come.method, "POST");
  assert.equal(una.come.headers.authorization, "Bearer K7M2-9XQF-3BHT-R4VN");
  assert.equal(una.come.headers["x-casa"], "casa_abc");
  const corpo = JSON.parse(una.come.body);
  assert.equal(corpo.profilo, "primary");
  assert.equal(corpo.titolo, "Casa");
  assert.equal(corpo.revisione, 12);
  /* I tre numeri della generazione dello scatto, per l'editor. */
  assert.equal(corpo.chiavi, 4);
  assert.equal(corpo.generazione, 2);
  assert.equal(corpo.aggiornataIl, 1700000000000);
  /* L'inventario di casa viaggia col primo scatto, e con quello soltanto:
   * e' lo stesso per tutte le plance. */
  assert.deepEqual(corpo.inventario.stanze, [{ area_id: "cucina", name: "Cucina" }]);
  assert.equal(corpo.inventario.stati[0].state, "unknown");
  assert.equal("inventario" in JSON.parse(altra.come.body), false);
  /* Il flusso non parte: al suo posto una stringa vuota, cosi' la telecamera
   * resta al suo posto e il suo indirizzo resta in casa. */
  const telecamere = JSON.parse(corpo.valori.cd_telecamere);
  assert.equal(telecamere[0].entity, "camera.ingresso");
  assert.equal(telecamere[0].stream, "");
  assert.ok(!una.come.body.includes("rtsp://"));
});

test("senza il permesso non parte nessuna plancia, chieda pure chi vuole", async () => {
  const { postino, viste } = postinoCon({
    plancia: planciaFinta({ attiva: false }),
    risposta: { presa: true, vuoleLaPlancia: ["primary"] },
  });
  assert.equal(await postino.manda(), true);
  postino.ferma();
  assert.deepEqual(
    viste.filter((una) => una.dove === "https://quadro.it/plancia"),
    [],
  );
});

test("una risposta che non chiede niente non fa partire niente", async () => {
  const { postino, viste } = postinoCon({ plancia: planciaFinta(), risposta: { presa: true } });
  assert.equal(await postino.manda(), true);
  postino.ferma();
  assert.equal(
    viste.some((una) => una.dove === "https://quadro.it/plancia"),
    false,
  );
});

test("la configurazione scritta dal quadro si ritira con la chiave di casa, per quel lavoro", async () => {
  const viste = [];
  const postino = new Postino({
    dove: "https://quadro.it",
    chiave: "K7M2-9XQF-3BHT-R4VN",
    casa: "casa_abc",
    fabbrica: () => ({ casa: "casa_abc" }),
    registro: ZITTO,
    fetch: async (dove, come) => {
      viste.push({ dove, come });
      if (dove.includes("id=c-1"))
        return {
          ok: true,
          status: 200,
          json: async () => ({ valori: { a: "1" }, revisioneAttesa: 12 }),
        };
      return { ok: false, status: 404 };
    },
  });
  const presa = await postino.prendiLaPlanciaChiesta("primary", "c-1");
  assert.deepEqual(presa, { valori: { a: "1" }, revisioneAttesa: 12 });
  assert.equal(viste[0].dove, "https://quadro.it/plancia/primary?id=c-1");
  assert.equal(viste[0].come.method, "GET");
  assert.equal(viste[0].come.headers.authorization, "Bearer K7M2-9XQF-3BHT-R4VN");
  assert.equal(viste[0].come.headers["x-casa"], "casa_abc");
  /* Un lavoro che il quadro non ha piu' non e' un errore: e' un no. */
  assert.equal(await postino.prendiLaPlanciaChiesta("primary", "c-2"), null);
  /* E un profilo che non e' un profilo non si chiede nemmeno. */
  assert.equal(await postino.prendiLaPlanciaChiesta("../x", "c-1"), null);
});
