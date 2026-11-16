import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/casa_conosciuta.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/notifiche/al_navigatore.dart';
import 'package:gdahome/notifiche/consegna.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/notifiche/postino.dart';
import 'package:gdahome/schermate/navigatore_qui/sul_telefono.dart'
    show avvisoToccatoNelNavigatore;

/// Le notifiche della casa arrivano anche al navigatore, e i tasti premuti
/// la' tornano per la strada dei tasti della notifica (il velo del lucchetto
/// compreso). Nomi e case inventati.
void main() {
  const casa = CasaConosciuta(
    id: 'casa-prova',
    nome: 'Villa Gialla',
    segno: 'segno-finto',
  );

  Map<String, dynamic> busta({int scade = 4102444800000}) => {
    'v': 1,
    'id': 'n-1',
    'tipo': 'campanello',
    'cat': 'sicurezza',
    'urg': 'urgente',
    'titolo': '🔔 Suonano al cancello',
    'testo': 'Corriere',
    'quando': 1790000000000,
    'scade': scade,
    'azioni': [
      {'id': 'apri', 'etichetta': 'Apri cancello'},
      {'id': 'ignora', 'etichetta': 'Ignora'},
    ],
  };

  NotificaDaMostrare quale({bool scaduta = false}) => NotificaDaMostrare(
    casa: casa,
    notifica: NotificaArrivata.leggi(busta())!,
    grezza: busta(),
    scaduta: scaduta,
  );

  test('al navigatore va la busta, col nome e l\'id della casa', () {
    final dati = perIlNavigatore(quale())!;
    expect(dati['titolo'], '🔔 Suonano al cancello');
    expect(dati['_casa'], 'Villa Gialla');
    expect(dati['_casa_id'], 'casa-prova');
  });

  test('una scaduta non va: in guida i suoi tasti non varrebbero', () {
    expect(perIlNavigatore(quale(scaduta: true)), isNull);
  });

  test('la porta del navigatore riceve quello che il postino apre', () async {
    final arrivate = ascoltaLeNotifiche();
    // Una sola porta per l'app: richiamata, arriva anche li', una volta.
    final anche = ascoltaLeNotifiche().first.timeout(
      const Duration(seconds: 5),
    );
    final prima = arrivate.first.timeout(const Duration(seconds: 5));
    mandaAlNavigatore(quale());
    final n = await prima;
    expect(n['id'], 'n-1');
    expect((await anche)['id'], 'n-1');
    expect(n['_casa'], 'Villa Gialla');
  });

  test('sul filo passa solo il JSON di una notifica', () {
    expect(leggiDalFilo('{"id":"x"}'), {'id': 'x'});
    expect(leggiDalFilo('[1,2]'), isNull);
    expect(leggiDalFilo('non json'), isNull);
    expect(leggiDalFilo(42), isNull);
  });

  test('il tasto dal navigatore diventa il tasto della notifica', () {
    final tocco = toccoDalNavigatore(perIlNavigatore(quale())!, 'apri')!;
    expect(tocco.casa, 'casa-prova');
    expect(tocco.tasto, 'apri');
    expect(tocco.notifica.id, 'n-1');
    // Un tasto che la notifica non ha non passa.
    expect(
      toccoDalNavigatore(perIlNavigatore(quale())!, 'disinserisci'),
      isNull,
    );
    // Senza la casa non si sa a chi portarlo.
    expect(toccoDalNavigatore(busta(), 'apri'), isNull);
  });

  test('il tasto va al postino come un tocco: non dritto alla casa', () async {
    final postino = Postino(
      collegamento: Collegamento(
        archivio: ArchivioDelleCase(CassaforteInMemoria()),
      ),
    );
    addTearDown(postino.dispose);
    final tocchi = <ToccoDellaNotifica>[];
    final ascolto = postino.tocchi.listen(tocchi.add);
    addTearDown(ascolto.cancel);
    avvisoToccatoNelNavigatore(
      perIlNavigatore(quale())!,
      'apri',
      postino: postino,
    );
    await Future<void>.delayed(Duration.zero);
    expect(tocchi.single.tasto, 'apri');
    expect(tocchi.single.casa, 'casa-prova');
    // Senza nessuno in ascolto (la home non c'e' ancora) aspetta, non si perde.
    await ascolto.cancel();
    avvisoToccatoNelNavigatore(
      perIlNavigatore(quale())!,
      'ignora',
      postino: postino,
    );
    expect(postino.prendiInSospeso().single.tasto, 'ignora');
  });
}
