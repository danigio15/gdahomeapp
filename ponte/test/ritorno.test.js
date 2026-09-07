/* Le prove di «dove tornare».
 *
 * Il pezzo che conta e' la lettura di quello che dice il Supervisor: quella
 * risposta non la decidiamo noi, cambia fra una versione e l'altra, e se ne
 * tirasse fuori l'indirizzo sbagliato il telefono lo proverebbe a ogni
 * apertura dell'app e aspetterebbe che scada, tutti i giorni, senza che
 * nessuno capisca perche' l'app «ci mette».
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Ritorno, leggiGliIndirizzi } from "../src/ritorno.js";

const identita = { casa: "casa_00112233445566778899aabbccddeeff" };

/* ─── Leggere il Supervisor ──────────────────────────────────────────────── */

test("tiene gli indirizzi di casa e butta via quelli che non servono", () => {
  const trovati = leggiGliIndirizzi(
    {
      interfaces: [
        /* La rete fra gli add-on: un telefono li' sopra non ci arriva mai. */
        { enabled: true, ipv4: { address: ["172.30.32.2/23"] } },
        { enabled: true, ipv4: { address: ["192.168.1.50/24"] } },
        /* Spenta: l'indirizzo c'e' scritto ma non risponde nessuno. */
        { enabled: false, ipv4: { address: ["10.0.0.9/8"] } },
        /* Quello che si prende quando nessuno ha dato un indirizzo. */
        { enabled: true, ipv4: { address: ["169.254.4.4/16"] } },
        { enabled: true, ipv4: { address: ["127.0.0.1/8"] } },
      ],
    },
    8098,
  );
  assert.deepEqual(trovati, ["192.168.1.50:8098"]);
});

test("una scheda con due indirizzi li da' tutti e due, senza ripetizioni", () => {
  const trovati = leggiGliIndirizzi(
    {
      interfaces: [
        { ipv4: { address: ["192.168.1.50/24", "10.1.2.3/24"] } },
        { ipv4: { address: ["10.1.2.3/24"] } },
      ],
    },
    8098,
  );
  assert.deepEqual(trovati, ["192.168.1.50:8098", "10.1.2.3:8098"]);
});

test("piu' di quattro indirizzi si tagliano", () => {
  const tante = Array.from({ length: 9 }, (_, i) => ({
    ipv4: { address: [`10.0.0.${i + 1}/24`] },
  }));
  assert.equal(leggiGliIndirizzi({ interfaces: tante }, 8098).length, 4);
});

test("una risposta che non ha la forma che ci aspettiamo non fa danni", () => {
  for (const spazzatura of [null, undefined, {}, { interfaces: "no" }, { interfaces: [null, 3] }]) {
    assert.deepEqual(leggiGliIndirizzi(spazzatura, 8098), []);
  }
  assert.deepEqual(leggiGliIndirizzi({ interfaces: [{ ipv4: { address: ["ciao"] } }] }, 8098), []);
});

/* ─── Quello che si dice al telefono ─────────────────────────────────────── */

test("dice chi e' la casa, dove si chiama, e dove sta in casa", async () => {
  const ritorno = new Ritorno({
    identita,
    centralino: "wss://centralino.esempio.it/",
    porta: 8098,
    segno: "un-segno",
    fetch: async () => ({
      ok: true,
      json: async () => ({ data: { interfaces: [{ ipv4: { address: ["192.168.1.50/24"] } }] } }),
    }),
  });

  assert.deepEqual(await ritorno.cosaDire(), {
    casa: identita.casa,
    /* Senza la sbarra in fondo: il telefono ci attacca dietro `/telefono/…`. */
    centralino: "wss://centralino.esempio.it",
    indirizzi: ["192.168.1.50:8098"],
  });
});

test("senza centralino lo dice, invece di far finta", async () => {
  const ritorno = new Ritorno({ identita, centralino: "", segno: "", fetch: null });
  const detto = await ritorno.cosaDire();
  assert.equal(detto.centralino, null);
  assert.deepEqual(detto.indirizzi, []);
});

test("lo chiede una volta sola e poi se lo ricorda", async () => {
  let quante = 0;
  const ritorno = new Ritorno({
    identita,
    segno: "un-segno",
    quantoDura: 60_000,
    fetch: async () => {
      quante += 1;
      return { ok: true, json: async () => ({ data: { interfaces: [] } }) };
    },
  });
  await ritorno.cosaDire();
  await ritorno.cosaDire();
  await ritorno.cosaDire();
  assert.equal(quante, 1, "un abbinamento non e' il momento di aspettare la rete");
});

test("dopo un po' lo richiede: gli indirizzi di casa cambiano", async () => {
  let quante = 0;
  let ora = 1000;
  const ritorno = new Ritorno({
    identita,
    segno: "un-segno",
    quantoDura: 100,
    adesso: () => ora,
    fetch: async () => {
      quante += 1;
      return { ok: true, json: async () => ({ data: { interfaces: [] } }) };
    },
  });
  await ritorno.cosaDire();
  ora += 500;
  await ritorno.cosaDire();
  assert.equal(quante, 2);
});

/* ─── Quando il Supervisor non risponde ──────────────────────────────────── */

test("un Supervisor che dice di no non fa fallire un abbinamento", async () => {
  /* Questa e' la prova che conta piu' delle altre. Il permesso puo' mancare,
   * il Supervisor puo' essere vecchio, si puo' star girando su un computer:
   * in tutti quei casi si perde la strada veloce, e si tiene l'abbinamento. */
  const guai = [
    async () => ({ ok: false, status: 403 }),
    async () => {
      throw new Error("non risponde nessuno");
    },
    async () => ({ ok: true, json: async () => JSON.parse("questo non e' json") }),
  ];
  for (const fetch of guai) {
    const ritorno = new Ritorno({ identita, segno: "un-segno", fetch });
    const detto = await ritorno.cosaDire();
    assert.equal(detto.casa, identita.casa);
    assert.deepEqual(detto.indirizzi, []);
  }
});
