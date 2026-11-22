/* Le foto della cornice del tablet a muro, viste dalla plancia.
 *
 * Stanno nel ponte (`ponte/src/le-foto-del-riposo.js`), in casa, e di li' non
 * escono: la plancia le chiede sul filo, come la configurazione, e non per
 * indirizzo — cosi' la strada e' la stessa nell'app, nel browser e dentro Home
 * Assistant, e nessuna foto ha un indirizzo che si possa aprire da fuori.
 *
 * Qui ci sono tre cose:
 *
 *  - l'elenco, tenuto a mente per dieci minuti: il riposo lo guarda a ogni
 *    giro, e non si chiede al ponte a ogni giro;
 *  - le foto e le miniature, lette e tenute in memoria come `blob:` per il
 *    tempo che servono (poche: il tablet ne mostra una e prepara la dopo);
 *  - il caricamento dal config: il browser rimpicciolisce la foto (lato lungo
 *    1920, JPEG) e fa la miniatura, prima di mandarla. Una foto del telefono
 *    da quattro megabyte diventa qualche centinaio di kilobyte, e sta in un
 *    messaggio sul filo.
 */
import {
  LATO_DELLA_FOTO,
  LATO_DELLA_MINIATURA,
  QUALITA_DELLA_FOTO,
  misuraRidotta,
} from "../core/il-riposo-vivo.js";
import { bridgeRequest } from "./config-persistence-section.js";
import { clean, doc, root, t } from "./shared.js";

export const FOTO_ELENCO = "ponte/riposo/foto/elenco";
export const FOTO_LEGGI = "ponte/riposo/foto/leggi";
export const FOTO_CARICA = "ponte/riposo/foto/carica";
export const FOTO_TOGLI = "ponte/riposo/foto/togli";
/* Quante ne tiene il ponte (`FOTO_DEL_RIPOSO_AL_MASSIMO`). */
export const FOTO_AL_MASSIMO = 60;

/* Lo stesso tetto del ponte, un poco sotto: una foto che il ponte rifiuterebbe
 * non si manda nemmeno. */
const PESO_DA_MANDARE = 680 * 1024;
const MINIATURA_DA_MANDARE = 60 * 1024;
const TIPI_BUONI = new Set(["image/jpeg", "image/png", "image/webp"]);
/* Un file da fotocamera non passa di qui intero: oltre questo non lo si apre
 * nemmeno per rimpicciolirlo. */
const ORIGINALE_MASSIMO = 40 * 1024 * 1024;
const DIECI_MINUTI = 10 * 60 * 1000;
/* Quante foto intere si tengono in memoria: quella che si vede, quella dopo,
 * e qualcuna di scorta. */
const FOTO_IN_MEMORIA = 4;
const MINIATURE_IN_MEMORIA = 80;

export const EVENTO_FOTO_DEL_RIPOSO = "dashboardmodern:riposo-foto";

const KEY = "__DASHBOARDMODERN_FOTO_DEL_RIPOSO__";
const state = (root[KEY] ||= {
  elenco: null,
  quando: 0,
  chiedendo: null,
  foto: new Map(),
  miniature: new Map(),
  inArrivo: new Map(),
});

const firmaDellElenco = (elenco) => (elenco || []).map((f) => f.id).join(",");

/** L'elenco che si conosce adesso, senza chiedere niente: `null` se non lo si sa. */
export function fotoConosciute() {
  return state.elenco;
}

/**
 * L'elenco delle foto: `[{id, tipo, peso, quando, mini}]`. Se e' vecchio di
 * dieci minuti (o con `forza`) lo si richiede; quando cambia lo si dice con
 * l'evento `EVENTO_FOTO_DEL_RIPOSO`. Un ponte che non sa cosa siano, o che
 * non c'e', vale un elenco vuoto.
 */
export function elencoDelleFoto({ forza = false } = {}) {
  const fresco = state.elenco !== null && Date.now() - state.quando < DIECI_MINUTI;
  if (fresco && !forza) return Promise.resolve(state.elenco);
  if (state.chiedendo) return state.chiedendo;
  const prima = firmaDellElenco(state.elenco);
  const conosciuto = state.elenco !== null;
  state.chiedendo = bridgeRequest(FOTO_ELENCO, {}, { attesa: 10_000, rimanda: true })
    .then((risposta) => (Array.isArray(risposta?.foto) ? risposta.foto : []))
    .catch(() => state.elenco || [])
    .then((elenco) => {
      state.elenco = elenco.filter((f) => /^[a-z0-9]{16}$/.test(String(f?.id || "")));
      state.quando = Date.now();
      state.chiedendo = null;
      if (!conosciuto || firmaDellElenco(state.elenco) !== prima) avvisa();
      return state.elenco;
    });
  return state.chiedendo;
}

function avvisa() {
  root.dispatchEvent?.(new CustomEvent(EVENTO_FOTO_DEL_RIPOSO));
}

/* Un indirizzo `blob:` dai byte in base64. */
function blobDa(data, tipo) {
  const binario = root.atob(String(data || ""));
  const byte = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) byte[i] = binario.charCodeAt(i);
  return root.URL.createObjectURL(new Blob([byte], { type: tipo || "image/jpeg" }));
}

/* Una mappa che non cresce: la piu' vecchia esce, e il suo `blob:` si libera. */
function ricorda(mappa, chiave, url, quante) {
  mappa.delete(chiave);
  mappa.set(chiave, url);
  while (mappa.size > quante) {
    const [vecchia, suo] = mappa.entries().next().value;
    mappa.delete(vecchia);
    try {
      root.URL.revokeObjectURL(suo);
    } catch (_errore) {
      /* Gia' liberato. */
    }
  }
}

/**
 * L'indirizzo da mostrare di una foto (`blob:`), o `""` se non si legge. Con
 * `mini` la miniatura. Due domande per la stessa foto ne fanno una.
 */
export function indirizzoDellaFoto(id, { mini = false } = {}) {
  const mappa = mini ? state.miniature : state.foto;
  if (mappa.has(id)) {
    const url = mappa.get(id);
    ricorda(mappa, id, url, mini ? MINIATURE_IN_MEMORIA : FOTO_IN_MEMORIA);
    return Promise.resolve(url);
  }
  const chiave = `${mini ? "m" : "f"}:${id}`;
  if (state.inArrivo.has(chiave)) return state.inArrivo.get(chiave);
  const viaggio = bridgeRequest(FOTO_LEGGI, { foto: id, mini }, { attesa: 30_000 })
    .then((risposta) => {
      if (!risposta?.data) return "";
      const url = blobDa(risposta.data, risposta.tipo);
      ricorda(mappa, id, url, mini ? MINIATURE_IN_MEMORIA : FOTO_IN_MEMORIA);
      return url;
    })
    .catch(() => "")
    .finally(() => state.inArrivo.delete(chiave));
  state.inArrivo.set(chiave, viaggio);
  return viaggio;
}

/** La miniatura gia' in memoria, se c'e': per disegnare senza aspettare. */
export function miniaturaInMemoria(id) {
  return state.miniature.get(id) || "";
}

/* ── il caricamento ─────────────────────────────────────────────────────── */

/* Una tela con la foto ridisegnata alla misura data. */
async function apriLaFoto(file) {
  if (typeof root.createImageBitmap === "function") {
    try {
      return await root.createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (_errore) {
      /* Qualche browser non sa le opzioni: si riprova senza. */
      try {
        return await root.createImageBitmap(file);
      } catch (_ancora) {
        /* E poi con un'immagine, qui sotto. */
      }
    }
  }
  const url = root.URL.createObjectURL(file);
  try {
    const img = new root.Image();
    img.decoding = "async";
    await new Promise((fatto, rotto) => {
      img.onload = fatto;
      img.onerror = rotto;
      img.src = url;
    });
    return img;
  } finally {
    root.URL.revokeObjectURL(url);
  }
}

function ridisegnata(immagine, lato, qualita) {
  const w0 = immagine.width || immagine.naturalWidth;
  const h0 = immagine.height || immagine.naturalHeight;
  const { larghezza, altezza } = misuraRidotta(w0, h0, lato);
  const tela = doc.createElement("canvas");
  tela.width = larghezza;
  tela.height = altezza;
  const x = tela.getContext("2d");
  /* Un PNG trasparente su JPEG verrebbe nero: sotto ci va il bianco. */
  x.fillStyle = "#fff";
  x.fillRect(0, 0, larghezza, altezza);
  x.imageSmoothingQuality = "high";
  x.drawImage(immagine, 0, 0, larghezza, altezza);
  return new Promise((fatto) => tela.toBlob((blob) => fatto(blob), "image/jpeg", qualita));
}

/* La foto rimpicciolita che sta sotto il tetto: si scende di qualita', e se
 * non basta di misura. */
async function abbastanzaLeggera(immagine, { lato, qualita, tetto }) {
  const tentativi = [
    [lato, qualita],
    [lato, qualita - 0.08],
    [lato, qualita - 0.16],
    [Math.round(lato * 0.8), qualita - 0.16],
    [Math.round(lato * 0.66), qualita - 0.22],
  ];
  for (const [l, q] of tentativi) {
    const blob = await ridisegnata(immagine, l, q);
    if (blob && blob.size <= tetto) return blob;
  }
  return null;
}

async function base64Di(blob) {
  const byte = new Uint8Array(await blob.arrayBuffer());
  let binario = "";
  for (let i = 0; i < byte.length; i += 0x8000)
    binario += String.fromCharCode.apply(null, byte.subarray(i, i + 0x8000));
  return root.btoa(binario);
}

/**
 * Carica una foto scelta dal config: la rimpicciolisce, ne fa la miniatura e
 * la manda al ponte. Torna `{id}`; un errore con un messaggio da mostrare se
 * qualcosa non va (il ponte che dice di no compreso: chi non amministra la
 * casa si sente dire perche').
 */
export async function caricaUnaFoto(file) {
  const tipo = clean(file?.type).toLowerCase();
  if (!TIPI_BUONI.has(tipo))
    throw new Error(t("Solo foto JPEG, PNG o WebP.", "Only JPEG, PNG or WebP photos."));
  if (Number(file.size) > ORIGINALE_MASSIMO)
    throw new Error(
      t("La foto è troppo grande (più di 40 MB).", "The photo is too large (over 40 MB)."),
    );
  let immagine;
  try {
    immagine = await apriLaFoto(file);
  } catch (_errore) {
    throw new Error(t("Questa foto non si apre.", "This photo does not open."));
  }
  const foto = await abbastanzaLeggera(immagine, {
    lato: LATO_DELLA_FOTO,
    qualita: QUALITA_DELLA_FOTO,
    tetto: PESO_DA_MANDARE,
  });
  const mini = await abbastanzaLeggera(immagine, {
    lato: LATO_DELLA_MINIATURA,
    qualita: 0.72,
    tetto: MINIATURA_DA_MANDARE,
  });
  immagine.close?.();
  if (!foto)
    throw new Error(
      t("Questa foto non si riesce a rimpicciolire.", "This photo cannot be shrunk."),
    );
  const risposta = await bridgeRequest(
    FOTO_CARICA,
    {
      tipo: "image/jpeg",
      data: await base64Di(foto),
      ...(mini ? { mini: await base64Di(mini) } : {}),
    },
    { attesa: 45_000 },
  );
  if (!risposta?.id)
    throw new Error(t("Il ponte non ha preso la foto.", "The bridge did not take the photo."));
  if (mini)
    ricorda(state.miniature, risposta.id, root.URL.createObjectURL(mini), MINIATURE_IN_MEMORIA);
  await elencoDelleFoto({ forza: true });
  return { id: risposta.id };
}

/** Toglie una foto. Torna se c'era. */
export async function togliUnaFoto(id) {
  const risposta = await bridgeRequest(FOTO_TOGLI, { foto: id }, { attesa: 10_000 });
  for (const mappa of [state.foto, state.miniature]) {
    const url = mappa.get(id);
    if (!url) continue;
    mappa.delete(id);
    try {
      root.URL.revokeObjectURL(url);
    } catch (_errore) {
      /* Gia' liberato. */
    }
  }
  await elencoDelleFoto({ forza: true });
  return Boolean(risposta?.tolta);
}
