/// Come si chiama questo dispositivo, e cos'e'.
///
/// Serve una volta sola, quando si abbina: il nome e il sistema finiscono
/// nell'elenco «Telefoni abbinati» della console, e sono l'unica cosa che
/// distingue una riga dall'altra. Finche' erano `localhost` e `sconosciuto`,
/// quattro abbinamenti della stessa persona — l'app, e il browser tre volte —
/// erano quattro righe identiche, e per capire quale togliere si andava a
/// tentativi.
///
/// Le due funzioni che lo indovinano stanno qui, separate da chi le chiama,
/// per una ragione sola: cosi' si possono provare. Quello che deve girare
/// **dove** gira sta in `questo_qui/`.
library;

/// Il nome e il sistema di questo dispositivo.
class QuestoDispositivo {
  const QuestoDispositivo({required this.nome, required this.sistema});

  /// Come si chiama, per chi guarda l'elenco.
  final String nome;

  /// Cos'e': `android`, `ios`, `web`. Chi non lo sa dice `sconosciuto`.
  final String sistema;
}

/// I nomi che un telefono si da' da se' e che non vogliono dire niente.
///
/// Android risponde **`localhost`** a chi gli chiede come si chiama: non e' un
/// difetto nostro, e' quello che risponde. Chiamare «localhost» il telefono di
/// qualcuno e' peggio che non dargli un nome, perche' sembra un nome.
const _nomiChePerNonDicono = {
  'localhost',
  'localhost.localdomain',
  'android',
  'unknown',
  'ignoto',
};

/// Come chiamare un telefono, dato quello che il telefono dice di se'.
String nomeDelTelefono({required String detto, required String sistema}) {
  final pulito = detto.trim();
  final vuoto =
      pulito.isEmpty || _nomiChePerNonDicono.contains(pulito.toLowerCase());
  if (!vuoto) return pulito;
  return switch (sistema) {
    'android' => 'Telefono Android',
    'ios' => 'iPhone',
    _ => 'Telefono',
  };
}

/// Che browser e' e su cosa gira, dal biglietto da visita che manda.
///
/// Non e' una scienza — quella riga la scrivono i browser come vogliono, e da
/// vent'anni ci si copiano a vicenda per non farsi rifiutare dai siti — ma per
/// dire «Safari su Mac» invece di «sconosciuto» basta e avanza. L'ordine non e'
/// casuale: Chrome nel suo biglietto scrive anche «Safari», Edge scrive anche
/// «Chrome», e chi guarda la prima parola che trova sbaglia tutti e due.
String nomeDalBrowser(String agente) {
  final detto = agente.trim();
  if (detto.isEmpty) return 'Browser';
  bool cE(String che) => detto.toLowerCase().contains(che.toLowerCase());

  final quale = switch (detto) {
    _ when cE('Edg/') || cE('EdgiOS') => 'Edge',
    _ when cE('OPR/') || cE('Opera') => 'Opera',
    _ when cE('SamsungBrowser') => 'Samsung Internet',
    _ when cE('Firefox/') || cE('FxiOS') => 'Firefox',
    _ when cE('CriOS') || cE('Chrome/') || cE('Chromium') => 'Chrome',
    _ when cE('Safari/') => 'Safari',
    _ => 'Browser',
  };

  final dove = switch (detto) {
    _ when cE('iPhone') => 'iPhone',
    _ when cE('iPad') => 'iPad',
    _ when cE('Android') => 'Android',
    _ when cE('Macintosh') || cE('Mac OS X') => 'Mac',
    _ when cE('Windows') => 'Windows',
    _ when cE('CrOS') => 'ChromeOS',
    _ when cE('Linux') || cE('X11') => 'Linux',
    _ => '',
  };

  return dove.isEmpty ? quale : '$quale su $dove';
}
