/// Le prove dell'agenda.
///
/// Gli appuntamenti e le cose da fare sono gli unici dati della plancia che
/// non stanno negli stati: arrivano da `calendar.get_events` e da
/// `todo.get_items`, e qui si parte proprio dalla forma in cui rispondono.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/plancia/agenda.dart';
import 'package:gdahome/plancia/configurazione.dart';

import 'casa_demo.dart';

/// La risposta di `calendar.get_events`, come la manda Home Assistant.
Map<String, dynamic> risposta(String entita, List<Map<String, Object?>> voci) =>
    {
      'response': {
        entita: {'events': voci},
      },
    };

Map<String, dynamic> rispostaDelleCose(
  String entita,
  List<Map<String, Object?>> voci,
) => {
  'response': {
    entita: {'items': voci},
  },
};

void main() {
  final demo = CasaDemo.leggi();
  final config = demo.configurazione;
  final adesso = DateTime(2026, 9, 8, 12, 40);

  String iso(int giorni, int ora, [int minuti = 0]) {
    final quando = DateTime(
      adesso.year,
      adesso.month,
      adesso.day + giorni,
      ora,
      minuti,
    );
    return quando.toIso8601String();
  }

  List<Impegno> impegniFinti() => impegniDallaRisposta(
    risposta('calendar.famiglia', [
      {'summary': 'Riunione', 'start': iso(0, 9), 'end': iso(0, 13)},
      {'summary': 'Dentista', 'start': iso(0, 17, 30), 'end': iso(0, 18, 30)},
      {'summary': 'Saggio', 'start': iso(1, 16), 'end': iso(1, 18)},
      {'summary': 'Gita', 'start': '2026-09-12', 'end': '2026-09-13'},
      {'summary': 'Finita ieri', 'start': iso(-1, 9), 'end': iso(-1, 10)},
    ]),
    'calendar.famiglia',
  );

  List<Cosa> coseFinte() => coseDallaRisposta(
    rispostaDelleCose('todo.casa', [
      {'uid': '1', 'summary': 'Pane', 'status': 'needs_action'},
      {'uid': '2', 'summary': 'Pasta', 'status': 'completed'},
      {
        'uid': '3',
        'summary': 'Revisione auto',
        'status': 'needs_action',
        'due': '2026-09-10',
      },
      {
        'uid': '4',
        'summary': 'Filtro cappa',
        'status': 'needs_action',
        'due': '2026-09-05',
      },
    ]),
    'todo.casa',
  );

  test('una data senza ora e\' un giorno intero, e si vede', () {
    final tuttoIlGiorno = istanteDi('2026-09-12');
    expect(tuttoIlGiorno.tuttoIlGiorno, isTrue);
    expect(tuttoIlGiorno.quando, DateTime(2026, 9, 12));
    final conOra = istanteDi('2026-09-12T17:30:00');
    expect(conOra.tuttoIlGiorno, isFalse);
    expect(orarioDi(conOra.quando!), '17:30');
    expect(istanteDi('').quando, isNull);
    expect(istanteDi('non e\' una data').quando, isNull);
  });

  test('una risposta storta non porta via l\'agenda', () {
    expect(impegniDallaRisposta(null, 'calendar.x'), isEmpty);
    expect(impegniDallaRisposta({'result': 1}, 'calendar.x'), isEmpty);
    expect(coseDallaRisposta({'response': {}}, 'todo.x'), isEmpty);
  });

  test('quello che e\' finito esce, quello che e\' in corso resta', () {
    final restano = impegniDaQui(impegniFinti(), adesso);
    expect(restano.map((u) => u.titolo), [
      /* Cominciata alle nove e finisce all'una: e' quella dentro cui si sta
       * adesso, ed e' la piu' importante di tutte. */
      'Riunione',
      'Dentista',
      'Saggio',
      'Gita',
    ]);
    expect(restano.first.inCorso(adesso), isTrue);
    expect(restano.last.tuttoIlGiorno, isTrue);
  });

  test('il conto guarda oggi, poi domani, poi avanti', () {
    final oggi = contoDellAgenda(impegniFinti(), coseFinte(), adesso);
    /* Due impegni oggi piu' due scadenze: quella di dopodomani no, ma quella
     * scaduta si' — e' oggi che va fatta. */
    expect(oggi.quando, QuandoConta.oggi);
    expect(oggi.quante, 3);

    final soloAvanti = contoDellAgenda(
      impegniDallaRisposta(
        risposta('calendar.x', [
          {'summary': 'Fra tre giorni', 'start': iso(3, 10), 'end': iso(3, 11)},
        ]),
        'calendar.x',
      ),
      const [],
      adesso,
    );
    expect(soloAvanti.quando, QuandoConta.avanti);
    expect(soloAvanti.quante, 1);

    expect(contoDellAgenda(const [], const [], adesso).quando, QuandoConta.mai);
  });

  test('lo scaduto sta in cima, non nel giorno in cui e\' scaduto', () {
    final agenda = agendaPerGiorno(impegniFinti(), coseFinte(), adesso);
    expect(agenda.inRitardo.map((r) => r.nome), ['Filtro cappa']);
    expect(agenda.giorni.map((g) => g.giorno), [
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-12',
    ]);
    /* Una scadenza vive nell'agenda accanto agli appuntamenti, ma non diventa
     * un appuntamento: al posto dell'ora dice cos'e'. */
    final mercoledi = agenda.giorni
        .firstWhere((g) => g.giorno == '2026-09-10')
        .righe
        .single;
    expect(mercoledi.eUnaCosa, isTrue);
    expect(mercoledi.nome, 'Revisione auto');
    expect(mercoledi.quando, 'Da fare');
  });

  test('i giorni si chiamano Oggi, Domani, e poi con la loro data', () {
    expect(etichettaDelGiorno('2026-09-08', adesso), 'Oggi');
    expect(etichettaDelGiorno('2026-09-09', adesso), 'Domani');
    expect(etichettaDelGiorno('2026-09-12', adesso), 'sabato 12 settembre');
  });

  test('la tessera: quanti oggi, e i primi due per nome', () {
    final tessera = tesseraDellAgenda(
      config,
      impegniFinti(),
      coseFinte(),
      adesso: adesso,
    )!;
    expect(tessera.valore, '3 oggi');
    expect(
      tessera.didascalia,
      'Adesso · Riunione  ·  17:30 · Dentista  ·  3 da fare',
    );
    expect(tessera.attiva, isTrue);
    /* Nessun anello: mescolare la percentuale di cose spuntate con gli
     * appuntamenti darebbe un cerchio che non risponde a niente. */
    expect(tessera.anello, isNull);
  });

  test('senza calendari il numero grande sono le cose da fare', () {
    final soloListe = ConfigurazioneDellaPlancia.daiValori({
      for (final voce in (demo.risposta['snapshot']['values'] as Map).entries)
        voce.key as String: voce.value as String,
      'cd_calendari': '[]',
    });
    final tessera = tesseraDellAgenda(
      soloListe,
      const [],
      coseFinte(),
      adesso: adesso,
    )!;
    expect(tessera.valore, '3');
    expect(tessera.didascalia, '3 da fare');
  });

  test('a calendario vuoto lo dice, e mentre legge lo dice diverso', () {
    final vuota = tesseraDellAgenda(
      config,
      const [],
      const [],
      adesso: adesso,
    )!;
    expect(vuota.valore, '—');
    expect(vuota.didascalia, 'Niente in programma  ·  Tutto fatto');

    final aspetta = tesseraDellAgenda(
      config,
      const [],
      const [],
      adesso: adesso,
      inArrivo: true,
    )!;
    expect(aspetta.didascalia, startsWith('Sto guardando…'));
  });

  test('senza calendari e senza liste la tessera non c\'e\'', () {
    final niente = ConfigurazioneDellaPlancia.daiValori({
      for (final voce in (demo.risposta['snapshot']['values'] as Map).entries)
        voce.key as String: voce.value as String,
      'cd_calendari': '[]',
      'cd_todo': '[]',
    });
    expect(
      tesseraDellAgenda(niente, const [], const [], adesso: adesso),
      isNull,
    );
  });
}
