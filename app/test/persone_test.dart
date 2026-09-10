/// Le prove delle persone, e del loro ritratto.
///
/// Quello che si salva sono **le scelte**, non un'immagine: a disegnarle e' il
/// compositore della plancia. Quindi la cosa che conta qui e' che le scelte si
/// scrivano come le scrive la Config della dashboard — stesse file, stessi
/// valori — perche' la stessa persona abbia la stessa faccia da tutte e due le
/// parti.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/plancia/lettere.dart';
import 'package:gdahome/casa/plancia/persone.dart';

void main() {
  group('Il ritratto', () {
    test('chi non ne ha uno non ne ha uno', () {
      expect(RitrattoScelto.da(null), isNull);
      expect(RitrattoScelto.da('ciao'), isNull);
      expect(RitrattoScelto.da(const {})?.persona, 'uomo');
    });

    test('un valore che non esiste torna al primo della fila', () {
      final quale = RitrattoScelto.da(const {
        'persona': 'marziano',
        'carnagione': 'verde',
        'vestito': 'tuta da palombaro',
      })!;
      expect(quale.persona, 'uomo');
      expect(quale.carnagione, 'chiara');
      expect(quale.vestito, 'nessuno');
    });

    test('le facce fatte con la versione di prima non si perdono', () {
      /* «barba», «rossi», «bianchi» e «biondi» erano tagli. Adesso sono un
       * taglio piu' una barba o un colore: chi si era fatto la faccia allora
       * non deve ritrovarsi senza. */
      final barbuto = RitrattoScelto.da(const {'capelli': 'barba'})!;
      expect(barbuto.capelli, 'lisci');
      expect(barbuto.barba, 'corta');

      final rosso = RitrattoScelto.da(const {'capelli': 'rossi'})!;
      expect(rosso.capelli, 'lisci');
      expect(rosso.coloreCapelli, 'rosso');

      final biondo = RitrattoScelto.da(const {'capelli': 'biondi'})!;
      expect(biondo.coloreCapelli, 'biondo');

      final bianco = RitrattoScelto.da(const {'capelli': 'bianchi'})!;
      expect(bianco.coloreCapelli, 'bianco');
    });

    test('a chi non ha varianti di capelli non si danno', () {
      /* Ragazzi e anziani a monte non sono stati renderizzati coi tagli: le
       * file «Capelli» e «Colore capelli» per loro non vogliono dire niente,
       * e mostrarle sarebbe mostrarle per finta. */
      expect(personaHaCapelli('uomo'), isTrue);
      expect(personaHaCapelli('ragazzo'), isFalse);
      final ragazzo = RitrattoScelto.da(const {
        'persona': 'ragazzo',
        'capelli': 'ricci',
        'coloreCapelli': 'rosa',
      })!;
      expect(ragazzo.capelli, 'lisci');
      expect(ragazzo.coloreCapelli, 'naturale');
    });

    test('la barba «naturale» segue i capelli', () {
      /* Su una testa bionda una barba nera non e' naturale: e' un trucco. */
      const biondo = RitrattoScelto(coloreCapelli: 'biondo');
      expect(biondo.barbaComeViene, 'bionda');
      const bianco = RitrattoScelto(coloreCapelli: 'bianco');
      expect(bianco.barbaComeViene, 'grigia');
      /* Chi un colore l'ha scelto apposta vince sempre. */
      const scelta = RitrattoScelto(
        coloreCapelli: 'biondo',
        coloreBarba: 'rame',
      );
      expect(scelta.barbaComeViene, 'rame');
      /* Chi non ha capelli non ha un colore da seguire. */
      const ragazzo = RitrattoScelto(persona: 'ragazzo');
      expect(ragazzo.barbaComeViene, 'naturale');
    });

    test('solo certi vestiti si ricolorano', () {
      /* Il compositore sa ricolorare i tessuti a tinta piena. Per gli altri la
       * scelta non avrebbe effetto, e la fila non si mostra. */
      expect(vestitoRicolorabile('camicia'), isTrue);
      expect(vestitoRicolorabile('ufficio'), isTrue);
      expect(vestitoRicolorabile('astronauta'), isFalse);
      expect(vestitoRicolorabile('nessuno'), isFalse);
    });

    test('si scrive con le chiavi che il compositore legge', () {
      const quale = RitrattoScelto(
        persona: 'donna',
        capelli: 'ricci',
        barba: 'nessuna',
        coloreCapelli: 'rosso',
        carnagione: 'media',
        vestito: 'camicia',
        coloreVestito: 'verde',
        occhiali: 'tondi',
        collana: 'catenina',
        occhi: 'verde',
      );
      expect(quale.scritto, {
        'persona': 'donna',
        'capelli': 'ricci',
        'barba': 'nessuna',
        'coloreCapelli': 'rosso',
        'coloreBarba': 'naturale',
        'occhi': 'verde',
        'carnagione': 'media',
        'vestito': 'camicia',
        'coloreVestito': 'verde',
        'occhiali': 'tondi',
        'collana': 'catenina',
      });
    });
  });

  group('Una persona', () {
    test('porta tutto quello che la plancia sa di lei', () {
      final quale = Persona.da(const {
        'name': 'Giovanni',
        'entity': 'person.giovanni',
        'photo': '/local/giovanni.jpg',
        'battery': 'sensor.telefono_batteria',
        'activity': 'sensor.telefono_attivita',
        'nascosta': true,
        'avatar': {'emoji': '🙂', 'color': '#16a34a'},
      });
      expect(quale.nome, 'Giovanni');
      expect(quale.entita, 'person.giovanni');
      expect(quale.foto, '/local/giovanni.jpg');
      expect(quale.dentro['battery'], 'sensor.telefono_batteria');
      expect(quale.dentro['activity'], 'sensor.telefono_attivita');
      expect(quale.nascosta, isTrue);
      expect(quale.emoji, '🙂');
      expect(quale.colore, '#16a34a');
      expect(quale.ritratto, isNull);
    });

    test('l\'identificativo nasce dal nome, senza accenti', () {
      expect(Persona.da(const {'name': 'Niccolò È'}).id, 'person-niccolo-e');
      /* Senza nome vale l'entita'. */
      expect(
        Persona.da(const {'entity': 'person.mario_rossi'}).id,
        'person-mario-rossi',
      );
    });

    test('un colore strano torna a uno di quelli buoni', () {
      /* Un colore libero scritto a mano puo' rendere le iniziali illeggibili;
       * uno di questi no. */
      final quale = Persona.da(const {
        'name': 'X',
        'avatar': {'color': 'fucsia elettrico'},
      }, quale: 1);
      expect(iColoriDellaPersona, contains(quale.colore));
    });

    test('quello che il modello non conosce resta dov\'e\'', () {
      final quale = Persona.da(const {
        'name': 'Giovanni',
        'una_cosa_nuova': 'che non conosciamo',
      });
      expect(quale.dentro['una_cosa_nuova'], 'che non conosciamo');
    });

    test('il ritratto si mette e si toglie', () {
      final quale = Persona.da(const {'name': 'Giovanni'});
      expect(quale.ritratto, isNull);
      quale.mettiIlRitratto(const RitrattoScelto(persona: 'donna'));
      expect(quale.ritratto?.persona, 'donna');
      quale.mettiIlRitratto(null);
      expect(quale.ritratto, isNull);
    });

    test('le iniziali sono due, come nelle rubriche', () {
      expect(inizialiDi('Giovanni'), 'G');
      expect(inizialiDi('Giovanni Rossi'), 'GR');
      expect(inizialiDi('Anna Maria De Luca'), 'AM');
      expect(inizialiDi('   '), '?');
    });

    test('una voce senza nome ne\' entita\' non e\' una persona', () {
      final elenco = lePersoneDi(const [
        {'name': 'Giovanni'},
        {'photo': 'x.png'},
        'nemmeno questa',
        {'entity': 'person.adriana'},
      ]);
      expect(elenco.map((una) => una.id).toList(), [
        'person-giovanni',
        'person-adriana',
      ]);
    });
  });

  group('Le lettere senza accenti', () {
    test('un accento diventa la lettera, non un trattino', () {
      /* Dart non ha la normalizzazione Unicode della libreria di serie: senza
       * la tavola scritta a mano, «Niccolo'» diventava `niccol` e la stanza
       * «Salotto'» non era la stessa di «Salotto». */
      expect(senzaAccenti('Niccolò'), 'niccolo');
      expect(senzaAccenti('PERÒ È COSÌ'), 'pero e cosi');
      expect(senzaAccenti('Müller'), 'muller');
      expect(senzaAccenti('Gonçalves'), 'goncalves');
      expect(senzaAccenti('Straße'), 'strasse');
    });

    test('quello che non conosce lo lascia passare', () {
      expect(senzaAccenti('Кухня'), 'кухня');
      expect(senzaAccenti('Salotto'), 'salotto');
      expect(senzaAccenti(''), '');
    });
  });
}
