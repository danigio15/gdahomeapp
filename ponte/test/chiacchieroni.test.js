/* Chi parla di piu' in casa.
 *
 * Serve a rispondere a «l'app va a scatti» con un nome invece che con un
 * numero: seicento eventi al minuto non sono seicento entita' che cambiano
 * una volta, e la prova qui sotto e' proprio quella forma — una che parla
 * cento volte e tre che parlano una.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Chiacchieroni } from "../src/chiacchieroni.js";

const evento = (entita) =>
  JSON.stringify({
    id: 7,
    type: "event",
    event: {
      event_type: "state_changed",
      data: { entity_id: entita, new_state: { state: "on" } },
    },
  });

test("conta solo gli eventi, e li mette in classifica", () => {
  let quando = 1000;
  const conta = new Chiacchieroni({ adesso: () => quando });

  /* Roba che non e' un evento: una risposta, un pong, un saluto. Non conta. */
  conta.segna(JSON.stringify({ id: 1, type: "result", success: true, result: [] }));
  conta.segna(JSON.stringify({ type: "pong", id: 2 }));
  conta.segna("");
  conta.segna(null);

  for (let volta = 0; volta < 100; volta += 1) conta.segna(evento("sensor.potenza"));
  for (let volta = 0; volta < 12; volta += 1) conta.segna(evento("sensor.consumo"));
  conta.segna(evento("light.cucina"));

  const come = conta.elenco();
  assert.equal(come.eventi, 113);
  assert.equal(come.intero, false, "il minuto non e' ancora passato, e si dice");
  assert.deepEqual(come.quali, [
    { entita: "sensor.potenza", eventi: 100 },
    { entita: "sensor.consumo", eventi: 12 },
    { entita: "light.cucina", eventi: 1 },
  ]);

  /* Passato il minuto, si racconta il minuto **intero** appena finito: un
   * contatore azzerato tre secondi fa direbbe «due eventi» a una casa che ne
   * fa seicento, e chi guarda si tranquillizzerebbe per un difetto di chi
   * conta. */
  quando += 61_000;
  conta.segna(evento("light.sala"));
  const dopo = conta.elenco();
  assert.equal(dopo.intero, true);
  assert.equal(dopo.secondi, 60);
  assert.equal(dopo.eventi, 113);
  assert.equal(dopo.quali[0].entita, "sensor.potenza");

  /* E il minuto dopo racconta quello, non quello di prima. */
  quando += 61_000;
  const piuTardi = conta.elenco();
  assert.equal(piuTardi.eventi, 1);
  assert.deepEqual(piuTardi.quali, [{ entita: "light.sala", eventi: 1 }]);
});

test("un evento senza entita' conta nel totale e non fra i nomi", () => {
  /* `call_service`, `automation_triggered`: sono eventi, e non parlano di
   * un'entita' sola. Non si inventa un nome per loro, e non si fa finta che
   * non siano passati. */
  const conta = new Chiacchieroni({ adesso: () => 0 });
  conta.segna(JSON.stringify({ type: "event", event: { event_type: "call_service" } }));
  conta.segna(evento("light.cucina"));
  const come = conta.elenco();
  assert.equal(come.eventi, 2);
  assert.deepEqual(come.quali, [{ entita: "light.cucina", eventi: 1 }]);
});

test("si guarda solo la testa del messaggio", () => {
  /* Il nome sta in testa, e leggere per intero seicento eventi al minuto
   * vorrebbe dire fare per misurare il lavoro che si sta misurando. Il
   * prezzo: un nome che stesse in fondo non si conta — e non ci sta. */
  const conta = new Chiacchieroni({ adesso: () => 0 });
  const lontano =
    '{"type":"event","event":{"data":{"' + "x".repeat(500) + '":1,"entity_id":"sensor.tardi"}}}';
  conta.segna(lontano);
  const come = conta.elenco();
  assert.equal(come.eventi, 1, "che sia un evento si vede dalla testa, e si conta");
  assert.deepEqual(come.quali, [], "il nome era troppo in fondo: non si inventa");
});

test("ne nomina cinque, non trenta", () => {
  const conta = new Chiacchieroni({ adesso: () => 0 });
  for (let quale = 0; quale < 30; quale += 1) {
    for (let volta = 0; volta <= quale; volta += 1) conta.segna(evento(`sensor.n${quale}`));
  }
  const come = conta.elenco();
  assert.equal(come.quali.length, 5);
  assert.equal(come.quali[0].entita, "sensor.n29");
  assert.equal(come.quali[0].eventi, 30);
  /* E quanti se ne vogliono, per chi chiede. */
  assert.equal(conta.elenco(2).quali.length, 2);
});
