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

/// Come la pagina chiede il menu dell'app, sul telefono.
///
/// Sul telefono la pagina e l'app si parlano su un canale solo, e su quel
/// canale passano anche i nomi delle pagine della plancia (`home`, `clima`,
/// `config`). Questa parola non puo' essere una di quelle: i due punti in
/// mezzo non stanno in nessun nome di linguetta, ne' ci finiranno.
const String ilMenuDalTelefono = 'gdahome:menu';

/// Come lo chiede nel browser, dove il riquadro parla a chi lo ospita con un
/// messaggio fatto a oggetto: `{gdahome: "menu"}`.
const String ilMenuDalRiquadro = 'menu';

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
  /// Le barre del telefono, dette alla pagina.
  ///
  /// Il riquadro arriva ai bordi dello schermo — la plancia si vede tutta — e
  /// allora sopra c'e' l'orologio del telefono e sotto la sua barra dei tasti.
  /// Quanto tengono lo sa Flutter, che lo chiede al sistema su
  /// **quell'apparecchio**: due numeri, e sono gli unici numeri qui dentro.
  ///
  /// In cima si scrive un margine: la testata della plancia comincia dal bordo
  /// e sotto l'orologio ci finirebbe.
  ///
  /// In fondo **non si scrive niente**, e qui prima si sbagliava. La plancia il
  /// problema ce l'ha gia' risolto, e per apparecchio: in
  /// `navigation-section.js` tiene una variabile — `--dm-fondo-di-sistema` — e
  /// da quella deriva tutti i suoi numeri, la barra a `18 + fondo`, la riserva
  /// sotto l'ultima riga a `112 + fondo`, la maniglia a `6 + fondo`, e lo
  /// `scroll-padding-bottom`, che e' quello che fa fermare sopra la barra
  /// anche chi arriva con un salto. Lo scrive nel suo commento: «non alzare la
  /// barra di un tanto fisso — su un telefono a gesti o su un tablet
  /// resterebbe sospesa per niente — ma alzarla di quello che il sistema si e'
  /// preso». Il valore lo chiede a `env(safe-area-inset-bottom)`, che dentro
  /// una cornice risponde zero comunque, e per questo la regola c'era e non si
  /// accendeva.
  ///
  /// Qui invece quel numero si sa. Allora si scrive **il suo**, e il resto lo
  /// fa lei: [leMisureNellaSuaVariabile].
  ///
  /// Prima al suo posto c'era un foglio nostro che ricopiava i suoi numeri —
  /// 112 di riserva, 40 di riserva normale, la barra staccata di 8 — e li
  /// ricopiava male: la barra la mettevamo dieci punti piu' in basso di dove
  /// la mette lei, dentro una riserva che restava quella sua. Quei dieci punti
  /// diventavano una striscia di niente sotto l'ultima riga, in fondo a ogni
  /// pagina, e lo `scroll-padding-bottom` restava indietro comunque. E il
  /// giorno che lei cambia uno di quei numeri, un foglio che li ricopia resta
  /// indietro senza che nessuno se ne accorga.
  ///
  /// Sta in **fondo** alla pagina, non in testa: gli stili della plancia
  /// arrivano dopo i suoi `<link>`, e in testa questo perdeva contro i suoi.
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
      'html body{padding-top:var(--gdahome-alto)!important}'
      '</style>';

  /// La barra del telefono, scritta dove la plancia la va a cercare.
  ///
  /// `--dm-fondo-di-sistema` e' la sua variabile, e la scrive lei sul
  /// documento — `style.setProperty`, quindi in linea, e una regola di un
  /// foglio non la batte. Si scrive nello stesso posto, e solo quando il
  /// numero di Flutter e' **piu' grande** del suo: mai al ribasso. Dove lei ci
  /// arriva da se' — la plancia che e' la pagina, in un browser che le
  /// risponde davvero — il suo numero e' quello buono e non si tocca; e' la
  /// stessa aritmetica che fa lei, che prende il massimo fra quello che vede e
  /// quello che le dice chi la ospita (`core/fondo-di-sistema.js`).
  ///
  /// Si riscrive a ogni occasione in cui lei rifa' il conto — si gira lo
  /// schermo, si apre la tastiera — e quando riscrive quella riga: la si
  /// guarda con un osservatore, che costa niente perche' scatta solo quando
  /// qualcuno tocca lo stile del documento. Senza, bastava un giro del suo
  /// conto per rimettere zero e la barra tornava sotto i tasti.
  String get leMisureNellaSuaVariabile =>
      '<script>(function(){'
      'var NOME="--dm-fondo-di-sistema";'
      'var mio=${margini.basso.round()};'
      'var radice=document.documentElement;'
      'var suo=function(){'
      'try{return parseFloat('
      'getComputedStyle(radice).getPropertyValue(NOME))||0;}'
      'catch(male){return 0;}'
      '};'
      'var scrivi=function(){'
      'if(!radice||!(mio>0))return;'
      'try{if(suo()>=mio)return;'
      'radice.style.setProperty(NOME,mio+"px");}catch(male){}'
      '};'
      'scrivi();'
      'if(document.body)scrivi();'
      'else document.addEventListener("DOMContentLoaded",scrivi);'
      'window.addEventListener("load",scrivi);'
      'window.addEventListener("resize",scrivi);'
      'window.addEventListener("orientationchange",scrivi);'
      'window.addEventListener("dashboardmodern:persistence-restored",scrivi);'
      /* E quando e' lei a riscrivere quella riga. L'osservatore guarda solo
         l'attributo dello stile del documento: scatta quando qualcuno lo
         cambia, e non c'e' nessun giro a vuoto. */
      'try{new MutationObserver(scrivi).observe(radice,'
      '{attributes:true,attributeFilter:["style"]});}catch(male){}'
      '})();</script>';

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
  /// no: la porta e' la voce del menu. La linguetta e l'ingranaggio restano
  /// nascosti, e con loro il tasto «← HOME» che la pagina si disegna in
  /// cima: dal menu si torna col menu. Il tasto ☰ no: quello si vede, ma il
  /// suo menu non si apre piu' — lo apre l'app, il suo (vedi
  /// [iTreTrattiniApronoIlMenuDellApp]).
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
      /* L'altra porta della Config dentro la plancia: l'ingranaggio in cima.
         Nella dashboard ci vuole — li' la Config e' una pagina come le altre
         — nell'app no: la porta e' la voce del menu, e due porte sulla stessa
         stanza sono una di troppo.
         Il tasto ☰ accanto, invece, resta a schermo: nell'app e' la porta
         del menu dell'app (vedi [iTreTrattiniApronoIlMenuDellApp]). Il suo
         menu — quello della plancia, col «Reset totale» che cancella tutta
         la configurazione — non si apre piu': l'evento si ferma prima. */
      'html body header .dm-editor-entry{display:none!important}'
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
      /* Le finestre della plancia sono `.modal-wrapper` con la classe
         `show`. Qui si cercava `.modal.show`, e una classe che si chiama
         `modal` in quella pagina non esiste: non si chiudeva **niente**.
         `#editor-modal.show` prendeva l'Editor e nient'altro. */
      'var aperte=document.querySelectorAll('
      '".modal-wrapper.show,.modal.show,.dm-modal.show,dialog[open]");'
      'for(var quale=0;quale<aperte.length;quale+=1){'
      'var finestra=aperte[quale];'
      /* Le due che la pagina **crea** quando servono — l'Editor e «Modifica
         plancia» — la pagina le butta via: il loro tasto ✕ fa `remove()`, e
         si fa quello. */
      'if(finestra.id==="editor-modal"||finestra.id==="edit-plancia-modal"){'
      'try{finestra.remove();}catch(male){}'
      'continue;'
      '}'
      /* Le altre stanno nella pagina da sempre e si spengono. Se la pagina ha
         il suo modo di spegnerle si usa quello: `forceClose` stacca anche la
         telecamera aperta e il suo flusso, e chiuderla a mano lascerebbe un
         video che scarica per sempre dentro una finestra che non si vede. */
      'if(finestra.id&&typeof window.forceClose==="function")'
      'try{window.forceClose(finestra.id);}catch(male){}'
      'var chiudi=finestra.querySelector('
      '"[data-dm-close],.modal-close,.dm-modal-close,.close-btn");'
      'if(chiudi){try{chiudi.click();}catch(male){}}'
      'if(!finestra.isConnected)continue;'
      'finestra.classList.remove("show");'
      /* E lo stile scritto **nell'elemento**, che vince su qualunque classe.
         Era tutto il guasto, e si vedeva cosi': uscito dall'Editor dal menu,
         la plancia restava offuscata e non si poteva toccare niente.
         `.modal-wrapper` e' fissa, a tutto schermo, con un vetro sfocato e un
         velo scuro, e si accende con la classe; ma quelle due finestre
         nascono con `opacity:1;visibility:visible;pointer-events:auto`
         scritti nello stile proprio. Togliere la classe faceva sparire la
         scheda — quella si', perche' la sua regola dipende da `.show` — e
         lasciava su il velo, che si prendeva tutti i tocchi. Mezzo minuto di
         app inservibile, e l'unica uscita era chiuderla. */
      'try{'
      'finestra.style.opacity="";'
      'finestra.style.visibility="";'
      'finestra.style.pointerEvents="";'
      '}catch(male){}'
      'if(finestra.tagName==="DIALOG"&&finestra.open)'
      'try{finestra.close();}catch(male){}'
      '}'
      '}catch(male){}'
      '};'
      'var torna=function(prove){'
      /* L'ordine nell'indirizzo se ne va **subito**, non solo quando si e'
         usciti: finche' resta scritto, ogni ricarica della pagina riapre la
         Configurazione — e toccare «Plancia» quando l'app crede di esserci
         gia' ricarica. Da fuori si vedeva un tasto che riportava dove si era
         appena chiesto di non stare piu'. */
      'scordaLIndirizzo();'
      'if(!ciSiamo()){setTimeout(guarda,0);return;}'
      'chiudiQuelloChEAperto();'
      'try{document.body.classList.remove("gdahome-in-config");}catch(male){}'
      'var voce=laVoce(dove)||laVoce("home");'
      'if(voce)try{voce.click();}catch(male){}'
      'if(!ciSiamo()){setTimeout(guarda,0);return;}'
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

  /// I tre trattini della plancia aprono il menu dell'app.
  ///
  /// La plancia ha il suo tasto ☰ in alto a sinistra, e dentro Home Assistant
  /// apre la barra laterale di HA — quella di chi la ospita, non una sua. Da
  /// noi chi la ospita e' l'app, e la barra laterale dell'app c'era ma si
  /// chiamava da un'altra parte: una fascia invisibile sul bordo sinistro
  /// dello schermo. Quella fascia stava sopra la plancia, e sulla
  /// Configurazione la plancia sul bordo sinistro ha le sue sezioni: si
  /// toccava una sezione e si apriva il menu. Il tasto c'era, stava dove
  /// tutti cercano un menu, e nell'app non faceva niente.
  ///
  /// Adesso lo fa, e la fascia non c'e' piu': niente di nostro sta piu' sopra
  /// la plancia.
  ///
  /// Il tasto porta un `onclick` scritto nella pagina, e un ascolto **in
  /// cattura** sul documento e' l'unico posto che arriva prima di lui — lo
  /// dice anche la plancia, che per il suo kiosk fa esattamente la stessa
  /// cosa (`beta12-room-color-lock-section.js`). Fermando li' l'evento quel
  /// comando non parte mai: ne' il menu della plancia ne' il suo «Reset
  /// totale», che cancella tutta la configurazione con un tocco solo.
  ///
  /// Tenuto premuto e' un altro gesto, e non e' nostro: la plancia dopo
  /// [_tenutoPremuto] accende il suo kiosk. Quel tocco si ferma comunque —
  /// il menu della plancia non deve aprirsi nemmeno li' — ma il menu
  /// dell'app non si chiama: chi tiene premuto non ha chiesto il menu.
  ///
  /// **E sulla Configurazione un tasto nostro.** Li' la testata della plancia
  /// non c'e': in cima sta il riquadro col logo e «CONFIGURAZIONE», senza
  /// nessun ☰. Con la barra in fondo nascosta e il «← HOME» tolto (vedi
  /// [laConfigFuoriDallaPlancia]) chi apriva la Config dal menu non aveva
  /// piu' un tasto per riaprirlo: si restava li'. Adesso nel riquadro, a
  /// sinistra del logo, c'e' lo stesso ☰ della home, e fa la stessa cosa.
  /// Il riquadro sta scritto nella pagina, non lo disegna il runtime: il
  /// tasto si mette una volta, appena la pagina c'e'.
  static const String iTreTrattiniApronoIlMenuDellApp =
      '<style id="gdahome-menu-in-config">'
      '#page-config .gdahome-menu{flex:0 0 auto;width:42px;height:42px;'
      'border-radius:50%;border:1px solid var(--card-border,#e2e8f0);'
      'background:var(--card-bg,#fff);display:flex;flex-direction:column;'
      'align-items:center;justify-content:center;gap:5px;padding:0;margin:0;'
      'cursor:pointer;box-shadow:0 4px 12px rgba(15,23,42,.08)}'
      '#page-config .gdahome-menu span{display:block;width:18px;height:2px;'
      'border-radius:2px;background:var(--text,#0f172a)}'
      /* Sui telefoni stretti il riquadro si stringe un po', se no col tasto
         in piu' «CONFIGURAZIONE» non ci sta piu' su una riga. */
      '@media (max-width:430px){#page-config .cfg-hero{gap:12px;padding:18px 16px}'
      '#page-config .cfg-hero-title{font-size:20px}}'
      '</style>'
      '<script>(function(){'
      /* Le due strade per dirlo all'app sono le stesse della pagina che
         cambia: sul telefono un canale del WebView, nel browser il riquadro
         che parla a chi lo ospita. Chi non c'e' non risponde. */
      'var ilMenu=function(){'
      'try{if(window.gdahomeDice&&window.gdahomeDice.postMessage)'
      'window.gdahomeDice.postMessage("$ilMenuDalTelefono");}catch(male){}'
      'try{if(window.parent&&window.parent!==window)'
      'window.parent.postMessage({gdahome:"$ilMenuDalRiquadro"},"*");}'
      'catch(male){}'
      '};'
      'var ilTasto=function(evento){'
      'var chi=evento?evento.target:null;'
      'return !!(chi&&chi.closest&&chi.closest(".ha-menu-btn"));'
      '};'
      /* Da quando si tiene premuto. Si rimette a zero a ogni tocco che non
         e' sul tasto: un invio dalla tastiera non ha nessun tocco prima, e
         con un numero vecchio qui sembrerebbe una pressione lunga. */
      'var premutoIl=0;'
      'document.addEventListener("pointerdown",function(evento){'
      'premutoIl=ilTasto(evento)?Date.now():0;'
      '},true);'
      'document.addEventListener("click",function(evento){'
      'if(!ilTasto(evento))return;'
      'evento.preventDefault();'
      'evento.stopPropagation();'
      'if(premutoIl&&Date.now()-premutoIl>=$_tenutoPremuto){premutoIl=0;return;}'
      'ilMenu();'
      '},true);'
      /* Il tasto nel riquadro in cima alla Configurazione: uno solo, a
         sinistra del logo, e chiama il menu dell'app come quello della home. */
      'var ilTastoInConfig=function(){'
      'var testata=document.querySelector("#page-config .cfg-hero");'
      'if(!testata||testata.querySelector(".gdahome-menu"))return;'
      'var tasto=document.createElement("button");'
      'tasto.type="button";'
      'tasto.className="gdahome-menu";'
      'tasto.setAttribute("aria-label","Apri il menu");'
      'tasto.innerHTML="<span></span><span></span><span></span>";'
      'tasto.addEventListener("click",function(evento){'
      'evento.preventDefault();evento.stopPropagation();ilMenu();'
      '});'
      'testata.insertBefore(tasto,testata.firstChild);'
      '};'
      'if(document.readyState==="loading")'
      'document.addEventListener("DOMContentLoaded",ilTastoInConfig);'
      'else ilTastoInConfig();'
      '})();</script>';

  /// Quanto vuol dire «tenuto premuto»: e' il tempo della plancia, non uno
  /// nostro — dopo tanto lei accende il suo kiosk (`LONG_PRESS_MS`), e il
  /// tocco che arriva dopo non e' una chiamata al menu.
  static const int _tenutoPremuto = 650;

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

  /// L'avviso «non hai ancora collegato le tue entita'» non parla prima che la
  /// configurazione sia arrivata.
  ///
  /// La plancia, mezzo secondo dopo che la pagina e' pronta, guarda quattro
  /// cose — la mappa delle entita', le stanze, le unita' clima, le luci — e se
  /// sono tutte vuote scrive in cima alla Home «non hai ancora collegato le
  /// tue entita', quindi le card sono nascoste» (`cdEmptyStateCheck`, in
  /// `dashboard-runtime-it.js`). Quella domanda se la fa **una volta sola**, e
  /// l'avviso poi non se ne va piu' da solo.
  ///
  /// Dentro Home Assistant quella regola e' giusta: la configurazione sta
  /// nella pagina e mezzo secondo dopo c'e'. Qui no: la configurazione la
  /// tiene il ponte e arriva **sul filo**, dopo che la pagina si e' caricata.
  /// In casa arriva in fretta e non si vede niente; su un filo lento — il
  /// centralino, una casa che risponde piano — la domanda parte prima della
  /// risposta, e si vede l'avviso sopra una Home piena di tessere con i dati
  /// dentro. Cioe' la plancia dice «configurala» a chi l'ha configurata.
  ///
  /// Allora il posto di quell'avviso lo si tiene occupato: un elemento col
  /// suo nome, nascosto, e la loro domanda — che si ferma se quel nome c'e'
  /// gia' — non fa niente. Quando la configurazione arriva (la plancia lo
  /// dice: `dashboardmodern:persistence-restored`) si rifa' **la loro**
  /// domanda, con le loro quattro risposte: se c'e' qualcosa l'avviso non
  /// compare; se e' davvero vuota si toglie il posto e si chiama la loro
  /// funzione, che lo scrive. Vuoto vuol dire vuoto, e allora l'avviso e'
  /// giusto.
  ///
  /// Se la configurazione non arriva mai, il posto resta occupato e l'avviso
  /// non compare: a filo caduto la plancia lo dice gia' col suo pallino, e
  /// «non hai collegato le entita'» sarebbe una bugia.
  ///
  /// **E per dodici secondi quella promessa era falsa.** Il posto si liberava
  /// allo scadere di un orologio, e allo scadere si chiamava la loro funzione:
  /// cioe' esattamente quello che la riga sopra dice di non fare. Sul telefono
  /// in casa non si vedeva. Nel browser, da fuori, no: li' i file della plancia
  /// arrivano **anche loro** sul filo, un pezzo per volta, attraverso il
  /// service worker — dodici secondi finiscono prima che la pagina sia in
  /// piedi, e la plancia diceva «non hai collegato le tue entita'» a una casa
  /// con diciassette sezioni dentro. E poi non se ne andava piu': `finito`
  /// restava alzato anche quando la configurazione arrivava.
  ///
  /// L'orologio non serviva a misurare il filo: serviva a distinguere «non e'
  /// ancora arrivata» da «non c'e' niente da aspettare». E quella domanda ha
  /// una risposta esatta, che ce l'ha in mano il ponte — la configurazione la
  /// tiene lui. Adesso la dice ([PannelloDellaPlancia.configurata]) e qui si
  /// scrive nella pagina come `__GDAHOME_CONFIGURATA__`:
  ///
  ///  - `false` — questa casa non ha configurazione: il posto non si occupa
  ///    nemmeno, e l'avviso compare subito invece che dopo dodici secondi.
  ///  - `true` — ce l'ha: l'orologio non decide piu' niente. Si aspetta, e si
  ///    cede solo a configurazione arrivata **e** vuota, che e' l'unico caso
  ///    in cui l'avviso dice la verita'.
  ///  - assente — un ponte di ieri: resta l'orologio di prima, cosi' non
  ///    peggiora niente.
  static const String lAvvisoAspettaLaConfigurazione =
      '<script>(function(){'
      'var NOME="cd-empty-banner";'
      'var NOSTRO="data-gdahome-posto";'
      'var OGNI=250;'
      'var FINO_A=12000;'
      'var GUARDO_FINO_A=30000;'
      'var detto=window.__GDAHOME_CONFIGURATA__;'
      'var configurata=detto===true;'
      'var vuota=detto===false;'
      'var pieno=function(){'
      'try{if(typeof ENTITY_OVERRIDES!=="undefined"&&Object.keys(ENTITY_OVERRIDES||{}).length)return true;}catch(male){}'
      'try{if(typeof cdCfgList==="function"){'
      'if((cdCfgList("cd_stanze")||[]).length)return true;'
      'if((cdCfgList("cd_clima_units")||[]).length)return true;}'
      'if(typeof cdCfg==="function"&&Object.keys(cdCfg("cd_luci")||{}).length)return true;}catch(male){}'
      'return false;'
      '};'
      'var quello=function(){return document.getElementById(NOME);};'
      'var ilPosto=function(){var chi=quello();return chi&&chi.hasAttribute(NOSTRO)?chi:null;};'
      'var togli=function(chi){if(chi&&chi.parentNode)chi.parentNode.removeChild(chi);};'
      'var occupa=function(){'
      'if(quello())return;'
      'try{'
      'var posto=document.createElement("div");'
      'posto.id=NOME;'
      'posto.setAttribute(NOSTRO,"1");'
      'posto.style.display="none";'
      'document.body.appendChild(posto);'
      '}catch(male){}'
      '};'
      'var finito=false;'
      'var battito=0;'
      'var basta=function(){if(battito){clearInterval(battito);battito=0;}};'
      'var guarda=function(scaduto){'
      'if(finito)return;'
      'if(pieno()){finito=true;basta();togli(quello());return;}'
      'if(configurata||!scaduto)return;'
      'finito=true;basta();'
      'togli(ilPosto());'
      'try{if(typeof cdEmptyStateCheck==="function")cdEmptyStateCheck();}catch(male){}'
      '};'
      'var parti=function(){'
      'if(vuota)return;'
      'occupa();'
      'var fine=Date.now()+FINO_A;'
      'var smetto=Date.now()+GUARDO_FINO_A;'
      'battito=setInterval(function(){'
      'guarda(Date.now()>=fine);'
      'if(!finito&&Date.now()>=smetto)basta();'
      '},OGNI);'
      'window.addEventListener("dashboardmodern:persistence-restored",function(){'
      'setTimeout(function(){guarda(true);},0);'
      '});'
      '};'
      'if(document.body)parti();'
      'else document.addEventListener("DOMContentLoaded",parti);'
      '})();</script>';

  /* Il tema, la tavolozza e la barra qui non si scrivono, e non e' una
   * dimenticanza. Sono tre comandi della pagina Config della plancia — «su
   * questo dispositivo», lo dice lei — e la pagina se li tiene nel deposito
   * locale, che e' suo e dura. Scriverglieli da fuori a ogni caricamento
   * voleva dire cancellare la scelta di chi l'aveva fatta dalle sue tessere.
   * Vedi `laConfigFuoriDallaPlancia`. */

  /// Le due globali delle vesti, o niente.
  ///
  /// Via `<` e `>`: finiscono dentro uno `<script>`, e un `</script>` dentro
  /// una stringa chiuderebbe lo script. Il ponte le ripulisce gia'; fra lui e
  /// qui c'e' un filo, e un controllo da una parte sola non e' un controllo.
  static String leVesti(PannelloDellaPlancia? quale) {
    if (quale == null) return '';
    String pulito(String cosa) => cosa.replaceAll(RegExp('[<>]'), '');
    final velo = pulito(quale.velo);
    final testata = pulito(quale.testata);
    return '${velo.isEmpty ? '' : 'window.__GDAHOME_VELO__=${jsonEncode(velo)};'}'
        '${testata.isEmpty ? '' : 'window.__GDAHOME_TESTATA__=${jsonEncode(inDuePezzi(testata))};'}';
  }

  /// La scritta della testata in due pezzi, come la disegna la plancia: il
  /// primo in chiaro e il secondo in azzurro. Un nome di due o piu' parole si
  /// spezza al primo spazio; uno di una parola sola va tutto nel primo, e il
  /// secondo resta vuoto. La stessa regola di `inDuePezzi` in `marchio.js`.
  static List<String> inDuePezzi(String nome) {
    final pulito = nome.replaceAll(RegExp(r'\s+'), ' ').trim();
    final spazio = pulito.indexOf(' ');
    if (spazio <= 0) return [pulito, ''];
    return [pulito.substring(0, spazio), pulito.substring(spazio + 1)];
  }

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
        /* Le vesti di questa plancia, se chi ha montato l'impianto le ha
           scelte: la parola del velo e la scritta della testata, in due
           pezzi. La pagina le legge al momento di disegnare — il velo con lo
           script che il ponte gli attacca, la testata dentro il runtime — e
           senza non si scrive niente. E' la stessa riga che scrive il ponte
           quando serve lui la pagina (`premesse.js`, `leVesti`). */
        '${leVesti(quale)}'
        /* Se questa plancia ha una configurazione. Assente vuol dire «non lo
           so», e chi legge la pagina tiene l'orologio di prima. */
        '${switch (quale?.configurata) {
          true => 'window.__GDAHOME_CONFIGURATA__=true;',
          false => 'window.__GDAHOME_CONFIGURATA__=false;',
          null => '',
        }}'
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
        '$stileDelleMisure$leMisureNellaSuaVariabile$laConfigFuoriDallaPlancia'
        '$iTreTrattiniApronoIlMenuDellApp$laTendaSiAlzaComunque'
        '$lAvvisoAspettaLaConfigurazione';
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
