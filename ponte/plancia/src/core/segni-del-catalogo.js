/* I segni piccoli della plancia, tutti dal catalogo di casa.
 *
 * «Non deve esserci nulla che non sia nel nostro catalogo, ste emoji non le
 * voglio vedere da nessuna parte.» Le emoji stavano dappertutto dove serviva un
 * segno piccolo: davanti a una parola in un tasto, nelle linguette, nelle
 * pastiglie. Sono quelle del sistema, che cambiano faccia da un telefono a un
 * altro, e accanto alla scocca blu notte degli elettrodomestici stonavano.
 *
 * Qui ci sono due modi di mettere un disegno del catalogo:
 *
 * - `segnoDelCatalogo(chiave, misura)` da' il disegno com'e', un `<svg>`, per
 *   chi scrive il suo markup;
 * - `segnoHtml(chiave)` da' un segnaposto vuoto — `<i class="dm-segno"
 *   data-dm-segno="water">` — che il foglio dei segni dipinge da fuori. Serve
 *   al guscio e a tutto quello che confronta il proprio markup per sapere se
 *   ridisegnare: il segnaposto non cambia mai, e nessuno lo riscrive.
 */
import { applianceArtwork, canonicalArtworkType } from "./appliance-artwork.js";
import { chiaveDelDisegno, disegnoDelCatalogo } from "./catalogo-disegni.js";

const pulita = (valore) => String(valore ?? "").trim();

/** Il disegno di una chiave, o "" se il catalogo non ce l'ha. Gli
 * elettrodomestici hanno i loro disegni: una chiave che ne nomina uno — `oven`,
 * `washer` — prende quello. */
export function segnoDelCatalogo(chiave, misura = 96) {
  const token = pulita(chiave);
  if (!token) return "";
  const tipo = canonicalArtworkType(token);
  if (tipo && tipo !== "generic") return applianceArtwork(tipo, misura);
  return disegnoDelCatalogo(token, misura) || (tipo ? applianceArtwork(tipo, misura) : "");
}

/** Il corpo `<svg>` della chiave, senza l'involucro: e' quello che va nel foglio. */
export function svgDelSegno(chiave) {
  const markup = segnoDelCatalogo(chiave, 96);
  const inizio = markup.indexOf("<svg");
  const fine = markup.lastIndexOf("</svg>");
  if (inizio < 0 || fine < 0) return "";
  /* Un attributo scritto due volte — `stroke-width` sopra un tratto che ne ha
   * gia' uno — dentro la pagina si tollera, e vince il primo; in un'immagine
   * SVG e' un errore, e il disegno non esce. Si tiene il primo, come fa la
   * pagina. */
  const senzaDoppi = markup.slice(inizio, fine + 6).replace(/<[a-zA-Z][^>]*>/g, (tag) => {
    const visti = new Set();
    return tag.replace(/\s([a-zA-Z:-]+)="[^"]*"/g, (intero, nome) => {
      if (visti.has(nome)) return "";
      visti.add(nome);
      return intero;
    });
  });
  return senzaDoppi.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ');
}

/** C'e' un disegno per questa chiave? */
export function segnoEsiste(chiave) {
  return Boolean(segnoDelCatalogo(chiave, 16));
}

/** Il segnaposto da mettere nel markup. `misura` in pixel; senza, il segno e'
 * alto come la riga di testo che accompagna. */
export function segnoHtml(chiave, { misura = 0, classe = "" } = {}) {
  const nome = pulita(chiave);
  if (!nome) return "";
  const stile = misura > 0 ? ` style="--dm-segno:${Math.round(misura)}px"` : "";
  const extra = classe ? ` ${classe}` : "";
  return `<i class="dm-segno${extra}" data-dm-segno="${nome.replace(/[^a-z0-9-]/gi, "")}" aria-hidden="true"${stile}></i>`;
}

/* Le emoji che la plancia scriveva, e il disegno che le sostituisce. Serve a
 * chi riceve un segno gia' scelto — da una tabella, da una configurazione
 * vecchia — e lo deve tradurre. Quello che non sta qui non si disegna: chi
 * chiama sceglie il suo ripiego, che e' sempre una chiave del catalogo. */
export const SEGNO_DELL_EMOJI = Object.freeze({
  "⚙️": "sliders",
  "⚙": "sliders",
  "🗣️": "chat",
  "🗣": "chat",
  "💬": "chat",
  "📊": "gauge",
  "⚡": "power",
  "📅": "calendar",
  "📆": "calendar",
  "🌡️": "thermometer",
  "🌡": "thermometer",
  "🔌": "socket",
  "🏠": "home",
  "🏡": "home",
  "🏢": "home",
  "☀️": "sun",
  "☀": "sun",
  "🌙": "moon",
  "🎛️": "sliders",
  "🎛": "sliders",
  "⏱": "timer",
  "⏱️": "timer",
  "⏲️": "timer",
  "🕒": "timer",
  "❄️": "air-conditioner",
  "❄": "air-conditioner",
  "🔥": "radiator",
  "♨️": "heat-pump",
  "💧": "water",
  "💦": "water",
  "🚰": "water",
  "🌿": "plant",
  "🌱": "plant",
  "🪴": "plant",
  "▶": "play",
  "▶️": "play",
  "⏹": "stop",
  "⏹️": "stop",
  "⏸": "pause",
  "⏸️": "pause",
  "🏊": "room-pool",
  "💡": "lights",
  "🪟": "window",
  "🚪": "door",
  "🔒": "lock",
  "🔓": "unlock",
  "🔑": "key",
  "🔔": "bell",
  "🚨": "warning",
  "⚠️": "warning",
  "⚠": "warning",
  "✅": "check",
  "✔️": "check",
  "❌": "error",
  ℹ️: "info",
  "📹": "camera",
  "📷": "camera",
  "🎵": "speaker",
  "🔊": "speaker",
  "🤖": "robot",
  "🔋": "battery",
  "🛡️": "security",
  "👤": "person",
  "🙋": "person",
  "🐾": "pet",
  "🐶": "dog",
  "🐱": "cat",
  "📦": "package",
  "✉️": "mail",
  "📞": "phone",
  "🛒": "cart",
  "📋": "list",
  "📝": "list",
  "🧹": "broom",
  "🔧": "tools",
  "🛠️": "tools",
  "❤️": "heart",
  "💙": "heart",
  "🔄": "refresh",
  "🌬️": "wind",
  "💨": "wind",
  "🌍": "globe",
  "🌐": "globe",
  "⛈️": "storm",
  "🌸": "flower",
  "✈️": "plane",
  "🚆": "train",
  "🪫": "battery",
  "📈": "gauge",
  "📉": "gauge",
  "🧭": "gauge",
  "📌": "star",
  "⭐": "star",
  "🌟": "star",
  "🚗": "ev",
  "🔆": "sun",
  "🎬": "scene",
  "📜": "script",
  "🔘": "toggle",
  "🎨": "sliders",
  "📱": "phone",
  "🧩": "sliders",
  "🎫": "chat",
  "🧺": "washer",
  "🌞": "sun",
  "🌤️": "sun",
  "⛅": "sun",
  "🖥️": "computer",
  "🖥": "computer",
  "💽": "server",
  "🍳": "cooktop",
  "⏰": "timer",
  "⏳": "timer",
  "🕐": "timer",
  "💸": "coin",
  "💰": "coin",
  "💳": "coin",
  "💶": "coin",
  "€": "coin",
  "🌳": "plant",
  "☝️": "info",
  "🌀": "fan",
  "🛣️": "ev",
  "🎯": "gauge",
  "🛑": "stop",
  "🚀": "power",
  "🔁": "refresh",
  "🌊": "water",
  "💾": "check",
  "🔍": "search",
  "🔎": "search",
  "👆": "sliders",
  "👕": "dryer",
  "📍": "home",
  "⛩️": "gate",
  "🗑️": "trash",
  "🗑": "trash",
  "✏️": "pencil",
  "✏": "pencil",
  "🖊️": "pencil",
  "🔗": "link",
  "🪄": "star",
  "✨": "star",
  "💫": "star",
  "🌧️": "storm",
  "🌦️": "storm",
  "🌨️": "storm",
  "☁️": "storm",
  "☔": "storm",
  "🌫️": "wind",
  "〰️": "wind",
  "🛋️": "room-living",
  "🛋": "room-living",
  "📡": "router",
  "📶": "router",
  "🍽️": "dishwasher",
  "🍽": "dishwasher",
  "🚿": "room-bathroom",
  "🛁": "room-bathroom",
  "🚽": "room-wc",
  "🔀": "refresh",
  "♻️": "refresh",
  "🍃": "plant",
  "🌵": "plant",
  "🌻": "flower",
  "🌼": "flower",
  "🍀": "plant",
  "🌴": "plant",
  "🌲": "plant",
  "🧊": "fridge",
  "🧪": "gauge",
  "🐠": "aquarium",
  "🐟": "aquarium",
  "🛞": "ev",
  "🚘": "ev",
  "🚙": "ev",
  "🛻": "ev",
  "⛽": "ev",
  "🏍️": "moto",
  "🛵": "moto",
  "🚲": "moto",
  "🛴": "moto",
  "🚴": "moto",
  "🚜": "mower",
  "🛏️": "room-bedroom",
  "🛏": "room-bedroom",
  "🛌": "room-bedroom",
  "🏃": "motion",
  "🚶": "motion",
  "🧍": "person",
  "👣": "motion",
  "🔇": "speaker",
  "🔕": "bell",
  "🔲": "toggle",
  "🎚️": "sliders",
  "🖼️": "scene",
  "📺": "television",
  "🎥": "camera",
  "📸": "camera",
  "🎙️": "chat",
  "📁": "list",
  "🗂️": "list",
  "🗄️": "list",
  "📑": "list",
  "📚": "list",
  "🗓️": "calendar",
  "📬": "mail",
  "📭": "mail",
  "📮": "mail",
  "📥": "inbox",
  "📤": "inbox",
  "📎": "link",
  "🖨️": "printer",
  "🍞": "toaster",
  "🫖": "kettle",
  "☕": "coffee",
  "💻": "computer",
  "🧸": "room-kids",
  "🍷": "room-dining",
  "🧯": "smoke",
  "🔦": "lights",
  "🫧": "wind",
  "🩺": "heart",
  "🧽": "broom",
  "🪣": "broom",
  "🧼": "broom",
  "🪥": "room-bathroom",
  "🧴": "room-bathroom",
  "❗": "warning",
  "❓": "info",
  "❔": "info",
  "🛢️": "storage-boiler",
  "⚖️": "gauge",
  "🅿️": "room-garage",
  "🏋️": "room-gym",
  "💼": "room-office",
  "🧳": "package",
  "🌇": "sun",
  "🌅": "sun",
  "💤": "moon",
  "🧰": "tools",
  "🔨": "tools",
  "🪛": "tools",
  "🍕": "oven",
  "🍟": "air-fryer",
  "🥘": "cooktop",
  "🍲": "microwave",
  "🥩": "fridge",
  "🧃": "fridge",
  "🥫": "room-pantry",
  "🍎": "room-pantry",
  "🍾": "room-dining",
  "👥": "person",
  "⌚": "timer",
  "🕰️": "timer",
  "✋": "stop",
  "🚫": "stop",
  "🏭": "power",
  "🐞": "bug",
  "🐙": "globe",
  "🗺": "globe",
  "🗺️": "globe",
  "🪑": "room-dining",
  "🪞": "room-wardrobe",
  "👗": "room-wardrobe",
  "👖": "room-wardrobe",
  "🧦": "room-wardrobe",
  "👟": "room-wardrobe",
  "🧥": "room-wardrobe",
  "👔": "iron",
  "🎮": "room-media",
  "🕹️": "room-media",
  "🎧": "speaker",
  "🎲": "room-kids",
  "⛱️": "room-terrace",
  "🏖️": "room-terrace",
  "🐕": "dog",
  "🐈": "cat",
  "🐦": "pet",
  "🦊": "pet",
  "🐼": "pet",
  "🐨": "pet",
  "🦁": "pet",
  "🐯": "pet",
  "🐸": "pet",
  "🐧": "pet",
  "🦄": "pet",
  "🐢": "pet",
  "🦉": "pet",
  "🧘": "room-gym",
  "⚽": "room-gym",
  "🏀": "room-gym",
  "🎾": "room-gym",
  "🛎️": "bell",
  "🎄": "star",
  "🎁": "package",
  "🎉": "star",
  "🗝️": "key",
  "🔐": "lock",
  "📣": "speaker",
  "🧲": "tools",
  "🪙": "coin",
  "🪧": "info",
  "✂️": "tools",
  "👁️": "camera",
  "👁": "camera",
  "↩": "refresh",
  "⤵️": "refresh",
  "📐": "sliders",
  "🧠": "sliders",
  "🪵": "fireplace",
  "🏁": "check",
  "🫁": "wind",
  "☠️": "warning",
  "🪜": "room-attic",
  "🛗": "lift",
  "🏚️": "room-cellar",
  "🏚": "room-cellar",
  "🧷": "link",
  "🌌": "moon",
  "🪨": "sliders",
  "🩶": "sliders",
  "🏜️": "sun",
  "🙂": "person",
  "😀": "person",
  "😊": "person",
  "😕": "person",
  "👋": "person",
  "😅": "person",
  "😉": "person",
  "🤔": "person",
  "😐": "person",
  "😢": "person",
  "😱": "person",
  "👍": "check",
  "👎": "error",
  "🙏": "heart",
  "👏": "star",
  "💪": "star",
  "🤝": "heart",
  "🤞": "star",
  "🧙": "person",
  "🅰️": "info",
  "🅱️": "info",
  "↕": "sliders",
  "😎": "person",
  "🥰": "person",
  "😇": "person",
  "🤓": "person",
  "🥳": "person",
  "😴": "person",
  "🤠": "person",
  "🥸": "person",
  "🤗": "person",
  "😜": "person",
  "👨": "person",
  "👩": "person",
  "🧑": "person",
  "👦": "person",
  "👧": "person",
  "👶": "person",
  "👴": "person",
  "👵": "person",
  "🧔": "person",
  "👱‍♀️": "person",
  "👱‍♂️": "person",
  "🧑‍🦰": "person",
  "👨‍🦱": "person",
  "👩‍🦱": "person",
  "👨‍🦳": "person",
  "👩‍🦳": "person",
  "👨‍🦲": "person",
  "🧑‍🦱": "person",
  "👩‍🦰": "person",
  "🧕": "person",
  "👳‍♂️": "person",
  "👲": "person",
  "🧒": "person",
  "🧓": "person",
  "👨‍💻": "person",
  "👩‍💻": "person",
  "👨‍🍳": "person",
  "👩‍🍳": "person",
  "👨‍⚕️": "person",
  "👩‍⚕️": "person",
  "👨‍🏫": "person",
  "👩‍🏫": "person",
  "👷‍♂️": "person",
  "👷‍♀️": "person",
  "👮‍♂️": "person",
  "👮‍♀️": "person",
  "👨‍🔧": "person",
  "👩‍🔧": "person",
  "👨‍🚒": "person",
  "👩‍🚒": "person",
  "👨‍✈️": "person",
  "👩‍✈️": "person",
  "👨‍🎨": "person",
  "👩‍🎨": "person",
  "🧑‍🌾": "person",
  "🧑‍🎓": "person",
  "🦸‍♂️": "person",
  "🦸‍♀️": "person",
  "🧑‍🎨": "person",
});

/* Le emoji che non sono un disegno ma un segno di scrittura: una freccia, un
 * piu'. Prendono il carattere tipografico che dice la stessa cosa. */
export const TESTO_DELL_EMOJI = Object.freeze({
  "➕": "+",
  "➖": "−",
  "⬆️": "↑",
  "⬇️": "↓",
  "⬅️": "←",
  "➡️": "→",
  "⚪": "○",
  "✖️": "×",
  /* I pallini di stato: il colore lo dice il foglio di chi li scrive. */
  "🟢": "●",
  "🟡": "●",
  "🔴": "●",
  "⚫": "●",
  "🔵": "●",
  "🟠": "●",
});

/** Il disegno che prende il posto di un'emoji, o "". */
export function segnoPerEmoji(emoji) {
  const chiave =
    SEGNO_DELL_EMOJI[pulita(emoji)] || SEGNO_DELL_EMOJI[pulita(emoji).replace(/️/g, "")];
  return chiave && segnoEsiste(chiave) ? chiave : "";
}

/** La chiave canonica, per chi vuole sapere se due nomi sono lo stesso disegno. */
export function chiaveDelSegno(valore) {
  const token = pulita(valore);
  const tipo = canonicalArtworkType(token);
  if (tipo && tipo !== "generic") return tipo;
  return chiaveDelDisegno(token) || tipo || "";
}

const EMOJI_SOLA =
  /(?:\p{Extended_Pictographic})(?:\uFE0F|\u200D\p{Extended_Pictographic}\uFE0F?)*/gu;
const senzaVariante = (valore) => String(valore).replace(/\uFE0F/g, "");

/* Una tabella si interroga com'e', senza il selettore di variante e con: la
 * stessa emoji si trova scritta in tutti e tre i modi. */
const cerca = (tabella, emoji) =>
  tabella[emoji] || tabella[senzaVariante(emoji)] || tabella[`${senzaVariante(emoji)}\uFE0F`] || "";

/** La chiave del disegno che prende il posto di un valore: una chiave del
 * catalogo resta quella, un'emoji si traduce; altrimenti il ripiego. */
export function chiaveDelValore(valore, ripiego = "") {
  const token = pulita(valore);
  if (!token) return ripiego;
  if (/^[a-z0-9-]+$/.test(token) && segnoEsiste(token)) return token;
  return segnoPerEmoji(token) || ripiego;
}

/** Il segnaposto per un valore che puo' essere un'emoji o una chiave: e' la
 * funzione da usare dove prima si scriveva `${esc(icona)}` in un markup. */
export function segnoDaValoreHtml(valore, { misura = 0, ripiego = "star", classe = "" } = {}) {
  return segnoHtml(chiaveDelValore(valore, ripiego), { misura, classe });
}

/** Un testo con dentro delle emoji, per un markup: ogni emoji diventa il suo
 * disegno, o il suo segno di scrittura; quelle che non si sanno tradurre si
 * tolgono. Il resto del testo va passato gia' sfuggito (`esc`). */
export function emojiInSegni(testoSfuggito, { misura = 0 } = {}) {
  return String(testoSfuggito ?? "").replace(EMOJI_SOLA, (emoji) => {
    const scritta = cerca(TESTO_DELL_EMOJI, emoji);
    if (scritta) return scritta;
    const chiave = segnoPerEmoji(emoji);
    return chiave ? segnoHtml(chiave, { misura }) : "";
  });
}

/** Un testo semplice senza emoji: per `textContent`, `title`, `aria-label`,
 * le `<option>` — dove un disegno non ci puo' stare. Le frecce e i segni di
 * scrittura restano, come carattere tipografico. Gli a capo restano dove
 * sono: si toglie l'emoji con lo spazio che la seguiva, e basta. */
export function senzaEmoji(testo) {
  return String(testo ?? "")
    .replace(new RegExp(`(?:${EMOJI_SOLA.source})[ \\t]?`, "gu"), (tratto) => {
      const emoji = tratto.replace(/[ \t]$/, "");
      const scritta = cerca(TESTO_DELL_EMOJI, emoji);
      return scritta ? `${scritta}${tratto.slice(emoji.length)}` : "";
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/^[ \t]+|[ \t]+$/g, "");
}
