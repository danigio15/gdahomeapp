/* Il navigatore al polso: la prossima manovra, grande, e quando si arriva.
 *
 * La guida la fa gdanav sul telefono (o in CarPlay): qui si guarda e basta,
 * come un cruscotto. Da fermi si parte per Casa o per il Lavoro, che sono i
 * due posti per cui non serve scrivere niente su uno schermo da polso.
 */
import SwiftUI

struct IlNavigatore: View {
  let guida: Guida
  @EnvironmentObject private var telefono: IlTelefono

  var body: some View {
    ScrollView {
      if guida.attiva { inGuida } else { fermi }
    }
    .navigationTitle("Navigatore")
  }

  private var inGuida: some View {
    VStack(spacing: 6) {
      Image(systemName: simbolo(manovra: guida.tipo))
        .font(.system(size: 44, weight: .bold))
        .foregroundStyle(.tint)
        .scaleEffect(x: guida.tipo == 24 ? -1 : 1, y: 1)
      Text(metri(guida.distanza))
        .font(.system(size: 30, weight: .semibold, design: .rounded))
        .monospacedDigit()
      Text(guida.istruzione.isEmpty ? guida.strada : guida.istruzione)
        .font(.footnote)
        .multilineTextAlignment(.center)
        .lineLimit(3)
      HStack(spacing: 8) {
        if let arrivo = guida.arrivo {
          Label(arrivo.formatted(date: .omitted, time: .shortened), systemImage: "flag.checkered")
        }
        Text(metri(guida.restanti))
      }
      .font(.caption2)
      .foregroundStyle(.secondary)
      if let limite = guida.limite {
        Limite(limite: limite, velocita: guida.velocita)
      }
      Button(role: .destructive) {
        telefono.ferma()
      } label: {
        Label("Fine guida", systemImage: "xmark")
      }
      .disabled(telefono.inCorso)
      .padding(.top, 4)
    }
  }

  private var fermi: some View {
    VStack(spacing: 8) {
      if !guida.messaggio.isEmpty {
        Text(guida.messaggio)
          .font(.footnote)
          .multilineTextAlignment(.center)
          .foregroundStyle(.secondary)
      }
      Button {
        telefono.vai("casa")
      } label: {
        Label("Portami a casa", systemImage: "house.fill")
      }
      .disabled(telefono.inCorso || !guida.haCasa)
      Button {
        telefono.vai("lavoro")
      } label: {
        Label("Al lavoro", systemImage: "briefcase.fill")
      }
      .disabled(telefono.inCorso || !guida.haLavoro)
      if !guida.haCasa && !guida.haLavoro {
        Text("Imposta Casa e Lavoro nel navigatore, sul telefono.")
          .font(.caption2)
          .multilineTextAlignment(.center)
          .foregroundStyle(.secondary)
      }
    }
  }
}

/// Il cartello del limite, rosso sul bordo, e la velocita' accanto.
struct Limite: View {
  let limite: Int
  let velocita: Double?

  var body: some View {
    HStack(spacing: 8) {
      Text("\(limite)")
        .font(.system(size: 14, weight: .bold, design: .rounded))
        .frame(width: 30, height: 30)
        .background(Circle().fill(.white))
        .overlay(Circle().stroke(.red, lineWidth: 3))
        .foregroundStyle(.black)
      if let v = velocita {
        let kmh = Int(v.rounded())
        Text("\(kmh) km/h")
          .font(.caption)
          .monospacedDigit()
          .foregroundStyle(kmh > limite ? Color.red : Color.primary)
      }
    }
  }
}
