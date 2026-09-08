/// Le prove delle tessere della Home.
///
/// I numeri sono quelli che la plancia web scrive sulle sue anteprime, sulla
/// stessa casa demo: LUCI 4, CLIMA 22,5°, FINESTRE 3, SICUREZZA Inserito,
/// ENERGIA 7,66 kW, TEMPERATURA 21,8°… Se qui esce un numero diverso, una
/// delle due plance sta sbagliando, e quasi sempre e' questa.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/configurazione.dart';
import 'package:gdahome/plancia/numeri.dart';
import 'package:gdahome/plancia/tessere.dart';

import 'casa_demo.dart';

void main() {
  final demo = CasaDemo.leggi();
  final config = demo.configurazione;
  final adesso = DateTime(2026, 9, 8, 12, 40);

  Tessera tessera(List<Tessera> tutte, String chiave) => tutte.firstWhere(
    (t) => t.chiave == chiave,
    orElse: () =>
        throw StateError('manca «$chiave» fra ${tutte.map((t) => t.chiave)}'),
  );

  test('i numeri si scrivono come sulla plancia', () {
    expect(numero(21.83), '21,8');
    expect(numero(7660 / 1000, cifre: 2), '7,66');
    expect(numero(1240, cifre: 0), '1.240');
    expect(numero(-0.04), '-0,0');
    expect(numero(null), '—');
    expect(watt(6480), '6,48 kW');
    expect(watt(84), '84 W');
    expect(watt(null), '—');
  });

  test(
    'sulla casa demo escono le stesse tessere della plancia web, in ordine',
    () {
      final tutte = tessereDellaHome(config, demo.stato, adesso: adesso);
      expect(tutte.map((t) => t.chiave), [
        'luci',
        'clima',
        'tapparelle',
        'sicurezza',
        'telecamere',
        'energia',
        'elettrodomestici',
        'temperatura',
        'ev',
        'robot',
        'solare',
        'ups',
        'minipc',
        'piscina',
        'prese',
        'media',
        'irrigazione',
        'custom-0',
      ]);
      expect(
        intestazioneDeiWidget(tutte),
        '18 sezioni · 1 chiede attenzione: Finestra cucina',
      );
    },
  );

  test('luci, clima, finestre', () {
    final tutte = tessereDellaHome(config, demo.stato, adesso: adesso);
    final luci = tessera(tutte, 'luci');
    expect(luci.valore, '4');
    expect(
      luci.didascalia,
      'Faretti soggiorno · Strip TV · LED cucina · Specchio bagno',
    );
    expect(luci.anello, 50);
    expect(luci.accesa, isTrue);
    expect(luci.misura, Misura.punti);
    expect(luci.segmenti, 6);
    expect(luci.segmentiAccesi, 3);
    expect(luci.righe.where((r) => r.stanza == 'Soggiorno').length, 2);

    final clima = tessera(tutte, 'clima');
    expect(clima.valore, '22,5°');
    expect(clima.valoreDiviso, ('22,5', '°'));
    expect(
      clima.didascalia,
      'Clima soggiorno · Clima cameretta · Termostato zona giorno',
    );
    expect(clima.anello, 60);

    final finestre = tessera(tutte, 'tapparelle');
    expect(finestre.etichetta, 'Finestre');
    expect(finestre.valore, '3');
    expect(
      finestre.didascalia,
      'Tapparella soggiorno · Tapparella cucina · Tapparella cameretta',
    );
  });

  test('sicurezza, telecamere, energia con due impianti', () {
    final tutte = tessereDellaHome(config, demo.stato, adesso: adesso);
    final sicurezza = tessera(tutte, 'sicurezza');
    expect(sicurezza.valore, 'Inserito');
    expect(sicurezza.valoreDiviso, ('Inserito', ''));
    expect(sicurezza.didascalia, 'Portone');
    expect(sicurezza.allarme, isFalse);
    expect(sicurezza.colore, '#10b981');
    expect(
      sicurezza.misura,
      Misura.punti,
      reason: 'due porte fanno due segmenti',
    );

    expect(tessera(tutte, 'telecamere').valore, '2');
    expect(tessera(tutte, 'telecamere').didascalia, 'Ingresso');

    final energia = tessera(tutte, 'energia');
    expect(energia.valore, '7,66 kW', reason: 'la casa piu\' la dependance');
    expect(energia.valoreDiviso, ('7,66', 'kW'));
    expect(energia.didascalia, 'Oggi 14,6 kWh');
    expect(energia.righe.map((r) => r.nome), [
      'Casa',
      'Solare',
      'Rete',
      'Batteria',
    ]);
  });

  test('elettrodomestici, temperatura, auto, robot', () {
    final tutte = tessereDellaHome(config, demo.stato, adesso: adesso);
    final elettrodomestici = tessera(tutte, 'elettrodomestici');
    expect(elettrodomestici.valore, '4');
    expect(
      elettrodomestici.didascalia,
      'Lavatrice · Lavastoviglie · Frigorifero · Robot aspirapolvere',
    );
    expect(
      elettrodomestici.righe.firstWhere((r) => r.nome == 'Asciugatrice').valore,
      'Standby',
    );

    final temperatura = tessera(tutte, 'temperatura');
    expect(temperatura.valore, '21,8°');
    expect(temperatura.didascalia, 'Umidità 51%');
    expect(temperatura.misura, Misura.nessuna);

    final auto = tessera(tutte, 'ev');
    expect(auto.valore, '74%');
    expect(auto.didascalia, '312 km');
    expect(
      auto.attiva,
      isTrue,
      reason: '«Ricarica solare» vuol dire attaccata',
    );
    expect(auto.misura, Misura.batteria);
    expect(auto.righe.take(3).map((r) => r.valore), [
      '74%',
      '312 km',
      'In carica',
    ]);

    final robot = tessera(tutte, 'robot');
    expect(robot.valore, '1');
    expect(robot.didascalia, 'al lavoro');
    expect(robot.righe.single.valore, 'Sta pulendo · 63%');
  });

  test('solare termico, continuita\', MiniPC, piscina', () {
    final tutte = tessereDellaHome(config, demo.stato, adesso: adesso);
    final solare = tessera(tutte, 'solare');
    expect(solare.valore, '68,4°');
    expect(solare.didascalia, 'Pompa in funzione');
    expect(solare.accesa, isTrue);

    final ups = tessera(tutte, 'ups');
    expect(ups.valore, '100%');
    expect(ups.didascalia, 'Rete presente · carico 23%');
    expect(ups.allarme, isFalse);

    final minipc = tessera(tutte, 'minipc');
    expect(minipc.valore, '18%');
    expect(minipc.didascalia, 'RAM 46% · Disco 62%');

    final piscina = tessera(tutte, 'piscina');
    expect(piscina.valore, '27,4°');
    expect(piscina.didascalia, 'pH 7,2');
  });

  test('prese, musica, irrigazione, l\'avviso della finestra', () {
    final tutte = tessereDellaHome(config, demo.stato, adesso: adesso);
    final prese = tessera(tutte, 'prese');
    expect(prese.valore, '3');
    expect(
      prese.righe.firstWhere((r) => r.nome == 'Modem').comando,
      isFalse,
      reason: 'il modem si guarda e basta',
    );

    final musica = tessera(tutte, 'media');
    expect(musica.valore, '2');
    expect(
      musica.didascalia,
      'Salone: Nuvole bianche — Ludovico Einaudi · Cucina: Radio Deejay — Deejay Chiama Italia',
    );

    final irrigazione = tessera(tutte, 'irrigazione');
    expect(irrigazione.valore, '1');
    expect(irrigazione.didascalia, 'zone in funzione');

    final avviso = tessera(tutte, 'custom-0');
    expect(avviso.etichetta, 'Finestra cucina');
    expect(avviso.valore, '1');
    expect(avviso.allarme, isTrue);
    expect(avviso.simbolo, '🪟');
    expect(
      tutte.where((t) => t.chiave == 'custom-1'),
      isEmpty,
      reason: 'la porta d\'ingresso e\' chiusa',
    );
  });

  test('quando cambia la casa cambiano le tessere', () {
    final leggi = demo.con({
      'alarm_control_panel.casa': entita(
        'alarm_control_panel.casa',
        'triggered',
      ),
      'binary_sensor.finestra_cucina': entita(
        'binary_sensor.finestra_cucina',
        'off',
      ),
      'light.soggiorno_faretti': entita(
        'light.soggiorno_faretti',
        'off',
        attributi: {'friendly_name': 'Faretti soggiorno'},
      ),
    });
    final tutte = tessereDellaHome(config, leggi, adesso: adesso);
    final sicurezza = tessera(tutte, 'sicurezza');
    expect(sicurezza.valore, 'Allarme!');
    expect(sicurezza.allarme, isTrue);
    expect(sicurezza.colore, '#e11d48');
    expect(tessera(tutte, 'luci').valore, '3');
    expect(tutte.where((t) => t.chiave.startsWith('custom-')), isEmpty);
    expect(
      intestazioneDeiWidget(tutte),
      '17 sezioni · 1 chiede attenzione: Sicurezza',
    );
  });

  test('le preferenze: tessere nascoste, ordine scelto, entita\' fuori', () {
    final valori = Map<String, Object?>.from(
      demo.risposta['snapshot']['values'] as Map,
    );
    valori['cd_widgets'] = '{"hidden":["custom","telecamere"],"order":["temperatura","luci"],"excluded":["light.soggiorno_strip"]}';
    final con = ConfigurazioneDellaPlancia.daiValori(valori);
    final tutte = tessereDellaHome(con, demo.stato, adesso: adesso);
    expect(tutte.take(2).map((t) => t.chiave), ['temperatura', 'luci']);
    expect(
      tutte.where(
        (t) => t.chiave == 'telecamere' || t.chiave.startsWith('custom-'),
      ),
      isEmpty,
    );
    expect(
      tessera(tutte, 'luci').valore,
      '3',
      reason: 'la strip e\' fuori dal widget',
    );
    expect(tessera(tutte, 'luci').righe.length, 7);
  });

  test('una plancia non configurata non ha tessere', () {
    expect(
      tessereDellaHome(ConfigurazioneDellaPlancia.vuota, demo.stato),
      isEmpty,
    );
  });

  test('le parole di stato di un elettrodomestico', () {
    expect(letturaDelloStato('Lavaggio'), 'running');
    expect(letturaDelloStato('in_progress'), 'running');
    expect(letturaDelloStato('Delayed start'), 'standby');
    expect(letturaDelloStato('program_ended'), 'off');
    expect(letturaDelloStato('boh'), '');
  });

  test('l\'auto alla presa: le negazioni prima', () {
    expect(autoAllaPresa('Ricarica solare'), isTrue);
    expect(autoAllaPresa('not_charging'), isFalse);
    expect(autoAllaPresa('unplugged'), isFalse);
    expect(autoAllaPresa('C'), isTrue);
    expect(autoAllaPresa('A'), isFalse);
  });

  test('la rete dell\'UPS dalle sigle di NUT', () {
    expect(reteDalloStato('OL CHRG'), isTrue);
    expect(reteDalloStato('OB DISCHRG'), isFalse);
    expect(reteDalloStato('on'), isTrue);
    expect(reteDalloStato('boh'), isNull);
  });
}
