/*
 * Per-dashboard storage isolation.
 *
 * Every dashboardmodern dashboard uses the same ~37 localStorage keys, all
 * prefixed cd_ or dm_. Two dashboards on one Home Assistant — the integration
 * and the user's own plancia, or several users' dashboards — therefore share
 * one namespace and overwrite each other's token, cameras, rooms and config.
 *
 * This wraps localStorage so those keys are transparently rewritten to
 * cd_<instance>_… for this dashboard only. The dashboard code is untouched: it
 * still reads and writes cd_cameras, but the value lands under its own instance
 * prefix and no other dashboard can see or clobber it.
 *
 * The instance id comes from, in order: an explicit id the integration injects,
 * or a stable id derived from the document's own URL path, so a standalone
 * plancia and an integration-hosted copy always differ. Keys without the cd_/dm_
 * prefix (other apps on the same origin) are left completely alone.
 */

/*
 * L'anteprima del Config (#379).
 *
 * «Il drag e drop non deve essere sulla plancia: ti avevo detto di creare
 * un'anteprima nel Config dove si fa questa cosa.» Il Config mostra la sezione
 * vera dentro una cornice larga quanto il telefono o quanto il computer — e'
 * l'unico modo perche' la pagina si disponga come si disporrebbe li', con le
 * sue regole per lo schermo stretto e il disegno del telefono. Dentro la
 * cornice gira questa stessa plancia: la cornice porta scritto
 * `data-dm-anteprima="<pagina>:<dispositivo>"`, e questo pezzo, che e' il
 * primo a girare, la rende un'anteprima prima che parta qualunque altra cosa:
 *
 *  - legge quello che legge la plancia di fuori (la configurazione, gli stati
 *    della casa), ma quello che scrive resta in memoria: una plancia di prova
 *    non deve cambiare niente di vero. Quello che si salva lo passa a chi la
 *    ospita, che lo scrive per davvero (`dmScriviDallAnteprima`);
 *  - parla con Home Assistant dallo stesso filo della plancia di fuori, ma
 *    senza comandi: un tocco nell'anteprima non accende una luce, non apre il
 *    cancello e non salva niente in Home Assistant. Un messaggio che comanda o
 *    scrive diventa un `ping`, che non fa niente a nessuno.
 */
(function () {
  "use strict";
  var cornice = null;
  try {
    cornice = window.frameElement;
  } catch (e) {}
  var segno = cornice && cornice.getAttribute ? cornice.getAttribute("data-dm-anteprima") : "";
  if (!segno || window.__DASHBOARDMODERN_ANTEPRIMA__) return;
  var su = window.parent;
  var parti = String(segno).split(":");
  window.__DASHBOARDMODERN_ANTEPRIMA__ = { pagina: parti[0] || "", dispositivo: parti[1] || "" };
  [
    "__DASHBOARDMODERN_INSTANCE__",
    "__DASHBOARDMODERN_PROFILE__",
    "__DASHBOARDMODERN_PRIMARY__",
    "__DASHBOARDMODERN_HOSTED__",
    "__DASHBOARDMODERN_LOCALE__",
    "__DASHBOARDMODERN_UTENTE__",
    "__GDAHOME__",
    "__GDAHOME_CONFIGURATA__",
  ].forEach(function (k) {
    try {
      if (window[k] === undefined && su[k] !== undefined) window[k] = su[k];
    } catch (e) {}
  });

  /* Quello che si scrive resta qui: si legge prima la memoria, poi il vero. */
  function inMemoria(vera) {
    var scritte = {};
    var TOLTA = {};
    var ha = function (k) {
      return Object.prototype.hasOwnProperty.call(scritte, k);
    };
    return {
      getItem: function (k) {
        k = String(k);
        if (ha(k)) return scritte[k] === TOLTA ? null : scritte[k];
        return vera.getItem(k);
      },
      setItem: function (k, v) {
        scritte[String(k)] = String(v);
      },
      removeItem: function (k) {
        scritte[String(k)] = TOLTA;
      },
      clear: function () {
        for (var i = 0; i < vera.length; i += 1) scritte[vera.key(i)] = TOLTA;
      },
      key: function (i) {
        return vera.key(i);
      },
      get length() {
        return vera.length;
      },
    };
  }
  ["localStorage", "sessionStorage"].forEach(function (nome) {
    try {
      var finta = inMemoria(window[nome]);
      Object.defineProperty(window, nome, {
        configurable: true,
        get: function () {
          return finta;
        },
      });
    } catch (e) {}
  });

  var COMANDI = /^(call_service|execute_script|fire_event)$/;
  var SCRITTURE = /(^|[\/_])(save|set|update|create|delete|remove|write|reset|import|upload)([\/_]|$)/;
  function senzaComandi(Base) {
    function Anteprima(url, protocolli) {
      var presa = protocolli === undefined ? new Base(url) : new Base(url, protocolli);
      var manda = presa.send;
      presa.send = function (dato) {
        try {
          var m = typeof dato === "string" ? JSON.parse(dato) : null;
          var tipo = m && typeof m.type === "string" ? m.type : "";
          if (tipo && tipo !== "auth" && (COMANDI.test(tipo) || SCRITTURE.test(tipo)))
            dato = JSON.stringify({ id: m.id, type: "ping" });
        } catch (e) {}
        return manda.call(presa, dato);
      };
      return presa;
    }
    try {
      Object.keys(Base).forEach(function (k) {
        Anteprima[k] = Base[k];
      });
    } catch (e) {}
    Anteprima.CONNECTING = 0;
    Anteprima.OPEN = 1;
    Anteprima.CLOSING = 2;
    Anteprima.CLOSED = 3;
    Anteprima.prototype = Base.prototype;
    return Anteprima;
  }
  try {
    var ponte = su.__DASHBOARDMODERN_BRIDGE_WS__;
    if (typeof ponte === "function") {
      var filo = senzaComandi(ponte);
      window.__DASHBOARDMODERN_BRIDGE_WS__ = filo;
      window.__DASHBOARDMODERN_BRIDGED__ = true;
      window.WebSocket = filo;
    } else if (typeof su.WebSocket === "function") {
      window.WebSocket = senzaComandi(su.WebSocket);
    }
  } catch (e) {}
})();

(function () {
  "use strict";

  // The English shell historically declared lang="it". Resolve the variant
  // synchronously before modules-entry.js reads documentElement.lang, so every
  // native renderer receives the correct locale without runtime DOM patches.
  try {
    var dashboardPath = window.location && window.location.pathname ? window.location.pathname : "";
    if (/(^|\/)dashboard-en\.html$/i.test(dashboardPath)) document.documentElement.lang = "en";
  } catch (e) {}

  var NS_PREFIX = "cdns_"; // where the resolved instance id is remembered
  var MANAGED = /^(cd_|dm_)/;

  function resolveInstanceId() {
    // 0. From the frame URL: the host appends ?dmi=<instance>, readable
    // synchronously at parse time. This is the authoritative source.
    try {
      var m = /[?&]dmi=([^&]+)/.exec(window.location.search || "");
      if (m && m[1]) return decodeURIComponent(m[1]);
    } catch (e) {}
    // 1. Explicit id from the integration, if hosted.
    try {
      if (window.__DASHBOARDMODERN_INSTANCE__) return String(window.__DASHBOARDMODERN_INSTANCE__);
    } catch (e) {}
    // 1b. From the parent window: the host sets the markers there because the
    // frame's own pre-navigation window is replaced before scripts run. This
    // is what keeps multiple plance (config entries) truly isolated.
    try {
      if (window.parent && window.parent !== window && window.parent.__DASHBOARDMODERN_INSTANCE__) {
        return String(window.parent.__DASHBOARDMODERN_INSTANCE__);
      }
    } catch (e) {}
    // 2. A stable id from this document's path, so two files on one origin
    //    (e.g. /local/plancia.html vs the integration mount) never collide.
    var path = "";
    try {
      path = window.location && window.location.pathname ? window.location.pathname : "";
    } catch (e) {}
    var hash = 5381;
    for (var i = 0; i < path.length; i += 1) hash = ((hash << 5) + hash + path.charCodeAt(i)) >>> 0;
    return "p" + hash.toString(36);
  }

  var INSTANCE = resolveInstanceId();
  var PREFIX = "cd_" + INSTANCE + "_";

  // Only wrap once, even if the prelude runs twice.
  if (window.__DASHBOARDMODERN_STORAGE_NS__) return;
  window.__DASHBOARDMODERN_STORAGE_NS__ = INSTANCE;

  var real = window.localStorage;

  function mapKey(key) {
    var k = String(key);
    // Managed keys are namespaced; the connection key stays namespaced too, so
    // one dashboard's token can never reach another.
    return MANAGED.test(k) ? PREFIX + k : k;
  }

  // A minimal Storage-compatible shim delegating to the real localStorage with
  // key remapping. Only the methods the dashboard uses are wrapped.
  var shim = {
    getItem: function (key) {
      return real.getItem(mapKey(key));
    },
    setItem: function (key, value) {
      return real.setItem(mapKey(key), value);
    },
    removeItem: function (key) {
      return real.removeItem(mapKey(key));
    },
    clear: function () {
      // Clear only this instance's keys, never another dashboard's.
      var doomed = [];
      for (var i = 0; i < real.length; i += 1) {
        var key = real.key(i);
        if (key && key.indexOf(PREFIX) === 0) doomed.push(key);
      }
      for (var j = 0; j < doomed.length; j += 1) real.removeItem(doomed[j]);
    },
    key: function (index) {
      return real.key(index);
    },
    get length() {
      return real.length;
    },
  };

  try {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: function () {
        return shim;
      },
    });
  } catch (e) {
    // If the property cannot be redefined, fall back to replacing the methods
    // in place so namespacing still applies.
    try {
      real.getItem = shim.getItem;
      real.setItem = shim.setItem;
      real.removeItem = shim.removeItem;
    } catch (e2) {}
  }
})();
