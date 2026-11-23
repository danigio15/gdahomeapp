/* La fotografia della casa, al polso.
 *
 * E' la stessa che il telefono porta all'Apple Watch e a Wear OS (`LaFoto.kt`,
 * `LaFoto.swift`): stessi campi, stessi nomi, letta campo per campo, e tutto
 * quello che non torna vale «non c'e'». Qui ne serve un pezzo — la casa, i
 * dispositivi, le azioni, le misure — piu' una cosa che gli altri orologi non
 * hanno ancora: `luminosita`, da 0 a 100, per le luci che la sanno dire.
 * Chi non la manda ha una luce che si accende e si spegne, e basta.
 *
 * Gli elenchi hanno lo stesso tetto degli altri orologi: la memoria al polso
 * e' poca, e una fotografia grande non deve poterla riempire.
 */

const DISPOSITIVI_AL_MASSIMO = 24;
const RIGHE_AL_MASSIMO = 12;
const FOTO_AL_MASSIMO = 64 * 1024;

const pulito = (valore) => (typeof valore === "string" ? valore.trim() : "");

function righe(elenco, fino = RIGHE_AL_MASSIMO) {
  if (!Array.isArray(elenco)) return [];
  return elenco.slice(0, fino).filter((r) => r && typeof r === "object");
}

/** La fotografia, da un testo JSON o da un oggetto; `null` se non lo e'. */
export function leggiLaFoto(arrivata) {
  let json = arrivata;
  if (typeof arrivata === "string") {
    if (!arrivata || arrivata.length > FOTO_AL_MASSIMO) return null;
    try {
      json = JSON.parse(arrivata);
    } catch (e) {
      return null;
    }
  }
  if (!json || typeof json !== "object") return null;

  const dispositivi = [];
  for (const r of righe(json.dispositivi, DISPOSITIVI_AL_MASSIMO)) {
    const id = pulito(r.id);
    const nome = pulito(r.nome);
    if (!id || !nome) continue;
    const luminosita = Number.isFinite(r.luminosita)
      ? Math.max(0, Math.min(100, Math.round(r.luminosita)))
      : null;
    dispositivi.push({
      id,
      nome,
      genere: pulito(r.genere).toLowerCase(),
      stato: pulito(r.stato),
      acceso: r.acceso === true,
      luminosita,
    });
  }

  const azioni = [];
  for (const r of righe(json.azioni)) {
    const id = pulito(r.id);
    const nome = pulito(r.nome);
    if (id && nome) azioni.push({ id, nome, subito: r.subito === true });
  }

  const misure = [];
  for (const r of righe(json.misure)) {
    const nome = pulito(r.nome);
    const valore = pulito(r.valore);
    if (nome && valore) misure.push({ nome, valore });
  }

  return {
    premium: json.premium === true,
    casa: pulito(json.casa),
    quando: Number.isFinite(json.quando) ? json.quando : 0,
    dispositivi,
    azioni,
    misure,
  };
}

/** Le righe di uno o piu' generi: le luci, oppure i cancelli e le porte. */
export function diGenere(foto, generi) {
  return (foto?.dispositivi || []).filter((d) => generi.includes(d.genere));
}

/** «Aggiornato adesso», «Di 12 minuti fa»: come `ComeStaLaCasa` su Wear OS. */
export function diQuando(quando, adesso = Date.now()) {
  if (!quando || quando <= 0) return "Non si sa di quando è";
  const minuti = Math.floor((adesso - quando) / 60000);
  if (minuti <= 1) return "Aggiornato adesso";
  if (minuti >= 60) return `Di ${Math.floor(minuti / 60)} ore fa`;
  return `Di ${minuti} minuti fa`;
}

/* La parola girata, come `PAROLA_OPPOSTA` in `LaFoto.kt`: la riga cambia al
 * tocco, prima che la casa dica com'e' andata. */
const PAROLA_OPPOSTA = {
  Accesa: "Spenta",
  Spenta: "Accesa",
  Acceso: "Spento",
  Spento: "Acceso",
  Aperta: "Chiusa",
  Chiusa: "Aperta",
  Aperto: "Chiuso",
  Chiuso: "Aperto",
  On: "Off",
  Off: "On",
};

export function girato(d) {
  return { ...d, acceso: !d.acceso, stato: PAROLA_OPPOSTA[d.stato] || d.stato };
}
