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
      } else if chiamata.method == "luminosita" {
        /* La luminosita' del pannello a muro (#224, `lib/casa/lo_schermo.dart`):
         * da 0 a 1, e -1 rimette quella che c'era prima del pannello. */
        let valore = (chiamata.arguments as? NSNumber)?.doubleValue ?? -1
        LaLuceDelMuro.shared.metti(valore < 0 ? nil : CGFloat(min(max(valore, 0), 1)))
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
    canaleDelleNotifiche = canale
    canale.setMethodCallHandler { chiamata, risposta in
      /* L'ultima notifica toccata (vedi sotto): si dice una volta sola. */
      if chiamata.method == "toccata" {
        let tocco = AppDelegate.toccata
        AppDelegate.toccata = nil
        risposta(tocco)
        return
      }
      /* Il tasto premuto sulla notifica del sistema (vedi sotto): si dice una
       * volta sola, a chi apre quella busta. */
      if chiamata.method == "tasto" {
        let busta = chiamata.arguments as? String ?? ""
        risposta(AppDelegate.tastoPremuto(per: busta))
        return
      }
      /* L'immagine della notifica toccata (vedi sotto), per la sua pagina. */
      if chiamata.method == "immagine" {
        let busta = chiamata.arguments as? String ?? ""
        risposta(AppDelegate.immagine(per: busta).map { FlutterStandardTypedData(bytes: $0) })
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

  /* La notifica toccata, per l'app che parte da chiusa.
   *
   * «Faccio guarda e mi apre la home di GdA.» Con le scene, l'app aperta da
   * una notifica partendo da chiusa non riceve da Firebase la notifica
   * toccata (`getInitialMessage` resta vuoto): si apriva la Home, e il
   * video non arrivava mai. Ad app gia' aperta in sottofondo andava: per
   * questo «va e non va». Qui la si tiene da parte — solo quello che serve
   * ad aprirla, la busta resta chiusa — e la si dice all'app appena c'e'
   * (`lib/notifiche/postino.dart`), che non la apre due volte. */
  private static var toccata: [String: String]?
  private var canaleDelleNotifiche: FlutterMethodChannel?

  static func tastoPremuto(per busta: String) -> String? {
    tasti.removeValue(forKey: busta)
  }

  /* L'immagine della notifica toccata.
   *
   * «Quando si clicca sulla notifica venga aperta l'app con la stessa
   * notifica.» La foto della telecamera la prende l'estensione, e il
   * centralino la da' una volta sola: l'app non la puo' richiedere. Ma il
   * sistema, toccata la notifica, passa all'app la notifica coi suoi
   * allegati, e un allegato si puo' leggere. Lo si tiene qui per quella busta
   * (al piu' quattro, al piu' quattro mega), e l'app lo chiede quando la apre
   * (`lib/notifiche/chiavi_per_l_iphone.dart`). */
  private static var immagini: [String: Data] = [:]

  static func immagine(per busta: String) -> Data? {
    immagini.removeValue(forKey: busta)
  }

  private static func tieniLImmagine(di contenuto: UNNotificationContent, busta: String) {
    guard let allegato = contenuto.attachments.first else { return }
    let file = allegato.url
    let aperto = file.startAccessingSecurityScopedResource()
    defer { if aperto { file.stopAccessingSecurityScopedResource() } }
    guard let dati = try? Data(contentsOf: file), !dati.isEmpty, dati.count <= 4_000_000 else { return }
    if immagini.count >= 4 { immagini.removeAll() }
    immagini[busta] = dati
  }

  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let azione = response.actionIdentifier
    let contenuto = response.notification.request.content
    if azione != UNNotificationDismissActionIdentifier,
      let busta = contenuto.userInfo["b"] as? String
    {
      AppDelegate.tieniLImmagine(di: contenuto, busta: busta)
    }
    if azione != UNNotificationDefaultActionIdentifier,
      azione != UNNotificationDismissActionIdentifier,
      let busta = response.notification.request.content.userInfo["b"] as? String
    {
      AppDelegate.tasti[busta] = azione
    }
    let dati = contenuto.userInfo
    if azione != UNNotificationDismissActionIdentifier,
      let g = dati["g"] as? String, let d = dati["d"] as? String, let b = dati["b"] as? String
    {
      let tocco = ["g": g, "d": d, "b": b]
      AppDelegate.toccata = tocco
      canaleDelleNotifiche?.invokeMethod("toccata", arguments: tocco)
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

/// La luminosita' del tablet a muro sull'iPad (#224).
///
/// Su Android il pannello cambia la luce della sola finestra, e uscendo
/// dall'app torna quella di prima da sola. Sul tablet di Apple non c'e' una
/// luce della finestra: c'e' quella dello schermo, che resta come l'ha
/// lasciata l'app anche dopo. Quindi si ricorda quella di prima, la prima
/// volta che il pannello la cambia, e la si rimette quando il pannello la
/// rende (`-1`) o quando l'app va dietro; tornando davanti si rimette quella
/// del pannello.
final class LaLuceDelMuro {
  static let shared = LaLuceDelMuro()

  /// Quella di prima del pannello: `nil` finche' il pannello non la tocca.
  private var diPrima: CGFloat?
  /// Quella che il pannello vuole: `nil` se lo schermo e' del sistema.
  private var voluta: CGFloat?

  private init() {
    let centro = NotificationCenter.default
    centro.addObserver(
      forName: UIApplication.willResignActiveNotification, object: nil, queue: .main
    ) { [weak self] _ in self?.rendi() }
    centro.addObserver(
      forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main
    ) { [weak self] _ in
      guard let self, let voluta = self.voluta else { return }
      self.applica(voluta)
    }
  }

  /// La luce che il pannello chiede, o `nil` per rendere quella di prima.
  func metti(_ valore: CGFloat?) {
    voluta = valore
    if let valore {
      applica(valore)
    } else {
      rendi()
    }
  }

  private func applica(_ valore: CGFloat) {
    if diPrima == nil { diPrima = UIScreen.main.brightness }
    UIScreen.main.brightness = valore
  }

  private func rendi() {
    guard let prima = diPrima else { return }
    UIScreen.main.brightness = prima
    diPrima = nil
  }
}
