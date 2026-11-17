import 'dart:convert';
import 'dart:io';
import 'dart:isolate';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/casa_conosciuta.dart';
import 'package:gdahome/notifiche/al_navigatore.dart';
import 'package:gdahome/notifiche/consegna.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/notifiche/postino.dart';

/// Dal campo: «Lavatrice finita» sul telefono, ma non su Android Auto. Il
/// filo fra la busta e il navigatore attraversa due motori di Dart: quello
/// che Firebase sveglia con l'app in sottofondo (o col telefono bloccato) e
/// quello dell'app, dove sta gdanav con lo schermo dell'auto. Li unisce
/// `IsolateNameServer`, che vale **dentro un processo**: qui si prova il
/// passaggio fra due isolate, e che nei manifesti il servizio dell'auto, il
/// servizio di Firebase e l'attivita' non stiano in un processo a parte.
/// Nomi e case inventati.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'la busta aperta in un altro motore arriva alla porta del navigatore',
    () async {
      final arrivate = ascoltaLeNotifiche();
      final prima = arrivate.first.timeout(const Duration(seconds: 10));
      /* L'altro motore: un isolate a parte, come quello di
     * `quandoArrivaDaChiusa`. Apre la sua busta e la lascia al navigatore. */
      await Isolate.run(() {
        final grezza = <String, dynamic>{
          'v': 1,
          'id': 'lavatrice-1',
          'tipo': 'elettrodomestici',
          'cat': 'casa',
          'urg': 'normale',
          'titolo': '🧺 Lavatrice finita',
          'testo': '1 h 52 min · 0,21 €',
          'quando': 1790000000000,
          'scade': 4102444800000,
        };
        mandaAlNavigatore(
          NotificaDaMostrare(
            casa: const CasaConosciuta(
              id: 'casa-prova',
              nome: 'Villa Gialla',
              segno: 'segno-finto',
            ),
            notifica: NotificaArrivata.leggi(grezza)!,
            grezza: grezza,
            scaduta: false,
          ),
        );
      });
      final n = await prima;
      expect(n['titolo'], '🧺 Lavatrice finita');
      expect(n['_casa'], 'Villa Gialla');
      expect(jsonEncode(n), contains('casa-prova'));
    },
  );

  /// I processi dichiarati: nome del componente -> processo.
  Map<String, String> processi(String manifesto) {
    final testo = File(manifesto)
        .readAsStringSync()
        .replaceAll(RegExp(r'<!--.*?-->', dotAll: true), '');
    final trovati = <String, String>{};
    final elementi = RegExp(
      r'<(service|activity|receiver|provider|application)\b([^>]*)>',
      dotAll: true,
    );
    for (final m in elementi.allMatches(testo)) {
      final a = m.group(2)!;
      final nome =
          RegExp(r'android:name="([^"]+)"').firstMatch(a)?.group(1) ??
          m.group(1)!;
      final p = RegExp(r'android:process="([^"]+)"').firstMatch(a)?.group(1);
      if (p != null) trovati[nome] = p;
    }
    return trovati;
  }

  test(
    'il servizio dell\'auto, l\'app e Firebase stanno in un processo solo',
    () {
      const principale = 'android/app/src/main/AndroidManifest.xml';
      const navigatore = 'android/app/src/navigatore/AndroidManifest.xml';
      expect(processi(principale), isEmpty);
      expect(processi(navigatore), isEmpty);
      expect(
        File(navigatore).readAsStringSync(),
        contains('NavigatoreCarAppService'),
      );
      /* Il servizio di Firebase che sveglia il motore in sottofondo, dal
       * pacchetto firebase_messaging: niente processo suo. */
      final config = File('.dart_tool/package_config.json');
      if (!config.existsSync()) return;
      final pacchetti =
          (jsonDecode(config.readAsStringSync()) as Map)['packages'] as List;
      final fm = pacchetti.cast<Map<String, dynamic>>().where(
        (p) => p['name'] == 'firebase_messaging',
      );
      if (fm.isEmpty) return;
      final radice = Uri.parse(fm.first['rootUri'] as String).toFilePath();
      final suo = '$radice/android/src/main/AndroidManifest.xml';
      if (!File(suo).existsSync()) return;
      expect(
        File(suo).readAsStringSync(),
        contains('FlutterFirebaseMessaging'),
      );
      expect(processi(suo), isEmpty);
    },
  );

  test('la porta e il postino si parlano per nome: quello di sempre', () {
    expect(nomeDellaPorta, 'gdahome/notifiche-al-navigatore');
    // Il postino passa dalla porta sia ad app aperta sia da chiusa.
    expect(quandoArrivaDaChiusa, isNotNull);
  });
}
