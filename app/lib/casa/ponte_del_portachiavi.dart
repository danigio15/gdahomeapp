/// Il ponte del portachiavi: la copia dei segni che sopravvive al cambio di
/// firma dell'app.
///
/// Sull'iPhone ogni voce del portachiavi sta in un «gruppo di accesso» che
/// comincia con l'identificativo del team che ha firmato l'app. Se l'app
/// passa a un altro account Apple Developer — un trasferimento, come quello
/// a una societa' che la vende — il team cambia, e la versione firmata dal
/// team nuovo non vede piu' niente di quello che aveva scritto la vecchia:
/// l'abbinamento della casa, e per gdanav l'abbinamento con Home Assistant e
/// l'auto scelta. Chi aggiorna si ritroverebbe davanti alla schermata del QR
/// code, come alla prima apertura.
///
/// Il ponte e' una copia dei segni in un file nella cartella di supporto
/// dell'app, `portachiavi-ponte-<nome>.json`, tenuta al passo a ogni
/// scrittura e a ogni cancellazione. Quando il portachiavi risulta vuoto e la
/// copia no — ed e' esattamente quello che succede alla prima apertura dopo
/// il cambio di team — i segni si rimettono nel portachiavi dalla copia, e da
/// li' si va avanti come sempre. La versione **prima** del trasferimento
/// scrive la copia; la prima versione firmata dal team nuovo la ritrova.
///
/// Cosa resta vero, e cosa no:
/// - la copia **non esce dal telefono**: la cartella di supporto e' fuori
///   dalle copie di iCloud e di iTunes (`AppDelegate.fuoriDalleCopie`), e il
///   file ha la protezione dei dati di serie dell'iPhone, leggibile solo dopo
///   il primo sblocco. Disinstallando l'app se ne va con lei;
/// - la copia sta nella cartella privata dell'app, non nel portachiavi: la
///   protegge il recinto dell'app e la cifratura del disco, non il
///   portachiavi. E' il prezzo di sopravvivere al cambio di firma, e si paga
///   solo sull'iPhone: altrove il ponte e' spento, e questo e' un portachiavi
///   come un altro;
/// - un portachiavi vuoto **con** una copia piena si riempie; uno vuoto senza
///   copia e' una prima apertura; uno pieno non guarda mai la copia. Togliere
///   l'ultima casa svuota anche la copia.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'copia_del_portachiavi/copia.dart';

/// Un portachiavi che tiene la sua copia sul disco, e da li' si rifa' quando
/// si ritrova vuoto. Per il resto e' un [FlutterSecureStorage] qualunque: le
/// regole del portachiavi ([iOptions], [aOptions]) sono le sue.
class PortachiaviColPonte extends FlutterSecureStorage {
  const PortachiaviColPonte({
    required this.nome,
    super.iOptions,
    super.aOptions,
    this.cartella,
    this.acceso,
  });

  /// Lo scomparto: `casa` per i segni della casa, `gdanav` per quelli del
  /// navigatore. Fa il nome del file della copia.
  final String nome;

  /// Dove sta la copia; `null`: la cartella di supporto dell'app. Nelle
  /// prove una cartella provvisoria.
  final String? cartella;

  /// Se il ponte e' acceso; `null`: solo sull'iPhone, che e' l'unico posto
  /// dove serve.
  final bool? acceso;

  bool get _attivo =>
      acceso ?? (!kIsWeb && defaultTargetPlatform == TargetPlatform.iOS);

  /* Il ripristino si prova una volta per scomparto a ogni avvio, alla prima
   * lettura, e tutte le letture che arrivano intanto aspettano quella: un
   * portachiavi vuoto si guarda una volta sola, e dopo vale com'e'. */
  static final _ripristini = <String, Future<void>>{};

  @visibleForTesting
  static void scordaIRipristini() => _ripristini.clear();

  CopiaDelPortachiavi get _copia =>
      copiaDiQuestoSistema(nome: nome, cartella: cartella);

  Future<void> _ripristina() {
    if (!_attivo) return Future.value();
    return _ripristini[nome] ??= _ripristinaDavvero();
  }

  Future<void> _ripristinaDavvero() async {
    try {
      /* Un portachiavi con qualcosa dentro e' quello buono: la copia non si
       * guarda nemmeno, anzi si rifa' da lui. E' cosi' che la copia nasce per
       * chi aveva gia' i suoi segni prima del ponte — i segni non si scrivono
       * tutti i giorni, e una copia che aspettasse la prossima scrittura
       * potrebbe non esserci mai. Solo un portachiavi vuoto puo' essere
       * «vuoto perche' il team e' cambiato». */
      final nelPortachiavi = await super.readAll();
      if (nelPortachiavi.isNotEmpty) {
        await _copia.scrivi(nelPortachiavi);
        return;
      }
      final copia = await _copia.leggi();
      if (copia == null || copia.isEmpty) return;
      for (final MapEntry(:key, :value) in copia.entries) {
        await super.write(key: key, value: value);
      }
    } catch (_) {
      /* Un portachiavi che non risponde, una copia che non si legge: si va
       * avanti con quello che c'e', e si riprova al prossimo avvio. */
    }
  }

  /// La copia si rifa' tutta, dal portachiavi, dopo ogni scrittura: cosi' e'
  /// sempre uguale a quello che c'e' dentro, cancellazioni comprese.
  Future<void> _aggiornaLaCopia() async {
    if (!_attivo) return;
    try {
      await _copia.scrivi(await super.readAll());
    } catch (_) {
      /* Il portachiavi e' la verita'; la copia, se oggi non si scrive, si
       * rifa' alla prossima scrittura. */
    }
  }

  @override
  Future<String?> read({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    await _ripristina();
    return super.read(
      key: key,
      iOptions: iOptions,
      aOptions: aOptions,
      lOptions: lOptions,
      webOptions: webOptions,
      mOptions: mOptions,
      wOptions: wOptions,
    );
  }

  @override
  Future<Map<String, String>> readAll({
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    await _ripristina();
    return super.readAll(
      iOptions: iOptions,
      aOptions: aOptions,
      lOptions: lOptions,
      webOptions: webOptions,
      mOptions: mOptions,
      wOptions: wOptions,
    );
  }

  @override
  Future<bool> containsKey({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    await _ripristina();
    return super.containsKey(
      key: key,
      iOptions: iOptions,
      aOptions: aOptions,
      lOptions: lOptions,
      webOptions: webOptions,
      mOptions: mOptions,
      wOptions: wOptions,
    );
  }

  @override
  Future<void> write({
    required String key,
    required String? value,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    /* Prima il ripristino: una scrittura su un portachiavi vuoto per il
     * cambio di team, senza, farebbe della copia piena una copia di una
     * chiave sola. */
    await _ripristina();
    await super.write(
      key: key,
      value: value,
      iOptions: iOptions,
      aOptions: aOptions,
      lOptions: lOptions,
      webOptions: webOptions,
      mOptions: mOptions,
      wOptions: wOptions,
    );
    await _aggiornaLaCopia();
  }

  @override
  Future<void> delete({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    await _ripristina();
    await super.delete(
      key: key,
      iOptions: iOptions,
      aOptions: aOptions,
      lOptions: lOptions,
      webOptions: webOptions,
      mOptions: mOptions,
      wOptions: wOptions,
    );
    await _aggiornaLaCopia();
  }

  @override
  Future<void> deleteAll({
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    await _ripristina();
    await super.deleteAll(
      iOptions: iOptions,
      aOptions: aOptions,
      lOptions: lOptions,
      webOptions: webOptions,
      mOptions: mOptions,
      wOptions: wOptions,
    );
    await _aggiornaLaCopia();
  }
}
