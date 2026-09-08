/* Il centralino, sulla nuvola.
 *
 *      il telefono                                    la casa
 *           │                                            │
 *           │  wss://…/telefono/casa_9f3a…               │  wss://…/casa/casa_9f3a…
 *           └──────────────►  ┌──────────────┐  ◄────────┘
 *                             │  centralino  │   (chiama lei, sempre)
 *                             └──────────────┘
 *
 * E' lo stesso centralino che sta in `../centralino`, scritto per girare su
 * Cloudflare invece che su una macchina. Fa esattamente le stesse cose e parla
 * esattamente la stessa lingua — le due sono intercambiabili, e la stessa
 * prova dal vivo passa contro tutte e due.
 *
 * ─── Perche' esiste questa seconda versione ───────────────────────────────
 *
 * Perche' un centralino da tenere acceso e' un server da pagare, e chiedere a
 * qualcuno cinque euro al mese per accendere una luce da fuori casa e' il modo
 * piu' rapido di far chiudere l'app. Qui non c'e' niente da pagare e niente da
 * tenere aggiornato: il piano gratuito basta con molto margine, e l'indirizzo
 * — `centralino.<nome>.workers.dev` — arriva insieme.
 *
 * ─── Quello che il centralino NON fa, ed e' la parte importante ───────────
 *
 * Non verifica niente che sia un segreto. Non sa se un codice di abbinamento
 * e' giusto — instrada sulla sua *impronta*, e il codice non lo vede mai. Non
 * sa se il segno di un telefono e' buono: lo passa alla casa, che lo verifica
 * lei. Non guarda dentro ai messaggi: sono byte, e li sposta.
 *
 * L'unica cosa che difende e' che una casa non possa spacciarsi per un'altra —
 * perche' se ci riuscisse raccoglierebbe i segni dei telefoni che bussano.
 *
 * ─── Una casa, un oggetto ─────────────────────────────────────────────────
 *
 * Ogni casa e' un Durable Object suo. Il filo della casa e quelli dei suoi
 * telefoni stanno tutti li' dentro, e non c'e' niente di condiviso da
 * sincronizzare: due case non si vedono nemmeno. Quando non passa niente
 * l'oggetto **dorme** — i fili restano aperti, li tiene su Cloudflare — e si
 * sveglia solo quando arriva un messaggio. E' il motivo per cui mille case
 * ferme non costano niente.
 */

export { Casa } from "./casa.js";
export { Codice } from "./codice.js";

import { quellaCasa, quelCodice } from "./dove.js";
import { CASA_VALIDA, IMPRONTA_VALIDA } from "./nomi.js";

export default {
  async fetch(richiesta, env) {
    const via = new URL(richiesta.url).pathname;

    if (via === "/salute" && richiesta.method === "GET") {
      return risposta({ vivo: true });
    }

    if (richiesta.headers.get("Upgrade") !== "websocket") {
      /* Le segnalazioni e la chat di una casa: HTTP, verso il suo oggetto,
       * che e' l'unico a sapere se il segreto e' il suo. */
      const inCasa = /^\/casa\/([A-Za-z0-9_]+)\/(segnalazioni|chat)(\/|$)/.exec(via);
      if (inCasa && CASA_VALIDA.test(inCasa[1])) {
        return quellaCasa(env, inCasa[1]).fetch(richiesta);
      }
      return risposta({ errore: "qui non c'e' niente" }, 404);
    }

    /* La casa che chiama fuori. L'identificativo nell'indirizzo non e' un
     * segreto e non fa entrare: serve a sapere **quale oggetto** deve
     * ricevere questo filo, e quella scelta va fatta prima di accettarlo.
     * Quello che fa entrare arriva subito dopo, nel primo messaggio. */
    const laCasa = /^\/casa\/([A-Za-z0-9_]+)$/.exec(via);
    if (laCasa && CASA_VALIDA.test(laCasa[1])) {
      return quellaCasa(env, laCasa[1]).fetch(richiesta);
    }

    /* Un telefono che sa a quale casa va. */
    const ilTelefono = /^\/telefono\/([A-Za-z0-9_]+)$/.exec(via);
    if (ilTelefono && CASA_VALIDA.test(ilTelefono[1])) {
      return quellaCasa(env, ilTelefono[1]).fetch(richiesta);
    }

    /* Un telefono che si sta abbinando non sa ancora a quale casa va: sa solo
     * il codice, e nemmeno quello arriva qui — arriva la sua impronta. */
    const inAbbinamento = /^\/abbinamento\/([0-9a-f]+)$/.exec(via);
    if (inAbbinamento && IMPRONTA_VALIDA.test(inAbbinamento[1])) {
      const dove = await quelCodice(env, inAbbinamento[1]).fetch("https://centralino/quale");
      const { casa } = await dove.json();
      if (!casa) return chiudiSubito("nessun abbinamento in corso");
      return quellaCasa(env, casa).fetch(richiesta);
    }

    return risposta({ errore: "qui non c'e' niente" }, 404);
  },
};

function risposta(corpo, stato = 200) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      /* Il centralino lo chiama anche una versione web dell'app, da un'origine
       * qualunque. Non c'e' niente da difendere con l'origine: qui non ci sono
       * biscotti e nessuna autorita' implicita — chi bussa senza sapere niente
       * non ottiene niente. */
      "access-control-allow-origin": "*",
    },
  });
}

/* Rifiutare **dicendolo**, con il filo aperto per un istante.
 *
 * Chiudere e basta — un 404 secco — sarebbe la cosa peggiore: chi bussa
 * vedrebbe un errore di rete, che e' quello che succede mille volte al giorno,
 * e riproverebbe all'infinito. Aprire e chiudere subito con un motivo scritto
 * costa un istante e dice a chi ascolta che non e' colpa della rete. */
function chiudiSubito(perche) {
  const [alClient, mia] = Object.values(new WebSocketPair());
  mia.accept();
  mia.close(1000, perche);
  return new Response(null, { status: 101, webSocket: alClient });
}
