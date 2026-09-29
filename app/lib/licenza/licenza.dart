/// gdahome Premium: chi ce l'ha, e cosa si apre.
///
/// Il contratto e' `docs/LICENZE.md`, sezione «L'app gdahome». In breve:
///
///  - la licenza e' **della casa**, non del telefono: tutti i telefoni
///    abbinati a una casa Premium sono Premium con lei;
///  - la casa tiene il suo gettone, firmato dal quadro, e l'app glielo chiede
///    a ogni collegamento (`ponte/licenza/stato`), lo controlla con la chiave
///    pubblica scritta in `chiave.dart` e se lo ricorda per casa, nell'archivio
///    delle case;
///  - Premium vuol dire: la casa in uso ha un gettone gdahome che vale.
///
/// **Con la chiave vuota — com'e' di serie — i controlli sono spenti**: ogni
/// casa vale come Premium, non si chiede niente alla casa e l'app fa quello
/// che ha sempre fatto. I lucchetti si accendono insieme alla chiave, non
/// prima: cosi' una build di oggi e le prove di oggi restano quelle.
///
/// **Prima l'iPhone** ([licenzeSoloSullIPhone]): con la chiave scritta, i
/// lucchetti e il negozio ci sono solo nell'app per iPhone. Su Android e nel
/// browser la stessa app resta aperta come prima, e non chiede niente.
///
/// Niente schermi qui dentro: le schermate chiedono [GestoreLicenza.premium]
/// e decidono loro cosa disegnare.
library;

import 'dart:async';

import 'package:flutter/foundation.dart';

import '../casa/archivio_delle_case.dart';
import '../casa/casa_conosciuta.dart';
import '../parole.dart';
import '../ponte/errori.dart';
import '../ponte/filo.dart';
import 'chiave.dart';
import 'gettone.dart';

/// Premium forzato dal comando di costruzione, per provare l'app a mano.
///
/// `--dart-define=GDAHOME_PREMIUM=si` (tutto aperto) oppure `=no` (tutto
/// chiuso, anche senza chiave: per vedere i lucchetti). Vale **solo** nelle
/// build di sviluppo: in quelle che vanno nei negozi questa riga non conta.
const String _forzatoDaFuori = String.fromEnvironment('GDAHOME_PREMIUM');

bool? get _forzatoDiSerie {
  if (!kDebugMode) return null;
  return switch (_forzatoDaFuori) {
    'si' || 'sì' || 'yes' || 'true' => true,
    'no' || 'false' => false,
    _ => null,
  };
}

/// Se le licenze contano in questa app, su questo telefono.
///
/// Serve la chiave; e prima dell'iPhone ([licenzeSoloSullIPhone]) serve anche
/// essere l'app per iPhone. Nel browser mai, prima dell'iPhone: anche aperto
/// da un iPhone, il browser non e' l'app del negozio.
bool get licenzeInQuestaApp =>
    chiavePubblicaLicenze.isNotEmpty && contanoQui(licenzeSoloSullIPhone);

/// Se, con la chiave scritta, le licenze contano qui: sempre, o solo
/// nell'app per iPhone.
bool contanoQui(bool soloSullIPhone) =>
    !soloSullIPhone || (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS);

/// Come sta la licenza di una casa, per chi la deve scrivere a schermo.
enum ComeStaLaLicenza {
  /// I controlli sono spenti: la chiave e' vuota, o e' forzato.
  senzaControlli,

  /// Mai chiesto a questa casa: un ponte che non lo sa dire, o una casa
  /// appena abbinata.
  maiChiesto,

  /// La casa ha detto che le licenze non le sa tenere: il suo add-on e' di
  /// prima delle licenze, o le ha spente. Li' Premium non si puo' comprare,
  /// e allora non c'e' nemmeno il lucchetto (`CasaConosciuta.senzaLicenze`).
  casaSenzaLicenze,

  /// Chiesto, e la casa non ha un gettone che valga.
  base,

  /// La casa ha un gettone gdahome che vale.
  premium,
}

class GestoreLicenza extends ChangeNotifier {
  /// [chiave] si passa nelle prove (la coppia di prova del contratto); di
  /// solito e' [chiavePubblicaLicenze]. [qui] dice se le licenze contano su
  /// questo telefono: di solito lo decide [contanoQui], e le prove lo
  /// passano per fare l'iPhone e l'Android. [forza] mette tutte le case
  /// Premium (`true`) o tutte Base (`false`), e vince sulla chiave: serve
  /// alle prove e alle fotografie.
  GestoreLicenza({
    String? chiave,
    bool? qui,
    bool? forza,
    DateTime Function()? orologio,
  }) : chiave = chiave ?? chiavePubblicaLicenze,
       qui = qui ?? contanoQui(licenzeSoloSullIPhone),
       _forza = forza ?? _forzatoDiSerie,
       _orologio = orologio ?? DateTime.now {
    premiumQui = ValueNotifier<bool>(_calcolaPremium());
  }

  /// La chiave pubblica con cui si controllano i gettoni.
  final String chiave;

  /// Se le licenze contano su questo telefono. Prima dell'iPhone, su Android
  /// e nel browser no: la chiave c'e', ma qui non si chiede e non si chiude
  /// niente.
  final bool qui;
  final DateTime Function() _orologio;

  bool? _forza;

  /// Premium forzato, per tutte le case: `null` per tornare ai gettoni.
  bool? get forza => _forza;
  set forza(bool? quale) {
    if (_forza == quale) return;
    _forza = quale;
    _ricalcola();
  }

  /// Se i lucchetti ci sono.
  ///
  /// Spenti con la chiave vuota: allora tutto vale come Premium. Accesi anche
  /// quando Premium e' forzato a `false`, che e' il modo di vederli senza la
  /// chiave.
  bool get controlliAccesi =>
      _forza == false || (_forza == null && chiave.isNotEmpty && qui);

  /// Se c'e' qualcosa da comprare: la pagina Premium ha senso solo cosi'.
  bool get siVende => (chiave.isNotEmpty && qui) || _forza != null;

  /// Se c'e' una ricevuta del negozio che non e' ancora arrivata alla casa.
  ///
  /// Chi compra fuori casa, con la casa Base, e' proprio quello che il
  /// lucchetto ha fermato fuori: senza questa riga la ricevuta aspetterebbe
  /// che torni sotto il Wi-Fi di casa, e avrebbe pagato per niente fino a
  /// sera. Con una ricevuta da portare le strade di fuori si prendono
  /// ([stradeDaFuoriPer]), e appena la casa l'ha avuta si torna com'era. La
  /// mette `Collegamento.mandaLaRicevuta`.
  bool get ricevutaDaPortare => _ricevutaDaPortare;
  set ricevutaDaPortare(bool si) {
    if (_ricevutaDaPortare == si) return;
    _ricevutaDaPortare = si;
    _ricalcola();
  }

  bool _ricevutaDaPortare = false;

  /* I gettoni controllati, per casa: quello com'era scritto e quello che se
   * ne e' letto. Si ricontrolla la firma solo quando il testo cambia. */
  final Map<String, String> _grezzi = {};
  final Map<String, Gettone?> _letti = {};
  final Map<String, CasaConosciuta> _case = {};
  String? _inUso;
  Timer? _allaScadenza;

  /// Premium la casa in uso, da ascoltare: e' quello che riceve gdanav
  /// (`premiumOspite`), che dentro gdahome Premium e' compreso.
  late final ValueNotifier<bool> premiumQui;

  /// Le case che l'app conosce, coi loro gettoni: si chiama all'apertura e
  /// ogni volta che un gettone cambia. Controlla le firme nuove.
  Future<void> conosci(Iterable<CasaConosciuta> tutte) async {
    _case
      ..clear()
      ..addEntries(tutte.map((una) => MapEntry(una.id, una)));
    _grezzi.removeWhere((id, _) => !_case.containsKey(id));
    _letti.removeWhere((id, _) => !_case.containsKey(id));
    for (final casa in _case.values) {
      final grezzo = casa.gettone ?? '';
      if (_grezzi[casa.id] == grezzo && _letti.containsKey(casa.id)) continue;
      final letto = await leggiIlGettone(grezzo, chiave: chiave);
      _grezzi[casa.id] = grezzo;
      _letti[casa.id] = letto;
    }
    _ricalcola();
  }

  /// La casa che si sta usando adesso.
  void inUso(String? id) {
    if (_inUso == id) return;
    _inUso = id;
    _ricalcola();
  }

  CasaConosciuta? get casaInUso => _inUso == null ? null : _case[_inUso];

  /// Il gettone di questa casa, se ne ha uno che vale adesso.
  Gettone? gettoneDi(CasaConosciuta? casa) {
    if (casa == null) return null;
    final letto = _letti[casa.id];
    if (letto == null) return null;
    /* Il gettone letto e' di quel testo: se l'archivio ne ha uno piu' nuovo
     * che non si e' ancora controllato, non si risponde con quello vecchio. */
    if (_grezzi[casa.id] != (casa.gettone ?? '')) return null;
    final soggetto = casa.casaAlCentralino;
    return letto.vale(soggetto: soggetto, adesso: _orologio()) ? letto : null;
  }

  /// Come sta questa casa.
  ComeStaLaLicenza comeSta(CasaConosciuta? casa) {
    if (!controlliAccesi) return ComeStaLaLicenza.senzaControlli;
    if (_forza == false) return ComeStaLaLicenza.base;
    if (gettoneDi(casa) != null) return ComeStaLaLicenza.premium;
    final conosciuta = casa == null ? null : (_case[casa.id] ?? casa);
    if (conosciuta?.senzaLicenze ?? false) {
      return ComeStaLaLicenza.casaSenzaLicenze;
    }
    if (conosciuta?.gettone == null) return ComeStaLaLicenza.maiChiesto;
    return ComeStaLaLicenza.base;
  }

  /// Se questa casa e' Premium. Con i controlli spenti, si'; e si' anche in
  /// una casa che le licenze non le sa tenere, dove non si puo' comprare.
  bool premiumDi(CasaConosciuta? casa) {
    if (_forza != null) return _forza!;
    if (!controlliAccesi) return true;
    if (gettoneDi(casa) != null) return true;
    return comeSta(casa) == ComeStaLaLicenza.casaSenzaLicenze;
  }

  /// Se la casa in uso e' Premium.
  bool get premium => premiumDi(casaInUso);

  /// Se almeno una delle case e' Premium: e' quello che serve per
  /// aggiungerne un'altra.
  bool get almenoUnaPremium {
    if (_forza != null) return _forza!;
    if (!controlliAccesi) return true;
    return _case.values.any(premiumDi);
  }

  /// Se si possono aggiungere case: la prima sempre, le altre solo se una di
  /// quelle che ci sono e' Premium.
  bool get siPuoAggiungereUnaCasa => _case.isEmpty || almenoUnaPremium;

  /// Se per questa casa si possono prendere le strade di fuori: il
  /// centralino e l'indirizzo pubblico.
  ///
  /// Si' se e' Premium, e si' anche se non lo si sa ancora: una casa appena
  /// abbinata da fuori non ha ancora detto niente, e l'unico modo di
  /// chiederglielo e' entrare. Se non e' Premium il centralino la chiude lui
  /// (`premium-richiesto`), e appena dentro la casa lo dice: da li' in poi si
  /// sa, e la strada di fuori non si prova piu'.
  bool stradeDaFuoriPer(CasaConosciuta casa) {
    if (premiumDi(casa)) return true;
    if (_forza == false) return false;
    if (_ricevutaDaPortare) return true;
    return comeSta(casa) == ComeStaLaLicenza.maiChiesto;
  }

  /* ─── Quello che si chiede alla casa ──────────────────────────────────── */

  /// Chiede alla casa il suo gettone, lo ricorda nell'archivio e lo controlla.
  ///
  /// Torna `true` se la casa ha risposto. Con la chiave vuota non si chiede
  /// nemmeno: nessun gettone varrebbe; e nemmeno dove le licenze non contano.
  ///
  /// Una casa che le licenze non le sa tenere lo dice in due modi: un add-on
  /// di prima non conosce il comando, uno con le licenze spente risponde
  /// `attive: false`. Tutti e due si ricordano come
  /// [ComeStaLaLicenza.casaSenzaLicenze]: li' Premium non si puo' comprare, e
  /// il lucchetto non si mette.
  Future<bool> chiedi(
    Filo filo,
    CasaConosciuta casa,
    ArchivioDelleCase archivio,
  ) async {
    if (chiave.isEmpty || !qui) return false;
    final Object? detto;
    try {
      detto = await filo.risultato({'type': 'ponte/licenza/stato'});
    } on ComandoRifiutato catch (no) {
      if (!_nonLoConosce(no)) return false;
      await archivio.segnaSenzaLicenze(casa.id);
      await conosci(archivio.tutte);
      return true;
    } on ErroreDelPonte {
      return false;
    }
    if (detto is Map && detto['attive'] == false) {
      await archivio.segnaSenzaLicenze(casa.id);
      await conosci(archivio.tutte);
      return true;
    }
    await _ricordaLaRisposta(detto, casa, archivio);
    return true;
  }

  /* Un ponte che il comando non lo conosce proprio: e' di prima delle
   * licenze. Gli altri no — un filo caduto, una casa che non risponde — non
   * dicono niente della licenza, e si resta con quello che si sapeva. */
  static bool _nonLoConosce(ComandoRifiutato no) {
    final tutto = '${no.codice ?? ''} ${no.spiegazione}'.toLowerCase();
    return no.codice == 'unknown_command' || tutto.contains('unknown command');
  }

  /// Riscatta un codice regalo per questa casa (`ponte/licenza/riscatta`).
  ///
  /// Solleva [LicenzaRifiutata] con una frase da mostrare quando non va.
  Future<void> riscatta(
    String codice,
    Filo filo,
    CasaConosciuta casa,
    ArchivioDelleCase archivio,
  ) async {
    final pulito = codicePulito(codice);
    if (!codiceBenFatto(pulito)) {
      throw LicenzaRifiutata(
        inLingua(
          it: 'Il codice è fatto così: GDA-XXXX-XXXX-XXXX.',
          en: 'The code looks like this: GDA-XXXX-XXXX-XXXX.',
        ),
      );
    }
    final Object? detto;
    try {
      detto = await filo.risultato({
        'type': 'ponte/licenza/riscatta',
        'codice': pulito,
      }, entro: const Duration(seconds: 30));
    } on ErroreDelPonte catch (errore) {
      throw LicenzaRifiutata(_spiega(errore));
    }
    await _ricordaLaRisposta(detto, casa, archivio);
    /* La risposta puo' non avere il gettone dentro: si richiede. */
    await chiedi(filo, casa, archivio);
  }

  /// Manda alla casa la ricevuta di un acquisto (`ponte/licenza/negozio`):
  /// la casa la gira al quadro, il quadro la controlla col negozio.
  Future<void> mandaLaRicevuta({
    required String piattaforma,
    required String prodotto,
    required String ricevuta,
    required Filo filo,
    required CasaConosciuta casa,
    required ArchivioDelleCase archivio,
  }) async {
    final Object? detto;
    try {
      detto = await filo.risultato({
        'type': 'ponte/licenza/negozio',
        'app': 'gdahome',
        'piattaforma': piattaforma,
        'prodotto': prodotto,
        'ricevuta': ricevuta,
      }, entro: const Duration(seconds: 45));
    } on ErroreDelPonte catch (errore) {
      /* Si chiude l'acquisto solo per un no del negozio: la ricevuta non
       * vale. Tutto il resto — un add-on che non sa ancora niente di licenze,
       * il quadro senza le chiavi del negozio, il filo giu' — si riprova, e
       * il negozio la ripropone da se'. */
      final tutto = errore is ComandoRifiutato
          ? '${errore.codice ?? ''} ${errore.spiegazione}'.toLowerCase()
          : '';
      throw LicenzaRifiutata(
        _spiega(errore),
        definitiva: tutto.contains('402') || tutto.contains('ricevuta'),
      );
    }
    await _ricordaLaRisposta(detto, casa, archivio);
    await chiedi(filo, casa, archivio);
  }

  Future<void> _ricordaLaRisposta(
    Object? detto,
    CasaConosciuta casa,
    ArchivioDelleCase archivio,
  ) async {
    if (detto is! Map) return;
    final gettoni = detto['gettoni'];
    if (gettoni is! Map) return;
    /* `segnaIlGettone` toglie anche il «senza licenze»: una casa che da'
     * gettoni, vuoti o no, le licenze le sa tenere. */
    final gettone = gettoni['gdahome'];
    await archivio.segnaIlGettone(casa.id, gettone is String ? gettone : '');
    await conosci(archivio.tutte);
  }

  static String _spiega(ErroreDelPonte errore) {
    final codice = errore is ComandoRifiutato ? (errore.codice ?? '') : '';
    final tutto = '$codice ${errore.spiegazione}'.toLowerCase();
    /* Un add-on di prima delle licenze non conosce il comando; uno con le
     * licenze spente lo conosce e dice di no. Per chi compra e' la stessa
     * cosa, e si ripara allo stesso modo. */
    if (codice == 'unknown_command' ||
        tutto.contains('unknown command') ||
        tutto.contains('licenze-spente')) {
      return inLingua(
        it:
            'L\'add-on di questa casa non conosce ancora le licenze: '
            'aggiorna gdahome in Home Assistant.',
        en:
            'This home\'s add-on doesn\'t know about licences yet: update '
            'gdahome in Home Assistant.',
      );
    }
    if (tutto.contains('409') || tutto.contains('usato')) {
      return inLingua(
        it: 'Questo codice è già stato usato.',
        en: 'This code has already been used.',
      );
    }
    if (tutto.contains('404') ||
        tutto.contains('inesistente') ||
        tutto.contains('non esiste') ||
        tutto.contains('sconosciuto')) {
      return inLingua(
        it: 'Questo codice non esiste. Controlla le lettere.',
        en: 'This code doesn\'t exist. Check the letters.',
      );
    }
    if (tutto.contains('402') || tutto.contains('ricevuta')) {
      return inLingua(
        it: 'Il negozio non ha confermato l\'acquisto.',
        en: 'The store didn\'t confirm the purchase.',
      );
    }
    if (tutto.contains('503') || tutto.contains('non-configurata')) {
      return inLingua(
        it:
            'Il controllo degli acquisti non è ancora acceso. Riprova più '
            'tardi: l\'acquisto resta valido.',
        en:
            'Purchase checks aren\'t switched on yet. Try again later: the '
            'purchase stays valid.',
      );
    }
    return errore.spiegazione;
  }

  /* ─── Il tempo ────────────────────────────────────────────────────────── */

  bool _calcolaPremium() => premium;

  bool _spento = false;

  void _ricalcola() {
    if (_spento) return;
    _allaScadenza?.cancel();
    _allaScadenza = null;
    /* Un gettone smette di valere da solo, anche ad app aperta: si guarda di
     * nuovo al primo momento in cui uno finisce. */
    final adesso = _orologio();
    DateTime? prossima;
    for (final letto in _letti.values.nonNulls) {
      for (final quando in [letto.fino, ?letto.scade]) {
        if (!quando.isAfter(adesso)) continue;
        if (prossima == null || quando.isBefore(prossima)) prossima = quando;
      }
    }
    if (prossima != null) {
      final fra = prossima.difference(adesso) + const Duration(seconds: 1);
      /* I timer oltre qualche settimana non servono: l'app si riapre prima. */
      if (fra < const Duration(days: 9)) {
        _allaScadenza = Timer(fra, _ricalcola);
      }
    }
    premiumQui.value = _calcolaPremium();
    notifyListeners();
  }

  @override
  void dispose() {
    _spento = true;
    _allaScadenza?.cancel();
    premiumQui.dispose();
    super.dispose();
  }
}

/// Quando la casa, o il quadro dietro di lei, dice di no.
class LicenzaRifiutata implements Exception {
  const LicenzaRifiutata(this.spiegazione, {this.definitiva = true});
  final String spiegazione;

  /// `false` quando il no e' della strada (il filo caduto, la casa che non
  /// risponde) e non di chi decide: un acquisto allora non si chiude, e il
  /// negozio lo ripropone al prossimo avvio.
  final bool definitiva;

  @override
  String toString() => spiegazione;
}

/// L'alfabeto dei codici regalo: senza lettere che si confondono.
const alfabetoDeiCodici = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/// Il codice come lo vuole il quadro: maiuscolo, coi trattini al posto
/// giusto, anche se lo si e' scritto tutto attaccato o con gli spazi.
String codicePulito(String scritto) {
  var nudo = scritto.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
  if (nudo.startsWith('GDA')) nudo = nudo.substring(3);
  if (nudo.length != 12) return scritto.trim().toUpperCase();
  return 'GDA-${nudo.substring(0, 4)}-${nudo.substring(4, 8)}-'
      '${nudo.substring(8)}';
}

/// Se il codice ha la forma giusta: `GDA-XXXX-XXXX-XXXX`.
bool codiceBenFatto(String codice) => RegExp(
  '^GDA-[$alfabetoDeiCodici]{4}-[$alfabetoDeiCodici]{4}-'
  '[$alfabetoDeiCodici]{4}\$',
).hasMatch(codice);
