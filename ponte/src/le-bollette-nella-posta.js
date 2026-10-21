/* Le bollette nella posta: da una mail del fornitore a una bolletta.
 *
 * «A, usiamo Gmail.» Il fornitore — Enel per primo — manda una mail a ogni
 * bolletta: l'importo, la scadenza, il periodo, spesso il consumo. Qui c'e'
 * solo come si legge quella mail, senza rete e senza segreti: il messaggio
 * grezzo (RFC 822) entra, una bolletta esce, o `null` se non e' una bolletta.
 *
 * Le parole sono quelle che i fornitori italiani usano davvero — «importo»,
 * «totale da pagare», «scadenza», «periodo di fatturazione» — e si cercano
 * vicine fra loro: un importo qualunque in fondo alla mail (una promozione,
 * un bonus) non e' quello della bolletta.
 */

const clean = (valore) => String(valore ?? "").trim();

/* I fornitori che si sanno riconoscere, dal mittente. Il resto lo legge lo
 * stesso chi sceglie «tutti»: le parole della bolletta sono le stesse. */
export const FORNITORI = Object.freeze([
  Object.freeze({
    id: "enel",
    nome: "Enel Energia",
    mittenti: ["enel.it", "enelenergia.it", "enel.com"],
  }),
  Object.freeze({ id: "eon", nome: "E.ON Energia", mittenti: ["eon.it", "eon-energia.com"] }),
  Object.freeze({
    id: "edison",
    nome: "Edison Energia",
    mittenti: ["edisonenergia.it", "edison.it"],
  }),
  Object.freeze({ id: "a2a", nome: "A2A Energia", mittenti: ["a2a.eu", "a2aenergia.eu"] }),
  Object.freeze({ id: "hera", nome: "Hera Comm", mittenti: ["gruppohera.it", "heracomm.it"] }),
  Object.freeze({ id: "iren", nome: "Iren", mittenti: ["irenlucegas.it", "gruppoiren.it"] }),
  Object.freeze({ id: "sorgenia", nome: "Sorgenia", mittenti: ["sorgenia.it"] }),
  Object.freeze({
    id: "octopus",
    nome: "Octopus Energy",
    mittenti: ["octopusenergy.it", "octopus.energy"],
  }),
  Object.freeze({
    id: "plenitude",
    nome: "Plenitude",
    mittenti: ["eniplenitude.com", "plenitude.com"],
  }),
]);

/** Il fornitore di un mittente, o `null`. */
export function fornitoreDelMittente(mittente) {
  const da = clean(mittente).toLowerCase();
  const dominio = (da.match(/@([a-z0-9.-]+)/) || [])[1] || da;
  return (
    FORNITORI.find((f) => f.mittenti.some((m) => dominio === m || dominio.endsWith(`.${m}`))) ||
    null
  );
}

/* ── il messaggio grezzo ─────────────────────────────────────────────── */

/* Le intestazioni, con le righe piegate rimesse insieme. */
function intestazioni(testo) {
  const fuori = {};
  const righe = testo.replace(/\r\n[ \t]+/g, " ").split(/\r?\n/);
  for (const riga of righe) {
    const dove = riga.indexOf(":");
    if (dove <= 0) continue;
    const nome = riga.slice(0, dove).trim().toLowerCase();
    if (!(nome in fuori)) fuori[nome] = riga.slice(dove + 1).trim();
  }
  return fuori;
}

/* «=?UTF-8?B?…?=» e «=?UTF-8?Q?…?=»: l'oggetto delle mail arriva cosi'. */
export function parolaCodificata(testo) {
  return clean(testo).replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_t, insieme, modo, dentro) => {
    const byte =
      modo.toUpperCase() === "B"
        ? Buffer.from(dentro, "base64")
        : Buffer.from(
            dentro
              .replace(/_/g, " ")
              .replace(/=([0-9A-Fa-f]{2})/g, (_x, h) => String.fromCharCode(parseInt(h, 16))),
            "latin1",
          );
    return decodifica(byte, insieme);
  });
}

function decodifica(byte, insieme = "utf-8") {
  const nome = clean(insieme).toLowerCase().replace(/^"|"$/g, "") || "utf-8";
  try {
    return new TextDecoder(nome === "us-ascii" ? "utf-8" : nome).decode(byte);
  } catch (_errore) {
    return byte.toString("utf8");
  }
}

function quotedPrintable(testo) {
  const senzaACapo = testo.replace(/=\r?\n/g, "");
  const byte = [];
  for (let i = 0; i < senzaACapo.length; i += 1) {
    const c = senzaACapo[i];
    if (c === "=" && /^[0-9A-Fa-f]{2}$/.test(senzaACapo.slice(i + 1, i + 3))) {
      byte.push(parseInt(senzaACapo.slice(i + 1, i + 3), 16));
      i += 2;
    } else byte.push(senzaACapo.charCodeAt(i) & 0xff);
  }
  return Buffer.from(byte);
}

function parametro(valore, nome) {
  const trovato = new RegExp(`${nome}\\s*=\\s*("([^"]*)"|[^;\\s]+)`, "i").exec(valore || "");
  return trovato ? (trovato[2] ?? trovato[1]) : "";
}

/* Le parti di testo di un messaggio, in chiaro: `[{tipo, testo}]`. */
function partiDiTesto(grezzo, profondita = 0) {
  const fine = grezzo.search(/\r?\n\r?\n/);
  const testa = fine < 0 ? grezzo : grezzo.slice(0, fine);
  const corpo = fine < 0 ? "" : grezzo.slice(fine).replace(/^\r?\n\r?\n/, "");
  const h = intestazioni(testa);
  const tipo = clean(h["content-type"] || "text/plain").toLowerCase();
  if (tipo.startsWith("multipart/") && profondita < 6) {
    const confine = parametro(h["content-type"], "boundary");
    if (!confine) return [];
    return corpo
      .split(`--${confine}`)
      .slice(1)
      .filter((pezzo) => !pezzo.startsWith("--"))
      .flatMap((pezzo) => partiDiTesto(pezzo.replace(/^\r?\n/, ""), profondita + 1));
  }
  if (!tipo.startsWith("text/")) return [];
  const codifica = clean(h["content-transfer-encoding"]).toLowerCase();
  const byte =
    codifica === "base64"
      ? Buffer.from(corpo.replace(/\s+/g, ""), "base64")
      : codifica === "quoted-printable"
        ? quotedPrintable(corpo)
        : Buffer.from(corpo, "latin1");
  return [
    { tipo: tipo.split(";")[0], testo: decodifica(byte, parametro(h["content-type"], "charset")) },
  ];
}

/* L'HTML portato a righe di testo: i tag fuori, le entita' dentro. */
export function testoDallHtml(html) {
  return String(html || "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&euro;/gi, "€")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&agrave;/gi, "à")
    .replace(/&egrave;/gi, "è")
    .replace(/&eacute;/gi, "é")
    .replace(/&igrave;/gi, "ì")
    .replace(/&ograve;/gi, "ò")
    .replace(/&ugrave;/gi, "ù")
    .replace(/&#(\d+);/g, (_t, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n");
}

/** Il messaggio letto: mittente, oggetto, data e il testo del corpo. */
export function leggiIlMessaggio(grezzo) {
  const testo = Buffer.isBuffer(grezzo) ? grezzo.toString("latin1") : String(grezzo || "");
  const fine = testo.search(/\r?\n\r?\n/);
  const h = intestazioni(fine < 0 ? testo : testo.slice(0, fine));
  const parti = partiDiTesto(testo);
  const piano = parti.find((p) => p.tipo === "text/plain")?.testo;
  const html = parti.find((p) => p.tipo === "text/html")?.testo;
  const quando = Date.parse(h.date || "");
  return {
    mittente: parolaCodificata(h.from),
    oggetto: parolaCodificata(h.subject),
    data: Number.isFinite(quando) ? quando : null,
    idMessaggio: clean(h["message-id"]),
    corpo: clean(piano || testoDallHtml(html)),
  };
}

/* ── la bolletta dentro il testo ─────────────────────────────────────── */

/* «52,00», «1.234,56», «52.00»: all'italiana prima, poi all'inglese. */
export function importoDa(testo) {
  const t = clean(testo).replace(/\s/g, "");
  let n;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(t)) n = Number(t.replace(/\./g, "").replace(",", "."));
  else if (/^\d+,\d{1,2}$/.test(t)) n = Number(t.replace(",", "."));
  else if (/^\d{1,3}(,\d{3})+(\.\d{1,2})?$/.test(t)) n = Number(t.replace(/,/g, ""));
  else n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const MESI = {
  gennaio: 0,
  febbraio: 1,
  marzo: 2,
  aprile: 3,
  maggio: 4,
  giugno: 5,
  luglio: 6,
  agosto: 7,
  settembre: 8,
  ottobre: 9,
  novembre: 10,
  dicembre: 11,
};

/* «05/11/2026», «5-11-26», «5 novembre 2026» → mezzogiorno di quel giorno. */
export function dataDa(testo) {
  const t = clean(testo).toLowerCase();
  let g;
  let m;
  let a;
  const numeri = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/.exec(t);
  if (numeri) [g, m, a] = [Number(numeri[1]), Number(numeri[2]) - 1, Number(numeri[3])];
  else {
    const parole = /(\d{1,2})\s+([a-z]+)\s+(\d{4})/.exec(t);
    if (!parole || !(parole[2] in MESI)) return null;
    [g, m, a] = [Number(parole[1]), MESI[parole[2]], Number(parole[3])];
  }
  if (a < 100) a += 2000;
  const d = new Date(a, m, g, 12);
  return d.getDate() === g && d.getMonth() === m ? d.getTime() : null;
}

const SOLDI = "(?:€|eur(?:o)?)\\s*([\\d.,]+)|([\\d.,]+)\\s*(?:€|eur(?:o)?)";
const DATA = "(\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|\\d{1,2}\\s+[a-z]+\\s+\\d{4})";

/* Il primo importo entro poche parole dopo una di queste parole. */
function importoDopo(testo, parole) {
  const r = new RegExp(`(?:${parole})[^€\\d\\n]{0,60}?(?:${SOLDI})`, "i");
  const trovato = r.exec(testo);
  if (!trovato) return null;
  return importoDa(trovato[1] ?? trovato[2]);
}

function dataDopo(testo, parole) {
  const r = new RegExp(`(?:${parole})[^\\d\\n]{0,40}?${DATA}`, "i");
  const trovato = r.exec(testo);
  return trovato ? dataDa(trovato[1]) : null;
}

/* Le parole che dicono «e' una bolletta», nell'oggetto o nel corpo. */
const E_UNA_BOLLETTA = /bollett|fattura|documento di fatturazione|invoice|bill\b/i;
/* E quelle che dicono «e' gia' pagata»: l'addebito sul conto, la ricevuta. */
const GIA_PAGATA =
  /addebit\w*\s+(sul|in)\s+(tuo\s+)?conto|domiciliazion|pagamento\s+(ricevuto|effettuato|registrato)|abbiamo\s+ricevuto\s+il\s+pagamento|risulta\s+pagata/i;

/**
 * La bolletta in un messaggio, o `null`.
 *
 * `{ fornitore, numero, importo, scadenza, emessa, periodo: {dal, al},
 *    consumo: {valore, unita}, pagata, oggetto, data, id }`
 */
export function bollettaDalMessaggio(messaggio) {
  const m = messaggio?.corpo !== undefined ? messaggio : leggiIlMessaggio(messaggio);
  const fornitore = fornitoreDelMittente(m.mittente);
  const tutto = `${m.oggetto}\n${m.corpo}`;
  if (!E_UNA_BOLLETTA.test(tutto)) return null;
  const importo =
    importoDopo(
      tutto,
      "totale\\s+da\\s+pagare|importo\\s+da\\s+pagare|importo\\s+totale|importo|totale|amount",
    ) ?? null;
  if (importo === null) return null;
  const numero =
    (/(?:bolletta|fattura|documento)\s*(?:n\.?|nr\.?|numero)\s*[:°]?\s*([A-Z0-9/-]{4,})/i.exec(
      tutto,
    ) || [])[1] || "";
  const periodo = new RegExp(
    `periodo[^\\n]{0,60}?${DATA}[^\\n\\d]{0,15}?(?:al|-|–)\\s*${DATA}`,
    "i",
  ).exec(tutto);
  const consumo = /(?:consum[oi][^\d\n]{0,40}?)([\d.,]+)\s*(kwh|smc|mc)\b/i.exec(tutto);
  return {
    fornitore: fornitore?.id || "",
    nomeFornitore: fornitore?.nome || "",
    numero,
    importo,
    scadenza: dataDopo(tutto, "scadenza|scade\\s+il|entro\\s+il|da\\s+pagare\\s+entro"),
    emessa: dataDopo(tutto, "emessa\\s+il|emissione|del"),
    periodo: periodo ? { dal: dataDa(periodo[1]), al: dataDa(periodo[2]) } : null,
    consumo: consumo ? { valore: importoDa(consumo[1]), unita: consumo[2].toLowerCase() } : null,
    pagata: GIA_PAGATA.test(tutto) ? true : null,
    oggetto: m.oggetto,
    data: m.data,
    id: m.idMessaggio || `${m.data}|${m.oggetto}`,
  };
}

/**
 * Le bollette di piu' messaggi, la piu' recente per prima, una sola per
 * numero (lo stesso documento mandato due volte, o il sollecito).
 */
export function bolletteDaiMessaggi(messaggi = []) {
  const viste = new Map();
  for (const grezzo of messaggi) {
    let b = null;
    try {
      b = bollettaDalMessaggio(grezzo);
    } catch (_errore) {
      b = null;
    }
    if (!b) continue;
    const chiave = b.numero ? `${b.fornitore}|${b.numero}` : b.id;
    const prima = viste.get(chiave);
    if (!prima || (b.data ?? 0) > (prima.data ?? 0))
      viste.set(chiave, { ...prima, ...b, pagata: b.pagata ?? prima?.pagata ?? null });
  }
  return [...viste.values()].sort((a, b) => (b.data ?? 0) - (a.data ?? 0));
}
