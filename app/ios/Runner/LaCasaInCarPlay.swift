/* La casa su CarPlay: il tasto con la casetta sulla mappa del navigatore, e
 * «Quasi a casa» arrivando.
 *
 * E' la copia per iPhone di quello che su Android fanno `IComandiInAuto.kt`,
 * `LaCasaInAuto.kt`, `LeAzioniInAuto.kt`, `ComeStaLaCasa.kt` e `ArrivoACasa`
 * (in `IlNavigatoreInAuto.kt`). I file sono gli stessi — li scrive il Dart in
 * `lib/auto/sul_telefono.dart`, nella cartella privata dell'app — e i nomi
 * dei campi pure.
 *
 * ── Chi esegue il comando ───────────────────────────────────────────────
 *
 * Come su Android, qui con la casa non si parla: si lascia scritto il
 * comando (`gdahome-auto-comando.json`) e si da' un colpetto al Dart sul
 * canale `gdahome/auto/guarda`. Su Android il colpetto va a un motore senza
 * schermo acceso apposta; qui il motore e' uno solo ed e' gia' acceso, e lo
 * sente `main.dart`.
 */
import CarPlay
import CoreLocation
import Flutter
import UIKit
import gdanav_app

enum LaCasaInCarPlay {
  private static var guarda: FlutterMethodChannel?
  private static var arrivo: Timer?
  private static var lontano = false

  /// Si aggancia al motore dell'app e mette il tasto con la casa sulla mappa.
  static func accendi(motore: FlutterEngine) {
    guarda = FlutterMethodChannel(name: "gdahome/auto/guarda", binaryMessenger: motore.binaryMessenger)
    GdanavCarPlay.casa = { comandi($0) }
  }

  /// Saliti o scesi dalla macchina: «Quasi a casa» si guarda solo in auto.
  static func inAuto(_ salito: Bool) {
    arrivo?.invalidate()
    arrivo = nil
    lontano = false
    guard salito else { return }
    arrivo = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { _ in controllaLArrivo() }
  }

  // MARK: - I file scritti dal telefono

  private static var cartella: URL? {
    FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
  }

  private static func leggi(_ nome: String) -> [String: Any]? {
    guard let url = cartella?.appendingPathComponent(nome),
      let dati = try? Data(contentsOf: url)
    else { return nil }
    return (try? JSONSerialization.jsonObject(with: dati)) as? [String: Any]
  }

  private static func testo(_ v: Any?) -> String {
    (v as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
  }

  struct Comando {
    let id: String
    let nome: String
    let genere: String
    let conferma: Bool
  }

  /// I comandi rapidi scelti sul telefono, quello dell'arrivo e a quanti metri.
  static func iComandi() -> (comandi: [Comando], arrivo: Comando?, metri: Double) {
    guard let json = leggi("gdahome-auto-comandi.json") else { return ([], nil, 500) }
    let comandi = (json["comandi"] as? [[String: Any]] ?? []).compactMap { uno -> Comando? in
      let id = testo(uno["id"])
      let nome = testo(uno["nome"])
      guard !id.isEmpty, !nome.isEmpty else { return nil }
      return Comando(id: id, nome: nome, genere: testo(uno["genere"]), conferma: (uno["conferma"] as? Bool) == true)
    }
    let quale = testo(json["arrivo"])
    let metri = min(max((json["metri"] as? NSNumber)?.doubleValue ?? 500, 50), 5000)
    return (Array(comandi.prefix(12)), comandi.first { $0.id == quale }, metri)
  }

  /// La fotografia della casa scritta dalla plancia: dispositivi, azioni,
  /// fotovoltaico, persone.
  private static func laFoto() -> [String: Any]? { leggi("gdahome-auto.json") }

  // MARK: - Premere

  /// Lascia scritto il comando, sveglia il Dart, e dice cosa aspettarsi.
  static func premi(_ id: String, _ nome: String, subito: Bool) {
    var scritto = false
    if let cartella {
      try? FileManager.default.createDirectory(at: cartella, withIntermediateDirectories: true)
      let json: [String: Any] = ["azione": id, "quando": Int64(Date().timeIntervalSince1970 * 1000)]
      if let dati = try? JSONSerialization.data(withJSONObject: json) {
        scritto = (try? dati.write(to: cartella.appendingPathComponent("gdahome-auto-comando.json"), options: .atomic)) != nil
      }
    }
    if scritto { guarda?.invokeMethod("guarda", arguments: nil) }
    GdanavCarPlay.mostra(
      !scritto
        ? "\(nome): non sono riuscito a scriverlo"
        : subito ? "\(nome): fatto" : "\(nome): parte appena apri gdahome sul telefono, entro due minuti"
    )
  }

  /// Una serratura chiede prima conferma: un tocco sbagliato guidando non
  /// deve aprire la porta di casa.
  private static func premiIlComando(_ c: Comando, _ controllore: CPInterfaceController?) {
    guard c.conferma, let controllore else { return premi(c.id, c.nome, subito: true) }
    let conferma = CPAlertTemplate(
      titleVariants: ["\(c.nome): lo faccio?"],
      actions: [
        CPAlertAction(title: "Sì", style: .default) { [weak controllore] _ in
          controllore?.dismissTemplate(animated: true) { _, _ in premi(c.id, c.nome, subito: true) }
        },
        CPAlertAction(title: "No", style: .cancel) { [weak controllore] _ in
          controllore?.dismissTemplate(animated: true, completion: nil)
        },
      ]
    )
    controllore.presentTemplate(conferma, animated: true, completion: nil)
  }

  // MARK: - Gli schermi

  /// Il disegno di un comando, per genere.
  static func segno(_ genere: String) -> UIImage {
    let nome: String
    switch genere {
    case "varco": nome = "door.garage.closed"
    case "porta": nome = "door.left.hand.closed"
    case "luce": nome = "lightbulb.fill"
    case "presa": nome = "powerplug.fill"
    default: nome = "bolt.fill"
    }
    let conf = UIImage.SymbolConfiguration(pointSize: 30, weight: .semibold)
    return UIImage(systemName: nome, withConfiguration: conf)
      ?? UIImage(systemName: "bolt.fill", withConfiguration: conf)
      ?? UIImage()
  }

  /// I comandi rapidi: quelli dietro il tasto con la casa.
  static func comandi(_ controllore: CPInterfaceController) -> CPTemplate {
    let scelti = iComandi().comandi
    if scelti.isEmpty {
      /* Un elenco vuoto e non `CPInformationTemplate`: un'app di navigazione
       * (carplay-maps) non lo puo' usare, e CarPlay la chiuderebbe. */
      let t = CPListTemplate(title: "Comandi rapidi", sections: [])
      t.emptyViewTitleVariants = ["Nessun comando scelto. Sul telefono: gdanav, menu, Comandi rapidi in auto."]
      t.trailingNavigationBarButtons = [
        CPBarButton(title: "Dispositivi") { [weak controllore] _ in
          guard let controllore else { return }
          controllore.pushTemplate(dispositivi(controllore), animated: true, completion: nil)
        }
      ]
      return t
    }
    let tasti = scelti.prefix(8).map { c in
      CPGridButton(titleVariants: [c.nome], image: segno(c.genere)) { [weak controllore] _ in
        premiIlComando(c, controllore)
      }
    }
    let griglia = CPGridTemplate(title: "Comandi rapidi", gridButtons: Array(tasti))
    /* I dispositivi e com'e' la casa restano a un tocco: sono gli schermi di
     * gdahome in auto di sempre. */
    griglia.trailingNavigationBarButtons = [
      CPBarButton(title: "Dispositivi") { [weak controllore] _ in
        guard let controllore else { return }
        controllore.pushTemplate(dispositivi(controllore), animated: true, completion: nil)
      }
    ]
    return griglia
  }

  /// I dispositivi di casa, e un tocco per girarli.
  static func dispositivi(_ controllore: CPInterfaceController) -> CPTemplate {
    let foto = laFoto()
    let elenco = (foto?["dispositivi"] as? [[String: Any]] ?? []).compactMap { uno -> (String, String, String, String)? in
      let id = testo(uno["id"])
      let nome = testo(uno["nome"])
      guard !id.isEmpty, !nome.isEmpty else { return nil }
      return (id, nome, testo(uno["genere"]).lowercased(), testo(uno["stato"]))
    }.prefix(6)
    let titolo = testo(foto?["casa"]).isEmpty ? "Dispositivi" : testo(foto?["casa"])
    let barra = [
      CPBarButton(title: "Azioni") { [weak controllore] _ in
        guard let controllore else { return }
        controllore.pushTemplate(azioni(), animated: true, completion: nil)
      },
      CPBarButton(title: "Casa") { [weak controllore] _ in
        guard let controllore else { return }
        controllore.pushTemplate(comeStaLaCasa(), animated: true, completion: nil)
      },
    ]
    if elenco.isEmpty {
      let t = CPListTemplate(title: titolo, sections: [])
      t.emptyViewTitleVariants = [
        foto == nil
          ? "gdahome non ha ancora mandato niente all'auto. Apri l'app sul telefono una volta: da lì in poi la trovi qui."
          : "Nessun dispositivo da comandare. Apri gdahome sul telefono e configura varchi, luci o prese: da lì in poi li trovi qui."
      ]
      t.trailingNavigationBarButtons = barra
      return t
    }
    /* Com'e' messo adesso, sotto il nome: e' meta' di quello per cui questa
     * schermata esiste. */
    let tasti = elenco.map { voce -> CPGridButton in
      let (id, nome, genere, stato) = voce
      return CPGridButton(titleVariants: stato.isEmpty ? [nome] : ["\(nome) · \(stato)", nome], image: segno(genere)) { _ in
        premi(id, nome, subito: true)
      }
    }
    let griglia = CPGridTemplate(title: titolo, gridButtons: Array(tasti))
    griglia.trailingNavigationBarButtons = barra
    return griglia
  }

  /// Le azioni rapide della plancia: sei, e non una di piu'.
  static func azioni() -> CPTemplate {
    let elenco = (laFoto()?["azioni"] as? [[String: Any]] ?? []).compactMap { uno -> (String, String, Bool)? in
      let id = testo(uno["id"])
      let nome = testo(uno["nome"])
      guard !id.isEmpty, !nome.isEmpty else { return nil }
      return (id, nome, (uno["subito"] as? Bool) == true)
    }.prefix(6)
    if elenco.isEmpty {
      let t = CPListTemplate(title: "Azioni rapide", sections: [])
      t.emptyViewTitleVariants = ["Nessuna azione rapida configurata nella plancia"]
      return t
    }
    let tasti = elenco.map { voce -> CPGridButton in
      let (id, nome, subito) = voce
      return CPGridButton(titleVariants: [nome], image: segno("")) { _ in premi(id, nome, subito: subito) }
    }
    return CPGridTemplate(title: "Azioni rapide", gridButtons: Array(tasti))
  }

  /// Com'e' la casa: di quando e' la fotografia, il sole, chi c'e'.
  static func comeStaLaCasa() -> CPTemplate {
    var righe: [CPListItem] = []
    if let foto = laFoto() {
      righe.append(CPListItem(text: quando(foto), detailText: nil))
      for m in foto["fotovoltaico"] as? [[String: Any]] ?? [] {
        let nome = testo(m["nome"])
        let valore = testo(m["valore"])
        if !nome.isEmpty && !valore.isEmpty { righe.append(CPListItem(text: valore, detailText: nome)) }
      }
      for p in foto["persone"] as? [[String: Any]] ?? [] {
        let nome = testo(p["nome"])
        if !nome.isEmpty {
          righe.append(CPListItem(text: nome, detailText: (p["inCasa"] as? Bool) == true ? "In casa" : "Fuori"))
        }
      }
    }
    let t = CPListTemplate(title: "Come sta la casa", sections: [CPListSection(items: Array(righe.prefix(6)))])
    t.emptyViewTitleVariants = [
      laFoto() == nil
        ? "gdahome non ha ancora mandato niente all'auto. Apri l'app sul telefono una volta: da lì in poi la trovi qui."
        : "Non c'è ancora niente da dire su questa casa"
    ]
    return t
  }

  private static func quando(_ foto: [String: Any]) -> String {
    let allora = (foto["quando"] as? NSNumber)?.doubleValue ?? 0
    let adesso = Date().timeIntervalSince1970 * 1000
    if allora > 0 && adesso - allora <= 30 * 60 * 1000 { return "Aggiornato adesso" }
    if allora <= 0 { return "Non si sa di quando è" }
    let minuti = Int((adesso - allora) / 60000)
    return minuti >= 60 ? "Di \(minuti / 60) ore fa" : "Di \(minuti) minuti fa"
  }

  // MARK: - Quasi a casa

  /* A qualche centinaio di metri da Casa — quanti lo si sceglie sul
   * telefono, 500 se non si e' scelto — si propone il comando scelto per
   * l'arrivo. Solo **arrivando**: dopo essere stati piu' lontani (almeno un
   * chilometro, o il doppio della distanza scelta), e una volta per arrivo. */
  private static func controllaLArrivo() {
    guard let qui = GdanavCarPlay.posizione, let casa = GdanavCarPlay.casaSalvata else { return }
    let distanza = CLLocation(latitude: qui.latitude, longitude: qui.longitude)
      .distance(from: CLLocation(latitude: casa.latitude, longitude: casa.longitude))
    let scelti = iComandi()
    if distanza > max(1000, scelti.metri * 2) {
      lontano = true
      return
    }
    guard lontano, distanza <= scelti.metri else { return }
    lontano = false
    guard let comando = scelti.arrivo else { return }
    GdanavCarPlay.proponi(
      "Quasi a casa",
      sotto: comando.nome,
      immagine: segno(comando.genere),
      si: "Fallo",
      no: "Non ora"
    ) {
      premi(comando.id, comando.nome, subito: true)
    }
  }
}
