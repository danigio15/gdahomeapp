/* «Sono in casa, apro gdahome nel browser con l'indirizzo di fuori, e mi dice
 * che fuori casa serve Premium.» La casa vede da dove arriva la presa, e lo
 * dice — e con gdahome Base lo fa valere il portiere: qui le regole con cui
 * lo decide. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  arrivaDaCasa,
  eDiRetePrivata,
  indirizzoPulito,
  laReteDiCasa,
  passaDaUnProxy,
} from "../src/da-casa.js";

const richiesta = (remoteAddress, headers = {}) => ({ socket: { remoteAddress }, headers });

test("gli indirizzi delle reti di casa", () => {
  for (const ip of ["192.168.1.20", "10.0.0.5", "172.16.3.4", "172.31.255.1", "127.0.0.1", "::1"]) {
    assert.equal(eDiRetePrivata(ip), true, ip);
  }
  assert.equal(
    eDiRetePrivata("::ffff:192.168.1.20"),
    true,
    "IPv4 dentro IPv6, come lo scrive Node",
  );
  assert.equal(eDiRetePrivata("fd12:3456::1"), true, "le ULA");
  assert.equal(eDiRetePrivata("fe80::1%eth0"), true, "il link-local");
  for (const ip of ["8.8.8.8", "172.32.0.1", "100.101.102.103", "2a01:4f8::1", "unknown", ""]) {
    assert.equal(eDiRetePrivata(ip), false, ip);
  }
});

test("gli indirizzi si leggono anche con la porta", () => {
  assert.equal(indirizzoPulito("192.168.1.2:51234"), "192.168.1.2");
  assert.equal(indirizzoPulito("[2a01:4f8::1]:443"), "2a01:4f8::1");
  assert.equal(indirizzoPulito('"[fd00::1]"'), "fd00::1");
});

test("il telefono sulla rete di casa e' in casa; uno da internet no", () => {
  assert.equal(arrivaDaCasa(richiesta("::ffff:192.168.1.40")), true);
  assert.equal(arrivaDaCasa(richiesta("::ffff:93.40.1.2")), false);
  assert.equal(arrivaDaCasa(richiesta(undefined)), false, "nel dubbio si e' fuori");
});

test("un proxy davanti vuol dire fuori, qualunque cosa scriva", () => {
  /* Un telefono in casa bussa dritto alla macchina: in mezzo non c'e'
   * nessuno. Quello che un proxy scrive non si puo' verificare — uno
   * configurato male gira quello che gli scrive il visitatore — e con Base
   * nel dubbio si e' fuori. */
  assert.equal(
    arrivaDaCasa(richiesta("172.30.33.4", { "x-forwarded-for": "192.168.1.40" })),
    false,
  );
  assert.equal(
    arrivaDaCasa(richiesta("192.168.1.9", { "x-forwarded-for": "192.168.1.40" })),
    false,
  );
  assert.equal(arrivaDaCasa(richiesta("172.30.32.1", { "x-forwarded-for": "93.40.1.2" })), false);
  assert.equal(arrivaDaCasa(richiesta("127.0.0.1", { "cf-connecting-ip": "2a01:4f8::1" })), false);
  assert.equal(
    arrivaDaCasa(richiesta("172.30.32.1", { forwarded: 'for="[2a01:4f8::1]:443";proto=https' })),
    false,
  );
  assert.equal(arrivaDaCasa(richiesta("172.30.32.1", { "x-real-ip": "unknown" })), false);
  for (const nome of [
    "x-forwarded-proto",
    "x-forwarded-host",
    "cf-ray",
    "cdn-loop",
    "via",
    "true-client-ip",
    "tailscale-user-login",
    "x-ingress-path",
    "X-Forwarded-For",
  ]) {
    assert.equal(passaDaUnProxy({ [nome]: "qualcosa" }), true, nome);
    assert.equal(arrivaDaCasa(richiesta("192.168.1.40", { [nome]: "192.168.1.40" })), false, nome);
  }
  /* Quello che manda un telefono, o un browser, non c'entra. */
  assert.equal(
    passaDaUnProxy({
      host: "192.168.1.50:8098",
      upgrade: "websocket",
      connection: "Upgrade",
      "sec-websocket-key": "x",
      "user-agent": "Dart/3.5 (dart:io)",
      origin: "http://192.168.1.50:8098",
    }),
    false,
  );
});

test("chi si scrive da solo un indirizzo di casa resta fuori", () => {
  assert.equal(
    arrivaDaCasa(richiesta("172.30.32.1", { "x-forwarded-for": "192.168.1.5, 93.40.1.2" })),
    false,
  );
  assert.equal(arrivaDaCasa(richiesta("93.40.1.2", { "x-forwarded-for": "192.168.1.5" })), false);
});

/* Come risponde il Supervisor a `/network/info` su una casa vera: una scheda
 * di rete col suo IPv4 e il suo IPv6, il Wi-Fi spento, la scheda di una VPN,
 * e la rete fra gli add-on. */
const DAL_SUPERVISOR = {
  interfaces: [
    {
      interface: "enp0s18",
      type: "ethernet",
      enabled: true,
      connected: true,
      primary: true,
      ipv4: { method: "auto", address: ["192.168.1.50/24"], gateway: "192.168.1.1" },
      ipv6: {
        method: "auto",
        address: ["2a01:e0a:12:3450:aaaa:bbbb:cccc:dddd/128", "fe80::1234/64"],
        gateway: "fe80::1",
      },
    },
    {
      interface: "wlan0",
      type: "wireless",
      enabled: false,
      ipv4: { address: ["10.9.9.9/24"] },
    },
    { interface: "zt0", type: "zerotier", enabled: true, ipv4: { address: ["10.147.17.2/24"] } },
  ],
  docker: {
    interface: "hassio",
    address: "172.30.32.0/23",
    gateway: "172.30.32.1",
  },
};

test("la rete di casa si legge da quello che dice il Supervisor", () => {
  const rete = laReteDiCasa(DAL_SUPERVISOR);
  assert.deepEqual(rete.reti, [
    { ip: "192.168.1.50", bit: 24 },
    { ip: "2a01:e0a:12:3450:aaaa:bbbb:cccc:dddd", bit: 64 },
  ]);
  assert.deepEqual(rete.macchina, [{ ip: "172.30.32.0", bit: 23 }]);
  assert.ok(rete.propri.includes("192.168.1.50"));
  assert.ok(rete.propri.includes("192.168.1.1"), "il router");
  assert.equal(laReteDiCasa(null), null);
  assert.equal(laReteDiCasa({ interfaces: "storto" }), null);
  /* Una scheda con l'indirizzo pubblico non fa «di casa» i vicini di rack. */
  assert.deepEqual(
    laReteDiCasa({ interfaces: [{ type: "ethernet", ipv4: { address: ["85.1.2.3/24"] } }] }).reti,
    [],
  );
});

test("con la rete di casa saputa: la stessa sottorete e' casa, il resto no", () => {
  const rete = laReteDiCasa(DAL_SUPERVISOR);
  const casi = [
    // Il telefono sul Wi-Fi di casa, IPv4 e IPv6 dello stesso /64.
    ["192.168.1.40", true],
    ["::ffff:192.168.1.77", true],
    ["2a01:e0a:12:3450:1:2:3:4", true],
    // Un altro /64, o un altro IPv6 qualunque: fuori.
    ["2a01:e0a:12:3451:1:2:3:4", false],
    ["2a01:4f8::1", false],
    // La macchina stessa, e il router: chi bussa con il loro indirizzo gira
    // qualcosa (il giro del router, un subnet router di Tailscale).
    ["192.168.1.50", false],
    ["192.168.1.1", false],
    // La rete fra gli add-on: NGINX, cloudflared, il giro della macchina.
    ["172.30.32.1", false],
    ["172.30.33.7", false],
    // Una VPN con la sua rete privata (WireGuard, OpenVPN, ZeroTier).
    ["10.147.17.9", false],
    ["172.27.66.2", false],
    ["10.8.0.6", false],
    // Tailscale, e il CGNAT dei gestori.
    ["100.101.102.103", false],
    // Internet.
    ["93.40.1.2", false],
    // Il link-local, in un contenitore, e' di un altro contenitore.
    ["fe80::1234", false],
    ["169.254.3.4", false],
    // Il loopback del contenitore: solo chi gira dentro l'add-on.
    ["127.0.0.1", true],
  ];
  for (const [ip, atteso] of casi) {
    assert.equal(arrivaDaCasa(richiesta(ip), rete), atteso, ip);
  }
});

test("senza la rete di casa basta un indirizzo privato, ma non quello della macchina", () => {
  /* Finche' il Supervisor non risponde. */
  for (const [ip, atteso] of [
    ["192.168.1.40", true],
    ["10.0.0.5", true],
    ["fd12:3456::1", true],
    ["172.30.32.1", false],
    ["172.30.33.7", false],
    ["fd0c:ac1e:2100::5", false],
    ["100.101.102.103", false],
    ["2a01:e0a:12:3450:1:2:3:4", false],
    ["fe80::1", false],
  ]) {
    assert.equal(arrivaDaCasa(richiesta(ip)), atteso, ip);
  }
});
