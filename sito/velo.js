/* Il velo d'avvio della plancia, quando la plancia gira dentro il sito.
 *
 * `porta-nel-sito.mjs` lo infila nella plancia insieme alla casa finta, subito
 * prima del preludio: a quel punto il velo (`#cd-boot-overlay`) e' gia' nella
 * pagina, quindi qui lo si trova senza aspettare niente. Nell'add-on questo
 * file non c'e', e la plancia resta com'e'.
 *
 * Fa due cose.
 *
 * **Il nome.** Il velo porta ancora il marchio e il nome del progetto da cui
 * la plancia e' nata. Sul sito di gdahome, sopra la casa demo di gdahome, chi
 * guarda deve leggere gdahome: si cambiano l'immagine e la parola, e nient'altro.
 *
 * **La rete sotto.** La plancia toglie il velo quando i suoi moduli hanno
 * dipinto, e per guardarlo usa `requestAnimationFrame`. Dentro un riquadro
 * Safari quei fotogrammi li puo' sospendere — il riquadro caricato fuori dallo
 * schermo, o il risparmio energetico — e allora il velo resta su una plancia
 * gia' pronta: «si carica e resta sul logo». Qui si guarda con un orologio
 * normale: dal momento in cui la plancia si dichiara pronta
 * (`__DASHBOARDMODERN_READY__`), se dopo dieci secondi il velo e' ancora li',
 * lo si toglie come lo toglierebbe lei. Se la plancia non si dichiara mai
 * pronta non si tocca niente: quello e' un errore vero, e il suo guardiano lo
 * scrive sul velo. */
(function () {
  var MARCHIO = "../../statico/marchio.png";
  var ATTESA_MS = 10000;

  var velo = document.getElementById("cd-boot-overlay");
  if (!velo) return;

  var immagine = velo.querySelector("img");
  if (immagine) immagine.src = MARCHIO;
  var nome = velo.querySelector("b");
  if (nome) nome.textContent = "gdahome";

  var pronta = 0;
  var orologio = setInterval(function () {
    var ancora = document.getElementById("cd-boot-overlay");
    if (!ancora) {
      clearInterval(orologio);
      return;
    }
    /* Il guardiano della plancia, se qualcosa e' andato storto, scrive
     * l'errore sul velo: quello deve restare. */
    if (ancora.dataset.state === "error") {
      clearInterval(orologio);
      return;
    }
    if (!window.__DASHBOARDMODERN_READY__) return;
    if (!pronta) pronta = Date.now();
    if (Date.now() - pronta < ATTESA_MS) return;
    clearInterval(orologio);
    ancora.style.opacity = "0";
    setTimeout(function () {
      if (ancora.parentNode) ancora.parentNode.removeChild(ancora);
    }, 260);
  }, 500);
})();
