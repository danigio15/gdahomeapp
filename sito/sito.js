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
   * gdahome in Home Assistant (`ponte/console/console.js`) e la stessa regola
   * dell'app (`app/lib/parole.dart`).
   *
   * L'italiano sta nella pagina e l'inglese si mette sopra, non il contrario:
   * senza JavaScript — o prima che questo arrivi — la pagina è già scritta in
   * una lingua intera, e chi la legge non vede mai un buco.
   *
   * `data-en` porta il contenuto, col suo `<b>` dentro se in quella frase c'è;
   * `data-en-<attributo>` porta un attributo — `data-en-alt` riempie `alt`,
   * `data-en-content` il `content` di una `<meta>`, `data-en-src` l'indirizzo
   * della plancia nel riquadro.
   *
   * Si cambia lingua **senza ricaricare**, e quindi l'italiano non si può
   * buttare via: alla prima passata si mette da parte, e da lì in poi le due
   * lingue si scambiano quante volte si vuole. */
  var LINGUE = ["it", "en"];
  var DOVE_SI_RICORDA = "gdahome.lingua";

  /* Quello che la pagina diceva in italiano, messo da parte prima di toccarla.
   * Una `Map` e non un attributo in più: questa roba non serve a nessun altro,
   * e nel documento non ci deve finire. */
  var italiano = new Map();
  var attributiItaliani = new Map();

  function raccogliLItaliano() {
    var conTesto = document.querySelectorAll("[data-en]");
    for (var i = 0; i < conTesto.length; i += 1) {
      italiano.set(conTesto[i], conTesto[i].innerHTML);
    }
    var tutti = document.querySelectorAll("*");
    for (var q = 0; q < tutti.length; q += 1) {
      var nodo = tutti[q];
      for (var a = 0; a < nodo.attributes.length; a += 1) {
        var nome = nodo.attributes[a].name;
        if (nome.indexOf("data-en-") !== 0) continue;
        var quale = nome.slice("data-en-".length);
        if (!attributiItaliani.has(nodo)) attributiItaliani.set(nodo, {});
        attributiItaliani.get(nodo)[quale] = nodo.getAttribute(quale) || "";
      }
    }
  }

  /* La lingua del browser, con la regola dell'app: la prima che sappiamo
   * dire, e in mancanza l'inglese — che è la lingua di chi non ha la nostra. */
  function quellaDelBrowser() {
    var quali =
      navigator.languages && navigator.languages.length
        ? navigator.languages
        : [navigator.language || ""];
    for (var q = 0; q < quali.length; q += 1) {
      var codice = String(quali[q]).slice(0, 2).toLowerCase();
      if (LINGUE.indexOf(codice) !== -1) return codice;
    }
    return "en";
  }

  /* Quella scelta coi due tasti, se è stata scelta. Vince su quella del
   * browser: chi ha il telefono in inglese e vuole leggere in italiano lo
   * dice una volta sola. In una finestra anonima il deposito può non esserci,
   * o rispondere con un errore: allora non si ricorda niente e si va con
   * quella del browser, che è meglio di una pagina che non si apre. */
  function quellaScelta() {
    try {
      var detta = window.localStorage.getItem(DOVE_SI_RICORDA);
      return LINGUE.indexOf(detta) !== -1 ? detta : null;
    } catch (_male) {
      return null;
    }
  }

  function ricorda(lingua) {
    try {
      window.localStorage.setItem(DOVE_SI_RICORDA, lingua);
    } catch (_male) {
      /* Non si ricorda: pazienza, la pagina è già cambiata. */
    }
  }

  function scrivi(lingua) {
    document.documentElement.lang = lingua;
    var conTesto = document.querySelectorAll("[data-en]");
    for (var i = 0; i < conTesto.length; i += 1) {
      var nodo = conTesto[i];
      var suo = lingua === "en" ? nodo.getAttribute("data-en") : italiano.get(nodo);
      if (suo !== undefined && suo !== null && nodo.innerHTML !== suo) nodo.innerHTML = suo;
    }
    var tutti = document.querySelectorAll("*");
    for (var q = 0; q < tutti.length; q += 1) {
      var chi = tutti[q];
      for (var a = 0; a < chi.attributes.length; a += 1) {
        var nome = chi.attributes[a].name;
        if (nome.indexOf("data-en-") !== 0) continue;
        var quale = nome.slice("data-en-".length);
        var prima = attributiItaliani.get(chi) || {};
        var valore = lingua === "en" ? chi.attributes[a].value : prima[quale];
        if (valore !== undefined) chi.setAttribute(quale, valore);
      }
    }
    var tasti = document.querySelectorAll(".lingua");
    for (var b = 0; b < tasti.length; b += 1) {
      tasti[b].setAttribute("aria-pressed", String(tasti[b].dataset.lingua === lingua));
    }
  }

  raccogliLItaliano();
  scrivi(quellaScelta() || quellaDelBrowser());

  var tasti = document.querySelectorAll(".lingua");
  for (var n = 0; n < tasti.length; n += 1) {
    tasti[n].addEventListener("click", function (evento) {
      var lingua = evento.currentTarget.dataset.lingua;
      ricorda(lingua);
      scrivi(lingua);
    });
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
