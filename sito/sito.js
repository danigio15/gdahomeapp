/* Le poche cose che il sito fa da sé.
 *
 * Sono tre, e due non sono indispensabili: la pagina si legge tutta anche
 * senza JavaScript. La lingua, l'ombra sotto la barra quando si scende, e le
 * schede che compaiono salendo.
 *
 * Quello che conta — la plancia — non sta qui: sta nel riquadro, ed è un
 * documento suo con la sua vita.
 */

(function () {
  "use strict";

  /* ── Le due lingue ────────────────────────────────────────────────────
   *
   * Le parole inglesi stanno **nella pagina**, in `data-en` accanto alle
   * italiane: si rileggono una accanto all'altra, e non c'è una seconda copia
   * di `index.html` da tenere allineata. È lo stesso modo della console di
   * gdahome in Home Assistant (`ponte/console/console.js`), e la stessa
   * regola dell'app (`app/lib/parole.dart`): si prende la prima lingua del
   * browser che sappiamo dire, e chi non ha nessuna delle due legge in
   * inglese.
   *
   * L'italiano sta nella pagina e l'inglese si mette sopra, non il contrario:
   * senza JavaScript — o prima che questo arrivi — la pagina è già scritta in
   * una lingua intera, e chi la legge non vede mai un buco.
   *
   * `data-en` porta il contenuto, col suo `<b>` dentro se in quella frase
   * c'è; `data-en-<attributo>` porta un attributo — `data-en-alt` riempie
   * `alt`, `data-en-content` riempie `content` di una `<meta>`. */
  var INGLESE = (function () {
    var quali =
      navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || ""];
    for (var q = 0; q < quali.length; q += 1) {
      var codice = String(quali[q]).slice(0, 2).toLowerCase();
      if (codice === "it") return false;
      if (codice === "en") return true;
    }
    return true;
  })();

  if (INGLESE) {
    document.documentElement.lang = "en";
    var tutti = document.querySelectorAll("[data-en]");
    for (var n = 0; n < tutti.length; n += 1) {
      tutti[n].innerHTML = tutti[n].getAttribute("data-en");
    }
    var ovunque = document.querySelectorAll("*");
    for (var o = 0; o < ovunque.length; o += 1) {
      var nodo = ovunque[o];
      for (var a = nodo.attributes.length - 1; a >= 0; a -= 1) {
        var nome = nodo.attributes[a].name;
        if (nome.indexOf("data-en-") !== 0) continue;
        nodo.setAttribute(nome.slice("data-en-".length), nodo.attributes[a].value);
      }
    }
  }

  /* ── Se la plancia non c'è ────────────────────────────────────────────
   *
   * La plancia dentro il riquadro non sta nella repository: la rimette lo
   * script quando si pubblica. Se quel passo non fosse stato fatto, la pagina
   * si aprirebbe **senza un errore da nessuna parte** e in mezzo ci sarebbe un
   * riquadro vuoto alto seicento pixel — che è il modo peggiore di rompersi,
   * perché sembra la pagina.
   *
   * Quindi si chiede, e basta una testa: il file c'è o non c'è. È dello
   * stesso indirizzo, quindi nessuno lo vieta. Se non c'è, al posto del
   * riquadro va un pezzo che dice cosa manca e dove guardare — e se la
   * domanda stessa non si potesse fare, non si tocca niente: meglio un
   * riquadro vuoto che una pagina che si cancella un pezzo da sola. */
  var telaio = document.querySelector(".telaio-dentro");
  var invece = document.querySelector(".telaio-senza");
  if (telaio && invece && window.fetch) {
    fetch(telaio.getAttribute("src"), { method: "HEAD" })
      .then(function (risposta) {
        if (risposta.ok) return;
        telaio.hidden = true;
        invece.hidden = false;
      })
      .catch(function () {
        /* Nessuna risposta: non si sa, e nel dubbio si lascia com'è. */
      });
  }

  /* ── L'ombra sotto la barra ───────────────────────────────────────────── */
  var cappello = document.getElementById("cappello");
  if (cappello) {
    var guarda = function () {
      cappello.classList.toggle("giu", window.scrollY > 8);
    };
    guarda();
    window.addEventListener("scroll", guarda, { passive: true });
  }

  /* ── Comparire salendo ────────────────────────────────────────────────
   *
   * Se il browser non ha l'osservatore, o se chi guarda ha chiesto meno
   * movimento, le schede sono già al loro posto: la classe si toglie e
   * finisce lì. */
  var daMostrare = document.querySelectorAll(".appare");
  var fermi = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!window.IntersectionObserver || fermi) {
    for (var i = 0; i < daMostrare.length; i++) daMostrare[i].classList.add("qui");
  } else {
    var occhio = new IntersectionObserver(
      function (visti) {
        visti.forEach(function (v) {
          if (!v.isIntersecting) return;
          v.target.classList.add("qui");
          occhio.unobserve(v.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );
    for (var k = 0; k < daMostrare.length; k++) occhio.observe(daMostrare[k]);
  }
})();
