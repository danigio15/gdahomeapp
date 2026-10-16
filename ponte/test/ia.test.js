/* gdahome AI: il ponte trova l'add-on, gli chiede cosa sono le cose, e
 * prende solo le risposte previste. Niente rete vera: un fetch finto. */
import assert from "node:assert/strict";
import test from "node:test";

import { CapireLaCasa } from "../src/capire-la-casa.js";
import { Ia } from "../src/ia.js";

const QUI = "http://127.0.0.1:11434";

function unOllama({ modelli = ["qwen2.5:1.5b"], risposta = {} } = {}) {
  const chieste = [];
  const fetch = async (url, opzioni = {}) => {
    chieste.push({ url, opzioni });
    const json = (data) => ({ ok: true, json: async () => data });
    if (url === `${QUI}/api/tags`) return json({ models: modelli.map((name) => ({ name })) });
    if (url === `${QUI}/api/pull`) {
      modelli.push(JSON.parse(opzioni.body).model);
      return json({ status: "success" });
    }
    if (url === `${QUI}/api/chat`) return json({ message: { content: JSON.stringify(risposta) } });
    return { ok: false, json: async () => ({}) };
  };
  return { fetch, chieste };
}

test("accesa: Ollama dentro l'add-on risponde solo per quello che si e' chiesto", async () => {
  const { fetch, chieste } = unOllama({
    risposta: {
      "light.mensola_blu": "acquario",
      "switch.presa_3": "sempre",
      "light.cucina": "normale",
      "light.inventata": "acquario",
      "switch.presa_4": "esplosivo",
    },
  });
  const ia = new Ia({ url: QUI, fetch });
  const detto = await ia.riconosci([
    { id: "light.mensola_blu", nome: "Mensola blu" },
    { id: "switch.presa_3", nome: "Presa 3" },
    { id: "switch.presa_4", nome: "Presa 4" },
    { id: "light.cucina", nome: "Cucina" },
  ]);
  assert.deepEqual(detto, {
    "light.mensola_blu": "acquario",
    "switch.presa_3": "sempre",
    "light.cucina": "normale",
  });
  /* Al modello vanno solo id e nomi. */
  const domanda = chieste.find((c) => c.url.endsWith("/api/chat"));
  const corpo = JSON.parse(domanda.opzioni.body);
  assert.equal(corpo.model, "qwen2.5:1.5b");
  assert.equal(corpo.format, "json");
  assert.deepEqual(JSON.parse(corpo.messages[1].content)[0], {
    id: "light.mensola_blu",
    nome: "Mensola blu",
  });
});

test("la prima volta il modello si scarica, poi no", async () => {
  const { fetch, chieste } = unOllama({ modelli: [] });
  const ia = new Ia({ url: QUI, fetch });
  await ia.riconosci([{ id: "light.a", nome: "A" }]);
  await ia.riconosci([{ id: "light.b", nome: "B" }]);
  assert.equal(chieste.filter((c) => c.url.endsWith("/api/pull")).length, 1);
});

test("spenta, o con un indirizzo che non e' di casa: nessuna domanda", async () => {
  const spenta = unOllama();
  assert.equal(
    await new Ia({ url: "", fetch: spenta.fetch }).riconosci([{ id: "light.a", nome: "A" }]),
    null,
  );
  const fuori = unOllama();
  assert.equal(
    await new Ia({ url: "http://esempio.it:11434", fetch: fuori.fetch }).riconosci([
      { id: "light.a", nome: "A" },
    ]),
    null,
  );
  assert.equal(spenta.chieste.length + fuori.chieste.length, 0);
});

test("quello che dice l'IA l'assistente lo usa: la mensola dell'acquario resta accesa", () => {
  const capire = new CapireLaCasa({ memoria: {} });
  const stati = new Map([
    ["light.mensola_blu", { state: "on", attributes: { friendly_name: "Mensola blu" } }],
    ["light.acquario", { state: "on", attributes: { friendly_name: "Acquario" } }],
    [
      "binary_sensor.porta_3",
      { state: "off", attributes: { device_class: "door", friendly_name: "Porta 3" } },
    ],
  ]);
  const nome = (s, id) => s.attributes.friendly_name || id;
  /* L'acquario si riconosce dal nome: non si chiede. */
  assert.deepEqual(
    capire.daChiedere(stati, nome).map((c) => c.id),
    ["light.mensola_blu", "binary_sensor.porta_3"],
  );
  capire.ricordaIa({ "light.mensola_blu": "acquario", "binary_sensor.porta_3": "interna" });
  assert.deepEqual(capire.lasciaStare("light.mensola_blu", "Mensola blu"), {
    perche: "acquario",
    ia: true,
  });
  assert.equal(capire.portaInterna("binary_sensor.porta_3", "Porta 3", "door"), true);
  assert.deepEqual(capire.daChiedere(stati, nome), [], "una volta chiesto non si richiede");
});
