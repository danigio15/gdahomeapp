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
