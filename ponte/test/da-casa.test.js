/* «Sono in casa, apro gdahome nel browser con l'indirizzo di fuori, e mi dice
 * che fuori casa serve Premium.» La casa vede da dove arriva la presa, e lo
 * dice: qui le regole con cui lo decide. */
import assert from "node:assert/strict";
import test from "node:test";
import { arrivaDaCasa, eDiRetePrivata, indirizzoPulito } from "../src/da-casa.js";

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

test("dietro un proxy conta chi ha parlato al proxy", () => {
  // In casa, col dominio pubblico: il router riporta dentro, il proxy lo scrive.
  assert.equal(arrivaDaCasa(richiesta("172.30.32.1", { "x-forwarded-for": "192.168.1.40" })), true);
  // Da fuori, col dominio pubblico.
  assert.equal(arrivaDaCasa(richiesta("172.30.32.1", { "x-forwarded-for": "93.40.1.2" })), false);
  assert.equal(arrivaDaCasa(richiesta("127.0.0.1", { "cf-connecting-ip": "2a01:4f8::1" })), false);
  assert.equal(
    arrivaDaCasa(richiesta("172.30.32.1", { forwarded: 'for="[2a01:4f8::1]:443";proto=https' })),
    false,
  );
  assert.equal(arrivaDaCasa(richiesta("172.30.32.1", { "x-real-ip": "unknown" })), false);
});

test("chi si scrive da solo un indirizzo di casa resta fuori", () => {
  /* Il proxy aggiunge in fondo quello vero: si guardano tutti, non il primo. */
  assert.equal(
    arrivaDaCasa(richiesta("172.30.32.1", { "x-forwarded-for": "192.168.1.5, 93.40.1.2" })),
    false,
  );
});
