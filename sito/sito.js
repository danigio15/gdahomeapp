/* Le poche cose che il sito fa da sé.
 *
 * Sono quattro, e nessuna è indispensabile: la pagina si legge tutta anche
 * senza JavaScript. Qui c'è il chiaro e scuro, l'ombra sotto la barra quando
 * si scende, le schede che compaiono salendo, e i prezzi presi da
 * `listino.js` invece che ribattuti a mano nell'HTML — che è l'unico pezzo
 * che, se andasse storto, lascerebbe un buco visibile, e per questo è anche
 * l'unico scritto in modo che si veda subito.
 */

(function () {
  "use strict";

  /* ── Chiaro e scuro ────────────────────────────────────────────────────
   *
   * Di suo il sito segue il tema del sistema: nessun attributo, e ci pensano
   * le media query. Il bottone serve a chi vuole l'altro, e la scelta resta
   * in questo browser. Se la memoria non si può leggere — finestra anonima,
   * dati bloccati — non succede niente di male: si torna a seguire il
   * sistema. */
  var radice = document.documentElement;
  var CHIAVE = "gdahome-tema";

  function ricorda(tema) {
    try {
      if (tema) localStorage.setItem(CHIAVE, tema);
      else localStorage.removeItem(CHIAVE);
    } catch (e) {
      /* Pazienza: vale per questa visita e basta. */
    }
  }

  try {
    var scelto = localStorage.getItem(CHIAVE);
    if (scelto === "chiaro" || scelto === "scuro") radice.setAttribute("data-tema", scelto);
  } catch (e) {
    /* Come sopra. */
  }

  function scuroAdesso() {
    var messo = radice.getAttribute("data-tema");
    if (messo) return messo === "scuro";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  var bottoneTema = document.getElementById("cambia-tema");
  if (bottoneTema)
    bottoneTema.addEventListener("click", function () {
      var nuovo = scuroAdesso() ? "chiaro" : "scuro";
      radice.setAttribute("data-tema", nuovo);
      ricorda(nuovo);
    });

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

  /* ── I prezzi, presi da listino.js ────────────────────────────────────
   *
   * L'alternativa era ribatterli nell'HTML, e allora il giorno che cambia un
   * prezzo ce ne sarebbero due diversi nella stessa pagina. */
  var L = window.LISTINO;
  if (!L) return;

  var gratis = document.getElementById("elenco-gratis");
  if (gratis)
    L.sempreGratis.forEach(function (riga) {
      var li = document.createElement("li");
      li.textContent = riga;
      gratis.appendChild(li);
    });

  var corpo = document.getElementById("riga-singoli");
  if (corpo)
    L.singoli.forEach(function (a) {
      var tr = document.createElement("tr");

      var td1 = document.createElement("td");
      var cosa = document.createElement("div");
      cosa.className = "cosa";
      var img = document.createElement("img");
      img.src = "statico/oggetti/" + a.disegno + ".svg";
      img.alt = "";
      img.width = 24;
      img.height = 24;
      img.loading = "lazy";
      var testo = document.createElement("div");
      testo.appendChild(document.createTextNode(a.titolo));
      var piccolo = document.createElement("small");
      piccolo.textContent = a.sotto;
      testo.appendChild(piccolo);
      cosa.appendChild(img);
      cosa.appendChild(testo);
      td1.appendChild(cosa);

      var td2 = document.createElement("td");
      td2.textContent = a.gratis;

      var td3 = document.createElement("td");
      var soldi = document.createElement("span");
      soldi.className = "soldi";
      soldi.textContent = a.soldi;
      td3.appendChild(soldi);

      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      corpo.appendChild(tr);
    });
})();
