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
import 'package:in_app_purchase_storekit/in_app_purchase_storekit.dart';
import 'package:in_app_purchase_storekit/store_kit_2_wrappers.dart';
import 'package:in_app_purchase_storekit/store_kit_wrappers.dart';

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

/// I giorni di prova gratuita, la prima volta. Su Google Play li dice
/// l'offerta stessa («P14D»); l'App Store dice solo se la prova spetta, e
/// quanto dura e' quello scritto in App Store Connect: questo numero.
const giorniDiProva = 14;

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
  const PianoGdahome({
    required this.id,
    required this.prezzo,
    this.giorniProva = 0,
  });

  /// [pianoMensile] o [pianoAnnuale].
  final String id;

  /// Il prezzo come lo scrive il negozio, nella valuta di chi compra: quello
  /// che si paga dopo la prova.
  final String prezzo;

  /// Quanti giorni gratis prima di pagare. 0: niente prova (gia' usata, o
  /// nessuna offerta). La prova spetta una volta sola per abbonamento.
  final int giorniProva;
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

  /// Gli acquisti pagati che la casa non ha ancora avuto, da riportarle.
  ///
  /// Su Google Play sono quelli non ancora confermati: l'app chiusa prima
  /// che la casa rispondesse. Google non li ripropone da solo, e senza
  /// conferma dopo tre giorni li rimborsa. Sull'App Store niente: li'
  /// StoreKit ripropone da solo, a ogni avvio, quelli non ancora chiusi.
  Future<List<PurchaseDetails>> rimastiAMeta();
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
      /* Il prezzo che si scrive e' quello dell'ultima fase, cioe' quello che
       * si paga. La prova e' una prima fase a prezzo zero: Google la propone
       * solo a chi non l'ha gia' usata, e per ogni piano base si tiene
       * l'offerta con la prova, se c'e'. */
      final fasi = offerta.pricingPhases;
      final prova = fasi.length > 1 && fasi.first.priceAmountMicros == 0
          ? giorniDelPeriodo(fasi.first.billingPeriod)
          : 0;
      final gia = piani[offerta.basePlanId];
      if (gia != null && prova <= gia.giorniProva) continue;
      piani[offerta.basePlanId] = PianoGdahome(
        id: offerta.basePlanId,
        prezzo: fasi.last.formattedPrice,
        giorniProva: prova,
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

  @override
  Future<List<PurchaseDetails>> rimastiAMeta() async {
    final risposta = await _iap
        .getPlatformAddition<InAppPurchaseAndroidPlatformAddition>()
        .queryPastPurchases();
    /* Solo quelli pagati e non confermati. Uno confermato la casa l'ha gia'
     * avuto: riportarlo a ogni avvio sposterebbe l'abbonamento sulla casa
     * aperta, che e' il lavoro di «Ripristina abbonamento», e lo fa solo
     * chi lo chiede. */
    return [
      for (final acquisto in risposta.pastPurchases)
        if (eDiGdahomePremium(acquisto.productID) &&
            acquisto.status == PurchaseStatus.purchased &&
            acquisto.pendingCompletePurchase)
          acquisto,
    ];
  }
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
      /* La prova spetta una volta sola per gruppo: chi l'ha gia' usata paga
       * subito, e StoreKit lo sa. */
      var prova = false;
      if (dettaglio is AppStoreProduct2Details) {
        try {
          prova = await SK2Product.isIntroductoryOfferEligible(id);
        } catch (_) {}
      } else if (dettaglio is AppStoreProductDetails) {
        prova =
            dettaglio.skProduct.introductoryPrice?.paymentMode ==
            SKProductDiscountPaymentMode.freeTrail;
      }
      piani.add(
        PianoGdahome(
          id: piano,
          prezzo: dettaglio.price,
          giorniProva: prova ? giorniDiProva : 0,
        ),
      );
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

  @override
  Future<List<PurchaseDetails>> rimastiAMeta() async => const [];
}

/// «P14D», «P2W», «P1M» → giorni.
int giorniDelPeriodo(String periodo) {
  final trovato = RegExp(r'P(\d+)([DWM])').firstMatch(periodo);
  if (trovato == null) return 0;
  final quanti = int.parse(trovato.group(1)!);
  return switch (trovato.group(2)) {
    'W' => quanti * 7,
    'M' => quanti * 30,
    _ => quanti,
  };
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

  /// Se c'e' una ricevuta che aspetta la casa: pagato, e la casa non l'ha
  /// ancora avuta. La pagina Premium lo dice al posto del bottone per
  /// comprare, cosi' nessuno paga due volte.
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
        notifyListeners();
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

  /// I giorni di prova di un piano, come li dice il negozio. Senza negozio
  /// (web, prove) 0: la prova la promette solo chi la puo' dare.
  int provaDi(String piano) =>
      piani.where((uno) => uno.id == piano).firstOrNull?.giorniProva ?? 0;

  /// Il prezzo di un piano: quello del negozio, o quello di riserva.
  String prezzoDi(String piano) {
    final dalNegozio = piani.where((uno) => uno.id == piano).firstOrNull;
    if (dalNegozio == null) return prezzoDiRiserva(piano);
    /* Il negozio scrive solo la cifra («4,99 €»): il periodo lo si aggiunge
     * qui, come nei prezzi di riserva. */
    return piano == pianoAnnuale
        ? inLingua(
            it: '${dalNegozio.prezzo}/anno',
            en: '${dalNegozio.prezzo}/year',
          )
        : inLingua(
            it: '${dalNegozio.prezzo}/mese',
            en: '${dalNegozio.prezzo}/month',
          );
  }

  /// Si mette in ascolto del negozio. Va fatto presto: un acquisto finito
  /// mentre l'app era chiusa arriva appena ci si mette in ascolto, e la sua
  /// ricevuta deve andare alla casa.
  ///
  /// Le volte dopo la prima — la pagina Premium la chiama ogni volta che si
  /// apre — rilegge solo i piani ([_rileggiIPiani]).
  Future<void> avvia() async {
    final n = negozio;
    if (n == null) return;
    if (_avviato) {
      await _rileggiIPiani(n);
      return;
    }
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
    /* Un acquisto pagato la volta scorsa, con l'app chiusa prima che la casa
     * lo avesse: su Google Play non torna da solo come sull'App Store, e lo
     * si va a prendere. La sua ricevuta parte come quella di un acquisto
     * appena fatto, o aspetta la casa ([riprova]). */
    if (!disponibile) return;
    try {
      final rimasti = await n.rimastiAMeta();
      if (rimasti.isNotEmpty) await _arrivati(rimasti);
    } catch (e) {
      debugPrint('negozio: $e');
    }
  }

  bool _rileggendo = false;

  /* I prezzi e la prova si richiedono a ogni apertura della pagina Premium.
   * L'app resta aperta anche per giorni, e intanto chi vende cambia il
   * prezzo, o chi ha appena usato la prova non ce l'ha piu'. Letti una volta
   * sola, la pagina diceva i prezzi di quando l'app era partita, mentre il
   * Play Store, al momento di pagare, chiedeva quelli nuovi.
   *
   * Un negozio che non risponde, o che risponde vuoto, lascia i piani che
   * c'erano. */
  Future<void> _rileggiIPiani(NegozioGdahome n) async {
    if (!disponibile || _rileggendo) return;
    _rileggendo = true;
    try {
      final nuovi = await n.piani();
      if (nuovi.isNotEmpty) {
        piani = nuovi;
        notifyListeners();
      }
    } catch (e) {
      debugPrint('negozio: $e');
    } finally {
      _rileggendo = false;
    }
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
      /* Su Google Play un acquisto annullato, o andato male prima ancora di
       * esistere, arriva senza prodotto: e' la risposta a quello in corso.
       * Saltarlo lascerebbe il bottone a girare finche' non si riapre
       * l'app. */
      if (acquisto.productID.isEmpty) {
        if (acquisto.status == PurchaseStatus.error) {
          _male(_ilNoDelNegozio(n, acquisto.error));
        } else if (acquisto.status != PurchaseStatus.pending) {
          inCorso = false;
          notifyListeners();
        }
        continue;
      }
      if (!eDiGdahomePremium(acquisto.productID)) continue;
      /* Lo stesso acquisto due volte — quello rimasto a meta' e il negozio
       * che lo ripropone — e' una ricevuta sola. */
      if (_inSospeso.any((uno) => _loStesso(uno, acquisto))) continue;
      var chiudi = acquisto.pendingCompletePurchase;
      switch (acquisto.status) {
        case PurchaseStatus.purchased || PurchaseStatus.restored:
          final arrivata = await _portaAllaCasa(n, acquisto);
          if (!arrivata) {
            _inSospeso.add(acquisto);
            notifyListeners();
          }
          chiudi = arrivata && chiudi;
        case PurchaseStatus.error:
          _male(_ilNoDelNegozio(n, acquisto.error));
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
        it: 'Fatto: ora la casa è Premium.',
        en: 'Done: your home is now Premium.',
      );
      notifyListeners();
      return true;
    } on LicenzaRifiutata catch (no) {
      /* Un no di chi decide — il negozio che non conferma — si dice in rosso.
       * Uno della strada no: il pagamento c'e', la ricevuta resta in sospeso
       * e arriva da sola quando la casa risponde. La pagina lo dice senza
       * allarmare ([ceUnaRicevutaInSospeso]). */
      if (no.definitiva) {
        if (!zitto) _male(no.spiegazione);
      } else if (!zitto) {
        inCorso = false;
        errore = null;
        notifyListeners();
      }
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

  /// Il no del negozio, detto a chi compra. Google Play risponde con un
  /// codice («BillingResponse.itemAlreadyOwned») e StoreKit col nome di un
  /// dominio («SKErrorDomain»): a chi compra non dicono niente.
  static String _ilNoDelNegozio(NegozioGdahome n, IAPError? errore) {
    /* Un abbonamento per account: chi ce l'ha gia' — su un'altra casa — non
     * ne compra un secondo, lo sposta. */
    if ((errore?.message ?? '').contains('itemAlreadyOwned')) {
      return inLingua(
        it:
            'Con questo account l\'abbonamento c\'è già. Se è attivo su '
            'un\'altra casa, «Ripristina abbonamento» lo porta qui.',
        en:
            'This account already has the subscription. If it\'s active on '
            'another home, “Restore subscription” moves it here.',
      );
    }
    return inLingua(
      it: 'Acquisto non riuscito: ${n.nome} non l\'ha completato. Riprova.',
      en: 'Purchase failed: the ${n.nome} didn\'t complete it. Try again.',
    );
  }

  /// Lo stesso acquisto: dalla transazione, se tutti e due ce l'hanno, se no
  /// dal token di Google. Non dal token e basta: sull'App Store
  /// `serverVerificationData` e' la ricevuta dell'app intera, la stessa per
  /// tutti gli acquisti.
  static bool _loStesso(PurchaseDetails uno, PurchaseDetails altro) {
    final id = uno.purchaseID ?? '';
    final suo = altro.purchaseID ?? '';
    if (id.isNotEmpty && suo.isNotEmpty) return id == suo;
    final token = uno.verificationData.serverVerificationData;
    return token.isNotEmpty &&
        token == altro.verificationData.serverVerificationData;
  }

  @override
  void dispose() {
    _iscrizione?.cancel();
    super.dispose();
  }
}
