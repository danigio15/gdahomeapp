/// Il gzip, aperto dal browser.
///
/// Dal browser i file della plancia arrivavano **crudi**: `dart:io` non c'e',
/// e il ponte saltava la compressione per non mandare byte che qui nessuno
/// sapeva aprire. Fuori casa, a freddo, erano nove megabyte e un quarto invece
/// di tre, e li porta tutti il centralino.
///
/// Il decompressore non c'era da portarselo in casa: ce l'ha il browser. Qui
/// si prova che lo apre davvero, e che apre **quello che manda il ponte** —
/// non quello che il browser ha compresso da se'. I byte della prima prova li
/// ha stampati `node:zlib`, per la stessa strada di `impacchetta`
/// (`gzipSync`, poi base64); se un giorno diventa rossa, la risposta non e'
/// rigenerarli.
///
/// Solo nel browser, e non per zelo: `DecompressionStream` sulla macchina
/// virtuale non esiste, ed e' esattamente la ragione per cui questa prova ha
/// senso.
@TestOn('browser')
library;

import 'dart:convert';
import 'dart:js_interop';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/servitore_qui/sul_web.dart';
import 'package:web/web.dart' as web;

/// Come si rifanno i byte qui sotto, se un giorno servisse:
///
/// ```
/// node -e 'const {gzipSync}=require("node:zlib");
///   console.log(gzipSync(Buffer.from(IL_TESTO,"utf8")).toString("base64"))'
/// ```
const _ilTesto =
    'export const CHIAVE = "gdahome";\n'
    'export function saluta(chi) {\n'
    '  return `ciao \${chi}`;\n'
    '}\n';

const _ilGzipDelPonte =
    'H4sIAAAAAAAAA0utKMgvKlFIzs8rLlFw9vB0DHNVsFVQSk9JzMjPTVWy5kqFKEgrzUsu'
    'yczPUyhOzCktSdRIzsjUVKjmUlAoSi0pLcpTSEjOTMxXUKlOzsisTbDmquUCALxWlVRZ'
    'AAAA';

/// Gli stessi byte, compressi dal browser: serve a fare un file grosso senza
/// scriverne uno grosso qui dentro.
Future<Uint8List> _comprimi(Uint8List byte) async {
  final compressore = web.CompressionStream('gzip');
  final aperta = web.Response(
    web.Response(byte.toJS).body!.pipeThrough(
      web.ReadableWritablePair(
        readable: compressore.readable,
        writable: compressore.writable,
      ),
    ),
  );
  return (await aperta.arrayBuffer().toDart).toDart.asUint8List();
}

void main() {
  test('il browser sa aprire il gzip, e quindi il ponte comprime', () {
    expect(siApreIlGzip, isTrue);
  });

  test('quello che comprime il ponte, qui si apre', () async {
    final aperto = await apriIlGzip(base64.decode(_ilGzipDelPonte));
    expect(utf8.decode(aperto), _ilTesto);
  });

  test('un modulo intero, non solo un pezzo', () async {
    /* Duecentomila caratteri: il gzip esce a pezzi, e leggerne uno solo
     * vorrebbe dire un modulo tagliato a meta' — che e' il difetto che non si
     * vede su una stringa corta. */
    final grosso = List.filled(2500, _ilTesto).join();
    final byte = Uint8List.fromList(utf8.encode(grosso));
    final compresso = await _comprimi(byte);
    expect(compresso.length, lessThan(byte.length ~/ 10));
    final aperto = await apriIlGzip(compresso);
    expect(aperto.length, byte.length);
    expect(aperto, byte);
  });

  test('un file vuoto resta vuoto', () async {
    final compresso = await _comprimi(Uint8List(0));
    expect(await apriIlGzip(compresso), isEmpty);
  });

  test('quello che non è gzip non si apre di nascosto', () async {
    /* Aprire male e' peggio che non aprire: una plancia fatta di byte
     * illeggibili non dice a nessuno cos'e' andato storto. */
    await expectLater(
      apriIlGzip(Uint8List.fromList(utf8.encode('questo non è gzip'))),
      throwsA(anything),
    );
  });
}
