/* La vetrina: una casa d'esempio, per le schermate dei negozi.
 *
 * Le schermate di App Store si fanno sul simulatore, dove non c'e' nessun
 * iPhone a portare la fotografia. Avviata con `-vetrina <schermata>`
 * (`xcrun simctl launch … -vetrina casa`, vedi `.github/workflows/vetrina.yml`)
 * l'app non accende il filo col telefono e mostra questa casa. Un argomento
 * d'avvio si passa solo da Xcode o dal simulatore: chi ha l'orologio al polso
 * non ci arriva.
 */
import Foundation

enum Vetrina {
  /// La schermata chiesta, o `nil` fuori dalla vetrina.
  static var schermata: String? {
    let v = UserDefaults.standard.string(forKey: "vetrina") ?? ""
    return v.isEmpty ? nil : v
  }

  static let foto = """
    {"v":1,"premium":true,"casa":"Casa al mare","quando":0,
     "comandi":[
      {"id":"c1","nome":"Cancello","disegno":"varco","conferma":false},
      {"id":"c2","nome":"Portone","disegno":"serratura","conferma":true},
      {"id":"c3","nome":"Luci giardino","disegno":"luce","conferma":false},
      {"id":"c4","nome":"Arrivo a casa","disegno":"scena","conferma":false}],
     "dispositivi":[
      {"id":"d1","nome":"Salone","genere":"luce","stato":"Accesa","acceso":true},
      {"id":"d2","nome":"Garage","genere":"varco","stato":"Aperto","acceso":true},
      {"id":"d3","nome":"Lavatrice","genere":"presa","stato":"Spenta","acceso":false},
      {"id":"d4","nome":"Cucina","genere":"luce","stato":"Spenta","acceso":false}],
     "azioni":[
      {"id":"a1","nome":"Buonanotte","subito":true},
      {"id":"a2","nome":"Esco di casa","subito":true},
      {"id":"a3","nome":"Irrigazione","subito":false}],
     "persone":[{"nome":"Anna","inCasa":true},{"nome":"Marco","inCasa":false}],
     "misure":[{"nome":"Produzione","valore":"3,2 kW"},{"nome":"Consumo","valore":"1,1 kW"},
      {"nome":"Batteria","valore":"86 %"}],
     "nav":{"attiva":true,"casa":true,"lavoro":true,"tipo":10,"distanza":350,
      "istruzione":"Svolta a destra in Via Roma","strada":"Via Roma","restanti":12400,
      "secondi":840,"arrivo":0,"destinazione":"Casa","velocita":48,"limite":50}}
    """

  /// La fotografia d'esempio, con «adesso» al posto degli zeri: aggiornata
  /// da un momento, e l'arrivo fra quattordici minuti.
  static func laFoto() -> LaFoto? {
    var f = LaFoto.leggi(foto)
    f?.quando = Date()
    f?.guida.arrivo = Date().addingTimeInterval(14 * 60)
    return f
  }
}
