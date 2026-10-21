import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/notifiche/consegna.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/notifiche/postino.dart';

/// Dal campo, sull'iPhone: «Guarda» dalla notifica apriva l'app sulla home e
/// basta. Con l'app chiusa la home nasce prima che il postino ci sia: chi
/// aspetta i tocchi deve saperlo appena c'e', e prendere quelli in attesa.
void main() {
  ToccoDellaNotifica guarda() => ToccoDellaNotifica(
    casa: 'casa',
    tasto: 'guarda',
    notifica: NotificaArrivata(
      id: 'm',
      tipo: 'movimento',
      categoria: 'sicurezza',
      urgenza: 'normale',
      titolo: 'Movimento · Ingresso',
      testo: '09:47 · casa vuota',
      quando: DateTime(2026, 10, 20, 9, 47),
      scade: DateTime(2100),
      camera: 'camera.ingresso',
      tasti: const [TastoDellaNotifica('guarda', 'Guarda', apre: true)],
    ),
  );

  test('il postino che arriva dopo lo dice, e i tocchi in attesa si contano', () {
    final collegamento = Collegamento(
      archivio: ArchivioDelleCase(CassaforteInMemoria()),
    );
    final postino = Postino(collegamento: collegamento);
    final arrivi = <Postino?>[];
    void guardaChi() => arrivi.add(Postino.pronto.value);
    Postino.pronto.addListener(guardaChi);
    addTearDown(() {
      Postino.pronto.removeListener(guardaChi);
      Postino.istanza = null;
    });

    // Il tocco arriva prima che qualcuno ascolti: resta da parte, e lo si dice.
    final inAttesa = <int>[];
    postino.inSospeso.addListener(() => inAttesa.add(postino.inSospeso.value));
    postino.toccaPerProva(guarda());
    expect(inAttesa, [1]);

    // Il postino c'e': chi aspettava lo sa, e prende il tocco.
    Postino.istanza = postino;
    expect(arrivi, [postino]);
    final presi = postino.prendiInSospeso();
    expect(presi.single.tasto, 'guarda');
    expect(postino.inSospeso.value, 0);
  });

  test('con qualcuno in ascolto il tocco arriva subito', () async {
    final postino = Postino(
      collegamento: Collegamento(
        archivio: ArchivioDelleCase(CassaforteInMemoria()),
      ),
    );
    final arrivati = <ToccoDellaNotifica>[];
    final ascolto = postino.tocchi.listen(arrivati.add);
    addTearDown(ascolto.cancel);
    postino.toccaPerProva(guarda());
    await Future<void>.delayed(Duration.zero);
    expect(arrivati.single.notifica.camera, 'camera.ingresso');
    expect(postino.prendiInSospeso(), isEmpty);
  });
}
