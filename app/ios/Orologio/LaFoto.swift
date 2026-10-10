/* La fotografia che il telefono porta al polso.
 *
 * La scrive `ios/Runner/LOrologio.swift` (e su Wear OS
 * `IlTramiteDellOrologio.kt`), e il formato e' in `docs/OROLOGIO.md`. Si
 * legge campo per campo, e tutto quello che non torna vale «non c'e'»:
 * al polso un'eccezione e' uno schermo nero.
 */
import Foundation

struct Comando: Identifiable, Hashable {
  let id: String
  let nome: String
  let disegno: String
  /// Una serratura chiede «lo faccio?» prima di partire.
  let conferma: Bool
}

struct Dispositivo: Identifiable, Hashable {
  let id: String
  let nome: String
  let genere: String
  let stato: String
  let acceso: Bool
}

struct Azione: Identifiable, Hashable {
  let id: String
  let nome: String
  /// Se parte da sola anche con l'app chiusa: se no aspetta che la si apra.
  let subito: Bool
}

struct Persona: Hashable {
  let nome: String
  let inCasa: Bool
}

struct Misura: Hashable {
  let nome: String
  let valore: String
}

/// La guida di gdanav, se si sta guidando.
struct Guida {
  var attiva = false
  var tipo = 0
  var distanza = 0.0
  var istruzione = ""
  var strada = ""
  var restanti = 0.0
  var secondi = 0.0
  var arrivo: Date?
  var destinazione = ""
  var messaggio = ""
  var haCasa = false
  var haLavoro = false
  var velocita: Double?
  var limite: Int?
}

struct LaFoto {
  var premium = false
  var casa = ""
  var quando: Date?
  var comandi: [Comando] = []
  var dispositivi: [Dispositivo] = []
  var azioni: [Azione] = []
  var persone: [Persona] = []
  var misure: [Misura] = []
  var guida = Guida()

  static func leggi(_ testo: String?) -> LaFoto? {
    guard let testo, testo.count <= 256 * 1024,
      let dati = testo.data(using: .utf8),
      let json = (try? JSONSerialization.jsonObject(with: dati)) as? [String: Any]
    else { return nil }
    var foto = LaFoto()
    foto.premium = (json["premium"] as? Bool) == true
    foto.casa = parola(json["casa"])
    if let ms = numero(json["quando"]), ms > 0 { foto.quando = Date(timeIntervalSince1970: ms / 1000) }
    foto.comandi = elenco(json["comandi"]).compactMap { r in
      let id = parola(r["id"])
      let nome = parola(r["nome"])
      guard !id.isEmpty, !nome.isEmpty else { return nil }
      return Comando(id: id, nome: nome, disegno: parola(r["disegno"]), conferma: (r["conferma"] as? Bool) == true)
    }
    foto.dispositivi = elenco(json["dispositivi"]).compactMap { r in
      let id = parola(r["id"])
      let nome = parola(r["nome"])
      guard !id.isEmpty, !nome.isEmpty else { return nil }
      return Dispositivo(
        id: id, nome: nome, genere: parola(r["genere"]).lowercased(), stato: parola(r["stato"]),
        acceso: (r["acceso"] as? Bool) == true)
    }
    foto.azioni = elenco(json["azioni"]).compactMap { r in
      let id = parola(r["id"])
      let nome = parola(r["nome"])
      guard !id.isEmpty, !nome.isEmpty else { return nil }
      return Azione(id: id, nome: nome, subito: (r["subito"] as? Bool) == true)
    }
    foto.persone = elenco(json["persone"]).compactMap { r in
      let nome = parola(r["nome"])
      return nome.isEmpty ? nil : Persona(nome: nome, inCasa: (r["inCasa"] as? Bool) == true)
    }
    foto.misure = elenco(json["misure"]).compactMap { r in
      let nome = parola(r["nome"])
      let valore = parola(r["valore"])
      return nome.isEmpty || valore.isEmpty ? nil : Misura(nome: nome, valore: valore)
    }
    if let n = json["nav"] as? [String: Any] {
      var g = Guida()
      g.attiva = (n["attiva"] as? Bool) == true
      g.tipo = Int(numero(n["tipo"]) ?? 0)
      g.distanza = numero(n["distanza"]) ?? 0
      g.istruzione = parola(n["istruzione"])
      g.strada = parola(n["strada"])
      g.restanti = numero(n["restanti"]) ?? 0
      g.secondi = numero(n["secondi"]) ?? 0
      if let ms = numero(n["arrivo"]), ms > 0 { g.arrivo = Date(timeIntervalSince1970: ms / 1000) }
      g.destinazione = parola(n["destinazione"])
      g.messaggio = parola(n["messaggio"])
      g.haCasa = (n["casa"] as? Bool) == true
      g.haLavoro = (n["lavoro"] as? Bool) == true
      g.velocita = numero(n["velocita"])
      g.limite = numero(n["limite"]).map { Int($0) }
      foto.guida = g
    }
    return foto
  }
}

private func parola(_ v: Any?) -> String {
  (v as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
}

private func numero(_ v: Any?) -> Double? {
  guard let n = v as? NSNumber else { return nil }
  let d = n.doubleValue
  return d.isFinite ? d : nil
}

private func elenco(_ v: Any?) -> [[String: Any]] {
  Array((v as? [[String: Any]] ?? []).prefix(12))
}

// MARK: - I disegni

/// Il disegno di un comando o di un dispositivo, come `segno` in
/// `LaCasaInCarPlay.swift`.
func simbolo(genere: String) -> String {
  switch genere {
  case "varco": return "door.garage.closed"
  case "porta": return "door.left.hand.closed"
  case "luce": return "lightbulb.fill"
  case "presa": return "powerplug.fill"
  case "scena": return "sparkles"
  case "serratura": return "lock.fill"
  default: return "bolt.fill"
  }
}

/// La freccia della manovra, dal tipo di Valhalla: la stessa tabella di
/// `ManovreCarPlay.simbolo` in gdanav.
func simbolo(manovra: Int) -> String {
  switch manovra {
  case 4, 5, 6: return "flag.checkered"
  case 9: return "arrow.up.right"
  case 2, 10: return "arrow.turn.up.right"
  case 11: return "arrow.turn.down.right"
  case 12, 13: return "arrow.uturn.left"
  case 14: return "arrow.turn.down.left"
  case 3, 15: return "arrow.turn.up.left"
  case 16: return "arrow.up.left"
  case 18, 20: return "arrow.up.right"
  case 19, 21: return "arrow.up.left"
  case 23, 24: return "arrow.triangle.branch"
  case 25, 37, 38: return "arrow.triangle.merge"
  case 26, 27: return "arrow.triangle.2.circlepath"
  case 28, 29: return "ferry"
  default: return "arrow.up"
  }
}

/// «350 m», «1,2 km», «24 km».
func metri(_ m: Double) -> String {
  if m < 1000 { return "\(Int((m / 10).rounded()) * 10) m" }
  let km = m / 1000
  if km >= 10 { return "\(Int(km.rounded())) km" }
  return String(format: "%.1f km", km).replacingOccurrences(of: ".", with: ",")
}
