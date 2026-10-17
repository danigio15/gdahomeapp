/// Da quello che arriva da Firebase a una notifica da mostrare.
///
/// Firebase consegna tre campi: `g` (il formato), `d` (il telefono, cioe'
/// quale casa: il `dm_…` con cui questo telefono si chiama per lei) e `b`, la
/// busta chiusa. Qui si trova la casa, si apre la busta con la sua chiave, si
/// controlla che la notifica non sia gia' stata vista, e si decide come
/// mostrarla: su quale canale, con quali tasti.
///
/// Niente Flutter e niente Firebase qui dentro: e' la parte che si prova, e
/// gira uguale nell'app aperta e nel servizio che Android sveglia ad app
/// chiusa.
library;

import 'dart:convert';

import '../casa/casa_conosciuta.dart';
import 'busta.dart';
import 'modello.dart';
import 'notifiche.dart';

/// I tre canali di Android. Il nome resta per sempre: Android ricorda le
/// scelte di chi le ha cambiate nelle impostazioni del sistema, per nome.
enum CanaleDelleNotifiche {
  /// Antifurto, allagamento, campanello: suona, e passa davanti a tutto.
  urgenti('gdahome_urgenti'),

  /// Tutto il resto di tutti i giorni.
  normali('gdahome_normali'),

  /// Il riepilogo della sera, e l'assistente: senza suono.
  manutenzione('gdahome_manutenzione');

  const CanaleDelleNotifiche(this.id);
  final String id;
}

CanaleDelleNotifiche canaleDi(NotificaArrivata notifica) {
  if (notifica.urgente) return CanaleDelleNotifiche.urgenti;
  if (notifica.categoria == 'manutenzione' || notifica.urgenza == 'bassa') {
    return CanaleDelleNotifiche.manutenzione;
  }
  return CanaleDelleNotifiche.normali;
}

/// Una notifica aperta, con la casa da cui viene.
class NotificaDaMostrare {
  const NotificaDaMostrare({
    required this.casa,
    required this.notifica,
    required this.grezza,
    this.scaduta = false,
  });

  final CasaConosciuta casa;
  final NotificaArrivata notifica;

  /// Com'era dentro la busta: va nel `payload` della notifica locale, che
  /// resta sul telefono, cosi' al tocco si sa tutto senza riaprire niente.
  final Map<String, dynamic> grezza;

  /// Arrivata tardi: si mostra, ma senza tasti — la casa non li eseguirebbe.
  final bool scaduta;

  CanaleDelleNotifiche get canale => canaleDi(notifica);

  /// I tasti da mettere sotto. Su una scaduta nessuno.
  List<TastoDellaNotifica> get tasti => scaduta ? const [] : notifica.tasti;

  /// Quello che la notifica locale si porta dietro, per il tocco.
  String get daPortare => jsonEncode({'casa': casa.id, 'notifica': grezza});

  /// Un numero per Android: lo stesso per la stessa notifica, cosi' una
  /// consegna doppia non fa due righe.
  int get numero => notifica.id.hashCode & 0x7fffffff;
}

/// Il tocco su una notifica, riletto da quello che si portava dietro.
class ToccoDellaNotifica {
  const ToccoDellaNotifica({
    required this.casa,
    required this.notifica,
    this.tasto,
  });

  final String casa;
  final NotificaArrivata notifica;

  /// Il tasto premuto, o `null` per un tocco sulla notifica.
  final String? tasto;

  static ToccoDellaNotifica? daPortato(String? portato, {String? tasto}) {
    if (portato == null || portato.isEmpty) return null;
    try {
      final letto = jsonDecode(portato);
      if (letto is! Map) return null;
      final casa = letto['casa'];
      final grezza = letto['notifica'];
      if (casa is! String || grezza is! Map<String, dynamic>) return null;
      final notifica = NotificaArrivata.leggi(grezza);
      if (notifica == null) return null;
      return ToccoDellaNotifica(
        casa: casa,
        notifica: notifica,
        tasto: tasto == null || tasto.isEmpty ? null : tasto,
      );
    } catch (_) {
      return null;
    }
  }
}

/// Se questi dati vengono da una casa di gdahome.
bool eUnaNostraSpinta(Map<String, dynamic> dati) =>
    dati['g'] == '1' && dati['d'] is String && dati['b'] is String;

/// Se la spinta e' per un abbinamento che questo telefono ha ancora.
///
/// Una casa tolta dall'app puo' continuare a scrivere finche' non sa di essere
/// stata tolta (`Collegamento.dimentica` glielo dice, quando la raggiunge):
/// la sua busta non si apre, e mostrarne la frase di riserva vorrebbe dire
/// notificare una casa che qui non c'e' piu'. Per una casa che c'e' — con una
/// busta che non si apre, una chiave cambiata — la frase di riserva resta.
bool eDiUnaCasaConosciuta(
  Map<String, dynamic> dati,
  Iterable<CasaConosciuta> case_,
) {
  if (!eUnaNostraSpinta(dati)) return false;
  final telefono = dati['d'] as String;
  return case_.any((una) => una.identificativo == telefono);
}

/// Apre quello che e' arrivato. `null` se non e' nostro, se non c'e' la casa,
/// se la busta non si apre, o se l'abbiamo gia' vista.
Future<NotificaDaMostrare?> apriQuellaArrivata(
  Map<String, dynamic> dati,
  Iterable<CasaConosciuta> case_, {
  NotificheViste? viste,
  DateTime? adesso,
}) async {
  if (!eUnaNostraSpinta(dati)) return null;
  final telefono = dati['d'] as String;
  CasaConosciuta? casa;
  for (final una in case_) {
    if (una.identificativo == telefono && una.chiave != null) casa = una;
  }
  if (casa == null) return null;
  final Map<String, dynamic> grezza;
  try {
    grezza = await apriLaSpinta(
      chiaveDelFilo: casa.chiave!,
      telefono: telefono,
      busta: dati['b'] as String,
    );
  } on SpintaGuasta {
    return null;
  }
  final notifica = NotificaArrivata.leggi(grezza);
  if (notifica == null) return null;
  if (viste != null && !await viste.segna(notifica.id)) return null;
  return NotificaDaMostrare(
    casa: casa,
    notifica: notifica,
    grezza: grezza,
    scaduta: !notifica.valeAncora(adesso ?? DateTime.now()),
  );
}
