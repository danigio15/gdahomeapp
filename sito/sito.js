/* Le poche cose che il sito fa da sé.
 *
 * Sono due, e nessuna è indispensabile: la pagina si legge tutta anche senza
 * JavaScript. L'ombra sotto la barra quando si scende, e le schede che
 * compaiono salendo.
 *
 * Quello che conta — la plancia — non sta qui: sta nel riquadro, ed è un
 * documento suo con la sua vita.
 */

(function () {
  "use strict";

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
