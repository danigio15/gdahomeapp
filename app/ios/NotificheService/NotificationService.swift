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
final class NotificationService: UNNotificationServiceExtension {
  private var consegna: ((UNNotificationContent) -> Void)?
  private var originale: UNNotificationContent?

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
    contentHandler(nuova)
  }

  /// Il tempo e' finito: la frase di riserva, come prima.
  override func serviceExtensionTimeWillExpire() {
    if let consegna, let originale { consegna(originale) }
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
      return Aperta(titolo: titolo, testo: testo.isEmpty ? (voce["n"] ?? "") : testo, casa: voce["c"])
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
