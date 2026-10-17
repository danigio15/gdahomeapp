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

/* ─── Il modello ──────────────────────────────────────────────────────────
 *
 * «Si aggiungi anche il modello del telefono, aggiungerei anche il nome di
 * chi e' il telefono.» Due righe «Telefono Android» della stessa persona — il
 * telefono e il tablet — non si distinguevano, e per sapere quale togliere si
 * andava a tentativi. Adesso la casa le chiama «Galaxy S24 Ultra di …» e
 * «Galaxy Tab S9 di …»: il modello lo dice l'app, il «di chi» lo sa la casa.
 *
 * Il modello e' quello in vendita, non il codice di fabbrica: l'iPhone dice
 * «iPhone16,1» e Samsung «SM-S928B», che non dicono niente a nessuno. Le
 * tabelle qui sotto li traducono per i piu' diffusi; uno che non c'e' resta
 * col suo codice, che e' comunque meglio di «Telefono Android».
 *
 * Mai il nome che il telefono ha avuto dal suo padrone («Il telefono di …»):
 * quello e' una cosa sua, e non si legge. */

/// Marca, modello e versione del sistema di questo dispositivo.
class IlModello {
  const IlModello({
    required this.marca,
    required this.modello,
    this.versione = '',
  });

  /// «Samsung», «Apple», «Google».
  final String marca;

  /// «Galaxy S24 Ultra», «iPhone 15 Pro».
  final String modello;

  /// La versione del sistema: «15» per Android, «18.1» per iOS.
  final String versione;

  /// Quello che va alla casa: solo i campi che ci sono.
  Map<String, String> perLaCasa() => {
    if (marca.isNotEmpty) 'marca': marca,
    if (modello.isNotEmpty) 'modello': modello,
    if (versione.isNotEmpty) 'versione': versione,
  };
}

/// Gli iPhone e gli iPad dal loro codice (`utsname.machine`).
const _iPhone = {
  'iPhone12,1': 'iPhone 11',
  'iPhone12,3': 'iPhone 11 Pro',
  'iPhone12,5': 'iPhone 11 Pro Max',
  'iPhone12,8': 'iPhone SE',
  'iPhone13,1': 'iPhone 12 mini',
  'iPhone13,2': 'iPhone 12',
  'iPhone13,3': 'iPhone 12 Pro',
  'iPhone13,4': 'iPhone 12 Pro Max',
  'iPhone14,4': 'iPhone 13 mini',
  'iPhone14,5': 'iPhone 13',
  'iPhone14,2': 'iPhone 13 Pro',
  'iPhone14,3': 'iPhone 13 Pro Max',
  'iPhone14,6': 'iPhone SE',
  'iPhone14,7': 'iPhone 14',
  'iPhone14,8': 'iPhone 14 Plus',
  'iPhone15,2': 'iPhone 14 Pro',
  'iPhone15,3': 'iPhone 14 Pro Max',
  'iPhone15,4': 'iPhone 15',
  'iPhone15,5': 'iPhone 15 Plus',
  'iPhone16,1': 'iPhone 15 Pro',
  'iPhone16,2': 'iPhone 15 Pro Max',
  'iPhone17,3': 'iPhone 16',
  'iPhone17,4': 'iPhone 16 Plus',
  'iPhone17,1': 'iPhone 16 Pro',
  'iPhone17,2': 'iPhone 16 Pro Max',
  'iPhone17,5': 'iPhone 16e',
  'iPhone18,3': 'iPhone 17',
  'iPhone18,1': 'iPhone 17 Pro',
  'iPhone18,2': 'iPhone 17 Pro Max',
  'iPhone18,4': 'iPhone Air',
  'iPad13,18': 'iPad',
  'iPad13,19': 'iPad',
  'iPad15,7': 'iPad',
  'iPad15,8': 'iPad',
  'iPad14,1': 'iPad mini',
  'iPad14,2': 'iPad mini',
  'iPad16,1': 'iPad mini',
  'iPad16,2': 'iPad mini',
  'iPad13,16': 'iPad Air',
  'iPad13,17': 'iPad Air',
  'iPad14,8': 'iPad Air 11"',
  'iPad14,9': 'iPad Air 11"',
  'iPad14,10': 'iPad Air 13"',
  'iPad14,11': 'iPad Air 13"',
  'iPad15,3': 'iPad Air 11"',
  'iPad15,4': 'iPad Air 11"',
  'iPad15,5': 'iPad Air 13"',
  'iPad15,6': 'iPad Air 13"',
  'iPad16,3': 'iPad Pro 11"',
  'iPad16,4': 'iPad Pro 11"',
  'iPad16,5': 'iPad Pro 13"',
  'iPad16,6': 'iPad Pro 13"',
};

/// Il nome in vendita di un iPhone o di un iPad dal suo codice. Uno che non
/// si conosce dice almeno che cos'e'.
String nomeDellIPhone(String codice) {
  final detto = codice.trim();
  final noto = _iPhone[detto];
  if (noto != null) return noto;
  if (detto.startsWith('iPad')) return 'iPad';
  if (detto.startsWith('iPod')) return 'iPod touch';
  return 'iPhone';
}

/// I Samsung piu' diffusi dal codice di fabbrica, senza la lettera del paese
/// (`SM-S928B` e `SM-S928U` sono lo stesso telefono).
const _samsung = {
  'SM-S921': 'Galaxy S24',
  'SM-S926': 'Galaxy S24+',
  'SM-S928': 'Galaxy S24 Ultra',
  'SM-S721': 'Galaxy S24 FE',
  'SM-S931': 'Galaxy S25',
  'SM-S936': 'Galaxy S25+',
  'SM-S938': 'Galaxy S25 Ultra',
  'SM-S937': 'Galaxy S25 Edge',
  'SM-S911': 'Galaxy S23',
  'SM-S916': 'Galaxy S23+',
  'SM-S918': 'Galaxy S23 Ultra',
  'SM-S711': 'Galaxy S23 FE',
  'SM-S901': 'Galaxy S22',
  'SM-S906': 'Galaxy S22+',
  'SM-S908': 'Galaxy S22 Ultra',
  'SM-F956': 'Galaxy Z Fold6',
  'SM-F966': 'Galaxy Z Fold7',
  'SM-F946': 'Galaxy Z Fold5',
  'SM-F741': 'Galaxy Z Flip6',
  'SM-F766': 'Galaxy Z Flip7',
  'SM-F731': 'Galaxy Z Flip5',
  'SM-A566': 'Galaxy A56',
  'SM-A556': 'Galaxy A55',
  'SM-A546': 'Galaxy A54',
  'SM-A366': 'Galaxy A36',
  'SM-A356': 'Galaxy A35',
  'SM-A346': 'Galaxy A34',
  'SM-A266': 'Galaxy A26',
  'SM-A256': 'Galaxy A25',
  'SM-A166': 'Galaxy A16',
  'SM-A165': 'Galaxy A16',
  'SM-A155': 'Galaxy A15',
  'SM-X710': 'Galaxy Tab S9',
  'SM-X716': 'Galaxy Tab S9',
  'SM-X810': 'Galaxy Tab S9+',
  'SM-X910': 'Galaxy Tab S9 Ultra',
  'SM-X820': 'Galaxy Tab S10+',
  'SM-X920': 'Galaxy Tab S10 Ultra',
  'SM-X510': 'Galaxy Tab S9 FE',
  'SM-X610': 'Galaxy Tab S9 FE+',
  'SM-X210': 'Galaxy Tab A9+',
  'SM-X110': 'Galaxy Tab A9',
};

/// Le marche come si scrivono, quando il telefono le scrive in minuscolo.
const _marche = {
  'samsung': 'Samsung',
  'google': 'Google',
  'xiaomi': 'Xiaomi',
  'redmi': 'Xiaomi',
  'poco': 'Xiaomi',
  'oneplus': 'OnePlus',
  'oppo': 'OPPO',
  'realme': 'realme',
  'motorola': 'Motorola',
  'huawei': 'Huawei',
  'honor': 'HONOR',
  'nothing': 'Nothing',
  'sony': 'Sony',
  'nokia': 'Nokia',
  'hmd global': 'Nokia',
  'vivo': 'vivo',
  'asus': 'ASUS',
  'lenovo': 'Lenovo',
  'fairphone': 'Fairphone',
};

/// La marca come la scriverebbe una persona.
String marcaLeggibile(String detta) {
  final pulita = detta.trim();
  if (pulita.isEmpty) return '';
  final nota = _marche[pulita.toLowerCase()];
  if (nota != null) return nota;
  return pulita[0].toUpperCase() + pulita.substring(1);
}

/// Il modello di un telefono Android come lo si vende.
///
/// Samsung scrive il codice di fabbrica (`SM-S928B`), e qui si traduce per i
/// piu' diffusi; Google e quasi tutti gli altri scrivono gia' il nome
/// («Pixel 8 Pro»). Se il modello comincia con la marca («Xiaomi 14») la
/// marca non si ripete.
IlModello modelloDaAndroid({
  required String produttore,
  required String modello,
  String versione = '',
}) {
  final marca = marcaLeggibile(produttore);
  var nome = modello.trim();
  final codice = RegExp(r'^(SM-[A-Z]\d{3})[A-Z0-9]*$').firstMatch(nome);
  if (codice != null) nome = _samsung[codice.group(1)] ?? nome;
  if (marca.isNotEmpty &&
      nome.toLowerCase().startsWith('${marca.toLowerCase()} ')) {
    nome = nome.substring(marca.length + 1).trim();
  }
  return IlModello(marca: marca, modello: nome, versione: versione.trim());
}

/// Il modello di un iPhone o di un iPad dal suo codice.
IlModello modelloDaIos({required String codice, String versione = ''}) =>
    IlModello(
      marca: 'Apple',
      modello: nomeDellIPhone(codice),
      versione: versione.trim(),
    );

/// Il nome scritto alla domanda «Di chi e' questo telefono?», ripulito: una
/// riga, senza caratteri di controllo, al piu' 30 caratteri. Vuoto vuol dire
/// che non l'ha detto.
String proprietarioPulito(String scritto) {
  final pulito = scritto
      .replaceAll(RegExp(r'[\u0000-\u001f\u007f]'), '')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  return pulito.length <= 30 ? pulito : pulito.substring(0, 30).trim();
}

/// Come chiamare questo telefono quando ci si abbina: il modello, se si sa;
/// altrimenti come prima.
String nomeConIlModello(IlModello? modello, String ripiego) {
  final detto = modello?.modello.trim() ?? '';
  return detto.isEmpty ? ripiego : detto;
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
