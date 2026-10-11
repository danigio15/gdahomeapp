import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/schermate/riquadro/gli_errori.dart';
import 'package:webview_flutter/webview_flutter.dart';

WebResourceError _errore({
  int codice = 0,
  String parole = '',
  WebResourceErrorType? tipo,
  bool? principale = true,
}) => WebResourceError(
  errorCode: codice,
  description: parole,
  errorType: tipo,
  isForMainFrame: principale,
);

void main() {
  test('la pagina chiusa da iOS mentre l\'app sta dietro si ricarica', () {
    expect(
      cosaFareDellErrore(
        _errore(
          codice: 2,
          tipo: WebResourceErrorType.webContentProcessTerminated,
        ),
      ),
      DopoLErrore.ricarica,
    );
  });

  test('una navigazione annullata da quella dopo non e\' un errore', () {
    expect(
      cosaFareDellErrore(_errore(codice: -999, parole: 'cancelled')),
      DopoLErrore.niente,
    );
    expect(
      cosaFareDellErrore(
        _errore(codice: 102, parole: 'Frame load interrupted'),
      ),
      DopoLErrore.niente,
    );
  });

  test('un\'immagine che non arriva non e\' la pagina che non arriva', () {
    expect(
      cosaFareDellErrore(_errore(codice: -1009, principale: false)),
      DopoLErrore.niente,
    );
  });

  test('la casa che non risponde si dice', () {
    expect(
      cosaFareDellErrore(
        _errore(
          codice: -1004,
          parole: 'Could not connect to the server.',
          tipo: WebResourceErrorType.connect,
        ),
      ),
      DopoLErrore.mostra,
    );
  });

  test('da soli si ricarica tre volte in un minuto, poi si dice', () {
    final ricariche = LeRicariche();
    final ora = DateTime(2026, 10, 11, 12);
    expect(ricariche.unAltraVolta(ora), isTrue);
    expect(ricariche.unAltraVolta(ora.add(const Duration(seconds: 5))), isTrue);
    expect(
      ricariche.unAltraVolta(ora.add(const Duration(seconds: 10))),
      isTrue,
    );
    expect(
      ricariche.unAltraVolta(ora.add(const Duration(seconds: 15))),
      isFalse,
    );
    expect(ricariche.unAltraVolta(ora.add(const Duration(minutes: 2))), isTrue);
  });
}
