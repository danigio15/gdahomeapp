import Flutter
import UIKit

/// La schermata del telefono: il motore di `AppDelegate`, gia' acceso (magari
/// da CarPlay), dentro la finestra.
class SceneDelegate: FlutterSceneDelegate {
  /// Col lucchetto acceso: l'istantanea delle app recenti non mostra la casa.
  static var riservata = false
  private var velo: UIView?
  override func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
      let app = UIApplication.shared.delegate as? AppDelegate
    else { return }
    window = UIWindow(windowScene: windowScene)
    _ = registerSceneLifeCycle(with: app.motore)
    window?.rootViewController = FlutterViewController(engine: app.motore, nibName: nil, bundle: nil)
    window?.makeKeyAndVisible()
    super.scene(scene, willConnectTo: session, options: connectionOptions)
  }

  override func sceneWillResignActive(_ scene: UIScene) {
    super.sceneWillResignActive(scene)
    guard SceneDelegate.riservata, velo == nil, let finestra = window else { return }
    let v = UIView(frame: finestra.bounds)
    v.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    v.backgroundColor = .systemBackground
    finestra.addSubview(v)
    velo = v
  }

  override func sceneDidBecomeActive(_ scene: UIScene) {
    super.sceneDidBecomeActive(scene)
    velo?.removeFromSuperview()
    velo = nil
  }

  override func sceneDidDisconnect(_ scene: UIScene) {
    // Il motore resta acceso (CarPlay, l'orologio, la finestra che si riapre
    // sul Mac): si lascia solo la finestra, e PRIMA di avvisare i plugin.
    //
    // Il crash su Mac (SIGABRT in `swift_unownedRetainStrong`, dentro
    // `didPostMessage` di WebKit): `FlutterSceneDelegate` passa la chiusura
    // della scena ai plugin dei motori che ci stanno dentro, e quello delle
    // WebView a quel punto smonta il suo registro. Le pagine (la plancia, la
    // mappa 3D) restavano vive col motore, e al primo messaggio dalla pagina
    // il gestore cercava un registro che non c'era piu'. Staccati il motore
    // e la sua vista dalla scena, la chiusura non arriva piu' a lui.
    if let app = UIApplication.shared.delegate as? AppDelegate {
      _ = unregisterSceneLifeCycle(with: app.motore)
    }
    window?.rootViewController = nil
    window = nil
    super.sceneDidDisconnect(scene)
  }
}
