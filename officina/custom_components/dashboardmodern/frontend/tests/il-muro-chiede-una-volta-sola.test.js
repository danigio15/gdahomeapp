/* Il pannello a muro che si apre chiede la licenza e la plancia di origine una
 * volta sola.
 *
 * «Ha difficolta' ad aprire la pagina della plancia su HA. Quando l'ha aperta
 * le entita' sono "non trovate" per poi dopo arrivare.» Dentro Home Assistant
 * ogni domanda al ponte e' una presa nuova, e per il ponte un filo nuovo verso
 * Home Assistant. All'apertura `rileggi` parte da cinque avvisi insieme, e
 * ognuno chiedeva per conto suo: sei domande per la licenza e sette per la
 * plancia di origine, tredici fili per due risposte — su una casa lenta,
 * secondi di pannello con le luci «Non trovata». Adesso chi arriva mentre una
 * domanda e' in viaggio aspetta quella.
 *
 * E un ponte che non risponde in tempo non fa piu' diventare la casa «Base»
 * nel ricordo del tablet: si tiene quello che si sapeva, e si richiede. */
import assert from "node:assert/strict";
import test from "node:test";

const domande = [];
let rispondi = true;

class PresaFinta {
  constructor() {
    this.readyState = 0;
    setTimeout(() => {
      this.readyState = 1;
      this.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
    }, 5);
  }
  send(testo) {
    const detto = JSON.parse(testo);
    domande.push(detto.type);
    if (!rispondi) return;
    const result =
      detto.type === "ponte/licenza/stato"
        ? { gdahome: { attiva: true } }
        : {
            snapshot: {
              values: { cd_luci: JSON.stringify({ "light.led_centrali": "LED centrali" }) },
            },
          };
    setTimeout(
      () =>
        this.onmessage?.({
          data: JSON.stringify({ id: detto.id, type: "result", success: true, result }),
        }),
      20,
    );
  }
  close() {
    this.readyState = 3;
  }
}

globalThis.__DASHBOARDMODERN_HOSTED__ = true;
globalThis.__DASHBOARDMODERN_BRIDGE_WS__ = PresaFinta;
globalThis.__DASHBOARDMODERN_PROFILE__ = "salone";

const { premiumDellaCasa, fonteDelMuro } =
  await import("../src/sections/plancia-a-muro-section.js");

test("cinque richieste insieme: una domanda per la licenza e una per l'origine", async () => {
  domande.length = 0;
  const licenze = await Promise.all([1, 2, 3, 4, 5].map(() => premiumDellaCasa({ forza: true })));
  assert.deepEqual(licenze, [true, true, true, true, true]);
  const fonti = await Promise.all(
    [1, 2, 3, 4, 5].map(() => fonteDelMuro({ fonte: "primary" }, { forza: true })),
  );
  assert.equal(new Set(fonti).size, 1, "tutti hanno la stessa risposta");
  assert.deepEqual(domande, ["ponte/licenza/stato", "dashboardmodern/config/get"]);
  /* Finita la domanda, la prossima parte davvero. */
  await premiumDellaCasa({ forza: true });
  assert.equal(domande.filter((tipo) => tipo === "ponte/licenza/stato").length, 2);
});

test("un ponte che non risponde in tempo non fa diventare la casa Base", async () => {
  rispondi = false;
  const prima = Date.now();
  const detto = await premiumDellaCasa({ forza: true });
  rispondi = true;
  assert.equal(detto, true, "si tiene quello che si sapeva");
  assert.ok(Date.now() - prima >= 7000, "ha aspettato la sua attesa");
  /* E non si e' scritto «Base» nel ricordo del tablet. */
  const ricordo = JSON.parse(globalThis.localStorage?.getItem?.("dm_muro_ricordo") || "{}");
  assert.notEqual(ricordo.premium, false);
});
