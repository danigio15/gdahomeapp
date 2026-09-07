/* Un Worker che non fa niente, e serve a fare una cosa sola.
 *
 * Quando un Worker si porta dietro dei Durable Object, non si puo' pubblicare
 * sopra un codice che non li esporta: Cloudflare rifiuta, e dice
 *
 *     New version of script does not export class 'Casa' which is
 *     depended on by existing Durable Objects.
 *
 * Non si toglie dal pannello: si toglie con una **migrazione**, e le migrazioni
 * si mandano solo da wrangler. Questo file e' il codice minimo da mandare
 * insieme a quella migrazione — un momento di niente, e poi il Worker torna
 * libero di ricevere il codice che deve avere.
 */

export default {
  async fetch() {
    return new Response(
      JSON.stringify({ errore: "in riparazione: rimetti il codice vero" }),
      { status: 503, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  },
};
