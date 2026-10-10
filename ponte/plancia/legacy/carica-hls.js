/* hls.js, quando serve.
 *
 * Serve solo a una telecamera aperta in HLS fuori da Safari, e pesa mezzo
 * megabyte da leggere: la plancia lo leggeva a ogni apertura, prima ancora di
 * togliere il velo. Adesso si prende la prima volta che una telecamera lo
 * chiede (`window.__DM_CARICA_HLS__()`), e intanto, a plancia ferma, si prende
 * da solo, cosi' quando serve e' gia' li'. */
(function () {
  var via = new URL("./vendor/hls.min.js", document.currentScript.src).href;
  var attesa = null;
  window.__DM_CARICA_HLS__ = function () {
    if (window.Hls) return Promise.resolve(window.Hls);
    if (attesa) return attesa;
    attesa = new Promise(function (ok) {
      var s = document.createElement("script");
      s.src = via;
      s.onload = function () {
        ok(window.Hls || null);
      };
      s.onerror = function () {
        attesa = null;
        ok(null);
      };
      document.head.appendChild(s);
    });
    return attesa;
  };
  window.addEventListener(
    "load",
    function () {
      setTimeout(function () {
        var quando =
          window.requestIdleCallback ||
          function (fai) {
            setTimeout(fai, 0);
          };
        quando(
          function () {
            window.__DM_CARICA_HLS__();
          },
          { timeout: 10000 },
        );
      }, 8000);
    },
    { once: true },
  );
})();
