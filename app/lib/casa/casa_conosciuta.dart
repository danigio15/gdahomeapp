/// Una casa che l'app conosce.
///
/// «Casa» qui vuol dire una istanza di Home Assistant col suo ponte davanti:
/// la propria, quella dei genitori, quella al mare. L'app ne tiene piu' di una
/// e si passa dall'una all'altra senza riabbinare niente, perche' ognuna ha il
/// suo segno.
///
/// **Tre strade, una casa sola.** E' il punto di questa classe. La stessa
/// istanza si raggiunge in un modo quando si e' dentro casa — l'indirizzo di
/// rete locale, veloce e che non esce da li' — e in un altro quando si e'
/// fuori: dal centralino, dove la casa ha chiamato e sta in attesa. In mezzo
/// c'e' la terza, l'indirizzo pubblico di chi se l'e' messo a mano. Non sono
/// tre case: e' la stessa, vista da tre parti. Chi usa l'app non lo deve
/// sapere e non deve toccare niente quando esce dal portone.
///
/// Quello che c'e' scritto qui dentro l'utente non l'ha battuto: gli
/// indirizzi, l'identificativo e il centralino arrivano tutti dalla casa
/// stessa, nella risposta all'abbinamento. Lui ha battuto otto lettere.
library;

import '../ponte/indirizzo.dart';

export '../ponte/indirizzo.dart' show DaDove;

class CasaConosciuta {
  const CasaConosciuta({
    required this.id,
    required this.nome,
    required this.segno,
    this.identificativo,
    this.chiave,
    this.casaAlCentralino,
    this.centralino,
    this.inCasa,
    this.daFuoriCasa,
    this.ultimoApprodo,
  });

  /// Identificativo interno dell'app, mai mostrato. Non e' quello del ponte.
  final String id;

  /// Come la chiama l'utente: «Casa», «Dai miei», «Al mare».
  final String nome;

  /// Il segno del ponte: fa entrare. Non esce mai da qui verso lo schermo o il
  /// registro.
  final String segno;

  /// Come questo telefono si chiama per il ponte — `dm_…`.
  ///
  /// Non e' un segreto: viaggia in chiaro nella prima riga della stretta di
  /// mano, e serve alla casa per sapere quale chiave del filo tirare fuori.
  final String? identificativo;

  /// La chiave del filo: cifra. E' l'altra meta' di quello che si riceve
  /// abbinandosi, e al centralino non e' mai passata.
  final String? chiave;

  /// Come questa casa si chiama al centralino — `casa_…`. Non e' un segreto:
  /// serve a instradare.
  final String? casaAlCentralino;

  /// Il centralino a cui questa casa chiama.
  final IndirizzoDelCentralino? centralino;

  /// L'indirizzo che funziona quando si e' dentro casa.
  final IndirizzoDelPonte? inCasa;

  /// L'indirizzo che funziona da fuori senza passare dal centralino: un
  /// dominio con un proxy davanti, o l'indirizzo dentro una VPN. Quasi nessuno
  /// ce l'ha, ed e' giusto cosi': averlo vuol dire aver configurato qualcosa.
  final IndirizzoDelPonte? daFuoriCasa;

  /// Da dove si e' entrati l'ultima volta. Si prova prima quello: nove volte
  /// su dieci il telefono e' dove era ieri.
  final DaDove? ultimoApprodo;

  /// `true` quando questa casa e' stata abbinata prima che esistessero le
  /// chiavi, e adesso non basta piu'.
  ///
  /// Non si butta via e non si nasconde: si dice. Buttarla via vorrebbe dire
  /// far sparire una casa dall'elenco senza spiegazioni; nasconderlo vorrebbe
  /// dire una rotella che gira per sempre.
  bool get daRiabbinare =>
      identificativo == null ||
      identificativo!.isEmpty ||
      chiave == null ||
      chiave!.isEmpty;

  /// Gli approdi di questa casa, nell'ordine in cui conviene provarli.
  ///
  /// L'ultimo che ha funzionato per primo. Non e' un'ottimizzazione da poco:
  /// provare per primo un indirizzo di rete locale mentre si e' fuori vuol
  /// dire aspettare che scada un tentativo verso un indirizzo che non esiste,
  /// e succede a ogni apertura dell'app.
  List<Approdo> approdi() {
    final tutti = <Approdo>[
      if (inCasa != null) Approdo.diretto(DaDove.daDentro, inCasa!),
      if (daFuoriCasa != null) Approdo.diretto(DaDove.daFuori, daFuoriCasa!),
      if (centralino != null && (casaAlCentralino?.isNotEmpty ?? false))
        Approdo.dalCentralino(centralino!, casaAlCentralino!),
    ];
    if (ultimoApprodo == null || tutti.length < 2) return tutti;
    tutti.sort((uno, altro) {
      if (uno.da == ultimoApprodo) return -1;
      if (altro.da == ultimoApprodo) return 1;
      return 0;
    });
    return tutti;
  }

  bool get raggiungibile => approdi().isNotEmpty;

  /// Una casa che si raggiunge **solo** sotto il proprio Wi-Fi.
  ///
  /// Adesso vuol dire una cosa sola: il ponte non ha nessun centralino
  /// configurato. E' una cosa che vale la pena dire a chi la sta aggiungendo,
  /// invece di lasciargliela scoprire in stazione.
  bool get soloInCasa =>
      inCasa != null && daFuoriCasa == null && centralino == null;

  CasaConosciuta con({
    String? nome,
    String? segno,
    String? identificativo,
    String? chiave,
    String? casaAlCentralino,
    IndirizzoDelCentralino? centralino,
    IndirizzoDelPonte? inCasa,
    IndirizzoDelPonte? daFuoriCasa,
    DaDove? ultimoApprodo,
    bool togliInCasa = false,
    bool togliDaFuori = false,
  }) => CasaConosciuta(
    id: id,
    nome: nome ?? this.nome,
    segno: segno ?? this.segno,
    identificativo: identificativo ?? this.identificativo,
    chiave: chiave ?? this.chiave,
    casaAlCentralino: casaAlCentralino ?? this.casaAlCentralino,
    centralino: centralino ?? this.centralino,
    inCasa: togliInCasa ? null : (inCasa ?? this.inCasa),
    daFuoriCasa: togliDaFuori ? null : (daFuoriCasa ?? this.daFuoriCasa),
    ultimoApprodo: ultimoApprodo ?? this.ultimoApprodo,
  );

  Map<String, dynamic> inJson() => {
    'id': id,
    'nome': nome,
    'segno': segno,
    if (identificativo != null) 'identificativo': identificativo,
    if (chiave != null) 'chiave': chiave,
    if (casaAlCentralino != null) 'casa_al_centralino': casaAlCentralino,
    if (centralino != null) 'centralino': centralino.toString(),
    if (inCasa != null) 'in_casa': inCasa.toString(),
    if (daFuoriCasa != null) 'da_fuori': daFuoriCasa.toString(),
    if (ultimoApprodo != null) 'ultimo_approdo': ultimoApprodo!.name,
  };

  /// Torna `null` quando quello che c'e' scritto non e' una casa: un archivio
  /// rovinato non deve impedire all'app di aprirsi con le altre.
  static CasaConosciuta? daJson(Object? grezza) {
    if (grezza is! Map) return null;
    final id = grezza['id'];
    final nome = grezza['nome'];
    final segno = grezza['segno'];
    if (id is! String || nome is! String || segno is! String) return null;
    if (id.isEmpty || segno.isEmpty) return null;
    return CasaConosciuta(
      id: id,
      nome: nome,
      segno: segno,
      identificativo: grezza['identificativo'] as String?,
      chiave: grezza['chiave'] as String?,
      casaAlCentralino: grezza['casa_al_centralino'] as String?,
      centralino: IndirizzoDelCentralino.leggi(grezza['centralino'] as String?),
      inCasa: IndirizzoDelPonte.leggi(grezza['in_casa'] as String? ?? ''),
      daFuoriCasa: IndirizzoDelPonte.leggi(grezza['da_fuori'] as String? ?? ''),
      ultimoApprodo: switch (grezza['ultimo_approdo']) {
        'daDentro' => DaDove.daDentro,
        'daFuori' => DaDove.daFuori,
        'dalCentralino' => DaDove.dalCentralino,
        _ => null,
      },
    );
  }

  /* Ne' il segno ne' la chiave compaiono: `toString` finisce nei registri e
   * nelle segnalazioni di errore, e li' non ci vanno. */
  @override
  String toString() =>
      'CasaConosciuta($nome, in casa: $inCasa, da fuori: $daFuoriCasa, '
      'centralino: $centralino)';
}
