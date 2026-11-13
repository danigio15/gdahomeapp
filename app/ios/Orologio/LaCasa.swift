/* La casa al polso: i comandi rapidi, i dispositivi, le azioni della plancia,
 * e com'e' la casa adesso.
 *
 * I comandi sono quelli scelti sul telefono per l'auto (gdanav, menu,
 * Comandi rapidi in auto): una lista sola da tenere in ordine, per la
 * macchina e per il polso.
 */
import SwiftUI

/* Ogni schermata disegna la fotografia di adesso, `telefono.foto`, e tiene
 * quella ricevuta solo per quando non ce n'e' una. «Il tasto resta spento»:
 * «Dispositivi» si apriva con la fotografia del momento in cui la si toccava
 * (`NavigationLink { Dispositivi(foto: foto) }`), e da li' in poi
 * ridisegnava quella — la riga girata al tocco e quella corretta dal
 * telefono cambiavano `telefono.foto`, e lo schermo aperto non le vedeva. */

struct LaCasa: View {
  private let ricevuta: LaFoto
  @EnvironmentObject private var telefono: IlTelefono
  @State private var daConfermare: Comando?

  init(foto: LaFoto, daConfermareSubito: Comando? = nil) {
    self.ricevuta = foto
    _daConfermare = State(initialValue: daConfermareSubito)
  }

  private var foto: LaFoto { telefono.foto ?? ricevuta }

  var body: some View {
    List {
      if foto.comandi.isEmpty {
        Text("Nessun comando scelto. Sul telefono: navigatore, menu, Comandi rapidi in auto.")
          .font(.footnote)
          .foregroundStyle(.secondary)
      } else {
        Section {
          ForEach(foto.comandi) { c in
            Button {
              if c.conferma { daConfermare = c } else { telefono.premi(c.id) }
            } label: {
              Segnato(c.nome, simbolo(genere: c.disegno))
            }
            .disabled(telefono.inCorso)
          }
        }
      }
      Section {
        NavigationLink {
          Dispositivi(foto: foto)
        } label: {
          Segnato("Dispositivi", "square.grid.2x2")
        }
        NavigationLink {
          Azioni(foto: foto)
        } label: {
          Segnato("Azioni rapide", "bolt.circle")
        }
        NavigationLink {
          ComeStaLaCasa(foto: foto)
        } label: {
          Segnato("Come sta la casa", "house")
        }
      }
    }
    .navigationTitle(foto.casa.isEmpty ? "Casa" : foto.casa)
    .confirmationDialog(
      daConfermare?.nome ?? "",
      isPresented: Binding(get: { daConfermare != nil }, set: { if !$0 { daConfermare = nil } }),
      titleVisibility: .visible
    ) {
      Button("Sì") {
        if let c = daConfermare { telefono.premi(c.id) }
        daConfermare = nil
      }
      Button("No", role: .cancel) { daConfermare = nil }
    } message: {
      /* La stessa domanda della plancia e dell'impostazione sul telefono
       * («Sei sicuro?» prima di farlo). */
      Text("Sei sicuro?")
    }
  }
}

struct Dispositivi: View {
  private let ricevuta: LaFoto
  @EnvironmentObject private var telefono: IlTelefono

  init(foto: LaFoto) { self.ricevuta = foto }

  private var foto: LaFoto { telefono.foto ?? ricevuta }

  var body: some View {
    List {
      if foto.dispositivi.isEmpty {
        Text("Nessun dispositivo da comandare. Configura varchi, luci o prese in GdAHome sul telefono.")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
      Vecchia(quando: foto.quando)
      ForEach(foto.dispositivi) { d in
        Button {
          telefono.premi(d.id)
        } label: {
          HStack {
            Image(systemName: simbolo(genere: d.genere))
              .foregroundStyle(d.acceso ? Color.accentColor : Color.secondary)
            VStack(alignment: .leading) {
              Text(d.nome).lineLimit(2)
              if !d.stato.isEmpty {
                Text(d.stato).font(.caption2).foregroundStyle(.secondary)
              }
            }
          }
        }
        .disabled(telefono.inCorso)
      }
    }
    .navigationTitle("Dispositivi")
  }
}

struct Azioni: View {
  private let ricevuta: LaFoto
  @EnvironmentObject private var telefono: IlTelefono

  init(foto: LaFoto) { self.ricevuta = foto }

  private var foto: LaFoto { telefono.foto ?? ricevuta }

  var body: some View {
    List {
      if foto.azioni.isEmpty {
        Text("Nessuna azione rapida configurata nella plancia.")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
      Vecchia(quando: foto.quando)
      ForEach(foto.azioni) { a in
        Button {
          telefono.premi(a.id)
        } label: {
          VStack(alignment: .leading) {
            Text(a.nome)
            /* «Fatto» su una cosa che parte fra mezz'ora sarebbe una bugia:
             * si dice prima. */
            if !a.subito {
              Text("Parte quando apri GdAHome sul telefono")
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
          }
        }
        .disabled(telefono.inCorso)
      }
    }
    .navigationTitle("Azioni")
  }
}

struct ComeStaLaCasa: View {
  private let ricevuta: LaFoto
  @EnvironmentObject private var telefono: IlTelefono

  init(foto: LaFoto) { self.ricevuta = foto }

  private var foto: LaFoto { telefono.foto ?? ricevuta }

  var body: some View {
    List {
      Text(quando).font(.footnote).foregroundStyle(.secondary)
      ForEach(foto.misure, id: \.self) { m in
        VStack(alignment: .leading) {
          Text(m.valore).font(.headline)
          Text(m.nome).font(.caption2).foregroundStyle(.secondary)
        }
      }
      ForEach(foto.persone, id: \.self) { p in
        HStack {
          Image(systemName: p.inCasa ? "house.fill" : "figure.walk")
            .foregroundStyle(p.inCasa ? Color.accentColor : Color.secondary)
          Text(p.nome)
          Spacer()
          Text(p.inCasa ? "In casa" : "Fuori").font(.caption2).foregroundStyle(.secondary)
        }
      }
    }
    .navigationTitle("La casa")
  }

  private var quando: String {
    guard let allora = foto.quando else { return "Non si sa di quando è" }
    let minuti = Int(Date().timeIntervalSince(allora) / 60)
    if minuti <= 30 { return "Aggiornato adesso" }
    return minuti >= 60 ? "Di \(minuti / 60) ore fa" : "Di \(minuti) minuti fa"
  }
}

/// Una voce con il suo disegno in ambra, come nei dispositivi: in un elenco
/// SwiftUI su watchOS un `Label` lo lascia bianco.
struct Segnato: View {
  let testo: String
  let simbolo: String

  init(_ testo: String, _ simbolo: String) {
    self.testo = testo
    self.simbolo = simbolo
  }

  var body: some View {
    Label {
      Text(testo)
    } icon: {
      Image(systemName: simbolo).foregroundStyle(Color.accentColor)
    }
  }
}

/* «Le azioni non si ricaricano se le cambi.» L'elenco al polso è quello che
 * la plancia sul telefono ha mandato l'ultima volta che era aperta: cambiate
 * le azioni dal computer, al polso restano quelle di prima finché GdAHome sul
 * telefono non si riapre. Se l'elenco ha più di dieci minuti lo si dice, con
 * l'ora, invece di spacciarlo per adesso. */
struct Vecchia: View {
  let quando: Date?

  var body: some View {
    if let quando, Date().timeIntervalSince(quando) > 10 * 60 {
      Text("Aggiornato alle \(quando.formatted(date: .omitted, time: .shortened)). Per le novità apri GdAHome sul telefono.")
        .font(.footnote)
        .foregroundStyle(.secondary)
    }
  }
}
