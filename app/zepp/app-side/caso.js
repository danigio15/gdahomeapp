/* Il caso: i byte che nessuno deve poter indovinare.
 *
 * Servono a due cose sole, e tutte e due alla stretta di mano: la chiave
 * effimera X25519 e l'`apertura`. Di solito li da' il sistema
 * (`crypto.getRandomValues`), ed e' la strada buona. Ma l'app Zepp non
 * promette di averlo nel servizio di fianco, e allora c'e' un ripiego.
 *
 * ─── Il ripiego, e perche' basta ─────────────────────────────────────────
 *
 * Un generatore HMAC-DRBG (SHA-256), rinfrescato a ogni richiesta con quello
 * che c'e' — l'ora, `Math.random`, un contatore — e soprattutto **col segreto
 * che l'orologio ha gia'**: la chiave del filo, o il codice mentre si abbina.
 * Chi non ha quel segreto non indovina l'uscita.
 *
 * E se anche la indovinasse, la chiave del filo non cambia: la chiave di
 * ogni collegamento mescola lo scambio effimero **e** la chiave del filo (o
 * il codice), e la meta' della casa la fa la casa col suo caso buono. Quello
 * che il ripiego toglie e' solo una protezione in piu': chi un giorno rubasse
 * la chiave del filo potrebbe rileggere anche i collegamenti di prima,
 * registrati per strada. Per questo si dice quale dei due si sta usando
 * (`daDove`), e le impostazioni lo scrivono.
 */

import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";

import { inByte, insieme } from "./cifra.js";

function dalSistema() {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (!c || typeof c.getRandomValues !== "function") return null;
  try {
    const prova = new Uint8Array(8);
    c.getRandomValues(prova);
    return (n) => {
      const fuori = new Uint8Array(n);
      c.getRandomValues(fuori);
      return fuori;
    };
  } catch (_errore) {
    return null;
  }
}

let contatore = 0;

function unPoDiTutto() {
  contatore += 1;
  const pezzi = [Date.now(), contatore];
  for (let i = 0; i < 16; i += 1) pezzi.push(Math.random());
  try {
    if (typeof performance !== "undefined" && performance.now) pezzi.push(performance.now());
  } catch (_errore) {
    /* Niente orologio fine: pazienza. */
  }
  return inByte(pezzi.join("|"));
}

/* HMAC-DRBG come in NIST SP 800-90A, col segreto dentro il seme. */
class Generatore {
  constructor(segreto) {
    this.K = new Uint8Array(32);
    this.V = new Uint8Array(32).fill(1);
    this._rinfresca(insieme(segreto, unPoDiTutto()));
  }

  _rinfresca(dati) {
    this.K = hmac(sha256, this.K, insieme(this.V, Uint8Array.from([0]), dati));
    this.V = hmac(sha256, this.K, this.V);
    this.K = hmac(sha256, this.K, insieme(this.V, Uint8Array.from([1]), dati));
    this.V = hmac(sha256, this.K, this.V);
  }

  dammi(n) {
    this._rinfresca(unPoDiTutto());
    const fuori = new Uint8Array(n);
    let dove = 0;
    while (dove < n) {
      this.V = hmac(sha256, this.K, this.V);
      fuori.set(this.V.subarray(0, Math.min(32, n - dove)), dove);
      dove += 32;
    }
    this._rinfresca(new Uint8Array(0));
    return fuori;
  }
}

/**
 * Il caso per una stretta di mano. `segreto` e' quello che l'orologio ha
 * (la chiave del filo in byte, o il codice): serve solo al ripiego.
 * Torna `{caso(n), daDove}`, con `daDove` «sistema» o «ripiego».
 */
export function ilCaso({ segreto = new Uint8Array(0), sistema = dalSistema() } = {}) {
  if (sistema) return { caso: sistema, daDove: "sistema" };
  const generatore = new Generatore(segreto);
  return { caso: (n) => generatore.dammi(n), daDove: "ripiego" };
}
