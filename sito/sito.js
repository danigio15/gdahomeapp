/* Le poche cose che il sito fa da sé.
 *
 * Sono quattro, e nessuna è indispensabile: la pagina si legge tutta anche
 * senza JavaScript. La lingua, l'ombra sotto la barra quando si scende, le
 * schede che compaiono salendo, e il modulo dei contatti che resta sulla
 * pagina invece di andarsene.
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
    /* Il modulo dei contatti porta con sé la lingua in cui si stava leggendo,
     * così la pagina di risposta — quella di chi lo manda senza JavaScript, o
     * il messaggio sotto il tasto — parla la stessa. */
    var campoLingua = document.querySelector('#modulo-contatti input[name="lingua"]');
    if (campoLingua) campoLingua.value = lingua;
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

  /* ── Il menu sul telefono ─────────────────────────────────────────────
   *
   * Si apre e si chiude da solo, perché è un <details>. Quello che il
   * browser non fa da sé è richiuderlo quando si è scelta una voce: senza
   * queste righe il pannello resterebbe aperto sopra la sezione a cui si è
   * appena arrivati. Senza JavaScript resta aperto, e si chiude col tasto. */
  var menu = document.querySelector(".menu");
  if (menu) {
    var voci = document.querySelectorAll(".navigazione a");
    for (var v = 0; v < voci.length; v += 1) {
      voci[v].addEventListener("click", function () {
        menu.removeAttribute("open");
      });
    }
    document.addEventListener("keydown", function (evento) {
      if (evento.key === "Escape") menu.removeAttribute("open");
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

  /* ── Il modulo dei contatti ───────────────────────────────────────────
   *
   * Il modulo è un modulo: senza JavaScript parte lo stesso, e il tramite
   * risponde con una pagina. Con JavaScript resta sulla pagina: si manda in
   * JSON e l'esito compare sotto il tasto, nella lingua che si sta leggendo.
   *
   * Se il tramite dice che la posta non è configurata, o non risponde, si
   * dice **dove scrivere**: un modulo che dice «errore» e basta è una porta
   * chiusa senza il cartello. L'indirizzo lo porta la pagina, in
   * `data-scrivi`, e sta scritto una volta sola. */
  var modulo = document.getElementById("modulo-contatti");
  if (modulo && window.fetch && window.FormData) {
    var esito = modulo.querySelector(".modulo-esito");
    var scrivi = modulo.getAttribute("data-scrivi") || "";
    var PAROLE = {
      it: {
        invio: "Sto mandando…",
        partito: "Il messaggio è partito. Rispondiamo a {email}.",
        spenta: "Il modulo non è attivo in questo momento: scrivi a {scrivi}.",
        troppo: "Hai scritto poco fa: aspetta un po' prima di mandare un altro messaggio.",
        sbagliato: "Controlla il nome, l'email e il messaggio.",
        nonPartito: "Il messaggio non è partito. Riprova fra poco, oppure scrivi a {scrivi}.",
      },
      en: {
        invio: "Sending…",
        partito: "Your message is on its way. We answer at {email}.",
        spenta: "The form is not active right now: write to {scrivi}.",
        troppo: "You wrote a moment ago: wait a little before sending another message.",
        sbagliato: "Check the name, the email and the message.",
        nonPartito: "Your message did not go out. Try again shortly, or write to {scrivi}.",
      },
    };
    var linguaDellaPagina = function () {
      return document.documentElement.lang === "en" ? "en" : "it";
    };
    var detto = function (quale, email) {
      return PAROLE[linguaDellaPagina()][quale]
        .replace("{email}", email || "")
        .replace("{scrivi}", scrivi);
    };
    var mostra = function (testo, male) {
      esito.textContent = testo;
      esito.classList.toggle("male", Boolean(male));
      esito.hidden = false;
    };

    modulo.addEventListener("submit", function (evento) {
      evento.preventDefault();
      /* I campi vuoti li dice il browser, con le sue parole e nella sua
       * lingua: qui non si manda niente finché non sono a posto. */
      if (modulo.reportValidity && !modulo.reportValidity()) return;
      var corpo = {};
      new FormData(modulo).forEach(function (valore, nome) {
        corpo[nome] = String(valore);
      });
      corpo.lingua = linguaDellaPagina();

      modulo.setAttribute("aria-busy", "true");
      mostra(detto("invio"));
      fetch(modulo.getAttribute("action"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(corpo),
      })
        .then(function (risposta) {
          return risposta
            .json()
            .catch(function () {
              return {};
            })
            .then(function (letto) {
              return { stato: risposta.status, letto: letto };
            });
        })
        .then(function (arrivato) {
          if (arrivato.stato === 200 && arrivato.letto.inviato) {
            mostra(detto("partito", corpo.email));
            modulo.reset();
          } else if (arrivato.stato === 503) {
            mostra(detto("spenta"), true);
          } else if (arrivato.stato === 429) {
            mostra(detto("troppo"), true);
          } else if (arrivato.stato === 400) {
            mostra(detto("sbagliato"), true);
          } else {
            mostra(detto("nonPartito"), true);
          }
        })
        .catch(function () {
          mostra(detto("nonPartito"), true);
        })
        .then(function () {
          modulo.removeAttribute("aria-busy");
        });
    });
  }
})();
