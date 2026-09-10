/// I marchi delle auto, e la sagoma.
///
/// «Tutta la parte icone brand con modelli auto dove sta?» Nella Config della
/// dashboard la marca non si scrive: si sceglie da una griglia di loghi, ognuno
/// col colore della sua casa. Nell'app c'erano due caselle di testo libero con
/// dentro scritto «Leapmotor» come esempio — e un esempio scritto in grigio,
/// visto di sfuggita, sembra un dato bloccato nel codice.
///
/// I file dei loghi ce li ha gia' il ponte, in `brands/`: sono gli stessi che
/// serve alla plancia. Qui c'e' l'elenco — nomi, identificativi e tinte —
/// preso da `core/personalization-catalog.js` senza reinterpretarlo, perche' un
/// colore copiato a occhio e' un colore sbagliato.
library;

import 'dart:convert';

import '../../ponte/filo.dart';
import 'lettere.dart';

/// Dove stanno i loghi, dentro i file della plancia.
const _cartellaDeiMarchi = '/dashboardmodern_static/brands';

/// Un marchio: come si chiama, come si chiama il suo file, di che colore e'.
class MarcaDellAuto {
  const MarcaDellAuto(this.id, this.nome, [this.colore = '']);

  /// `alfa-romeo`, `mercedes-benz`: e' anche il nome del file.
  final String id;

  final String nome;

  /// La tinta d'istituto, `#0066B1`. Vuota vuol dire quella del tema.
  ///
  /// I loghi erano tutti neri: su fondo scuro sparivano, e messi in fila
  /// sembravano tutti la stessa cosa.
  final String colore;

  /// Le iniziali, per quando il logo non arriva.
  String get iniziali => nome
      .split(RegExp(r'[\s-]+'))
      .map((pezzo) => pezzo.isEmpty ? '' : pezzo[0])
      .join()
      .toUpperCase();
}

/// Le trentasette marche, nell'ordine della dashboard.
const leMarcheDelleAuto = <MarcaDellAuto>[
  MarcaDellAuto('abarth', 'Abarth', '#B01B2E'),
  MarcaDellAuto('alfa-romeo', 'Alfa Romeo', '#981E32'),
  MarcaDellAuto('audi', 'Audi', '#BB0A30'),
  MarcaDellAuto('bmw', 'BMW', '#0066B1'),
  MarcaDellAuto('byd', 'BYD', '#D0021B'),
  MarcaDellAuto('citroen', 'Citroën', '#DA291C'),
  MarcaDellAuto('cupra', 'Cupra', '#95572B'),
  MarcaDellAuto('dacia', 'Dacia', '#646B52'),
  MarcaDellAuto('ds', 'DS'),
  MarcaDellAuto('fiat', 'Fiat', '#941711'),
  MarcaDellAuto('ford', 'Ford', '#00274E'),
  MarcaDellAuto('honda', 'Honda', '#E40521'),
  MarcaDellAuto('hyundai', 'Hyundai', '#002C5E'),
  MarcaDellAuto('jeep', 'Jeep'),
  MarcaDellAuto('kia', 'Kia'),
  MarcaDellAuto('lancia', 'Lancia', '#003B7A'),
  MarcaDellAuto('leapmotor', 'Leapmotor', '#0B69C7'),
  MarcaDellAuto('lexus', 'Lexus'),
  MarcaDellAuto('mazda', 'Mazda'),
  MarcaDellAuto('mercedes-benz', 'Mercedes-Benz', '#00A19B'),
  MarcaDellAuto('mg', 'MG', '#FF0000'),
  MarcaDellAuto('mini', 'MINI'),
  MarcaDellAuto('nissan', 'Nissan', '#C3002F'),
  MarcaDellAuto('opel', 'Opel', '#F7FF14'),
  MarcaDellAuto('peugeot', 'Peugeot'),
  MarcaDellAuto('polestar', 'Polestar'),
  MarcaDellAuto('porsche', 'Porsche', '#B12B28'),
  MarcaDellAuto('renault', 'Renault', '#FFCC33'),
  MarcaDellAuto('seat', 'SEAT'),
  MarcaDellAuto('skoda', 'Škoda'),
  MarcaDellAuto('smart', 'Smart', '#D7E600'),
  MarcaDellAuto('subaru', 'Subaru', '#013C74'),
  MarcaDellAuto('suzuki', 'Suzuki', '#E30613'),
  MarcaDellAuto('tesla', 'Tesla', '#CC0000'),
  MarcaDellAuto('toyota', 'Toyota', '#EB0A1E'),
  MarcaDellAuto('volkswagen', 'Volkswagen', '#151F5D'),
  MarcaDellAuto('volvo', 'Volvo', '#003057'),
  MarcaDellAuto('xpeng', 'XPeng', '#00A0E9'),
];

/// Leapmotor il suo file non ce l'ha: il marchio non sta nel pacchetto da cui
/// vengono gli altri, e nella plancia e' disegnato a mano. Stesso disegno qui,
/// tratto per tratto, se no la stessa auto avrebbe due loghi diversi.
const _leapmotorDisegnato =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" '
    'fill="currentColor">'
    '<path d="M6 16 17 10v19l6 4v9L6 32z"/>'
    '<path d="M24 5l18 10v17l-14 8V28l7-4v-6l-7-4v31l-4-2z"/>'
    '</svg>';

/// La marca che corrisponde a quello che c'e' scritto, o `null`.
///
/// Si confronta senza accenti e senza segni: chi aveva scritto «alfa romeo» a
/// mano, o «Citroen» senza la cediglia, deve ritrovare la sua.
MarcaDellAuto? marcaDaScritta(String scritto) {
  final voluta = senzaAccenti(scritto).replaceAll(RegExp(r'[^a-z0-9]+'), '');
  if (voluta.isEmpty) return null;
  for (final una in leMarcheDelleAuto) {
    if (senzaAccenti(una.id).replaceAll(RegExp(r'[^a-z0-9]+'), '') == voluta ||
        senzaAccenti(una.nome).replaceAll(RegExp(r'[^a-z0-9]+'), '') ==
            voluta) {
      return una;
    }
  }
  return null;
}

/// La sagoma dell'auto: quale disegno la rappresenta nella plancia.
class SagomaDellAuto {
  const SagomaDellAuto(this.id, this.nome, this.disegno);
  final String id;
  final String nome;

  /// L'emoji che la plancia usa quando non disegna l'icona.
  final String disegno;
}

/// Le otto sagome, quelle di `CAR_ICON_CATALOG`.
const leSagomeDellAuto = <SagomaDellAuto>[
  SagomaDellAuto('electric', 'Elettrica', '⚡'),
  SagomaDellAuto('car', 'Auto', '🚗'),
  SagomaDellAuto('sports', 'Sportiva', '🏎️'),
  SagomaDellAuto('hatchback', 'Compatta', '🚙'),
  SagomaDellAuto('estate', 'Station wagon', '🚘'),
  SagomaDellAuto('pickup', 'Pickup', '🛻'),
  SagomaDellAuto('convertible', 'Cabrio', '🏎️'),
  SagomaDellAuto('wagon', 'SUV / Wagon', '🚙'),
];

/* ─── I loghi, presi dal ponte ───────────────────────────────────────────── */

/// Quanto si aspetta un logo. Sono file da qualche riga.
const _attesaDelMarchio = Duration(seconds: 20);

/// I loghi, chiesti al ponte e tenuti da parte.
///
/// Arrivano **sul filo**, come i file della plancia: non c'e' niente da
/// scaricare da internet, e funziona uguale in casa e da fuori. Si tengono per
/// tutta la vita dell'app — sono trentasette file da poche righe, e chiederli
/// di nuovo a ogni apertura della griglia vuol dire una griglia che si
/// riempie a scatti.
class IMarchi {
  IMarchi._();

  /// Una sola per tutta l'app: la griglia si apre e si chiude, i loghi restano.
  static final IMarchi io = IMarchi._();

  final _presi = <String, String>{};
  final _inArrivo = <String, Future<String?>>{};

  /// Il disegno di un marchio, o `null` se non si riesce ad averlo.
  Future<String?> disegnoDi(String id, Filo? filo) {
    if (id == 'leapmotor') return Future.value(_leapmotorDisegnato);
    final gia = _presi[id];
    if (gia != null) return Future.value(gia);
    if (filo == null) return Future.value(null);
    return _inArrivo[id] ??= _chiedi(id, filo).whenComplete(() {
      _inArrivo.remove(id);
    });
  }

  /// Quello che si ha gia' sotto mano, per chi disegna e non puo' aspettare.
  String? gia(String id) =>
      id == 'leapmotor' ? _leapmotorDisegnato : _presi[id];

  Future<String?> _chiedi(String id, Filo filo) async {
    try {
      final testo = await filo.testoDi({
        'type': 'ponte/http',
        'metodo': 'GET',
        'percorso': '$_cartellaDeiMarchi/$id.svg',
        /* Nel browser il gzip non si apre: `dart:io` non c'e'. */
        'senzaGzip': true,
      }, entro: _attesaDelMarchio);
      final letto = jsonDecode(testo);
      final risposta = letto is Map ? letto['result'] : null;
      if (risposta is! Map || risposta['stato'] != 200) return null;
      final corpo = risposta['corpo'];
      if (corpo is! String) return null;
      final disegno = utf8.decode(base64.decode(corpo), allowMalformed: true);
      _presi[id] = disegno;
      return disegno;
    } on Object {
      /* Un logo che non arriva lascia le iniziali: chi sta scegliendo la
       * marca la trova lo stesso, e non c'e' niente da spiegargli. */
      return null;
    }
  }
}
