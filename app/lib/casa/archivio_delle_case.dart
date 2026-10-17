/// Le case che l'app conosce, e quella su cui e' aperta adesso.
///
/// Tutto in una chiave sola della cassaforte, come JSON. Non e' pigrizia: cosi'
/// una scrittura o va tutta o non va, e non puo' succedere che si salvi la casa
/// nuova ma non il fatto che sia diventata quella attiva.
library;

import 'dart:convert';

import '../ponte/indirizzo.dart';
import 'ausili.dart';
import 'casa_conosciuta.dart';
import 'case_doppie.dart';
import 'cassaforte.dart';
import 'questo_dispositivo.dart' show proprietarioPulito;

/// Piu' di cosi' non e' un elenco di case, e' un elenco di prove.
const int caseMassime = 10;

class ArchivioDelleCase {
  ArchivioDelleCase(this._cassaforte);

  static const _chiave = 'le_case';

  final Cassaforte _cassaforte;
  final List<CasaConosciuta> _case = [];
  String? _attiva;
  bool _aperto = false;

  bool get aperto => _aperto;
  List<CasaConosciuta> get tutte => List.unmodifiable(_case);
  bool get vuoto => _case.isEmpty;
  bool get piena => _case.length >= caseMassime;

  CasaConosciuta? get attiva {
    if (_case.isEmpty) return null;
    final trovata = _case.where((una) => una.id == _attiva);
    return trovata.isNotEmpty ? trovata.first : _case.first;
  }

  CasaConosciuta? quella(String id) {
    final trovata = _case.where((una) => una.id == id);
    return trovata.isNotEmpty ? trovata.first : null;
  }

  Future<void>? _apertura;

  /// Legge le case dalla cassaforte.
  ///
  /// **Una lettura alla volta.** Si chiedeva da piu' parti insieme — l'avvio,
  /// l'auto che si collega, un comando da Android Auto — e ognuna svuotava
  /// l'elenco, aspettava il portachiavi e poi ci aggiungeva tutte le case:
  /// tre letture, tre copie di ogni casa, e al primo salvataggio le copie
  /// restavano sul disco per sempre (vedi `case_doppie.dart`). Adesso chi
  /// arriva mentre si sta leggendo aspetta la stessa lettura, e l'elenco si
  /// costruisce a parte e si mette al suo posto tutto insieme, alla fine.
  Future<void> apri() =>
      _apertura ??= _leggi().whenComplete(() => _apertura = null);

  Future<void> _leggi() async {
    final lette = <CasaConosciuta>[];
    String? attiva;
    final scritto = await _cassaforte.leggi(_chiave);
    if (scritto != null) {
      try {
        final letto = jsonDecode(scritto);
        if (letto is Map) {
          final elenco = letto['case'];
          if (elenco is List) {
            for (final grezza in elenco) {
              final una = CasaConosciuta.daJson(grezza);
              /* Una casa storta si salta, le altre restano: un archivio
               * rovinato a meta' non deve svuotare l'app. */
              if (una != null) lette.add(una);
            }
          }
          final detta = letto['attiva'];
          if (detta is String) attiva = detta;
        }
      } catch (_) {
        /* Illeggibile: si riparte da vuoto, ma quello che c'e' sul disco non
         * si cancella finche' non si scrive qualcosa di buono. */
      }
    }
    /* Un archivio con la stessa casa piu' volte — scritto da un'app di
     * prima — si ripara qui, e si riscrive subito. */
    final (:case_, :fuse) = fondiLeCopie(lette);
    _case
      ..clear()
      ..addAll(case_);
    _attiva = fuse[attiva] ?? attiva;
    _aperto = true;
    if (case_.length != lette.length) {
      try {
        await _salva();
      } catch (_) {
        /* Non scritto: in memoria e' gia' a posto, e la prossima lettura
         * ripara di nuovo. */
      }
    }
  }

  /// Mette dentro una casa nuova e la rende quella attiva.
  ///
  /// Se e' una casa che c'e' gia' — lo stesso `casa_…`, riabbinata — non ne
  /// fa un'altra: prende le chiavi nuove e tiene il resto (nome, plancia,
  /// gettone), e si segna il telefono di prima da far staccare.
  Future<CasaConosciuta> aggiungi({
    required String nome,
    required String segno,
    String? identificativo,
    String? chiave,
    String? casaAlCentralino,
    IndirizzoDelCentralino? centralino,
    IndirizzoDelPonte? inCasa,
    IndirizzoDelPonte? daFuoriCasa,
    DaDove? approdoIniziale,
  }) async {
    final stessa = casaAlCentralino == null || casaAlCentralino.isEmpty
        ? -1
        : _case.indexWhere((una) => una.casaAlCentralino == casaAlCentralino);
    if (stessa >= 0) {
      final prima = _case[stessa];
      final vecchio =
          prima.identificativo != null &&
              prima.identificativo!.isNotEmpty &&
              prima.identificativo != identificativo
          ? prima
          : null;
      final rifatta = CasaConosciuta(
        id: prima.id,
        nome: prima.nome,
        segno: segno,
        identificativo: identificativo,
        chiave: chiave,
        casaAlCentralino: casaAlCentralino,
        centralino: centralino ?? prima.centralino,
        inCasa: inCasa ?? prima.inCasa,
        daFuoriCasa: daFuoriCasa ?? prima.daFuoriCasa,
        ultimoApprodo: approdoIniziale ?? prima.ultimoApprodo,
        plancia: prima.plancia,
        gettone: prima.gettone,
        gettonePremium: prima.gettonePremium,
        senzaLicenze: prima.senzaLicenze,
        /* Chiavi nuove: il legame lo si deve rivedere. */
        legata: false,
        vecchioIdentificativo:
            vecchio?.identificativo ?? prima.vecchioIdentificativo,
        vecchioSegno: vecchio?.segno ?? prima.vecchioSegno,
      );
      _case[stessa] = rifatta;
      _attiva = rifatta.id;
      await _salva();
      return rifatta;
    }
    if (piena) {
      throw TroppeCase('non si possono tenere più di $caseMassime case');
    }
    final casa = CasaConosciuta(
      id: identificativoNuovo(),
      nome: nomePulito(nome, quandoVuoto: 'Casa'),
      segno: segno,
      identificativo: identificativo,
      chiave: chiave,
      casaAlCentralino: casaAlCentralino,
      centralino: centralino,
      inCasa: inCasa,
      daFuoriCasa: daFuoriCasa,
      ultimoApprodo: approdoIniziale,
    );
    _case.add(casa);
    _attiva = casa.id;
    await _salva();
    return casa;
  }

  Future<void> togli(String id) async {
    final prima = _case.length;
    _case.removeWhere((una) => una.id == id);
    if (_case.length == prima) return;
    if (_attiva == id) _attiva = _case.isEmpty ? null : _case.first.id;
    await _salva();
  }

  Future<void> scegli(String id) async {
    if (_attiva == id) return;
    if (quella(id) == null) return;
    _attiva = id;
    await _salva();
  }

  Future<void> rinomina(String id, String nome) async {
    await _cambia(
      id,
      (vecchia) =>
          vecchia.con(nome: nomePulito(nome, quandoVuoto: vecchia.nome)),
    );
  }

  Future<void> cambiaGliIndirizzi(
    String id, {
    IndirizzoDelPonte? inCasa,
    IndirizzoDelPonte? daFuoriCasa,
    bool togliInCasa = false,
    bool togliDaFuori = false,
  }) async {
    await _cambia(
      id,
      (vecchia) => vecchia.con(
        inCasa: inCasa,
        daFuoriCasa: daFuoriCasa,
        togliInCasa: togliInCasa,
        togliDaFuori: togliDaFuori,
      ),
    );
  }

  /// Si ricorda da dove si e' entrati, per provare quello per primo la
  /// prossima volta.
  ///
  /// Se non e' cambiato niente **non scrive**: il filo si riapre a ogni
  /// ascensore, e una scrittura nel portachiavi a ogni riconnessione e' fatica
  /// per niente.
  Future<void> segnaLApprodo(String id, DaDove da) async {
    final casa = quella(id);
    if (casa == null || casa.ultimoApprodo == da) return;
    await _cambia(id, (vecchia) => vecchia.con(ultimoApprodo: da));
  }

  /// Quale plancia si guarda in questa casa.
  ///
  /// Si scrive solo quando cambia davvero, come per l'approdo: la scelta la si
  /// fa una volta e poi si apre l'app cento, e cento scritture identiche sul
  /// disco di un telefono non servono a nessuno. Vuoto vuol dire tornare alla
  /// prima.
  Future<void> segnaLaPlancia(String id, String profilo) async {
    final casa = quella(id);
    if (casa == null) return;
    final voluta = profilo.isEmpty ? null : profilo;
    if (casa.plancia == voluta) return;
    await _cambia(
      id,
      (vecchia) => voluta == null
          ? vecchia.con(togliLaPlancia: true)
          : vecchia.con(plancia: voluta),
    );
  }

  /// Il gettone gdahome che questa casa ha dato: vuoto se non ne ha.
  ///
  /// Come per l'approdo, si scrive solo quando cambia: la casa lo rinnova ogni
  /// sei ore, e si chiede a ogni collegamento.
  ///
  /// [premium] e' lo stesso gettone quando valeva, gia' controllato da chi
  /// chiama: si ricorda a parte (`CasaConosciuta.gettonePremium`), e un
  /// gettone vuoto detto dopo non lo cancella.
  ///
  /// La casa in memoria cambia **subito**, prima di aspettare il
  /// portachiavi: chi chiama sa gia' cosa c'e' scritto, e se il portachiavi
  /// non scrive, quello che si sa resta giusto fino alla prossima volta.
  Future<void> segnaIlGettone(
    String id,
    String gettone, {
    String? premium,
  }) async {
    final casa = quella(id);
    if (casa == null ||
        (casa.gettone == gettone &&
            !casa.senzaLicenze &&
            (premium == null || casa.gettonePremium == premium))) {
      return;
    }
    await _cambia(
      id,
      (vecchia) => vecchia.con(
        gettone: gettone,
        gettonePremium: premium,
        senzaLicenze: false,
      ),
    );
  }

  /// Questa casa le licenze non le sa tenere: il suo add-on e' di prima, o
  /// le ha spente (`CasaConosciuta.senzaLicenze`).
  ///
  /// Il gettone che si ricordava non vale piu' niente — nessuno lo rinnova —
  /// e si torna a «mai chiesto». Quando l'add-on si aggiorna e risponde,
  /// [segnaIlGettone] rimette le cose a posto.
  Future<void> segnaSenzaLicenze(String id) async {
    final casa = quella(id);
    if (casa == null || (casa.senzaLicenze && casa.gettone == null)) return;
    await _cambia(
      id,
      (vecchia) => vecchia.con(senzaLicenze: true, togliIlGettone: true),
    );
  }

  /// Questa casa la chiave del filo l'ha legata, e una busta aperta l'ha
  /// provato (`CasaConosciuta.legata`): da qui in poi lo si pretende, anche
  /// alla prossima apertura dell'app.
  ///
  /// Si scrive una volta sola: gia' segnata non si riscrive.
  Future<void> segnaIlLegame(String id) async {
    final casa = quella(id);
    if (casa == null || casa.legata) return;
    await _cambia(id, (vecchia) => vecchia.con(legata: true));
  }

  /// Il telefono di prima e' stato staccato, o non c'era piu' niente da
  /// staccare: il suo segno si dimentica.
  Future<void> segnaIlVecchioStaccato(String id) async {
    final casa = quella(id);
    if (casa == null ||
        (casa.vecchioIdentificativo == null && casa.vecchioSegno == null)) {
      return;
    }
    await _cambia(id, (vecchia) => vecchia.con(togliIlVecchio: true));
  }

  /* Tutte le voci con quell'`id`, non solo la prima: dopo `apri` di copie
   * non ce ne sono, ma se ce ne fossero non deve succedere di nuovo che una
   * abbia il gettone nuovo e un'altra quello vecchio. */
  Future<void> _cambia(
    String id,
    CasaConosciuta Function(CasaConosciuta) come,
  ) async {
    var cambiate = 0;
    for (var dove = 0; dove < _case.length; dove++) {
      if (_case[dove].id != id) continue;
      _case[dove] = come(_case[dove]);
      cambiate += 1;
    }
    if (cambiate == 0) return;
    await _salva();
  }

  Future<void> svuota() async {
    _case.clear();
    _attiva = null;
    await _cassaforte.cancella(_chiave);
    await _cassaforte.cancella(_chiaveDelProprietario);
  }

  /* ─── Di chi e' questo telefono ─────────────────────────────────────── */

  static const _chiaveDelProprietario = 'il_proprietario';

  /// Il nome scritto alla domanda «Di chi e' questo telefono?». E' del
  /// telefono, non di una casa: chi abbina una seconda casa lo ritrova gia'
  /// scritto. `''` se non l'ha mai detto.
  Future<String> proprietario() async {
    try {
      return proprietarioPulito(
        await _cassaforte.leggi(_chiaveDelProprietario) ?? '',
      );
    } catch (_) {
      return '';
    }
  }

  /// Se il nome e' gia' stato detto (anche vuoto, per scelta). Chi non l'ha
  /// mai detto se lo vede chiedere una volta (vedi `Collegamento`).
  Future<bool> proprietarioDetto() async {
    try {
      return await _cassaforte.leggi(_chiaveDelProprietario) != null;
    } catch (_) {
      return true;
    }
  }

  Future<void> segnaIlProprietario(String nome) =>
      _cassaforte.scrivi(_chiaveDelProprietario, proprietarioPulito(nome));

  Future<void> _salva() => _cassaforte.scrivi(
    _chiave,
    jsonEncode({
      'case': _case.map((una) => una.inJson()).toList(),
      if (_attiva != null) 'attiva': _attiva,
    }),
  );
}

class TroppeCase implements Exception {
  const TroppeCase(this.spiegazione);
  final String spiegazione;
  @override
  String toString() => spiegazione;
}
