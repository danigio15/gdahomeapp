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
    super.sceneDidDisconnect(scene)
    if let app = UIApplication.shared.delegate as? AppDelegate {
      _ = unregisterSceneLifeCycle(with: app.motore)
    }
    // Il motore resta acceso per CarPlay: si lascia solo la finestra.
    window?.rootViewController = nil
    window = nil
  }
}
