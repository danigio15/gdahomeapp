import AppIntents
import UIKit
import gdanav_app

/* «Ehi Siri, naviga con gdahome»: i comandi vocali del navigatore, come
 * «Ok Google, naviga verso…» su Android Auto. Siri li sente anche in
 * CarPlay; l'app li esegue senza aprirsi sul telefono (il motore Flutter si
 * accende da se' all'avvio), e la guida parte sulla mappa di CarPlay come su
 * quella del telefono. Il lavoro vero lo fa gdanav (`GdanavCarPlay.naviga`).
 *
 * Le frasi sono scritte in inglese, la lingua di base del progetto; quelle
 * italiane stanno in `it.lproj/AppShortcuts.strings` (le frasi per Siri: il
 * formato xcstrings, per quelle, vuole l'iOS 17) e in `Localizable.xcstrings`
 * (titoli e risposte). */

@available(iOS 16.0, *)
struct NavigaVerso: AppIntent {
  static let title: LocalizedStringResource = "Navigate to"
  static let description = IntentDescription("Finds a place or an address and starts guidance.")
  static let openAppWhenRun = false

  @Parameter(title: "Destination", requestValueDialog: "Where do you want to go?")
  var destinazione: String

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    await ComandiVocali.aspetta { GdanavCarPlay.naviga(destinazione, fatto: $0) }
    return .result(dialog: "Looking for \(destinazione).")
  }
}

@available(iOS 16.0, *)
struct AggiungiTappa: AppIntent {
  static let title: LocalizedStringResource = "Add a stop"
  static let description = IntentDescription("Adds a place to the current trip.")
  static let openAppWhenRun = false

  @Parameter(title: "Stop", requestValueDialog: "Where do you want to stop?")
  var tappa: String

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    await ComandiVocali.aspetta { GdanavCarPlay.naviga(tappa, tappa: true, fatto: $0) }
    return .result(dialog: "Looking for \(tappa) on the way.")
  }
}

@available(iOS 16.0, *)
struct PortamiACasa: AppIntent {
  static let title: LocalizedStringResource = "Take me home"
  static let openAppWhenRun = false

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    if await ComandiVocali.aspetta({ GdanavCarPlay.vaiA("casa", fatto: $0) }) {
      return .result(dialog: "Heading home.")
    }
    return .result(dialog: "Home isn't set yet: set it from the Menu.")
  }
}

@available(iOS 16.0, *)
struct PortamiAlLavoro: AppIntent {
  static let title: LocalizedStringResource = "Take me to work"
  static let openAppWhenRun = false

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    if await ComandiVocali.aspetta({ GdanavCarPlay.vaiA("lavoro", fatto: $0) }) {
      return .result(dialog: "Heading to work.")
    }
    return .result(dialog: "Work isn't set yet: set it from the Menu.")
  }
}

@available(iOS 16.0, *)
struct ComandiGdahome: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: NavigaVerso(),
      phrases: ["Navigate with \(.applicationName)", "Take me somewhere with \(.applicationName)"]
    )
    AppShortcut(
      intent: PortamiACasa(),
      phrases: ["Take me home with \(.applicationName)"]
    )
    AppShortcut(
      intent: PortamiAlLavoro(),
      phrases: ["Take me to work with \(.applicationName)"]
    )
    AppShortcut(
      intent: AggiungiTappa(),
      phrases: ["Add a stop with \(.applicationName)"]
    )
  }
}

enum ComandiVocali {
  /// Aspetta che l'app risponda (il motore puo' essere ancora spento), con
  /// l'app tenuta sveglia: Siri la apre in background.
  @MainActor
  @discardableResult
  static func aspetta(_ comando: (@escaping (Bool) -> Void) -> Void) async -> Bool {
    let compito = UIApplication.shared.beginBackgroundTask(withName: "gdahome.siri")
    defer { UIApplication.shared.endBackgroundTask(compito) }
    return await withCheckedContinuation { c in
      comando { c.resume(returning: $0) }
    }
  }
}
