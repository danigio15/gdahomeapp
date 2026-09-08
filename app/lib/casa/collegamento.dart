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

import '../plancia/configurazione.dart';
import '../plancia/lettura.dart';
import '../plancia/libro.dart';
import '../plancia/scrittura.dart';
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

  /// Dentro, e lo stato della casa e' arrivato.
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

  Filo? _filo;
  StatoDellaCasa? _stato;
  ConfigurazioneDellaPlancia? _plancia;
  bool _planciaLetta = false;
  LibroDegliImpegni? _libro;
  CasaConosciuta? _casa;
  DaDove? _daDove;
  ComeVa _comeVa = ComeVa.nessunaCasa;
  String? _perche;
  bool _avviato = false;
  StreamSubscription<StatoDelFilo>? _guardaIlFilo;
  StreamSubscription<void>? _guardaLaCasa;

  /// Scatta a ogni cambiamento: chi disegna ridisegna.
  Stream<void> get cambiamenti => _cambiamenti.stream;

  ComeVa get comeVa => _comeVa;
  String? get perche => _perche;
  CasaConosciuta? get casa => _casa;
  StatoDellaCasa? get stato => _stato;
  Filo? get filo => _filo;

  /// La configurazione della plancia di questa casa.
  ///
  /// `null` finche' non e' arrivata — o per sempre, se in questa casa
  /// DashboardModern non c'e': [planciaLetta] distingue i due casi.
  ConfigurazioneDellaPlancia? get plancia => _plancia;

  /// `true` quando la casa ha risposto sulla plancia, in un senso o nell'altro.
  bool get planciaLetta => _planciaLetta;

  /// Gli appuntamenti e le cose da fare: non stanno negli stati, si chiedono
  /// coi servizi, e quindi vivono per conto loro.
  LibroDegliImpegni? get libro => _libro;

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
      if (stato != StatoDelFilo.dentro && _comeVa == ComeVa.aperta) {
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
    _guardaLaCasa = stato.cambiamenti.listen((_) => _avvisa());
    try {
      await stato.attacca();
      _vai(ComeVa.aperta);
      /* La plancia arriva dopo la casa, e non la tiene ferma: le entita' si
       * vedono subito, le tessere appena la configurazione e' arrivata. */
      unawaited(_leggiLaPlancia(filo));
    } on SegnoRifiutato catch (errore) {
      _perche = errore.spiegazione;
      _vai(ComeVa.segnoScaduto);
    } on ErroreDelPonte catch (errore) {
      _perche = errore.spiegazione;
      _vai(ComeVa.irraggiungibile);
      _riprendiQuandoTorna(filo);
    }
  }

  /// Chiede alla casa la configurazione della plancia.
  ///
  /// Un errore qui non e' un errore della casa: la casa e' aperta e le entita'
  /// ci sono. Si segna che si e' chiesto, e la Home dice quello che sa.
  Future<void> _leggiLaPlancia(Filo filo) async {
    try {
      _plancia = await chiediLaConfigurazione(filo);
    } on ErroreDelPonte {
      _plancia = null;
    }
    if (_filo != filo) return;
    _planciaLetta = true;
    _avvisa();
    final config = _plancia;
    if (config != null) unawaited(_leggiLAgenda(filo, config));
  }

  /// L'agenda arriva dopo, e per conto suo: sono due giri di rete per ogni
  /// calendario e per ogni lista, e la plancia non deve aspettarli per
  /// disegnarsi.
  Future<void> _leggiLAgenda(
    Filo filo,
    ConfigurazioneDellaPlancia config, {
    bool forza = false,
  }) async {
    final libro = _libro ??= LibroDegliImpegni(filo);
    try {
      await libro.leggi(config, forza: forza);
    } on ErroreDelPonte {
      /* Un calendario che non risponde non porta via la plancia. */
    }
    if (_filo != filo) return;
    _avvisa();
  }

  /// Rilegge la configurazione della plancia: dopo un salvataggio
  /// nell'editor, o quando si tira giu' per aggiornare.
  Future<void> rileggiLaPlancia() async {
    final filo = _filo;
    if (filo == null || !filo.dentro) return;
    await _leggiLaPlancia(filo);
    final config = _plancia;
    if (config != null) await _leggiLAgenda(filo, config, forza: true);
  }

  /// Salva la configurazione della plancia, con dentro i cambiamenti.
  ///
  /// Quello che torna dalla casa e' la configurazione che adesso c'e' davvero —
  /// la nostra se e' andata, quella di un altro se ci ha scavalcati — e si
  /// tiene quella: dopo un salvataggio andato male, restare in mano con la
  /// propria vorrebbe dire mostrare una casa che non esiste.
  Future<Salvataggio> salvaLaPlancia(Map<String, String> cambiamenti) async {
    final filo = _filo;
    final config = _plancia;
    if (filo == null || !filo.dentro || config == null) {
      return Salvataggio(
        EsitoDelSalvataggio.scavalcata,
        config ?? ConfigurazioneDellaPlancia.vuota,
      );
    }
    final esito = await salvaLaConfigurazione(
      filo,
      config,
      cambiamenti: cambiamenti,
    );
    if (_filo != filo) return esito;
    _plancia = esito.adesso;
    _avvisa();
    return esito;
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
    _plancia = null;
    _planciaLetta = false;
    await _libro?.chiudi();
    _libro = null;
    await _filo?.chiudi();
    _filo = null;
    _daDove = null;
  }

  Future<void> chiudi() async {
    await _chiudiIlFilo();
    if (!_cambiamenti.isClosed) await _cambiamenti.close();
  }

  void _vai(ComeVa nuovo) {
    _comeVa = nuovo;
    _avvisa();
  }

  void _avvisa() {
    if (!_cambiamenti.isClosed) _cambiamenti.add(null);
  }
}
