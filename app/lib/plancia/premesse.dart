/// Quello che si aggiunge alla pagina della plancia prima di servirla.
///
/// La plancia di DashboardModern e' una pagina web che gira dentro il pannello
/// di Home Assistant. Per farla girare altrove — dentro l'app, o dentro un
/// browser — le si dice le stesse cose che le dice il pannello: che e'
/// **ospitata** (e quindi non chiede segni e usa il WebSocket che trova),
/// quale istanza e quale profilo e', in che lingua. Piu' tre cose nostre: il
/// tema e la barra di questo dispositivo, le misure delle barre del telefono,
/// e la Config tolta.
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
    this.tema = 'auto',
    this.barra = 'scomparsa',
    this.tavolozza = '',
    this.margini = (alto: 0.0, basso: 0.0),
  });

  /// Quale pannello della plancia si sta aprendo: istanza, profilo, primario.
  PannelloDellaPlancia? pannello;

  String lingua;

  /// La plancia leggera: niente animazioni ripetute, niente vetro sfocato.
  bool leggera;

  /// `auto`, `chiaro`, `scuro`.
  String tema;

  /// `scomparsa` o `fissa`.
  String barra;

  /// La tavolozza (`cd_tavolozza`): `notte`, `grafite`, `bosco`, `sabbia`,
  /// `menta`, `ardesia`, o vuoto. Nella plancia sceglierne una scrive anche
  /// `cd_theme` con la sua famiglia — scura le prime tre, chiara le altre —
  /// e toglierla cancella la chiave. Qui si fa lo stesso.
  String tavolozza;

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
      'html body .app{padding-top:calc(var(--gdahome-alto) + 8px)!important;'
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

  /// Toglie dalla plancia la sua Config, e dice dov'e' andata.
  ///
  /// Si toglie in due modi insieme, e servono tutti e due: lo stile fa sparire
  /// la voce dalla barra e la sua pagina, e il pezzo di programma chiude
  /// l'editor se qualcosa riesce ad aprirlo lo stesso — la plancia ha piu' di
  /// una strada per arrivarci.
  static const String senzaConfig =
      '<style id="gdahome-senza-config">'
      '#tab-config,#page-config,.tab[data-tab="config"]{display:none!important}'
      '#editor-modal,#cd-entpick{display:none!important}'
      '</style>'
      '<script>(function(){'
      'var chiudi=function(){'
      'var quali=["editor-modal","cd-entpick"];'
      'for(var i=0;i<quali.length;i++){'
      'var uno=document.getElementById(quali[i]);if(uno)uno.remove();}'
      '};'
      'if(window.MutationObserver){'
      'new MutationObserver(chiudi).observe(document.documentElement,'
      '{childList:true,subtree:true});}'
      'document.addEventListener("DOMContentLoaded",chiudi);'
      'chiudi();'
      '})();</script>';

  /// Il tema e la barra, scritti dove la plancia se li aspetta.
  ///
  /// La plancia li legge dal deposito locale della pagina, quindi glieli si
  /// scrive li' **prima** che parta: se no li legge vuoti e poi cambia colore
  /// sotto gli occhi.
  String get temaEBarra {
    final scura = const ['notte', 'grafite', 'bosco'].contains(tavolozza);
    final chiara = const ['sabbia', 'menta', 'ardesia'].contains(tavolozza);
    final quale = scura
        ? 'dark'
        : chiara
        ? 'light'
        : switch (tema) {
            'chiaro' => 'light',
            'scuro' => 'dark',
            _ => 'auto',
          };
    final come = barra == 'fissa' ? 'fixed' : 'auto';
    final laTavolozza = scura || chiara
        ? 'localStorage.setItem("cd_tavolozza",${jsonEncode(tavolozza)});'
        : 'localStorage.removeItem("cd_tavolozza");';
    return '<script>try{'
        'localStorage.setItem("cd_theme",${jsonEncode(quale)});'
        '$laTavolozza'
        'localStorage.setItem("cd_navbar_mode",${jsonEncode(come)});'
        '}catch(e){}</script>';
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
        '</script>'
        '$temaEBarra'
        '${leggera ? stileLeggero : ''}';
    final testa = RegExp(
      r'<head[^>]*>',
      caseSensitive: false,
    ).firstMatch(pagina);
    final conLaPremessa = testa == null
        ? '$premessa$pagina'
        : pagina.replaceRange(testa.end, testa.end, premessa);

    /* Le misure e la Config tolta vanno in fondo: vedi [stileDelleMisure],
     * che spiega perche' in testa perdevano contro lo stile della plancia. */
    final inFondo = '$stileDelleMisure$senzaConfig';
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
