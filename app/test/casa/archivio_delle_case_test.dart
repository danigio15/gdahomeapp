/// Le prove delle case conosciute.
///
/// Due cose si stanno provando davvero: che **una casa sia una sola istanza
/// vista da due parti** — e quindi che i due indirizzi restino attaccati allo
/// stesso segno — e che un archivio rovinato a meta' non svuoti l'app.
library;

import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/casa/archivio_delle_case.dart';
import 'package:gdahome/casa/casa_conosciuta.dart';
import 'package:gdahome/casa/cassaforte.dart';
import 'package:gdahome/ponte/indirizzo.dart';

final inRete = IndirizzoDelPonte.leggi('192.168.1.50')!;
final daFuori = IndirizzoDelPonte.leggi('https://casa.esempio.it')!;

void main() {
  late CassaforteInMemoria cassaforte;
  late ArchivioDelleCase archivio;

  setUp(() async {
    cassaforte = CassaforteInMemoria();
    archivio = ArchivioDelleCase(cassaforte);
    await archivio.apri();
  });

  test('un archivio nuovo e\' vuoto e non ha una casa attiva', () {
    expect(archivio.vuoto, isTrue);
    expect(archivio.attiva, isNull);
    expect(archivio.tutte, isEmpty);
  });

  test('la casa aggiunta diventa quella attiva', () async {
    final casa = await archivio.aggiungi(
      nome: 'Casa',
      segno: 'segno-uno',
      inCasa: inRete,
      daFuoriCasa: daFuori,
    );
    expect(archivio.attiva!.id, casa.id);
    expect(archivio.attiva!.nome, 'Casa');
    expect(archivio.attiva!.inCasa, inRete);
    expect(archivio.attiva!.daFuoriCasa, daFuori);
  });

  test('piu\' case convivono, ognuna col suo segno', () async {
    final mia = await archivio.aggiungi(
      nome: 'Casa mia',
      segno: 'segno-uno',
      inCasa: inRete,
    );
    final loro = await archivio.aggiungi(
      nome: 'Dai miei',
      segno: 'segno-due',
      daFuoriCasa: daFuori,
    );

    expect(archivio.tutte.length, 2);
    expect(archivio.quella(mia.id)!.segno, 'segno-uno');
    expect(archivio.quella(loro.id)!.segno, 'segno-due');
    /* L'ultima aggiunta e' quella attiva: chi abbina una casa ci vuole entrare. */
    expect(archivio.attiva!.id, loro.id);
  });

  test(
    'si passa da una casa all\'altra, e la scelta resta dopo un riavvio',
    () async {
      final mia = await archivio.aggiungi(
        nome: 'Casa mia',
        segno: 'uno',
        inCasa: inRete,
      );
      await archivio.aggiungi(nome: 'Al mare', segno: 'due', inCasa: inRete);

      await archivio.scegli(mia.id);
      expect(archivio.attiva!.nome, 'Casa mia');

      final dopoIlRiavvio = ArchivioDelleCase(cassaforte);
      await dopoIlRiavvio.apri();
      expect(dopoIlRiavvio.attiva!.nome, 'Casa mia');
      expect(dopoIlRiavvio.tutte.length, 2);
    },
  );

  test('togliendo la casa attiva ne diventa attiva un\'altra', () async {
    final mia = await archivio.aggiungi(
      nome: 'Casa mia',
      segno: 'uno',
      inCasa: inRete,
    );
    final altra = await archivio.aggiungi(
      nome: 'Al mare',
      segno: 'due',
      inCasa: inRete,
    );

    await archivio.togli(altra.id);
    expect(archivio.tutte.length, 1);
    expect(archivio.attiva!.id, mia.id);

    await archivio.togli(mia.id);
    expect(archivio.attiva, isNull);
    expect(archivio.vuoto, isTrue);
  });

  test('i due indirizzi si cambiano senza toccare il segno', () async {
    final casa = await archivio.aggiungi(
      nome: 'Casa',
      segno: 'il-segno',
      inCasa: inRete,
    );
    expect(archivio.attiva!.soloInCasa, isTrue);

    await archivio.cambiaGliIndirizzi(casa.id, daFuoriCasa: daFuori);

    expect(archivio.attiva!.segno, 'il-segno', reason: 'il segno non si tocca');
    expect(archivio.attiva!.daFuoriCasa, daFuori);
    expect(archivio.attiva!.soloInCasa, isFalse);

    await archivio.cambiaGliIndirizzi(casa.id, togliDaFuori: true);
    expect(archivio.attiva!.daFuoriCasa, isNull);
  });

  test('l\'approdo si ricorda, ma non si riscrive se non e\' cambiato', () async {
    final casa = await archivio.aggiungi(
      nome: 'Casa',
      segno: 'uno',
      inCasa: inRete,
      daFuoriCasa: daFuori,
    );
    await archivio.segnaLApprodo(casa.id, DaDove.daFuori);
    expect(archivio.attiva!.ultimoApprodo, DaDove.daFuori);

    /* Il filo si riapre a ogni ascensore: riscrivere il portachiavi ogni volta
     * e' fatica per niente. */
    final finQui = cassaforte.scritture;
    await archivio.segnaLApprodo(casa.id, DaDove.daFuori);
    expect(cassaforte.scritture, finQui);
  });

  test('l\'ultimo approdo si prova per primo', () {
    const casa = CasaConosciuta(id: 'x', nome: 'Casa', segno: 's');
    final conDue = casa.con(inCasa: inRete, daFuoriCasa: daFuori);

    expect(conDue.approdi().map((uno) => uno.da), [
      DaDove.daDentro,
      DaDove.daFuori,
    ]);
    expect(
      conDue.con(ultimoApprodo: DaDove.daFuori).approdi().map((uno) => uno.da),
      [DaDove.daFuori, DaDove.daDentro],
      reason: 'provare per primo un indirizzo locale mentre si e\' fuori costa un\'attesa a vuoto',
    );
  });

  test('una casa senza indirizzi non e\' raggiungibile', () {
    const orfana = CasaConosciuta(id: 'x', nome: 'Casa', segno: 's');
    expect(orfana.raggiungibile, isFalse);
    expect(orfana.approdi(), isEmpty);
  });

  test('oltre il numero massimo non se ne aggiungono altre', () async {
    for (var i = 0; i < caseMassime; i += 1) {
      await archivio.aggiungi(
        nome: 'Casa $i',
        segno: 'segno-$i',
        inCasa: inRete,
      );
    }
    expect(archivio.piena, isTrue);
    expect(
      () =>
          archivio.aggiungi(nome: 'una di troppo', segno: 'x', inCasa: inRete),
      throwsA(isA<TroppeCase>()),
    );
  });

  test('una casa storta si salta, le altre restano', () async {
    await cassaforte.scrivi(
      'le_case',
      jsonEncode({
        'case': [
          {
            'id': 'buona',
            'nome': 'Casa',
            'segno': 'uno',
            'in_casa': '192.168.1.50',
          },
          {'nome': 'senza identificativo', 'segno': 'due'},
          {'id': 'senza segno', 'nome': 'Casa'},
          'nemmeno un oggetto',
        ],
        'attiva': 'buona',
      }),
    );
    final riletto = ArchivioDelleCase(cassaforte);
    await riletto.apri();

    expect(riletto.tutte.length, 1);
    expect(riletto.attiva!.id, 'buona');
  });

  test('un archivio illeggibile non impedisce all\'app di aprirsi', () async {
    await cassaforte.scrivi('le_case', 'questo non e\' json');
    final riletto = ArchivioDelleCase(cassaforte);
    await riletto.apri();

    expect(riletto.vuoto, isTrue);
    expect(riletto.aperto, isTrue);
  });

  test('il nome si ripulisce, e vuoto diventa «Casa»', () async {
    final una = await archivio.aggiungi(
      nome: '   Casa   dei    miei  ',
      segno: 'x',
    );
    expect(archivio.quella(una.id)!.nome, 'Casa dei miei');

    final senzaNome = await archivio.aggiungi(nome: '   ', segno: 'y');
    expect(archivio.quella(senzaNome.id)!.nome, 'Casa');

    await archivio.rinomina(senzaNome.id, 'Al mare');
    expect(archivio.quella(senzaNome.id)!.nome, 'Al mare');
  });

  test('il segno non compare quando si scrive una casa nel registro', () {
    const casa = CasaConosciuta(
      id: 'x',
      nome: 'Casa',
      segno: 'IL-SEGNO-SEGRETO',
    );
    expect(casa.toString().contains('IL-SEGNO-SEGRETO'), isFalse);
  });
}
