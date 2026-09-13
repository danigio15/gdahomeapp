/// Il collegamento: una casa alla volta, aperta.
///
/// E' il pezzo che tiene insieme tutti gli altri, e l'unico che le schermate
/// devono conoscere. Sa quale casa e' attiva, sa trovarla — dentro o fuori —
/// sa tenerne il filo aperto, e sa passare a un'altra casa buttando giu' la
/// prima.
///
/// Due decisioni che stanno qui e non altrove:
///
///  - **la sonda si chiama a ogni tentativo del filo**, non una volta
///    all'apertura. E' cosi' che uscire di casa funziona senza toccare niente:
///    il filo cade sull'indirizzo di rete locale, ribussa, e questa volta la
///    sonda risponde con l'indirizzo di fuori;
///  - **dove si e' approdati si scrive nell'archivio**, cosi' la prossima
///    apertura prova per primo quello giusto invece di aspettare a vuoto un
///    indirizzo che non c'e'.
///
/// Niente Flutter qui dentro: si prova per intero senza schermo.
library;

import 'dart:async';

import '../plancia/pannello.dart';
import '../ponte/errori.dart';
import '../ponte/filo.dart';
import '../ponte/indirizzo.dart';
import '../ponte/presa.dart';
import '../ponte/sonda.dart';
import 'archivio_delle_case.dart';
import 'casa_conosciuta.dart';
import 'stato_della_casa.dart';

enum ComeVa {
  /// Nessuna casa: bisogna abbinarne una.
  nessunaCasa,

  /// Sta cercando la casa, o sta bussando.
  inCammino,

  /// Dentro: il filo e' aperto e la casa risponde.
  aperta,

  /// Il segno non vale piu': questa casa va riabbinata.
  segnoScaduto,

  /// Non si raggiunge, ma si continua a provare.
  irraggiungibile,
}

class Collegamento {
  Collegamento({required this.archivio, Sonda? sonda, this.apriLaPresa})
    : _sonda = sonda ?? const Sonda();

  final ArchivioDelleCase archivio;
  final Sonda _sonda;

  /// Come si apre il filo nudo, sotto la cifratura. Sostituibile nelle prove.
  final ApriLaPresa? apriLaPresa;

  final _cambiamenti = StreamController<void>.broadcast();
  final _entitaCambiate = StreamController<void>.broadcast();

  /* La configurazione della plancia e' cambiata da qui dentro l'app.
   *
   * La plancia gira in un riquadro, ed e' una pagina web: non ha modo di
   * accorgersi che qualcuno le ha riscritto la configurazione da fuori — la
   * legge una volta, all'avvio. Chi la cambia lo dice qui, e la schermata
   * della plancia si ricarica. Senza, si salvava una luce e la si vedeva
   * comparire solo alla riapertura dell'app: due minuti buoni a chiedersi se
   * il salvataggio avesse funzionato. */
  final _planciaCambiata = StreamController<void>.broadcast();

  Filo? _filo;
  StatoDellaCasa? _stato;
  PannelloDellaPlancia? _pannello;
  bool _pannelloLetto = false;

  /* Se in questa casa le plance ci sono ma nessuna e' per questa utenza.
   *
   * Va tenuto separato da «non c'e' la plancia»: sono due cose diverse e si
   * risolvono in due modi diversi, e una schermata che le confonde manda chi
   * legge ad aggiornare l'add-on quando invece deve chiedere a chi amministra
   * la casa. */
  bool _nessunaPerMe = false;
  CasaConosciuta? _casa;
  DaDove? _daDove;
  ComeVa _comeVa = ComeVa.nessunaCasa;
  String? _perche;
  bool _avviato = false;
  StreamSubscription<StatoDelFilo>? _guardaIlFilo;
  StreamSubscription<void>? _guardaLaCasa;

  /// Scatta a ogni cambiamento: chi disegna ridisegna.
  Stream<void> get cambiamenti => _cambiamenti.stream;

  /// Le entita' della casa sono cambiate: una luce, un sensore, un contatore.
  ///
  /// Sta su un canale suo, separato da [cambiamenti], apposta: [cambiamenti]
  /// lo ascolta la radice dell'app, che a ogni avviso ridisegna tutto, e
  /// ridisegnare tutto a ogni sensore che cambia e' quello che faceva andare
  /// l'app a scatti. Qui si mette in ascolto solo chi le entita' le mostra.
  Stream<void> get entitaCambiate => _entitaCambiate.stream;

  /// Qualcuno ha riscritto la configurazione della plancia: chi la mostra la
  /// ricarichi.
  ///
  /// Serviva quando la Config era una schermata dell'app: si salvava di qua e
  /// la pagina di la' non ne sapeva niente. Adesso la Config e' quella della
  /// plancia, dentro la pagina: si salva e si ridisegna da se', e questo
  /// avviso non lo manda piu' nessuno. Resta perche' e' il posto dove
  /// arriverebbe una configurazione cambiata da **un altro** telefono, il
  /// giorno che il ponte la spingera'.
  Stream<void> get planciaCambiata => _planciaCambiata.stream;

  /// Quanto e' passato sul filo da quando si e' entrati, in due parole. Per
  /// la diagnostica: dice se una casa e' silenziosa o un fiume in piena.
  String? get traffico => _filo?.traffico;

  /// Le ultime cadute del filo, col loro perche', dalla piu' recente.
  List<String> get ultimeCadute => _filo?.ultimeCadute ?? const [];

  /// L'app e' tornata in primo piano: il filo si controlla subito, invece di
  /// aspettare il battito.
  /// L'app e' tornata davanti: si controlla il filo, o lo si riapre se era a
  /// riposo.
  void sveglia() {
    if (_aRiposo) {
      _aRiposo = false;
      unawaited(apri(forza: true));
      return;
    }
    _filo?.sveglia();
  }

  /// L'app e' andata via da un pezzo: **si chiude il filo**.
  ///
  /// Non e' un risparmio di batteria: e' un risparmio di **richieste**. Da
  /// fuori casa il filo passa dal centralino, e li' ogni messaggio e' una
  /// richiesta contata — centomila al giorno, sul piano gratuito. Una casa
  /// vera manda cinque eventi al secondo, e li mandava anche con l'app in
  /// tasca o con la scheda del browser nascosta dietro le altre: ore di
  /// eventi che nessuno stava guardando, pagati come quelli guardati.
  ///
  /// Chi lo chiama aspetta un po' prima (`main.dart`): un'app che si guarda
  /// per due secondi e torna non deve rifare la strada da capo.
  Future<void> riposa() async {
    if (!_avviato || _filo == null || _aRiposo) return;
    _aRiposo = true;
    await _chiudiIlFilo();
    _vai(ComeVa.inCammino);
  }

  /// Se il filo e' chiuso perche' l'app non e' davanti. Diverso da «caduto»:
  /// qui non si riprova, si aspetta che qualcuno torni a guardare.
  bool get aRiposo => _aRiposo;
  bool _aRiposo = false;

  ComeVa get comeVa => _comeVa;
  String? get perche => _perche;
  CasaConosciuta? get casa => _casa;
  StatoDellaCasa? get stato => _stato;
  Filo? get filo => _filo;

  /// Il pannello di DashboardModern in questa casa: dove stanno i file della
  /// plancia vera. `null` finche' non si e' chiesto, o per sempre se
  /// DashboardModern non c'e': [pannelloLetto] distingue i due casi.
  PannelloDellaPlancia? get pannello => _pannello;
  bool get pannelloLetto => _pannelloLetto;

  /// `true` quando la casa ha delle plance e nessuna e' di chi guarda.
  bool get nessunaPlanciaPerMe => _nessunaPerMe;

  /// Le plance di questa casa: piu' d'una per chi se n'e' aggiunta.
  ///
  /// Arrivano insieme a dove sta la plancia, e vuota vuol dire un ponte che
  /// non le sa tenere: allora di plancia ce n'e' una, com'e' sempre stato.
  List<UnaPlancia> get plance => _pannello?.plance ?? const [];

  /// Quale si sta guardando, per chi ne ha piu' d'una. Vuoto vuol dire la
  /// prima, che e' la risposta di sempre.
  String get planciaScelta => _pannello?.profilo ?? '';

  /// Da dove si sta passando adesso: serve a scrivere «in casa» o «da fuori».
  DaDove? get daDove => _daDove;

  bool get dentro => _filo?.dentro ?? false;

  /// `true` da quando [apri] e' stata chiamata almeno una volta.
  ///
  /// Serve a chi disegna: il collegamento si avvia una volta sola, e dopo si
  /// gestisce da solo. Riavviarlo a ogni ricostruzione della schermata
  /// vorrebbe dire buttare giu' il filo ogni volta che gira lo schermo.
  bool get avviato => _avviato;

  /// Apre la casa attiva dell'archivio. Da chiamare all'avvio e dopo ogni
  /// cambio di casa.
  ///
  /// Chiamarla su una casa gia' aperta **non fa niente**: chi disegna la puo'
  /// chiamare senza pensarci, e un filo che funziona non viene buttato giu' e
  /// rifatto per niente. Con [forza] si rifa' comunque tutto — e' quello che
  /// vuole il gesto di tirare giu' per aggiornare.
  Future<void> apri({bool forza = false}) async {
    _avviato = true;
    _aRiposo = false;
    if (!forza &&
        _comeVa == ComeVa.aperta &&
        dentro &&
        _casa != null &&
        _casa!.id == archivio.attiva?.id) {
      return;
    }
    await _chiudiIlFilo();

    final casa = archivio.attiva;
    _casa = casa;
    _daDove = null;
    _perche = null;

    if (casa == null) {
      _vai(ComeVa.nessunaCasa);
      return;
    }

    /* Una casa abbinata prima che esistessero le chiavi non parla piu' con
     * nessun ponte: si dice, invece di far girare una rotella per sempre. */
    if (casa.daRiabbinare || !casa.raggiungibile) {
      _perche = casa.daRiabbinare
          ? 'Questa casa e\' stata abbinata con una versione vecchia dell\'app: '
                'riabbinala: e\' un quadretto da inquadrare.'
          : 'Non so piu\' dove sia «${casa.nome}»: riabbinala.';
      _vai(ComeVa.segnoScaduto);
      return;
    }

    _vai(ComeVa.inCammino);

    final filo = Filo(
      approdo: () => _trova(casa),
      segno: casa.segno,
      chi: casa.identificativo!,
      chiave: casa.chiave!,
      apri: apriLaPresa,
    );
    _filo = filo;

    _guardaIlFilo = filo.stato.listen((stato) {
      if (stato == StatoDelFilo.dentro) {
        /* **Ed e' tornato su.**
         *
         * Qui prima non c'era niente, e si guardava solo la discesa: caduto
         * il filo si diceva «sto cercando la casa», e quando il filo si
         * rialzava da solo — cosa che fa, da solo, ed e' tutto il punto —
         * nessuno lo rimetteva a posto. L'app restava a cercare una casa che
         * intanto le stava mandando sessanta eventi in quindici secondi: la
         * plancia dentro il riquadro funzionava, e la riga sopra diceva di
         * no. La prima volta ci pensa `_leggiLaCasa`, e infatti il difetto
         * si vedeva solo dalla seconda in poi — cioe' ogni volta che si
         * riprendeva in mano il telefono. */
        if (_stato != null && _comeVa != ComeVa.aperta) {
          _perche = null;
          _vai(ComeVa.aperta);
          /* Mentre si era via la plancia puo' essere cambiata, o non essere
           * mai stata letta. */
          if (!_pannelloLetto) unawaited(_leggiLaPlancia(filo));
        }
        return;
      }
      if (_comeVa == ComeVa.aperta) {
        /* Caduto: si resta sulla casa, si dice che si sta ricollegando, e i
         * dati vecchi restano a schermo invece di sparire. */
        _vai(ComeVa.inCammino);
      }
    });

    try {
      await filo.apri();
    } on SegnoRifiutato catch (errore) {
      _perche = errore.spiegazione;
      _vai(ComeVa.segnoScaduto);
      return;
    } on ErroreDelPonte catch (errore) {
      /* I tentativi vanno avanti da soli: quando il telefono rientra sotto una
       * rete che vede la casa, il filo si apre e lo stato si sistema. */
      _perche = errore.spiegazione;
      _vai(ComeVa.irraggiungibile);
      _riprendiQuandoTorna(filo);
      return;
    }

    await _leggiLaCasa(filo);
  }

  Future<void> _leggiLaCasa(Filo filo) async {
    final stato = StatoDellaCasa(filo);
    _stato = stato;
    _casaChiesta = false;
    _guardaLaCasa = stato.cambiamenti.listen((_) {
      if (!_entitaCambiate.isClosed) _entitaCambiate.add(null);
    });
    _vai(ComeVa.aperta);
    /* La plancia parte subito: e' lei la home, e sapere dove sta e' una
     * domanda sola. Le entita' — tutte, con i loro eventi — si leggono solo
     * quando qualcuno le vuole, vedi [serveLaCasa]. */
    await _leggiLaPlancia(filo);
  }

  bool _casaChiesta = false;

  /* In che stanza sta ogni entita' non si chiede piu'.
   *
   * Erano tre elenchi dai registri di Home Assistant, e servivano al
   * cercatore della Config rifatta in Flutter: chi configurava la
   * temperatura della cameretta cercava «cameretta», e quella parola stava
   * solo li'. Quella Config non c'e' piu' — c'e' la sua, dentro la plancia,
   * che i registri se li chiede da se' — e quei tre elenchi restavano
   * chiesti a ogni lettura delle entita' per riempire una mappa che nessuno
   * leggeva. */

  /// Le entita' della casa, quando servono davvero.
  ///
  /// Un `get_states` in una casa vera e' un megabyte e mezzo, e gli eventi
  /// che seguono sono decine al secondo: leggerli all'apertura del filo, e a
  /// ogni riconnessione, voleva dire tenere ferma la plancia — che intanto
  /// se li legge da sola, per conto suo — e raddoppiare il traffico. Li
  /// chiede l'elenco dei dispositivi quando si e' a schermo, la
  /// configurazione quando si apre, e da li' in poi restano aggiornati.
  /// Chiamarla due volte non costa niente.
  ///
  Future<void> serveLaCasa() async {
    final stato = _stato;
    if (stato == null || _casaChiesta) return;
    _casaChiesta = true;
    try {
      await stato.attacca();
    } on ErroreDelPonte catch (errore) {
      _casaChiesta = false;
      _perche = errore.spiegazione;
    }
    _avvisa();
  }

  /// Chiede alla casa dove sta la plancia.
  ///
  /// Un errore qui non e' un errore della casa: la casa e' aperta e le entita'
  /// ci sono. Si segna che si e' chiesto, e la schermata dice quello che sa.
  Future<void> _leggiLaPlancia(Filo filo, {String? profilo}) async {
    /* Quella scelta l'ultima volta in **questa** casa. Chi ne ha una sola non
     * ha mai scelto niente, e qui non c'e' scritto niente: si chiede la
     * prima, ed e' la domanda di sempre. */
    final voluto = profilo ?? _casa?.plancia ?? '';
    try {
      _pannello = await trovaLaPlancia(filo, profilo: voluto);
      _nessunaPerMe = false;
    } on NessunaPlanciaPerTe {
      /* Le plance ci sono, ma non per questa utenza. Non si cerca altrove e
       * non si apre niente: la schermata lo scrive. */
      _pannello = null;
      _nessunaPerMe = true;
    } on ErroreDelPonte {
      _pannello = null;
      _nessunaPerMe = false;
    }
    if (_filo != filo) return;
    _pannelloLetto = true;
    _avvisa();
  }

  /// Richiede alla casa dove sta la plancia: dopo un aggiornamento
  /// dell'integrazione, o quando si tira giu' per aggiornare.
  Future<void> rileggiLaPlancia() async {
    final filo = _filo;
    if (filo == null || !filo.dentro) return;
    await _leggiLaPlancia(filo);
  }

  /// Apre un'altra plancia di questa casa.
  ///
  /// La scelta si **ricorda**, e si ricorda per casa: chi ha una plancia al
  /// mare e una in citta' non vuole che cambiando casa gli resti quella di
  /// prima. Si scrive dopo aver letto, e solo se la plancia c'era davvero:
  /// ricordare una scelta che non ha funzionato vorrebbe dire riaprire ogni
  /// volta su un errore.
  Future<void> cambiaPlancia(String profilo) async {
    final filo = _filo;
    if (filo == null || !filo.dentro) return;
    if (profilo == planciaScelta) return;
    await _leggiLaPlancia(filo, profilo: profilo);
    final casa = _casa;
    if (casa == null) return;
    /* Quella che si e' aperta davvero, che non e' detto sia quella chiesta:
     * una plancia tolta da un altro telefono fa tornare alla prima. */
    final aperta = _pannello?.profilo ?? '';
    await archivio.segnaLaPlancia(
      casa.id,
      _pannello?.primario ?? true ? '' : aperta,
    );
    _casa = archivio.quella(casa.id) ?? casa;
    _planciaCambiata.add(null);
    _avvisa();
  }

  /// Quando il filo si rialza per conto suo, si riprende da dove si era
  /// rimasti invece di restare fermi su una schermata di errore.
  void _riprendiQuandoTorna(Filo filo) {
    _guardaIlFilo?.cancel();
    _guardaIlFilo = filo.stato.listen((stato) {
      if (stato != StatoDelFilo.dentro) return;
      if (_stato != null) return;
      unawaited(_leggiLaCasa(filo));
    });
  }

  /// Dove bussare adesso. Chiamata dal filo a ogni tentativo.
  Future<Approdo> _trova(CasaConosciuta casa) async {
    final approdo = await _sonda.dove(casa);
    _daDove = approdo.da;
    /* Si scrive solo quando cambia: il filo si riapre a ogni ascensore. */
    unawaited(archivio.segnaLApprodo(casa.id, approdo.da));
    _avvisa();
    return approdo;
  }

  /// Passa a un'altra casa: butta giu' il filo di questa e apre quello.
  Future<void> cambiaCasa(String id) async {
    if (_casa?.id == id && _comeVa == ComeVa.aperta) return;
    await archivio.scegli(id);
    await apri();
  }

  /// Toglie una casa. Se era quella aperta, apre quella che resta.
  Future<void> dimentica(String id) async {
    final eraQuesta = _casa?.id == id;
    await archivio.togli(id);
    if (eraQuesta) await apri();
    _avvisa();
  }

  Future<void> _chiudiIlFilo() async {
    await _guardaIlFilo?.cancel();
    await _guardaLaCasa?.cancel();
    _guardaIlFilo = null;
    _guardaLaCasa = null;
    await _stato?.stacca();
    _stato = null;
    _pannello = null;
    _pannelloLetto = false;
    _nessunaPerMe = false;
    await _filo?.chiudi();
    _filo = null;
    _daDove = null;
  }

  Future<void> chiudi() async {
    await _chiudiIlFilo();
    if (!_cambiamenti.isClosed) await _cambiamenti.close();
    if (!_entitaCambiate.isClosed) await _entitaCambiate.close();
    if (!_planciaCambiata.isClosed) await _planciaCambiata.close();
  }

  void _vai(ComeVa nuovo) {
    _comeVa = nuovo;
    _avvisa();
  }

  void _avvisa() {
    if (!_cambiamenti.isClosed) _cambiamenti.add(null);
  }
}
