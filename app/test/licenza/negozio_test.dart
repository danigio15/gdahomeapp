/// Gli acquisti senza schermate: quello che arriva dal negozio, dove va, e
/// cosa si dice a chi compra.
///
/// Il negozio e' finto e parla come Google Play: un acquisto annullato o
/// andato male arriva **senza prodotto**, e uno pagato con l'app chiusa prima
/// che la casa rispondesse non torna da solo, lo si va a prendere.
library;

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:gdahome/licenza/licenza.dart';
import 'package:gdahome/licenza/negozio.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

const _token = 'token-play-della-prova-0123456789';

class _GooglePlayFinto implements NegozioGdahome {
  final comprati = <String>[];
  var completati = 0;

  /// Quelli che il negozio dice rimasti a meta', all'avvio.
  List<PurchaseDetails> rimasti = const [];

  final _acquisti = StreamController<List<PurchaseDetails>>.broadcast();

  void consegna(PurchaseDetails acquisto) => _acquisti.add([acquisto]);

  @override
  String get piattaforma => 'android';
  @override
  String get nome => 'Play Store';
  @override
  Future<bool> disponibile() async => true;
  @override
  Future<List<PianoGdahome>> piani() async => const [
    PianoGdahome(id: pianoMensile, prezzo: '4,99 €', giorniProva: 14),
    PianoGdahome(id: pianoAnnuale, prezzo: '49,99 €', giorniProva: 14),
  ];
  @override
  Stream<List<PurchaseDetails>> get acquisti => _acquisti.stream;
  @override
  Future<void> compra(String piano) async => comprati.add(piano);
  @override
  Future<void> ripristina() async {}
  @override
  Future<void> completa(PurchaseDetails acquisto) async => completati += 1;
  @override
  Future<List<PurchaseDetails>> rimastiAMeta() async => rimasti;
}

/// Un acquisto di Google Play: col prodotto e col token, o — com'e' un
/// annullamento o un errore — senza niente.
PurchaseDetails _acquisto({
  String prodotto = idPremiumGdahome,
  String token = _token,
  PurchaseStatus stato = PurchaseStatus.purchased,
  bool daConfermare = true,
  String? errore,
}) =>
    PurchaseDetails(
        purchaseID: token.isEmpty ? '' : 'GPA.3300-0000-0000-00000',
        productID: prodotto,
        verificationData: PurchaseVerificationData(
          localVerificationData: '',
          serverVerificationData: token,
          source: 'google_play',
        ),
        transactionDate: token.isEmpty ? null : '0',
        status: stato,
      )
      ..pendingCompletePurchase = daConfermare
      ..error = errore == null
          ? null
          : IAPError(
              source: 'google_play',
              code: 'purchase_error',
              message: errore,
            );

void main() {
  test(
    'Google Play: chi chiude la finestra del pagamento non lascia il bottone '
    'a girare',
    () async {
      final negozio = _GooglePlayFinto();
      final acquisti = GestoreDegliAcquisti(
        negozio: negozio,
        porta: ({required piattaforma, required prodotto, required ricevuta}) =>
            fail('niente da portare alla casa'),
      );
      await acquisti.avvia();
      await acquisti.compra(pianoAnnuale);
      expect(acquisti.inCorso, isTrue);

      negozio.consegna(
        _acquisto(prodotto: '', token: '', stato: PurchaseStatus.canceled),
      );
      await pumpEventQueue();
      expect(acquisti.inCorso, isFalse);
      expect(acquisti.errore, isNull);
    },
  );

  test('Google Play: un errore senza prodotto si dice, e in parole', () async {
    final negozio = _GooglePlayFinto();
    final acquisti = GestoreDegliAcquisti(
      negozio: negozio,
      porta: ({required piattaforma, required prodotto, required ricevuta}) =>
          fail('niente da portare alla casa'),
    );
    await acquisti.avvia();
    await acquisti.compra(pianoMensile);
    negozio.consegna(
      _acquisto(
        prodotto: '',
        token: '',
        stato: PurchaseStatus.error,
        errore: 'BillingResponse.developerError',
      ),
    );
    await pumpEventQueue();
    expect(acquisti.inCorso, isFalse);
    expect(acquisti.errore, contains('Acquisto non riuscito'));
    expect(acquisti.errore, contains('Play Store'));
    expect(acquisti.errore, isNot(contains('BillingResponse')));
  });

  test(
    'l\'abbonamento c\'è già su questo account: si dice di ripristinarlo',
    () async {
      final negozio = _GooglePlayFinto();
      final acquisti = GestoreDegliAcquisti(
        negozio: negozio,
        porta: ({required piattaforma, required prodotto, required ricevuta}) =>
            fail('niente da portare alla casa'),
      );
      await acquisti.avvia();
      await acquisti.compra(pianoAnnuale);
      negozio.consegna(
        _acquisto(
          prodotto: '',
          token: '',
          stato: PurchaseStatus.error,
          errore: 'BillingResponse.itemAlreadyOwned',
        ),
      );
      await pumpEventQueue();
      expect(acquisti.inCorso, isFalse);
      expect(acquisti.errore, contains('Ripristina abbonamento'));
    },
  );

  test('un acquisto rimasto a metà la volta scorsa riparte all\'avvio, e si '
      'conferma', () async {
    final negozio = _GooglePlayFinto()..rimasti = [_acquisto()];
    final portate = <String>[];
    final acquisti = GestoreDegliAcquisti(
      negozio: negozio,
      porta:
          ({required piattaforma, required prodotto, required ricevuta}) async {
            expect(piattaforma, 'android');
            expect(prodotto, idPremiumGdahome);
            portate.add(ricevuta);
          },
    );
    await acquisti.avvia();
    expect(portate, [_token]);
    expect(negozio.completati, 1);
    expect(acquisti.ceUnaRicevutaInSospeso, isFalse);
  });

  test('rimasto a metà con la casa che non risponde: aspetta la casa, senza '
      'confermarlo, e il negozio che lo ripropone non lo raddoppia', () async {
    final negozio = _GooglePlayFinto()..rimasti = [_acquisto()];
    var risponde = false;
    final portate = <String>[];
    final acquisti = GestoreDegliAcquisti(
      negozio: negozio,
      porta:
          ({required piattaforma, required prodotto, required ricevuta}) async {
            if (!risponde) {
              throw const LicenzaRifiutata(
                'La casa non è collegata adesso.',
                definitiva: false,
              );
            }
            portate.add(ricevuta);
          },
    );
    await acquisti.avvia();
    expect(acquisti.ceUnaRicevutaInSospeso, isTrue);
    /* Senza la casa non si conferma: se non arriva mai, Google rimborsa. */
    expect(negozio.completati, 0);

    /* Lo stesso acquisto di nuovo — «Ripristina abbonamento» — mentre
       * aspetta: e' sempre quello. */
    negozio.consegna(_acquisto(stato: PurchaseStatus.restored));
    await pumpEventQueue();
    expect(portate, isEmpty);

    risponde = true;
    await acquisti.riprova();
    expect(portate, [_token]);
    expect(acquisti.ceUnaRicevutaInSospeso, isFalse);
    expect(negozio.completati, 1);
  });
}
