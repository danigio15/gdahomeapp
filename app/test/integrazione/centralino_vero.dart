/// Il centralino vero, acceso per davvero.
///
/// Un processo `node` che lo alza con `alzaIlCentralino`, la stessa funzione
/// che usa `centralino/src/index.js` su un server, con il suo archivio delle
/// case. Serve a una prova sola ma importante — quella in cui il telefono non
/// ha **nessun** indirizzo della casa e ci arriva lo stesso.
///
/// Una cosa sola e' diversa dal server: la chiave delle licenze e' vuota. Qui
/// si prova la strada da fuori, non la licenza; e il giorno che la chiave e'
/// scritta anche nel centralino, una casa di prova non ha un gettone firmato
/// dal quadro vero, e il centralino la chiuderebbe fuori.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'porte.dart';

class CentralinoVero {
  CentralinoVero._(this._processo, this._archivio, this.porta);

  final Process _processo;
  final Directory _archivio;
  final int porta;

  final List<String> registro = [];

  /// Come ci arriva il ponte, e come ci arriva il telefono.
  String get dove => 'ws://127.0.0.1:$porta';

  static Directory get cartella {
    var qui = Directory.current;
    for (var i = 0; i < 4; i += 1) {
      final forse = Directory('${qui.path}/centralino');
      if (forse.existsSync()) return forse;
      qui = qui.parent;
    }
    throw StateError('non trovo la cartella del centralino');
  }

  /// Accende il centralino, e se la porta gliel'hanno soffiata riprova.
  /// Il perche' sta in `porte.dart`.
  static Future<CentralinoVero> accendi() async {
    for (var tentativo = 1; ; tentativo += 1) {
      try {
        return await _unTentativo();
      } on PortaOccupata catch (guaio) {
        if (tentativo == quantiTentativi) {
          throw StateError(
            'il centralino non si è alzato: la porta era occupata '
            '$quantiTentativi volte di fila.\n${guaio.registro}',
          );
        }
      }
    }
  }

  static Future<CentralinoVero> _unTentativo() async {
    final archivio = await Directory.systemTemp.createTemp(
      'centralino-collaudo-',
    );
    final porta = (await porteLibere(1)).single;

    final alza = File('${archivio.path}/alza.mjs');
    await alza.writeAsString(
      'import { alzaIlCentralino } from '
      '${jsonEncode(Uri.file('${cartella.path}/src/index.js').toString())};\n'
      'const acceso = await alzaIlCentralino({ chiaveLicenze: "" });\n'
      'for (const segnale of ["SIGTERM", "SIGINT"]) {\n'
      '  process.on(segnale, () => acceso.abbassa().finally(() => '
      'process.exit(0)));\n'
      '}\n',
    );

    final processo = await Process.start(
      'node',
      [alza.path],
      environment: {
        'CENTRALINO_PORTA': '$porta',
        'CENTRALINO_DATI': archivio.path,
        'CENTRALINO_REGISTRO': 'debug',
      },
    );

    final centralino = CentralinoVero._(processo, archivio, porta);
    processo.stdout
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen(centralino.registro.add);
    processo.stderr
        .transform(utf8.decoder)
        .transform(const LineSplitter())
        .listen(centralino.registro.add);

    try {
      await centralino._aspettaCheSiaVivo();
    } catch (_) {
      await centralino.spegni();
      if (parlaDiPortaOccupata(centralino.registro)) {
        throw PortaOccupata(centralino.registro.join('\n'));
      }
      rethrow;
    }
    return centralino;
  }

  Future<void> _aspettaCheSiaVivo() async {
    /* Morto durante l'avvio: si smette subito invece di aspettare il resto
     * dei quindici secondi. */
    var caduto = false;
    unawaited(_processo.exitCode.then((_) => caduto = true));

    final fine = DateTime.now().add(const Duration(seconds: 15));
    while (DateTime.now().isBefore(fine)) {
      try {
        if ((await salute())['vivo'] == true) return;
      } catch (_) {
        /* Non e' ancora su. */
      }
      if (caduto) {
        /* Un istante perche' le ultime righe di `stderr` arrivino. */
        await Future<void>.delayed(const Duration(milliseconds: 200));
        break;
      }
      await Future<void>.delayed(const Duration(milliseconds: 100));
    }
    throw StateError('il centralino non si è alzato:\n${registro.join('\n')}');
  }

  /// Quante case sono collegate adesso. E' cosi' che si aspetta che il ponte
  /// abbia finito di chiamare fuori.
  Future<int> quanteCase() async => (await salute())['case'] as int? ?? 0;

  Future<Map<String, dynamic>> salute() async {
    final cliente = HttpClient();
    try {
      final richiesta = await cliente.getUrl(
        Uri.parse('http://127.0.0.1:$porta/salute'),
      );
      final risposta = await richiesta.close();
      final letto = jsonDecode(await risposta.transform(utf8.decoder).join());
      return letto is Map<String, dynamic> ? letto : {};
    } finally {
      cliente.close(force: true);
    }
  }

  Future<void> spegni() async {
    _processo.kill(ProcessSignal.sigterm);
    await _processo.exitCode.timeout(
      const Duration(seconds: 5),
      onTimeout: () {
        _processo.kill(ProcessSignal.sigkill);
        return -1;
      },
    );
    if (_archivio.existsSync()) await _archivio.delete(recursive: true);
  }
}
