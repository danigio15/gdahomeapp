/// «Anche i comandi rapidi sono presenti», sul telefono, e in macchina
/// «Nessun comando scelto». Quelli proposti la prima volta si scrivevano solo
/// aprendo la pagina: adesso si scrivono appena la casa risponde.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/auto/i_comandi.dart';
import 'package:gdahome/auto/la_foto.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/casa/collegamento.dart';
import 'package:gdahome/schermate/comandi_in_auto.dart';

const _cancello = ComandoRapido(
  id: 'q|Cancello Automatico|script.cancello',
  nome: 'Cancello Automatico',
  genere: GenereDelComando.scena,
  conferma: true,
  provenienza: 'Azione rapida',
  ricetta: RicettaDellAzione(
    id: 'q|Cancello Automatico|script.cancello',
    dominio: 'script',
    servizio: 'turn_on',
    entita: 'script.cancello',
  ),
);

void main() {
  late Collegamento casa;

  setUp(() async {
    final archivio = ArchivioDelleCase(CassaforteInMemoria());
    await archivio.apri();
    casa = Collegamento(archivio: archivio);
  });

  test('mai scelti: si scrivono le azioni rapide della plancia', () async {
    final scritti = <IComandiScelti>[];
    final fatto = await proponiIComandiSeMancano(
      casa,
      leggi: () async => null,
      scrivi: (s) async {
        scritti.add(s);
        return true;
      },
      azioni: () async => const AzioniDellaPlancia([_cancello]),
    );
    expect(fatto, isTrue);
    expect(scritti.single.comandi.map((c) => c.nome), ['Cancello Automatico']);
  });

  test('scelti una volta, anche vuoti, non si toccano', () async {
    var scritto = false;
    final fatto = await proponiIComandiSeMancano(
      casa,
      leggi: () async => const IComandiScelti(),
      scrivi: (_) async => scritto = true,
      azioni: () async => const AzioniDellaPlancia([_cancello]),
    );
    expect(fatto, isFalse);
    expect(scritto, isFalse);
  });

  test('niente da proporre: non si scrive un elenco vuoto', () async {
    var scritto = false;
    final fatto = await proponiIComandiSeMancano(
      casa,
      leggi: () async => null,
      scrivi: (_) async => scritto = true,
      azioni: () async => const AzioniDellaPlancia([]),
    );
    expect(fatto, isFalse);
    expect(scritto, isFalse);
  });
}
