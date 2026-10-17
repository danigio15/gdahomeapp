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
  static let soleA = UIColor(rgb: 0x7C4A03), soleB = UIColor(rgb: 0x2A1A05)
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
    let quanto = min(misura(testo, corpo: 9.5, peso: .heavy).width, finoA - dove.x - 26)
    let riquadro = CGRect(x: dove.x, y: dove.y, width: quanto + 26, height: 19)
    vetro.setFill()
    UIBezierPath(roundedRect: riquadro, cornerRadius: 10).fill()
    colore.setFill()
    UIBezierPath(roundedRect: CGRect(x: dove.x + 8, y: dove.y + 6, width: 7, height: 7), cornerRadius: 2).fill()
    scrivi(testo, CGPoint(x: dove.x + 19, y: dove.y + 3), corpo: 9.5, peso: .heavy, larga: quanto)
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
    let watt = serie(s["w"]), sole = serie(s["s"])
    let grafico = CGRect(x: 14, y: 58, width: 196, height: 88)
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
    if let da = s["da"] as? String { scrivi(da, CGPoint(x: grafico.minX, y: 150), corpo: 8, colore: spento) }
    if let a = s["a"] as? String {
      scrivi(a, CGPoint(x: grafico.maxX, y: 150), corpo: 8, colore: spento, larga: 60, allinea: .right)
    }
    let quota = numero(s["sole"])
    let batteria = numero(s["batt"]) ?? 0
    if let quota { ciambella(CGPoint(x: 281, y: 84), 22, quota) }
    var y: CGFloat = 118
    if let energia, let quota, energia * quota > 0 {
      pillola(CGPoint(x: 220, y: y), giallo, detto("Sole \(kwh(energia * quota))", "Sun \(kwh(energia * quota))"))
      y += 22
    }
    if batteria > 0 {
      pillola(CGPoint(x: 220, y: y), verde, detto("Batteria \(percento(batteria))", "Battery \(percento(batteria))"))
      y += 22
    }
    if let rete = numero(s["rkwh"]), rete > 0, y < 170 {
      pillola(CGPoint(x: 220, y: y), grigio, detto("Rete \(kwh(rete))", "Grid \(kwh(rete))"))
    }
    if let senza = numero(s["senza"]), let quota, quota > 0 {
      scrivi(detto("senza sole \(euro(senza))", "without sun \(euro(senza))"), CGPoint(x: grafico.midX, y: 150),
        corpo: 8, peso: .bold, colore: gialloChiaro, larga: 140, allinea: .center)
    }
  }

  // MARK: la giornata

  static func giornata(_ c: CGContext, _ s: [String: Any]) {
    let conSole = numero(s["pk"]) != nil
    fondo(c, conSole ? [soleA, soleB, bluB] : [bluA, bluB])
    var data = ""
    if let testo = s["d"] as? String {
      let leggi = DateFormatter()
      leggi.dateFormat = "yyyy-MM-dd"
      if let giorno = leggi.date(from: testo) {
        let formato = DateFormatter()
        formato.locale = Locale(identifier: italiano ? "it_IT" : "en_US")
        formato.dateFormat = italiano ? "EEEE d MMMM" : "EEEE MMMM d"
        data = formato.string(from: giorno)
      }
    }
    testa(conSole ? "sun.max.fill" : "bolt.fill", conSole ? [giallo] : [arancio],
      detto("La tua giornata", "Your day"), data, finoA: 220)
    if let record = s["rec"] as? String, !record.isEmpty {
      let quanto = misura("RECORD", corpo: 9, peso: .black).width
      let pillola = CGRect(x: 346 - quanto - 18, y: 12, width: quanto + 18, height: 17)
      gialloChiaro.setFill()
      UIBezierPath(roundedRect: pillola, cornerRadius: 9).fill()
      scrivi("RECORD", CGPoint(x: pillola.minX + 9, y: pillola.minY + 2), corpo: 9, peso: .black, colore: UIColor(rgb: 0x422006))
      scrivi(detto("il giorno più solare di \(record)", "sunniest day of \(record)"), CGPoint(x: 346, y: 32),
        corpo: 8, peso: .bold, colore: gialloChiaro, larga: 140, allinea: .right)
    }
    var tessere: [(String, String, UIColor)] = []
    if conSole {
      tessere.append((detto("DAL SOLE", "FROM SUN"), kwh(numero(s["pk"]) ?? 0), gialloChiaro))
      if let casa = numero(s["casa"]) { tessere.append((detto("IN CASA", "AT HOME"), percento(casa), .white)) }
      if let ris = numero(s["ris"]) { tessere.append((detto("RISPARMIATI", "SAVED"), euro(ris), verdeChiaro)) }
    } else {
      if let rete = numero(s["rk"]) { tessere.append((detto("CONSUMO", "USED"), kwh(rete), .white)) }
      if let soldi = numero(s["re"]) { tessere.append((detto("COSTO", "COST"), euro(soldi), gialloChiaro)) }
    }
    for (i, (etichetta, valore, colore)) in tessere.enumerated() {
      let riquadro = CGRect(x: 14, y: 50 + CGFloat(i) * 41, width: 96, height: 36)
      UIColor(white: 1, alpha: 0.06).setFill()
      UIBezierPath(roundedRect: riquadro, cornerRadius: 10).fill()
      scrivi(etichetta, CGPoint(x: riquadro.minX + 8, y: riquadro.minY + 4), corpo: 7, peso: .heavy, colore: spento, larga: 84)
      scrivi(valore, CGPoint(x: riquadro.minX + 8, y: riquadro.minY + 14), corpo: 16, peso: .bold, colore: colore,
        titolo: true, larga: 84)
    }
    let prodotta = serie(s["p"]).map { $0 / 10 }, consumata = serie(s["c"]).map { $0 / 10 }
    let grafico = CGRect(x: 122, y: 54, width: 224, height: 82)
    let tutti = prodotta + consumata
    if !tutti.isEmpty {
      let massimo = max(tutti.max() ?? 0.5, 0.5) * 1.1
      asse(grafico)
      if prodotta.count > 1 {
        gialloChiaro.withAlphaComponent(0.55).setFill()
        area(prodotta, grafico, massimo).fill()
        let usata = prodotta.indices.map { i in i < consumata.count ? min(prodotta[i], consumata[i]) : 0 }
        arancio.setFill()
        area(usata, grafico, massimo).fill()
      }
      if consumata.count > 1 {
        let curva = linea(consumata, grafico, massimo)
        curva.lineWidth = 1.8
        curva.lineJoinStyle = .round
        azzurro.setStroke()
        curva.stroke()
      }
      if let picco = numero(s["pkw"]), prodotta.count > 1, let alto = prodotta.max(),
        let dove = prodotta.firstIndex(of: alto)
      {
        let p = punti(prodotta, grafico, massimo)[dove]
        UIColor.white.setFill()
        UIBezierPath(ovalIn: CGRect(x: p.x - 3, y: p.y - 3, width: 6, height: 6)).fill()
        let ora = (s["pora"] as? String).map { " · \($0)" } ?? ""
        scrivi("\(decimali(picco, 1)) kW\(ora)", CGPoint(x: p.x + 5, y: max(p.y - 12, grafico.minY - 4)), corpo: 7.5,
          peso: .heavy, colore: gialloChiaro, larga: 90)
      }
      for ora in [0, 6, 12, 18, 24] {
        scrivi("\(ora)", CGPoint(x: grafico.minX + CGFloat(ora) * grafico.width / 24, y: 138), corpo: 7, colore: spento,
          larga: 20, allinea: .center)
      }
    }
    var x: CGFloat = 126
    for uno in ((s["met"] as? [[Any]]) ?? []).prefix(6) where uno.count >= 2 {
      let nome: String
      switch "\(uno[1])" {
      case "sole": nome = "sun.max.fill"
      case "poco": nome = "cloud.sun.fill"
      case "pioggia": nome = "cloud.rain.fill"
      default: nome = "cloud.fill"
      }
      simbolo(nome, CGRect(x: x + 1, y: 151, width: 11, height: 10), [chiaro, giallo, azzurro])
      scrivi("\(uno[0])", CGPoint(x: x + 6, y: 165), corpo: 6.5, colore: spento, larga: 20, allinea: .center)
      x += 20
    }
    if let consiglio = s["cons"] as? String, !consiglio.isEmpty {
      scrivi("\(detto("Domani", "Tomorrow")): \(consiglio)", CGPoint(x: x + 6, y: 152), corpo: 8, peso: .bold,
        colore: gialloChiaro, larga: 346 - x - 6, righe: 2)
    } else if let batteria = numero(s["batt"]) {
      scrivi(detto("Batteria di casa \(percento(batteria)) per la notte", "Home battery \(percento(batteria)) for the night"),
        CGPoint(x: x + 6, y: 156), corpo: 8, peso: .bold, colore: verdeChiaro, larga: 346 - x - 6)
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
