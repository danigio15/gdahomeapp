/* L'Apple Watch, dal lato del telefono.
 *
 * L'orologio con la casa non parla, ed e' la stessa regola di CarPlay: un
 * posto solo sa entrare in casa, ed e' il Dart dell'app. Qui si fanno due
 * cose sole:
 *
 *  - si porta al polso la fotografia: gli stessi tre file che legge CarPlay
 *    (la fotografia della casa, i comandi scelti, il biglietto di Premium),
 *    piu' la guida di gdanav, se si sta guidando;
 *  - si riceve quello che si e' toccato al polso, e lo si fa partire per la
 *    strada di sempre: il comando lasciato scritto e il colpetto al Dart
 *    (`LaCasaInCarPlay.lascia`), «portami a casa» a gdanav.
 *
 * Il formato della fotografia e dei messaggi e' quello di `docs/OROLOGIO.md`,
 * lo stesso su Wear OS (`android/.../orologio/IlTramiteDellOrologio.kt`).
 */
import Flutter
import Foundation
import WatchConnectivity
import gdanav_app

final class LOrologio: NSObject, WCSessionDelegate {
  static let shared = LOrologio()

  /* L'ultima guida avuta da gdanav (`GdanavOrologio`, per nome): arriva una
   * volta al secondo e anche di piu', e al polso si manda al piu' una volta
   * al secondo. */
  private var guida: [String: Any] = [:]
  private var inArrivo = false

  /// Si accende con l'app: il canale per il colpetto del Dart, la guida di
  /// gdanav, e la sessione con l'orologio.
  func accendi(motore: FlutterEngine) {
    FlutterMethodChannel(name: "gdahome/orologio", binaryMessenger: motore.binaryMessenger)
      .setMethodCallHandler { [weak self] chiamata, risposta in
        if chiamata.method == "aggiorna" {
          self?.manda()
          risposta(nil)
        } else {
          risposta(FlutterMethodNotImplemented)
        }
      }
    NotificationCenter.default.addObserver(
      forName: Notification.Name("gdanav.orologio.guida"), object: nil, queue: .main
    ) { [weak self] avviso in
      self?.guida = avviso.userInfo as? [String: Any] ?? [:]
      self?.mandaFraPoco()
    }
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  // MARK: - Al polso

  private func mandaFraPoco() {
    guard !inArrivo else { return }
    inArrivo = true
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
      self?.inArrivo = false
      self?.manda()
    }
  }

  /// La fotografia per l'orologio, in JSON: vedi `docs/OROLOGIO.md`.
  ///
  /// Senza Premium ci va solo questo: al polso si dice cosa serve, e i nomi
  /// di casa restano sul telefono.
  func fotografia() -> String {
    var foto: [String: Any] = ["v": 1, "premium": LaCasaInCarPlay.premium()]
    if LaCasaInCarPlay.premium() {
      let casa = LaCasaInCarPlay.laFoto() ?? [:]
      foto["casa"] = casa["casa"] as? String ?? ""
      foto["quando"] = casa["quando"] ?? 0
      foto["comandi"] = LaCasaInCarPlay.iComandi().comandi.map {
        ["id": $0.id, "nome": $0.nome, "disegno": $0.disegno, "conferma": $0.conferma]
      }
      foto["dispositivi"] = casa["dispositivi"] ?? []
      foto["azioni"] = casa["azioni"] ?? []
      foto["persone"] = casa["persone"] ?? []
      foto["misure"] = casa["fotovoltaico"] ?? []
      foto["nav"] = guida
    }
    guard let dati = try? JSONSerialization.data(withJSONObject: foto),
      let testo = String(data: dati, encoding: .utf8)
    else { return "{\"v\":1,\"premium\":false}" }
    return testo
  }

  /// La manda all'orologio, se ce n'e' uno con l'app sopra. Il sistema tiene
  /// solo l'ultima, e la consegna quando l'orologio si sveglia.
  func manda() {
    DispatchQueue.main.async {
      let s = WCSession.default
      guard WCSession.isSupported(), s.activationState == .activated, s.isPaired, s.isWatchAppInstalled else {
        return
      }
      try? s.updateApplicationContext(["foto": self.fotografia()])
    }
  }

  // MARK: - Dal polso

  func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
    DispatchQueue.main.async { self.esegui(message, risposta: replyHandler) }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    DispatchQueue.main.async { self.esegui(message) { _ in } }
  }

  private func esegui(_ messaggio: [String: Any], risposta: @escaping ([String: Any]) -> Void) {
    let cosa = messaggio["cosa"] as? String ?? ""
    if cosa == "aggiorna" {
      return risposta(["ok": true, "foto": fotografia()])
    }
    /* Uno schermo rimasto aperto al polso mentre Premium finiva: non parte
     * niente, come in auto. */
    guard LaCasaInCarPlay.premium() else {
      return risposta(["ok": false, "testo": "Serve gdahome Premium"])
    }
    switch cosa {
    case "comando":
      let id = (messaggio["id"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
      guard !id.isEmpty else { return risposta(["ok": false, "testo": "Comando sconosciuto"]) }
      let scritto = LaCasaInCarPlay.lascia(id)
      risposta(["ok": scritto, "testo": scritto ? "Fatto" : "Non sono riuscito a mandarlo"])
    case "vai":
      let dove = messaggio["dove"] as? String ?? ""
      guard dove == "casa" || dove == "lavoro" else { return risposta(["ok": false, "testo": "Meta sconosciuta"]) }
      GdanavCarPlay.vaiA(dove) { fatto in
        risposta([
          "ok": fatto,
          "testo": fatto ? "Calcolo il percorso…" : "Apri il navigatore sul telefono e imposta \(dove == "casa" ? "Casa" : "Lavoro")",
        ])
      }
    case "ferma":
      NotificationCenter.default.post(name: Notification.Name("gdanav.orologio.ferma"), object: nil)
      risposta(["ok": true, "testo": "Guida finita"])
    default:
      risposta(["ok": false, "testo": "Non so cosa fare"])
    }
  }

  // MARK: - La sessione

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
    if activationState == .activated { manda() }
  }

  /* L'app sull'orologio appena installata, o un orologio nuovo abbinato: si
   * manda subito, senza aspettare che cambi qualcosa in casa. */
  func sessionWatchStateDidChange(_ session: WCSession) { manda() }

  func sessionDidBecomeInactive(_ session: WCSession) {}

  /* Si e' passati a un altro orologio: la sessione va riaccesa per lui. */
  func sessionDidDeactivate(_ session: WCSession) { WCSession.default.activate() }
}
