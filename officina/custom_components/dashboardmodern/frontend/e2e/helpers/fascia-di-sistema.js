/* La fascia che il sistema si prende — la tacca in cima, i tasti di Android in
 * fondo — finta dove la legge la plancia, non dove la scrive.
 *
 * Un browser di prova `env(safe-area-inset-*)` non ce l'ha. Le prove la
 * fingevano scrivendo le variabili `--dm-cima-di-sistema` e
 * `--dm-fondo-di-sistema`, che pero' sono il risultato della misura della
 * plancia: e la plancia rimisura da sola — all'avvio, a tre e a sei secondi,
 * a ogni «resize» — e la riscriveva con lo zero vero del browser. A seconda di
 * quando cadeva la misura la prova vedeva il telefono con la tacca o quello
 * senza, e la stessa pagina era verde o rossa.
 *
 * Qui si finge il telefono: la sonda con cui la plancia misura la fascia (un
 * riquadro alto `env(safe-area-inset-*)`, `navigation-section.js`) risponde il
 * numero scelto, e ogni misura della plancia — la prima e quelle dopo — lo
 * legge. Poi si chiede una misura, come fa il telefono quando gira.
 */
export async function fingiLaFasciaDiSistema(page, lato, pixel, { attesa = 400 } = {}) {
  await page.evaluate(
    ({ lato, pixel }) => {
      const id = `dm-prova-fascia-${lato}`;
      let foglio = document.getElementById(id);
      if (!foglio) {
        foglio = document.createElement("style");
        foglio.id = id;
        document.head.append(foglio);
      }
      foglio.textContent = `div[style*="safe-area-inset-${lato}"][style*="visibility: hidden"]{height:${pixel}px!important}`;
      window.dispatchEvent(new Event("resize"));
    },
    { lato, pixel },
  );
  await page.waitForTimeout(attesa);
}
