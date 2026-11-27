/// Il foglietto che fa entrare un pannello a muro nella casa, da solo.
///
/// Un Sonoff NSPanel con GdAHome OS non si abbina inquadrando un QR: l'add-on
/// l'ha gia' fatto entrare nella casa — come un telefono — mentre lo
/// installava, e ha scritto sul pannello un foglietto
/// (`/data/local/gdahome/abbinamento.json`, lo scrive `installatore-pannelli.js`)
/// con dentro quello che serve per collegarsi: chi e' questo pannello per il
/// ponte, il segno che fa entrare, la chiave che cifra, gli indirizzi di casa,
/// e quale plancia a muro guardare.
///
/// GdAHome Muro, al primo avvio, legge questo foglietto e si mette nella casa:
/// da li' in poi e' un telefono come gli altri, col suo filo cifrato. Il
/// foglietto non e' un segreto da tenere — e' la stessa cosa che un telefono
/// riceve abbinandosi — ma vive in `/data/local/gdahome`, che solo il sistema
/// legge, e una volta usato non serve piu'.
///
/// Qui c'e' solo la lettura e la conversione: niente rete, niente file di
/// sistema da aprire se non quello. Cosi' si prova senza un pannello.
library;

import 'dart:convert';

import '../casa/casa_conosciuta.dart';
import '../ponte/indirizzo.dart';

/// Dove l'installatore scrive il foglietto, sul pannello.
const percorsoDelFoglietto = '/data/local/gdahome/abbinamento.json';

/// Quello che il foglietto contiene, gia' controllato.
class FogliettoDelMuro {
  const FogliettoDelMuro({
    required this.dispositivo,
    required this.segno,
    required this.chiave,
    required this.indirizzi,
    this.plancia,
    this.utente,
    this.casaAlCentralino,
    this.centralino,
  });

  /// Come questo pannello si chiama per il ponte: `dm_…`. In chiaro nella
  /// stretta di mano, serve alla casa per tirare fuori la chiave giusta.
  final String dispositivo;

  /// Il segno che fa entrare. Non esce mai verso lo schermo o il registro.
  final String segno;

  /// La chiave del filo: cifra. L'altra meta' di quello che il ponte ha dato.
  final String chiave;

  /// Gli indirizzi di casa da provare, nell'ordine (il primo e' quello di
  /// dentro casa). Ognuno «host» o «host:porta».
  final List<String> indirizzi;

  /// Quale plancia a muro guardare (il profilo della sua configurazione).
  final String? plancia;

  /// Di chi e' il pannello, l'utente di Home Assistant: vede quello che vede
  /// lui. Non serve per collegarsi, lo tiene solo per memoria.
  final String? utente;

  /// Come la casa si chiama al centralino, se c'e': `casa_…`. Instrada.
  final String? casaAlCentralino;

  /// Il centralino a cui la casa chiama, se c'e'.
  final String? centralino;

  @override
  String toString() =>
      'FogliettoDelMuro($dispositivo, ${indirizzi.length} indirizzi)';

  /// Legge il foglietto da una stringa JSON. Torna `null` se non e' un
  /// foglietto valido — manca il segno, la chiave, o un indirizzo — invece di
  /// lanciare: un foglietto rovinato non deve impedire l'avvio, solo non
  /// abbina.
  static FogliettoDelMuro? daJson(String? testo) {
    if (testo == null || testo.trim().isEmpty) return null;
    Object? letto;
    try {
      letto = jsonDecode(testo);
    } catch (_) {
      return null;
    }
    if (letto is! Map) return null;
    final mappa = letto;

    String stringa(String chiave) {
      final v = mappa[chiave];
      return v is String ? v.trim() : '';
    }

    final dispositivo = stringa('dispositivo');
    final segno = stringa('segno');
    final chiave = stringa('chiave');
    if (dispositivo.isEmpty || segno.isEmpty || chiave.isEmpty) return null;

    /// Gli indirizzi stanno in `case.indirizzi`, come li scrive il ponte
    /// (`ritorno.cosaDire`). Ogni voce e' una stringa, o un oggetto con
    /// `casa`/`host` e `porta`.
    final indirizzi = <String>[];
    final caseObj = mappa['case'];
    final grezzi = caseObj is Map ? caseObj['indirizzi'] : null;
    if (grezzi is List) {
      for (final voce in grezzi) {
        final uno = _indirizzoDa(voce);
        if (uno != null && !indirizzi.contains(uno)) indirizzi.add(uno);
      }
    }
    if (indirizzi.isEmpty) return null;

    final plancia = stringa('plancia');
    final utente = stringa('utente');
    final centralino = caseObj is Map
        ? _comeStringa(caseObj['centralino'])
        : '';
    final casaAlCentralino = caseObj is Map
        ? _comeStringa(caseObj['casa'])
        : '';

    return FogliettoDelMuro(
      dispositivo: dispositivo,
      segno: segno,
      chiave: chiave,
      indirizzi: indirizzi,
      plancia: plancia.isEmpty ? null : plancia,
      utente: utente.isEmpty ? null : utente,
      centralino: centralino.isEmpty ? null : centralino,
      casaAlCentralino: casaAlCentralino.isEmpty ? null : casaAlCentralino,
    );
  }

  /// La casa conosciuta che fa entrare questo pannello: il primo indirizzo e'
  /// quello «dentro casa», dove il pannello sta sempre. L'id interno lo da'
  /// chi la mette nell'archivio.
  CasaConosciuta casaConosciuta({required String id, String nome = 'Casa'}) {
    final primo = _ponteDa(indirizzi.first);
    return CasaConosciuta(
      id: id,
      nome: nome,
      segno: segno,
      identificativo: dispositivo,
      chiave: chiave,
      inCasa: primo,
      casaAlCentralino: casaAlCentralino,
      plancia: plancia,
    );
  }
}

/// Un indirizzo «host» o «host:porta» da una voce del foglietto (stringa o
/// oggetto). `null` se non se ne cava un host.
String? _indirizzoDa(Object? voce) {
  if (voce is String) {
    final t = voce.trim();
    return t.isEmpty ? null : t;
  }
  if (voce is Map) {
    final host = _comeStringa(voce['casa']).isNotEmpty
        ? _comeStringa(voce['casa'])
        : _comeStringa(voce['host']);
    if (host.isEmpty) return null;
    final porta = voce['porta'];
    return porta is num ? '$host:${porta.toInt()}' : host;
  }
  return null;
}

String _comeStringa(Object? v) => v is String ? v.trim() : '';

/// Un IndirizzoDelPonte da «host» o «host:porta».
IndirizzoDelPonte _ponteDa(String indirizzo) {
  final parti = indirizzo.split(':');
  if (parti.length == 2) {
    final porta = int.tryParse(parti[1]);
    if (porta != null) return IndirizzoDelPonte(casa: parti[0], porta: porta);
  }
  return IndirizzoDelPonte(casa: indirizzo);
}
