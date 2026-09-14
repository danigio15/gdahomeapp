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
import 'cassaforte.dart';

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

  Future<void> apri() async {
    _case.clear();
    _attiva = null;
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
              if (una != null) _case.add(una);
            }
          }
          final attiva = letto['attiva'];
          if (attiva is String) _attiva = attiva;
        }
      } catch (_) {
        /* Illeggibile: si riparte da vuoto, ma quello che c'e' sul disco non
         * si cancella finche' non si scrive qualcosa di buono. */
      }
    }
    _aperto = true;
  }

  /// Mette dentro una casa nuova e la rende quella attiva.
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

  Future<void> _cambia(
    String id,
    CasaConosciuta Function(CasaConosciuta) come,
  ) async {
    final dove = _case.indexWhere((una) => una.id == id);
    if (dove < 0) return;
    _case[dove] = come(_case[dove]);
    await _salva();
  }

  Future<void> svuota() async {
    _case.clear();
    _attiva = null;
    await _cassaforte.cancella(_chiave);
  }

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
