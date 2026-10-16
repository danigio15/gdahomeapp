import Flutter
import UIKit
import UserNotifications
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
    collegaLeChiaviDelleNotifiche()
    fuoriDalleCopie()
    /* L'Apple Watch: la fotografia al polso, e i tocchi da li'. */
    LOrologio.shared.accendi(motore: motore)
    /* Le notifiche della casa (`lib/notifiche/postino.dart`): il centro delle
     * notifiche parla con questa classe, che le gira ai plugin — quello di
     * Firebase e quello che mostra le notifiche gia' aperte, coi loro tasti. */
    UNUserNotificationCenter.current().delegate = self as? UNUserNotificationCenterDelegate
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
      } else if chiamata.method == "acceso" {
        /* Il campanello del tablet a muro (`lib/casa/lo_schermo.dart`): lo
         * schermo non si spegne da solo finche' il pannello lo chiede. */
        UIApplication.shared.isIdleTimerDisabled = (chiamata.arguments as? Bool) == true
        risposta(nil)
      } else {
        risposta(FlutterMethodNotImplemented)
      }
    }
  }

  /* Le chiavi delle notifiche per l'estensione che apre le buste
   * (`lib/notifiche/chiavi_per_l_iphone.dart`, `ios/NotificheService`). */
  private func collegaLeChiaviDelleNotifiche() {
    let canale = FlutterMethodChannel(name: "gdahome/notifiche-iphone", binaryMessenger: motore.binaryMessenger)
    canale.setMethodCallHandler { chiamata, risposta in
      /* Il tasto premuto sulla notifica del sistema (vedi sotto): si dice una
       * volta sola, a chi apre quella busta. */
      if chiamata.method == "tasto" {
        let busta = chiamata.arguments as? String ?? ""
        risposta(AppDelegate.tastoPremuto(per: busta))
        return
      }
      guard chiamata.method == "chiavi" else { return risposta(FlutterMethodNotImplemented) }
      let chiavi = chiamata.arguments as? [String: [String: String]] ?? [:]
      if ChiaviDelleNotifiche.scrivi(chiavi) {
        risposta(nil)
      } else {
        risposta(FlutterError(code: "portachiavi", message: "le chiavi non si scrivono", details: nil))
      }
    }
  }

  /* I tasti della notifica che mostra il sistema.
   *
   * «Le notifiche non comandabili: esce solo la domanda, senza si' o no.» La
   * notifica dell'iPhone la mostra il sistema (l'estensione la apre e ci mette
   * i tasti giusti, `ios/NotificheService`): toccato un tasto, l'app si apre e
   * Firebase le passa la notifica, ma non quale tasto. Qui lo si tiene da
   * parte per quella busta, e l'app lo chiede quando la apre
   * (`lib/notifiche/postino.dart`). */
  private static var tasti: [String: String] = [:]

  static func tastoPremuto(per busta: String) -> String? {
    tasti.removeValue(forKey: busta)
  }

  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let azione = response.actionIdentifier
    if azione != UNNotificationDefaultActionIdentifier,
      azione != UNNotificationDismissActionIdentifier,
      let busta = response.notification.request.content.userInfo["b"] as? String
    {
      AppDelegate.tasti[busta] = azione
    }
    super.userNotificationCenter(center, didReceive: response, withCompletionHandler: completionHandler)
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
