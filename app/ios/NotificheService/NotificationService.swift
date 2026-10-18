import CryptoKit
import Foundation
import Security
import UserNotifications

/// L'estensione delle notifiche: apre la busta mentre la notifica arriva.
///
/// La casa chiude ogni notifica con la chiave delle notifiche di questo
/// telefono (`ponte/src/spinta.js`), e Apple consegna la frase di riserva —
/// «gdahome: nuova notifica» — con la busta accanto. Qui la busta si apre con
/// la chiave che l'app ha lasciato nel portachiavi condiviso
/// (`Runner/ChiaviDelleNotifiche.swift`), e al posto della frase si mostra il
/// titolo e il testo veri. La chiave del filo, che apre la casa, qui non c'e'.
///
/// Qualunque cosa non vada — nessuna chiave, una busta toccata, un'altra
/// versione — e la notifica resta quella di prima: mai una notifica persa.
///
/// Le notifiche «elaborate» portano anche una scheda — i numeri del ciclo,
/// della giornata, dell'UPS, dell'antifurto — o l'identificativo di una foto
/// della telecamera. La scheda si disegna qui (`LaScheda.swift`), la foto si
/// prende dal centralino e si apre con la stessa chiave (`LaFoto.swift`), e
/// tutte e due vanno nella notifica come allegato. Se non riesce, la notifica
/// arriva col suo testo e basta.
final class NotificationService: UNNotificationServiceExtension {
  private var consegna: ((UNNotificationContent) -> Void)?
  private var originale: UNNotificationContent?
  /// Quella col testo vero, gia' pronta: se il tempo finisce mentre si
  /// disegna, si consegna questa invece della frase di riserva.
  private var conIlTesto: UNNotificationContent?

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    consegna = contentHandler
    originale = request.content
    guard let nuova = request.content.mutableCopy() as? UNMutableNotificationContent,
      let aperta = Busta.apri(request.content.userInfo)
    else {
      contentHandler(request.content)
      return
    }
    nuova.title = aperta.titolo
    nuova.body = aperta.testo
    if let casa = aperta.casa { nuova.threadIdentifier = "gdahome_\(casa)" }
    /* I tasti: le stesse categorie che l'app dichiara all'avvio
     * (`_categorieDellIphone` in `lib/notifiche/postino.dart`). */
    if let categoria = Busta.categoria(per: aperta.tasti) { nuova.categoryIdentifier = categoria }
    guard aperta.scheda != nil || aperta.foto != nil else {
      contentHandler(nuova)
      return
    }
    conIlTesto = nuova.copy() as? UNNotificationContent
    let fatto: (Data?) -> Void = { [weak self] immagine in
      if let immagine, let allegato = Allegato.da(immagine) {
        nuova.attachments = [allegato]
      }
      self?.consegnaUnaVolta(nuova)
    }
    if let foto = aperta.foto, let dove = aperta.doveLeFoto, let chiave = aperta.chiave {
      /* Senza foto — scaduta, gia' presa, la rete che non risponde — resta
       * la scheda, se c'e'. */
      LaFoto.prendi(id: foto, da: dove, chiave: chiave, telefono: aperta.telefono) { foto in
        fatto(
          foto.flatMap { LaScheda.foto($0, scheda: aperta.scheda) ?? $0 }
            ?? aperta.scheda.flatMap { LaScheda.png($0) })
      }
    } else if let scheda = aperta.scheda {
      fatto(LaScheda.png(scheda))
    } else {
      fatto(nil)
    }
  }

  /* La foto arriva su un altro filo, e il tempo che finisce su un altro
   * ancora: chi arriva prima consegna, l'altro no. */
  private let chiavistello = NSLock()
  private var consegnata = false

  private func consegnaUnaVolta(_ contenuto: UNNotificationContent) {
    chiavistello.lock()
    let tocca = !consegnata
    consegnata = true
    chiavistello.unlock()
    if tocca { consegna?(contenuto) }
  }

  /// Il tempo e' finito: il testo vero se c'e', altrimenti la frase di
  /// riserva, come prima.
  override func serviceExtensionTimeWillExpire() {
    if let pronta = conIlTesto ?? originale { consegnaUnaVolta(pronta) }
  }
}

/// Un'immagine come allegato: un file nella cartella dei provvisori, che il
/// sistema si prende.
enum Allegato {
  static func da(_ immagine: Data) -> UNNotificationAttachment? {
    let jpeg = immagine.starts(with: [0xFF, 0xD8])
    let file = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathExtension(jpeg ? "jpg" : "png")
    do {
      try immagine.write(to: file)
      return try UNNotificationAttachment(identifier: "scheda", url: file, options: nil)
    } catch {
      return nil
    }
  }
}

/// La busta: un byte di versione, dodici di nonce, il cifrato e sedici di
/// marchio (AES-256-GCM), coi dati autenticati «gdahome/spinta/v1|telefono».
enum Busta {
  static let etichetta = "gdahome/spinta/v1"

  struct Aperta {
    let titolo: String
    let testo: String
    let casa: String?
    let tasti: [String]
    /// Le elaborate: i numeri da disegnare, e la foto da prendere.
    var scheda: [String: Any]? = nil
    var foto: String? = nil
    var telefono: String = ""
    var chiave: Data? = nil
    var doveLeFoto: String? = nil
  }

  /// Come `_categoriaPer` dell'app: la categoria che ha esattamente quei tasti.
  static let categorie: [String: Set<String>] = [
    "gdahome_guarda": ["guarda"],
    "gdahome_spegni": ["spegni", "piu-tardi"],
    "gdahome_inserisci": ["inserisci", "piu-tardi"],
    "gdahome_campanello": ["apri", "ignora"],
    "gdahome_chiudi": ["chiudi"],
    "gdahome_luci": ["spegni", "resta", "piu-tardi"],
    "gdahome_va_bene": ["va-bene", "piu-tardi"],
    "gdahome_chiudi_va_bene": ["chiudi", "va-bene", "piu-tardi"],
    "gdahome_scattato": ["spegni-sirena", "disinserisci", "guarda"],
    "gdahome_disinserisci": ["disinserisci", "guarda"],
    "gdahome_guarda_inserisci": ["guarda", "inserisci"],
    "gdahome_giornata": ["giornata", "ok"],
  ]

  static func categoria(per tasti: [String]) -> String? {
    let quali = Set(tasti)
    if quali.isEmpty { return nil }
    if let esatta = categorie.first(where: { $0.value == quali })?.key { return esatta }
    if quali.contains("apri") { return "gdahome_campanello" }
    if quali.contains("spegni-sirena") { return "gdahome_scattato" }
    if quali.contains("disinserisci") { return "gdahome_disinserisci" }
    if quali.contains("guarda") { return "gdahome_guarda" }
    /* Il riepilogo della sera: «Apri la giornata» e «OK» (un ponte di prima
     * mandava solo «energia»). */
    if quali.contains("giornata") || quali.contains("energia") { return "gdahome_giornata" }
    return nil
  }

  static func apri(_ dati: [AnyHashable: Any]) -> Aperta? {
    guard dati["g"] as? String == "1",
      let telefono = dati["d"] as? String,
      let busta = dati["b"] as? String,
      let tutto = Data(base64Encoded: busta),
      tutto.count >= 1 + 12 + 16,
      tutto.first == 1,
      let voce = chiavi()?[telefono],
      let esadecimale = voce["k"],
      let chiave = byte(esadecimale), chiave.count == 32
    else { return nil }
    do {
      let nonce = try AES.GCM.Nonce(data: tutto.subdata(in: 1..<13))
      let scatola = try AES.GCM.SealedBox(
        nonce: nonce,
        ciphertext: tutto.subdata(in: 13..<(tutto.count - 16)),
        tag: tutto.subdata(in: (tutto.count - 16)..<tutto.count)
      )
      let chiaro = try AES.GCM.open(
        scatola,
        using: SymmetricKey(data: chiave),
        authenticating: Data("\(etichetta)|\(telefono)".utf8)
      )
      guard let dentro = try JSONSerialization.jsonObject(with: chiaro) as? [String: Any],
        dentro["v"] as? Int == 1,
        let titolo = dentro["titolo"] as? String, !titolo.isEmpty
      else { return nil }
      let testo = (dentro["testo"] as? String) ?? ""
      let tasti = ((dentro["azioni"] as? [[String: Any]]) ?? []).compactMap { $0["id"] as? String }
      var aperta = Aperta(
        titolo: titolo,
        testo: testo.isEmpty ? (voce["n"] ?? "") : testo,
        casa: voce["c"],
        tasti: tasti
      )
      if let scheda = dentro["scheda"] as? [String: Any], scheda["v"] as? Int == 1 {
        aperta.scheda = scheda
      }
      if let foto = (dentro["foto"] as? [String: Any])?["id"] as? String,
        foto.count == 32, foto.allSatisfy({ $0.isHexDigit })
      {
        aperta.foto = foto
      }
      aperta.telefono = telefono
      aperta.chiave = chiave
      aperta.doveLeFoto = voce["u"]
      return aperta
    } catch {
      return nil
    }
  }

  /// Le chiavi lasciate dall'app: telefono → `{k, n, c}`.
  private static func chiavi() -> [String: [String: String]]? {
    let domanda: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "gdahome.notifiche",
      kSecAttrAccount as String: "chiavi",
      kSecReturnData as String: true,
    ]
    var trovato: CFTypeRef?
    guard SecItemCopyMatching(domanda as CFDictionary, &trovato) == errSecSuccess,
      let dati = trovato as? Data
    else { return nil }
    return try? JSONSerialization.jsonObject(with: dati) as? [String: [String: String]]
  }

  private static func byte(_ esadecimale: String) -> Data? {
    guard esadecimale.count % 2 == 0 else { return nil }
    var fuori = Data(capacity: esadecimale.count / 2)
    var indice = esadecimale.startIndex
    while indice < esadecimale.endIndex {
      let dopo = esadecimale.index(indice, offsetBy: 2)
      guard let b = UInt8(esadecimale[indice..<dopo], radix: 16) else { return nil }
      fuori.append(b)
      indice = dopo
    }
    return fuori
  }
}
