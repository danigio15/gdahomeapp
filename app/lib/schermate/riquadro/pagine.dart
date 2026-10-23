/// Le pagine della plancia che l'app apre a schermo pieno dal suo menu.
///
/// Sono pagine della plancia, con la sua faccia, e non schermate dell'app:
/// le Automazioni, i Dispositivi (con le integrazioni) e gli Aiutanti. Ognuna
/// ha due maniglie, che le mette la plancia stessa (`automazioni-section.js`,
/// `dispositivi-app-section.js`, `aiutanti-app-section.js`): una per aprirla e
/// una per tornare dov'era. Nel browser la plancia sta in un riquadro di
/// un'altra origine, e allora si bussa col messaggio che ha lo stesso nome.
library;

enum PaginaDellaPlancia {
  automazioni(
    apri: 'gdahomeApriLeAutomazioni',
    bussaPerAprire: 'apri-le-automazioni',
    torna: 'gdahomeTornaDalleAutomazioni',
    bussaPerTornare: 'torna-dalle-automazioni',
  ),
  dispositivi(
    apri: 'gdahomeApriIDispositivi',
    bussaPerAprire: 'apri-i-dispositivi',
    torna: 'gdahomeTornaDaiDispositivi',
    bussaPerTornare: 'torna-dai-dispositivi',
  ),
  aiutanti(
    apri: 'gdahomeApriGliAiutanti',
    bussaPerAprire: 'apri-gli-aiutanti',
    torna: 'gdahomeTornaDagliAiutanti',
    bussaPerTornare: 'torna-dagli-aiutanti',
  );

  const PaginaDellaPlancia({
    required this.apri,
    required this.bussaPerAprire,
    required this.torna,
    required this.bussaPerTornare,
  });

  /// La maniglia che la apre, su `window`.
  final String apri;

  /// Il messaggio che la apre da fuori del riquadro.
  final String bussaPerAprire;

  /// La maniglia che torna dov'era la plancia.
  final String torna;

  /// Il messaggio che torna, da fuori del riquadro.
  final String bussaPerTornare;

  /// La pagina che la plancia dice di mostrare (`diciAllApp`), se e' una di
  /// queste.
  static PaginaDellaPlancia? daDove(String pagina) {
    for (final una in values) {
      if (una.name == pagina) return una;
    }
    return null;
  }
}
