import Foundation
import Security

/// Le chiavi delle notifiche, nel posto del portachiavi che l'app divide con
/// l'estensione (`NotificheService`). Solo quelle: la chiave del filo, che
/// apre la casa, resta nel portachiavi dell'app.
///
/// Un elemento solo, l'elenco intero: telefono → `{k, n, c}`. Leggibile dopo
/// il primo sblocco — la notifica arriva anche col telefono in tasca — e
/// **solo su questo telefono**, niente copie di iCloud.
enum ChiaviDelleNotifiche {
  static let servizio = "gdahome.notifiche"
  static let conto = "chiavi"
  /// Il gruppo, senza il prefisso della squadra: quello lo dice il sistema.
  static let gruppo = "com.gdahome.gdahome.chiavi-notifiche"

  /// Il prefisso della squadra (`ABCDE12345.`), come lo vede il portachiavi:
  /// un elemento di prova finisce nel gruppo dell'app, che comincia con lui.
  private static func prefisso() -> String? {
    let prova: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "gdahome.prefisso",
      kSecAttrAccount as String: "prefisso",
      kSecReturnAttributes as String: true,
    ]
    var trovato: CFTypeRef?
    var esito = SecItemCopyMatching(prova as CFDictionary, &trovato)
    if esito == errSecItemNotFound {
      var nuovo = prova
      nuovo[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
      esito = SecItemAdd(nuovo as CFDictionary, &trovato)
    }
    guard esito == errSecSuccess,
      let attributi = trovato as? [String: Any],
      let gruppoDellApp = attributi[kSecAttrAccessGroup as String] as? String,
      let punto = gruppoDellApp.firstIndex(of: ".")
    else { return nil }
    return String(gruppoDellApp[...punto])
  }

  /// Riscrive l'elenco. Vuoto, lo toglie.
  static func scrivi(_ chiavi: [String: [String: String]]) -> Bool {
    guard let prefisso = prefisso() else { return false }
    let dove: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: servizio,
      kSecAttrAccount as String: conto,
      kSecAttrAccessGroup as String: prefisso + gruppo,
    ]
    SecItemDelete(dove as CFDictionary)
    if chiavi.isEmpty { return true }
    guard let dati = try? JSONSerialization.data(withJSONObject: chiavi) else { return false }
    var nuovo = dove
    nuovo[kSecValueData as String] = dati
    nuovo[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    return SecItemAdd(nuovo as CFDictionary, nil) == errSecSuccess
  }
}
