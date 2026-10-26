/* Gli avvisi dei negozi: Apple e Google dicono da se' quando un abbonamento
 * cambia.
 *
 * Senza, il quadro lo scopriva solo chiedendo: ogni ora al giro, o quando la
 * casa chiede i suoi gettoni. Con gli avvisi, chi compra, disdice, viene
 * rimborsato o si riabbona si vede in pochi secondi, nella Gestione e — per
 * un rimborso — anche nel tramite, che chiude i telefoni da fuori.
 *
 * **Dell'avviso si crede solo a quale abbonamento riguarda.** Cosa e'
 * successo lo si richiede al negozio, con le chiavi di chi vende, come al giro
 * di ogni ora (`licenze.js`, `avvisoDelNegozio`). Un avviso falso, quindi, al
 * massimo fa richiedere al negozio un abbonamento che c'e' gia': non
 * allunga niente e non toglie niente.
 *
 * ─── Apple ───────────────────────────────────────────────────────────────
 *
 * App Store Server Notifications V2: `POST {"signedPayload": "<JWS>"}`. La
 * JWS e' firmata da Apple con la catena fino a «Apple Root CA - G3», la stessa
 * delle risposte dell'App Store Server API, e si verifica allo stesso modo
 * (`verificaLaJwsDiApple`). Dentro, `data.signedTransactionInfo` e' a sua
 * volta firmata e porta `originalTransactionId`: e' la ricevuta che il quadro
 * tiene per Apple. Si guarda anche il `bundleId`: un avviso di un'altra app
 * non e' nostro.
 *
 * ─── Google ──────────────────────────────────────────────────────────────
 *
 * Real-time developer notifications, consegnate da Pub/Sub in push:
 * `POST {"message": {"data": "<base64 di JSON>"}}`. Il JSON porta
 * `packageName` e `subscriptionNotification.purchaseToken` (o
 * `voidedPurchaseNotification.purchaseToken` per un rimborso): il token e' la
 * ricevuta che il quadro tiene per Google. Pub/Sub non firma il corpo; la
 * porta ha nell'indirizzo un segreto (`QUADRO_GOOGLE_AVVISI`) che sa solo chi
 * l'ha scritto nella Play Console, e anche cosi' vale la regola di sopra.
 */

import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ilCorpoDi, verificaLaJwsDiApple } from "./negozi.js";

/** Quanto puo' essere grosso un avviso: quelli veri stanno sotto i 10 kB. */
export const AVVISO_MASSIMO = 64 * 1024;

/**
 * Di quale abbonamento parla un avviso di Apple: `{chiave, tipo}`, con
 * `chiave` la transazione originale. `null` se non e' firmato da Apple, non
 * e' della nostra app o non parla di un abbonamento.
 */
export function cosaDiceApple(corpo, { bundle, radice, adesso = Date.now() } = {}) {
  const firmato = corpo?.signedPayload;
  if (typeof firmato !== "string" || !firmato) return null;
  let detto;
  try {
    detto = verificaLaJwsDiApple(firmato, radice || undefined, adesso);
  } catch (_errore) {
    return null;
  }
  const dati = detto?.data;
  if (!dati || (bundle && dati.bundleId !== bundle)) return null;
  /* La transazione sta dentro la busta gia' verificata: la sua firma e'
   * coperta da quella di fuori, e non serve rifarla. */
  const transazione = ilCorpoDi(dati.signedTransactionInfo);
  const chiave = String(transazione?.originalTransactionId ?? "");
  if (!/^\d{1,40}$/.test(chiave)) return null;
  return {
    chiave,
    tipo: [detto.notificationType, detto.subtype].filter(Boolean).join("/"),
  };
}

/**
 * Di quale abbonamento parla un avviso di Google: `{chiave, tipo}`, con
 * `chiave` il token dell'acquisto; `{prova: true}` per l'avviso di prova che
 * si manda dalla Play Console. `null` se non e' leggibile, non e' del nostro
 * pacchetto o non parla di un abbonamento.
 */
export function cosaDiceGoogle(corpo, { pacchetto } = {}) {
  const dentro = corpo?.message?.data;
  if (typeof dentro !== "string" || !dentro) return null;
  let detto;
  try {
    detto = JSON.parse(Buffer.from(dentro, "base64").toString("utf8"));
  } catch (_errore) {
    return null;
  }
  if (!detto || typeof detto !== "object") return null;
  if (pacchetto && detto.packageName !== pacchetto) return null;
  if (detto.testNotification) return { prova: true };
  const abbonamento = detto.subscriptionNotification;
  const rimborso = detto.voidedPurchaseNotification;
  const chiave = String(abbonamento?.purchaseToken ?? rimborso?.purchaseToken ?? "");
  if (!chiave || chiave.length > 4096) return null;
  return {
    chiave,
    tipo: abbonamento ? `abbonamento/${Number(abbonamento.notificationType) || 0}` : "rimborso",
  };
}

/**
 * Il segreto dell'indirizzo degli avvisi di Google, tenuto nella cartella dei
 * dati: fatto la prima volta, poi sempre quello, perche' sta scritto nella
 * Play Console e cambiarlo vorrebbe dire riscriverlo li'. Lo legge solo chi
 * tiene il quadro, nella Gestione («Abbonamenti»). `QUADRO_GOOGLE_AVVISI`
 * nell'ambiente, se c'e', vince.
 */
export function ilSegretoDegliAvvisi(cartella) {
  const file = join(String(cartella), "avvisi-google.segreto");
  try {
    if (existsSync(file)) {
      const letto = readFileSync(file, "utf8").trim();
      if (letto.length >= 24) return letto;
    }
    mkdirSync(String(cartella), { recursive: true });
    const nuovo = randomBytes(24).toString("hex");
    writeFileSync(file, `${nuovo}\n`, { mode: 0o600 });
    return nuovo;
  } catch (_errore) {
    return "";
  }
}
