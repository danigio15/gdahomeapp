/* L'indirizzo nudo del centralino porta a gdahome.
 *
 * gdahome si apre anche da qui, e non solo dentro Home Assistant: dietro
 * l'ingress l'indirizzo dell'app non e' un link — vive finche' vive la pagina
 * che lo tiene aperto, e in una scheda a parte dopo qualche minuto risponde
 * 401. Il centralino invece e' un indirizzo vero, pubblico e in `https`, che
 * si apre da qualsiasi rete.
 *
 * I file li serve Cloudflare da `pubblico/app/` prima che la richiesta arrivi
 * al programma; queste prove guardano l'unica parte che e' nostra — che
 * l'indirizzo corto porti la' dentro, e che le vie del centralino non ne
 * abbiano sofferto.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import centralino from "../src/index.js";

const chiedi = (via, opzioni) =>
  centralino.fetch(new Request(`https://centralino.esempio${via}`, opzioni), {});

test("l'indirizzo nudo porta a /app/, che e' gdahome", async () => {
  for (const via of ["/", "/app"]) {
    const risposta = await chiedi(via);
    assert.equal(risposta.status, 302, via);
    assert.equal(risposta.headers.get("location"), "https://centralino.esempio/app/", via);
  }
});

test("il centralino resta un centralino: le sue vie non sono cambiate", async () => {
  const vivo = await chiedi("/salute");
  assert.equal(vivo.status, 200);
  assert.deepEqual(await vivo.json(), { vivo: true });

  /* Quello che non e' ne' l'app ne' una via del centralino risponde come
   * prima: non c'e' niente. */
  const niente = await chiedi("/qualcosa");
  assert.equal(niente.status, 404);

  /* E il redirect non si mette in mezzo a un telefono che bussa: quelle vie
   * chiedono l'aggiornamento a WebSocket, e non passano da qui. */
  const nonEUnBrowser = await chiedi("/app", { method: "POST" });
  assert.equal(nonEUnBrowser.status, 404);
});
