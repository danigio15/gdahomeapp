/// «Di chi e' questo telefono?»
///
/// «Aggiungerei anche il nome di chi e' il telefono.» Fra i «Telefoni
/// abbinati» della casa le righe si chiamavano tutte «Telefono Android», e
/// quelle della stessa persona — il telefono e il tablet — non si
/// distinguevano. Adesso la casa le chiama col modello e col nome scritto qui:
/// «Galaxy S24 Ultra di …». Non e' l'utente di Home Assistant: e' il nome che
/// sceglie chi ha il telefono in mano, e puo' anche non dirlo.
///
/// Si chiede nell'abbinamento ([CampoDelProprietario]) e, a chi si era
/// abbinato prima, una volta alla prima connessione ([chiediDiChiE]): un
/// foglio che si chiude con «Più tardi», non una porta da passare.
library;

import 'package:flutter/material.dart';

import '../casa/questo_dispositivo.dart' show proprietarioPulito;
import '../parole.dart';

/// Il campo «Di chi è questo telefono?», com'e' nell'abbinamento.
class CampoDelProprietario extends StatelessWidget {
  const CampoDelProprietario({
    super.key,
    required this.controller,
    this.enabled = true,
    this.autofocus = false,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final bool enabled;
  final bool autofocus;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      enabled: enabled,
      autofocus: autofocus,
      maxLength: 30,
      textCapitalization: TextCapitalization.words,
      textInputAction: TextInputAction.done,
      onSubmitted: onSubmitted,
      decoration: InputDecoration(
        labelText: inLingua(
          it: 'Di chi è questo telefono?',
          en: 'Whose phone is this?',
        ),
        hintText: inLingua(it: 'Il tuo nome', en: 'Your name'),
        prefixIcon: const Icon(Icons.person_outline_rounded),
        /* Il contatore dei 30 caratteri non serve a nessuno: il limite c'e'
         * lo stesso, e al suo posto si legge a cosa serve. */
        counterText: '',
        helperText: inLingua(
          it:
              'Facoltativo. Nella casa questo telefono si chiamerà col suo '
              'modello e il tuo nome, per riconoscerlo fra gli altri.',
          en:
              'Optional. Your home will call this phone by its model and your '
              'name, so you can tell it apart from the others.',
        ),
        helperMaxLines: 3,
      ),
    );
  }
}

/// Chiede di chi e' questo telefono, in un foglio dal basso.
///
/// Torna il nome ripulito (anche vuoto, se si salva senza scrivere), oppure
/// `null` per «Più tardi» o se il foglio si chiude.
Future<String?> chiediDiChiE(BuildContext context, {String iniziale = ''}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => FoglioDiChiE(iniziale: iniziale),
  );
}

/// Il foglio di [chiediDiChiE]. Pubblico per le prove e le fotografie.
class FoglioDiChiE extends StatefulWidget {
  const FoglioDiChiE({super.key, this.iniziale = ''});

  final String iniziale;

  @override
  State<FoglioDiChiE> createState() => _FoglioDiChiEState();
}

class _FoglioDiChiEState extends State<FoglioDiChiE> {
  late final _nome = TextEditingController(text: widget.iniziale);

  @override
  void dispose() {
    _nome.dispose();
    super.dispose();
  }

  void _salva() => Navigator.of(context).pop(proprietarioPulito(_nome.text));

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final testi = Theme.of(context).textTheme;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        0,
        24,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: CircleAvatar(
              radius: 28,
              backgroundColor: colori.primaryContainer,
              child: Icon(
                Icons.smartphone_rounded,
                size: 30,
                color: colori.onPrimaryContainer,
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            inLingua(
              it: 'Di chi è questo telefono?',
              en: 'Whose phone is this?',
            ),
            textAlign: TextAlign.center,
            style: testi.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text(
            inLingua(
              it:
                  'Fra i telefoni abbinati alla casa si chiamerà col suo '
                  'modello e il tuo nome, così lo riconosci subito.',
              en:
                  'Among the phones paired with your home it will be called by '
                  'its model and your name, so you can spot it right away.',
            ),
            textAlign: TextAlign.center,
            style: testi.bodyMedium?.copyWith(color: colori.onSurfaceVariant),
          ),
          const SizedBox(height: 20),
          CampoDelProprietario(
            controller: _nome,
            autofocus: true,
            onSubmitted: (_) => _salva(),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _salva,
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
            ),
            child: Text(inLingua(it: 'Salva', en: 'Save')),
          ),
          const SizedBox(height: 6),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(inLingua(it: 'Più tardi', en: 'Later')),
          ),
        ],
      ),
    );
  }
}
