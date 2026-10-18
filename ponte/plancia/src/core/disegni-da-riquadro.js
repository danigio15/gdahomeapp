/* I disegni da riquadro: le illustrazioni che riempiono un riquadro intero.
 *
 * «Riquadri con l'immagine»: un riquadro della plancia puo' portare una foto
 * caricata da chi ci abita, o uno di questi disegni. Non sono le icone del
 * catalogo (`catalogo-disegni.js`), che stanno in un dischetto accanto al
 * nome: sono scene intere, fatte per stare sotto il velo scuro su cui si
 * leggono il nome e lo stato. Per questo il soggetto sta nei due terzi alti,
 * e il fondo e' una superficie tranquilla.
 *
 * Stessa tavolozza dei disegni della plancia (`tavolozza-disegni.js`): scocca
 * #0f2942, frontale #f8fafc, vetro #8be2ff, accento #0ea5e9, caldo #fbbf24,
 * verde #22c55e. Luce da in alto a sinistra, come gli oggetti.
 *
 * Il patto, che chi usa questo file deve poter dare per scontato:
 * - ogni disegno ha la sua `chiave`, che e' quello che si salva in
 *   configurazione (`disegno:<chiave>`), e non cambia mai;
 * - `svg()` restituisce un SVG con viewBox 0 0 240 240;
 * - gli `id` dentro un SVG cominciano con la chiave del disegno, cosi' due
 *   disegni diversi nella stessa pagina non si rubano le sfumature;
 * - `fuoco` e' dove guardare quando il riquadro taglia il disegno: x e y in
 *   percentuale.
 *
 * Il modulo e' puro: niente pagina, niente lingua attiva. Chi mostra un nome
 * sceglie da se' fra `it` ed `en`. */

const SCOCCA = "#0f2942";
const FRONTALE = "#f8fafc";
const VETRO = "#8be2ff";
const ACCENTO = "#0ea5e9";
const CALDO = "#fbbf24";
const VERDE = "#22c55e";

/* Pseudo-casuale ripetibile: la neve dell'albero cade sempre uguale, e il
 * disegno di oggi e' lo stesso di domani (e della prova che lo guarda). */
function pseudoCasuale(seme) {
  let s = seme;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const tela = (corpo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" preserveAspectRatio="xMidYMid slice">${corpo}</svg>`;

/* Gli id di un disegno: tutti col prefisso della sua chiave. */
const idDi = (chiave) => (nome) => `${chiave}-${nome}`;

function proiettore() {
  const id = idDi("proiettore");
  const griglia = Array.from({ length: 4 }, (_, r) =>
    Array.from(
      { length: 6 },
      (_, c) => `<rect x="${46 + c * 9}" y="${96 + r * 8}" width="5" height="4" rx="1.2"/>`,
    ).join(""),
  ).join("");
  return tela(`<defs>
    <linearGradient id="${id("bg")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#312e81"/><stop offset="1" stop-color="#0b1023"/></linearGradient>
    <linearGradient id="${id("fascio")}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e0f2fe" stop-opacity=".75"/><stop offset="1" stop-color="${VETRO}" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id("corpo")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e2e8f0"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>
    <radialGradient id="${id("lente")}" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="${VETRO}"/><stop offset=".45" stop-color="${ACCENTO}"/><stop offset="1" stop-color="${SCOCCA}"/></radialGradient>
    <radialGradient id="${id("alone")}" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="#6366f1" stop-opacity=".55"/><stop offset="1" stop-color="#6366f1" stop-opacity="0"/></radialGradient>
    <filter id="${id("sfoca")}"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>
  <rect width="240" height="240" fill="url(#${id("bg")})"/>
  <circle cx="110" cy="105" r="120" fill="url(#${id("alone")})"/>
  <polygon points="160,108 250,40 250,190" fill="url(#${id("fascio")})" filter="url(#${id("sfoca")})"/>
  <ellipse cx="110" cy="152" rx="80" ry="7" fill="#020617" opacity=".55"/>
  <rect x="30" y="74" width="148" height="70" rx="20" fill="url(#${id("corpo")})"/>
  <path d="M44 78h120a12 12 0 0 1 10 6H34a12 12 0 0 1 10-6Z" fill="#fff" opacity=".9"/>
  <rect x="30" y="128" width="148" height="16" rx="8" fill="#64748b" opacity=".35"/>
  <g fill="${SCOCCA}" opacity=".85">${griglia}</g>
  <circle cx="58" cy="86" r="2.6" fill="${ACCENTO}"/>
  <circle cx="140" cy="109" r="30" fill="#cbd5e1"/>
  <circle cx="140" cy="109" r="25" fill="${SCOCCA}"/>
  <circle cx="140" cy="109" r="17" fill="url(#${id("lente")})"/>
  <ellipse cx="133" cy="101" rx="6" ry="4" fill="#fff" opacity=".85" transform="rotate(-30 133 101)"/>
  <rect x="46" y="144" width="16" height="7" rx="3" fill="${SCOCCA}"/><rect x="148" y="144" width="16" height="7" rx="3" fill="${SCOCCA}"/>`);
}

function decoder() {
  const id = idDi("decoder");
  return tela(`<defs>
    <linearGradient id="${id("bg")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e293b"/><stop offset="1" stop-color="#0b1220"/></linearGradient>
    <radialGradient id="${id("caldo")}" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="#f59e0b" stop-opacity=".45"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id("schermo")}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset=".55" stop-color="#6366f1"/><stop offset="1" stop-color="#1e1b4b"/></linearGradient>
    <linearGradient id="${id("sopra")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#475569"/><stop offset="1" stop-color="#1e293b"/></linearGradient>
    <linearGradient id="${id("legno")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a16207"/><stop offset="1" stop-color="#422006"/></linearGradient>
    <filter id="${id("sfoca6")}"><feGaussianBlur stdDeviation="6"/></filter><filter id="${id("sfoca2")}"><feGaussianBlur stdDeviation="2"/></filter>
  </defs>
  <rect width="240" height="240" fill="url(#${id("bg")})"/>
  <circle cx="120" cy="100" r="130" fill="url(#${id("caldo")})"/>
  <rect x="40" y="16" width="160" height="80" rx="8" fill="#38bdf8" opacity=".35" filter="url(#${id("sfoca6")})"/>
  <rect x="44" y="18" width="152" height="74" rx="7" fill="${SCOCCA}"/>
  <rect x="49" y="23" width="142" height="64" rx="4" fill="url(#${id("schermo")})"/>
  <path d="M49 70c30-14 54-6 80-16s42-8 62-2v35H49Z" fill="${SCOCCA}" opacity=".45"/>
  <circle cx="160" cy="40" r="9" fill="${CALDO}" opacity=".9"/>
  <path d="M52 26h70L52 60Z" fill="#fff" opacity=".12"/>
  <ellipse cx="120" cy="158" rx="88" ry="8" fill="${ACCENTO}" opacity=".55" filter="url(#${id("sfoca6")})"/>
  <path d="M52 118h136l18 14H34Z" fill="url(#${id("sopra")})"/>
  <path d="M60 120h120" stroke="#fff" stroke-opacity=".25" stroke-width="1.5"/>
  <rect x="34" y="132" width="172" height="22" rx="6" fill="${SCOCCA}"/>
  <circle cx="54" cy="143" r="6" fill="${VERDE}" opacity=".6" filter="url(#${id("sfoca2")})"/><circle cx="54" cy="143" r="3" fill="${VERDE}"/>
  <rect x="150" y="138" width="40" height="10" rx="3" fill="${VETRO}" opacity=".9"/>
  <path d="M156 143h4M164 143h4M174 143h10" stroke="${SCOCCA}" stroke-width="2" stroke-linecap="round"/>
  <rect x="0" y="156" width="240" height="84" fill="url(#${id("legno")})"/>
  <rect x="0" y="156" width="240" height="3" fill="#fde68a" opacity=".35"/>`);
}

function cancello() {
  const id = idDi("cancello");
  /* L'arco in cima: una quadratica da un pilastro all'altro. */
  const arco = (x) => {
    const t = (x - 56) / 128;
    return (1 - t) ** 2 * 64 + 2 * (1 - t) * t * 40 + t ** 2 * 64;
  };
  let sbarre = "";
  for (let x = 63; x < 182; x += 10.5) {
    if (Math.abs(x - 120) < 3) continue;
    const y = arco(x);
    sbarre += `<path d="M${x.toFixed(1)} ${y.toFixed(1)}V136" stroke="${SCOCCA}" stroke-width="3.6" stroke-linecap="round"/><circle cx="${x.toFixed(1)}" cy="${(y - 3).toFixed(1)}" r="2.4" fill="${CALDO}"/>`;
  }
  return tela(`<defs>
    <linearGradient id="${id("cielo")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset=".6" stop-color="#bae6fd"/><stop offset="1" stop-color="#e0f2fe"/></linearGradient>
    <linearGradient id="${id("erba")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4ade80"/><stop offset="1" stop-color="#15803d"/></linearGradient>
    <linearGradient id="${id("pilastro")}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".65" stop-color="#e2e8f0"/><stop offset="1" stop-color="#94a3b8"/></linearGradient>
  </defs>
  <rect width="240" height="240" fill="url(#${id("cielo")})"/>
  <circle cx="196" cy="34" r="16" fill="#fef9c3" opacity=".9"/>
  <path d="M0 112c40-18 80-22 120-12s80 6 120-6v40H0Z" fill="#86efac" opacity=".8"/>
  <rect y="128" width="240" height="112" fill="url(#${id("erba")})"/>
  <path d="M104 136h32l40 104H64Z" fill="#e7e5e4"/><path d="M104 136h32l4 10h-40Z" fill="#d6d3d1"/>
  <path d="M0 132c6-18 22-24 34-20v24H0Z M206 112c14-4 30 4 34 22H206Z" fill="#166534"/>
  <path d="M56 ${arco(56)}Q120 16 184 ${arco(184)}" fill="none" stroke="${SCOCCA}" stroke-width="5" stroke-linecap="round"/>
  ${sbarre}
  <path d="M56 104H184M56 134H184" stroke="${SCOCCA}" stroke-width="5" stroke-linecap="round"/>
  <path d="M120 44V136" stroke="${SCOCCA}" stroke-width="5"/>
  <circle cx="114" cy="112" r="3" fill="${ACCENTO}"/><circle cx="126" cy="112" r="3" fill="${ACCENTO}"/>
  <rect x="30" y="44" width="26" height="100" rx="5" fill="url(#${id("pilastro")})"/>
  <rect x="184" y="44" width="26" height="100" rx="5" fill="url(#${id("pilastro")})"/>
  <rect x="26" y="36" width="34" height="10" rx="4" fill="${SCOCCA}"/><rect x="180" y="36" width="34" height="10" rx="4" fill="${SCOCCA}"/>
  <circle cx="43" cy="28" r="8" fill="${CALDO}"/><circle cx="197" cy="28" r="8" fill="${CALDO}"/>
  <circle cx="40" cy="25" r="2.5" fill="#fff" opacity=".8"/><circle cx="194" cy="25" r="2.5" fill="#fff" opacity=".8"/>`);
}

function albero() {
  const id = idDi("albero");
  const caso = pseudoCasuale(7);
  let neve = "";
  for (let i = 0; i < 46; i++)
    neve += `<circle cx="${(caso() * 240).toFixed(1)}" cy="${(caso() * 200).toFixed(1)}" r="${(0.8 + caso() * 1.6).toFixed(1)}" fill="#fff" opacity="${(0.25 + caso() * 0.5).toFixed(2)}"/>`;
  const colori = [CALDO, "#f43f5e", VETRO, "#fde68a", "#f97316"];
  const fili = [
    [86, 70, 154, 62],
    [72, 104, 168, 96],
    [58, 140, 182, 130],
  ];
  let luci = "";
  fili.forEach(([x1, y1, x2, y2], k) => {
    luci += `<path d="M${x1} ${y1}Q120 ${y1 + 16} ${x2} ${y2}" fill="none" stroke="#fef3c7" stroke-opacity=".5" stroke-width="1.2"/>`;
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      const x = (1 - t) ** 2 * x1 + 2 * (1 - t) * t * 120 + t ** 2 * x2;
      const y = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * (y1 + 16) + t ** 2 * y2;
      const c = colori[(i + k) % colori.length];
      luci += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="${c}" opacity=".55" filter="url(#${id("sfoca3")})"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${c}"/>`;
    }
  });
  return tela(`<defs>
    <linearGradient id="${id("bg")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SCOCCA}"/><stop offset="1" stop-color="#020617"/></linearGradient>
    <radialGradient id="${id("caldo")}" cx=".5" cy=".45" r=".5"><stop offset="0" stop-color="${CALDO}" stop-opacity=".35"/><stop offset="1" stop-color="${CALDO}" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id("chioma")}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4ade80"/><stop offset=".55" stop-color="${VERDE}"/><stop offset="1" stop-color="#14532d"/></linearGradient>
    <filter id="${id("sfoca3")}" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="3"/></filter><filter id="${id("sfoca8")}"><feGaussianBlur stdDeviation="8"/></filter>
  </defs>
  <rect width="240" height="240" fill="url(#${id("bg")})"/>
  <circle cx="120" cy="100" r="120" fill="url(#${id("caldo")})"/>
  ${neve}
  <rect y="170" width="240" height="70" fill="#e2e8f0" opacity=".16"/>
  <rect x="110" y="146" width="20" height="18" rx="3" fill="#78350f"/>
  <path d="M120 38 52 150h136Z" fill="url(#${id("chioma")})"/>
  <path d="M120 30 66 116h108Z" fill="url(#${id("chioma")})"/>
  <path d="M120 22 80 82h80Z" fill="url(#${id("chioma")})"/>
  <path d="M120 22 80 82h12l28-44Z M120 30 66 116h12l42-70Z M120 38 52 150h12l56-96Z" fill="#fff" opacity=".12"/>
  ${luci}
  <circle cx="120" cy="20" r="14" fill="${CALDO}" opacity=".6" filter="url(#${id("sfoca8")})"/>
  <path d="M120 8l3.5 7.5 8 .9-6 5.4 1.7 8-7.2-4.1-7.2 4.1 1.7-8-6-5.4 8-.9Z" fill="${CALDO}"/>
  <rect x="70" y="150" width="30" height="24" rx="3" fill="${ACCENTO}"/><path d="M85 150v24M70 160h30" stroke="${FRONTALE}" stroke-width="3"/>
  <rect x="140" y="156" width="26" height="18" rx="3" fill="#e11d48"/><path d="M153 156v18" stroke="${CALDO}" stroke-width="3"/>`);
}

function lampione() {
  const id = idDi("lampione");
  let mattoni = "";
  for (let r = 0; r < 12; r++) {
    const sfasa = r % 2 ? 0 : -22;
    for (let c = 0; c < 7; c++)
      mattoni += `<rect x="${sfasa + c * 44 + 1}" y="${r * 20 + 1}" width="42" height="18" rx="2" fill="#fff" opacity="${(0.025 + ((r * 7 + c) % 5) * 0.012).toFixed(3)}"/>`;
  }
  return tela(`<defs>
    <linearGradient id="${id("bg")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#475569"/><stop offset="1" stop-color="#111827"/></linearGradient>
    <radialGradient id="${id("alone")}" cx=".5" cy=".38" r=".5"><stop offset="0" stop-color="${CALDO}" stop-opacity=".55"/><stop offset=".5" stop-color="#f59e0b" stop-opacity=".18"/><stop offset="1" stop-color="#f59e0b" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id("vetro")}" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#fffbeb"/><stop offset=".35" stop-color="#fde68a"/><stop offset="1" stop-color="#f59e0b" stop-opacity=".55"/></radialGradient>
    <filter id="${id("sfoca3")}" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="3"/></filter>
  </defs>
  <rect width="240" height="240" fill="url(#${id("bg")})"/>
  ${mattoni}
  <circle cx="120" cy="92" r="130" fill="url(#${id("alone")})"/>
  <rect x="160" y="34" width="22" height="58" rx="5" fill="${SCOCCA}"/>
  <path d="M160 52h-14v14" fill="none" stroke="${SCOCCA}" stroke-width="7" stroke-linecap="round"/>
  <path d="M94 44h52l-8-12h-36Z" fill="${SCOCCA}"/>
  <rect x="114" y="22" width="12" height="10" rx="3" fill="${SCOCCA}"/>
  <rect x="96" y="46" width="48" height="82" rx="4" fill="url(#${id("vetro")})"/>
  <ellipse cx="120" cy="92" rx="12" ry="18" fill="#fff" opacity=".85" filter="url(#${id("sfoca3")})"/>
  <path d="M114 84q6 10 12 0M116 96q4 6 8 0" fill="none" stroke="#b45309" stroke-width="1.6"/>
  <rect x="114" y="68" width="12" height="8" rx="2" fill="#94a3b8"/>
  <path d="M96 46v82M144 46v82M110 46v82M130 46v82" stroke="${SCOCCA}" stroke-width="3.5"/>
  <rect x="92" y="42" width="56" height="7" rx="2" fill="${SCOCCA}"/>
  <path d="M90 128h60l-8 12h-44Z" fill="${SCOCCA}"/>
  <circle cx="120" cy="146" r="4" fill="${SCOCCA}"/>
  <path d="M100 52l6 0-4 60h-4Z" fill="#fff" opacity=".35"/>`);
}

function prato() {
  const id = idDi("prato");
  let strisce = "";
  for (let i = -6; i < 8; i++) {
    const x1 = 120 + i * 9;
    const x2 = 120 + i * 60;
    const x3 = 120 + (i + 1) * 60;
    const x0 = 120 + (i + 1) * 9;
    strisce += `<path d="M${x1} 96L${x2} 240H${x3}L${x0} 96Z" fill="${i % 2 ? "#4ade80" : VERDE}"/>`;
  }
  let gocce = "";
  for (let a = -70; a <= 70; a += 14) {
    const rad = (a * Math.PI) / 180;
    const dx = Math.sin(rad);
    gocce += `<path d="M156 126Q${(156 + dx * 34).toFixed(1)} ${(80 - Math.cos(rad) * 8).toFixed(1)} ${(156 + dx * 58).toFixed(1)} ${(128 - Math.cos(rad) * 4).toFixed(1)}" fill="none" stroke="${VETRO}" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 6" opacity=".95"/>`;
  }
  return tela(`<defs>
    <linearGradient id="${id("cielo")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#f0f9ff"/></linearGradient>
    <radialGradient id="${id("chioma")}" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#86efac"/><stop offset=".6" stop-color="${VERDE}"/><stop offset="1" stop-color="#15803d"/></radialGradient>
  </defs>
  <rect width="240" height="240" fill="url(#${id("cielo")})"/>
  <circle cx="200" cy="30" r="14" fill="#fef9c3"/>
  <path d="M0 98c18-22 44-22 60-12 14-14 40-12 54 0 16-12 42-10 56 2 18-14 52-10 70 4v10H0Z" fill="#166534"/>
  ${strisce}
  <rect x="44" y="70" width="8" height="46" rx="3" fill="#78350f"/>
  <circle cx="48" cy="56" r="28" fill="url(#${id("chioma")})"/><circle cx="30" cy="70" r="16" fill="url(#${id("chioma")})"/><circle cx="66" cy="70" r="17" fill="url(#${id("chioma")})"/>
  <ellipse cx="48" cy="118" rx="20" ry="4" fill="#14532d" opacity=".35"/>
  ${gocce}
  <rect x="151" y="120" width="10" height="12" rx="3" fill="${SCOCCA}"/><circle cx="156" cy="119" r="4" fill="${ACCENTO}"/>
  <ellipse cx="196" cy="150" rx="14" ry="5" fill="${FRONTALE}" opacity=".9"/><ellipse cx="212" cy="172" rx="16" ry="6" fill="${FRONTALE}" opacity=".9"/><ellipse cx="228" cy="198" rx="18" ry="7" fill="${FRONTALE}" opacity=".9"/>`);
}

/* I gruppi, nell'ordine in cui la scelta li mostra. */
export const GRUPPI_DISEGNI = Object.freeze([
  Object.freeze({ chiave: "svago", nome: Object.freeze({ it: "Svago", en: "Entertainment" }) }),
  Object.freeze({ chiave: "esterno", nome: Object.freeze({ it: "Fuori casa", en: "Outdoors" }) }),
  Object.freeze({ chiave: "feste", nome: Object.freeze({ it: "Feste", en: "Holidays" }) }),
]);

/* Un SVG si costruisce una volta sola: chi lo chiede due volte riceve la
 * stessa stringa, e una griglia di disegni non rifa' la neve a ogni giro. */
const unaVolta = (costruisci) => {
  let fatto = "";
  return () => (fatto ||= costruisci());
};

const voce = ({ chiave, gruppo, it, en, parole, fuoco, svg }) =>
  Object.freeze({
    chiave,
    gruppo,
    nome: Object.freeze({ it, en }),
    parole: Object.freeze(parole),
    fuoco: Object.freeze(fuoco),
    svg: unaVolta(svg),
  });

export const DISEGNI_DA_RIQUADRO = Object.freeze([
  voce({
    chiave: "proiettore",
    gruppo: "svago",
    it: "Proiettore",
    en: "Projector",
    parole: [
      "proiettore",
      "projector",
      "cinema",
      "film",
      "movie",
      "home theater",
      "videoproiettore",
    ],
    fuoco: [50, 45],
    svg: proiettore,
  }),
  voce({
    chiave: "decoder",
    gruppo: "svago",
    it: "Decoder",
    en: "Set-top box",
    parole: ["decoder", "tv", "televisione", "television", "sky", "set-top box", "ricevitore"],
    fuoco: [50, 38],
    svg: decoder,
  }),
  voce({
    chiave: "cancello",
    gruppo: "esterno",
    it: "Cancello",
    en: "Gate",
    parole: ["cancello", "gate", "ingresso", "entrance", "varco", "carraio"],
    fuoco: [50, 40],
    svg: cancello,
  }),
  voce({
    chiave: "albero",
    gruppo: "feste",
    it: "Albero di Natale",
    en: "Christmas tree",
    parole: ["albero", "natale", "christmas", "tree", "lucine", "luci", "lights", "feste"],
    fuoco: [50, 38],
    svg: albero,
  }),
  voce({
    chiave: "lampione",
    gruppo: "esterno",
    it: "Luce esterna",
    en: "Outdoor light",
    parole: [
      "lampione",
      "lanterna",
      "luce esterna",
      "outdoor light",
      "lantern",
      "applique",
      "lampada",
    ],
    fuoco: [50, 36],
    svg: lampione,
  }),
  voce({
    chiave: "prato",
    gruppo: "esterno",
    it: "Prato",
    en: "Lawn",
    parole: [
      "prato",
      "pratino",
      "lawn",
      "giardino",
      "garden",
      "irrigazione",
      "irrigation",
      "sprinkler",
    ],
    fuoco: [50, 45],
    svg: prato,
  }),
]);

const PER_CHIAVE = new Map(DISEGNI_DA_RIQUADRO.map((d) => [d.chiave, d]));

/** Il disegno con questa chiave, o `null`. */
export function disegnoDaRiquadro(chiave) {
  return PER_CHIAVE.get(String(chiave ?? "")) || null;
}

/* Le parole si confrontano senza accenti e senza maiuscole: «Natale» e
 * «natale», «Proiettore» e «proièttore» sono la stessa ricerca. */
const piana = (testo) =>
  String(testo ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * I disegni che rispondono a questo testo: nel nome (nella lingua chiesta, e
 * in italiano e inglese comunque) e nelle parole. Vuoto: tutti, nell'ordine
 * del catalogo. Ogni parola scritta deve trovarsi da qualche parte.
 */
export function cercaDisegni(testo, lingua = "it") {
  const cercate = piana(testo).split(" ").filter(Boolean);
  if (!cercate.length) return [...DISEGNI_DA_RIQUADRO];
  return DISEGNI_DA_RIQUADRO.filter((d) => {
    const dove = piana(
      [d.chiave, d.nome?.[lingua], d.nome?.it, d.nome?.en, ...(d.parole || [])].join(" "),
    );
    return cercate.every((parola) => dove.includes(parola));
  });
}
