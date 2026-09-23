/// La cassaforte: dove si scrive quello che non deve leggere nessun altro.
///
/// Il portachiavi del sistema — Keychain sull'iPhone, Keystore su Android — e
/// non le preferenze: quelle su Android sono un file XML che si legge da fuori
/// con un telefono sbloccato, e li' dentro ci finiscono i segni che aprono
/// casa.
///
/// L'interfaccia esiste perche' il portachiavi vero dentro una prova non c'e'.
///
/// **Nel browser** un portachiavi del sistema non c'e', e il pacchetto tiene i
/// segni cifrati nel deposito della pagina, con la loro chiave accanto. E'
/// una scelta ragionata, non una svista: nel browser tutto quello che gira
/// sull'origine dell'app — l'app, e la plancia che le sta in un riquadro della
/// stessa origine — puo' usare qualunque chiave l'app sappia usare, anche una
/// chiave WebCrypto «non esportabile». Una chiave cosi' impedirebbe di
/// portarsela via, non di leggere i segni; e in cambio chiederebbe un
/// trasloco dei segni gia' salvati, con il rischio di perdere l'abbinamento
/// a chi usa l'app da browser. La difesa vera nel browser e' un'altra: che
/// sull'origine dell'app non giri niente che non sia nostro — i messaggi fra
/// le finestre accettati solo da chi deve (`servitore_qui/sul_web.dart`), e
/// le regole della pagina in `web/index.html`.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract interface class Cassaforte {
  Future<String?> leggi(String chiave);
  Future<void> scrivi(String chiave, String valore);
  Future<void> cancella(String chiave);
}

class CassaforteDelSistema implements Cassaforte {
  const CassaforteDelSistema({
    this.dentro = portachiavi,
    this.riscriviLeVecchie,
  });

  /// Il portachiavi, con le sue regole.
  ///
  /// Sull'iPhone `first_unlock_this_device`: il segno si legge anche a
  /// schermo spento — l'app si deve poter ricollegare per una notifica, o
  /// per un riquadro nella schermata iniziale, e con `unlocked` non si
  /// potrebbe — ma **resta su questo telefono**. Senza `this_device` il
  /// portachiavi lo metterebbe nelle copie di iCloud e lo porterebbe su un
  /// iPhone nuovo, e il segno che apre casa non deve uscire dal telefono a
  /// cui e' stato dato.
  static const portachiavi = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  /// Il portachiavi vero; nelle prove, uno finto.
  final FlutterSecureStorage dentro;

  /// Se riscrivere i segni salvati con le regole di prima. `null` vuol dire
  /// «sull'iPhone si', altrove no».
  final bool? riscriviLeVecchie;

  /* Le chiavi gia' riscritte con le regole di oggi, in questo avvio. */
  static final _riscritte = <String>{};

  @visibleForTesting
  static void scordaLeRiscritte() => _riscritte.clear();

  /* Sull'iPhone i segni salvati prima avevano `first_unlock` — senza
   * `this_device` — e il portachiavi non cambia le regole di un segno che
   * c'e' gia': lo si riscrive una volta, e il pacchetto lo rimette con quelle
   * nuove. Altrove non serve: le regole dell'iPhone valgono solo li'. */
  bool get _riscrive =>
      riscriviLeVecchie ??
      (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS);

  @override
  Future<String?> leggi(String chiave) async {
    final letto = await dentro.read(key: chiave);
    if (letto != null && _riscrive && _riscritte.add(chiave)) {
      try {
        await dentro.write(key: chiave, value: letto);
      } catch (_) {
        /* Resta com'era, e si riprova al prossimo avvio: il segno si legge
         * lo stesso, ed e' quello che conta adesso. */
        _riscritte.remove(chiave);
      }
    }
    return letto;
  }

  @override
  Future<void> scrivi(String chiave, String valore) async {
    await dentro.write(key: chiave, value: valore);
    _riscritte.add(chiave);
  }

  @override
  Future<void> cancella(String chiave) => dentro.delete(key: chiave);
}

/// La cassaforte delle prove: sta in memoria e sparisce col processo.
class CassaforteInMemoria implements Cassaforte {
  final _dentro = <String, String>{};

  /// Quante volte si e' scritto. Serve a provare che non si scriva a vuoto.
  int scritture = 0;

  @override
  Future<String?> leggi(String chiave) async => _dentro[chiave];

  @override
  Future<void> scrivi(String chiave, String valore) async {
    scritture += 1;
    _dentro[chiave] = valore;
  }

  @override
  Future<void> cancella(String chiave) async => _dentro.remove(chiave);
}
