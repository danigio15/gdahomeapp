/* Un centralino finto per le segnalazioni.
 *
 * Il ponte del collaudo chiama qui invece che sulla nuvola: accetta la
 * chiamata della casa (cosi' il ponte si crede collegato da fuori), e tiene
 * le segnalazioni e la chat in memoria, rispondendo come risponde il
 * centralino vero. Il manutentore finto risponde da solo dopo un attimo,
 * cosi' nelle fotografie si vede un filo con due voci.
 *
 * Non instrada telefoni: nel collaudo il telefono entra dalla porta di casa.
 */

import { createServer } from "node:http";

import { accetta, eUnaSalita } from "../ponte/src/presa.js";

export async function alzaIlCentralinoFinto({
  risposta = "Grazie, guardo subito e ti dico.",
} = {}) {
  const issue = new Map();
  let prossimo = 12;
  let chat = null;
  const arrivate = [];

  const filo = (numero) => {
    const una = issue.get(numero);
    return {
      numero,
      tipo: una.tipo,
      titolo: una.titolo,
      stato: "aperta",
      aperta_il: una.apertaIl,
      url: `https://github.com/esempio/gdahome-segnalazioni/issues/${numero}`,
      messaggi: una.messaggi,
    };
  };
  const ilManutentoreRisponde = (numero) =>
    setTimeout(() => {
      const una = issue.get(numero);
      if (una)
        una.messaggi.push({ da: "manutentore", testo: risposta, il: new Date().toISOString() });
    }, 1500);

  const server = createServer(async (richiesta, risposta) => {
    let corpo = "";
    for await (const pezzo of richiesta) corpo += pezzo;
    let detto = {};
    try {
      detto = corpo ? JSON.parse(corpo) : {};
    } catch (_errore) {
      /* Vuoto. */
    }
    arrivate.push({ metodo: richiesta.method, via: richiesta.url, detto });
    const json = (cosa, stato = 200) => {
      risposta.writeHead(stato, { "content-type": "application/json" });
      risposta.end(JSON.stringify(cosa));
    };
    if (!/^Casa .+/.test(richiesta.headers.authorization || "")) {
      return json({ errore: "senza_segreto", spiegazione: "serve il segreto della casa" }, 401);
    }
    const via = richiesta.url.replace(/^\/casa\/[A-Za-z0-9_]+/, "");
    let m;
    if (via === "/segnalazioni" && richiesta.method === "GET") {
      return json({
        segnalazioni: [...issue.entries()]
          .filter(([, una]) => una.tipo !== "chat")
          .map(([numero, una]) => ({
            numero,
            tipo: una.tipo,
            titolo: una.titolo,
            stato: "aperta",
            aperta_il: una.apertaIl,
          })),
      });
    }
    if (via === "/segnalazioni" && richiesta.method === "POST") {
      const numero = prossimo++;
      issue.set(numero, {
        tipo: detto.tipo || "problema",
        titolo: detto.titolo || "",
        apertaIl: new Date().toISOString(),
        messaggi: [{ da: "casa", testo: detto.corpo || "", il: new Date().toISOString() }],
      });
      ilManutentoreRisponde(numero);
      return json(filo(numero), 201);
    }
    if ((m = /^\/segnalazioni\/(\d+)$/.exec(via)) && richiesta.method === "GET") {
      if (!issue.has(Number(m[1])))
        return json({ errore: "non_trovata", spiegazione: "non e' tua" }, 404);
      return json(filo(Number(m[1])));
    }
    if ((m = /^\/segnalazioni\/(\d+)\/risposte$/.exec(via)) && richiesta.method === "POST") {
      const una = issue.get(Number(m[1]));
      if (!una) return json({ errore: "non_trovata", spiegazione: "non e' tua" }, 404);
      una.messaggi.push({ da: "casa", testo: detto.testo || "", il: new Date().toISOString() });
      return json(filo(Number(m[1])));
    }
    if (via === "/chat" && richiesta.method === "GET")
      return json({ chat: chat ? filo(chat) : null });
    if (via === "/chat/messaggi" && richiesta.method === "POST") {
      if (!chat) {
        chat = prossimo++;
        issue.set(chat, {
          tipo: "chat",
          titolo: "Chat di assistenza",
          apertaIl: new Date().toISOString(),
          messaggi: [],
        });
      }
      issue
        .get(chat)
        .messaggi.push({ da: "casa", testo: detto.testo || "", il: new Date().toISOString() });
      ilManutentoreRisponde(chat);
      return json(filo(chat), 201);
    }
    json({ errore: "non_trovato", spiegazione: "qui non c'e' niente" }, 404);
  });

  /* La chiamata della casa: si accetta, si dice «bene», e ai colpetti si
   * risponde. Cosi' il ponte non passa il collaudo a ribussare. */
  const prese = [];
  server.on("upgrade", (richiesta, socket) => {
    if (!eUnaSalita(richiesta)) {
      socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
      return;
    }
    const presa = accetta(richiesta, socket, {
      onMessaggio: (testo) => {
        let detto;
        try {
          detto = JSON.parse(testo);
        } catch (_errore) {
          return;
        }
        if (detto?.t === "sono-io") presa.manda(JSON.stringify({ t: "bene" }));
        else if (detto?.t === "battito") presa.manda(testo);
      },
    });
    if (presa) prese.push(presa);
  });

  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return {
    porta: server.address().port,
    indirizzo: `ws://127.0.0.1:${server.address().port}`,
    arrivate,
    spegni: () =>
      new Promise((ok) => {
        for (const presa of prese) presa.chiudi();
        server.close(ok);
      }),
  };
}
