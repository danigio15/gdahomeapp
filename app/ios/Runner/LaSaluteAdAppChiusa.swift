/* La salute ad app chiusa, sull'iPhone (`lib/salute/ad_app_chiusa.dart`).
 *
 * La sveglia la da' Salute stessa: per ogni tipo osservato (i passi, le
 * calorie, il battito, la notte, la pesata, la pressione: li sceglie il Dart,
 * `daOsservareSuIPhone`) si apre una HKObserverQuery e si accende la
 * consegna in background (`enableBackgroundDelivery`, al piu' una volta
 * l'ora). Quando arriva un dato nuovo iOS sveglia l'app — anche chiusa, anche
 * dopo un riavvio — e chiama l'osservatore: qui si sveglia il Dart, che legge
 * e manda alla casa, e quando ha finito si dice a Salute «fatto».
 *
 * Tre regole di Apple, rispettate tutte:
 *  - le query si aprono **all'avvio** (`application(_:didFinishLaunching…)`),
 *    altrimenti un'app svegliata da Salute non ha nessuno che ascolta. Per
 *    questo i tipi si ricordano in `UserDefaults`;
 *  - il «fatto» (`completionHandler`) si chiama **sempre**, anche se il Dart
 *    non risponde: dopo tre sveglie senza «fatto» Salute smette di svegliare.
 *    Qui al piu' dopo 25 secondi;
 *  - a telefono bloccato i dati di Salute sono cifrati e non si leggono: il
 *    Dart lo sa da `leggibile`, non apre nemmeno il filo, e si aspetta la
 *    prossima sveglia.
 *
 * Il permesso `com.apple.developer.healthkit.background-delivery` sta in
 * `Runner.entitlements`. Niente `UIBackgroundModes` in piu': per la consegna
 * di Salute non servono.
 */
import Flutter
import Foundation
import HealthKit
import UIKit

final class LaSaluteAdAppChiusa {
  static let shared = LaSaluteAdAppChiusa()

  /// Lo stesso nome di `canaleDellaSveglia` in `ad_app_chiusa.dart`.
  private static let canale = "gdahome/salute/sveglia"
  private static let ricordati = "gdahome.salute.adAppChiusa.tipi"
  /// Il tetto di una sveglia: iOS ne concede una trentina di secondi.
  private static let tetto: TimeInterval = 25

  private let salute = HKHealthStore()
  private var query: [String: HKObserverQuery] = [:]
  private var filo: FlutterMethodChannel?

  /* Il Dart ha detto «pronto»: prima, le sveglie aspettano. */
  private var pronto = false
  /* I «fatto» da dire a Salute: le sveglie di piu' tipi arrivano insieme, e
   * il giro del Dart e' uno solo per tutte quelle in attesa. Ognuna ha il
   * suo numero, perche' il tetto di una non chiuda quelle venute dopo. */
  private var attese: [(numero: Int, fatto: HKObserverQueryCompletionHandler)] = []
  private var numeri = 0
  /* Il giro in corso: le sveglie che copre, e il suo numero. Una risposta
   * del Dart arrivata tardi, dopo il tetto, non tocca il giro dopo. */
  private var nelGiro: Set<Int> = []
  private var giro = 0
  private var tempoInPiu: UIBackgroundTaskIdentifier = .invalid

  /// All'avvio, dentro `didFinishLaunching`: il canale, e gli osservatori
  /// dei tipi ricordati.
  func accendi(motore: FlutterEngine) {
    let canale = FlutterMethodChannel(
      name: LaSaluteAdAppChiusa.canale, binaryMessenger: motore.binaryMessenger)
    filo = canale
    canale.setMethodCallHandler { [weak self] chiamata, risposta in
      guard let self else {
        risposta(nil)
        return
      }
      switch chiamata.method {
      case "pronto":
        self.pronto = true
        self.forseParti()
        risposta(nil)
      case "osserva":
        let argomenti = chiamata.arguments as? [String: Any]
        let tipi = (argomenti?["tipi"] as? [String]) ?? []
        UserDefaults.standard.set(tipi, forKey: LaSaluteAdAppChiusa.ricordati)
        self.osserva(tipi)
        risposta(nil)
      case "spegni":
        UserDefaults.standard.removeObject(forKey: LaSaluteAdAppChiusa.ricordati)
        self.osserva([])
        risposta(nil)
      default:
        risposta(FlutterMethodNotImplemented)
      }
    }
    let ricordati = UserDefaults.standard.stringArray(forKey: LaSaluteAdAppChiusa.ricordati) ?? []
    osserva(ricordati)
  }

  private func tipo(_ nome: String) -> HKSampleType? {
    if nome == HKCategoryTypeIdentifier.sleepAnalysis.rawValue {
      return HKObjectType.categoryType(forIdentifier: .sleepAnalysis)
    }
    return HKObjectType.quantityType(forIdentifier: HKQuantityTypeIdentifier(rawValue: nome))
  }

  /* Apre gli osservatori di questi tipi e chiude quelli degli altri. */
  private func osserva(_ nomi: [String]) {
    guard HKHealthStore.isHealthDataAvailable() else { return }
    let voluti = Set(nomi)
    for (nome, vecchia) in query where !voluti.contains(nome) {
      salute.stop(vecchia)
      query[nome] = nil
      if let tipo = tipo(nome) {
        salute.disableBackgroundDelivery(for: tipo) { _, _ in }
      }
    }
    for nome in voluti where query[nome] == nil {
      guard let tipo = tipo(nome) else { continue }
      let nuova = HKObserverQuery(sampleType: tipo, predicate: nil) {
        [weak self] _, fatto, errore in
        /* Un osservatore che sbaglia (il permesso tolto) dice «fatto» e
         * basta: niente giro. */
        if errore != nil {
          fatto()
          return
        }
        DispatchQueue.main.async {
          guard let self else {
            fatto()
            return
          }
          self.svegliato(fatto)
        }
      }
      query[nome] = nuova
      salute.execute(nuova)
      salute.enableBackgroundDelivery(for: tipo, frequency: .hourly) { _, _ in }
    }
  }

  /* Sul filo principale. */
  private func svegliato(_ fatto: @escaping HKObserverQueryCompletionHandler) {
    /* Solo ad app chiusa o in background. Con l'app davanti — o che si sta
     * aprendo, `.inactive`: all'apertura ogni osservatore risponde una
     * volta da solo — ci pensa il postino, ogni quarto d'ora; e il giro di
     * qui manderebbe a riposo il filo proprio mentre la si guarda. */
    if UIApplication.shared.applicationState != .background {
      fatto()
      return
    }
    numeri += 1
    let numero = numeri
    attese.append((numero: numero, fatto: fatto))
    if tempoInPiu == .invalid {
      tempoInPiu = UIApplication.shared.beginBackgroundTask(withName: "gdahome-salute") {
        [weak self] in self?.chiudiTutte()
      }
    }
    /* Il tetto: anche se il Dart non risponde, Salute riceve il suo «fatto»,
     * e il giro rimasto appeso non blocca quelli dopo. */
    DispatchQueue.main.asyncAfter(deadline: .now() + LaSaluteAdAppChiusa.tetto) {
      [weak self] in
      guard let self else { return }
      if self.nelGiro.contains(numero) { self.nelGiro = [] }
      self.chiudi([numero])
    }
    forseParti()
  }

  private func forseParti() {
    guard pronto, nelGiro.isEmpty, !attese.isEmpty, let filo else { return }
    giro += 1
    let questo = giro
    nelGiro = Set(attese.map { $0.numero })
    let leggibile = UIApplication.shared.isProtectedDataAvailable
    filo.invokeMethod("sveglia", arguments: ["leggibile": leggibile]) { [weak self] _ in
      guard let self, self.giro == questo else { return }
      let coperte = self.nelGiro
      self.nelGiro = []
      self.chiudi(coperte)
      /* Sveglie arrivate durante il giro: un altro giro (il Dart dira'
       * «presto» se e' passato meno di un quarto d'ora). */
      self.forseParti()
    }
  }

  /* I «fatto» di queste sveglie, una volta sola ciascuna. */
  private func chiudi(_ quali: Set<Int>) {
    let da = attese.filter { quali.contains($0.numero) }
    attese.removeAll { quali.contains($0.numero) }
    for attesa in da { attesa.fatto() }
    finitoTutto()
  }

  /* iOS sta per sospendere l'app: si chiude tutto quello che resta. */
  private func chiudiTutte() {
    let tutte = attese
    attese = []
    nelGiro = []
    for attesa in tutte { attesa.fatto() }
    finitoTutto()
  }

  private func finitoTutto() {
    guard attese.isEmpty, tempoInPiu != .invalid else { return }
    UIApplication.shared.endBackgroundTask(tempoInPiu)
    tempoInPiu = .invalid
  }
}
