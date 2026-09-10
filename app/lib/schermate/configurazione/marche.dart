/// La marca dell'auto, scelta da una griglia di loghi.
///
/// Nella Config della dashboard e' cosi', e non e' vezzo: chi ha una Škoda non
/// deve indovinare se si scrive «Skoda», «skoda» o «Škoda» — tocca il logo e
/// basta. E la plancia, quella marca, la disegna col suo colore.
///
/// I loghi arrivano **sul filo**, dal ponte, come i file della plancia: niente
/// da scaricare da internet, e uguale in casa e da fuori. Uno che non arriva
/// lascia le sue iniziali, che si leggono lo stesso.
library;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../casa/collegamento.dart';
import '../../casa/plancia/marchi.dart';

/// Apre la griglia e restituisce la marca scelta, o `null` se si lascia stare.
///
/// Restituisce la stringa vuota per «nessuna marca»: e' diverso da `null`.
Future<String?> scegliLaMarca(
  BuildContext contesto, {
  required Collegamento collegamento,
  String adesso = '',
}) => showModalBottomSheet<String>(
  context: contesto,
  isScrollControlled: true,
  showDragHandle: true,
  builder: (dentro) =>
      _LeMarche(collegamento: collegamento, adesso: adesso),
);

class _LeMarche extends StatelessWidget {
  const _LeMarche({required this.collegamento, required this.adesso});

  final Collegamento collegamento;
  final String adesso;

  @override
  Widget build(BuildContext context) {
    final scelta = marcaDaScritta(adesso);
    return SizedBox(
      height: MediaQuery.sizeOf(context).height * 0.78,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
            child: Row(
              children: [
                Text(
                  'La marca',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const Spacer(),
                if (adesso.isNotEmpty)
                  TextButton(
                    onPressed: () => Navigator.of(context).pop(''),
                    child: const Text('Togli'),
                  ),
              ],
            ),
          ),
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
              gridDelegate:
                  const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 120,
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    childAspectRatio: 0.95,
                  ),
              itemCount: leMarcheDelleAuto.length,
              itemBuilder: (dentro, quale) {
                final una = leMarcheDelleAuto[quale];
                return _UnaMarca(
                  marca: una,
                  collegamento: collegamento,
                  scelta: scelta?.id == una.id,
                  premuta: () => Navigator.of(context).pop(una.nome),
                );
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton.tonal(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Annulla'),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _UnaMarca extends StatelessWidget {
  const _UnaMarca({
    required this.marca,
    required this.collegamento,
    required this.scelta,
    required this.premuta,
  });

  final MarcaDellAuto marca;
  final Collegamento collegamento;
  final bool scelta;
  final VoidCallback premuta;

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    return Material(
      color: scelta ? colori.primaryContainer : colori.surfaceContainerHigh,
      borderRadius: BorderRadius.circular(14),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: premuta,
        child: Container(
          decoration: BoxDecoration(
            border: scelta
                ? Border.all(color: colori.primary, width: 2)
                : null,
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.all(8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                height: 40,
                child: IlLogo(
                  marca: marca,
                  collegamento: collegamento,
                  quanto: 36,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                marca.nome,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Il logo di una marca, preso dal ponte. Le iniziali quando non arriva.
class IlLogo extends StatefulWidget {
  const IlLogo({
    super.key,
    required this.marca,
    required this.collegamento,
    required this.quanto,
  });

  final MarcaDellAuto marca;
  final Collegamento collegamento;
  final double quanto;

  @override
  State<IlLogo> createState() => _IlLogoState();
}

class _IlLogoState extends State<IlLogo> {
  String? _disegno;

  @override
  void initState() {
    super.initState();
    _disegno = IMarchi.io.gia(widget.marca.id);
    if (_disegno == null) _chiedi();
  }

  @override
  void didUpdateWidget(IlLogo vecchio) {
    super.didUpdateWidget(vecchio);
    if (vecchio.marca.id != widget.marca.id) {
      _disegno = IMarchi.io.gia(widget.marca.id);
      if (_disegno == null) _chiedi();
    }
  }

  Future<void> _chiedi() async {
    final preso = await IMarchi.io.disegnoDi(
      widget.marca.id,
      widget.collegamento.filo,
    );
    if (mounted && preso != null) setState(() => _disegno = preso);
  }

  @override
  Widget build(BuildContext context) {
    final colori = Theme.of(context).colorScheme;
    final disegno = _disegno;
    final tinta = coloreDelMarchio(widget.marca.colore) ?? colori.onSurface;
    if (disegno == null) {
      return SizedBox(
        width: widget.quanto,
        height: widget.quanto,
        child: Center(
          child: Text(
            widget.marca.iniziali,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: widget.quanto * 0.34,
              color: colori.onSurfaceVariant,
            ),
          ),
        ),
      );
    }
    return SvgPicture.string(
      disegno,
      width: widget.quanto,
      height: widget.quanto,
      colorFilter: ColorFilter.mode(tinta, BlendMode.srcIn),
    );
  }
}

/// La tinta d'istituto, letta com'e' scritta nel catalogo: `#0066B1`.
Color? coloreDelMarchio(String scritta) {
  if (scritta.isEmpty) return null;
  final quanto = int.tryParse(scritta.replaceAll('#', ''), radix: 16);
  return quanto == null ? null : Color(0xff000000 | quanto);
}

/// La sagoma dell'auto, scelta fra le otto della plancia.
Future<String?> scegliLaSagoma(BuildContext contesto, {String adesso = ''}) =>
    showModalBottomSheet<String>(
      context: contesto,
      showDragHandle: true,
      builder: (dentro) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Che auto e\'',
                style: Theme.of(dentro).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'La sagoma che la plancia disegna quando non c\'e\' una foto.',
                style: Theme.of(dentro).textTheme.bodySmall?.copyWith(
                  color: Theme.of(dentro).colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final una in leSagomeDellAuto)
                    ChoiceChip(
                      avatar: Text(una.disegno),
                      label: Text(una.nome),
                      selected: adesso == una.id,
                      onSelected: (_) => Navigator.of(dentro).pop(una.id),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
