/// Il servitore da solo, da riga di comando.
///
/// E' lo stesso server che gira dentro l'app sul telefono, acceso su un
/// computer: si abbina a un ponte con un codice, apre il filo, trova la
/// plancia e la serve su `127.0.0.1`. Serve al collaudo — l'app in versione
/// web non puo' aprire un server, e il WebView li' e' un riquadro che punta a
/// questo — e a chi vuole guardare la plancia vera passando dal ponte, da un
/// browser qualunque.
///
///     dart run bin/servitore.dart --casa 127.0.0.1:8098 --codice ABCD-EFGH
///
/// Stampa due righe che chi lo accende puo' leggere:
///
///     porta: 12345
///     plancia: http://127.0.0.1:12345/dashboardmodern_static/…/legacy/dashboard.html
///
/// e resta acceso finche' non lo si spegne.
library;

import 'dart:async';
import 'dart:io';

import 'package:gdahome/plancia/pannello.dart';
import 'package:gdahome/plancia/servitore.dart';
import 'package:gdahome/ponte/abbinamento.dart';
import 'package:gdahome/ponte/filo.dart';
import 'package:gdahome/ponte/indirizzo.dart';

Future<void> main(List<String> argomenti) async {
  final detti = _leggi(argomenti);
  final casa = IndirizzoDelPonte.leggi(detti['casa'] ?? '');
  final codice = detti['codice'];
  if (casa == null || codice == null || codice.isEmpty) {
    stderr.writeln(
      'Uso: dart run bin/servitore.dart --casa 127.0.0.1:8098 --codice ABCD-EFGH '
      '[--porta 0] [--cartella /tmp/plancia] [--lingua it]',
    );
    exit(64);
  }
  final cartella = Directory(
    detti['cartella'] ?? '${Directory.systemTemp.path}/gdahome-plancia',
  );
  final lingua = detti['lingua'] ?? 'it';
  final porta = int.tryParse(detti['porta'] ?? '0') ?? 0;

  stdout.writeln('mi abbino a ${casa.casa}:${casa.porta} col codice');
  final abbinato = await Abbinamento.chiedi(
    dove: casa,
    codice: codice,
    nome: 'Il servitore del collaudo',
    sistema: 'computer',
  );

  final filo = Filo.fisso(
    indirizzo: casa,
    segno: abbinato.segno,
    chi: abbinato.identificativo,
    chiave: abbinato.chiave,
  );
  await filo.apri();
  stdout.writeln('il filo e\' aperto');

  final pannello = await trovaLaPlancia(filo);
  if (pannello == null) {
    stderr.writeln('in questa casa non c\'e\' DashboardModern');
    await filo.chiudi();
    exit(1);
  }

  final servitore = Servitore(
    filo: () => filo,
    cartella: cartella,
    lingua: lingua,
    /* Da qui la radice porta alla pagina, chiave compresa: chi bussa e' il
     * collaudo, o chi ha acceso questo servitore a mano. */
    portaAperta: true,
    racconta: stderr.writeln,
  );
  await servitore.alza(porta: porta);
  final pagina = servitore.paginaDi(pannello);
  stdout.writeln('porta: ${servitore.porta}');
  stdout.writeln('plancia: $pagina');

  final spento = Completer<void>();
  for (final segnale in [ProcessSignal.sigterm, ProcessSignal.sigint]) {
    segnale.watch().listen((_) {
      if (!spento.isCompleted) spento.complete();
    });
  }
  await spento.future;
  await servitore.spegni();
  await filo.chiudi();
}

/// `--nome valore`, e basta: non vale la pena di una dipendenza.
Map<String, String> _leggi(List<String> argomenti) {
  final letti = <String, String>{};
  for (var i = 0; i < argomenti.length; i += 1) {
    final uno = argomenti[i];
    if (!uno.startsWith('--')) continue;
    final nome = uno.substring(2);
    final valore = i + 1 < argomenti.length ? argomenti[i + 1] : '';
    letti[nome] = valore;
    i += 1;
  }
  return letti;
}
