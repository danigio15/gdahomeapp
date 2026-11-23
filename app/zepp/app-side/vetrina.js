/* La vetrina: una casa d'esempio, come `Vetrina.kt` e `Vetrina.swift` per
 * gli altri orologi. Serve alle schermate dello store Zepp e a provare
 * l'app nel simulatore, dove una casa vera non c'e'. I tocchi cambiano la
 * casa finta, e la casa vera non la sente nessuno.
 *
 * Nomi generici apposta: nessuna casa di nessuno.
 */

function laCasaDiPartenza() {
  return {
    v: 1,
    premium: true,
    casa: "Casa",
    quando: 0,
    dispositivi: [
      {
        id: "d1",
        nome: "Faretti soggiorno",
        genere: "luce",
        stato: "Accesa",
        acceso: true,
        luminosita: 75,
      },
      {
        id: "d2",
        nome: "Lampada lettura",
        genere: "luce",
        stato: "Accesa",
        acceso: true,
        luminosita: 40,
      },
      { id: "d3", nome: "Cucina", genere: "luce", stato: "Spenta", acceso: false, luminosita: 100 },
      { id: "d4", nome: "Corridoio", genere: "luce", stato: "Accesa", acceso: true },
      { id: "d5", nome: "Camera", genere: "luce", stato: "Spenta", acceso: false, luminosita: 60 },
      { id: "d6", nome: "Giardino", genere: "luce", stato: "Spenta", acceso: false },
      { id: "d7", nome: "Cancello", genere: "varco", stato: "Chiuso", acceso: false },
      { id: "d8", nome: "Garage", genere: "varco", stato: "Chiuso", acceso: false },
    ],
    azioni: [
      { id: "a1", nome: "Buonanotte", subito: true },
      { id: "a2", nome: "Esco di casa", subito: true },
      { id: "a3", nome: "Arrivo a casa", subito: true },
      { id: "a4", nome: "Cinema", subito: true },
      { id: "a5", nome: "Irrigazione", subito: false },
    ],
    misure: [
      { nome: "Produzione", valore: "3,2 kW" },
      { nome: "Consumo", valore: "1,1 kW" },
      { nome: "Batteria", valore: "86 %" },
    ],
  };
}

const OPPOSTA = { Accesa: "Spenta", Spenta: "Accesa", Aperto: "Chiuso", Chiuso: "Aperto" };

let casa = null;

export function laFotoDellaVetrina() {
  if (!casa) casa = laCasaDiPartenza();
  casa.quando = Date.now();
  return casa;
}

export function comandoNellaVetrina({ id, cosa, valore }) {
  const foto = laFotoDellaVetrina();
  if (cosa === "azione") {
    const a = foto.azioni.find((x) => x.id === id);
    if (!a) return { ok: false, testo: "Azione sconosciuta" };
    return { ok: true, testo: "Fatto" };
  }
  const d = foto.dispositivi.find((x) => x.id === id);
  if (!d) return { ok: false, testo: "Dispositivo sconosciuto" };
  if (cosa === "luminosita" && d.luminosita != null) {
    d.luminosita = Math.max(1, Math.min(100, Math.round(Number(valore) || 0)));
    d.acceso = true;
    d.stato = "Accesa";
  } else {
    d.acceso = !d.acceso;
    d.stato = OPPOSTA[d.stato] || d.stato;
  }
  return { ok: true, testo: "Fatto", foto };
}
