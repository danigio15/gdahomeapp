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
  /// Restano nascoste tre tessere, e per la stessa ragione: nell'app quella
  /// porta c'e' gia', ed e' una voce del menu.
  ///
  /// «**Sostieni il progetto**». Nella plancia e' il grazie di un progetto che
  /// vive di tempo libero, e li' ci sta. Qui no, e adesso per una ragione
  /// diversa da prima: questa pagina si presenta come gdahome — nome e
  /// marchio — e una donazione che porta a un altro progetto, dentro una
  /// pagina che ne porta il nome, e' una cosa che chi la legge non capisce.
  ///
  /// Le **Segnalazioni**, `#dm-tkt-card`. Non per grafica — quella e' buona —
  /// ma perche' la sua strada non c'e': la tessera della plancia parla
  /// all'integrazione di Home Assistant, che nell'app non esiste, e vuole un
  /// conto GitHub di chi scrive; le segnalazioni dell'app passano dal ponte e
  /// dal centralino, e chi manda non ha bisogno di nessun conto.
  ///
  /// E l'**Assistenza**, `#dm-chat-card`. Qui era scritto che non c'era
  /// niente da nascondere, perche' quella tessera si togliesse da se' quando
  /// la chat non risponde (`assistenza-section.js`) — e nell'app la chat non
  /// rispondeva, perche' il ponte quei comandi li rifiutava. Adesso li fa
  /// (`ponte/src/chat.js`), quindi la tessera compare, ed e' la seconda porta
  /// per una stanza che nel menu ha gia' la sua: «Assistenza» per chi chiede
  /// aiuto, «Console» per chi risponde. Restano quelle, che sono schermate
  /// dell'app e non una finestra dentro una pagina dentro un riquadro.
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
      '#page-config #dm-chat-card{display:none!important}'
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
         che vive di tempo libero, e li' ci sta. Qui no: questa pagina si
         presenta come gdahome, e una donazione che porta a un altro
         progetto, dentro una pagina che ne porta il nome, e' una cosa che
         chi la legge non capisce. La tessera, la pastiglia dell'editor e la
         card di Impostazioni: tutte e tre. */
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
      /* Prima di tornare, si chiude quello che sta **sopra**.
       *
       * Chi apre l'editor di una tessera e poi tocca «Plancia» nel menu non
       * ha chiesto di chiudere l'editor: ha chiesto la plancia. Ma l'editor
       * e' una finestra aperta sopra la pagina, e finche' c'e' un tocco su
       * una linguetta della barra in fondo non fa quello che farebbe un dito
       * — la finestra lo copre, o la pagina lo rifiuta. Il risultato era che
       * «Plancia» non faceva niente per tre secondi e mezzo (sessanta prove
       * ogni sessanta millesimi) e poi si arrendeva: sembrava un tasto rotto,
       * ed era un tasto che aspettava.
       *
       * Quindi si chiude da noi, e si chiude **come lo chiuderebbe lui**: il
       * suo tasto di chiusura, se c'e', perche' quel tasto sa anche cosa
       * scrivere e cosa buttare via. Se non c'e', gli si toglie la classe che
       * lo mostra, che e' il ripiego. Nessun salvataggio a sorpresa: chi
       * lascia a meta' un editor e se ne va, se ne va — come toccando fuori.
       *
       * Non si sa quale finestra sia aperta e non si tira a indovinare: si
       * guarda quali ci sono e si chiudono tutte quelle che si vedono. */
      'var chiudiQuelloChEAperto=function(){'
      'try{'
      'var aperte=document.querySelectorAll('
      '".modal.show,.dm-modal.show,#editor-modal.show,dialog[open]");'
      'for(var quale=0;quale<aperte.length;quale+=1){'
      'var finestra=aperte[quale];'
      'var chiudi=finestra.querySelector('
      '"[data-dm-close],.modal-close,.dm-modal-close,.close-btn");'
      'if(chiudi){try{chiudi.click();}catch(male){}}'
      'if(finestra.classList.contains("show"))'
      'finestra.classList.remove("show");'
      'if(finestra.tagName==="DIALOG"&&finestra.open)'
      'try{finestra.close();}catch(male){}'
      '}'
      '}catch(male){}'
      '};'
      'var torna=function(prove){'
      'if(!ciSiamo()){scordaLIndirizzo();setTimeout(guarda,0);return;}'
      'chiudiQuelloChEAperto();'
      'try{document.body.classList.remove("gdahome-in-config");}catch(male){}'
      'var voce=laVoce(dove)||laVoce("home");'
      'if(voce)try{voce.click();}catch(male){}'
      'if(!ciSiamo()){scordaLIndirizzo();setTimeout(guarda,0);return;}'
      'if(prove<60){setTimeout(function(){torna(prove+1);},60);return;}'
      'setTimeout(guarda,0);'
      '};'
      'window.gdahomeTornaDallaConfig=function(){torna(0);};'
      /* Le stesse due maniglie, bussando da fuori con un messaggio.
       *
       * Nel browser l'app le tira **chiamando** la funzione dentro il
       * riquadro, e una funzione dentro un riquadro si chiama solo se la
       * pagina e l'app stanno sulla stessa origine. In casa e' cosi' — la
       * plancia la serve il service worker dell'app, stesso posto — ma non
       * sempre: il collaudo la serve da una porta sua, perche' nel browser un
       * server dentro la pagina non si apre. Li' il browser blocca la
       * chiamata, il tentativo muore dentro un `catch`, e il tasto
       * «Configurazione» sembra rotto senza dire niente a nessuno.
       *
       * Un messaggio invece le origini le attraversa. Si accetta solo da chi
       * ospita questo riquadro — non da un'altra pagina qualunque — e porta
       * un ordine solo: aprire o chiudere una pagina che in questa plancia
       * c'e' gia'. */
      'window.addEventListener("message",function(evento){'
      'var detto=evento.data;'
      'if(!detto||typeof detto!=="object")return;'
      'if(evento.source!==window.parent)return;'
      'if(detto.gdahome==="apri-la-config")apri(0);'
      'else if(detto.gdahome==="torna-dalla-config")torna(0);'
      '});'
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

  /// La tenda sulla barra si alza comunque, anche in un riquadro che non si
  /// sta disegnando.
  ///
  /// La plancia copre la barra in fondo finche' non sa quali voci mostrare —
  /// senza la tenda «resta sempre la barra totale, per poi diventare come
  /// l'ho configurata: dura quattro o cinque secondi» — e la scopre mettendo
  /// un segno sul documento: `data-dm-barra="pronta"`, che il suo foglio di
  /// stile aspetta (`bridge-prelude.js`, `navigation-section.js`).
  ///
  /// Quel segno lo mette dentro un `requestAnimationFrame`: aspetta la fine di
  /// un fotogramma per leggere le larghezze delle voci e capire se la barra ha
  /// finito di prendere forma. E' la cosa giusta in una pagina che si disegna.
  ///
  /// **In un riquadro che non si disegna quel fotogramma non arriva mai.** E
  /// succede tutte le volte che la pagina della plancia si carica mentre si
  /// sta guardando un'altra sezione dell'app: si salva nella Config, si cambia
  /// «Plancia leggera», la casa arriva dopo che la pagina si era aperta — ogni
  /// volta e' una pagina nuova in un riquadro che in quel momento nessuno
  /// guarda. Nemmeno la scadenza di riserva della plancia rimedia: chiama la
  /// stessa funzione, che trova un fotogramma gia' in coda e torna indietro
  /// senza fare niente. Il segno non arriva, la barra resta a opacita' zero, e
  /// una plancia senza la sua barra e' una plancia da cui non si esce.
  ///
  /// Qui si mette **solo quel segno**, e solo se dopo cinque secondi non c'e'
  /// ancora. La plancia da sola ce ne mette al massimo quattro — 2500
  /// millisecondi di attesa piu' 1500 se la forma cambia sotto le mani —
  /// quindi in una pagina che si disegna questo non vince mai, e non toglie
  /// niente alla tenda. In una che non si disegna e' l'unica cosa che si
  /// muove: un `setTimeout` e nient'altro, perche' i timer girano anche dove i
  /// fotogrammi non arrivano.
  ///
  /// Non si tocca `navigation-section.js`, che e' un file della dashboard: i
  /// file restano quelli pubblicati, e il ponte li ricontrolla uno per uno.
  static const String laTendaSiAlzaComunque =
      '<script>(function(){'
      'var alza=function(){'
      'try{'
      'var radice=document.documentElement;'
      /* C'e' gia': l'ha messo la plancia, e va lasciato come sta. */
      'if(!radice||radice.getAttribute("data-dm-barra"))return;'
      'radice.setAttribute("data-dm-barra","pronta");'
      '}catch(male){}'
      '};'
      'setTimeout(alza,5000);'
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
    final inFondo =
        '$stileDelleMisure$laConfigFuoriDallaPlancia$laTendaSiAlzaComunque';
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
