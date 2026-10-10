/* Il filo col telefono, dal polso.
 *
 * L'orologio non ha le chiavi di casa, e non deve averle: se le avesse,
 * sarebbero due i posti che sanno entrare. Riceve la fotografia che il
 * telefono gli manda (`ios/Runner/LOrologio.swift`), e quando si tocca un
 * tasto lo chiede al telefono, che lo esegue col filo dell'app.
 */
import Foundation
import WatchConnectivity
import WatchKit

@MainActor
final class IlTelefono: NSObject, ObservableObject {
  @Published private(set) var foto: LaFoto?

  /// Com'e' andato l'ultimo tocco: «Fatto», o cosa non va. Si toglie da solo.
  @Published var avviso: String?

  /// Se un tocco e' in viaggio verso il telefono.
  @Published private(set) var inCorso = false

  func accendi() {
    /* La vetrina (`Vetrina.swift`): la casa d'esempio, e nessun filo. */
    if Vetrina.schermata != nil {
      foto = Vetrina.laFoto()
      return
    }
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  /// Chiede la fotografia di adesso, invece di aspettare che cambi qualcosa.
  func aggiorna() {
    guard Vetrina.schermata == nil else { return }
    guard WCSession.default.activationState == .activated, WCSession.default.isReachable else { return }
    WCSession.default.sendMessage(["cosa": "aggiorna"]) { [weak self] risposta in
      let testo = risposta["foto"] as? String
      Task { @MainActor in self?.prendi(testo) }
    } errorHandler: { _ in }
  }

  func premi(_ id: String) { manda(["cosa": "comando", "id": id]) }

  func vai(_ dove: String) { manda(["cosa": "vai", "dove": dove]) }

  func ferma() { manda(["cosa": "ferma"]) }

  private func manda(_ messaggio: [String: Any]) {
    let s = WCSession.default
    guard s.activationState == .activated, s.isReachable else {
      return dici("Il telefono non risponde. Tienilo vicino, con gdahome installata.", bene: false)
    }
    inCorso = true
    s.sendMessage(messaggio) { [weak self] risposta in
      let ok = (risposta["ok"] as? Bool) == true
      let testo = risposta["testo"] as? String ?? (ok ? "Fatto" : "Non è partito")
      Task { @MainActor in
        self?.inCorso = false
        self?.dici(testo, bene: ok)
      }
    } errorHandler: { [weak self] _ in
      Task { @MainActor in
        self?.inCorso = false
        self?.dici("Il telefono non ha risposto", bene: false)
      }
    }
  }

  private func dici(_ testo: String, bene: Bool) {
    WKInterfaceDevice.current().play(bene ? .success : .failure)
    avviso = testo
    let detto = testo
    Task { @MainActor [weak self] in
      try? await Task.sleep(nanoseconds: 3_000_000_000)
      if self?.avviso == detto { self?.avviso = nil }
    }
  }

  fileprivate func prendi(_ testo: String?) {
    if let nuova = LaFoto.leggi(testo) { foto = nuova }
  }
}

extension IlTelefono: WCSessionDelegate {
  nonisolated func session(
    _ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?
  ) {
    /* L'ultima che il sistema ha tenuto da parte: c'e' subito, anche col
     * telefono lontano. Poi se ne chiede una fresca. */
    let testo = session.receivedApplicationContext["foto"] as? String
    Task { @MainActor [weak self] in
      self?.prendi(testo)
      self?.aggiorna()
    }
  }

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    let testo = applicationContext["foto"] as? String
    Task { @MainActor [weak self] in self?.prendi(testo) }
  }

  nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
    guard session.isReachable else { return }
    Task { @MainActor [weak self] in self?.aggiorna() }
  }
}
