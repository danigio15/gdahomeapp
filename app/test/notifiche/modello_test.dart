/// Le impostazioni delle notifiche, avanti e indietro: dalla casa al
/// telefono, nella copia per casa, e indietro alla casa.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/notifiche/consegna.dart';
import 'package:gdahome/notifiche/modello.dart';
import 'package:gdahome/notifiche/notifiche.dart';

void main() {
  test('le impostazioni fanno andata e ritorno, e lo strano resta fuori', () {
    final prima = const ImpostazioniDelleNotifiche()
        .conEvento('antifurto', false)
        .con(
          persone: ['person.uno'],
          assistente: 'tutti',
          riepilogo: '21:15',
          silenzio: const OreDiSilenzio(dalle: '22:30', alle: '06:45'),
          soloFuori: true,
        );
    final dopo = ImpostazioniDelleNotifiche.leggi(prima.inJson());
    expect(dopo.evento('antifurto'), isFalse);
    expect(
      dopo.evento('campanello'),
      isTrue,
      reason: 'quello che manca e\' acceso',
    );
    expect(dopo.persone, ['person.uno']);
    expect(dopo.assistente, 'tutti');
    expect(dopo.riepilogo, '21:15');
    expect(dopo.silenzio, const OreDiSilenzio(dalle: '22:30', alle: '06:45'));
    expect(dopo.soloFuori, isTrue);

    final strane = ImpostazioniDelleNotifiche.leggi({
      'riepilogo': '99:99',
      'assistente': 'boh',
      'silenzio': {'dalle': 'mezzanotte'},
      'eventi': {'antifurto': 'si'},
    });
    expect(strane.riepilogo, '20:30');
    expect(strane.assistente, 'importanti');
    expect(strane.silenzio.dalle, '23:00');
    expect(strane.evento('antifurto'), isTrue);
  });

  test('la copia per casa: ognuna la sua, e si ritrova dopo', () async {
    final cassaforte = CassaforteInMemoria();
    final copia = CopiaDelleNotifiche(cassaforte);
    final stato = StatoDelleNotifiche(
      impostazioni: const ImpostazioniDelleNotifiche().conEvento(
        'pioggia',
        false,
      ),
      registrato: true,
      personalizzate: const [
        NotificaPersonalizzata(
          id: 'p_000000000001',
          entita: 'sensor.temperatura_freezer',
          valore: '-12',
          titolo: 'Freezer troppo caldo',
        ),
      ],
    );
    await copia.scrivi('casa-1', stato);
    final riletto = await CopiaDelleNotifiche(cassaforte).leggi('casa-1');
    expect(riletto!.registrato, isTrue);
    expect(riletto.impostazioni.evento('pioggia'), isFalse);
    expect(riletto.personalizzate.single.titolo, 'Freezer troppo caldo');
    expect(await copia.leggi('casa-2'), isNull);
  });

  test('i canali: urgenti, normali, manutenzione', () {
    NotificaArrivata una(String urg, String cat) => NotificaArrivata(
      id: 'x',
      tipo: 't',
      categoria: cat,
      urgenza: urg,
      titolo: 't',
      testo: '',
      quando: DateTime(2026),
      scade: DateTime(2027),
    );
    expect(canaleDi(una('urgente', 'urgenti')), CanaleDelleNotifiche.urgenti);
    expect(canaleDi(una('normale', 'casa')), CanaleDelleNotifiche.normali);
    expect(
      canaleDi(una('bassa', 'manutenzione')),
      CanaleDelleNotifiche.manutenzione,
    );
    expect(
      canaleDi(una('bassa', 'assistente')),
      CanaleDelleNotifiche.manutenzione,
    );
  });

  test('una personalizzata come la vuole il ponte', () {
    const regola = NotificaPersonalizzata(
      entita: 'binary_sensor.cancello',
      condizione: 'uguale',
      valore: 'on',
      per: 5,
      titolo: 'Cancello rimasto aperto',
      urgenza: 'urgente',
      chi: ['a'],
    );
    final json = regola.inJson();
    expect(json.containsKey('id'), isFalse, reason: 'una nuova non ce l\'ha');
    final riletta = NotificaPersonalizzata.leggi(json)!;
    expect(riletta.condizione, 'uguale');
    expect(riletta.urgenza, 'urgente');
    expect(riletta.per, 5);
  });
}
