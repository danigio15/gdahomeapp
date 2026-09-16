/// La pagina che il riquadro mostra quando la plancia non arriva.
///
/// Prima era una riga di testo semplice — `text/plain`, e dentro un riquadro a
/// tutto schermo diventava una scritta a monospazio incollata in cima, sotto
/// l'orologio del telefono, che non si leggeva. Una pagina che dice una cosa
/// spiacevole deve almeno lasciarsi leggere.
///
/// Non e' la schermata dell'app: quella c'e' e viene prima (vedi
/// `schermate/plancia_vera.dart`). Questa e' la rete sotto, e si vede in un
/// caso solo — un'app di ieri con un add-on di oggi — che e' esattamente il
/// caso in cui nessuno puo' fare niente per renderla piu' bella.
library;

/// Il fondo e i colori sono quelli della plancia: chi la guarda non deve
/// avere l'impressione di essere finito in un'altra applicazione.
String paginaDelNo({
  required String titolo,
  required String sotto,
  double dallAlto = 0,
}) {
  final aria = dallAlto > 0 ? dallAlto.round() : 24;
  return '''<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${_alSicuro(titolo)}</title>
<style>
  html, body { margin: 0; height: 100%; }
  body {
    background: #101418;
    color: #dfe6ec;
    font: 16px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: ${aria}px 24px 24px;
    box-sizing: border-box;
    -webkit-text-size-adjust: 100%;
  }
  .foglio { max-width: 30rem; text-align: center; }
  .segno {
    width: 44px; height: 44px; margin: 0 auto 18px;
    border-radius: 14px; background: #1b2128;
    display: flex; align-items: center; justify-content: center;
  }
  .segno svg { width: 22px; height: 22px; stroke: #8fa3b4; fill: none; stroke-width: 1.8; }
  h1 { margin: 0 0 10px; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
  p { margin: 0; color: #9fb0be; }
</style>
</head>
<body>
  <div class="foglio">
    <div class="segno">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="10" width="16" height="10" rx="2.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    </div>
    <h1>${_alSicuro(titolo)}</h1>
    <p>${_alSicuro(sotto)}</p>
  </div>
</body>
</html>
''';
}

/// Il titolo e la spiegazione arrivano da fuori — il secondo lo scrive il
/// ponte — e in una pagina si scrivono come testo, non come pezzi di pagina.
String _alSicuro(String detto) => detto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
