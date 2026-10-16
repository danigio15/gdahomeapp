/* Il caricatore: l'unico file che Lovelace conosce, e non cambia mai.
 *
 * **Perche' esiste.** La cartina vera (`plancia.js`, accanto) si dichiarava a
 * Lovelace con la versione dell'add-on dentro l'indirizzo —
 * `/local/gdahome/plancia.js?v=1.11.11` — perche' il browser non si tenesse
 * quella di ieri. Il prezzo era che **ogni aggiornamento cambiava l'elenco
 * delle risorse** di Home Assistant, e quell'elenco il frontend lo legge una
 * volta sola, quando la pagina parte. Sul computer si rimedia con F5; nell'app
 * di Home Assistant sul telefono il frontend resta aperto per giorni, F5 non
 * c'e', e chi apriva la plancia dopo un aggiornamento si trovava davanti il
 * foglietto «ricarica questa pagina» senza sapere come si fa.
 *
 * **A chi serve, oggi.** Non alla plancia: la sua Plancia ha dentro solo la
 * tessera «pagina web» di Home Assistant, che apre `apri.html` (vedi
 * `accompagna.js`), e nessuna risorsa. Questo file si dichiara solo dove le
 * tessere di gdahome le usa ancora qualcuno — le voci di chi installa
 * (`gdahome-riquadro`), o una dashboard dove qualcuno si e' messo
 * `gdahome-plancia` — e altrove la risorsa si toglie
 * (`ponte/src/plance-in-casa.js`, `chiUsaLeTessere`).
 *
 * **Come funziona.** Lovelace conosce questo file e basta, a un
 * indirizzo che non cambia fra una versione e l'altra. Lui, ogni volta che una
 * pagina di Home Assistant parte, chiede `versione.json` — un foglietto che il
 * ponte riscrive a ogni avvio, chiesto **senza cache** — e importa la cartina
 * di quella versione. L'aggiornamento cambia il foglietto, non l'elenco delle
 * risorse: nessuna pagina ha piu' niente da ricaricare.
 *
 * **Perche' non sta nell'add-on.** Perche' questo file lo carica il browser
 * dentro la pagina di Home Assistant prima che ci sia una sessione
 * dell'ingress: dall'add-on non lo saprebbe prendere. `/local/` invece si
 * apre senza chiavi, ed e' il motivo per cui li' dentro non c'e' niente di
 * segreto — una versione e un nome di file.
 *
 * **Una pagina che la tessera ce l'ha gia'.** Una pagina partita con la
 * cartina di prima ha gia' `gdahome-plancia` registrata, e un nome registrato
 * non si ridefinisce: la cartina nuova se ne accorge (`customElements.get`) e
 * non fa niente. Quella pagina continua con la tessera che ha — che apre lo
 * stesso riquadro dell'ingress, e la plancia dentro e' gia' quella nuova,
 * perche' la serve l'add-on — e prende la cartina nuova la prossima volta che
 * il frontend riparte da se'. Ricaricarla d'ufficio vorrebbe dire strappare la
 * pagina dalle mani di chi la sta usando, per una cosa che funziona.
 *
 * **Scritto alla vecchia.** Niente `await` fuori dalle funzioni e niente
 * sintassi recente: questo file lo eseguono anche i telefoni e i tablet di
 * qualche anno fa, e un errore di sintassi qui vuol dire nessuna plancia, da
 * nessuna parte.
 *
 * Questo file non va cambiato alla leggera: Lovelace lo conosce per indirizzo,
 * e se cambia il contenuto bisogna cambiare anche `GIRO_DEL_CARICATORE` in
 * `ponte/src/plance-in-casa.js` — il che rimette, una volta, una risorsa nuova
 * nell'elenco. E' il motivo per cui qui dentro non c'e' niente da cambiare.
 */

(function () {
  var qui = import.meta.url;

  /* Il nome della cartina, con la versione in coda: cambia la versione, cambia
   * l'indirizzo, e la cache del browser non c'entra piu'. */
  function laCartina(versione) {
    return new URL(versione ? "plancia.js?v=" + encodeURIComponent(versione) : "plancia.js", qui)
      .href;
  }

  /* La versione di adesso, chiesta senza cache.
   *
   * `no-store` e il tempo in coda sono due cinture per la stessa cosa: il
   * primo lo rispetta il browser, il secondo anche chi sta in mezzo e la cache
   * non la chiede a nessuno (un proxy, l'accesso remoto). Il foglietto e' di
   * poche decine di byte: richiederlo a ogni avvio della pagina non costa. */
  function laVersione() {
    if (typeof fetch !== "function") return Promise.resolve("");
    return fetch(new URL("versione.json?t=" + Date.now(), qui).href, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(function (risposta) {
        return risposta && risposta.ok ? risposta.json() : null;
      })
      .then(function (detto) {
        return detto && typeof detto.versione === "string" ? detto.versione : "";
      })
      .catch(function () {
        /* Senza foglietto si carica la cartina senza versione: meglio quella,
         * anche se il browser se la tenesse di ieri, che niente. */
        return "";
      });
  }

  laVersione()
    .then(function (versione) {
      return import(laCartina(versione));
    })
    .catch(function (errore) {
      /* Una riga nella console del browser, l'unica che si vede dove il guaio
       * succede: senza, la plancia direbbe «Errore di configurazione» e
       * nessuno saprebbe da dove cominciare. */
      if (typeof console !== "undefined" && console.warn)
        console.warn("gdahome: la cartina della plancia non si carica", errore);
    });
})();
