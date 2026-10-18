import UIKit

/// La scheda delle notifiche elaborate, disegnata sull'iPhone mentre la
/// notifica arriva.
///
/// E' lo stesso disegno dell'app (`lib/notifiche/scheda.dart`), con le stesse
/// misure — 360×180 punti, stampati tre volte piu' fitti — e gli stessi
/// colori: il ciclo di un elettrodomestico, la giornata del sole, l'UPS,
/// l'antifurto, il movimento. Qui non ci sono i caratteri dell'app ne' i suoi
/// disegni: si usano quelli del sistema (SF, e i simboli SF).
///
/// Ogni numero che manca si salta. Se il tipo non si conosce, `nil`: la
/// notifica arriva col suo testo.
enum LaScheda {
  static let larga: CGFloat = 360
  static let alta: CGFloat = 180

  // MARK: i colori

  static let bluA = UIColor(rgb: 0x1E3A5F), bluB = UIColor(rgb: 0x0F172A)
  static let rossoA = UIColor(rgb: 0x7F1D1D), rossoB = UIColor(rgb: 0x2A0A0A)
  static let chiaro = UIColor(rgb: 0xE2E8F0), spento = UIColor(rgb: 0x94A3B8)
  static let giallo = UIColor(rgb: 0xFBBF24), gialloChiaro = UIColor(rgb: 0xFDE68A)
  static let arancio = UIColor(rgb: 0xF59E0B), grigio = UIColor(rgb: 0x64748B)
  static let verde = UIColor(rgb: 0x22C55E), verdeChiaro = UIColor(rgb: 0x86EFAC)
  static let azzurro = UIColor(rgb: 0x38BDF8), rossoVivo = UIColor(rgb: 0xEF4444)
  static let vetro = UIColor(white: 1, alpha: 0.08)

  static var italiano: Bool {
    (Locale.preferredLanguages.first ?? "it").hasPrefix("it")
  }

  static func detto(_ it: String, _ en: String) -> String { italiano ? it : en }

  // MARK: la scheda

  static func png(_ s: [String: Any]) -> Data? {
    guard let tipo = s["t"] as? String,
      ["ciclo", "giornata", "ups", "antifurto", "movimento"].contains(tipo)
    else { return nil }
    let formato = UIGraphicsImageRendererFormat()
    formato.scale = 3
    formato.opaque = false
    let tela = UIGraphicsImageRenderer(size: CGSize(width: larga, height: alta), format: formato)
    return tela.pngData { contesto in
      let c = contesto.cgContext
      switch tipo {
      case "ciclo": ciclo(c, s)
      case "giornata": giornata(c, s)
      case "ups": ups(c, s)
      case "antifurto": antifurto(c, s)
      default: movimento(c, s)
      }
    }
  }

  /// La foto della telecamera, tagliata a due a uno, con dove e quando.
  static func foto(_ byte: Data, scheda: [String: Any]?) -> Data? {
    guard let immagine = UIImage(data: byte) else { return nil }
    let formato = UIGraphicsImageRendererFormat()
    formato.scale = 3
    let tela = UIGraphicsImageRenderer(size: CGSize(width: larga, height: alta), format: formato)
    let disegnata = tela.image { contesto in
      let tutto = CGRect(x: 0, y: 0, width: larga, height: alta)
      UIBezierPath(roundedRect: tutto, cornerRadius: 18).addClip()
      let dimensioni = immagine.size
      let quanto = max(larga / max(dimensioni.width, 1), alta / max(dimensioni.height, 1))
      let w = dimensioni.width * quanto, h = dimensioni.height * quanto
      immagine.draw(in: CGRect(x: (larga - w) / 2, y: (alta - h) / 2, width: w, height: h))
      let scritta = [scheda?["cam"] as? String, scheda?["ora"] as? String]
        .compactMap { $0 }.joined(separator: " · ")
      if !scritta.isEmpty {
        let misuraScritta = misura(scritta, corpo: 9.5, peso: .heavy)
        let pillola = CGRect(x: 10, y: alta - 30, width: misuraScritta.width + 26, height: 20)
        UIColor(white: 0, alpha: 0.6).setFill()
        UIBezierPath(roundedRect: pillola, cornerRadius: 7).fill()
        UIColor.white.setFill()
        UIBezierPath(ovalIn: CGRect(x: pillola.minX + 7, y: pillola.midY - 3, width: 6, height: 6)).fill()
        scrivi(scritta, CGPoint(x: pillola.minX + 18, y: pillola.minY + 4), corpo: 9.5, peso: .heavy, colore: .white)
      }
      _ = contesto
    }
    return disegnata.jpegData(compressionQuality: 0.85)
  }

  // MARK: gli attrezzi

  static func numero(_ cosa: Any?) -> Double? { (cosa as? NSNumber)?.doubleValue }

  static func serie(_ cosa: Any?) -> [Double] {
    ((cosa as? [Any]) ?? []).map { numero($0) ?? 0 }
  }

  static func decimali(_ valore: Double, _ quanti: Int) -> String {
    let testo = String(format: "%.\(quanti)f", valore)
    return italiano ? testo.replacingOccurrences(of: ".", with: ",") : testo
  }

  static func euro(_ v: Double) -> String { italiano ? "\(decimali(v, 2)) €" : "€\(decimali(v, 2))" }
  static func kwh(_ v: Double) -> String { "\(decimali(v, v >= 10 ? 1 : 2)) kWh" }
  static func percento(_ q: Double) -> String { "\(Int((q * 100).rounded()))%" }

  static func durata(_ minuti: Int) -> String {
    if minuti < 60 { return "\(minuti) min" }
    let resto = minuti % 60
    return resto == 0 ? "\(minuti / 60) h" : "\(minuti / 60) h \(resto) min"
  }

  static func carattere(_ corpo: CGFloat, _ peso: UIFont.Weight, titolo: Bool) -> UIFont {
    if titolo, #available(iOS 16.0, *) {
      return UIFont.systemFont(ofSize: corpo, weight: peso, width: .condensed)
    }
    return UIFont.systemFont(ofSize: corpo, weight: peso)
  }

  static func attributi(
    _ corpo: CGFloat, _ peso: UIFont.Weight, _ colore: UIColor, titolo: Bool, allinea: NSTextAlignment
  ) -> [NSAttributedString.Key: Any] {
    let paragrafo = NSMutableParagraphStyle()
    paragrafo.alignment = allinea
    paragrafo.lineBreakMode = .byTruncatingTail
    return [.font: carattere(corpo, peso, titolo: titolo), .foregroundColor: colore, .paragraphStyle: paragrafo]
  }

  static func misura(_ testo: String, corpo: CGFloat, peso: UIFont.Weight, titolo: Bool = false) -> CGSize {
    (testo as NSString).size(withAttributes: [.font: carattere(corpo, peso, titolo: titolo)])
  }

  /// Scrive un testo che parte da `da` (a destra di `da` se `allinea` e'
  /// `.right`: allora `da` e' il bordo destro).
  @discardableResult
  static func scrivi(
    _ testo: String, _ da: CGPoint, corpo: CGFloat = 12, peso: UIFont.Weight = .semibold,
    colore: UIColor = chiaro, titolo: Bool = false, larga: CGFloat = 320,
    allinea: NSTextAlignment = .left, righe: Int = 1
  ) -> CGSize {
    /* Come nell'app: se non ci sta si rimpicciolisce mezzo punto alla volta,
     * fino ai sette decimi; solo dopo si taglia coi puntini. Su una riga
     * sola; su piu' righe va a capo da se'. */
    let minimo = corpo * 0.7
    var corpo = corpo
    if righe == 1 {
      while misura(testo, corpo: corpo, peso: peso, titolo: titolo).width > larga, corpo - 0.5 >= minimo {
        corpo -= 0.5
      }
    }
    let quanto = misura(testo, corpo: corpo, peso: peso, titolo: titolo)
    let w = min(quanto.width, larga)
    let x: CGFloat
    switch allinea {
    case .right: x = da.x - w
    case .center: x = da.x - w / 2
    default: x = da.x
    }
    let h = quanto.height * CGFloat(righe) + 2
    (testo as NSString).draw(
      with: CGRect(x: x, y: da.y, width: righe > 1 ? larga : w + 1, height: h),
      options: [.usesLineFragmentOrigin, .truncatesLastVisibleLine],
      attributes: attributi(corpo, peso, colore, titolo: titolo, allinea: allinea),
      context: nil)
    return CGSize(width: w, height: h)
  }

  static func fondo(_ c: CGContext, _ colori: [UIColor]) {
    let tutto = CGRect(x: 0, y: 0, width: larga, height: alta)
    c.saveGState()
    UIBezierPath(roundedRect: tutto, cornerRadius: 18).addClip()
    let spazio = CGColorSpaceCreateDeviceRGB()
    let posti: [CGFloat] = colori.count == 3 ? [0, 0.45, 0.9] : [0, 0.7]
    if let sfumatura = CGGradient(colorsSpace: spazio, colors: colori.map(\.cgColor) as CFArray, locations: posti) {
      c.drawRadialGradient(
        sfumatura, startCenter: .zero, startRadius: 0, endCenter: .zero, endRadius: larga * 1.1,
        options: [.drawsAfterEndLocation])
    }
    c.restoreGState()
  }

  static func simbolo(_ nome: String, _ dove: CGRect, _ colori: [UIColor]) {
    let configurazione = UIImage.SymbolConfiguration(pointSize: dove.height * 0.8, weight: .semibold)
      .applying(UIImage.SymbolConfiguration(paletteColors: colori))
    UIImage(systemName: nome, withConfiguration: configurazione)?.draw(in: dove)
  }

  static func testa(_ simbolo: String, _ colori: [UIColor], _ titolo: String, _ sotto: String, finoA: CGFloat = 230) {
    LaScheda.simbolo(simbolo, CGRect(x: 14, y: 12, width: 30, height: 28), colori)
    scrivi(titolo.uppercased(), CGPoint(x: 52, y: 8), corpo: 18, peso: .bold, colore: .white, titolo: true, larga: finoA - 52)
    scrivi(sotto, CGPoint(x: 52, y: 31), corpo: 9.5, colore: spento, larga: finoA - 52)
  }

  @discardableResult
  static func pillola(_ dove: CGPoint, _ colore: UIColor, _ testo: String, finoA: CGFloat = 346) -> CGFloat {
    var corpo: CGFloat = 9.5
    while misura(testo, corpo: corpo, peso: .heavy).width > finoA - dove.x - 26, corpo - 0.5 >= 9.5 * 0.7 {
      corpo -= 0.5
    }
    let quanto = min(misura(testo, corpo: corpo, peso: .heavy).width, finoA - dove.x - 26)
    let riquadro = CGRect(x: dove.x, y: dove.y, width: quanto + 26, height: 19)
    vetro.setFill()
    UIBezierPath(roundedRect: riquadro, cornerRadius: 10).fill()
    colore.setFill()
    UIBezierPath(roundedRect: CGRect(x: dove.x + 8, y: dove.y + 6, width: 7, height: 7), cornerRadius: 2).fill()
    scrivi(testo, CGPoint(x: dove.x + 19, y: dove.y + 3), corpo: corpo, peso: .heavy, larga: quanto + 1)
    return riquadro.width
  }

  static func punti(_ valori: [Double], _ dove: CGRect, _ massimo: Double) -> [CGPoint] {
    valori.enumerated().map { i, v in
      let x = dove.minX + (valori.count == 1 ? 0 : CGFloat(i) * dove.width / CGFloat(valori.count - 1))
      let y = dove.maxY - CGFloat(min(max(v, 0), massimo) / massimo) * dove.height
      return CGPoint(x: x, y: y)
    }
  }

  static func area(_ valori: [Double], _ dove: CGRect, _ massimo: Double) -> UIBezierPath {
    let strada = UIBezierPath()
    strada.move(to: CGPoint(x: dove.minX, y: dove.maxY))
    punti(valori, dove, massimo).forEach { strada.addLine(to: $0) }
    strada.addLine(to: CGPoint(x: dove.maxX, y: dove.maxY))
    strada.close()
    return strada
  }

  static func linea(_ valori: [Double], _ dove: CGRect, _ massimo: Double) -> UIBezierPath {
    let strada = UIBezierPath()
    for (i, p) in punti(valori, dove, massimo).enumerated() {
      if i == 0 { strada.move(to: p) } else { strada.addLine(to: p) }
    }
    return strada
  }

  static func asse(_ dove: CGRect) {
    UIColor(white: 1, alpha: 0.13).setStroke()
    let riga = UIBezierPath()
    riga.move(to: CGPoint(x: dove.minX, y: dove.maxY))
    riga.addLine(to: CGPoint(x: dove.maxX, y: dove.maxY))
    riga.lineWidth = 1
    riga.stroke()
  }

  static func ciambella(_ centro: CGPoint, _ raggio: CGFloat, _ quota: Double) {
    let sotto = UIBezierPath(arcCenter: centro, radius: raggio, startAngle: 0, endAngle: .pi * 2, clockwise: true)
    sotto.lineWidth = 7
    UIColor(white: 1, alpha: 0.12).setStroke()
    sotto.stroke()
    let fine = -CGFloat.pi / 2 + CGFloat.pi * 2 * CGFloat(min(max(quota, 0), 1))
    let sopra = UIBezierPath(arcCenter: centro, radius: raggio, startAngle: -.pi / 2, endAngle: fine, clockwise: true)
    sopra.lineWidth = 7
    sopra.lineCapStyle = .round
    giallo.setStroke()
    sopra.stroke()
    scrivi(percento(quota), CGPoint(x: centro.x, y: centro.y - 10), corpo: 15, peso: .bold, colore: gialloChiaro,
      titolo: true, larga: raggio * 2, allinea: .center)
  }

  // MARK: il ciclo di un elettrodomestico

  static func ciclo(_ c: CGContext, _ s: [String: Any]) {
    fondo(c, [bluA, bluB])
    let minuti = numero(s["min"]).map { Int($0.rounded()) }
    var orari: [String] = []
    if let da = s["da"] as? String, let a = s["a"] as? String { orari.append("\(da) → \(a)") }
    if let minuti { orari.append(durata(minuti)) }
    testa("washer.fill", [azzurro], (s["n"] as? String) ?? "", orari.joined(separator: " · "), finoA: 250)
    let soldi = numero(s["eur"]), energia = numero(s["kwh"])
    if let soldi {
      scrivi(soldi == 0 ? detto("GRATIS", "FREE") : euro(soldi), CGPoint(x: 346, y: 4), corpo: 27, peso: .bold,
        colore: gialloChiaro, titolo: true, larga: 110, allinea: .right)
    }
    if let energia {
      scrivi(kwh(energia), CGPoint(x: 346, y: 38), corpo: 9.5, peso: .bold, colore: spento, larga: 110, allinea: .right)
    }
    // Il grafico a sinistra, la ciambella a destra, e sotto le pillole a
    // tutta larghezza: cosi' i numeri lunghi ci stanno interi.
    let watt = serie(s["w"]), sole = serie(s["s"])
    let grafico = CGRect(x: 14, y: 56, width: 236, height: 70)
    if watt.count > 1 {
      let massimo = max(watt.max() ?? 1, 1) * 1.08
      let dalSole = watt.indices.map { i in i < sole.count ? min(watt[i], sole[i]) : 0 }
      asse(grafico)
      grigio.withAlphaComponent(0.6).setFill()
      area(watt, grafico, massimo).fill()
      giallo.setFill()
      area(dalSole, grafico, massimo).fill()
      let bordo = linea(watt, grafico, massimo)
      bordo.lineWidth = 1.3
      chiaro.withAlphaComponent(0.8).setStroke()
      bordo.stroke()
    }
    let sotto: CGFloat = 129
    if let da = s["da"] as? String { scrivi(da, CGPoint(x: grafico.minX, y: sotto), corpo: 8, colore: spento, larga: 50) }
    if let a = s["a"] as? String {
      scrivi(a, CGPoint(x: grafico.maxX, y: sotto), corpo: 8, colore: spento, larga: 50, allinea: .right)
    }
    let quota = numero(s["sole"])
    let batteria = numero(s["batt"]) ?? 0
    if let senza = numero(s["senza"]), let quota, quota > 0 {
      scrivi(detto("senza sole \(euro(senza))", "without sun \(euro(senza))"), CGPoint(x: grafico.midX, y: sotto),
        corpo: 8, peso: .bold, colore: gialloChiaro, larga: 120, allinea: .center)
    }
    if let quota { ciambella(CGPoint(x: 300, y: 92), 24, quota) }
    var pillole: [(UIColor, String)] = []
    if let energia, let quota, energia * quota > 0 {
      pillole.append((giallo, detto("Sole \(kwh(energia * quota)) · gratis", "Sun \(kwh(energia * quota)) · free")))
    }
    if batteria > 0 {
      pillole.append((verde, detto("Batteria \(percento(batteria))", "Battery \(percento(batteria))")))
    }
    if let rete = numero(s["rkwh"]), rete > 0 {
      let soldi = numero(s["reur"]).map { " · \(euro($0))" } ?? ""
      pillole.append((grigio, detto("Rete \(kwh(rete))\(soldi)", "Grid \(kwh(rete))\(soldi)")))
    }
    var x: CGFloat = 14
    for (i, (colore, testo)) in pillole.enumerated() {
      let restano = CGFloat(pillole.count - i)
      let finoA = restano == 1 ? 346 : max(x + (346 - x - 8 * (restano - 1)) / restano, x + 60)
      x += pillola(CGPoint(x: x, y: 148), colore, testo, finoA: finoA) + 8
    }
  }

  // MARK: la giornata
  //
  // La griglia di `lib/notifiche/scheda.dart` (`_Griglia`), con le stesse
  // misure: due colonne, 176 | il resto; tre righe, 22 | il resto | 16; tutto
  // in due terzi del disegno approvato (540×270). In alto la data e il record,
  // a sinistra il numero grande e in fondo i due numeri, a destra il grafico
  // ora per ora e sotto la sua legenda.

  enum Griglia {
    static let k: CGFloat = 2.0 / 3.0
    static let sinistra: CGFloat = 22 * k
    static let destra: CGFloat = 360 - 20 * k
    static let colonna: CGFloat = 176 * k
    static let grafico: CGFloat = sinistra + colonna + 20 * k
    static let riga1: CGFloat = 18 * k
    static let altezza1: CGFloat = 22 * k
    static let riga2: CGFloat = riga1 + altezza1 + 10 * k
    static let altezza2: CGFloat = 180 * k
    static let riga3: CGFloat = riga2 + altezza2 + 10 * k
    static let altezza3: CGFloat = 16 * k
    static let fondo: CGFloat = riga3 + altezza3
  }

  static let usatoInCasa = UIColor(rgb: 0xD97706)
  static let marrone = UIColor(rgb: 0x422006)
  static let testoChiaro = UIColor(rgb: 0xCBD5E1)

  /// Il corpo piu' grande (dal suo, fino ai sette decimi) a cui il testo ci
  /// sta in `larga`.
  static func corpoPer(
    _ testo: String, _ corpo: CGFloat, _ peso: UIFont.Weight, larga: CGFloat, titolo: Bool = false
  ) -> CGFloat {
    var c = corpo
    while misura(testo, corpo: c, peso: peso, titolo: titolo).width > larga, c - 0.5 >= corpo * 0.7 { c -= 0.5 }
    return c
  }

  static func sfumatura(_ colori: [UIColor], _ posti: [CGFloat]) -> CGGradient? {
    CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colori.map(\.cgColor) as CFArray, locations: posti)
  }

  static func giornata(_ c: CGContext, _ s: [String: Any]) {
    let dalSole = numero(s["pk"])
    let conSole = dalSole != nil
    let tutto = CGRect(x: 0, y: 0, width: larga, height: alta)
    c.saveGState()
    UIBezierPath(roundedRect: tutto, cornerRadius: 22 * Griglia.k).addClip()
    c.scaleBy(x: 1, y: 0.5)
    let colori = conSole
      ? [UIColor(rgb: 0x3A2507), UIColor(rgb: 0x141B2E), UIColor(rgb: 0x0B1222)]
      : [UIColor(rgb: 0x1E3A5F), UIColor(rgb: 0x141B2E), UIColor(rgb: 0x0B1222)]
    if let fondo = sfumatura(colori, [0, 0.45, 1]) {
      c.drawRadialGradient(
        fondo, startCenter: .zero, startRadius: 0, endCenter: .zero, endRadius: larga * 1.2,
        options: [.drawsAfterEndLocation])
    }
    c.restoreGState()
    let bordo = UIBezierPath(roundedRect: tutto.insetBy(dx: 0.35, dy: 0.35), cornerRadius: 22 * Griglia.k)
    bordo.lineWidth = 0.7
    UIColor(white: 1, alpha: 0.07).setStroke()
    bordo.stroke()

    // La prima riga: la data a sinistra, il record a destra.
    var finoAllaData = Griglia.destra
    if let record = s["rec"] as? String, !record.isEmpty {
      let anno = record == "anno" || record == "year"
      let scritta = anno
        ? detto("Record dell'anno", "Record of the year") : detto("Record di \(record)", "\(record) record")
      let massimo = (Griglia.destra - Griglia.sinistra) / 2 - 24
      let corpo = corpoPer(scritta, 11 * Griglia.k, .heavy, larga: massimo)
      let quanto = misura(scritta, corpo: corpo, peso: .heavy)
      let largaScritta = min(quanto.width, massimo)
      let dentro = 10 * Griglia.k
      let largaPillola = dentro + 7 + 3 + largaScritta + dentro
      let altaPillola = quanto.height + 8 * Griglia.k
      let pillola = CGRect(
        x: Griglia.destra - largaPillola, y: Griglia.riga1 + (Griglia.altezza1 - altaPillola) / 2,
        width: largaPillola, height: altaPillola)
      c.saveGState()
      UIBezierPath(roundedRect: pillola, cornerRadius: altaPillola / 2).addClip()
      if let oro = sfumatura([gialloChiaro, arancio], [0, 1]) {
        c.drawLinearGradient(
          oro, start: CGPoint(x: pillola.minX, y: pillola.minY), end: CGPoint(x: pillola.maxX, y: pillola.maxY),
          options: [])
      }
      c.restoreGState()
      simbolo("trophy.fill", CGRect(x: pillola.minX + dentro, y: pillola.midY - 3.5, width: 7, height: 7), [marrone])
      scrivi(
        scritta, CGPoint(x: pillola.minX + dentro + 10, y: pillola.midY - quanto.height / 2), corpo: corpo,
        peso: .heavy, colore: marrone, larga: largaScritta + 1)
      finoAllaData = pillola.minX - 8
    }
    if let testo = s["d"] as? String {
      let leggi = DateFormatter()
      leggi.dateFormat = "yyyy-MM-dd"
      if let giorno = leggi.date(from: testo) {
        let formato = DateFormatter()
        formato.locale = Locale(identifier: italiano ? "it_IT" : "en_US")
        formato.dateFormat = italiano ? "EEEE d MMMM" : "EEEE MMMM d"
        let data = formato.string(from: giorno).uppercased()
        let corpo = 10.5 * Griglia.k
        let alto = misura(data, corpo: corpo, peso: .heavy).height
        scrivi(
          data, CGPoint(x: Griglia.sinistra, y: Griglia.riga1 + (Griglia.altezza1 - alto) / 2), corpo: corpo,
          peso: .heavy, colore: spento, larga: finoAllaData - Griglia.sinistra)
      }
    }

    // A sinistra: il numero grande, e cosa vuol dire.
    if let grande = conSole ? dalSole : numero(s["rk"]) {
      let unita = misura("kWh", corpo: 14 * Griglia.k, peso: .semibold)
      let cifra = decimali(grande, grande >= 100 ? 0 : 1)
      let corpo = corpoPer(cifra, 60 * Griglia.k, .bold, larga: Griglia.colonna - unita.width - 4, titolo: true)
      let font = carattere(corpo, .bold, titolo: true)
      let sopra = Griglia.riga2 - 60 * Griglia.k * 0.05
      let quanto = scrivi(
        cifra, CGPoint(x: Griglia.sinistra, y: sopra), corpo: corpo, peso: .bold, colore: gialloChiaro,
        titolo: true, larga: Griglia.colonna)
      let base = sopra + font.ascender
      let piccolo = carattere(14 * Griglia.k, .semibold, titolo: false)
      scrivi(
        "kWh", CGPoint(x: Griglia.sinistra + quanto.width + 4, y: base - piccolo.ascender), corpo: 14 * Griglia.k,
        peso: .semibold, colore: chiaro, larga: 40)
      scrivi(
        conSole ? detto("prodotti dal sole oggi", "from the sun today") : detto("consumati oggi", "used today"),
        CGPoint(x: Griglia.sinistra, y: Griglia.riga2 + 60 * Griglia.k * 0.9 + 4), corpo: 12.5 * Griglia.k,
        colore: testoChiaro, larga: Griglia.colonna)
    }

    // A sinistra, in fondo: i due numeri, divisi da una linea.
    var coppia: [(String, String)] = []
    if conSole {
      if let casa = numero(s["casa"]) { coppia.append((percento(casa), detto("usato in casa", "used at home"))) }
      if let ris = numero(s["ris"]) { coppia.append((euro(ris), detto("risparmiati", "saved"))) }
    } else {
      if let soldi = numero(s["re"]) { coppia.append((euro(soldi), detto("dalla rete", "from the grid"))) }
      if let batteria = numero(s["batt"]) {
        coppia.append((percento(batteria), detto("batteria stasera", "battery tonight")))
      }
    }
    if !coppia.isEmpty {
      let meta = Griglia.colonna / 2
      let valore = 24 * Griglia.k
      let etichetta = 10.5 * Griglia.k
      let altoValore = carattere(valore, .bold, titolo: true).lineHeight
      let altoEtichetta = carattere(etichetta, .semibold, titolo: false).lineHeight
      let sopraIlValore = 10 * Griglia.k
      let riga = Griglia.fondo - altoValore - 2 - altoEtichetta - sopraIlValore
      let pennello = UIBezierPath()
      pennello.move(to: CGPoint(x: Griglia.sinistra, y: riga))
      pennello.addLine(to: CGPoint(x: Griglia.sinistra + Griglia.colonna, y: riga))
      if coppia.count > 1 {
        pennello.move(to: CGPoint(x: Griglia.sinistra + meta, y: riga + sopraIlValore))
        pennello.addLine(to: CGPoint(x: Griglia.sinistra + meta, y: Griglia.fondo))
      }
      pennello.lineWidth = 0.7
      UIColor(white: 1, alpha: 0.1).setStroke()
      pennello.stroke()
      for (i, (numero, parola)) in coppia.prefix(2).enumerated() {
        let x = Griglia.sinistra + (i == 0 ? 0 : meta + 12 * Griglia.k)
        let spazio = meta - (i == 0 ? 6 : 12 * Griglia.k)
        scrivi(
          numero, CGPoint(x: x, y: riga + sopraIlValore), corpo: valore, peso: .bold, colore: .white, titolo: true,
          larga: spazio)
        scrivi(
          parola, CGPoint(x: x, y: riga + sopraIlValore + altoValore + 2), corpo: etichetta, colore: spento,
          larga: spazio)
      }
    }

    // A destra: il grafico ora per ora (viewBox 300×200, base a 178).
    let prodotta = conSole ? serie(s["p"]).map { $0 / 10 } : []
    let consumata = serie(s["c"]).map { $0 / 10 }
    let dove = CGRect(
      x: Griglia.grafico, y: Griglia.riga2, width: Griglia.destra - Griglia.grafico, height: Griglia.altezza2)
    let y = dove.height / 200
    let base = dove.minY + 178 * y
    let piano = CGRect(x: dove.minX, y: dove.minY, width: dove.width, height: base - dove.minY)
    let righe = UIBezierPath()
    for riga in 1...5 {
      let quota = base - CGFloat(riga) * 32.95 * y
      righe.move(to: CGPoint(x: dove.minX, y: quota))
      righe.addLine(to: CGPoint(x: dove.maxX, y: quota))
    }
    righe.lineWidth = 0.6
    UIColor(white: 1, alpha: 0.06).setStroke()
    righe.stroke()
    let asse = UIBezierPath()
    asse.move(to: CGPoint(x: dove.minX, y: base))
    asse.addLine(to: CGPoint(x: dove.maxX, y: base))
    asse.lineWidth = 0.7
    UIColor(white: 1, alpha: 0.18).setStroke()
    asse.stroke()
    let tutti = prodotta + consumata
    if tutti.count > 1 {
      let massimo = max(tutti.max() ?? 0.1, 0.1) * 1.1
      if prodotta.count > 1 {
        c.saveGState()
        area(prodotta, piano, massimo).addClip()
        if let ambra = sfumatura(
          [usatoInCasa.withAlphaComponent(0.55), usatoInCasa.withAlphaComponent(0.08)], [0, 1])
        {
          c.drawLinearGradient(
            ambra, start: CGPoint(x: piano.midX, y: piano.minY), end: CGPoint(x: piano.midX, y: piano.maxY),
            options: [])
        }
        c.restoreGState()
        let curva = linea(prodotta, piano, massimo)
        curva.lineWidth = 1.3
        curva.lineJoinStyle = .round
        arancio.setStroke()
        curva.stroke()
        let usata = prodotta.indices.map { i in i < consumata.count ? min(prodotta[i], consumata[i]) : 0 }
        usatoInCasa.setFill()
        area(usata, piano, massimo).fill()
      }
      if consumata.count > 1 {
        let curva = linea(consumata, piano, massimo)
        curva.lineWidth = 1.45
        curva.lineJoinStyle = .round
        azzurro.setStroke()
        curva.stroke()
      }
      if conSole, let picco = numero(s["pkw"]), prodotta.count > 1, let alto = prodotta.max(),
        let i = prodotta.firstIndex(of: alto)
      {
        let p = punti(prodotta, piano, massimo)[i]
        let cerchio = UIBezierPath(ovalIn: CGRect(x: p.x - 3, y: p.y - 3, width: 6, height: 6))
        UIColor(rgb: 0x0F172A).setFill()
        cerchio.fill()
        cerchio.lineWidth = 1.6
        giallo.setStroke()
        cerchio.stroke()
        let ora = (s["pora"] as? String).map { " · \($0)" } ?? ""
        let scritta = "\(decimali(picco, 1)) kW\(ora)"
        let quanto = misura(scritta, corpo: 6.8, peso: .bold)
        var x = p.x + 5.3
        if x + quanto.width > dove.maxX { x = p.x - 5.3 - quanto.width }
        let sopra = max(p.y - 3.6 - carattere(6.8, .bold, titolo: false).ascender, dove.minY - quanto.height / 2)
        scrivi(scritta, CGPoint(x: x, y: sopra), corpo: 6.8, peso: .bold, colore: gialloChiaro, larga: dove.width / 2)
      }
    }
    let piccolo = carattere(6.5, .semibold, titolo: false)
    for ora in [0, 6, 12, 18, 24] {
      let testo = String(format: "%02d", ora)
      let x = dove.minX + CGFloat(ora) * dove.width / 24
      let allinea: NSTextAlignment = ora == 0 ? .left : (ora == 24 ? .right : .center)
      scrivi(
        testo, CGPoint(x: x, y: dove.minY + 196 * y - piccolo.ascender), corpo: 6.5, colore: spento, larga: 20,
        allinea: allinea)
    }

    // La legenda, nella terza riga, allineata al grafico.
    var voci: [(UIColor, String)] = []
    if prodotta.count > 1 {
      voci.append((arancio.withAlphaComponent(0.55), detto("Sole", "Sun")))
      voci.append((usatoInCasa, detto("Usato in casa", "Used at home")))
    }
    if consumata.count > 1 { voci.append((azzurro, detto("Consumo", "Consumption"))) }
    if !voci.isEmpty {
      let quadratino = 9 * Griglia.k
      let accanto = 5 * Griglia.k
      let fra = 14 * Griglia.k
      var corpo = 10.5 * Griglia.k
      func larghezza(_ corpo: CGFloat) -> CGFloat {
        voci.reduce(0) { $0 + misura($1.1, corpo: corpo, peso: .semibold).width + quadratino + accanto }
          + fra * CGFloat(voci.count - 1)
      }
      while larghezza(corpo) > dove.width, corpo - 0.5 >= 10.5 * Griglia.k * 0.7 { corpo -= 0.5 }
      var x = Griglia.grafico
      let centro = Griglia.riga3 + Griglia.altezza3 / 2
      for (colore, parola) in voci {
        colore.setFill()
        UIBezierPath(
          roundedRect: CGRect(x: x, y: centro - quadratino / 2, width: quadratino, height: quadratino),
          cornerRadius: 3 * Griglia.k
        ).fill()
        x += quadratino + accanto
        let quanto = misura(parola, corpo: corpo, peso: .semibold)
        scrivi(
          parola, CGPoint(x: x, y: centro - quanto.height / 2), corpo: corpo, colore: testoChiaro,
          larga: quanto.width + 1)
        x += quanto.width + fra
      }
    }
  }

  // MARK: l'UPS

  static func ups(_ c: CGContext, _ s: [String: Any]) {
    fondo(c, [bluA, bluB])
    let dalle = s["dalle"] as? String
    testa("minus.plus.batteryblock.fill", [verde, chiaro], (s["n"] as? String) ?? detto("UPS di casa", "Home UPS"),
      dalle.map { detto("a batteria dalle \($0)", "on battery since \($0)") } ?? detto("a batteria", "on battery"),
      finoA: 240)
    if let minuti = numero(s["min"]) {
      scrivi("~\(Int(minuti.rounded())) MIN", CGPoint(x: 346, y: 4), corpo: 27, peso: .bold, colore: gialloChiaro,
        titolo: true, larga: 120, allinea: .right)
      scrivi(detto("autonomia", "runtime"), CGPoint(x: 346, y: 38), corpo: 9, peso: .bold, colore: spento, larga: 120,
        allinea: .right)
    }
    let carica = min(max(numero(s["car"]) ?? 0, 0), 1)
    let barra = CGRect(x: 14, y: 66, width: 332, height: 14)
    vetro.setFill()
    UIBezierPath(roundedRect: barra, cornerRadius: 7).fill()
    let colore = carica >= 0.5 ? verde : (carica >= 0.2 ? arancio : rossoVivo)
    if carica > 0 {
      colore.setFill()
      UIBezierPath(roundedRect: CGRect(x: barra.minX, y: barra.minY, width: barra.width * CGFloat(carica), height: barra.height),
        cornerRadius: 7).fill()
    }
    var x: CGFloat = 14
    x += pillola(CGPoint(x: x, y: 92), colore, detto("Carica \(percento(carica))", "Charge \(percento(carica))")) + 8
    if let watt = numero(s["w"]) {
      pillola(CGPoint(x: x, y: 92), arancio, detto("Carico \(Int(watt.rounded())) W", "Load \(Int(watt.rounded())) W"))
    }
    if let accesi = s["acc"] as? [String], !accesi.isEmpty {
      let riquadro = CGRect(x: 14, y: 124, width: 332, height: 40)
      UIColor(white: 1, alpha: 0.05).setFill()
      UIBezierPath(roundedRect: riquadro, cornerRadius: 10).fill()
      let elenco = accesi.joined(separator: ", ")
      scrivi(detto("Restano accesi: \(elenco)", "Still on: \(elenco)"), CGPoint(x: riquadro.minX + 10, y: riquadro.minY + 8),
        corpo: 10, peso: .bold, colore: UIColor(rgb: 0xCBD5E1), larga: riquadro.width - 20, righe: 2)
    }
  }

  // MARK: l'antifurto

  static func antifurto(_ c: CGContext, _ s: [String: Any]) {
    fondo(c, [rossoA, rossoB])
    let bordo = UIBezierPath(roundedRect: CGRect(x: 0.5, y: 0.5, width: larga - 1, height: alta - 1), cornerRadius: 18)
    rossoVivo.withAlphaComponent(0.4).setStroke()
    bordo.lineWidth = 1
    bordo.stroke()
    var sotto: [String] = []
    if let modo = s["modo"] as? String, !modo.isEmpty { sotto.append(modo) }
    if let dalle = s["dalle"] as? String { sotto.append(detto("inserito dalle \(dalle)", "armed since \(dalle)")) }
    testa("checkmark.shield.fill", [.white, verde], detto("Antifurto scattato", "Alarm triggered"),
      sotto.joined(separator: " · "), finoA: 260)
    if (s["sir"] as? Bool) == true {
      let pillola = CGRect(x: 282, y: 12, width: 64, height: 20)
      UIColor(rgb: 0xDC2626).setFill()
      UIBezierPath(roundedRect: pillola, cornerRadius: 10).fill()
      UIColor.white.setFill()
      UIBezierPath(ovalIn: CGRect(x: pillola.minX + 7, y: pillola.midY - 3, width: 6, height: 6)).fill()
      scrivi(detto("SIRENA", "SIREN"), CGPoint(x: pillola.minX + 17, y: pillola.minY + 4), corpo: 9, peso: .black,
        colore: .white, larga: 50)
    }
    scrivi(detto("CHE COSA", "WHAT"), CGPoint(x: 14, y: 52), corpo: 8, peso: .heavy, colore: UIColor(rgb: 0xFCA5A5))
    let cosa = [s["zona"] as? String, s["ora"] as? String].compactMap { $0 }.filter { !$0.isEmpty }
    scrivi(cosa.joined(separator: " · "), CGPoint(x: 14, y: 63), corpo: 23, peso: .bold, colore: .white, titolo: true,
      larga: 332)
    var y: CGFloat = 104
    for uno in ((s["ev"] as? [[Any]]) ?? []).prefix(3) where uno.count >= 2 {
      let colore: UIColor
      switch uno.count > 2 ? "\(uno[2])" : "" {
      case "r": colore = rossoVivo
      case "a": colore = arancio
      case "v": colore = verde
      default: colore = spento
      }
      scrivi("\(uno[0])", CGPoint(x: 14, y: y), corpo: 10, peso: .heavy, colore: .white, larga: 40)
      colore.setFill()
      UIBezierPath(ovalIn: CGRect(x: 56.5, y: y + 3, width: 7, height: 7)).fill()
      scrivi("\(uno[1])", CGPoint(x: 70, y: y), corpo: 10, peso: .bold, colore: UIColor(rgb: 0xFECACA), larga: 276)
      y += 20
    }
  }

  // MARK: il movimento senza foto

  static func movimento(_ c: CGContext, _ s: [String: Any]) {
    fondo(c, [bluA, bluB])
    simbolo("video.fill", CGRect(x: 150, y: 40, width: 60, height: 46), [azzurro])
    let cosa = [s["cam"] as? String, s["ora"] as? String].compactMap { $0 }
    scrivi(cosa.joined(separator: " · "), CGPoint(x: 180, y: 108), corpo: 19, peso: .bold, colore: .white, titolo: true,
      larga: 330, allinea: .center)
  }
}

extension UIColor {
  convenience init(rgb: UInt32) {
    self.init(
      red: CGFloat((rgb >> 16) & 0xFF) / 255,
      green: CGFloat((rgb >> 8) & 0xFF) / 255,
      blue: CGFloat(rgb & 0xFF) / 255,
      alpha: 1)
  }
}
