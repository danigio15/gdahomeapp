/* Il filo col telefono, dal polso.
 *
 * L'orologio non ha le chiavi di casa, e non deve averle: se le avesse,
 * sarebbero due i posti che sanno entrare. Riceve la fotografia che il
 * telefono gli manda (`ios/Runner/LOrologio.swift`), e quando si tocca un
 * tasto lo chiede al telefono, che lo esegue col filo dell'app.
 */
import Foundation
import WatchConnectivity
import WatchKit

@MainActor
final class IlTelefono: NSObject, ObservableObject {
  @Published private(set) var foto: LaFoto?

  /// Com'e' andato l'ultimo tocco: «Fatto», o cosa non va. Si toglie da solo.
  @Published var avviso: String?

  /// Se un tocco e' in viaggio verso il telefono.
  @Published private(set) var inCorso = false

  /* ─── La riga che cambia al tocco ───────────────────────────────────────
   *
   * «Funziona, ma non aggiorna lo stato: rimane sempre spenta ma è accesa.»
   * Il tocco fa il giro del telefono e della casa prima di tornare, e intanto
   * al polso non succedeva niente. Adesso la riga si gira subito, col suo
   * colpetto, e resta girata finche' il telefono non dice com'e' davvero: se
   * il comando non parte torna com'era, con l'avviso; se parte, la
   * fotografia che arriva dopo la conferma — o, passato il tempo, la
   * smentisce: e' lei la verita'.
   *
   * `vera` e' l'ultima fotografia arrivata dal telefono; `attese` le righe
   * girate al tocco (l'entita', com'e' attesa, fino a quando ci si crede).
   * Quello che si disegna, `foto`, e' la prima con sopra le seconde. */
  private var vera: LaFoto?
  private var attese: [String: (acceso: Bool, fino: Date)] = [:]

  /// Per quanto si crede alla riga girata al tocco, se il telefono non la
  /// conferma: il tempo dei tre sguardi qui sotto, e un po'. Poi vale quello
  /// che dice la casa.
  private let quantoSiCredeAlTocco: TimeInterval = 15

  /// A comando andato, quando si chiede al telefono com'e' la casa adesso
  /// (`guardaLaCasaPerIlPolso` in `lib/auto/in_auto.dart`): finche' la riga
  /// toccata non dice lo stato atteso.
  private let sguardiDopoIlComando: [TimeInterval] = [2.5, 6, 11]

  /// Ogni quanto, mentre GdAHome e' davanti al polso, si chiede com'e' la
  /// casa: una luce accesa dal muro si vede senza toccare niente. Lo schermo
  /// resta acceso pochi secondi, e quando si abbassa il polso si smette.
  private let ogniQuantoSiGuarda: TimeInterval = 20

  /// Una fotografia scritta prima di quella che si ha non la sostituisce, se
  /// la differenza e' piccola; oltre, l'ora del telefono e' stata spostata.
  private let quantoIndietroSiCrede: Double = 5 * 60 * 1000

  /// Il giro dello sguardo periodico, mentre l'app e' davanti.
  private var ilGiro: Task<Void, Never>?

  func accendi() {
    /* La vetrina (`Vetrina.swift`): la casa d'esempio, e nessun filo. */
    if Vetrina.schermata != nil {
      foto = Vetrina.laFoto()
      return
    }
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  /// Chiede la fotografia di adesso, invece di aspettare che cambi qualcosa.
  func aggiorna() {
    guard Vetrina.schermata == nil else { return }
    guard WCSession.default.activationState == .activated, WCSession.default.isReachable else { return }
    WCSession.default.sendMessage(["cosa": "aggiorna"]) { [weak self] risposta in
      let testo = risposta["foto"] as? String
      Task { @MainActor in self?.prendi(testo) }
    } errorHandler: { _ in }
  }

  /// Chiede al telefono com'e' la casa adesso: il telefono lo chiede a Home
  /// Assistant, corregge la fotografia e la manda indietro. Zitto: cambia
  /// solo la riga. Un telefono con GdAHome di prima non lo sa fare: allora
  /// almeno la fotografia che ha.
  func guarda() {
    guard Vetrina.schermata == nil else { return }
    guard WCSession.default.activationState == .activated, WCSession.default.isReachable else { return }
    WCSession.default.sendMessage(["cosa": "stato"]) { [weak self] risposta in
      let testo = risposta["foto"] as? String
      Task { @MainActor in
        if testo == nil { self?.aggiorna() } else { self?.prendi(testo) }
      }
    } errorHandler: { _ in }
  }

  /// L'app al polso davanti o no: davanti si guarda subito e poi ogni
  /// `ogniQuantoSiGuarda`; dietro si smette, per la batteria.
  func davanti(_ si: Bool) {
    ilGiro?.cancel()
    ilGiro = nil
    guard si, Vetrina.schermata == nil else { return }
    let ogni = UInt64(ogniQuantoSiGuarda * 1_000_000_000)
    ilGiro = Task { @MainActor [weak self] in
      try? await Task.sleep(nanoseconds: 600_000_000)
      while !Task.isCancelled {
        self?.guarda()
        try? await Task.sleep(nanoseconds: ogni)
      }
    }
  }

  func premi(_ id: String) { manda(["cosa": "comando", "id": id], comando: id) }

  func vai(_ dove: String) { manda(["cosa": "vai", "dove": dove]) }

  func ferma() { manda(["cosa": "ferma"]) }

  /// Manda un tocco al telefono. `comando` e' l'id di quello che si e'
  /// premuto, quando e' un comando di casa: si sente e si vede subito.
  private func manda(_ messaggio: [String: Any], comando: String? = nil) {
    let s = WCSession.default
    guard s.activationState == .activated, s.isReachable else {
      return dici("Il telefono non risponde. Tienilo vicino, con GdAHome installata.", bene: false)
    }
    inCorso = true
    /* Il tocco si sente e si vede subito; com'e' andata arriva dopo. */
    let eUnComando = comando != nil
    let girata: String?
    if let comando {
      WKInterfaceDevice.current().play(.click)
      girata = gira(comando) ? comando : nil
    } else {
      girata = nil
    }
    /* «Poi l'app si blocca.» Finché un tocco è in viaggio i tasti sono
     * spenti, e se il telefono non rispondeva — né sì né no — restavano
     * spenti: l'app sembrava ferma. Dopo dieci secondi si lascia perdere, si
     * dice, e i tasti tornano. Una risposta che arriva dopo non conta più. */
    numero += 1
    let questo = numero
    s.sendMessage(messaggio) { [weak self] risposta in
      let ok = (risposta["ok"] as? Bool) == true
      let testo = risposta["testo"] as? String ?? (ok ? "Fatto" : "Non è partito")
      /* A comando andato il telefono manda con la risposta la fotografia di
       * adesso (`LOrologio.swift`): la riga giusta arriva con la conferma. */
      let foto = risposta["foto"] as? String
      Task { @MainActor in
        self?.finito(questo, testo, bene: ok, girata: girata, eUnComando: eUnComando, foto: foto)
      }
    } errorHandler: { [weak self] _ in
      Task { @MainActor in
        self?.finito(questo, "Il telefono non ha risposto", bene: false, girata: girata, eUnComando: eUnComando)
      }
    }
    /* Il telefono risponde quando la casa ha sentito, non quando ha scritto
     * il comando: riaprire il filo puo' chiedere fino a dodici secondi
     * (`quantoSiAspettaIlFilo`). Venti, e poi si lascia perdere. */
    Task { @MainActor [weak self] in
      try? await Task.sleep(nanoseconds: 20_000_000_000)
      self?.finito(
        questo, "Il telefono non ha risposto in tempo", bene: false, girata: girata, eUnComando: eUnComando)
    }
  }

  /// Il numero dell'ultimo tocco mandato: risponde solo lui.
  private var numero = 0

  private func finito(
    _ quale: Int, _ testo: String, bene: Bool, girata: String? = nil, eUnComando: Bool = false, foto: String? = nil
  ) {
    guard quale == numero, inCorso else { return }
    inCorso = false
    if let girata, !bene {
      /* Non e' partito: la riga torna com'era. */
      attese[girata] = nil
      mostra()
    }
    if let foto { prendi(foto) }
    /* Il colpetto del tocco c'e' gia' stato: qui si sente solo il no. */
    dici(testo, bene: bene, colpetto: !(bene && eUnComando))
    /* Lo stato nuovo il telefono lo manda da se' quando la casa lo dice, ma
     * non sempre ci riesce (iOS lo sospende, o la luce e' lenta): si chiede
     * com'e' la casa, piu' volte, finche' la riga toccata non dice lo stato
     * atteso. Per un'azione, che non ha una riga sua, si guarda due volte. */
    if bene, eUnComando {
      for (i, dopo) in sguardiDopoIlComando.enumerated() {
        Task { @MainActor [weak self] in
          try? await Task.sleep(nanoseconds: UInt64(dopo * 1_000_000_000))
          guard let self else { return }
          let attende = girata.map { self.attese[$0] != nil } ?? false
          if attende || (girata == nil && i <= 1) { self.guarda() }
        }
      }
    }
  }

  /// Gira la riga di `id`, se e' quella di un dispositivo.
  private func gira(_ id: String) -> Bool {
    guard let riga = foto?.dispositivi.first(where: { $0.id == id }) else { return false }
    attese[id] = (acceso: !riga.acceso, fino: Date().addingTimeInterval(quantoSiCredeAlTocco))
    mostra()
    /* Passato il tempo, vale quello che dice il telefono. */
    let fra = UInt64((quantoSiCredeAlTocco + 0.1) * 1_000_000_000)
    Task { @MainActor [weak self] in
      try? await Task.sleep(nanoseconds: fra)
      self?.mostra()
    }
    return true
  }

  /// Disegna la fotografia del telefono, con sopra le righe girate al tocco.
  private func mostra() {
    guard var arrivata = vera else { return }
    let adesso = Date()
    attese = attese.filter { $0.value.fino > adesso }
    if !attese.isEmpty {
      var righe: [Dispositivo] = []
      for riga in arrivata.dispositivi {
        if let attesa = attese[riga.id] {
          if attesa.acceso == riga.acceso {
            // Il telefono la conferma: non c'e' piu' niente da aspettare.
            attese[riga.id] = nil
            righe.append(riga)
          } else {
            righe.append(riga.girato())
          }
        } else {
          righe.append(riga)
        }
      }
      arrivata.dispositivi = righe
    }
    foto = arrivata
  }

  private func dici(_ testo: String, bene: Bool, colpetto: Bool = true) {
    if colpetto { WKInterfaceDevice.current().play(bene ? .success : .failure) }
    avviso = testo
    let detto = testo
    Task { @MainActor [weak self] in
      try? await Task.sleep(nanoseconds: 3_000_000_000)
      if self?.avviso == detto { self?.avviso = nil }
    }
  }

  fileprivate func prendi(_ testo: String?) {
    guard let nuova = LaFoto.leggi(testo) else { return }
    /* «Lista vecchia che vince sulla nuova.» La risposta a un tocco porta la
     * fotografia letta in quel momento, e puo' arrivare dopo quella corretta
     * (`updateApplicationContext`): senza questo la riga tornava indietro. */
    if let prima = vera, nuova.agg > 0, prima.agg > 0, nuova.agg < prima.agg,
      prima.agg - nuova.agg < quantoIndietroSiCrede
    {
      return
    }
    vera = nuova
    mostra()
  }
}

extension IlTelefono: WCSessionDelegate {
  nonisolated func session(
    _ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?
  ) {
    /* L'ultima che il sistema ha tenuto da parte: c'e' subito, anche col
     * telefono lontano. Poi se ne chiede una fresca. */
    let testo = session.receivedApplicationContext["foto"] as? String
    Task { @MainActor [weak self] in
      self?.prendi(testo)
      self?.aggiorna()
      self?.guarda()
    }
  }

  nonisolated func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    let testo = applicationContext["foto"] as? String
    Task { @MainActor [weak self] in self?.prendi(testo) }
  }

  nonisolated func sessionReachabilityDidChange(_ session: WCSession) {
    guard session.isReachable else { return }
    Task { @MainActor [weak self] in self?.aggiorna() }
  }
}
