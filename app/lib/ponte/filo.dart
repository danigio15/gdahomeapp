/// Il filo: il collegamento vivo fra l'app e la casa.
///
/// Sul filo si parla il **protocollo di Home Assistant**, non un protocollo
/// nostro: il ponte si presenta come Home Assistant apposta. La conseguenza
/// pratica e' che questa classe funziona identica puntata a un ponte o puntata
/// dritta a un Home Assistant, e nessuno dei due lati e' incastrato con
/// l'altro.
///
/// Le tre cose che questa classe fa e che sembrano dettagli ma non lo sono:
///
///  - **la riconnessione**. Un telefono passa dal Wi-Fi al 4G, entra in
///    ascensore, si mette in tasca. Il filo cade continuamente, ed e' normale:
///    quello che non deve succedere e' che l'app se ne accorga.
///  - **le sottoscrizioni che risalgono da sole**. Dopo una caduta, Home
///    Assistant non si ricorda di niente. Chi si era sottoscritto agli eventi
///    smetterebbe di ricevere per sempre, in silenzio, che e' il peggiore dei
///    modi di rompersi. Qui le sottoscrizioni vengono rifatte.
///  - **le richieste in attesa che muoiono subito**. Una richiesta partita
///    prima della caduta non avra' mai risposta: farla fallire adesso e'
///    meglio che lasciare l'app ferma a girare una rotella.
///
/// E ce n'e' una quarta, che non si vede finche' non morde: **il battito**.
/// Un filo che cade lo si sente — arriva una chiusura, e si ribussa. Un filo
/// che muore *senza cadere* no: fra il telefono e la casa ci sono un router e
/// spesso un centralino, e una corrispondenza di rete che nessuno usa sparisce
/// dopo qualche minuto senza che nessuno dei due capi riceva niente. L'app
/// resterebbe li' a mostrare dati vecchi credendosi collegata. Percio' si
/// manda un colpetto ogni mezzo minuto e si aspetta la risposta: se non torna
/// entro un minuto e mezzo il filo e' morto, e si ricomincia.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import '../misure/lavori.dart';
import '../parole.dart';
import 'altrove/altrove.dart';
import 'cifra.dart';
import 'errori.dart';
import 'indirizzo.dart';
import 'presa.dart';
import 'stretta.dart';

/// Il segno con cui comincia un **mucchio**: piu' messaggi in una busta sola,
/// uno per riga.
///
/// Il ponte li raggruppa quando il filo passa dal centralino, dove ogni
/// messaggio e' una richiesta contata e una casa vera ne manda cinque al
/// secondo. Deve restare identico a `SEGNO_DEL_MUCCHIO` in
/// `ponte/src/ponte.js`.
const segnoDelMucchio = 'mucchio\n';

/// Lo stesso segno in byte: quello che arriva sono byte, e riconoscerlo li'
/// non costa ne' una stringa ne' una copia.
final _segnoInByte = Uint8List.fromList(utf8.encode(segnoDelMucchio));

/// Il ritorno a capo che divide i messaggi dentro un mucchio.
const int _aCapo = 0x0a;

/// Dai byte al JSON in un colpo, senza la stringa in mezzo.
final _daByteAlJson = const Utf8Decoder().fuse(const JsonDecoder());

enum StatoDelFilo {
  /// Mai aperto, o chiuso apposta.
  spento,

  /// Sta bussando, o sta aspettando prima di ribussare.
  chiamando,

  /// Dentro: la stretta di mano e' andata.
  dentro,
}

/// Dove bussare, chiesto *adesso*.
///
/// E' una funzione e non un indirizzo, ed e' li' che sta il funzionamento
/// fuori casa. L'indirizzo si ricalcola **a ogni tentativo**: chi esce dal
/// portone perde il filo sull'indirizzo di rete locale, e al tentativo dopo la
/// sonda risponde con quello di fuori. Nessuno tocca niente, e la casa e'
/// sempre la stessa istanza.
typedef TrovaLApprodo = Future<Approdo> Function();

class Filo {
  Filo({
    required TrovaLApprodo approdo,
    required this.segno,
    required this.chi,
    required this.chiave,
    ApriLaPresa? apri,
    this.attesaMassima = const Duration(seconds: 30),
    this.attesaDellaRisposta = const Duration(seconds: 20),
    this.battito = const Duration(seconds: 30),
    this.silenzioMassimo = const Duration(seconds: 90),
    this.pazienzaAlRisveglio = const Duration(seconds: 6),
    this.attesaDellApertura = const Duration(seconds: 20),
    this.attesaAFreddo = const Duration(milliseconds: 400),
    this.quantiTentativiAFreddo = 6,
  }) : _trovaLApprodo = approdo,
       _apri = apri ?? PresaSuWebSocket.apri;

  /// Un filo verso un indirizzo solo, che non cambia mai. Serve alle prove.
  Filo.fisso({
    required IndirizzoDelPonte indirizzo,
    required String segno,
    required String chi,
    required String chiave,
    ApriLaPresa? apri,
    Duration attesaMassima = const Duration(seconds: 30),
    Duration attesaDellaRisposta = const Duration(seconds: 20),
    Duration battito = const Duration(seconds: 30),
    Duration silenzioMassimo = const Duration(seconds: 90),
    Duration pazienzaAlRisveglio = const Duration(seconds: 6),
    Duration attesaDellApertura = const Duration(seconds: 20),
    Duration attesaAFreddo = const Duration(milliseconds: 400),
    int quantiTentativiAFreddo = 6,
  }) : this(
         approdo: (() async => Approdo.diretto(DaDove.daDentro, indirizzo)),
         segno: segno,
         chi: chi,
         chiave: chiave,
         apri: apri,
         attesaMassima: attesaMassima,
         attesaDellaRisposta: attesaDellaRisposta,
         battito: battito,
         silenzioMassimo: silenzioMassimo,
         pazienzaAlRisveglio: pazienzaAlRisveglio,
         attesaDellApertura: attesaDellApertura,
         attesaAFreddo: attesaAFreddo,
         quantiTentativiAFreddo: quantiTentativiAFreddo,
       );

  final TrovaLApprodo _trovaLApprodo;

  /// Il segno: fa entrare. Viaggia dentro il cifrato, mai in chiaro.
  final String segno;

  /// L'identificativo di questo telefono. Non e' un segreto: serve alla casa
  /// per sapere quale chiave del filo tirare fuori, e viaggia in chiaro nella
  /// prima riga della stretta di mano.
  final String chi;

  /// La chiave del filo: cifra. E' l'altra meta' di quello che si riceve
  /// abbinandosi, ed e' quella che il centralino non ha mai visto passare.
  final String chiave;

  final ApriLaPresa _apri;

  /// Oltre questa non si aspetta di piu' fra un tentativo e l'altro.
  final Duration attesaMassima;

  /// Quanto vive una richiesta senza risposta.
  final Duration attesaDellaRisposta;

  /// Ogni quanto parte un colpetto, e dopo quanto silenzio il filo si
  /// considera morto. Il secondo e' il triplo del primo: due colpetti persi
  /// capitano, tre di fila no.
  final Duration battito;
  final Duration silenzioMassimo;

  /// Quanto si aspetta, al risveglio, un segno di vita prima di ribussare.
  final Duration pazienzaAlRisveglio;

  /// Quanto si aspetta che la presa si apra, prima di dire che non si apre.
  ///
  /// Senza questa scadenza un tentativo poteva restare appeso **per sempre**:
  /// un telefono che si sveglia con la radio ancora fredda apre una presa che
  /// non si apre e non fallisce, `_bussa` non torna piu', e l'app resta a
  /// «sto cercando la casa» senza piu' riprovare — e nemmeno il risveglio
  /// puo' farci niente, perche' non c'e' nessun timer da anticipare. E' il
  /// modo peggiore di rompersi: sembra tutto in corso, e non sta succedendo
  /// niente.
  final Duration attesaDellApertura;

  /// Quanto si aspetta quando la rete del telefono non c'e' ancora, e quante
  /// volte prima di chiamarla caduta.
  ///
  /// «Failed host lookup: No address associated with hostname»: dopo mezz'ora
  /// in tasca il telefono e' in Doze, e quando si riprende in mano la radio
  /// non e' ancora su. Non e' la casa che non risponde — e' il telefono che
  /// non ha ancora una rete — e la differenza conta: quella si risolve in un
  /// secondo, e trattarla come una caduta vuol dire raddoppiare l'attesa
  /// proprio nel momento in cui basterebbe riprovare fra un attimo, **e**
  /// scrivere in «Come va l'app» tre errori che spaventano e non dicono
  /// niente. Sei tentativi ogni quattro decimi sono due secondi e mezzo:
  /// dopo quelli, se ancora non c'e' rete, e' una caduta come le altre.
  final Duration attesaAFreddo;
  final int quantiTentativiAFreddo;

  final _stato = StreamController<StatoDelFilo>.broadcast();
  final _inAttesa = <int, Completer<Map<String, dynamic>>>{};
  final _sottoscrizioni = <int, _Sottoscrizione>{};

  /// I messaggi mandati per conto di qualcun altro — la plancia vera, che
  /// parla Home Assistant da dentro il WebView — e chi ne aspetta le risposte.
  final _instradati = <int, void Function(Instradato)>{};

  PresaAperta? _presa;
  Approdo? _approdo;
  StreamSubscription<Uint8List>? _ascolto;

  /* Quello che arriva si legge **in fila**: aprire un messaggio grosso e'
   * asincrono — va altrove, e torna — e senza la fila la risposta a una
   * sottoscrizione potrebbe farsi sorpassare dal primo evento di quella
   * stessa sottoscrizione. */
  Future<void> _codaInEntrata = Future<void>.value();

  /* Cresce a ogni caduta: un messaggio rimasto in fila da prima non si
   * consegna piu', e' di un filo che non c'e'. */
  int _generazione = 0;

  int _cadute = 0;

  /* Le ultime cadute, col loro perche'.
   *
   * Una sola non basta: otto cadute possono essere otto volte la stessa cosa
   * — e allora il rimedio e' uno — oppure otto cose diverse, e allora si sta
   * guardando il difetto sbagliato. Se ne tengono cinque, che stanno in una
   * schermata e bastano a vedere se si ripetono. */
  static const quanteCaduteSiTengono = 5;
  final _ultimeCadute = <String>[];

  /// Le ultime cadute, dalla piu' recente: cosa e' successo e quando.
  List<String> get ultimeCadute => List.unmodifiable(_ultimeCadute.reversed);
  String? _ultimaCaduta;
  DateTime? _cadutoIl;
  Timer? _controlloAlRisveglio;

  /* Quale bussata e' quella buona, e da quando sta provando. Una lasciata
   * indietro — il risveglio ne fa ripartire una nuova — non deve installare
   * la sua presa sopra quella che intanto e' entrata. */
  int _bussate = 0;
  DateTime? _bussataDa;

  /// Quante volte di fila la rete del telefono ha detto che non c'e'.
  int _aFreddo = 0;
  Completer<void>? _stretta;
  Timer? _riprova;
  Timer? _colpetti;
  DateTime? _vistoIl;

  /// `null` finche' non si sa se dall'altra parte i colpetti li rimandano
  /// indietro: vero al primo che torna, falso quando si e' aspettato
  /// abbastanza da poterlo dire.
  bool? _rispondeAiColpetti;
  int _prossimoId = 1;
  int _tentativi = 0;
  bool _spentoApposta = false;
  StatoDelFilo _adesso = StatoDelFilo.spento;

  /// Come sta il filo, adesso e mano a mano che cambia.
  Stream<StatoDelFilo> get stato => _stato.stream;
  StatoDelFilo get statoAdesso => _adesso;

  /* Quanto passa sul filo. Per la diagnostica, non per la logica. */
  /* Le **buste**: i messaggi veri sul WebSocket, prima di spacchettare i
   * mucchi. Passando dal centralino e' il numero che si paga — ogni busta e'
   * una richiesta contata — e senza questo conto non si vedrebbe mai se il
   * raggruppamento serve a qualcosa. */
  int _busteArrivate = 0;
  /* Da quando questo filo esiste. Le cadute si contano da qui, e senza questo
   * numero non si leggono: «caduto 320 volte» in dieci minuti e' un guasto,
   * in otto ore di scheda aperta su un computer che ogni tanto si addormenta
   * e' la vita normale di un browser. Sono due conclusioni opposte tirate
   * dallo stesso numero, ed e' il numero che era incompleto. */
  final DateTime _natoIl = DateTime.now();
  int _messaggiArrivati = 0;
  int _byteArrivati = 0;
  int _eventiArrivati = 0;

  /* Quanti dei messaggi arrivati erano per qualcun altro — cioe' per la
   * plancia.
   *
   * Prima non si contavano, e nemmeno i loro eventi: un messaggio instradato
   * torna a chi l'aveva chiesto **prima** di essere aperto, e la conta degli
   * eventi stava in fondo, dove quel messaggio non arriva mai. Cosi' una casa
   * che parla — cinquecento messaggi in mezzo minuto, tutti `state_changed`
   * per la plancia — in diagnostica si leggeva «500 msg, 0 eventi», che non
   * vuol dire niente e manda a cercare un colpevole che non c'e'. */
  int _perLaPlancia = 0;
  int _messaggiMandati = 0;
  DateTime? _contoDal;

  /// Il traffico da quando si e' entrati l'ultima volta, in una riga:
  /// «1234 msg, 320 eventi, 8,1 MB giu' (1,2 MB sul filo, gzip), 295 su, in
  /// 5 min». Dice se una casa e' silenziosa o un fiume in piena, che e' la
  /// prima cosa da sapere quando l'app va a scatti; e se la compressione
  /// c'e', che vuol dire che il ponte e' abbastanza nuovo.
  String? get traffico {
    final dal = _contoDal;
    if (dal == null) return null;
    final minuti = DateTime.now().difference(dal).inSeconds / 60;
    final cadutoIl = _cadutoIl;
    final cadute = _cadute == 0
        ? inLingua(it: 'mai caduto', en: 'never dropped')
        : inLingua(
            it:
                'caduto ${volte(_cadute)} in ${_quanto(DateTime.now().difference(_natoIl))}, '
                'l\'ultima ${_daQuanto(cadutoIl)} fa: $_ultimaCaduta',
            en:
                'dropped ${volte(_cadute)} in ${_quanto(DateTime.now().difference(_natoIl))}, '
                'the last one ${_daQuanto(cadutoIl)} ago: $_ultimaCaduta',
          );
    final presa = _presa;
    final sulFilo = presa is PresaCifrata
        ? inLingua(
            it:
                ' (${_megabyte(presa.caratteriArrivati)} sul filo'
                '${presa.comprime ? ', gzip' : ', senza gzip'})',
            en:
                ' (${_megabyte(presa.caratteriArrivati)} on the wire'
                '${presa.comprime ? ', gzip' : ', no gzip'})',
          )
        : '';
    /* Le buste si dicono solo quando sono meno dei messaggi, cioe' quando il
     * ponte ha raggruppato: e' il numero che si paga passando dal centralino,
     * e vederlo accanto ai messaggi dice in un colpo quanto e' servito. */
    final buste = _busteArrivate < _messaggiArrivati
        ? inLingua(
            it: ' in $_busteArrivate buste',
            en: ' in $_busteArrivate envelopes',
          )
        : '';
    final quandoDa = minuti < 1
        ? '${(minuti * 60).round()} s'
        : '${minuti.round()} min';
    /* Quanti erano della plancia: e' la risposta alla domanda che uno si fa
     * guardando un numero grosso — «ma chi parla tanto?». Quando sono quasi
     * tutti, la casa sta raccontando alla plancia ogni cosa che cambia, e
     * quello non e' un guasto dell'app. */
    final dellaPlancia = _perLaPlancia > 0
        ? inLingua(
            it: ' ($_perLaPlancia alla plancia)',
            en: ' ($_perLaPlancia to the dashboard)',
          )
        : '';
    return inLingua(
      it:
          '$_messaggiArrivati msg$buste$dellaPlancia, $_eventiArrivati eventi, '
          '${_megabyte(_byteArrivati)} giù$sulFilo, $_messaggiMandati su, '
          'in $quandoDa; $cadute',
      en:
          '$_messaggiArrivati msg$buste$dellaPlancia, $_eventiArrivati events, '
          '${_megabyte(_byteArrivati)} down$sulFilo, $_messaggiMandati up, '
          'in $quandoDa; $cadute',
    );
  }

  /// Una durata come si dice a voce: «40 s», «12 min», «8 h».
  static String _quanto(Duration quanta) {
    if (quanta.inMinutes < 1) return '${quanta.inSeconds} s';
    if (quanta.inHours < 1) return '${quanta.inMinutes} min';
    return '${quanta.inHours} h';
  }

  static String _megabyte(int quanti) =>
      '${(quanti / (1024 * 1024)).toStringAsFixed(1)} MB';

  static String _daQuanto(DateTime? quando) {
    if (quando == null) return '?';
    final secondi = DateTime.now().difference(quando).inSeconds;
    return secondi < 90 ? '$secondi s' : '${(secondi / 60).round()} min';
  }

  bool get dentro => _adesso == StatoDelFilo.dentro;

  /// Su quale indirizzo si e' entrati, l'ultima volta che si e' entrati.
  /// Serve a dire a schermo se si sta passando da dentro casa o da fuori.
  Approdo? get approdoAdesso => _approdo;

  /// Apre il filo e torna quando la stretta di mano e' andata.
  ///
  /// Tre esiti, e sono tre cose diverse per chi guarda lo schermo:
  ///
  ///  - **torna**: si e' dentro;
  ///  - **[SegnoRifiutato]**: il telefono e' stato staccato dalla console, e
  ///    non si riprova perche' riprovare non cambierebbe niente;
  ///  - **[PonteIrraggiungibile]**: non si trova la casa. Arriva **appena** il
  ///    primo giro di ricerca ha finito, con la spiegazione di chi ha cercato,
  ///    non dopo [entro] con una spiegazione nostra; [entro] resta come rete
  ///    di sicurezza per il caso in cui un indirizzo risponda ma poi la
  ///    stretta di mano non finisca mai. I tentativi *continuano* per conto
  ///    loro — un telefono che rientra in casa si ricollega da solo — ma chi
  ///    aspettava ha una risposta invece di una rotella che gira per sempre.
  Future<void> apri({Duration entro = const Duration(seconds: 25)}) {
    if (dentro) return Future.value();
    if (_stretta != null && !_stretta!.isCompleted) return _stretta!.future;
    _spentoApposta = false;
    _tentativi = 0;
    final stretta = Completer<void>();
    _stretta = stretta;
    unawaited(_bussa());
    return stretta.future.timeout(
      entro,
      onTimeout: () => throw PonteIrraggiungibile(
        inLingua(
          it: 'gdahome in casa non risponde',
          en: 'gdahome at home is not answering',
        ),
      ),
    );
  }

  Future<void> _bussa() async {
    final mia = ++_bussate;
    _bussataDa = DateTime.now();
    _cambia(StatoDelFilo.chiamando);

    final Approdo dove;
    try {
      dove = await _trovaLApprodo();
    } catch (errore) {
      /* Nessun indirizzo risponde. I tentativi vanno avanti — il telefono puo'
       * essere in galleria, e fra un minuto no — ma **la prima volta chi
       * aspetta lo viene a sapere subito**, e con la spiegazione vera.
       *
       * Senza questo, chi apre l'app su una casa spenta guarda una rotella per
       * venticinque secondi e poi legge «il ponte non risponde», che e' la
       * nostra scadenza e non un motivo. Chi cerca la casa sa molto di piu':
       * sa se manca l'indirizzo pubblico, o se non risponde nessuno dei due. */
      /* Anche qui: se nessun indirizzo si risolve perche' la rete non c'e'
       * ancora, non e' «non trovo la casa» — e' «non trovo niente», e fra un
       * secondo si trova. */
      if (laReteNonCEAncora(errore)) {
        _senzaRete(errore);
        return;
      }
      final primaVolta = _tentativi == 0;
      _caduto(
        inLingua(
          it: 'non trovo la casa da nessuna parte',
          en: 'I can\'t find your home anywhere',
        ),
      );
      if (primaVolta) {
        final stretta = _stretta;
        if (stretta != null && !stretta.isCompleted) {
          stretta.completeError(
            errore is ErroreDelPonte
                ? errore
                : PonteIrraggiungibile(
                    inLingua(
                      it: 'non trovo la casa da nessuna parte',
                      en: 'I can\'t find your home anywhere',
                    ),
                  ),
          );
        }
      }
      return;
    }
    /* Fra la domanda e la risposta l'app puo' essere stata chiusa, l'utente
     * puo' aver cambiato casa, o il risveglio puo' aver fatto ripartire una
     * bussata nuova: questa allora si toglie di mezzo. */
    if (_spentoApposta || mia != _bussate) return;

    final PresaAperta presa;
    try {
      /* Due passi, e il secondo e' quello che conta: si apre il filo nudo, e
       * poi ci si stringe la mano. Da li' in poi tutto quello che passa e'
       * imbustato, e chi sta in mezzo — il centralino, o chi e' sulla rete di
       * casa — vede byte e basta. */
      final sotto = await _apri(dove.filo).timeout(attesaDellApertura);
      if (mia != _bussate) {
        /* Un'altra bussata ha preso il posto di questa mentre si apriva: la
         * presa aperta qui non serve piu' a nessuno, e lasciarla aperta
         * vorrebbe dire due fili verso la stessa casa. */
        unawaited(sotto.chiudi());
        return;
      }
      presa = await stringiLaMano(sotto, chi: chi, chiaveDelFilo: chiave);
    } on SegnoRifiutato catch (errore) {
      /* La casa dice che questo telefono non lo conosce piu'. Non e' una
       * caduta: ribussare non cambierebbe niente, e chi guarda lo schermo deve
       * sapere che va riabbinato. */
      _segnoNonVale(errore.spiegazione);
      return;
    } on TimeoutException {
      /* Una presa che non si apre e non fallisce e' un silenzio, non una
       * risposta: chi aspetta non lo viene a sapere: il giro dopo, quasi
       * sempre, la presa si apre — e un telefono che si ricollega da solo non
       * deve risultare fallito a chi aveva chiamato `apri`. */
      _caduto(
        inLingua(
          it: 'la casa non ha aperto il filo in tempo',
          en: 'your home did not open the connection in time',
        ),
      );
      return;
    } catch (errore) {
      /* Prima di tutto: e' la casa che non risponde, o e' il telefono che non
       * ha ancora rete? Dopo mezz'ora in tasca e' quasi sempre il secondo, e
       * si risolve riprovando fra un attimo. */
      if (laReteNonCEAncora(errore)) {
        _senzaRete(errore);
        return;
      }
      /* Il perche' vero, non «non riesco ad aprire il filo».
       *
       * Quella frase era un muro: otto cadute di fila e nessun modo di sapere
       * se fosse la rete del telefono, il centralino che chiude, o la casa
       * che non risponde — tre cose con tre rimedi diversi. Adesso quello che
       * ha detto chi e' caduto arriva fino in fondo, e in «Come va l'app» si
       * legge. */
      final primaVolta = _tentativi == 0;
      _caduto(
        errore is ErroreDelPonte
            ? errore.spiegazione
            : inLingua(
                it: 'non riesco ad aprire il filo: $errore',
                en: 'I can\'t open the connection: $errore',
              ),
      );
      /* E chi aspettava di entrare lo viene a sapere adesso, non fra
       * venticinque secondi — ma solo se c'e' una risposta vera da dargli. */
      if (primaVolta && errore is ErroreDelPonte) {
        _rispondiAChiAspetta(errore);
      }
      return;
    }
    if (mia != _bussate) {
      unawaited(presa.chiudi());
      return;
    }

    if (_spentoApposta) {
      unawaited(presa.chiudi());
      return;
    }

    _presa = presa;
    _approdo = dove;
    _ascolto = presa.messaggi.listen(
      _arrivato,
      /* Il perche' e' quello che ha detto chi ha chiuso, quando l'ha detto:
       * vedi `PresaSuWebSocket.messaggi`. */
      onError: (Object errore) => _caduto(
        errore is ErroreDelPonte
            ? errore.spiegazione
            : inLingua(
                it: 'il filo si è interrotto',
                en: 'the connection broke off',
              ),
      ),
      onDone: () => _caduto(
        inLingua(it: 'il filo si è chiuso', en: 'the connection closed'),
      ),
      cancelOnError: false,
    );
  }

  /* ─── Quello che arriva ────────────────────────────────────────────────── */

  void _arrivato(Uint8List grezzo) {
    _busteArrivate += 1;
    /* Un mucchio: dentro ci sono piu' messaggi, uno per riga.
     *
     * Non e' JSON, ed e' apposta: un JSON non contiene mai un ritorno a capo
     * vero — dentro una stringa e' `\n`, due caratteri — quindi spezzare su
     * quello e' esatto e non costa ne' una lettura ne' una riscrittura dei
     * messaggi che stanno dentro. Ognuno riprende la strada che avrebbe
     * fatto da solo: chi lo riceve non sa di essere arrivato in compagnia.
     *
     * E adesso i pezzi sono **viste**, non copie: guardano dentro gli stessi
     * byte arrivati, uno per messaggio, e spezzare un mucchio da mezzo
     * megabyte non alloca niente. */
    if (_cominciaColSegno(grezzo)) {
      _byteArrivati += _segnoInByte.length;
      var da = _segnoInByte.length;
      while (da < grezzo.length) {
        var fino = da;
        while (fino < grezzo.length && grezzo[fino] != _aCapo) {
          fino += 1;
        }
        if (fino > da) {
          _unMessaggio(Uint8List.sublistView(grezzo, da, fino));
        }
        da = fino + 1;
      }
      return;
    }
    _unMessaggio(grezzo);
  }

  static bool _cominciaColSegno(Uint8List grezzo) {
    if (grezzo.length < _segnoInByte.length) return false;
    for (var quale = 0; quale < _segnoInByte.length; quale += 1) {
      if (grezzo[quale] != _segnoInByte[quale]) return false;
    }
    return true;
  }

  void _unMessaggio(Uint8List grezzo) {
    _messaggiArrivati += 1;
    _byteArrivati += grezzo.length;
    /* Qualunque cosa arrivi dice che il filo e' vivo: un fiume di eventi
     * non e' silenzio, anche se il pong ai colpetti sta in fila dietro. */
    _vistoIl = DateTime.now();
    final generazione = _generazione;
    _codaInEntrata = _codaInEntrata
        .then((_) => _leggi(grezzo, generazione))
        .catchError((Object _) {
          /* Un messaggio che non si legge non deve fermare la fila. */
        });
  }

  Future<void> _leggi(Uint8List grezzo, int generazione) async {
    if (generazione != _generazione) return;

    /* Quello che si e' mandato per conto di qualcun altro torna a lui,
     * qualunque cosa sia: la risposta, gli eventi, un pong. Si guarda prima
     * di tutto il resto, perche' quel numero l'ha messo il filo ma il
     * messaggio non e' suo.
     *
     * E gli si da' il **testo**, cosi' com'e' arrivato: leggerlo tutto per
     * poi riscriverlo uguale costava, su un `get_states` da un megabyte, un
     * decimo di secondo di schermo fermo — e la plancia lo legge da se'. Il
     * numero e il tipo stanno in testa, e si prendono senza aprire il resto.
     * Se la testa non e' fatta come ci si aspetta, si legge tutto, come
     * prima. */
    final testa = _Testa.leggi(grezzo);
    if (testa != null) {
      final aChi = _instradati[testa.id];
      if (aChi != null) {
        _perQualcunAltro(testa.tipo);
        aChi(Instradato._(grezzo, testa));
        return;
      }
    }

    /* Dai byte al JSON in un colpo: `utf8.decode` e poi `jsonDecode` sono due
     * passaggi e una stringa in mezzo — su un `get_states` da un megabyte e
     * mezzo, un megabyte e mezzo allocato solo per riscriverlo subito in
     * mappe. Il convertitore fuso legge i byte e costruisce le mappe, e la
     * stringa in mezzo non esiste. */
    final Map<String, dynamic> detto;
    try {
      final letto = grezzo.length < Busta.sogliaAltrove
          ? Lavori.io.subito(
              'messaggi letti qui',
              () => _daByteAlJson.convert(grezzo),
            )
          : await Lavori.io.conto(
              'messaggi letti altrove',
              /* E i byte ci vanno **trasferiti**: spedirli copiati vorrebbe
               * dire pagare qui la copia che si sta cercando di non fare. */
              () => altroveCoiByte(grezzo, _daByteAlJson.convert),
            );
      if (letto is! Map<String, dynamic>) return;
      detto = letto;
    } catch (_) {
      /* Roba che non e' JSON non e' Home Assistant: si lascia perdere invece
       * di far cadere il filo per colpa di un byte. */
      return;
    }
    if (generazione != _generazione) return;

    if (testa == null) {
      final numero = detto['id'];
      if (numero is int) {
        final aChi = _instradati[numero];
        if (aChi != null) {
          _perQualcunAltro(detto['type'] as String?);
          aChi(Instradato._daMappa(detto));
          return;
        }
      }
    }

    switch (detto['type']) {
      case 'auth_required':
        _manda({'type': 'auth', 'access_token': segno});
      case 'auth_ok':
        _entrato();
      case 'auth_invalid':
        _segnoNonVale(
          detto['message'] as String? ??
              inLingua(
                it: 'il segno non è più valido',
                en: 'the token is no longer valid',
              ),
        );
      case 'result':
        _risposta(detto);
      case 'event':
        _eventiArrivati += 1;
        _evento(detto);
      case 'pong':
        _vistoIl = DateTime.now();
        _rispondeAiColpetti = true;
        _controlloAlRisveglio?.cancel();
        _controlloAlRisveglio = null;
    }
  }

  /* Un messaggio che torna a chi l'aveva instradato: si conta qui, perche' da
   * qui in poi non passa piu' dalla parte che conta. */
  void _perQualcunAltro(String? tipo) {
    _perLaPlancia += 1;
    if (tipo == 'event') _eventiArrivati += 1;
  }

  void _entrato() {
    _tentativi = 0;
    _contoDal = DateTime.now();
    /* I lavori si contano dallo stesso momento del traffico: cosi' le due
     * righe della diagnostica parlano dello stesso pezzo di tempo. */
    Lavori.io.azzera();
    _messaggiArrivati = 0;
    _perLaPlancia = 0;
    _busteArrivate = 0;
    _byteArrivati = 0;
    _eventiArrivati = 0;
    _messaggiMandati = 0;
    _cominciaABattere();
    /* Il filo e' dentro: la rete c'e'. Il conto dei tentativi a freddo
     * riparte da zero, cosi' il prossimo risveglio ha di nuovo tutti i suoi
     * tentativi veloci prima di parlare di cadute. */
    _aFreddo = 0;
    _cambia(StatoDelFilo.dentro);
    if (_stretta != null && !_stretta!.isCompleted) _stretta!.complete();
    _rifaiLeSottoscrizioni();
  }

  void _risposta(Map<String, dynamic> detto) {
    final id = detto['id'];
    if (id is! int) return;
    final chiAspetta = _inAttesa.remove(id);
    if (chiAspetta == null || chiAspetta.isCompleted) return;
    if (detto['success'] == true) {
      chiAspetta.complete(detto);
      return;
    }
    final male = detto['error'];
    final messaggio = male is Map ? male['message'] as String? : null;
    final codice = male is Map ? male['code'] as String? : null;
    chiAspetta.completeError(
      ComandoRifiutato(
        messaggio ?? 'Home Assistant ha rifiutato il comando',
        codice: codice,
      ),
    );
  }

  void _evento(Map<String, dynamic> detto) {
    final id = detto['id'];
    if (id is! int) return;
    final sottoscritta = _sottoscrizioni[id];
    if (sottoscritta == null || sottoscritta.uscita.isClosed) return;
    final evento = detto['event'];
    if (evento is Map<String, dynamic>) sottoscritta.uscita.add(evento);
  }

  /* ─── I comandi ────────────────────────────────────────────────────────── */

  /// Manda un comando e aspetta la risposta.
  ///
  /// [entro] e' quanto si aspetta, quando non e' l'attesa di sempre: un file
  /// della plancia da un megabyte, passando dal centralino, ci mette piu' di
  /// un comando a una luce.
  Future<Map<String, dynamic>> chiedi(
    Map<String, dynamic> comando, {
    Duration? entro,
  }) {
    if (!dentro) {
      return Future.error(
        FiloCaduto(
          inLingua(
            it: 'il filo non è aperto',
            en: 'the connection is not open',
          ),
        ),
      );
    }
    final id = _prossimoId++;
    final chiAspetta = Completer<Map<String, dynamic>>();
    _inAttesa[id] = chiAspetta;
    _manda({...comando, 'id': id});

    /* Una richiesta senza risposta non resta appesa per sempre: Home Assistant
     * puo' non rispondere a un comando che non conosce, e senza questa
     * scadenza l'app aspetterebbe fino alla prossima caduta del filo. */
    return chiAspetta.future.timeout(
      entro ?? attesaDellaRisposta,
      onTimeout: () {
        _inAttesa.remove(id);
        throw const FiloCaduto('Home Assistant non ha risposto in tempo');
      },
    );
  }

  /// Il risultato del comando, gia' spacchettato.
  Future<dynamic> risultato(
    Map<String, dynamic> comando, {
    Duration? entro,
  }) async => (await chiedi(comando, entro: entro))['result'];

  /// La risposta a un comando **come e' arrivata**: il testo, senza aprirlo.
  ///
  /// Serve a chi se la apre da solo, e altrove. Un file della plancia e' un
  /// JSON con dentro un megabyte di base64: aprirlo qui vuol dire costruirne
  /// una copia sul filo che disegna lo schermo, e poi un'altra copia per i
  /// byte, e un'altra ancora per i byte scompattati. Tutta roba da buttare
  /// subito dopo — e buttarla, quando ce n'e' tanta, e' un decimo di secondo
  /// di schermo fermo.
  Future<String> testoDi(Map<String, dynamic> comando, {Duration? entro}) {
    if (!dentro) {
      return Future.error(
        FiloCaduto(
          inLingua(
            it: 'il filo non è aperto',
            en: 'the connection is not open',
          ),
        ),
      );
    }
    final aspetta = Completer<String>();
    late final int id;
    id = instrada(comando, (risposta) {
      if (aspetta.isCompleted) return;
      dimentica(id);
      if (risposta.successo == false) {
        final male = risposta.detto['error'];
        aspetta.completeError(
          ComandoRifiutato(
            (male is Map ? male['message'] as String? : null) ??
                'Home Assistant ha rifiutato il comando',
            codice: male is Map ? male['code'] as String? : null,
          ),
        );
        return;
      }
      aspetta.complete(risposta.testo);
    });
    return aspetta.future.timeout(
      entro ?? attesaDellaRisposta,
      onTimeout: () {
        dimentica(id);
        throw const FiloCaduto('Home Assistant non ha risposto in tempo');
      },
    );
  }

  /// Si sottoscrive, e resta sottoscritto anche dopo una caduta del filo.
  ///
  /// Chiudere lo stream che torna dice a Home Assistant di smettere.
  Future<Stream<Map<String, dynamic>>> sottoscrivi(
    Map<String, dynamic> comando,
  ) async {
    final risposta = await chiedi(comando);
    final id = risposta['id'] as int;
    final sottoscritta = _Sottoscrizione(
      comando: comando,
      uscita: StreamController.broadcast(),
    );
    _sottoscrizioni[id] = sottoscritta;
    sottoscritta.uscita.onCancel = () async {
      if (sottoscritta.uscita.hasListener) return;
      _sottoscrizioni.remove(id);
      if (dentro) {
        /* Un `unsubscribe_events` su un filo caduto non serve a niente, e la
         * sua risposta non arriverebbe mai. */
        unawaited(
          chiedi({'type': 'unsubscribe_events', 'subscription': id})
              .catchError((_) => <String, dynamic>{}),
        );
      }
      await sottoscritta.uscita.close();
    };
    return sottoscritta.uscita.stream;
  }

  /// Dopo una riconnessione Home Assistant non si ricorda di niente: le
  /// sottoscrizioni si rifanno, e prendono un numero nuovo.
  void _rifaiLeSottoscrizioni() {
    if (_sottoscrizioni.isEmpty) return;
    final vecchie = Map<int, _Sottoscrizione>.from(_sottoscrizioni);
    _sottoscrizioni.clear();
    for (final sottoscritta in vecchie.values) {
      chiedi(sottoscritta.comando).then(
        (risposta) => _sottoscrizioni[risposta['id'] as int] = sottoscritta,
        onError: (Object errore) {
          if (!sottoscritta.uscita.isClosed) {
            sottoscritta.uscita.addError(errore);
          }
        },
      );
    }
  }

  /* ─── Per conto di qualcun altro ───────────────────────────────────────── */

  /// Manda un messaggio per conto di qualcun altro, e consegna a [ricevi]
  /// tutto quello che torna con quel numero: la risposta, e gli eventi se era
  /// una sottoscrizione.
  ///
  /// Serve alla plancia vera, che dentro il WebView parla Home Assistant per
  /// conto suo: i suoi messaggi passano da qui col numero **del filo** — Home
  /// Assistant vuole numeri sempre crescenti su un filo, e due contatori non
  /// possono spartirsene uno — e chi li ha mandati li rivede col numero suo.
  /// Il numero torna, e vale finche' qualcuno non lo [dimentica] o il filo
  /// non cade: dopo una caduta Home Assistant non si ricorda di niente, e
  /// chi aveva chiesto deve ricominciare da capo, come farebbe da solo.
  int instrada(
    Map<String, dynamic> messaggio,
    void Function(Instradato risposta) ricevi,
  ) {
    if (!dentro) {
      throw FiloCaduto(
        inLingua(it: 'il filo non è aperto', en: 'the connection is not open'),
      );
    }
    final id = _prossimoId++;
    _instradati[id] = ricevi;
    _manda({...messaggio, 'id': id});
    return id;
  }

  /// Smette di consegnare quello che torna con quel numero.
  void dimentica(int id) => _instradati.remove(id);

  void _manda(Map<String, dynamic> cosa) {
    final presa = _presa;
    if (presa == null) return;
    try {
      presa.manda(jsonEncode(cosa));
      _messaggiMandati += 1;
    } catch (_) {
      _caduto('non riesco a scrivere sul filo');
    }
  }

  /* ─── Il battito ───────────────────────────────────────────────────────── */

  void _cominciaABattere() {
    _smettiDiBattere();
    _vistoIl = DateTime.now();
    _rispondeAiColpetti = null;
    _colpetti = Timer.periodic(battito, (_) => _colpetto());
  }

  void _colpetto() {
    if (!dentro) return;
    final ultimo = _vistoIl;
    final zitta =
        ultimo != null && DateTime.now().difference(ultimo) > silenzioMassimo;

    /* Prima di poter dire che un filo e' morto bisogna sapere che dall'altra
     * parte i colpetti li rimandano indietro. Home Assistant lo fa da sempre —
     * `ping` e `pong` sono suoi — ma una casa che non lo facesse non e' una
     * casa morta, e buttare giu' un filo che funziona sarebbe peggio del
     * guasto che si sta cercando di prevenire. */
    if (_rispondeAiColpetti == null) {
      if (!zitta) {
        _colpo();
        return;
      }
      _rispondeAiColpetti = false;
      return;
    }
    if (_rispondeAiColpetti == false) return;

    if (zitta) {
      /* Sembra aperto e non lo e'. Si chiude di mano nostra: e' la chiusura
       * che fa ripartire la ribussata, e senza questa l'app resterebbe a
       * mostrare dati vecchi credendosi collegata. */
      _caduto('nessuna risposta ai colpetti');
      return;
    }
    _colpo();
  }

  /* E' il `ping` di Home Assistant: il ponte si presenta come lei, quindi e'
   * lo stesso colpetto puntati a un ponte o puntati a una casa. */
  void _colpo() => _manda({'id': _prossimoId++, 'type': 'ping'});

  /// L'app e' tornata in primo piano: si guarda subito se il filo e' vivo.
  ///
  /// Un telefono messo in tasca non chiude niente: il sistema gli sospende
  /// la rete, e il socket resta li', aperto in apparenza e morto in realta'.
  /// Senza questo, al ritorno l'app restava a guardare una plancia ferma
  /// finche' il battito — un colpetto ogni trenta secondi, novanta di
  /// pazienza — non si decideva a dirlo: fino a due minuti di «lentissima».
  /// Qui si manda un colpetto subito e si aspetta [pazienzaAlRisveglio]: o
  /// arriva qualcosa, o si chiude e si ribussa. E se il filo stava gia'
  /// aspettando il suo turno per ribussare, ribussa adesso.
  void sveglia() {
    if (_spentoApposta) return;
    if (dentro) {
      if (_rispondeAiColpetti == false) return;
      _colpo();
      _controlloAlRisveglio?.cancel();
      final da = DateTime.now();
      _controlloAlRisveglio = Timer(pazienzaAlRisveglio, () {
        _controlloAlRisveglio = null;
        final visto = _vistoIl;
        if (dentro && (visto == null || !visto.isAfter(da))) {
          _caduto('il filo era morto mentre l\'app dormiva');
        }
      });
      return;
    }
    /* Non dentro. Si riparte **subito**, e da zero: chi ha appena ripreso in
     * mano il telefono non deve aspettare mezzo minuto perche' i tentativi
     * di prima avevano allungato l'attesa. E se una bussata era rimasta
     * appesa — la presa che non si apre e non fallisce — si lascia perdere e
     * se ne comincia un'altra: e' l'unico modo di uscirne, perche' quella
     * non tornera' mai da sola. */
    final da = _bussataDa;
    final staProvandoDaPoco =
        da != null &&
        DateTime.now().difference(da) < pazienzaAlRisveglio &&
        _riprova == null;
    if (staProvandoDaPoco) return;
    _riprova?.cancel();
    _riprova = null;
    _tentativi = 0;
    unawaited(_bussa());
  }

  void _smettiDiBattere() {
    _colpetti?.cancel();
    _colpetti = null;
  }

  /* ─── Quando cade ──────────────────────────────────────────────────────── */

  /// Se quello che e' andato storto e' «il telefono non ha rete», non «la
  /// casa non risponde».
  ///
  /// Sono due cose diverse con due rimedi diversi, e finora finivano nello
  /// stesso mucchio. Il sistema le dice sempre con le stesse parole, e sono
  /// queste.
  static bool laReteNonCEAncora(Object errore) {
    final detto = '$errore'.toLowerCase();
    return detto.contains('failed host lookup') ||
        detto.contains('no address associated with hostname') ||
        detto.contains('network is unreachable') ||
        detto.contains('nodename nor servname provided') ||
        detto.contains('temporary failure in name resolution');
  }

  /// La rete non c'e' ancora: si riprova fra un attimo, e non e' una caduta.
  ///
  /// Dopo mezz'ora in tasca il telefono e' in Doze: quando si riprende in mano
  /// la radio ci mette un secondo a tornare su, e in quel secondo qualunque
  /// indirizzo non si risolve. Contarlo come caduta faceva due danni: la
  /// prossima attesa raddoppiava — proprio quando bastava aspettare un attimo
  /// — e in «Come va l'app» restavano scritti errori di sistema che non
  /// dicono niente a chi li legge.
  ///
  /// Dopo [quantiTentativiAFreddo] tentativi la rete davvero non c'e', e
  /// allora e' una caduta come le altre.
  void _senzaRete(Object errore) {
    _aFreddo += 1;
    if (_aFreddo > quantiTentativiAFreddo) {
      _aFreddo = 0;
      _caduto('$errore');
      return;
    }
    _smettiDiBattere();
    _stacca();
    _cambia(StatoDelFilo.chiamando);
    _riprova?.cancel();
    _riprova = Timer(attesaAFreddo, () {
      if (_spentoApposta) return;
      unawaited(_bussa());
    });
  }

  /* Lo dice adesso a chi sta aspettando di entrare.
   *
   * `apri` non e' una rotella che gira: e' una domanda. Quando l'altra punta
   * la risposta l'ha gia' data — «questa casa adesso non e' collegata», che
   * dice il centralino quando l'add-on non gli e' attaccato — tenersela per
   * venticinque secondi e poi rispondere con la **nostra** scadenza («gdahome
   * in casa non risponde») e' due volte sbagliato: si fa aspettare per
   * niente, e poi si dice un'altra cosa. Il centralino ha risposto benissimo;
   * e' la casa che non c'e'.
   *
   * Solo al primo giro, come per gli indirizzi che non rispondono: dal
   * secondo in poi chi aspettava ha gia' avuto la sua risposta. E i tentativi
   * vanno avanti da soli — una casa che si riattacca al centralino riapre il
   * filo, e lo schermo si sistema senza che nessuno tocchi niente.
   *
   * Si risponde solo con un [ErroreDelPonte], cioe' con un perche' che viene
   * da qualcuno che lo sa. Per un errore qualunque — una presa che non si apre
   * per un motivo che nessuno ha spiegato — si tace e si riprova: quasi sempre
   * il giro dopo va, e far fallire l'attesa vorrebbe dire mandare a schermo un
   * errore tecnico al posto di un collegamento che stava per riuscire. */
  void _rispondiAChiAspetta(ErroreDelPonte errore) {
    final stretta = _stretta;
    if (stretta == null || stretta.isCompleted) return;
    stretta.completeError(errore);
  }

  void _caduto(String perche) {
    /* Un filo chiuso **apposta** non e' una caduta, e non va fra le cadute.
     *
     * Quando l'app non e' davanti il filo si chiude da se' — e' voluto, ed e'
     * quello che non tiene una casa aperta in tasca per niente. Solo che
     * chiudere una presa fa scattare il suo `onDone`, che arriva qui, e finiva
     * contato insieme alle cadute vere: nella diagnostica si leggeva «caduto 1
     * volte: il filo si e' chiuso» sotto «app messa da parte 1 volte», cioe' la
     * stessa cosa scritta due volte, una delle quali come guasto. Chi guarda
     * quel pannello per capire se qualcosa non va si mette a inseguire un
     * fantasma. */
    if (!_spentoApposta) {
      _cadute += 1;
      _ultimaCaduta = perche;
      _cadutoIl = DateTime.now();
      _ultimeCadute.add(perche);
      if (_ultimeCadute.length > quanteCaduteSiTengono) {
        _ultimeCadute.removeAt(0);
      }
    }
    _smettiDiBattere();
    _stacca();
    /* Le richieste in volo muoiono: la loro risposta non arrivera' mai. Ma chi
     * sta aspettando di *entrare* no — il filo sta per ribussare, e se
     * riesce quella attesa si scioglie da sola. Farla fallire a ogni caduta
     * vorrebbe dire che un telefono che si riconnette da solo risulta comunque
     * fallito a chi aveva chiamato `apri`. */
    _faFallireLeRichieste(FiloCaduto(perche), ancheLaStretta: false);
    if (_spentoApposta) {
      _cambia(StatoDelFilo.spento);
      return;
    }
    _cambia(StatoDelFilo.chiamando);

    final quanto = _quantoAspettare();
    _tentativi += 1;

    _riprova?.cancel();
    _riprova = Timer(quanto, () {
      if (_spentoApposta) return;
      unawaited(_bussa());
    });
  }

  /// Quanto si aspetta prima del prossimo tentativo.
  ///
  /// Raddoppia a ogni buca — un secondo, due, quattro — e si ferma alla
  /// [attesaMassima]. Il caso dentro non e' un vezzo: senza, tutti i telefoni
  /// di casa ribussano nello stesso millesimo dopo un riavvio del router, e il
  /// ponte prende una martellata invece di qualche richiesta.
  Duration _quantoAspettare() {
    final quanto = min(
      attesaMassima.inMilliseconds,
      1000 * (1 << min(_tentativi, 5)),
    );
    return Duration(
      milliseconds: quanto ~/ 2 + Random().nextInt(quanto ~/ 2 + 1),
    );
  }

  /// Il segno non vale: non si riprova, perche' non cambierebbe niente.
  void _segnoNonVale(String perche) {
    _spentoApposta = true;
    _stacca();
    final errore = SegnoRifiutato(perche);
    _faFallireLeRichieste(errore);
    if (_stretta != null && !_stretta!.isCompleted) {
      _stretta!.completeError(errore);
    }
    _cambia(StatoDelFilo.spento);
  }

  void _faFallireLeRichieste(
    ErroreDelPonte errore, {
    bool ancheLaStretta = true,
  }) {
    /* Chi aveva mandato per conto suo non riceve un errore: riceve niente,
     * e vede il filo cadere — e' cosi' che se ne accorge Home Assistant, ed
     * e' cosi' che se ne deve accorgere lui. */
    _instradati.clear();
    final appese = List.of(_inAttesa.values);
    _inAttesa.clear();
    for (final chiAspetta in appese) {
      if (!chiAspetta.isCompleted) chiAspetta.completeError(errore);
    }
    if (!ancheLaStretta) return;
    final stretta = _stretta;
    if (stretta != null && !stretta.isCompleted) stretta.completeError(errore);
  }

  void _stacca() {
    _generazione += 1;
    _controlloAlRisveglio?.cancel();
    _controlloAlRisveglio = null;
    _approdo = null;
    _ascolto?.cancel();
    _ascolto = null;
    unawaited(_presa?.chiudi() ?? Future<void>.value());
    _presa = null;
  }

  void _cambia(StatoDelFilo nuovo) {
    if (_adesso == nuovo) return;
    _adesso = nuovo;
    if (!_stato.isClosed) _stato.add(nuovo);
  }

  /// Chiude il filo e non riprova piu'.
  Future<void> chiudi() async {
    _spentoApposta = true;
    _riprova?.cancel();
    _riprova = null;
    _stacca();
    _faFallireLeRichieste(
      FiloCaduto(
        inLingua(it: 'il filo è stato chiuso', en: 'the connection was closed'),
      ),
    );
    /* Prima si prende la lista e si svuota la mappa, poi si chiude.
     * Chiudere una sottoscrizione fa scattare il suo `onCancel`, che si toglie
     * dalla mappa: farlo mentre la si sta scorrendo la rompe a meta'. */
    final aperte = List.of(_sottoscrizioni.values);
    _sottoscrizioni.clear();
    for (final sottoscritta in aperte) {
      if (!sottoscritta.uscita.isClosed) await sottoscritta.uscita.close();
    }
    _cambia(StatoDelFilo.spento);
    await _stato.close();
  }
}

class _Sottoscrizione {
  _Sottoscrizione({required this.comando, required this.uscita});
  final Map<String, dynamic> comando;
  final StreamController<Map<String, dynamic>> uscita;
}

/// Quello che torna a chi aveva instradato un messaggio: i byte cosi' come
/// sono arrivati — col numero del filo — e quel poco che si legge dalla testa
/// senza aprirli tutti.
///
/// **Byte e non testo.** Un messaggio instradato e' roba della plancia: passa
/// da qui, si rinumera, e si scrive nel WebSocket verso la pagina, che byte
/// vuole. Farne una stringa in mezzo vorrebbe dire allocarla, rinumerarla —
/// un'altra stringa — e poi codificarla in UTF-8 scrivendola: tre copie di
/// un'istantanea di telecamera per ogni istantanea, e con sette telecamere
/// che si fanno fotografare sono megabyte da buttare al minuto. Chi il testo
/// lo vuole davvero ha [testo], e paga lui.
class Instradato {
  Instradato._(this.byte, _Testa testa)
    : id = testa.id,
      tipo = testa.tipo,
      successo = testa.successo,
      _dopoIlNumero = testa.dopoIlNumero,
      _detto = null;

  Instradato._daMappa(Map<String, dynamic> detto)
    : byte = inByte(jsonEncode(detto)),
      id = detto['id'] as int,
      tipo = detto['type'] as String?,
      successo = detto['success'] as bool?,
      _dopoIlNumero = null,
      _detto = detto;

  /// Il messaggio, byte, col numero del filo.
  final Uint8List byte;

  /// Il numero del filo.
  final int id;

  /// `result`, `event`, `pong`…
  final String? tipo;

  /// Per un `result`: se e' andata.
  final bool? successo;

  final int? _dopoIlNumero;
  final Map<String, dynamic>? _detto;

  /// Il messaggio come testo. Costa una copia: chi puo' fare coi byte la
  /// lasci stare.
  String get testo => utf8.decode(byte);

  /// Il messaggio aperto. Costa quanto aprirlo: chi puo' fare coi byte lo
  /// lasci stare.
  Map<String, dynamic> get detto =>
      _detto ?? _daByteAlJson.convert(byte) as Map<String, dynamic>;

  /// Lo stesso messaggio, col numero di chi l'aveva chiesto al posto di
  /// quello del filo. Il numero sta in testa, e si cambia solo quello.
  ///
  /// **Una copia sola, non tre.** Prima era una `replaceRange` su una
  /// stringa: e quella stringa, per esserci, era stata costruita dai byte
  /// decifrati e copiata da un isolato all'altro, e dopo di qui sarebbe stata
  /// ricodificata in UTF-8 per entrare nel socket. Su un `get_states` da un
  /// megabyte e mezzo sono quattro megabyte e mezzo di roba da buttare per un
  /// messaggio. Non e' tempo speso in un lavoro — un megabyte si copia in
  /// pochi millesimi — e' **roba da buttare** che si accumula, e i decimi di
  /// secondo si pagano dopo, quando il raccoglitore passa. E si pagano sul
  /// filo che disegna.
  ///
  /// Qui ne resta una: un blocco di byte nuovo, la testa nuova davanti e il
  /// resto dietro. Ed e' l'ultima — quello che esce da qui si scrive nel
  /// socket com'e'.
  Uint8List conNumero(int altro) {
    final dopo = _dopoIlNumero;
    if (dopo != null) {
      if (altro == id) return byte;
      return Lavori.io.subito('rinumerati per la plancia', () {
        final testa = inByte('{"id": $altro');
        final quanti = byte.length - dopo;
        return Uint8List(testa.length + quanti)
          ..setRange(0, testa.length, testa)
          ..setRange(testa.length, testa.length + quanti, byte, dopo);
      });
    }
    return inByte(jsonEncode({...detto, 'id': altro}));
  }
}

/// Byte da una stringa. Un nome per una cosa che si scrive in mezza riga, ma
/// che si fa in cinque posti e in tutti e cinque vuol dire la stessa cosa.
Uint8List inByte(String testo) => utf8.encode(testo);

/* La testa di un messaggio di Home Assistant: `{"id": 5, "type": "result",
 * "success": true, …}`. Home Assistant e il ponte scrivono cosi' — il numero
 * per primo, poi il tipo — e chi arriva qui fatto diversamente si legge per
 * intero, come sempre. */
class _Testa {
  const _Testa(this.id, this.tipo, this.successo, this.dopoIlNumero);

  final int id;
  final String tipo;
  final bool? successo;
  final int dopoIlNumero;

  static final _forma = RegExp(
    r'^\{\s*"id"\s*:\s*(\d+)(\s*,\s*"type"\s*:\s*"([a-z_]+)"(?:\s*,\s*"success"\s*:\s*(true|false))?)',
  );

  /// Quanti byte si guardano in testa. La parte che serve —
  /// `{"id": 12345, "type": "result", "success": true` — sta dentro sessanta;
  /// il doppio lascia spazio a un numero lungo e a un po' di spazi, e resta
  /// una stringa da niente anche se il messaggio e' un megabyte. Quello che
  /// non ci sta dentro si legge per intero, come qualunque altra testa fatta
  /// diversamente.
  static const int quantoSiGuarda = 128;

  /// La testa, letta dai **byte**.
  ///
  /// Si fa una stringa del solo prefisso, e `String.fromCharCodes` la fa un
  /// byte per carattere: e' esatto perche' la parte che si guarda e' ASCII —
  /// graffa, virgolette, cifre, lettere minuscole — e un byte fuori dall'ASCII
  /// li' dentro fa solo fallire il confronto, che e' quello che deve fare.
  static _Testa? leggi(Uint8List grezzo) {
    final finestra = grezzo.length <= quantoSiGuarda
        ? grezzo
        : Uint8List.sublistView(grezzo, 0, quantoSiGuarda);
    final trovato = _forma.matchAsPrefix(String.fromCharCodes(finestra));
    if (trovato == null) return null;
    /* La finestra e' finita mentre la testa continuava: quello che si e'
     * letto puo' essere una testa **tagliata** — un `"success": tru` che
     * finisce sul bordo si legge come un messaggio senza `success` — e una
     * testa tagliata e' peggio di nessuna testa. Si legge tutto, come
     * qualunque messaggio fatto diversamente. */
    if (trovato.end >= finestra.length && grezzo.length > finestra.length) {
      return null;
    }
    final id = int.tryParse(trovato.group(1)!);
    if (id == null) return null;
    final successo = trovato.group(4);
    return _Testa(
      id,
      trovato.group(3)!,
      successo == null ? null : successo == 'true',
      trovato.end - trovato.group(2)!.length,
    );
  }
}
