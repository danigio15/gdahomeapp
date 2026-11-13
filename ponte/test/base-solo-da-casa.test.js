/* Con gdahome Base l'app si apre solo dalla rete di casa: qualunque strada.
 *
 * «Con Base l'app deve funzionare SOLO dalla rete di casa: da fuori casa
 * bloccata sempre, il centralino ma anche una porta aperta sul router, un
 * proxy, una VPN.» Il centralino e' in `licenza-da-fuori.test.js`; qui la
 * porta dell'app, vera, con un portiere e un ponte veri:
 *
 *   - dal loopback (la rete di casa, nelle prove) si entra;
 *   - dall'indirizzo vero di questa macchina, che non sta nella rete di casa
 *     detta dal Supervisor — com'e' un telefono arrivato da una porta aperta
 *     sul router o da una VPN — si resta fuori con `4402 premium-richiesto`,
 *     e con Premium si entra;
 *   - una richiesta con le intestazioni di un proxy e' «da fuori» anche se
 *     arriva dal loopback;
 *   - chi era dentro da fuori, quando la casa torna Base, esce.
 *
 * E il Ritorno, che la rete di casa la chiede al Supervisor.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { request } from "node:http";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";

import { Abbinamento } from "../src/abbinamento.js";
import { laReteDiCasa } from "../src/da-casa.js";
import { Dispositivi } from "../src/dispositivi.js";
import { Ponte } from "../src/ponte.js";
import { Portiere } from "../src/portiere.js";
import { Ritorno } from "../src/ritorno.js";
import { costruisciLaPortaDellApp } from "../src/server.js";
import { telefonoCifrato } from "./telefono-cifrato.js";

const ZITTO = { debug() {}, info() {}, attenzione() {}, errore() {} };

/* Una rete di casa che non e' quella di questa macchina: chi bussa
 * dall'indirizzo vero della macchina, per lei, e' fuori. */
const UN_ALTRA_RETE = laReteDiCasa({
  interfaces: [
    { type: "ethernet", enabled: true, ipv4: { address: ["192.168.250.10/24"] } },
    { type: "ethernet", enabled: true, ipv6: { address: ["fd99:8877:6655:4433::10/64"] } },
  ],
});

/* L'indirizzo vero di questa macchina, se ne ha uno che non sia il loopback
 * e non stia nella rete qui sopra. */
function lIndirizzoVero() {
  for (const schede of Object.values(networkInterfaces())) {
    for (const una of schede ?? []) {
      if (una.internal || una.family !== "IPv4") continue;
      if (una.address.startsWith("192.168.250.") || una.address.startsWith("169.254.")) continue;
      return una.address;
    }
  }
  return null;
}

async function unaPorta({ soloInCasa }) {
  const cartella = mkdtempSync(join(tmpdir(), "solo-da-casa-"));
  const dispositivi = new Dispositivi({ cartella });
  const ponte = new Ponte({ casa: null, dispositivi, registro: ZITTO });
  const portiere = new Portiere({
    ponte,
    dispositivi,
    abbinamento: new Abbinamento({}),
    registro: ZITTO,
    soloInCasa,
  });
  const server = costruisciLaPortaDellApp({
    portiere,
    registro: ZITTO,
    reteDiCasa: () => UN_ALTRA_RETE,
  });
  await new Promise((ok) => server.listen(0, "0.0.0.0", ok));
  const porta = server.address().port;
  return {
    porta,
    ponte,
    dispositivi,
    spegni: async () => {
      ponte.chiudiTutto();
      server.closeAllConnections?.();
      await new Promise((ok) => server.close(ok));
      rmSync(cartella, { recursive: true, force: true });
    },
  };
}

/* Un telefono abbinato che bussa a quell'indirizzo, e come si e' chiuso. */
function bussa(b, dove) {
  const { chiave, dispositivo } = b.dispositivi.abbina({ nome: "telefono" });
  const telefono = telefonoCifrato(`ws://${dove}:${b.porta}/casa`, {
    chi: dispositivo.id,
    chiave,
  });
  const chiusura = new Promise((ok) =>
    telefono.presa.addEventListener("close", (evento) =>
      ok({ codice: evento.code, motivo: evento.reason }),
    ),
  );
  telefono.dentro.catch(() => {});
  return { telefono, chiusura };
}

test("con Base, dalla rete di casa si entra", async () => {
  const b = await unaPorta({ soloInCasa: () => true });
  try {
    const { telefono } = bussa(b, "127.0.0.1");
    await telefono.dentro;
    assert.equal((await telefono.aspetta("auth_required")).type, "auth_required");
    assert.equal([...b.ponte.collegamenti][0]?.daCasa, true);
    telefono.chiudi();
  } finally {
    await b.spegni();
  }
});

test("con Base, dalla porta dell'app raggiunta da fuori della rete di casa si resta fuori", async (t) => {
  const vero = lIndirizzoVero();
  if (!vero) {
    t.skip("questa macchina non ha un indirizzo oltre al loopback");
    return;
  }
  let base = true;
  const b = await unaPorta({ soloInCasa: () => base });
  try {
    /* Il `/salute` lo dice, e il portiere lo fa valere. */
    const salute = await (await fetch(`http://${vero}:${b.porta}/salute`)).json();
    assert.deepEqual(salute, { vivo: true, da_casa: false });

    const fuori = bussa(b, vero);
    await assert.rejects(fuori.telefono.dentro);
    assert.deepEqual(await fuori.chiusura, { codice: 4402, motivo: "premium-richiesto" });
    assert.equal(fuori.telefono.inChiaro.find((uno) => uno.no)?.motivo, "premium-richiesto");
    assert.equal(b.ponte.quantiCollegati(), 0, "nessun filo con la casa");

    /* Premium: si entra anche da li'. */
    base = false;
    const dentro = bussa(b, vero);
    await dentro.telefono.dentro;
    assert.equal((await dentro.telefono.aspetta("auth_required")).type, "auth_required");
    assert.equal(b.ponte.quantiCollegati(), 1);

    /* E la casa torna Base: chi era dentro da fuori esce, col numero che
     * l'app conosce. Chi e' in casa resta. */
    const inCasa = bussa(b, "127.0.0.1");
    await inCasa.telefono.dentro;
    await inCasa.telefono.aspetta("auth_required");
    base = true;
    assert.equal(b.ponte.chiudiQuelliDaFuori(), 1);
    assert.deepEqual(await dentro.chiusura, { codice: 4402, motivo: "premium-richiesto" });
    assert.equal(b.ponte.quantiCollegati(), 1, "quello di casa resta");
    inCasa.telefono.chiudi();
  } finally {
    await b.spegni();
  }
});

/* Una salita a mano, per poter scrivere le intestazioni che scrive un
 * proxy: il WebSocket di Node non lo lascia fare. */
function unaSalita(porta, intestazioni) {
  return new Promise((ok, no) => {
    const chiesta = request({
      host: "127.0.0.1",
      port: porta,
      path: "/casa",
      headers: {
        connection: "Upgrade",
        upgrade: "websocket",
        "sec-websocket-version": "13",
        "sec-websocket-key": Buffer.from("una chiave a caso").toString("base64"),
        ...intestazioni,
      },
    });
    chiesta.on("upgrade", (_risposta, socket) => ok(socket));
    chiesta.on("response", (risposta) => no(new Error(`niente salita: ${risposta.statusCode}`)));
    chiesta.on("error", no);
    chiesta.end();
  });
}

test("dietro un proxy si e' fuori, anche se il proxy sta in casa", async () => {
  /* L'add-on NGINX, il tunnel di Cloudflare, Tailscale: chi passa da loro
   * arriva con le loro intestazioni, e da qui non si puo' sapere dov'era. */
  const visti = [];
  const portiere = {
    accogli: (presa, come) => {
      visti.push(come);
      presa.chiudi(1000, "");
    },
  };
  const server = costruisciLaPortaDellApp({ portiere, registro: ZITTO });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const porta = server.address().port;
  try {
    for (const intestazioni of [
      {},
      { "x-forwarded-for": "192.168.1.40" },
      { "cf-connecting-ip": "93.40.1.2" },
      { forwarded: "for=192.168.1.40" },
      { "x-real-ip": "192.168.1.40" },
      { "tailscale-user-login": "qualcuno@example.com" },
    ]) {
      const socket = await unaSalita(porta, intestazioni);
      socket.destroy();
      const salute = await (
        await fetch(`http://127.0.0.1:${porta}/salute`, { headers: intestazioni })
      ).json();
      const atteso = Object.keys(intestazioni).length === 0;
      assert.equal(salute.da_casa, atteso, JSON.stringify(intestazioni));
    }
    assert.deepEqual(
      visti.map((uno) => uno.daCasa),
      [true, false, false, false, false, false],
    );
  } finally {
    server.closeAllConnections?.();
    await new Promise((ok) => server.close(ok));
  }
});

test("il Ritorno sa la rete di casa dal Supervisor, e la tiene se smette di rispondere", async () => {
  let risponde = true;
  let chieste = 0;
  let ora = 0;
  const ritorno = new Ritorno({
    segno: "segno-del-supervisor",
    supervisor: "http://supervisor",
    registro: ZITTO,
    adesso: () => ora,
    fetch: async () => {
      chieste += 1;
      if (!risponde) return { ok: false, status: 502, json: async () => ({}) };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            interfaces: [
              {
                type: "ethernet",
                enabled: true,
                ipv4: { address: ["192.168.1.50/24"], gateway: "192.168.1.1" },
              },
            ],
            docker: { address: "172.30.32.0/23", gateway: "172.30.32.1" },
          },
        }),
      };
    },
  });
  assert.equal(ritorno.reteDiCasa(), null, "finche' non ha risposto non si sa");
  await ritorno._chiedendo;
  assert.deepEqual(ritorno.reteDiCasa().reti, [{ ip: "192.168.1.50", bit: 24 }]);
  assert.equal(chieste, 1, "e non si richiede a ogni presa");

  risponde = false;
  ora += 10 * 60 * 1000;
  const prima = ritorno.reteDiCasa();
  await ritorno._chiedendo;
  assert.equal(chieste, 2);
  assert.equal(ritorno.reteDiCasa(), prima, "resta l'ultima buona");
});
