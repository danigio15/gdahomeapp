import CryptoKit
import Foundation

/// L'istantanea della telecamera, per le notifiche elaborate.
///
/// La casa la chiude con la stessa chiave delle notifiche di questo telefono
/// e la lascia al centralino per dieci minuti, una lettura sola. Qui la si
/// prende (`u` + l'identificativo, l'indirizzo che l'app ha lasciato nel
/// portachiavi) e la si apre: un byte di versione, dodici di nonce, il
/// cifrato e sedici di marchio, coi dati autenticati
/// «gdahome/foto/v1|telefono». Come `lib/notifiche/foto_di_passaggio.dart`.
///
/// Qualunque cosa non vada, `nil`: la notifica arriva senza foto.
enum LaFoto {
  static let etichetta = "gdahome/foto/v1"
  static let massima = 300 * 1024

  static func prendi(
    id: String,
    da dove: String,
    chiave: Data,
    telefono: String,
    fatto: @escaping (Data?) -> Void
  ) {
    guard let indirizzo = URL(string: dove + id),
      indirizzo.scheme == "https" || indirizzo.scheme == "http"
    else {
      fatto(nil)
      return
    }
    var domanda = URLRequest(url: indirizzo)
    domanda.timeoutInterval = 8
    domanda.cachePolicy = .reloadIgnoringLocalCacheData
    let compito = URLSession.shared.dataTask(with: domanda) { dati, risposta, _ in
      guard let dati, (risposta as? HTTPURLResponse)?.statusCode == 200 else {
        fatto(nil)
        return
      }
      fatto(apri(dati, chiave: chiave, telefono: telefono))
    }
    compito.resume()
  }

  static func apri(_ busta: Data, chiave: Data, telefono: String) -> Data? {
    let tutto = Data(busta)
    guard tutto.count >= 1 + 12 + 16, tutto.count <= massima, tutto.first == 1 else { return nil }
    do {
      let scatola = try AES.GCM.SealedBox(
        nonce: try AES.GCM.Nonce(data: tutto.subdata(in: 1..<13)),
        ciphertext: tutto.subdata(in: 13..<(tutto.count - 16)),
        tag: tutto.subdata(in: (tutto.count - 16)..<tutto.count)
      )
      return try AES.GCM.open(
        scatola,
        using: SymmetricKey(data: chiave),
        authenticating: Data("\(etichetta)|\(telefono)".utf8)
      )
    } catch {
      return nil
    }
  }
}
