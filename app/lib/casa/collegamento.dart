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

import '../licenza/licenza.dart';
import '../notifiche/notifiche.dart';
import '../licenza/ricevuta_da_fuori.dart';
import '../parole.dart';
import '../plancia/pannello.dart';
import '../ponte/abbinamento.dart' hide codicePulito;
import '../ponte/errori.dart';
import '../ponte/filo.dart';
import '../ponte/indirizzo.dart';
import '../ponte/parole_del_centralino.dart' show fuoriCasaServePremium;
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
  irraggiungibile;

  /// Come si dice a schermo, in «Come va l'app».
  ///
  /// Il nome della voce dell'enumerazione non si mostra: «segnoScaduto» e'
  /// buono per chi scrive il codice, non per chi legge lo schermo — e in
  /// inglese non sarebbe nemmeno inglese.
  String get nome => switch (this) {
    ComeVa.nessunaCasa => inLingua(it: 'nessuna casa', en: 'no home'),
    ComeVa.inCammino => inLingua(it: 'in cammino', en: 'on its way'),
    ComeVa.aperta => inLingua(it: 'aperto', en: 'open'),
    ComeVa.segnoScaduto => inLingua(
      it: 'da riabbinare',
      en: 'needs pairing again',
    ),
    ComeVa.irraggiungibile => inLingua(
      it: 'non si raggiunge',
      en: 'unreachable',
    ),
  };
}

class Collegamento {
  Collegamento({
    required this.archivio,
    Sonda? sonda,
    this.apriLaPresa,
    GestoreLicenza? licenza,
    this.attesaPerLaRicevuta = const Duration(seconds: 20),
    this.ogniQuantoLaLicenza = const Duration(hours: 6),
    this.ogniQuantoSiRiprovaDaFuori = const Duration(minutes: 10),
    this.consegnaAlCentralino,
  }) : _sonda = sonda ?? Sonda(),
       licenza = licenza ?? GestoreLicenza(),
       _licenzaMia = licenza == null {
    this.licenza.addListener(_avvisa);
  }

  final ArchivioDelleCase archivio;
  final Sonda _sonda;

  /// Quanto una ricevuta comprata fuori casa aspetta la strada del
  /// centralino prima di restare al negozio (`mandaLaRicevuta`).
  final Duration attesaPerLaRicevuta;

  /// Ogni quanto si richiede la licenza alla casa mentre il filo resta su:
  /// ogni sei ore, come la casa la richiede al quadro.
  final Duration ogniQuantoLaLicenza;

  /// Per quanto, dopo che una casa ha detto davvero di essere Base, non la
  /// si riprova da fuori per sentire se nel frattempo e' diventata Premium:
  /// vedi [_ProvaDaFuori]. Una bussata che non arriva alla casa non conta.
  final Duration ogniQuantoSiRiprovaDaFuori;

  /// Chi consegna al centralino la ricevuta di chi compra fuori casa: di
  /// serie una POST vera (`ricevuta_da_fuori.dart`), nelle prove una finta.
  final ConsegnaAlCentralino? consegnaAlCentralino;
  Timer? _rileggiLaLicenza;

  /// gdahome Premium: quale casa lo e', e cosa si apre (`licenza/`).
  ///
  /// Sta qui perche' la licenza si chiede alla casa **a ogni collegamento**,
  /// e decide per che strade si bussa: da fuori casa, senza Premium, non si
  /// prova nemmeno il centralino.
  final GestoreLicenza licenza;
  final bool _licenzaMia;
  bool _licenzaLasciata = false;

  /* L'ultima volta non si e' entrati perche' si era fuori casa con una casa
   * che non e' Premium. La plancia lo dice col suo tasto. */
  bool _fuoriSenzaPremium = false;

  /// Se non si entra perche' da fuori casa serve gdahome Premium.
  bool get fuoriCasaSenzaPremium => _fuoriSenzaPremium;

  /* La casa non si trova, ed era Premium da poco: si sta ricollegando. */
  bool _siRiconnette = false;

  /// Se la casa non si trova **e** fino a poco fa era gdahome Premium
  /// ([GestoreLicenza.premiumDiRecente]): la schermata dice «Riconnessione…»,
  /// e non «da fuori serve Premium».
  ///
  /// E' il caso dell'add-on che si aggiorna: per qualche minuto la casa non
  /// c'e', e il centralino dice «casa non collegata». Non e' un verdetto
  /// sulla licenza — quello lo dice solo chi lo sa, la casa o il centralino —
  /// e intanto si continua a bussare, anche da fuori ([_trova]).
  bool get siRiconnette => _siRiconnette;

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
  ///
  /// **Si chiude il filo, non la plancia.** Dove sta la plancia di questa casa
  /// si sapeva prima e si sa anche adesso: la casa e' la stessa. Prima qui si
  /// dimenticava, e chi disegna, non sapendo piu' dove fosse, al ritorno
  /// buttava via la pagina e scriveva «Cerco la plancia…» — e la pagina si
  /// rifaceva da capo, moduli compresi, a ogni ritorno dopo mezzo minuto in
  /// tasca. Da fuori casa era la plancia intera che ripassava dal centralino.
  /// Adesso la pagina resta dov'e', e il suo WebSocket si ricollega da se'
  /// quando il filo torna, come fa gia' a ogni caduta.
  Future<void> riposa() async {
    if (!_avviato || _filo == null || _aRiposo) return;
    _aRiposo = true;
    await _chiudiIlFilo(tieniLaPlancia: true);
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

  /// Il filo verso la casa, per chi ci deve parlare: la plancia, la console,
  /// le segnalazioni.
  ///
  /// **Nessuno, finche' la casa non ha detto la sua licenza** quando si e'
  /// entrati da fuori solo per chiedergliela ([_ProvaDaFuori]). La plancia
  /// che resta nel riquadro — dopo un riposo la pagina non si butta — si
  /// ricollega da se' appena trova un filo dentro (`plancia/cucitura.dart`),
  /// e lo troverebbe proprio quello: una casa Base, da fuori, servita per il
  /// tempo di una risposta. Qui non lo trova, e aspetta il verdetto.
  Filo? get filo => _licenzaDaSentire ? null : _filo;

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

  bool get dentro => filo?.dentro ?? false;

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
    await _chiudiIlFilo(tieniLaPlancia: true);

    final casa = archivio.attiva;
    /* La plancia si dimentica solo cambiando casa.
     *
     * Rifare il filo della **stessa** casa — al risveglio, tirando giu' per
     * aggiornare, dopo aver imparato la strada corta — non cambia dove sta la
     * sua plancia: la si rilegge appena il filo e' su, e se e' la stessa la
     * pagina non si tocca. Dimenticarla vorrebbe dire far buttare via a chi
     * disegna una pagina che funziona, per riaprirla uguale un secondo dopo.
     * Un'altra casa invece ha un'altra plancia, e quella di prima non e' sua. */
    if (casa?.id != _casa?.id) _dimenticaLaPlancia();
    _casa = casa;
    _daDove = null;
    _perche = null;
    _fuoriSenzaPremium = false;
    _siRiconnette = false;
    /* Le licenze che si sanno gia', dall'archivio: servono prima di bussare,
     * perche' decidono da dove. */
    /* Prima la casa in uso, poi le licenze: cosi' la prima risposta su
     * Premium e' gia' quella della casa giusta, e non un «no» di passaggio. */
    licenza.inUso(casa?.id);
    await licenza.conosci(archivio.tutte);

    if (casa == null) {
      _vai(ComeVa.nessunaCasa);
      return;
    }

    /* Una casa abbinata prima che esistessero le chiavi non parla piu' con
     * nessun ponte: si dice, invece di far girare una rotella per sempre. */
    if (casa.daRiabbinare || !casa.raggiungibile) {
      _perche = casa.daRiabbinare
          ? inLingua(
              it:
                  'Questa casa è stata abbinata con una versione vecchia '
                  'dell\'app: va riabbinata inquadrando un QR code nuovo.',
              en:
                  'This home was paired with an old version of the app: it '
                  'needs pairing again with a new QR code.',
            )
          : inLingua(
              it: 'Non so più dove sia «${casa.nome}»: riabbinala.',
              en: 'I no longer know where “${casa.nome}” is: pair it again.',
            );
      _vai(ComeVa.segnoScaduto);
      return;
    }

    _vai(ComeVa.inCammino);

    /* Una casa che l'app crede Base puo' non esserlo piu': si prova da fuori,
     * una volta, per chiederglielo. Vedi [_ProvaDaFuori]. */
    final prova = _laProvaDaFuori(casa);
    _prova = prova;

    final filo = Filo(
      approdo: () => _trova(casa),
      segno: casa.segno,
      chi: casa.identificativo!,
      chiave: casa.chiave!,
      apri: apriLaPresa,
      /* Il legame (`lega`, vedi `ponte/stretta.dart`) si ricorda per casa,
       * nell'archivio: una casa che l'ha provato una volta lo deve ripetere
       * anche alla prima stretta dopo che l'app si e' riaperta, che e'
       * proprio quella che chi sta in mezzo proverebbe a scoprire. Una casa
       * mai vista legare — un add-on di prima — si apre come sempre. */
      legameGiaVisto: casa.legata,
      quandoLega: () => unawaited(
        archivio.segnaIlLegame(casa.id).catchError((Object _) {
          /* Non scritto: il filo se lo ricorda lo stesso finche' vive, e la
           * prossima stretta legata ci riprova. */
        }),
      ),
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
           * mai stata letta: si richiede **ogni volta**.
           *
           * Qui c'era `if (!_pannelloLetto)`, e con quella guardia la plancia
           * si chiedeva una volta e poi mai piu': il commento diceva «puo'
           * essere cambiata» e la riga sotto non la ricontrollava. Si e' visto
           * quando serviva: togliere a qualcuno il permesso di vedere una
           * plancia non gli toglieva niente, perche' l'app teneva quella che
           * aveva gia' — e il filo che cade e torna, che e' quello che fa un
           * add-on quando si aggiorna, non bastava. Un cancello che vale solo
           * alla prossima apertura da zero non e' un cancello.
           *
           * Costa una domanda sul filo per ogni ritorno, e la domanda e'
           * piccola. Se la risposta e' la stessa, la pagina non si ricarica:
           * l'indirizzo non cambia, e chi disegna guarda l'indirizzo. */
          unawaited(_leggiLaPlancia(filo));
          /* E la licenza, che la casa rinnova ogni sei ore. */
          unawaited(_chiediLaLicenza(filo));
          /* E si ricontrolla la strada: si torna dentro anche rientrando in
           * casa, e li' la strada corta c'e' e prima non c'era. */
          unawaited(_imparaLaStradaDiCasa(filo));
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
      /* Con la prova da fuori in corso si aspetta il primo esito, non i
       * venticinque secondi di [Filo.apri]: se la prima bussata non va, il
       * filo ribussa da solo dalle strade di casa, e [_trova] lo dice. */
      await (prova == null
          ? filo.apri()
          : Future.any([filo.apri(), prova.fallita.future]));
    } on SegnoRifiutato catch (errore) {
      _prova = null;
      _perche = errore.spiegazione;
      _vai(ComeVa.segnoScaduto);
      return;
    } on ErroreDelPonte catch (errore) {
      /* I tentativi vanno avanti da soli: quando il telefono rientra sotto una
       * rete che vede la casa, il filo si apre e lo stato si sistema. */
      _perche = errore.spiegazione;
      final dallaProva = prova != null && prova.usata;
      if (_prova == prova) _prova = null;
      final adesso = archivio.quella(casa.id) ?? casa;
      /* Una prova che non e' arrivata alla casa si rifa' alla bussata dopo. */
      if (dallaProva && errore is! PremiumRichiesto) _daRiprovare = casa.id;
      if (errore is PremiumRichiesto) {
        /* Un no vero: il centralino che chiude con 4402 (o 4426) la bussata
         * da fuori, o la casa che si e' detta Base poco fa e da allora si
         * bussa solo in casa. Se era la prova, e' il suo verdetto: fino ai
         * prossimi dieci minuti non si riprova da fuori. */
        _fuoriSenzaPremium = true;
        if (dallaProva) {
          _provataDaFuoriIl[casa.id] = DateTime.now();
          _daRiprovare = null;
        }
      } else if (_nonSiTrova(errore) && licenza.premiumDiRecente(adesso)) {
        /* La casa non si trova, ed era Premium fino a poco fa: e' quasi
         * sempre l'add-on che si aggiorna. Non e' «da fuori serve Premium»:
         * e' «riconnessione», e i tentativi vanno avanti anche da fuori. */
        _siRiconnette = true;
      } else if (dallaProva && adesso.haStradeDaFuori) {
        /* La prova da fuori non e' arrivata alla casa, e di Premium recente
         * non c'e' traccia: vale quello che si sapeva, la casa e' Base. E'
         * la stessa pagina che si sarebbe vista senza provare — ma non e' un
         * verdetto, e alla bussata dopo si riprova ([_trova]). Il perche' e'
         * quello: un «casa non collegata» del centralino, sotto la pagina
         * Premium, direbbe due cose diverse. */
        _fuoriSenzaPremium = true;
        _perche = fuoriCasaServePremium;
      }
      /* Il centralino sa che l'add-on di questa casa e' vecchio: ce lo si
       * ricorda come se l'avesse detto lei, cosi' da fuori non si bussa piu'
       * e la pagina Premium dice di aggiornarlo. */
      if (errore is AddonDaAggiornare) {
        await archivio.segnaSenzaLicenze(casa.id);
        await licenza.conosci(archivio.tutte);
        if (_filo != filo) return;
        _casa = archivio.quella(casa.id) ?? casa;
      }
      _vai(ComeVa.irraggiungibile);
      _riprendiQuandoTorna(filo);
      return;
    }

    if (!await _laLicenzaPrimaDiEntrare(filo)) return;
    await _leggiLaCasa(filo);
  }

  /* ─── La prova da fuori, per una casa creduta Base ───────────────────── */

  /* La prova in corso, se ce n'e' una: vedi [_ProvaDaFuori]. */
  _ProvaDaFuori? _prova;

  /* Quando la casa ha detto l'ultima volta, da fuori, di essere Base: il
   * verdetto, non la bussata. In memoria e basta: un'app che riparte riprova
   * una volta, ed e' giusto cosi'. */
  final Map<String, DateTime> _provataDaFuoriIl = {};

  /* La casa la cui prova da fuori non e' arrivata a nessuno: alla bussata
   * dopo si riprova ([_trova]), finche' la casa non risponde. */
  String? _daRiprovare;

  /* La casa che ha appena detto di essere Base, da fuori: la riapertura che
   * segue non la riprova, qualunque sia [ogniQuantoSiRiprovaDaFuori]. Senza,
   * con un intervallo corto, verdetto e riapertura si rincorrerebbero. */
  String? _appenaDettaBase;

  /* La casa ha risposto alla prova, e ha detto che non e' Premium: serve a
   * «Controlla di nuovo», che deve sapere se la casa ha risposto. */
  bool _laProvaHaDettoBase = false;

  /* Se il filo c'e' ma e' entrato da fuori solo per chiedere la licenza, e
   * la casa non l'ha ancora detta: finche' e' cosi' il filo non si da' a
   * nessuno ([filo]). */
  bool get _licenzaDaSentire => _prova?.usata ?? false;

  /// Se questa volta si prova da fuori una casa che l'app crede Base.
  ///
  /// «Licenza: Premium per sempre · regalo» nella console della casa, e nel
  /// browser «Fuori casa serve gdahome Premium». Il browser aveva abbinato
  /// la casa quando era Base, e si era tenuto il suo gettone vuoto: per
  /// [GestoreLicenza.stradeDaFuoriPer] era Base, si bussava solo alle strade
  /// di casa, da fuori non rispondevano, e la licenza — che si chiede alla
  /// casa sul filo — non si richiedeva mai. Fermi per sempre, con la casa
  /// che intanto era diventata Premium. Lo stesso per un gettone di
  /// un abbonamento finito e poi rinnovato, o per un add-on vecchio poi
  /// aggiornato.
  ///
  /// Allora una casa creduta Base, che ha strade di fuori, si prova anche da
  /// li' — ma **solo per chiederle la licenza**: finche' non risponde il
  /// filo non si da' a nessuno e la plancia non si apre
  /// ([_laLicenzaPrimaDiEntrare]). Si riprova a ogni bussata finche' la
  /// casa non risponde ([_trova]); quando ha risposto Base, non prima di
  /// [ogniQuantoSiRiprovaDaFuori]: una casa Base davvero non deve far bussare
  /// al centralino a ogni ribussata del filo.
  ///
  /// Il cancello resta: col centralino che impone (`MODO_LICENZE`) la casa
  /// Base la chiude lui, `4402`; con le licenze spente lui lascia passare, e
  /// a dire di no e' la risposta della casa, qui.
  _ProvaDaFuori? _laProvaDaFuori(CasaConosciuta casa) {
    final adesso = archivio.quella(casa.id) ?? casa;
    if (!licenza.controlliAccesi || licenza.forza != null) return null;
    if (licenza.stradeDaFuoriPer(adesso)) return null;
    final come = licenza.comeSta(adesso);
    if (come != ComeStaLaLicenza.base &&
        come != ComeStaLaLicenza.casaSenzaLicenze) {
      return null;
    }
    if (!adesso.haStradeDaFuori) return null;
    if (_appenaDettaBase == casa.id) {
      _appenaDettaBase = null;
      return null;
    }
    /* Il tetto conta i verdetti, non le bussate: si segna quando la casa (o
     * il centralino) ha detto davvero che e' Base. Una bussata che non
     * arriva a nessuno — l'add-on che si sta aggiornando — non spende
     * niente, e alla bussata dopo si riprova. Prima si segnava qui, prima di
     * bussare: la bussata andava a vuoto nei minuti dell'aggiornamento, e
     * per dieci minuti, anche tirando giu' per aggiornare, la casa si
     * cercava solo sotto il Wi-Fi di casa. */
    final ultima = _provataDaFuoriIl[casa.id];
    if (ultima != null &&
        DateTime.now().difference(ultima) < ogniQuantoSiRiprovaDaFuori) {
      return null;
    }
    return _ProvaDaFuori(casa.id);
  }

  /* La casa non si e' trovata: nessuna strada ha risposto, o il centralino
   * dice che non gli e' attaccata. Non dice niente della licenza. */
  static bool _nonSiTrova(ErroreDelPonte errore) =>
      errore is PonteIrraggiungibile || errore is FiloCaduto;

  /// Entrati da fuori per la prova: prima di tutto la licenza.
  ///
  /// Torna `true` se si puo' entrare: la prova non c'era, si e' in casa, o la
  /// casa ha detto di essere Premium (e il gettone nuovo e' gia'
  /// nell'archivio, cosi' da qui in poi le strade di fuori si prendono da
  /// sole). Se invece e' Base davvero, o non ha risposto, il filo si chiude
  /// senza aver mostrato niente e si riparte dalle strade di casa: fuori,
  /// la pagina Premium.
  Future<bool> _laLicenzaPrimaDiEntrare(Filo filo) async {
    final prova = _prova;
    if (prova == null || !prova.usata) return true;
    final casa = _casa;
    if (casa == null) return false;
    var adesso = archivio.quella(casa.id) ?? casa;
    if (!_entratiDaCasa(filo)) {
      final rispose = await licenza.chiedi(filo, adesso, archivio);
      if (_filo != filo) return false;
      if (_prova != prova) {
        /* Il filo e' caduto mentre si chiedeva, e ribussa gia' ([_trova]):
         * vale quello che si sapeva, come per una prova che non e' andata, e
         * appena il filo torna su si entra. */
        _daRiprovare = casa.id;
        if (licenza.premiumDiRecente(adesso)) {
          _siRiconnette = true;
        } else {
          _fuoriSenzaPremium = adesso.haStradeDaFuori;
          _perche = fuoriCasaServePremium;
        }
        _vai(ComeVa.irraggiungibile);
        _riprendiQuandoTorna(filo);
        return false;
      }
      adesso = archivio.quella(casa.id) ?? casa;
      _casa = adesso;
      _laProvaHaDettoBase = rispose && !licenza.stradeDaFuoriPer(adesso);
      /* Il verdetto: la casa ha risposto, e ha detto Base. Da qui i dieci
       * minuti ([_laProvaDaFuori]). */
      if (_laProvaHaDettoBase) _provataDaFuoriIl[casa.id] = DateTime.now();
    }
    _prova = null;
    _daRiprovare = null;
    if (_entratiDaCasa(filo) || licenza.stradeDaFuoriPer(adesso)) {
      _avvisa();
      return true;
    }
    /* Base davvero: si riparte, e questa volta la prova non c'e'. */
    _appenaDettaBase = casa.id;
    await apri(forza: true);
    return false;
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
    /* La licenza, a ogni collegamento: e' la casa che la tiene. */
    unawaited(_chiediLaLicenza(filo));
    /* E poi ogni sei ore, finche' il filo resta su. Il gettone che l'app si
     * tiene vale otto giorni al massimo (un abbonamento, fino a tre giorni
     * dopo il periodo pagato), e la casa intanto lo rinnova: un'app aperta
     * per giorni senza che il filo cada mai — il tablet sul muro — col
     * gettone di quando si e' collegata tornerebbe Base con la casa
     * Premium. */
    _rileggiLaLicenza?.cancel();
    _rileggiLaLicenza = Timer.periodic(ogniQuantoLaLicenza, (_) {
      if (_filo == filo && filo.dentro) unawaited(_chiediLaLicenza(filo));
    });
    /* E se si e' entrati dalla strada lunga, si chiede alla casa dov'e'. Non
     * si aspetta: la casa e' gia' aperta, e questo e' solo per andarci piu'
     * dritti. */
    unawaited(_imparaLaStradaDiCasa(filo));
    /* E se questa casa e' stata riabbinata, si fa staccare il telefono di
     * prima: e' sempre questo telefono, e non deve contare due volte. */
    unawaited(_staccaIlVecchio(filo));
  }

  /// Fa staccare dalla casa il telefono di prima, dopo un riabbinamento
  /// (`CasaConosciuta.vecchioIdentificativo`).
  ///
  /// «Nei telefoni abbinati lo stesso telefono compare due volte.» Si dice
  /// alla casa chi si era, col vecchio segno, che ha solo questo telefono
  /// (`ponte/telefono/sostituisci`). Fatto — o se la casa dice che non c'e'
  /// piu', o se non sa cosa sia — il vecchio segno si dimentica. Se il filo
  /// cade a meta', si riprova alla prossima connessione.
  Future<void> _staccaIlVecchio(Filo filo) async {
    final casa = _casa;
    if (casa == null || !casa.haUnVecchioDaStaccare) return;
    try {
      await filo.risultato({
        'type': 'ponte/telefono/sostituisci',
        'vecchio': casa.vecchioIdentificativo,
        'segno': casa.vecchioSegno,
      });
    } on ComandoRifiutato {
      /* Un add-on di prima non sa cosa sia: il vecchio se ne andra' coi
       * giorni di silenzio, come prima. Non c'e' niente da ritentare. */
    } catch (_) {
      /* Il filo caduto, la casa che non risponde: si riprova la prossima
       * volta, il segno resta. */
      return;
    }
    try {
      await archivio.segnaIlVecchioStaccato(casa.id);
    } catch (_) {
      /* Non scritto: alla prossima connessione si richiede, e la casa
       * risponde di nuovo «non c'e'». */
    }
  }

  /* ─── La licenza ─────────────────────────────────────────────────────── */

  /// Chiede alla casa la sua licenza, e rimette a posto quello che cambia.
  ///
  /// Se la casa risulta non Premium mentre si e' entrati da fuori, si riparte
  /// da capo: questa volta si bussa solo in casa, e se non si e' in casa la
  /// schermata dice perche'. Se cambia qualcosa si rilegge la plancia: una
  /// casa appena diventata Premium riapre quella scelta l'ultima volta, una
  /// che non lo e' piu' torna alla principale.
  ///
  /// Torna `true` se la casa ha risposto.
  Future<bool> _chiediLaLicenza(Filo filo) async {
    final casa = _casa;
    if (casa == null) return false;
    final prima = licenza.premium;
    if (!await licenza.chiedi(filo, casa, archivio)) return false;
    if (_filo != filo) return true;
    final adesso = archivio.quella(casa.id) ?? casa;
    _casa = adesso;
    if (!_entratiDaCasa(filo) && !licenza.stradeDaFuoriPer(adesso)) {
      /* La casa l'ha appena detto, e da fuori: la prova da fuori
       * ([_laProvaDaFuori]) non serve a richiederglielo subito. */
      _provataDaFuoriIl[casa.id] = DateTime.now();
      _daRiprovare = null;
      _appenaDettaBase = casa.id;
      await apri(forza: true);
      return true;
    }
    if (licenza.premium != prima) await _leggiLaPlancia(filo);
    _avvisa();
    return true;
  }

  /// Se questo filo arriva dalla rete di casa.
  ///
  /// Lo dice la casa, nel `pronto` ([Filo.daCasa]): e' lei che vede da dove
  /// arriva la presa. L'indirizzo da solo non basta, nei due versi: un
  /// indirizzo `https` pubblico si apre anche dal divano — la web app aperta
  /// in casa con l'indirizzo di fuori — e un indirizzo «di casa» scritto nel
  /// QR, se e' pubblico, si apre anche dalla stazione. Un ponte di prima non
  /// lo dice, e vale la strada da cui si e' entrati, come prima.
  bool _entratiDaCasa(Filo filo) =>
      filo.daCasa ?? (_daDove == null || _daDove == DaDove.daDentro);

  /// Richiede la licenza alla casa: dopo un acquisto, o dalla pagina Premium.
  Future<void> rileggiLaLicenza() async {
    final filo = _filo;
    if (filo == null || !filo.dentro) return;
    await _chiediLaLicenza(filo);
  }

  /// «Controlla di nuovo», dalla pagina Premium: dopo aver aggiornato
  /// l'add-on, o con una casa che non aveva ancora risposto.
  ///
  /// Col filo su si richiede la licenza e basta. Col filo giu' — l'add-on che
  /// si riavvia dopo l'aggiornamento lo butta giu' — si riapre, e appena
  /// dentro la licenza la si chiede comunque. Torna `true` se la casa ha
  /// risposto: `false` vuol dire che adesso non si raggiunge, e chi guarda lo
  /// deve sapere invece di vedere un tasto che non fa niente.
  ///
  /// E' una richiesta di chi guarda, non un ribussare del filo: la prova da
  /// fuori ([_ProvaDaFuori]) si rifa' anche se ne era appena passata una. Se
  /// la casa risponde da li' e dice ancora Base, ha risposto: `true`, e la
  /// pagina resta quella.
  Future<bool> ricontrollaLaLicenza() async {
    if (!_pronta) {
      final casa = _casa ?? archivio.attiva;
      if (casa != null) _provataDaFuoriIl.remove(casa.id);
      _laProvaHaDettoBase = false;
      await apri(forza: true);
      if (!_pronta) return _laProvaHaDettoBase;
    }
    return _chiediLaLicenza(_filo!);
  }

  /// Se questa plancia si puo' aprire: la principale sempre, le altre con
  /// gdahome Premium.
  bool siPuoAprire(UnaPlancia una) => una.primaria || licenza.premium;

  /// Riscatta un codice regalo per la casa aperta.
  ///
  /// Fuori casa, con la casa Base, il filo non c'e' — e' il centralino a
  /// tenerlo chiuso — ed e' proprio il momento in cui un regalo serve: «Ho
  /// provato a generare un codice ma non funziona». Allora lo porta il
  /// centralino, firmato da questo telefono, come la ricevuta di chi compra
  /// ([_ilRegaloDalCentralino]). Se nemmeno quella strada c'e', si dice
  /// come prima che la casa non e' collegata.
  ///
  /// Solleva [LicenzaRifiutata], con la frase da mostrare.
  ///
  /// «Codice regalo inserito in app ma non va»: la strada del centralino si
  /// provava solo quando l'app aveva gia' concluso di essere fuori casa senza
  /// Premium. Con il filo non ancora aperto per qualunque altra ragione — la
  /// pagina Premium aperta prima che la casa rispondesse, un cambio di rete,
  /// un filo che si sta riaprendo — il regalo si fermava su «la casa non e'
  /// collegata». Adesso, se il filo non c'e', il regalo lo porta il
  /// centralino; se nemmeno lui ci riesce, si bussa alla casa e la si aspetta
  /// un poco, come per la ricevuta di chi compra.
  Future<void> riscatta(String codice) async {
    if (!_pronta) {
      if (await _ilRegaloDalCentralino(codice)) return;
      unawaited(apri(forza: true));
      await _aspettaLaCasa(attesaPerLaRicevuta);
    }
    final (filo, casa) = _perLaLicenza();
    await licenza.riscatta(codice, filo, casa, archivio);
    await _dopoLaLicenza(filo, casa);
  }

  /* Il codice regalo portato alla casa dal centralino
   * (`ricevuta_da_fuori.dart`). `true` se la casa l'ha avuto; un no della
   * casa sul codice — gia' usato, inesistente — solleva con la sua frase;
   * per tutto il resto `false`, e si dice che la casa non c'e'. */
  Future<bool> _ilRegaloDalCentralino(String codice) async {
    final pulito = codicePulito(codice);
    if (!codiceBenFatto(pulito)) {
      throw LicenzaRifiutata(
        inLingua(
          it: 'Il codice è fatto così: GDA-XXXX-XXXX-XXXX.',
          en: 'The code looks like this: GDA-XXXX-XXXX-XXXX.',
        ),
      );
    }
    final aperta = _casa ?? archivio.attiva;
    final casa = aperta == null ? null : archivio.quella(aperta.id) ?? aperta;
    final centralino = casa?.centralino;
    final idDellaCasa = casa?.casaAlCentralino;
    final chi = casa?.identificativo;
    final chiave = casa?.chiave;
    if (casa == null ||
        centralino == null ||
        idDellaCasa == null ||
        chi == null ||
        chiave == null) {
      return false;
    }
    final esito = await portaIlRegaloDaFuori(
      centralino: centralino,
      casa: idDellaCasa,
      chi: chi,
      chiaveDelFilo: chiave,
      regalo: pulito,
      consegna: consegnaAlCentralino,
    );
    if (esito.arrivata) {
      await licenza.ricordaLaRisposta(esito.detto, casa, archivio);
      /* La casa e' Premium, e l'ha gia' detto al centralino: da fuori adesso
       * si entra. */
      unawaited(apri(forza: true));
      return true;
    }
    final detto = esito.detto;
    final errore = detto is Map ? '${detto['errore'] ?? ''}' : '';
    /* Una casa con l'add-on di prima la strada la ha, ma un regalo non lo
     * conosce: lo prende per una ricevuta storta. */
    if (errore == 'ricevuta-storta' || esito.stato == 426) {
      throw LicenzaRifiutata(
        inLingua(
          it:
              'Per riscattarlo da fuori casa aggiorna gdahome in Home '
              'Assistant. Intanto puoi riscattarlo dalla console dell\'add-on, '
              'o da qui quando sei a casa.',
          en:
              'To redeem it away from home, update gdahome in Home Assistant. '
              'Meanwhile you can redeem it from the add-on\'s console, or '
              'from here when you\'re at home.',
        ),
      );
    }
    if (esito.stato == 400 || esito.stato == 404 || esito.stato == 409) {
      throw LicenzaRifiutata(GestoreLicenza.spiegaIlNo(esito.stato, errore));
    }
    return false;
  }

  /// Manda alla casa aperta la ricevuta di un acquisto.
  ///
  /// Se la casa adesso non c'e', la ricevuta resta al negozio e si riprova
  /// quando torna (`GestoreDegliAcquisti.riprova`). E se non c'e' perche' si
  /// e' fuori casa senza Premium — il caso di chi compra proprio per entrare
  /// da fuori — le strade di fuori si aprono per portarla
  /// ([GestoreLicenza.ricevutaDaPortare]): si bussa subito, e si aspetta la
  /// casa per [attesaPerLaRicevuta], col bottone che gira. Chi ha appena
  /// pagato vede «Fatto» qualche secondo dopo, e non un errore rosso che dice
  /// che la casa non c'e' mentre la si sta andando a prendere.
  Future<void> mandaLaRicevuta({
    required String piattaforma,
    required String prodotto,
    required String ricevuta,
  }) async {
    if (!_pronta) {
      licenza.ricevutaDaPortare = true;
      if (_fuoriSenzaPremium) {
        /* Col centralino acceso il filo verso una casa Base da fuori non si
         * apre: la ricevuta la porta lui, firmata da questo telefono. Se non
         * ci riesce, si prova la strada di sempre. */
        if (await _laRicevutaDalCentralino(
          piattaforma: piattaforma,
          prodotto: prodotto,
          ricevuta: ricevuta,
        )) {
          return;
        }
        unawaited(apri(forza: true));
        await _aspettaLaCasa(attesaPerLaRicevuta);
      }
    }
    final (filo, casa) = _perLaLicenza();
    try {
      await licenza.mandaLaRicevuta(
        piattaforma: piattaforma,
        prodotto: prodotto,
        ricevuta: ricevuta,
        filo: filo,
        casa: casa,
        archivio: archivio,
      );
    } on LicenzaRifiutata catch (no) {
      /* Un no di chi decide chiude la faccenda: non c'e' piu' niente da
       * portare. Un no della strada invece la lascia aperta. */
      if (no.definitiva) licenza.ricevutaDaPortare = false;
      rethrow;
    }
    licenza.ricevutaDaPortare = false;
    await _dopoLaLicenza(filo, casa);
  }

  /* La ricevuta portata alla casa dal centralino (`ricevuta_da_fuori.dart`).
   * `true` se la casa l'ha avuta; un no del negozio solleva, definitivo; per
   * tutto il resto `false`, e si prova la strada di sempre. */
  Future<bool> _laRicevutaDalCentralino({
    required String piattaforma,
    required String prodotto,
    required String ricevuta,
  }) async {
    final aperta = _casa ?? archivio.attiva;
    final casa = aperta == null ? null : archivio.quella(aperta.id) ?? aperta;
    final centralino = casa?.centralino;
    final idDellaCasa = casa?.casaAlCentralino;
    final chi = casa?.identificativo;
    final chiave = casa?.chiave;
    if (casa == null ||
        centralino == null ||
        idDellaCasa == null ||
        chi == null ||
        chiave == null) {
      return false;
    }
    final esito = await portaLaRicevutaDaFuori(
      centralino: centralino,
      casa: idDellaCasa,
      chi: chi,
      chiaveDelFilo: chiave,
      piattaforma: piattaforma,
      prodotto: prodotto,
      ricevuta: ricevuta,
      consegna: consegnaAlCentralino,
    );
    if (esito.rifiutataDalNegozio) {
      licenza.ricevutaDaPortare = false;
      throw LicenzaRifiutata(
        inLingua(
          it: 'Il negozio non ha confermato l\'acquisto.',
          en: 'The store didn\'t confirm the purchase.',
        ),
        definitiva: true,
      );
    }
    if (!esito.arrivata) return false;
    await licenza.ricordaLaRisposta(esito.detto, casa, archivio);
    licenza.ricevutaDaPortare = false;
    /* La casa e' Premium, e l'ha gia' detto al centralino: da fuori adesso
     * si entra. */
    unawaited(apri(forza: true));
    return true;
  }

  /* Se c'e' una casa aperta a cui dire qualcosa adesso. */
  bool get _pronta =>
      !_licenzaDaSentire && _filo != null && _filo!.dentro && _casa != null;

  /* Aspetta che la casa sia aperta, al massimo [quanto]: `true` se c'e'. */
  Future<bool> _aspettaLaCasa(Duration quanto) async {
    if (_pronta) return true;
    final arrivata = Completer<bool>();
    final ascolto = cambiamenti.listen((_) {
      if (_pronta && !arrivata.isCompleted) arrivata.complete(true);
    });
    try {
      return await arrivata.future.timeout(quanto, onTimeout: () => _pronta);
    } finally {
      await ascolto.cancel();
    }
  }

  (Filo, CasaConosciuta) _perLaLicenza() {
    final filo = _filo;
    final casa = _casa;
    if (filo == null || !filo.dentro || casa == null) {
      throw LicenzaRifiutata(
        inLingua(
          it:
              'La casa non è collegata adesso: la licenza la tiene lei. '
              'Riprova quando la plancia si vede.',
          en:
              'Your home isn\'t connected right now, and it holds the '
              'licence. Try again when the dashboard shows up.',
        ),
        definitiva: false,
      );
    }
    return (filo, casa);
  }

  Future<void> _dopoLaLicenza(Filo filo, CasaConosciuta casa) async {
    _casa = archivio.quella(casa.id) ?? casa;
    if (_filo == filo) await _leggiLaPlancia(filo);
    _avvisa();
  }

  /* ─── La strada di casa, imparata dopo ──────────────────────────────── */

  /* Quando si e' chiesto l'ultima volta, e a quale casa.
   *
   * Non piu' di una volta ogni [_ogniTanto]: e' lo stesso tempo per cui il
   * ponte tiene buona la risposta del Supervisor (`ritorno.js`), e chiederla
   * piu' spesso vorrebbe dire farsi ridire la stessa cosa. */
  static const _ogniTanto = Duration(minutes: 5);
  String? _stradaChiestaPer;
  DateTime? _stradaChiestaIl;

  /// Chiede alla casa dove sta sulla rete di casa, e se c'e' una strada piu'
  /// corta la prende.
  ///
  /// L'indirizzo di casa il telefono lo sentiva dire **una volta**, dentro il
  /// QR code dell'abbinamento, e non lo rinfrescava mai piu'. Chi abbina la
  /// casa stando fuori non ne sente nessuno; chi l'ha abbinata in casa se lo
  /// tiene anche dopo che il router, a un riavvio, ne ha dato un altro. In
  /// tutti e due i casi il telefono passa dal centralino stando sul divano:
  /// «Compare fuori casa quando in realtà sono in wifi e sono in casa», e
  /// ogni tocco fa il giro del mondo e torna.
  ///
  /// Adesso la casa lo sa dire sul filo (`ponte/casa/dove`). Non ci si fida
  /// sulla parola: si bussa, e l'indirizzo si tiene solo se risponde —
  /// bussare e' anche il modo di sapere se si e' in casa davvero.
  Future<void> _imparaLaStradaDiCasa(Filo filo) async {
    final casa = _casa;
    if (casa == null) return;
    /* Gia' dentro: la strada corta si sta gia' facendo. */
    if (_daDove == DaDove.daDentro) return;
    final adesso = DateTime.now();
    if (_stradaChiestaPer == casa.id &&
        _stradaChiestaIl != null &&
        adesso.difference(_stradaChiestaIl!) < _ogniTanto) {
      return;
    }
    _stradaChiestaPer = casa.id;
    _stradaChiestaIl = adesso;

    final List<IndirizzoDelPonte> indirizzi;
    try {
      /* La risposta arriva com'e': un ponte che quel comando non lo conosce
       * puo' rispondere «va bene» senza niente dentro, e li' non c'e' nessun
       * indirizzo da leggere. */
      final detto = await filo.risultato({'type': 'ponte/casa/dove'});
      final detti = detto is Map ? detto['indirizzi'] : null;
      indirizzi = [
        for (final uno in detti is List ? detti : const [])
          if (uno is String) IndirizzoDelPonte.leggi(uno),
      ].nonNulls.toList();
    } on ErroreDelPonte {
      /* Un ponte di prima non sa rispondere, e va benissimo: si resta dove si
       * e', che e' dove si era anche prima di questa domanda. */
      return;
    }
    if (indirizzi.isEmpty) return;

    final quale = await Abbinamento.qualeRisponde(
      indirizzi,
      bussa: _sonda.bussa,
    );
    /* Nessuno risponde: non si e' in casa, ed e' giusto stare sul centralino.
     * Non si scrive niente — l'indirizzo che c'e' puo' essere ancora buono
     * per quando si torna. */
    if (quale == null) return;
    if (quale.toString() == casa.inCasa?.toString()) {
      /* L'indirizzo e' quello che si sapeva, e risponde: si e' in casa, e il
       * centralino ha vinto la corsa lo stesso. Succede quando l'ultima volta
       * si era entrati da li': allora parte senza ritardo (`sonda.dart`), e
       * una rete di casa appena ritrovata — il telefono che si riaggancia al
       * Wi-Fi — puo' rispondere un soffio dopo di lui. Prima qui si tornava e
       * basta, e si restava sul giro lungo fino al filo dopo, che ripartiva
       * di nuovo senza ritardo: in casa, per sempre dal centralino.
       *
       * Si segna che la strada che funziona e' quella di casa — cosi' al giro
       * dopo il centralino riparte col suo ritardo — e si riparte da li'. */
      if (_daDove != DaDove.dalCentralino ||
          _filo != filo ||
          _casa?.id != casa.id) {
        return;
      }
      await archivio.segnaLApprodo(casa.id, DaDove.daDentro);
      await apri(forza: true);
      return;
    }

    await archivio.cambiaGliIndirizzi(casa.id, inCasa: quale);
    /* E si riparte da li'. La casa e' la stessa e il filo si riapre subito:
     * costa un lampo adesso, e toglie il giro dal mondo a tutto il resto
     * della giornata. */
    await apri(forza: true);
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
    /* Senza Premium si apre solo la principale: quella ricordata resta
     * scritta, e torna appena la casa lo diventa. */
    final voluto = profilo ?? (licenza.premium ? _casa?.plancia : null) ?? '';
    PannelloDellaPlancia? trovato;
    var nessunaPerMe = false;
    try {
      trovato = await trovaLaPlancia(filo, profilo: voluto);
    } on NessunaPlanciaPerTe {
      /* Le plance ci sono, ma non per questa utenza. Non si cerca altrove e
       * non si apre niente: la schermata lo scrive. */
      nessunaPerMe = true;
    } on FiloCaduto {
      /* Il filo e' caduto mentre si chiedeva: la casa non ha detto niente, e
       * «niente» non vuol dire «la plancia non c'e'». Se si sapeva gia' dove
       * stava, si tiene quello, e la pagina resta: si richiede quando il filo
       * torna su. Se non si sapeva, si dice quello che si e' sempre detto. */
      if (_pannelloLetto) return;
    } on ErroreDelPonte {
      /* Un altro no: si segna che si e' chiesto, e la schermata dice quello
       * che sa. */
    }
    /* Una risposta arrivata su un filo che non c'e' piu' non vale.
     *
     * Prima si scriveva lo stesso, e bastava: la plancia si dimenticava a ogni
     * filo chiuso, e quello che restava scritto non lo guardava nessuno.
     * Adesso fra un filo e l'altro della stessa casa la plancia resta — e una
     * risposta vecchia, magari un «il filo e' caduto» di quello chiuso andando
     * a riposo, cancellerebbe una plancia buona. */
    if (_filo != filo) return;
    _pannello = trovato;
    _nessunaPerMe = nessunaPerMe;
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
    /* Le plance oltre la principale sono di gdahome Premium: la barra le
     * mostra col lucchetto, e qui non si aprono comunque. */
    final voluta = plance.where((una) => una.profilo == profilo).firstOrNull;
    if (!licenza.premium && !(voluta?.primaria ?? profilo.isEmpty)) return;
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
      unawaited(() async {
        /* Anche qui, se si e' entrati per la prova, prima la licenza. */
        if (!await _laLicenzaPrimaDiEntrare(filo)) return;
        if (_filo != filo || _stato != null) return;
        await _leggiLaCasa(filo);
      }());
    });
  }

  /// Dove bussare adesso. Chiamata dal filo a ogni tentativo.
  Future<Approdo> _trova(CasaConosciuta casa) async {
    /* La casa com'e' adesso nell'archivio: il gettone puo' essere cambiato
     * dopo che il filo e' nato. Senza Premium le strade di fuori non si
     * provano nemmeno — il centralino direbbe di no, e l'indirizzo pubblico
     * non e' compreso. */
    final adesso = archivio.quella(casa.id) ?? casa;
    final daFuori = licenza.stradeDaFuoriPer(adesso);
    /* La prova da fuori ([_ProvaDaFuori]) vale per **una** bussata. Se il
     * filo torna qui con la prova gia' usata e senza verdetto, la bussata non
     * e' andata: lo si dice a chi aspetta in [apri], e da qui in poi si bussa
     * come a una casa Base. */
    var prova = _prova;
    if (prova != null && prova.usata) {
      _prova = null;
      prova.nonEAndata();
      prova = null;
      _daRiprovare = casa.id;
    }
    /* Una casa creduta Base, la cui prova da fuori non e' arrivata a
     * nessuno, si riprova da fuori **a ogni bussata**, finche' non risponde
     * lei — o il centralino — col suo verdetto ([_laProvaDaFuori]). Dopo un
     * verdetto no: si bussa in casa, come per ogni casa Base. Prima si
     * provava una volta per apertura: se
     * quella bussata cadeva nei minuti in cui l'add-on si aggiorna, il filo
     * continuava a bussare solo in casa, e da fuori la casa tornata non si
     * ritrovava piu' — finche' non la si cancellava e riabbinava. La prova
     * resta quella di sempre: il filo non si da' a nessuno finche' la casa
     * non ha detto la sua licenza. */
    if (prova == null && !daFuori && _daRiprovare == casa.id) {
      prova = _laProvaDaFuori(adesso);
      _prova = prova;
    }
    final perLaLicenza =
        !daFuori && prova != null && prova.casa == casa.id && !prova.usata;
    final Approdo approdo;
    try {
      /* Senza Premium si bussa solo alle strade dirette, e vale quella da cui
       * la casa dice di vederci arrivare da casa sua: anche l'indirizzo
       * pubblico, quando dal divano si e' aperta la web app con quello. */
      if (perLaLicenza) prova.usata = true;
      approdo = daFuori || perLaLicenza
          ? await _sonda.dove(adesso)
          : await _sonda.dove(_conLaPagina(adesso), soloDaCasa: true);
    } on PremiumRichiesto {
      /* La casa ha risposto, ma da fuori: la pagina Premium, non «non trovo
       * la casa». */
      _fuoriSenzaPremium = true;
      rethrow;
    } on PonteIrraggiungibile {
      if (daFuori || perLaLicenza || !adesso.haStradeDaFuori) rethrow;
      _fuoriSenzaPremium = true;
      throw PremiumRichiesto(fuoriCasaServePremium);
    }
    _fuoriSenzaPremium = false;
    _daDove = approdo.da;
    /* Si scrive solo quando cambia: il filo si riapre a ogni ascensore. */
    unawaited(archivio.segnaLApprodo(casa.id, approdo.da));
    _avvisa();
    return approdo;
  }

  /* La casa, con in piu' la strada della pagina che ha servito la web app
   * ([indirizzoDellaPagina]), quando la casa non ne ha gia' una di fuori.
   *
   * Quella pagina l'ha servita un ponte, ma non e' detto che sia il ponte di
   * questa casa: con piu' case nell'archivio la si prende solo per quella
   * che la conosce gia', o non si saprebbe a quale porta si sta bussando. */
  CasaConosciuta _conLaPagina(CasaConosciuta casa) {
    final pagina = indirizzoDellaPagina;
    if (pagina == null || casa.daFuoriCasa != null) return casa;
    final sua =
        archivio.tutte.length == 1 ||
        (casa.inCasa?.casa == pagina.casa &&
            casa.inCasa?.porta == pagina.porta);
    return sua ? casa.con(daFuoriCasa: pagina) : casa;
  }

  /// Passa a un'altra casa: butta giu' il filo di questa e apre quello.
  Future<void> cambiaCasa(String id) async {
    if (_casa?.id == id && _comeVa == ComeVa.aperta) return;
    await archivio.scegli(id);
    await apri();
  }

  /// Toglie una casa. Se era quella aperta, apre quella che resta.
  ///
  /// Prima le dice di non mandare piu' notifiche a questo telefono.
  ///
  /// «Non ho più la casa associata sull'app ma mi arrivano notifiche»: il
  /// telefono dimenticava la casa, e la casa non lo sapeva. Il gettone di
  /// Firebase restava nel ponte, e le buste continuavano ad arrivare a un
  /// telefono che non aveva piu' la chiave per aprirle — sull'iPhone, una
  /// «nuova notifica» senza niente dentro. Il comando c'era da sempre
  /// (`ponte/notifiche/togli`), e non lo chiamava nessuno.
  ///
  /// Col filo aperto e' un attimo, e si aspetta. Una casa che non e' quella
  /// aperta si saluta da lontano dopo averla tolta, senza far aspettare la
  /// pagina: se non risponde — spenta, fuori casa senza Premium — resta in
  /// elenco nel ponte, e lo si toglie da li' come diceva gia' la finestra.
  Future<void> dimentica(String id) async {
    final eraQuesta = _casa?.id == id;
    final casa = archivio.quella(id);
    final aperto = eraQuesta ? _filo : null;
    if (aperto != null && aperto.dentro) {
      await _niente(Notifiche(aperto).togli());
    } else if (casa != null) {
      unawaited(_salutaDaLontano(casa));
    }
    await archivio.togli(id);
    if (eraQuesta) await apri();
    _avvisa();
  }

  /// Quanto si aspetta il ponte prima di lasciarlo stare.
  static const _attesaDelSaluto = Duration(seconds: 5);

  Future<void> _niente(Future<void> fatto) async {
    try {
      await fatto.timeout(_attesaDelSaluto);
    } catch (_) {
      /* Non ha risposto: la casa si toglie lo stesso. */
    }
  }

  /// Un filo apposta, solo per dire alla casa «non mandarmi piu' notifiche»,
  /// e poi chiuso. Non passa da [_trova]: quella e' la strada della casa
  /// aperta, con la sua prova da fuori, e non va consumata per un'altra.
  Future<void> _salutaDaLontano(CasaConosciuta casa) async {
    final chi = casa.identificativo;
    final chiave = casa.chiave;
    if (chi == null || chiave == null) return;
    if (casa.daRiabbinare || !casa.raggiungibile) return;
    final filo = Filo(
      approdo: () => licenza.stradeDaFuoriPer(casa)
          ? _sonda.dove(casa)
          : _sonda.dove(casa, soloDaCasa: true),
      segno: casa.segno,
      chi: chi,
      chiave: chiave,
      apri: apriLaPresa,
      legameGiaVisto: casa.legata,
    );
    try {
      await filo.apri(entro: const Duration(seconds: 15));
      await _niente(Notifiche(filo).togli());
    } catch (_) {
      /* Non raggiungibile adesso: resta in elenco nel ponte. */
    } finally {
      await filo.chiudi();
    }
  }

  /// Chiude il filo. Con [tieniLaPlancia] si tiene quello che si sapeva della
  /// plancia di questa casa: vedi [riposa] e [apri].
  Future<void> _chiudiIlFilo({bool tieniLaPlancia = false}) async {
    _prova = null;
    _rileggiLaLicenza?.cancel();
    _rileggiLaLicenza = null;
    await _guardaIlFilo?.cancel();
    await _guardaLaCasa?.cancel();
    _guardaIlFilo = null;
    _guardaLaCasa = null;
    await _stato?.stacca();
    _stato = null;
    if (!tieniLaPlancia) _dimenticaLaPlancia();
    await _filo?.chiudi();
    _filo = null;
    _daDove = null;
  }

  void _dimenticaLaPlancia() {
    _pannello = null;
    _pannelloLetto = false;
    _nessunaPerMe = false;
  }

  Future<void> chiudi() async {
    if (!_licenzaLasciata) {
      _licenzaLasciata = true;
      licenza.removeListener(_avvisa);
      if (_licenzaMia) licenza.dispose();
    }
    await _chiudiIlFilo();
    if (!_cambiamenti.isClosed) await _cambiamenti.close();
    if (!_entitaCambiate.isClosed) await _entitaCambiate.close();
    if (!_planciaCambiata.isClosed) await _planciaCambiata.close();
  }

  void _vai(ComeVa nuovo) {
    _comeVa = nuovo;
    if (nuovo == ComeVa.aperta) {
      _siRiconnette = false;
      _fuoriSenzaPremium = false;
    }
    _avvisa();
  }

  void _avvisa() {
    if (!_cambiamenti.isClosed) _cambiamenti.add(null);
  }
}

/// Una casa creduta Base, provata da fuori per chiederle la licenza.
///
/// Vive per un'apertura sola ([Collegamento.apri]) e per una bussata sola
/// ([Collegamento._trova]): o si entra e la casa dice la sua licenza, o la
/// bussata non va e si torna a quello che si sapeva. Vedi
/// [Collegamento._laProvaDaFuori].
class _ProvaDaFuori {
  _ProvaDaFuori(this.casa) {
    /* Chi aspetta e' uno solo, e puo' aver gia' smesso di aspettare: un no
     * arrivato dopo non e' un errore di nessuno. */
    fallita.future.ignore();
  }

  /// Di quale casa: una prova non passa a un'altra.
  final String casa;

  /// Se la bussata da fuori e' gia' partita.
  bool usata = false;

  /// Si chiude con un errore quando la bussata da fuori non e' andata: chi
  /// aspetta in [Collegamento.apri] smette di aspettare e dice quello che si
  /// sa — «riconnessione» per una casa Premium da poco, la pagina Premium per
  /// le altre — invece dei venticinque secondi del filo. Non e' un verdetto
  /// ([ProvaDaFuoriNonAndata]): alla bussata dopo si riprova.
  final fallita = Completer<void>();

  void nonEAndata() {
    if (fallita.isCompleted) return;
    fallita.completeError(
      ProvaDaFuoriNonAndata(
        inLingua(
          it: 'da fuori la casa non ha risposto',
          en: 'your home did not answer from away',
        ),
      ),
    );
  }
}
