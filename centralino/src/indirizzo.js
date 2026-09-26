/* Da chi arriva una richiesta.
 *
 * Davanti c'e' Caddy, sulla stessa macchina, quindi il socket dice quasi
 * sempre 127.0.0.1: contare per socket vorrebbe dire contare tutti insieme.
 * Caddy scrive l'indirizzo vero in `x-forwarded-for`, e quella riga si crede
 * **solo** se a portarla e' stata la macchina stessa. Da chiunque altro
 * l'intestazione la scrive chi vuole, e non si crede.
 *
 * Stava in `posta.js`, e la chat faceva per conto suo — fidandosi della riga
 * chiunque la portasse. Adesso la regola e' una, e sta qui.
 */

const DA_QUI = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export const eDaQui = (indirizzo) => DA_QUI.has(String(indirizzo || ""));

export function daChi(richiesta) {
  const diretto = richiesta?.socket?.remoteAddress || "?";
  const passato = String(richiesta?.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return DA_QUI.has(diretto) && passato ? passato : diretto;
}

/* Se la richiesta e' arrivata **direttamente** da questa macchina, senza
 * passare da Caddy: chi guarda da dentro — `curl` sulla macchina, le prove —
 * e non chi bussa da fuori. Caddy aggiunge sempre `x-forwarded-for`, quindi
 * una richiesta che lo porta e' passata da li'. */
export function eDaDentro(richiesta) {
  return (
    eDaQui(richiesta?.socket?.remoteAddress) &&
    !richiesta?.headers?.["x-forwarded-for"] &&
    !richiesta?.headers?.forwarded
  );
}

/* Chi si conta, quando si conta «per indirizzo».
 *
 * In IPv4 un indirizzo e' un indirizzo. In IPv6 no: a una casa, a un telefono,
 * a una macchina a noleggio arriva di solito un /64 intero — diciotto
 * miliardi di miliardi di indirizzi — e chi ne cambia uno a ogni tentativo
 * non verrebbe mai contato due volte, e intanto riempirebbe i tetti di tutti.
 * Allora in IPv6 si conta la rete, i primi sessantaquattro bit. Un IPv4
 * scritto alla IPv6 (`::ffff:1.2.3.4`) e' un IPv4, e si conta come tale. */
export function reteDi(indirizzo) {
  let testo = String(indirizzo ?? "")
    .trim()
    .toLowerCase();
  if (!testo.includes(":")) return testo || "?";
  testo = testo.replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const mappato = /^[0:]*:ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(testo);
  if (mappato) return mappato[1];
  const [prima, dopo = ""] = testo.split("::");
  const davanti = prima ? prima.split(":") : [];
  const dietro = testo.includes("::") && dopo ? dopo.split(":") : [];
  const mancano = Math.max(0, 8 - davanti.length - dietro.length);
  const gruppi = testo.includes("::")
    ? [...davanti, ...Array(mancano).fill("0"), ...dietro]
    : davanti;
  const rete = gruppi
    .slice(0, 4)
    .map((uno) => (uno || "0").replace(/^0+(?=.)/, ""))
    .join(":");
  return `${rete}::/64`;
}
