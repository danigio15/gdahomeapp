/// La prima schermata: la pagina dice all'app che e' in piedi.
///
/// Sopra il riquadro l'app tiene «Apro la plancia…», e lo toglieva solo al
/// `load` della pagina, che aspetta tutto: i moduli delle sezioni, i
/// caratteri, ogni foto e ogni istantanea delle telecamere, che da fuori casa
/// passano dal centralino. Adesso la pagina lo dice a `DOMContentLoaded`
/// (`Premesse.laPrimaSchermata`), quando davanti c'e' gia' il velo della
/// plancia, e l'app si scopre li'.
///
/// E' un patto fra tre pezzi — lo script nella pagina, il canale del WebView,
/// il velo della plancia — e qui si tengono allineati. Lo script si fa anche
/// girare davvero, in node, dentro un documento finto: leggerlo soltanto non
/// direbbe se parla quando deve.
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/pannello.dart';
import 'package:gdahome/plancia/premesse.dart';

/// La plancia non sta dentro `app/`: sta nel ponte, e le prove dell'app
/// girano con la cartella `app/` sotto i piedi.
File _dellaPlancia(String dentro) => File('../ponte/plancia/$dentro');

/// Node c'e'? Senza, le prove che fanno girare lo script si saltano invece di
/// rompersi: e' la stessa regola delle prove col ponte vero.
bool get _cENode {
  try {
    return Process.runSync('node', ['--version']).exitCode == 0;
  } catch (_) {
    return false;
  }
}

/// Fa girare lo script in un documento finto e torna quante volte la pagina
/// ha parlato all'app — subito, e dopo ogni `DOMContentLoaded` — e cosa ha
/// detto.
///
/// [comeSta] e' `document.readyState` quando lo script parte; [colCanale]
/// dice se c'e' il canale del telefono, che nel browser non c'e'.
Future<({List<int> quante, List<String> detti})> _gira({
  String comeSta = 'loading',
  bool colCanale = true,
  int quanteVolteSiDicePronto = 1,
}) async {
  final copione =
      '''
const copione = ${jsonEncode(Premesse.laPrimaSchermata)};
const detti = [];
const ascolti = {};
const finestra = ${colCanale ? '{ gdahomeDice: { postMessage: (m) => detti.push(String(m)) } }' : '{}'};
const documento = {
  readyState: ${jsonEncode(comeSta)},
  addEventListener: (nome, f) => { (ascolti[nome] ||= []).push(f); },
};
new Function("window", "document", copione)(finestra, documento);
const quante = [detti.length];
for (let i = 0; i < $quanteVolteSiDicePronto; i += 1) {
  (ascolti.DOMContentLoaded || []).forEach((f) => f());
  quante.push(detti.length);
}
process.stdout.write(JSON.stringify({ quante, detti }));
''';
  final fatto = await Process.run('node', ['-e', copione]);
  expect(fatto.exitCode, 0, reason: '${fatto.stderr}');
  final letto = jsonDecode(fatto.stdout as String) as Map<String, dynamic>;
  return (
    quante: [for (final n in letto['quante'] as List) n as int],
    detti: [for (final d in letto['detti'] as List) d as String],
  );
}

void main() {
  test('la parola non è il nome di una pagina, e nemmeno quella del menu', () {
    /* Passa sullo stesso canale dei nomi delle pagine: se fosse il nome di
     * una linguetta, andare su quella pagina toglierebbe il velo, e dire che
     * la pagina e' in piedi sposterebbe il menu. */
    expect(laPlanciaSiVede, contains(':'));
    expect(laPlanciaSiVede, isNot(ilMenuDalTelefono));
    for (final quale in const ['home', 'clima', 'energy', 'config']) {
      expect(laPlanciaSiVede, isNot(quale));
    }
  });

  test('sta nello script in testa, e parla sul canale che l\'app ascolta', () {
    final servita =
        Premesse(
          pannello: const PannelloDellaPlancia(
            percorso: 'dashboardmodern',
            titolo: 'DashboardModern',
            base: '/dashboardmodern_static/abc123',
            istanza: 'e1',
            profilo: 'primary',
            primario: true,
            varianti: ['dashboard.html'],
          ),
        ).conLePremesse(
          '<!DOCTYPE html><html><head><title>x</title></head>'
          '<body>la plancia</body></html>',
          ilWebSocket: 'WebSocket',
        );
    final testa = servita.substring(0, servita.indexOf('<title>'));
    expect(testa, contains(Premesse.laPrimaSchermata));
    /* Uno script solo in testa, il nostro: ci si aggiunge, non se ne apre un
     * altro. */
    expect('<script'.allMatches(testa), hasLength(1));
    expect(
      Premesse.laPrimaSchermata,
      contains('window.gdahomeDice.postMessage("$laPlanciaSiVede")'),
    );
    final telefono = File('lib/schermate/riquadro/sul_telefono.dart')
        .readAsStringSync();
    expect(telefono, contains("'gdahomeDice'"));
    expect(telefono, contains('detto == laPlanciaSiVede'));
  });

  test('davanti c\'è il velo della plancia: il primo pezzo del corpo, prima di '
      'ogni script', () {
    /* E' la ragione per cui a `DOMContentLoaded` la pagina si puo' scoprire:
       * quello che si vede e' il velo della plancia, fatto apposta per
       * coprirla finche' non e' pronta. Se un giorno se ne andasse, o
       * arrivasse dopo uno script, sotto il nostro velo ci sarebbe una
       * pagina a meta' — e nessuno se ne accorgerebbe. */
    for (final pagina in [
      'legacy/dashboard.html',
      'legacy/dashboard-en.html',
    ]) {
      final html = _dellaPlancia(pagina).readAsStringSync();
      final corpo = html.indexOf('<body');
      final velo = html.indexOf('id="cd-boot-overlay"');
      final primoScript = html.indexOf('<script', corpo);
      expect(corpo, isNot(-1), reason: pagina);
      expect(velo, greaterThan(corpo), reason: '$pagina: il velo non c\'è');
      expect(
        velo,
        lessThan(primoScript),
        reason: '$pagina: il velo arriva dopo uno script',
      );
    }
  });

  group('lo script, dentro un documento finto', () {
    test('parla a DOMContentLoaded, e prima no', () async {
      final fatto = await _gira();
      expect(fatto.quante, [0, 1]);
      expect(fatto.detti, [laPlanciaSiVede]);
    });

    test('una volta sola, anche se l\'evento torna', () async {
      final fatto = await _gira(quanteVolteSiDicePronto: 2);
      expect(fatto.quante, [0, 1, 1]);
    });

    test('in un documento già intero parla subito', () async {
      /* Non succede con la pagina servita, dove lo script sta in testa: ma
         * uno script che aspetta un evento gia' passato aspetterebbe per
         * sempre, e il velo resterebbe fino al `load`. */
      final fatto = await _gira(
        comeSta: 'interactive',
        quanteVolteSiDicePronto: 0,
      );
      expect(fatto.quante, [1]);
    });

    test('nel browser il canale non c\'è, e non succede niente', () async {
      final fatto = await _gira(colCanale: false);
      expect(fatto.quante, [0, 0]);
    });
  }, skip: _cENode ? false : 'node non c\'è');
}
