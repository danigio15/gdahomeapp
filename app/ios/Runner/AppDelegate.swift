import Flutter
import UIKit
import gdanav_app

/// Un motore Flutter solo, acceso all'avvio: lo usano la schermata del
/// telefono e CarPlay, che puo' aprire l'app senza il telefono in mano. E' lo
/// stesso che fa `IlNavigatoreInAuto.kt` per Android Auto: un navigatore, un
/// GPS, una voce.
@main
@objc class AppDelegate: FlutterAppDelegate {
  lazy var motore = FlutterEngine(name: "gdahome")

  /* Il filo col Dart del navigatore (`lib/schermate/navigatore_qui`): «come
   * sta?» da li', «accendi» da qui quando si sale in macchina. */
  private var navigatore: FlutterMethodChannel?

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    motore.run()
    GeneratedPluginRegistrant.register(with: motore)
    collegaIlNavigatore()
    collegaLaFinestra()
    fuoriDalleCopie()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  /* Con il lucchetto acceso la finestra e' «riservata» (`lib/casa/la_finestra.dart`):
   * su Android il sistema non la fotografa. Sull'iPhone l'istantanea delle
   * app recenti la fa il sistema quando l'app se ne va, e la copre la scena
   * (`SceneDelegate`) con un velo nativo, che arriva sempre in tempo. */
  private func collegaLaFinestra() {
    let canale = FlutterMethodChannel(name: "gdahome/finestra", binaryMessenger: motore.binaryMessenger)
    canale.setMethodCallHandler { chiamata, risposta in
      if chiamata.method == "riservata" {
        SceneDelegate.riservata = (chiamata.arguments as? Bool) == true
        risposta(nil)
      } else {
        risposta(FlutterMethodNotImplemented)
      }
    }
  }

  /* Come `allowBackup=false` su Android: i file dell'app (la dispensa, la
   * fotografia per l'auto) non vanno nelle copie di iCloud. I segreti stanno
   * nel portachiavi, e restano su questo telefono gia' da soli. */
  private func fuoriDalleCopie() {
    guard var cartella = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
    else { return }
    try? FileManager.default.createDirectory(at: cartella, withIntermediateDirectories: true)
    var valori = URLResourceValues()
    valori.isExcludedFromBackup = true
    try? cartella.setResourceValues(valori)
  }

  private func collegaIlNavigatore() {
    let canale = FlutterMethodChannel(name: "gdahome/navigatore", binaryMessenger: motore.binaryMessenger)
    canale.setMethodCallHandler { chiamata, risposta in
      switch chiamata.method {
      case "comeSta":
        risposta(["inAuto": GdanavCarPlay.collegato])
      default:
        risposta(FlutterMethodNotImplemented)
      }
    }
    navigatore = canale
    /* Il tasto con la casa sulla mappa, e «Quasi a casa». */
    LaCasaInCarPlay.accendi(motore: motore)
    GdanavCarPlay.alCollegamento = { [weak self] salito in
      if salito { self?.navigatore?.invokeMethod("accendi", arguments: nil) }
      LaCasaInCarPlay.inAuto(salito)
    }
  }
}
