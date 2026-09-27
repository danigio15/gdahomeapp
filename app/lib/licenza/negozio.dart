/// Comprare gdahome Premium dal telefono.
///
/// Lo schema e' quello di gdanav (`gdanav_app/lib/stato/gestore_premium.dart`),
/// che coi negozi ci ha gia' fatto i conti: un abbonamento con due piani base
/// su Google Play, due prodotti nello stesso gruppo sull'App Store.
///
/// La differenza e' dove va a finire la ricevuta. gdanav da sola si fida del
/// telefono; qui la licenza e' **della casa**, e la ricevuta va alla casa sul
/// filo cifrato (`ponte/licenza/negozio`), che la gira al quadro, che la
/// controlla con Google o con Apple e firma il gettone. Tutti i telefoni della
/// casa diventano Premium insieme — vedi `docs/LICENZE.md`.
///
/// Sul web non si compra niente: li' non c'e' nessun negozio, e la pagina
/// Premium dice di comprare dal telefono (o di riscattare un codice).
library;

import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:in_app_purchase_android/in_app_purchase_android.dart';

import '../parole.dart';
import 'licenza.dart';

/// L'abbonamento nella Play Console, coi suoi due piani base.
const idPremiumGdahome = 'gdahome_premium';
const pianoMensile = 'mensile';
const pianoAnnuale = 'annuale';

/// Sull'App Store ogni piano e' un prodotto a se', nel gruppo «gdahome
/// Premium».
const idAppStoreGdahome = {
  pianoMensile: '${idPremiumGdahome}_mensile',
  pianoAnnuale: '${idPremiumGdahome}_annuale',
};

/// Un acquisto di gdahome Premium, da qualunque negozio venga.
bool eDiGdahomePremium(String prodotto) =>
    prodotto == idPremiumGdahome || idAppStoreGdahome.containsValue(prodotto);

/// I prezzi da scrivere quando il negozio non c'e' (il web, le prove, un
/// telefono senza Play Store). Quelli veri li decide il negozio.
String prezzoDiRiserva(String piano) => piano == pianoAnnuale
    ? inLingua(it: '49,99 €/anno', en: '€49.99/year')
    : inLingua(it: '4,99 €/mese', en: '€4.99/month');

/// Un piano come lo propone il negozio.
class PianoGdahome {
  const PianoGdahome({required this.id, required this.prezzo});

  /// [pianoMensile] o [pianoAnnuale].
  final String id;

  /// Il prezzo come lo scrive il negozio, nella valuta di chi compra.
  final String prezzo;
}

/// Il negozio, visto dall'app: Google Play, l'App Store, o uno finto nelle
/// prove.
abstract interface class NegozioGdahome {
  /// `android` o `ios`: come lo vuole il quadro.
  String get piattaforma;

  /// Come si chiama, per dirlo a chi compra.
  String get nome;

  Future<bool> disponibile();
  Future<List<PianoGdahome>> piani();
  Stream<List<PurchaseDetails>> get acquisti;
  Future<void> compra(String piano);
  Future<void> ripristina();
  Future<void> completa(PurchaseDetails acquisto);
}

/// Il negozio di questo telefono. `null` sul web e dove un negozio non c'e'.
NegozioGdahome? negozioDelTelefono() {
  if (kIsWeb) return null;
  return switch (defaultTargetPlatform) {
    TargetPlatform.android => NegozioGooglePlay(),
    TargetPlatform.iOS => NegozioAppStore(),
    _ => null,
  };
}

class NegozioGooglePlay implements NegozioGdahome {
  final _iap = InAppPurchase.instance;
  final _perPiano = <String, GooglePlayProductDetails>{};

  @override
  String get piattaforma => 'android';

  @override
  String get nome => 'Play Store';

  @override
  Future<bool> disponibile() => _iap.isAvailable();

  @override
  Future<List<PianoGdahome>> piani() async {
    final risposta = await _iap.queryProductDetails({idPremiumGdahome});
    final piani = <String, PianoGdahome>{};
    _perPiano.clear();
    for (final dettaglio
        in risposta.productDetails.whereType<GooglePlayProductDetails>()) {
      final indice = dettaglio.subscriptionIndex;
      final offerta = indice == null
          ? null
          : dettaglio.productDetails.subscriptionOfferDetails?[indice];
      if (offerta == null || offerta.pricingPhases.isEmpty) continue;
      /* Per ogni piano base si tiene la prima offerta: il prezzo che si
       * scrive e' quello dell'ultima fase, cioe' quello che si paga. */
      if (piani.containsKey(offerta.basePlanId)) continue;
      piani[offerta.basePlanId] = PianoGdahome(
        id: offerta.basePlanId,
        prezzo: offerta.pricingPhases.last.formattedPrice,
      );
      _perPiano[offerta.basePlanId] = dettaglio;
    }
    return piani.values.toList();
  }

  @override
  Stream<List<PurchaseDetails>> get acquisti => _iap.purchaseStream;

  @override
  Future<void> compra(String piano) async {
    if (_perPiano.isEmpty) await piani();
    final dettaglio = _perPiano[piano];
    if (dettaglio == null) {
      throw StateError('Piano $piano non disponibile nel negozio');
    }
    await _iap.buyNonConsumable(
      purchaseParam: GooglePlayPurchaseParam(productDetails: dettaglio),
    );
  }

  @override
  Future<void> ripristina() => _iap.restorePurchases();

  @override
  Future<void> completa(PurchaseDetails acquisto) =>
      _iap.completePurchase(acquisto);
}

class NegozioAppStore implements NegozioGdahome {
  final _iap = InAppPurchase.instance;
  final _perPiano = <String, ProductDetails>{};

  @override
  String get piattaforma => 'ios';

  @override
  String get nome => 'App Store';

  @override
  Future<bool> disponibile() => _iap.isAvailable();

  @override
  Future<List<PianoGdahome>> piani() async {
    final risposta = await _iap.queryProductDetails(
      idAppStoreGdahome.values.toSet(),
    );
    _perPiano.clear();
    final piani = <PianoGdahome>[];
    for (final MapEntry(key: piano, value: id) in idAppStoreGdahome.entries) {
      final dettaglio = risposta.productDetails
          .where((uno) => uno.id == id)
          .firstOrNull;
      if (dettaglio == null) continue;
      _perPiano[piano] = dettaglio;
      piani.add(PianoGdahome(id: piano, prezzo: dettaglio.price));
    }
    return piani;
  }

  @override
  Stream<List<PurchaseDetails>> get acquisti => _iap.purchaseStream;

  @override
  Future<void> compra(String piano) async {
    if (_perPiano.isEmpty) await piani();
    final dettaglio = _perPiano[piano];
    if (dettaglio == null) {
      throw StateError('Piano $piano non disponibile nel negozio');
    }
    await _iap.buyNonConsumable(
      purchaseParam: PurchaseParam(productDetails: dettaglio),
    );
  }

  @override
  Future<void> ripristina() => _iap.restorePurchases();

  @override
  Future<void> completa(PurchaseDetails acquisto) =>
      _iap.completePurchase(acquisto);
}

/// Chi porta la ricevuta alla casa: di solito `Collegamento.mandaLaRicevuta`.
typedef PortaLaRicevuta = Future<void> Function({
  required String piattaforma,
  required String prodotto,
  required String ricevuta,
});

/// Gli acquisti di gdahome Premium: i piani coi prezzi, il comprare, il
/// ripristinare, e la ricevuta portata alla casa.
class GestoreDegliAcquisti extends ChangeNotifier {
  GestoreDegliAcquisti({required this.negozio, required this.porta});

  /// `null`: nessun negozio (web, prove). Allora i piani sono quelli di
  /// riserva e i tasti per comprare non ci sono.
  final NegozioGdahome? negozio;
  final PortaLaRicevuta porta;

  /// I piani in vendita; vuoto finche' il negozio non risponde.
  List<PianoGdahome> piani = const [];

  /// Se il negozio c'e' e risponde.
  bool disponibile = false;

  /// Mentre il negozio lavora: un acquisto in corso, una ricevuta in viaggio.
  bool inCorso = false;

  /// L'ultimo problema da dire.
  String? errore;

  /// L'ultima cosa andata bene, da dire.
  String? fatto;

  StreamSubscription<List<PurchaseDetails>>? _iscrizione;
  bool _avviato = false;

  /* Gli acquisti la cui ricevuta non e' arrivata alla casa: comprati fuori
   * casa senza Premium, o col filo giu'. Si riprovano quando la casa torna
   * ([riprova]), e restano aperti nel negozio finche' non arrivano. */
  final List<PurchaseDetails> _inSospeso = [];

  /// Se c'e' una ricevuta che aspetta la casa.
  bool get ceUnaRicevutaInSospeso => _inSospeso.isNotEmpty;

  /// La casa e' di nuovo collegata: si portano le ricevute rimaste indietro.
  Future<void> riprova() async {
    final n = negozio;
    if (n == null || _inSospeso.isEmpty || _riprovando) return;
    _riprovando = true;
    try {
      for (final acquisto in List.of(_inSospeso)) {
        if (!await _portaAllaCasa(n, acquisto, zitto: true)) continue;
        _inSospeso.remove(acquisto);
        if (acquisto.pendingCompletePurchase) {
          try {
            await n.completa(acquisto);
          } catch (e) {
            debugPrint('negozio: $e');
          }
        }
      }
    } finally {
      _riprovando = false;
    }
  }

  bool _riprovando = false;

  /// Il prezzo di un piano: quello del negozio, o quello di riserva.
  String prezzoDi(String piano) =>
      piani.where((uno) => uno.id == piano).firstOrNull?.prezzo ??
      prezzoDiRiserva(piano);

  /// Si mette in ascolto del negozio. Va fatto presto: un acquisto finito
  /// mentre l'app era chiusa arriva appena ci si mette in ascolto, e la sua
  /// ricevuta deve andare alla casa.
  Future<void> avvia() async {
    final n = negozio;
    if (n == null || _avviato) return;
    _avviato = true;
    try {
      disponibile = await n.disponibile();
      if (!disponibile) {
        notifyListeners();
        return;
      }
      _iscrizione = n.acquisti.listen(
        (elenco) => unawaited(_arrivati(elenco)),
        onError: (Object e) => _male('$e'),
      );
      piani = await n.piani();
    } catch (e) {
      debugPrint('negozio: $e');
    }
    notifyListeners();
  }

  Future<void> compra(String piano) async {
    final n = negozio;
    if (n == null) return;
    errore = null;
    fatto = null;
    inCorso = true;
    notifyListeners();
    try {
      await n.compra(piano);
    } catch (_) {
      _male(
        inLingua(
          it: '${n.nome} non risponde. Riprova tra poco.',
          en: '${n.nome} isn\'t responding. Try again shortly.',
        ),
      );
    }
  }

  Future<void> ripristina() async {
    final n = negozio;
    if (n == null) return;
    errore = null;
    fatto = null;
    notifyListeners();
    try {
      await n.ripristina();
    } catch (_) {
      _male(
        inLingua(
          it: '${n.nome} non risponde. Riprova tra poco.',
          en: '${n.nome} isn\'t responding. Try again shortly.',
        ),
      );
    }
  }

  Future<void> _arrivati(List<PurchaseDetails> elenco) async {
    final n = negozio;
    if (n == null) return;
    for (final acquisto in elenco) {
      if (!eDiGdahomePremium(acquisto.productID)) continue;
      var chiudi = acquisto.pendingCompletePurchase;
      switch (acquisto.status) {
        case PurchaseStatus.purchased || PurchaseStatus.restored:
          final arrivata = await _portaAllaCasa(n, acquisto);
          if (!arrivata) _inSospeso.add(acquisto);
          chiudi = arrivata && chiudi;
        case PurchaseStatus.error:
          _male(
            acquisto.error?.message ??
                inLingua(it: 'Acquisto non riuscito.', en: 'Purchase failed.'),
          );
        case PurchaseStatus.canceled:
          inCorso = false;
          notifyListeners();
        case PurchaseStatus.pending:
          inCorso = true;
          notifyListeners();
      }
      /* Google Play vuole la conferma, se no dopo tre giorni rimborsa; l'App
       * Store la vuole per chiudere la transazione. Ma si conferma solo
       * quando la casa ha risposto — si' o no che sia: se la ricevuta non e'
       * arrivata (il filo giu', la casa spenta), la si lascia aperta, e il
       * negozio la ripropone al prossimo avvio. */
      if (chiudi) {
        try {
          await n.completa(acquisto);
        } catch (e) {
          debugPrint('negozio: $e');
        }
      }
    }
  }

  /// Porta la ricevuta alla casa. `true` quando la casa ha risposto, e
  /// l'acquisto si puo' chiudere.
  Future<bool> _portaAllaCasa(
    NegozioGdahome n,
    PurchaseDetails acquisto, {
    bool zitto = false,
  }) async {
    if (!zitto) {
      inCorso = true;
      notifyListeners();
    }
    final ricevuta = n.piattaforma == 'ios'
        ? (acquisto.purchaseID ??
              acquisto.verificationData.serverVerificationData)
        : acquisto.verificationData.serverVerificationData;
    try {
      await porta(
        piattaforma: n.piattaforma,
        prodotto: acquisto.productID,
        ricevuta: ricevuta,
      );
      inCorso = false;
      errore = null;
      fatto = inLingua(
        it: 'Fatto: la casa è Premium.',
        en: 'Done: your home is Premium.',
      );
      notifyListeners();
      return true;
    } on LicenzaRifiutata catch (no) {
      if (!zitto) _male(no.spiegazione);
      return no.definitiva;
    } catch (e) {
      if (!zitto) _male('$e');
      return false;
    }
  }

  void _male(String messaggio) {
    inCorso = false;
    errore = messaggio;
    notifyListeners();
  }

  @override
  void dispose() {
    _iscrizione?.cancel();
    super.dispose();
  }
}
