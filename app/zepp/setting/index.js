/* Le impostazioni, nell'app Zepp sul telefono: dove si scrive il codice.
 *
 * Il codice e' quello del riquadro «Abbina un telefono» nella scheda GdAHome
 * di Home Assistant, in lettere sotto il QR code: sedici fra lettere e
 * numeri, vale pochi minuti e una volta sola. Scritto qui, lo prende il
 * servizio di fianco (`app-side/index.js`) e lo cancella appena l'ha usato.
 *
 * Questa pagina le chiavi della casa non le mostra e non le tocca: legge
 * solo `stato`, la frase su com'e' andata.
 */

const AMBRA = "#f59e0b";

function leggiLoStato(memoria) {
  try {
    return JSON.parse(memoria.getItem("stato") || "{}");
  } catch (e) {
    return {};
  }
}

function sezione(titolo, dentro) {
  return Section(
    {
      style: { margin: "16px", padding: "18px", borderRadius: "18px", border: "1px solid #e2e8f0" },
    },
    [
      Text(
        {
          style: {
            color: AMBRA,
            fontWeight: "700",
            fontSize: "18px",
            letterSpacing: "1px",
            textTransform: "uppercase",
          },
        },
        titolo,
      ),
      ...dentro.filter(Boolean),
    ],
  );
}

function frase(testo, piccola = false) {
  return Text(
    {
      paragraph: true,
      style: {
        fontSize: piccola ? "12px" : "14px",
        color: "#64748b",
        lineHeight: "1.45",
        marginTop: "8px",
      },
    },
    testo,
  );
}

AppSettingsPage({
  build({ settingsStorage: memoria }) {
    const stato = leggiLoStato(memoria);
    /* Collegato e' chi ha il legame: lo scrive il servizio di fianco, e
     * qui non si legge che c'e'. */
    const collegato = Boolean(memoria.getItem("legame"));
    const vetrina = memoria.getItem("vetrina") === "si";
    /* Il telefono non ha dato numeri a caso al servizio di fianco, e la
     * chiave si e' fatta col ripiego (`app-side/caso.js`): funziona, e va
     * detto. */
    const ripiego =
      stato.caso === "ripiego"
        ? frase(
            "Questo telefono non dà numeri a caso all'app Zepp: GdAHome usa il suo ripiego, sicuro ma un po' meno.",
            true,
          )
        : null;

    const laCasa = collegato
      ? sezione("La casa", [
          frase(
            "Collegato alla casa. Questo orologio compare fra i telefoni nella console di GdAHome, in Home Assistant: da lì si stacca quando vuoi.",
          ),
          Button({
            label: "Stacca questo orologio",
            style: { marginTop: "14px", borderRadius: "24px", border: "1px solid #e2e8f0" },
            onClick: () => memoria.setItem("stacca", String(Date.now())),
          }),
          ripiego,
        ])
      : sezione("Collega la casa", [
          frase("1. In Home Assistant apri la scheda GdAHome, riquadro «Abbina un telefono»."),
          frase(
            "2. Premi «Genera QR code»: sotto il QR c'è il codice in lettere. Vale pochi minuti.",
          ),
          frase("3. Scrivilo qui sotto: l'orologio si collega da solo."),
          TextInput({
            label: "Codice di abbinamento",
            placeholder: "XXXX-XXXX-XXXX-XXXX",
            maxLength: 24,
            subStyle: {
              fontSize: "18px",
              letterSpacing: "2px",
              border: `2px solid ${AMBRA}`,
              borderRadius: "12px",
              padding: "10px",
            },
            onChange: (scritto) => memoria.setItem("codice", scritto),
          }),
          stato.testo ? frase(stato.testo) : null,
          ripiego,
          frase(
            "Il codice non resta da nessuna parte: l'orologio riceve una chiave sua, che vale solo per lui.",
            true,
          ),
        ]);

    const prova = sezione("Casa d'esempio", [
      frase("Una casa finta, per provare l'app sull'orologio senza toccare quella vera."),
      Toggle({
        label: "Mostra la casa d'esempio",
        value: vetrina,
        onChange: (acceso) => memoria.setItem("vetrina", acceso ? "si" : ""),
      }),
    ]);

    return View({ style: { padding: "4px 0 24px" } }, [laCasa, prova].filter(Boolean));
  },
});
