/// Il modello degli apparecchi deve scrivere la forma che la plancia si aspetta.
///
/// La regola che queste prove tengono ferma e' una sola, ed e' scritta cinque
/// volte nel codice della plancia accanto ad altrettanti campi spariti davvero:
/// **un campo che il modello non conosce non sopravvive alla prima
/// normalizzazione**. Se l'app scrive qualcosa che `normalizeDevice` non
/// dichiara, la plancia lo butta appena rilegge, e chi ha configurato pensa che
/// il salvataggio non abbia funzionato.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/plancia/apparecchio.dart';

void main() {
  group('un apparecchio', () {
    test('nasce con un identificativo della sua sezione', () {
      final uno = Apparecchio.nuovo(Sezione.auto);
      expect(uno.id, startsWith('ev-'));
      expect(uno.dentro['section'], 'ev');
    });

    test('due nati insieme non hanno lo stesso identificativo', () {
      final quali = {
        for (var i = 0; i < 50; i += 1) Apparecchio.nuovo(Sezione.luci).id,
      };
      expect(quali.length, 50);
    });

    test('tiene i campi che la plancia conosce', () {
      final uno = Apparecchio.da({
        'name': 'Lavatrice',
        'entity': 'sensor.lavatrice',
      }, sezione: Sezione.elettrodomestici);
      expect(uno.dentro['enabled'], isTrue);
      expect(uno.dentro['order'], 0);
      expect(uno.dentro['metadata'], isEmpty);
      expect(uno.tutteLeEntita, ['sensor.lavatrice']);
    });

    test('«Generico» non e\' un nome', () {
      /* La plancia lo tratta come «senza nome»: se l'app lo scrivesse davvero,
       * la tessera direbbe «Generico» invece del nome vero. */
      final uno = Apparecchio.da({
        'name': 'Generico',
      }, sezione: Sezione.elettrodomestici);
      expect(uno.nome, '');
    });

    test('un emoji finisce nel campo giusto, e mdi: nell\'altro', () {
      final conEmoji = Apparecchio.da({
        'icon': '🧺',
      }, sezione: Sezione.elettrodomestici);
      expect(conEmoji.emoji, '🧺');
      expect(conEmoji.dentro['icon'], '');
      final conMdi = Apparecchio.da({
        'icon': 'mdi:washing-machine',
      }, sezione: Sezione.elettrodomestici);
      expect(conMdi.dentro['icon'], 'mdi:washing-machine');
      expect(conMdi.emoji, '');
    });

    test('l\'immagine sta in tutt\'e due i campi', () {
      /* La plancia legge `image` in un posto e `image_url` in un altro. */
      final uno = Apparecchio.da({
        'image_url': '/local/auto.png',
      }, sezione: Sezione.auto);
      expect(uno.dentro['image'], '/local/auto.png');
      expect(uno.dentro['image_url'], '/local/auto.png');
    });

    test('le entita\' si raccolgono da tutti i campi che le portano', () {
      final uno = Apparecchio.da({
        'entity': 'switch.forno',
        'power_entity': 'sensor.forno_potenza',
        'entities': ['sensor.forno_ciclo', 'switch.forno'],
      }, sezione: Sezione.elettrodomestici);
      /* Senza doppioni, e nell'ordine della plancia: i campi dichiarati nel
       * suo `deviceEntities` — dove `entity` viene **per ultimo**, dopo la
       * potenza e le energie — e poi quelli dell'elenco. */
      expect(uno.tutteLeEntita, [
        'sensor.forno_potenza',
        'switch.forno',
        'sensor.forno_ciclo',
      ]);
    });

    test('cambiare un\'entita\' rifa\' l\'elenco', () {
      final uno = Apparecchio.da({
        'entity': 'switch.uno',
      }, sezione: Sezione.prese);
      uno.metti('entity', 'switch.due');
      expect(uno.tutteLeEntita, ['switch.due']);
    });

    test('un campo svuotato si toglie invece di restare vuoto', () {
      final uno = Apparecchio.da({
        'name': 'Forno',
      }, sezione: Sezione.elettrodomestici);
      uno.metti('name', '   ');
      expect(uno.dentro.containsKey('name'), isFalse);
    });
  });

  group('la stanza', () {
    final stanze = [
      Apparecchio.da({
        'id': 'room-cucina',
        'name': 'Cucina',
      }, sezione: Sezione.stanze),
      Apparecchio.da({
        'id': 'room-salotto',
        'name': 'Salotto',
      }, sezione: Sezione.stanze),
    ];

    test(
      'si scrive con l\'id e col nome, che la plancia vuole tutti e due',
      () {
        final uno = Apparecchio.nuovo(Sezione.luci)
          ..mettiLaStanza(stanze.first);
        expect(uno.idDellaStanza, 'room-cucina');
        expect(uno.stanza, 'Cucina');
      },
    );

    test('un nome scritto a mano trova il suo id', () {
      final uno = Apparecchio.da(
        {'name': 'Faretti', 'room': 'Salotto'},
        sezione: Sezione.luci,
        stanze: stanze,
      );
      expect(uno.idDellaStanza, 'room-salotto');
    });

    test('spostandola, il nome accanto non resta quello di prima', () {
      /* E' il difetto scritto per esteso nel modello della plancia: cambiava
       * solo l'id, e mezza dozzina di sezioni che leggono il nome mostravano
       * ancora la stanza da cui il dispositivo era appena uscito. */
      final uno = Apparecchio.da(
        {'room_id': 'room-salotto', 'room': 'Cucina'},
        sezione: Sezione.luci,
        stanze: stanze,
      );
      expect(uno.stanza, 'Salotto');
    });

    test('toglierla toglie tutti e due i campi', () {
      final uno = Apparecchio.nuovo(Sezione.luci)
        ..mettiLaStanza(stanze.first)
        ..mettiLaStanza(null);
      expect(uno.dentro.containsKey('room_id'), isFalse);
      expect(uno.dentro.containsKey('room'), isFalse);
    });
  });

  group('i campi che la plancia butterebbe', () {
    test('quelli che conosce restano', () {
      final una = Apparecchio.da({
        'entity': 'cover.cucina',
        'contact': 'binary_sensor.cucina',
        'contact_out': 'binary_sensor.inferriata',
      }, sezione: Sezione.finestre);
      expect(una.campiCheSparirebbero, isEmpty);
    });

    test('una telecamera tiene rtsp, stream e «dal vivo»', () {
      final una = Apparecchio.da({
        'entity': 'camera.ingresso',
        'rtsp': 'rtsp://casa/1',
        'stream': 'ingresso',
        'vivo': true,
      }, sezione: Sezione.telecamere);
      expect(una.campiCheSparirebbero, isEmpty);
    });

    test('un campo inventato si vede subito', () {
      /* E' la prova che serve a noi: se un giorno una schermata scrive un
       * campo che il modello non dichiara, si scopre qui e non su un
       * telefono, quando quel campo e' gia' sparito. */
      final uno = Apparecchio.da({'boh': 'qualcosa'}, sezione: Sezione.luci);
      expect(uno.campiCheSparirebbero, {'boh'});
    });

    test('il contatto di una finestra non vale per una luce', () {
      final una = Apparecchio.da({
        'contact': 'binary_sensor.x',
      }, sezione: Sezione.luci);
      expect(una.campiCheSparirebbero, {'contact'});
    });
  });

  group('l\'elenco', () {
    test('le luci arrivano come mappa e tornano mappa', () {
      /* E' la forma piu' vecchia, e la plancia la converte: chi ha una
       * configurazione di prima non deve ritrovarsi le luci sparite. */
      final quali = leggiGliApparecchi({
        'light.cucina': 'Cucina',
        'switch.giardino': 'Giardino',
      }, sezione: Sezione.luci);
      expect(quali.length, 2);
      expect(quali.first.nome, 'Cucina');
      expect(quali.first.entita, 'light.cucina');
      final riscritte = scriviGliApparecchi(quali, Sezione.luci);
      expect(riscritte, {
        'light.cucina': 'Cucina',
        'switch.giardino': 'Giardino',
      });
    });

    test('un oggetto solo vale come elenco di uno', () {
      final quali = leggiGliApparecchi({
        'name': 'La mia auto',
      }, sezione: Sezione.auto);
      expect(quali.single.nome, 'La mia auto');
    });

    test('l\'ordine si scrive quando non c\'e\'', () {
      final quali = leggiGliApparecchi([
        {'name': 'Una'},
        {'name': 'Due'},
        {'name': 'Tre', 'order': 9},
      ], sezione: Sezione.telecamere);
      expect(quali.map((una) => una.ordine), [0, 1, 9]);
    });

    test('quello che non e\' un elenco non fa cadere niente', () {
      expect(leggiGliApparecchi(null, sezione: Sezione.luci), isEmpty);
      expect(leggiGliApparecchi('boh', sezione: Sezione.luci), isEmpty);
    });
  });

  proveDellIdentificativo();
}

/* Il collaudo ha visto la schermata di una luce cadere con «max must be in
 * range 0 < max ≤ 2^32, was 0»: `1 << 32` sul web vale zero. */
void proveDellIdentificativo() {
  group('l\'identificativo', () {
    test('si fabbrica anche sul web, dove i bit sono trentadue', () {
      /* Se il numero a caso nascesse da `1 << 32` questa riga cadrebbe
       * compilata per il web, e non qui: quello che si prova e' che il
       * numero stia dentro i trentadue bit di una macchina qualunque. */
      for (var quale = 0; quale < 200; quale += 1) {
        final id = fabbricaUnId('lights');
        expect(id, startsWith('lights-'));
        expect(id.split('-').length, 3);
      }
    });

    test('due di fila non sono lo stesso', () {
      final visti = {
        for (var quale = 0; quale < 200; quale += 1) fabbricaUnId('x'),
      };
      expect(visti.length, greaterThan(190));
    });
  });
}
