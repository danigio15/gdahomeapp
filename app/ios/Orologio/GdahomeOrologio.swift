/* gdahome al polso: la casa e il navigatore.
 *
 * Due pagine, una sopra l'altra come le schede dell'orologio: la casa (i
 * comandi rapidi scelti per l'auto, i dispositivi, com'e' la casa) e la guida
 * di gdanav. E' quello che c'e' in CarPlay, rifatto per uno schermo da
 * guardare in due secondi. Tutto passa dal telefono: vedi `IlTelefono.swift`.
 */
import SwiftUI

@main
struct GdahomeOrologio: App {
  @StateObject private var telefono = IlTelefono()

  var body: some Scene {
    WindowGroup {
      Radice()
        .environmentObject(telefono)
        .onAppear { telefono.accendi() }
    }
  }
}

struct Radice: View {
  @EnvironmentObject private var telefono: IlTelefono
  @Environment(\.scenePhase) private var fase

  var body: some View {
    Group {
      if let foto = telefono.foto {
        if foto.premium {
          TabView {
            NavigationStack { LaCasa(foto: foto) }
            NavigationStack { IlNavigatore(guida: foto.guida) }
          }
          .tabViewStyle(.verticalPage)
        } else {
          Spiegazione(
            simbolo: "star.circle",
            titolo: "gdahome Premium",
            testo: "La casa al polso è compresa in gdahome Premium. Si attiva dall'app sul telefono."
          )
        }
      } else {
        Spiegazione(
          simbolo: "iphone",
          titolo: "Apri gdahome",
          testo: "Apri gdahome sul telefono una volta: da lì in poi la casa la trovi qui."
        )
      }
    }
    .overlay(alignment: .bottom) {
      if let avviso = telefono.avviso {
        Text(avviso)
          .font(.footnote)
          .multilineTextAlignment(.center)
          .padding(.horizontal, 10)
          .padding(.vertical, 6)
          .background(.ultraThinMaterial, in: Capsule())
          .padding(.bottom, 4)
          .transition(.move(edge: .bottom).combined(with: .opacity))
      }
    }
    .animation(.easeInOut(duration: 0.2), value: telefono.avviso)
    .onChange(of: fase) { nuova in
      if nuova == .active { telefono.aggiorna() }
    }
  }
}

/// Una schermata che dice cosa manca, e dove si fa.
struct Spiegazione: View {
  let simbolo: String
  let titolo: String
  let testo: String

  var body: some View {
    ScrollView {
      VStack(spacing: 8) {
        Image(systemName: simbolo)
          .font(.system(size: 34))
          .foregroundStyle(.tint)
        Text(titolo).font(.headline)
        Text(testo)
          .font(.footnote)
          .multilineTextAlignment(.center)
          .foregroundStyle(.secondary)
      }
      .padding(.top, 8)
    }
  }
}
