/// Lo schermo del tablet a muro: tutto per il pannello, e spento di notte.
///
/// «Nel 10" con GDA diretta lo spegni schermo toglie l'orologio, ma lascia
/// acceso l'Android con le icone sotto e la barra sopra col segnale e
/// l'orologio.» La plancia disegna il nero, ma le barre del sistema e la
/// luminosita' non sono sue: le comanda l'app. La plancia le chiede sul canale
/// `gdahomeSchermo` (`plancia-a-muro-section.js`) e qui si fanno:
///
/// - `muro:si` / `muro:no`: col pannello a muro acceso le barre di Android
///   spariscono (tornano col gesto dal bordo, e da sole poco dopo); spento il
///   pannello, l'app torna com'era.
/// - `chiosco:si` / `chiosco:no`: il modo chiosco della plancia. «Il flag e'
///   abilitato, rimangono le icone in alto e in basso dell'Android»: il chiosco
///   copriva solo Home Assistant, le barre del sistema non le chiedeva a
///   nessuno. Adesso le nasconde come il pannello a muro.
/// - `spento:si` / `spento:no`: di notte la luminosita' della finestra va al
///   minimo; al risveglio torna quella del sistema.
/// - `acceso:si` / `acceso:no`: col campanello a muro lo schermo non si
///   spegne da solo (di notte resta al minimo). Vale solo col pannello
///   acceso: spento il pannello, lo spegnimento torna del sistema.
/// - `sveglia`: suona il campanello. La luce torna piena e, su Android, uno
///   schermo spento si riaccende sopra il blocco — solo col pannello acceso.
/// - `luce:<0-100>` / `luce:no` (#224): la luminosita' che il pannello ha
///   deciso — piena con qualcuno vicino, bassa a riposo, quasi niente di
///   notte. Sale in fretta e scende piano; `no` la rende al sistema. Su
///   Android e' la luminosita' della sola finestra (niente permessi), sul
///   tablet di Apple quella dello schermo, rimessa com'era all'uscita.
/// - `sensori:luce+prossimita` / `sensori:no`: quali sensori del tablet il
///   pannello vuole sentire. Si accendono solo col pannello acceso e solo su
///   Android; alla pagina arriva «c'e' / non c'e'» per la prossimita' e
///   «buio / penombra / chiaro» per la luce, mai i numeri del sensore.
/// - `capacita?`: la Config chiede cosa ha il tablet, per dire nelle sue
///   righe se il sensore di luce e quello di prossimita' ci sono.
///
/// Android rimette le barre da solo — tornando nell'app, dopo un dialogo del
/// sistema, aprendo e chiudendo un pieghevole — e [loSchermoRimetti] le
/// ritoglie: si richiama a ogni ritorno e a ogni cambio di misura.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'la_finestra.dart' show canaleDellaFinestra;

/// Il nome del canale che la plancia cerca.
const canaleDelloSchermo = 'gdahomeSchermo';

/// Come si risponde alla pagina che ha parlato: un pezzo di JSON che arriva
/// a `window.__GDAHOME_SCHERMO__` e all'evento `gdahome:schermo`.
typedef DiciAllaPagina = Future<void> Function(Map<String, Object?> detto);

bool _aMuro = false;
bool _chiosco = false;
bool _spento = false;
bool _accesoChiesto = false;
bool _accesoDetto = false;

/* La luminosita' del pannello (#224): quella voluta, quella mandata per
 * ultima alla finestra, e il giro della dissolvenza in corso — una nuova
 * richiesta ferma quella di prima. */
double? _luceVoluta;
double? _luceAdesso;
int _giroDellaLuce = 0;

/* I sensori: quelli che il pannello vuole, quelli accesi davvero, e l'ultima
 * parola detta alla pagina per ognuno. */
Set<String> _sensoriVoluti = const {};
bool _sensoriAccesi = false;
String? _luceDellaStanza;
DiciAllaPagina? _allaPagina;

/// Quello che la plancia ha detto. Non solleva mai: un telefono che non sa
/// farlo resta com'era.
///
/// [allaPagina] e' la strada per rispondere alla pagina che ha parlato: la
/// usano `capacita?` e i sensori.
Future<void> loSchermoDice(String detto, {DiciAllaPagina? allaPagina}) async {
  if (allaPagina != null) _allaPagina = allaPagina;
  if (detto.startsWith('luce:')) {
    await _laLuce(detto.substring(5));
    return;
  }
  if (detto.startsWith('sensori:')) {
    final voluti = detto.substring(8);
    _sensoriVoluti = voluti == 'no'
        ? const {}
        : voluti.split('+').where(_sensoriConosciuti.contains).toSet();
    await _accordaISensori();
    return;
  }
  switch (detto) {
    case 'muro:si':
    case 'muro:no':
      final prima = barreNascoste;
      _aMuro = detto == 'muro:si';
      if (barreNascoste != prima) await _applica();
      if (!_aMuro && _spento) await _luminosita(false);
      if (!_aMuro) await _laLuce('no');
      await _accordaISensori();
      await _tieniAcceso();
    case 'acceso:si':
    case 'acceso:no':
      _accesoChiesto = detto == 'acceso:si';
      await _tieniAcceso();
    case 'sveglia':
      await _sveglia();
    case 'chiosco:si':
    case 'chiosco:no':
      final prima = barreNascoste;
      _chiosco = detto == 'chiosco:si';
      if (barreNascoste != prima) await _applica();
    case 'spento:si':
    case 'spento:no':
      await _luminosita(detto == 'spento:si');
    case 'capacita?':
      await _diciLeCapacita();
  }
}

/// Se adesso le barre del sistema devono stare nascoste.
bool get barreNascoste => _aMuro || _chiosco;

/// Rinasconde le barre, se devono stare nascoste: dopo un ritorno nell'app o
/// un cambio di misura Android puo' averle rimesse. Con le barre normali non
/// fa niente — non tocca il modo che un'altra schermata (il navigatore, un
/// video a tutto schermo) si e' scelto.
Future<void> loSchermoRimetti() async {
  if (barreNascoste) await _applica();
}

Future<void> _applica() async {
  try {
    await SystemChrome.setEnabledSystemUIMode(
      barreNascoste ? SystemUiMode.immersiveSticky : SystemUiMode.edgeToEdge,
    );
  } catch (_) {}
}

Future<void> _luminosita(bool spento) async {
  if (spento == _spento) return;
  _spento = spento;
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
  try {
    /* -1 e' «quella del sistema»; 0 la piu' bassa che lo schermo fa. */
    await canaleDellaFinestra.invokeMethod<void>(
      'luminosita',
      spento ? 0.0 : -1.0,
    );
  } catch (_) {
    /* Un pacchetto di prima: resta il nero della plancia. */
  }
}

/// Se adesso lo schermo deve restare acceso: lo chiede il pannello, e solo
/// mentre il pannello c'e'.
bool get schermoTenutoAcceso => _aMuro && _accesoChiesto;

/* Lo schermo che non si spegne: su Android la finestra lo dichiara
 * (`FLAG_KEEP_SCREEN_ON`), sull'iPhone si ferma il timer del riposo. Si
 * chiede solo quando cambia. */
Future<void> _tieniAcceso() async {
  final voluto = schermoTenutoAcceso;
  if (voluto == _accesoDetto) return;
  _accesoDetto = voluto;
  if (!_androidOApple) return;
  try {
    await canaleDellaFinestra.invokeMethod<void>('acceso', voluto);
  } catch (_) {
    /* Un pacchetto di prima: lo schermo fa come gli dice il sistema. */
  }
}

/* Suona il campanello: la luce piena subito, e su Android lo schermo spento
 * si riaccende e passa sopra il blocco. Fuori dal pannello a muro no: un
 * telefono in tasca non si accende per un campanello. */
Future<void> _sveglia() async {
  if (!_aMuro) return;
  await _luminosita(false);
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
  try {
    await canaleDellaFinestra.invokeMethod<void>('sveglia');
  } catch (_) {
    /* Un pacchetto di prima: si sveglia la pagina, lo schermo no. */
  }
  /* La sveglia di Android rende la luce al sistema: con la luminosita' del
   * pannello accesa si rimette la sua, che il pannello alza da se'. */
  final voluta = _luceVoluta;
  if (voluta != null) await _mandaLaLuce(voluta);
}

bool get _androidOApple =>
    !kIsWeb &&
    (defaultTargetPlatform == TargetPlatform.android ||
        defaultTargetPlatform == TargetPlatform.iOS);

bool get _android => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

/* ── la luminosita' del pannello ─────────────────────────────────────────── */

/// Quanto dura la dissolvenza: in salita deve sembrare un interruttore — chi
/// si avvicina vuole vedere subito — in discesa uno che si addormenta.
const salitaDellaLuce = Duration(milliseconds: 400);
const discesaDellaLuce = Duration(milliseconds: 2000);

/// Un passo ogni quaranta millesimi: abbastanza fitto da non vedere gli
/// scalini, abbastanza rado da non intasare il canale.
@visibleForTesting
Duration passoDellaLuce = const Duration(milliseconds: 40);

/// La luminosita' che il pannello ha chiesto, da 0 a 1; `null` se lo schermo
/// e' del sistema.
double? get luceDelPannello => _luceVoluta;

/// I valori della dissolvenza da [da] ad [a], l'ultimo compreso.
List<double> passiDellaLuce(double da, double a, {Duration? passo}) {
  if (da == a) return [a];
  final durata = a > da ? salitaDellaLuce : discesaDellaLuce;
  final ogni = (passo ?? passoDellaLuce).inMilliseconds;
  final quanti = ogni <= 0
      ? 1
      : math.max(1, (durata.inMilliseconds / ogni).round());
  /* L'ultimo e' proprio [a]: la somma dei passi sbaglia all'ultima cifra. */
  return [
    for (var i = 1; i <= quanti; i++)
      i == quanti ? a : da + (a - da) * i / quanti,
  ];
}

Future<void> _laLuce(String detto) async {
  if (detto == 'no') {
    if (_luceVoluta == null && _luceAdesso == null) return;
    _luceVoluta = null;
    _luceAdesso = null;
    _giroDellaLuce++;
    await _mandaLaLuce(-1);
    return;
  }
  final percento = int.tryParse(detto);
  if (percento == null || !_aMuro) return;
  final voluta = percento.clamp(0, 100) / 100;
  if (voluta == _luceVoluta) return;
  _luceVoluta = voluta;
  final giro = ++_giroDellaLuce;
  /* Dalla luce del sistema non si sa da dove partire: la prima volta si va
   * dritti al valore, le altre si scivola. */
  final da = _luceAdesso;
  final passi = da == null ? [voluta] : passiDellaLuce(da, voluta);
  for (var i = 0; i < passi.length; i++) {
    if (giro != _giroDellaLuce) return;
    _luceAdesso = passi[i];
    await _mandaLaLuce(passi[i]);
    if (i < passi.length - 1 && passoDellaLuce > Duration.zero) {
      await Future<void>.delayed(passoDellaLuce);
    }
  }
}

/* `luminosita` sul canale della finestra: su Android quella della finestra,
 * da 0 a 1 e -1 per tornare al sistema (`MainActivity.kt`); sul tablet di
 * Apple quella dello schermo, che con -1 torna com'era (`AppDelegate`). */
Future<void> _mandaLaLuce(double valore) async {
  if (!_androidOApple) return;
  try {
    await canaleDellaFinestra.invokeMethod<void>('luminosita', valore);
  } catch (_) {
    /* Un pacchetto di prima: la luce resta quella del sistema. */
  }
}

/* ── i sensori del tablet ────────────────────────────────────────────────── */

const _sensoriConosciuti = {'luce', 'prossimita'};

/* Quello che ha il tablet, chiesto ad Android una volta. Sul tablet di
 * Apple ne' luce ne' prossimita' si possono leggere senza altri permessi: la
 * risposta e' no, e la Config lo dice. */
Map<String, Object?>? _capacita;

Future<Map<String, Object?>> _leCapacita() async {
  final sapute = _capacita;
  if (sapute != null) return sapute;
  var luce = false;
  var prossimita = false;
  if (_android) {
    try {
      final detto = await canaleDellaFinestra.invokeMapMethod<String, Object?>(
        'sensori',
      );
      luce = detto?['luce'] == true;
      prossimita = detto?['prossimita'] == true;
    } catch (_) {
      /* Un pacchetto di prima: niente sensori. */
    }
  }
  return _capacita = {
    'luce': luce,
    'prossimita': prossimita,
    'piattaforma': kIsWeb
        ? 'web'
        : defaultTargetPlatform == TargetPlatform.iOS
        ? 'ios'
        : defaultTargetPlatform == TargetPlatform.android
        ? 'android'
        : 'altro',
  };
}

Future<void> _diciLeCapacita() async {
  final capacita = await _leCapacita();
  await _dici({'capacita': capacita});
}

Future<void> _dici(Map<String, Object?> detto) async {
  final strada = _allaPagina;
  if (strada == null) return;
  try {
    await strada(detto);
  } catch (_) {}
}

/* Si accendono solo col pannello acceso e qualcosa da sentire, e solo su
 * Android; spento il pannello si spengono, e la pagina sa che non c'e' piu'
 * niente da sentire. */
Future<void> _accordaISensori() async {
  final voluti = _aMuro ? _sensoriVoluti : const <String>{};
  if (!_android) return;
  if (voluti.isEmpty && !_sensoriAccesi) return;
  _sensoriAccesi = voluti.isNotEmpty;
  canaleDellaFinestra.setMethodCallHandler(_sensoriAccesi ? _dalSensore : null);
  if (!_sensoriAccesi) {
    _luceDellaStanza = null;
    await _dici({'luce': '', 'prossimita': ''});
  }
  try {
    await canaleDellaFinestra.invokeMethod<void>('ascolta', voluti.toList());
  } catch (_) {
    /* Un pacchetto di prima: giorno e notte li dice il sole. */
  }
}

/* Android chiama `sensore` con `{tipo: "luce", lux: 12.5}` o
 * `{tipo: "prossimita", vicino: true}`. */
Future<Object?> _dalSensore(MethodCall chiamata) async {
  if (chiamata.method != 'sensore') return null;
  final detto = chiamata.arguments;
  if (detto is! Map) return null;
  await loSchermoSente(
    '${detto['tipo']}',
    lux: (detto['lux'] as num?)?.toDouble(),
    vicino: detto['vicino'] == true,
  );
  return null;
}

/// Una lettura di un sensore del tablet, girata alla pagina come parola.
@visibleForTesting
Future<void> loSchermoSente(
  String tipo, {
  double? lux,
  bool vicino = false,
}) async {
  if (!_aMuro) return;
  if (tipo == 'prossimita' && _sensoriVoluti.contains('prossimita')) {
    await _dici({'prossimita': vicino ? 'si' : 'no'});
  } else if (tipo == 'luce' && lux != null && _sensoriVoluti.contains('luce')) {
    final parola = luceDellaStanza(lux, _luceDellaStanza);
    if (parola == _luceDellaStanza) return;
    _luceDellaStanza = parola;
    await _dici({'luce': parola});
  }
}

/// La luce del tablet in tre parole, dal numero di lux. Le soglie non sono
/// le stesse in salita e in discesa: una stanza che balla attorno a una
/// soglia non fa lampeggiare lo schermo fra notte e giorno. La stessa regola
/// sta nella plancia (`luceDellaStanza` in `core/plancia-a-muro.js`).
String luceDellaStanza(double lux, [String? prima]) {
  if (prima == 'buio' && lux < 12) return 'buio';
  if (prima == 'chiaro' && lux > 50) return 'chiaro';
  if (lux < 6) return 'buio';
  if (lux > 80) return 'chiaro';
  return 'penombra';
}

/// Rimette tutto come all'avvio: per le prove, che girano nello stesso
/// processo e non devono ereditare il pannello di quella prima.
@visibleForTesting
void loSchermoDaCapo() {
  _aMuro = false;
  _chiosco = false;
  _spento = false;
  _accesoChiesto = false;
  _accesoDetto = false;
  _luceVoluta = null;
  _luceAdesso = null;
  _giroDellaLuce++;
  _sensoriVoluti = const {};
  _sensoriAccesi = false;
  _luceDellaStanza = null;
  _allaPagina = null;
  _capacita = null;
}
