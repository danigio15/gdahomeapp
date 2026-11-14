/// La chiave del cruscotto (o della gestione) consegnata alla pagina del
/// quadro dentro il WebView dell'app.
///
/// Un revisore ha fatto notare due cose, e qui si provano tutt'e due:
///
///  - il riquadro del cruscotto lasciava passare ogni pagina con la stessa
///    casa e lo stesso schema del quadro, **qualunque porta**: una pagina su
///    `https://quadro.gdahome.org:8443` era «del quadro», si caricava li'
///    dentro e si prendeva la chiave;
///  - la consegna era `window.postMessage(…, "*")` scritto nella pagina che
///    c'era in quel momento — anche trecento millisecondi o un secondo e
///    mezzo dopo, senza guardare se la pagina fosse ancora quella.
///
/// Adesso conta l'origine intera (schema, casa, porta effettiva), un
/// indirizzo con credenziali non e' mai del quadro, e la consegna si scrive
/// solo se la pagina di adesso e' quella giusta, con l'origine esatta al
/// posto di `"*"`, e solo nella finestra principale. Lo script si fa anche
/// girare davvero in node, dentro una finestra finta.
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/fuori.dart';

final _quadro = Uri.parse('https://quadro.gdahome.org/console/');

bool get _cENode {
  try {
    return Process.runSync('node', ['--version']).exitCode == 0;
  } catch (_) {
    return false;
  }
}

/// Fa girare il codice della consegna in una finestra finta che sta su
/// [origine], ed e' la principale se [inCima]. Torna i `postMessage` fatti:
/// `[messaggio, origine di destinazione]`.
Future<List<List<Object?>>> _gira(
  String codice, {
  required String origine,
  bool inCima = true,
}) async {
  final copione =
      '''
const fatti = [];
const window = {
  location: { origin: ${jsonEncode(origine)} },
  postMessage: (m, o) => fatti.push([m, o]),
};
window.top = ${inCima ? 'window' : '{}'};
const location = window.location;
new Function("window", "location", ${jsonEncode(codice)})(window, location);
process.stdout.write(JSON.stringify(fatti));
''';
  final fatto = await Process.run('node', ['-e', copione]);
  expect(fatto.exitCode, 0, reason: '${fatto.stderr}');
  return [
    for (final uno in jsonDecode(fatto.stdout as String) as List)
      List<Object?>.from(uno as List),
  ];
}

void main() {
  group('quale pagina e\' del quadro', () {
    test('la stessa casa su un\'altra porta non e\' il quadro', () {
      expect(
        eLaStessaOrigine(
          Uri.parse('https://quadro.gdahome.org:8443/console/'),
          _quadro,
        ),
        isFalse,
      );
      expect(
        eLaStessaOrigine(Uri.parse('https://quadro.gdahome.org:444/'), _quadro),
        isFalse,
      );
    });

    test('la porta di serie e quella scritta per esteso sono la stessa', () {
      expect(
        eLaStessaOrigine(
          Uri.parse('https://quadro.gdahome.org:443/gestore/'),
          _quadro,
        ),
        isTrue,
      );
      expect(
        eLaStessaOrigine(Uri.parse('https://QUADRO.gdahome.org/x'), _quadro),
        isTrue,
      );
      expect(
        eLaStessaOrigine(
          Uri.parse('http://localhost:80/'),
          Uri.parse('http://localhost/'),
        ),
        isTrue,
      );
    });

    test('un indirizzo con credenziali non e\' mai il quadro', () {
      expect(
        eLaStessaOrigine(
          Uri.parse('https://chiunque@quadro.gdahome.org/console/'),
          _quadro,
        ),
        isFalse,
      );
      expect(
        eLaStessaOrigine(
          Uri.parse('https://a:b@quadro.gdahome.org/console/'),
          _quadro,
        ),
        isFalse,
      );
    });

    test('schema diverso, o niente schema web, nemmeno', () {
      expect(
        eLaStessaOrigine(Uri.parse('http://quadro.gdahome.org/'), _quadro),
        isFalse,
      );
      expect(
        eLaStessaOrigine(Uri.parse('about:blank'), Uri.parse('about:blank')),
        isFalse,
      );
    });

    test('l\'origine si scrive come la scrive un browser', () {
      expect(
        lOrigineDi(Uri.parse('https://quadro.gdahome.org:443/a')),
        'https://quadro.gdahome.org',
      );
      expect(
        lOrigineDi(Uri.parse('https://quadro.gdahome.org:8443/a')),
        'https://quadro.gdahome.org:8443',
      );
      expect(lOrigineDi(Uri.parse('http://[::1]:8080/')), 'http://[::1]:8080');
      expect(lOrigineDi(Uri.parse('https://u@quadro.gdahome.org/')), isNull);
    });
  });

  group('la consegna', () {
    test('si scrive solo se la pagina di adesso e\' quella del quadro', () {
      for (final adesso in [
        null,
        '',
        'about:blank',
        'https://quadro.gdahome.org:8443/console/',
        'https://altro.example/',
        'https://x@quadro.gdahome.org/console/',
      ]) {
        expect(
          ilCodiceDellaConsegna(
            chiave: 'segreta',
            pagina: _quadro,
            adesso: adesso,
          ),
          isNull,
          reason: 'con la pagina «$adesso» la chiave non deve partire',
        );
      }
      expect(
        ilCodiceDellaConsegna(
          chiave: 'segreta',
          pagina: _quadro,
          adesso: 'https://quadro.gdahome.org/console/#qualcosa',
        ),
        isNotNull,
      );
    });

    test('mai a un quadro in chiaro, mai una chiave vuota', () {
      expect(
        ilCodiceDellaConsegna(
          chiave: 'segreta',
          pagina: Uri.parse('http://quadro.gdahome.org/console/'),
          adesso: 'http://quadro.gdahome.org/console/',
        ),
        isNull,
      );
      expect(
        ilCodiceDellaConsegna(
          chiave: '',
          pagina: _quadro,
          adesso: 'https://quadro.gdahome.org/console/',
        ),
        isNull,
      );
    });

    test('niente "*": l\'origine esatta del quadro', () {
      final codice = ilCodiceDellaConsegna(
        chiave: 'segreta',
        pagina: _quadro,
        adesso: 'https://quadro.gdahome.org/console/',
      )!;
      expect(codice, isNot(contains('"*"')));
      expect(codice, contains('"https://quadro.gdahome.org"'));
    });

    test(
      'girato davvero: consegna solo alla finestra principale del quadro',
      () async {
        final codice = ilCodiceDellaConsegna(
          chiave: 'se"gr\'eta',
          pagina: _quadro,
          adesso: 'https://quadro.gdahome.org/console/',
        )!;

        final giusta = await _gira(
          codice,
          origine: 'https://quadro.gdahome.org',
        );
        expect(giusta, hasLength(1));
        expect(giusta.single[0], {'gdahome': 'chiave', 'chiave': 'se"gr\'eta'});
        expect(giusta.single[1], 'https://quadro.gdahome.org');

        /* La pagina e' cambiata fra il controllo dell'app e lo script: lo
         * script se ne accorge da se'. */
        expect(
          await _gira(codice, origine: 'https://quadro.gdahome.org:8443'),
          isEmpty,
        );
        /* Una cornice dentro la pagina non e' la pagina. */
        expect(
          await _gira(
            codice,
            origine: 'https://quadro.gdahome.org',
            inCima: false,
          ),
          isEmpty,
        );
      },
      skip: _cENode ? false : 'node non c\'e\'',
    );
  });
}
