/// Quello che si aggiunge alla pagina della plancia prima di servirla.
///
/// La plancia di DashboardModern e' una pagina web che gira dentro il pannello
/// di Home Assistant. Per farla girare altrove — dentro l'app, o dentro un
/// browser — le si dice le stesse cose che le dice il pannello: che e'
/// **ospitata** (e quindi non chiede segni e usa il WebSocket che trova),
/// quale istanza e quale profilo e', in che lingua. Piu' due cose nostre: le
/// misure delle barre del telefono, e la porta della Config, che esce dalla
/// barra della plancia per diventare una voce del menu.
///
/// **Non si tocca un file della dashboard.** I file restano quelli pubblicati
/// — e devono restarlo, che il ponte li ricontrolla uno per uno e una plancia
/// con un file cambiato si direbbe modificata. Qui si aggiunge soltanto
/// qualcosa alla **pagina servita**.
///
/// Sta in un file suo, e senza `dart:io`, perche' i posti che servono la
/// plancia sono due e non uno: il servitore dentro l'app, che e' un server
/// vero, e il service worker del browser, che un server non e'. Le iniezioni
/// sono le stesse; cambia soltanto **da dove arriva il WebSocket**, ed e'
/// l'unica cosa che si passa da fuori.
library;

import 'dart:convert';

import 'pannello.dart';

/// Le premesse di una pagina della plancia.
class Premesse {
  Premesse({
    this.pannello,
    this.lingua = 'it',
    this.leggera = false,
    this.margini = (alto: 0.0, basso: 0.0),
  });

  /// Quale pannello della plancia si sta aprendo: istanza, profilo, primario.
  PannelloDellaPlancia? pannello;

  String lingua;

  /// La plancia leggera: niente animazioni ripetute, niente vetro sfocato.
  bool leggera;

  /// Quanto prendono le barre del telefono, in punti.
  ({double alto, double basso}) margini;

  /// Lo stile della plancia leggera: vince su tutto con `!important`.
  static const String stileLeggero =
      '<style id="gdahome-leggera">'
      '*,*::before,*::after{animation-iteration-count:1!important}'
      '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'
      '</style>';

  /// Le misure delle barre del telefono, e cosa farne.
  ///
  /// Va **in fondo alla pagina**, non in testa, e con un selettore piu' lungo
  /// del necessario. La plancia scrive le sue misure con `!important`, e fra
  /// due `!important` della stessa forza vince l'ultimo che si legge: messo in
  /// testa, il mio perdeva e la barra della plancia finiva sotto i tasti del
  /// telefono.
  String get stileDelleMisure =>
      '<style id="gdahome-misure">'
      ':root{--gdahome-alto:${margini.alto.round()}px;'
      '--gdahome-basso:${margini.basso.round()}px}'
      /* In cima: al **corpo**, non a `.app`.
       *
       * `.app` era il guscio della plancia, e nel foglio di stile c'e'
       * ancora — `padding: 20px`, largo al massimo 1250 — ma nella pagina
       * non esiste piu': dopo `<body>` vengono lo sfondo, la testata, la
       * barra e le sezioni, senza nessun guscio in mezzo. Quindi la regola
       * non colpiva niente, `--gdahome-alto` non lo leggeva nessuno, e la
       * testata «Smart Home» finiva sotto l'orologio del telefono: il
       * riquadro arriva ai bordi e nessuno lasciava spazio. Il corpo c'e'
       * sempre. */
      'html body{padding-top:var(--gdahome-alto)!important;'
      'padding-bottom:calc(var(--gdahome-basso) + 40px)!important}'
      'html body.cd-nav-fixed nav.tabs.bottom-nav-bar,'
      'html body nav.tabs.bottom-nav-bar.visible{'
      'bottom:calc(var(--gdahome-basso) + 8px)!important}'
      'html body.cd-nav-fixed{'
      'padding-bottom:calc(var(--gdahome-basso) + 112px)!important}'
      'html body .bottom-nav-handle{'
      'bottom:calc(var(--gdahome-basso) + 6px)!important}'
      '@media (hover:hover) and (pointer:fine){'
      'html body nav.tabs.bottom-nav-bar:hover{'
      'bottom:calc(var(--gdahome-basso) + 20px)!important}}'
      '</style>';

  /// La Config esce da dentro la plancia e diventa una voce del menu.
  ///
  /// **Non e' una Config che le somiglia: e' la sua pagina.** Nella dashboard
  /// la Configurazione e' una pagina della plancia — `#page-config`, con la
  /// sua insegna, la tessera «Configura Entita'» che apre l'editor, il Tema,
  /// la Tavolozza, la Barra di navigazione, «Sostieni il progetto» — e qui
  /// non si tocca nemmeno una riga di lei. Si sposta solo la **porta**: la
  /// voce nella barra in fondo alla plancia sparisce, e ad aprire la pagina
  /// e' il menu dell'app, che preme la stessa linguetta.
  ///
  /// Prima l'app apriva solo l'editor e la pagina la murava: cosi' di quella
  /// pagina si perdevano il Tema, la Tavolozza e la Barra — che l'app si era
  /// rifatti suoi, in Flutter, e riscriveva nel deposito della pagina a ogni
  /// caricamento — e si perdeva il tasto delle donazioni. Tre comandi rifatti
  /// per tre comandi che c'erano gia', e due padroni per la stessa
  /// preferenza. Ne resta uno: il suo.
  ///
  /// Dentro la plancia le porte della Config erano tre: la linguetta nella
  /// barra, l'ingranaggio in cima e il menu del tasto ☰. Nella dashboard ci
  /// vogliono tutte — li' la Config e' una pagina come le altre — e nell'app
  /// no: la porta e' la voce del menu. Restano nascoste tutte e tre, e con
  /// loro il tasto «← HOME» che la pagina si disegna in cima: dal menu si
  /// torna col menu.
  ///
  /// Restano nascoste due tessere. «**Sostieni il progetto**», perche' qui
  /// gli acquisti ci sono: una donazione accanto a un listino e' la stessa
  /// domanda fatta due volte. E le **Segnalazioni**, `#dm-tkt-card`. Non
  /// per grafica — quella e' buona — ma perche' la sua strada non c'e'. La
  /// tessera della plancia parla all'integrazione di Home Assistant, che
  /// nell'app non esiste, e vuole un conto GitHub di chi scrive; le
  /// segnalazioni dell'app passano dal ponte e dal centralino, col gettone
  /// che sta nel Worker, e chi manda non ha bisogno di nessun conto. Due
  /// porte per la stessa cosa, e una delle due si scuserebbe: si lascia
  /// quella che funziona, nel menu. La tessera dell'Assistenza si toglie da
  /// se' quando la chat non risponde (`assistenza-section.js`), e non c'e'
  /// niente da nascondere.
  ///
  /// `gdahomeApriLaConfig` e' la maniglia che l'app tira, e riprova per
  /// qualche secondo: una pagina appena aperta i suoi script li sta ancora
  /// leggendo, e la linguetta il suo ascoltatore non ce l'ha ancora.
  /// `gdahomeTornaDallaConfig` e' quella dell'altro verso: la plancia torna
  /// dov'era prima, che e' quello che si aspetta chi dal menu torna alla
  /// Plancia. Con `#gdahome-config` nell'indirizzo la pagina si apre da se':
  /// serve dove non si puo' chiamare una funzione da fuori.
  static const String laConfigFuoriDallaPlancia =
      '<style id="gdahome-config-fuori">'
      '#tab-config,.tab[data-tab="config"]{display:none!important}'
      '#page-config #dm-tkt-card{display:none!important}'
      /* Il tasto «← HOME» in cima alla Configurazione: nella plancia porta
         alla sua Home, e chi ci arriva dal menu dell'app si ritrova sulla
         plancia senza aver chiesto niente. Dal menu si torna col menu. Sulle
         altre pagine resta: li' e' l'unico modo di uscire. */
      'html body #page-config .back-home-btn{display:none!important}'
      /* Le altre due porte della Config, dentro la plancia: l'ingranaggio in
         cima e il menu che apre il tasto ☰. Nella dashboard ci vogliono —
         li' la Config e' una pagina come le altre — nell'app no: la porta e'
         la voce del menu, e tre porte sulla stessa stanza sono due di
         troppo. Col ☰ se ne va anche il «Reset totale», che cancella tutta
         la configurazione: nell'app non si perde niente che non si possa
         rifare dalla Config, e non si tocca per sbaglio. */
      'html body header .dm-editor-entry,'
      'html body header .ha-menu-btn{display:none!important}'
      /* «Sostieni il progetto»: nella plancia e' il grazie di un progetto
         che vive di tempo libero, e li' ci sta. Nell'app no: qui gli
         acquisti ci sono, e chiedere una donazione accanto a un listino e'
         chiedere due volte la stessa cosa in due modi diversi. La tessera,
         la pastiglia dell'editor e la card di Impostazioni: tutte e tre. */
      'html body #page-config .dm-sostieni-tessera,'
      'html body #editor-modal .dm-sostieni-pastiglia,'
      'html body #ed-body .dm-sostieni-card{display:none!important}'
      /* Sulla Configurazione la barra in fondo alla plancia se ne va, e con
         lei la sua maniglia.
         Nella dashboard ci sta: li' la Config e' una pagina come le altre, e
         dalla barra si passa da una all'altra. Nell'app no: la Config si
         apre dal menu, e con tutt'e due le barre a schermo si toccava una
         sezione della plancia e ci si ritrovava altrove senza sapere da
         dove. Una schermata, una barra: quella del menu.
         La classe la mette il programma qui sotto, perche' il fondo della
         pagina non e' figlio della pagina aperta e il foglio di stile da
         solo non arriva. */
      'html body.gdahome-in-config nav.tabs.bottom-nav-bar,'
      'html body.gdahome-in-config .bottom-nav-handle{display:none!important}'
      '</style>'
      '<script>(function(){'
      /* Le linguette si cercano senza virgolette dentro le virgolette: un
         selettore con un attributo qui costerebbe tre livelli di segni. */
      'var laVoce=function(quale){'
      'var tutte=document.querySelectorAll(".tab");'
      'for(var i=0;i<tutte.length;i+=1)'
      'if(tutte[i].getAttribute("data-tab")===quale)return tutte[i];'
      'return null;'
      '};'
      'var ciSiamo=function(){'
      'var pagina=document.getElementById("page-config");'
      'return !!pagina&&pagina.classList.contains("active");'
      '};'
      'var dove="";'
      'var apri=function(prove){'
      'if(ciSiamo())return;'
      'var voce=laVoce("config");'
      'if(voce){'
      'var attiva=document.querySelector(".tab.active");'
      'if(attiva&&attiva!==voce)dove=attiva.getAttribute("data-tab")||"";'
      'try{voce.click();}catch(male){}'
      'if(ciSiamo())return;'
      '}'
      'if(prove<120)setTimeout(function(){apri(prove+1);},60);'
      '};'
      /* «Apri la Config» scritto nell'indirizzo e' un **ordine**, non uno
         stato: si esegue una volta e si cancella.
         Lasciandolo li', ogni ricarica della pagina riapriva la
         Configurazione — e chi dal menu tornava alla Plancia si vedeva
         ancora la Config senza capire perche'. Quell'indirizzo col
         cancelletto lo scrive il ripiego del telefono
         (`riquadro/sul_telefono.dart`) quando la chiamata diretta non riesce
         al primo colpo: serve una volta, non per sempre. */
      'var scordaLIndirizzo=function(){'
      'try{if(/gdahome-config/.test(location.hash)&&history.replaceState)'
      'history.replaceState(null,"",location.pathname+location.search);}'
      'catch(male){}'
      '};'
      'window.gdahomeApriLaConfig=function(){apri(0);setTimeout(guarda,0);};'
      /* Il ritorno alla plancia tocca una linguetta della barra in fondo:
         e' la porta della dashboard, la stessa che usa il suo «← HOME». Ma
         quella barra, mentre si sta in Config, la nascondiamo noi — e su una
         cosa nascosta un tocco non fa quello che farebbe un dito. Allora la
         classe se ne va **prima**; poi si guarda se ci si e' riusciti, e se
         no si riprova, perche' la pagina puo' essere ancora a meta' del suo
         lavoro. */
      'var torna=function(prove){'
      'if(!ciSiamo()){scordaLIndirizzo();setTimeout(guarda,0);return;}'
      'try{document.body.classList.remove("gdahome-in-config");}catch(male){}'
      'var voce=laVoce(dove)||laVoce("home");'
      'if(voce)try{voce.click();}catch(male){}'
      'if(!ciSiamo()){scordaLIndirizzo();setTimeout(guarda,0);return;}'
      'if(prove<60){setTimeout(function(){torna(prove+1);},60);return;}'
      'setTimeout(guarda,0);'
      '};'
      'window.gdahomeTornaDallaConfig=function(){torna(0);};'
      /* Quando la plancia cambia pagina, l'app lo viene a sapere.
       *
       * La barra della plancia resta li' anche sulla Configurazione — e' una
       * sua pagina come le altre — e da li' si tocca «Energia» e si va
       * sull'energia: giusto. Quello che non era giusto e' che il menu
       * dell'app restasse segnato su «Configurazione» mentre sotto c'era
       * l'energia. Adesso la pagina lo dice, e il menu si sposta da se'.
       *
       * Due strade perche' i posti dove l'app gira sono due: sul telefono
       * un canale del WebView, nel browser il riquadro che parla a chi lo
       * ospita. Chi non c'e' non risponde, e non fa danni. */
      'var dico=function(quale){'
      'try{if(window.gdahomeDice&&window.gdahomeDice.postMessage)'
      'window.gdahomeDice.postMessage(quale);}catch(male){}'
      'try{if(window.parent&&window.parent!==window)'
      'window.parent.postMessage({gdahome:"pagina",dove:quale},"*");}'
      'catch(male){}'
      '};'
      'var quale=function(){'
      'var attiva=document.querySelector(".tab.active");'
      'return attiva?(attiva.getAttribute("data-tab")||""):"";'
      '};'
      'var segna=function(){'
      'try{document.body.classList.toggle("gdahome-in-config",ciSiamo());}'
      'catch(male){}'
      '};'
      'var ultima="";'
      'var guarda=function(){'
      'segna();'
      'var adesso=quale();'
      'if(adesso&&adesso!==ultima){ultima=adesso;dico(adesso);}'
      '};'
      /* Si guarda **dopo** il tocco, non al posto suo: quale pagina si
       * accende lo decide la plancia, e leggerlo prima vorrebbe dire
       * indovinarlo. Il giro dopo, la classe «active» e' gia' dove deve. */
      'document.addEventListener("click",function(evento){'
      'if(evento.target&&evento.target.closest&&evento.target.closest(".tab"))'
      'setTimeout(guarda,0);'
      '},true);'
      'document.addEventListener("DOMContentLoaded",guarda);'
      'var dallIndirizzo=function(){'
      'if(!/gdahome-config/.test(location.hash))return;'
      /* Si cancella **prima** di aprire: se la pagina si ricarica mentre la
         Config e' aperta, quell'ordine e' gia' stato eseguito e non deve
         valere una seconda volta. */
      'scordaLIndirizzo();'
      'apri(0);'
      '};'
      'document.addEventListener("DOMContentLoaded",dallIndirizzo);'
      'dallIndirizzo();'
      '})();</script>';

  /* Il tema, la tavolozza e la barra qui non si scrivono, e non e' una
   * dimenticanza. Sono tre comandi della pagina Config della plancia — «su
   * questo dispositivo», lo dice lei — e la pagina se li tiene nel deposito
   * locale, che e' suo e dura. Scriverglieli da fuori a ogni caricamento
   * voleva dire cancellare la scelta di chi l'aveva fatta dalle sue tessere.
   * Vedi `laConfigFuoriDallaPlancia`. */

  /// La pagina, con in testa quello che le serve sapere.
  ///
  /// [ilWebSocket] e' un pezzo di programma che vale un costruttore di
  /// WebSocket: e' l'unica cosa che cambia fra il servitore e il browser, e
  /// per questo si passa da fuori invece di deciderla qui. Dentro l'app e' il
  /// WebSocket vero puntato al servitore; nel browser e' finto, e i messaggi
  /// li porta la pagina che ospita.
  String conLePremesse(String pagina, {required String ilWebSocket}) {
    final quale = pannello;
    final premessa =
        '<script>'
        'window.__DASHBOARDMODERN_HOSTED__=true;'
        'window.__DASHBOARDMODERN_BRIDGE_WS__=$ilWebSocket;'
        'window.__DASHBOARDMODERN_INSTANCE__=${jsonEncode(quale?.istanza ?? '')};'
        'window.__DASHBOARDMODERN_PROFILE__=${jsonEncode(quale?.profilo ?? 'primary')};'
        'window.__DASHBOARDMODERN_PRIMARY__=${quale?.primario ?? true};'
        'window.__DASHBOARDMODERN_LOCALE__=${jsonEncode(lingua)};'
        'window.__GDAHOME__=true;'
        '</script>'
        '${leggera ? stileLeggero : ''}';
    final testa = RegExp(
      r'<head[^>]*>',
      caseSensitive: false,
    ).firstMatch(pagina);
    final conLaPremessa = testa == null
        ? '$premessa$pagina'
        : pagina.replaceRange(testa.end, testa.end, premessa);

    /* Le misure e la porta della Config vanno in fondo: vedi
     * [stileDelleMisure], che spiega perche' in testa perdevano contro lo
     * stile della plancia. */
    final inFondo = '$stileDelleMisure$laConfigFuoriDallaPlancia';
    final fine = RegExp(
      r'</body\s*>',
      caseSensitive: false,
    ).firstMatch(conLaPremessa);
    if (fine == null) return '$conLaPremessa$inFondo';
    return conLaPremessa.replaceRange(fine.start, fine.start, inFondo);
  }
}

/// Il WebSocket di chi ha un server sotto: quello vero del browser, con una
/// cosa in piu' — qualunque indirizzo gli si dia, va al servitore.
///
/// La plancia, ospitata, apre un secondo filo per la configurazione e lo punta
/// a un nome finto (`dashboardmodern.invalid`), contando sul fatto che il
/// ponte del pannello l'indirizzo lo ignora. Qui il ponte e' un server, e
/// l'indirizzo va detto giusto.
const String ilWebSocketDelServitore =
    '(function(Vera){'
    'var dove=(location.protocol==="https:"?"wss://":"ws://")+location.host+"/api/websocket";'
    'function Cucita(_indirizzo,protocolli){'
    'return protocolli===undefined?new Vera(dove):new Vera(dove,protocolli);}'
    'Cucita.prototype=Vera.prototype;'
    'Cucita.CONNECTING=0;Cucita.OPEN=1;Cucita.CLOSING=2;Cucita.CLOSED=3;'
    'return Cucita;})(window.WebSocket)';
