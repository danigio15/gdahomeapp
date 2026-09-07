#!/usr/bin/env python3
"""Rifa' i vettori di prova del codice a quadretti.

Un encoder QR sbagliato non si vede a occhio: fa un quadrato che sembra un QR
e che nessun telefono legge. L'unico modo di sapere se `ponte/src/qr.js` e'
giusto e' confrontare quello che disegna, quadretto per quadretto, con quello
che disegna un'implementazione vera — e quella vera qui e' `qrcode`, la
libreria Python che sta dentro mezzo mondo.

Questo script non gira ne' nelle prove ne' in produzione: gira **a mano**, e
solo quando si mette le mani in `qr.js`. Quello che lascia dietro — il file
`ponte/test/qr-riferimento.js` — e' quello che le prove leggono, e da li' in
poi Python non serve piu' a nessuno.

    pip install qrcode opencv-python-headless
    python3 strumenti/qr-riferimento.py

Con OpenCV installato fa anche l'altra meta' del lavoro: **rilegge** quello che
il nostro encoder ha disegnato, con un lettore che non c'entra niente ne' con
lui ne' con la libreria di riferimento. Confrontare due encoder dice che sono
uguali; farlo leggere dice che si legge. Sono due cose diverse e servono tutte
e due. Senza OpenCV il resto funziona lo stesso, e lo dice.

Se dopo averlo lanciato `git diff` mostra dei cambiamenti nei vettori, sono
due i casi: o si e' rotto qualcosa in `qr.js`, o si e' cambiata di proposito
la libreria di riferimento. Non ce n'e' un terzo.
"""

import hashlib
import pathlib
import random
import string
import sys

try:
    import qrcode
    from qrcode.constants import ERROR_CORRECT_M
    from qrcode.util import MODE_8BIT_BYTE, QRData
except ImportError:  # pragma: no cover
    sys.exit("manca la libreria di riferimento: pip install qrcode")

try:
    import cv2
    import numpy
except ImportError:  # pragma: no cover
    cv2 = None

QUI = pathlib.Path(__file__).resolve().parent.parent
DOVE = QUI / "ponte" / "test" / "qr-riferimento.js"

# Quanti byte ci stanno in ogni versione, con correzione M e modo byte. Il
# vettore piu' utile e' proprio quello che riempie la versione fino all'orlo:
# li' tutti i blocchi di correzione sono pieni, e uno sbaglio nelle tabelle
# viene fuori subito.
PIENE = [14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 287, 331, 362, 412]

# Quelle scritte a mano: corte, con gli accenti, con le emoji, e una che
# somiglia a quello che ci finira' dentro davvero.
A_MANO = [
    "a",
    "gdahome",
    "ciao, casa!",
    "gdahome://abbina?c=aQ3-kZ",
    "Perche' l'accento e' un byte in piu': citta', pero', cosi'.",
    "\u00e8\u00e9\u00ea\u00eb \u20ac \u2192 \U0001f3e0",
    "0123456789",
    "HELLO WORLD",
]


def a_caso(quanti, seme):
    """Una stringa lunga come si vuole, sempre la stessa."""
    dado = random.Random(seme)
    alfabeto = string.ascii_letters + string.digits + "-_.~"
    return "".join(dado.choice(alfabeto) for _ in range(quanti))


def matrice(testo, versione=None, maschera=None):
    codice = qrcode.QRCode(
        version=versione,
        error_correction=ERROR_CORRECT_M,
        border=0,
        mask_pattern=maschera,
    )
    codice.add_data(QRData(testo.encode("utf-8"), mode=MODE_8BIT_BYTE))
    codice.make(fit=versione is None)
    return codice, ["".join("1" if q else "0" for q in r) for r in codice.modules]


def impronta(righe):
    return hashlib.sha256("\n".join(righe).encode("ascii")).hexdigest()[:16]


def vettore(testo):
    codice, scelta = matrice(testo)
    versione = codice.version
    impronte = [impronta(scelta)]
    for m in range(8):
        _, righe = matrice(testo, versione=versione, maschera=m)
        impronte.append(impronta(righe))
    return {
        "testo": testo,
        "versione": versione,
        "maschera": codice.best_mask_pattern(),
        "impronte": impronte,
        "righe": scelta,
    }


def scrivi(dentro):
    fuori = [TESTA]
    fuori.append("export const VETTORI = [")
    for v in dentro:
        fuori.append("  {")
        fuori.append(f"    testo: {javascript(v['testo'])},")
        fuori.append(f"    versione: {v['versione']},")
        fuori.append(f"    maschera: {v['maschera']},")
        fuori.append("    impronte: [")
        for i, uno in enumerate(v["impronte"]):
            come = "scelta" if i == 0 else f"maschera {i - 1}"
            fuori.append(f'      "{uno}", // {come}')
        fuori.append("    ],")
        fuori.append("  },")
    fuori.append("];")
    fuori.append("")
    fuori.append(DISEGNI)
    for nome, testo in DA_DISEGNARE.items():
        _, righe = matrice(testo)
        fuori.append(f"export const {nome} = {{")
        fuori.append(f"  testo: {javascript(testo)},")
        fuori.append("  disegno: [")
        for riga in righe:
            fuori.append('      "' + riga.replace("0", ".").replace("1", "#") + '",')
        fuori.append("  ].join(\"\\n\"),")
        fuori.append("};")
        fuori.append("")
    DOVE.write_text("\n".join(fuori))
    print(f"scritti {len(dentro)} vettori in {DOVE.relative_to(QUI)}")
    print("adesso: npx prettier --write ponte/test/qr-riferimento.js")


def javascript(testo):
    fuori = ['"']
    for lettera in testo:
        if lettera == '"':
            fuori.append('\\"')
        elif lettera == "\\":
            fuori.append("\\\\")
        elif ord(lettera) < 0x20 or ord(lettera) > 0x7E:
            # Le lettere strane si scrivono in cifre: cosi' il file resta
            # leggibile ovunque e nessun editore lo "aggiusta".
            grezzo = lettera.encode("utf-16-be")
            for i in range(0, len(grezzo), 2):
                fuori.append("\\u%04x" % int.from_bytes(grezzo[i : i + 2], "big"))
        else:
            fuori.append(lettera)
    fuori.append('"')
    return "".join(fuori)


TESTA = '''/* I vettori del codice a quadretti, presi da un'implementazione vera.
 *
 * **Questo file non si scrive a mano.** Lo rifa'
 * `strumenti/qr-riferimento.py`, che chiede a `qrcode` — la libreria Python
 * che sta dentro mezzo mondo — di disegnare gli stessi codici che disegna
 * `ponte/src/qr.js`, e ne segna l'impronta.
 *
 * Le impronte sono di tutte e nove le matrici di ogni prova: quella con la
 * maschera che l'encoder sceglie da solo, e tutte e otto quelle a maschera
 * fissa. Cosi' una prova rossa dice anche **dove** si e' rotto: se sbagliano
 * tutte e otto e' nei dati o nella correzione, se sbaglia solo la scelta e'
 * nel conto della bruttezza.
 *
 * Le lunghezze non sono a caso: quindici delle prove riempiono fino all'orlo
 * ognuna delle quindici versioni, e li' tutti i blocchi di correzione sono
 * pieni — e' dove le tabelle sbagliate vengono fuori.
 */
'''

DISEGNI = '''/* Due matrici per intero, in chiaro.
 *
 * Le impronte dicono «e' cambiato qualcosa» e non dicono altro. Questi due
 * disegni si guardano a occhio: se un giorno una prova diventa rossa, un
 * mirino storto o un righello che manca si vede da qui in tre secondi.
 */
'''

DA_DISEGNARE = {
    "IL_DISEGNO_PICCOLO": "gdahome",
    "IL_DISEGNO_CON_LA_VERSIONE": a_caso(122, "versione 7"),
}


def rileggi(righe, testo, scala=8):
    """Lo rilegge davvero, con un lettore che non e' ne' il nostro ne' quello
    di riferimento. Su qualche codice fitto il rilevatore di OpenCV non trova
    i mirini e torna a mani vuote: non e' un codice sbagliato, e infatti
    sbaglia sugli stessi codici anche col disegno della libreria di
    riferimento. Quello che conterebbe davvero sarebbe rileggere **qualcosa di
    diverso** da quello che c'era scritto, e quello non succede mai."""
    lato = len(righe)
    dentro = numpy.array(
        [[0 if q == "1" else 255 for q in r] for r in righe], dtype=numpy.uint8
    )
    # La zona tranquilla: quattro quadretti di bianco intorno. Senza, non lo
    # legge nessuno, per bene che sia disegnato.
    con_bordo = numpy.full((lato + 8, lato + 8), 255, dtype=numpy.uint8)
    con_bordo[4 : 4 + lato, 4 : 4 + lato] = dentro
    grande = numpy.kron(con_bordo, numpy.ones((scala, scala), dtype=numpy.uint8))
    letto, _, _ = cv2.QRCodeDetector().detectAndDecode(grande)
    if letto == testo:
        return "riletto"
    if letto == "":
        return "non trovato"
    return "SBAGLIATO"


def rileggi_tutti(dentro):
    if cv2 is None:
        print("OpenCV non c'e': saltata la rilettura (pip install opencv-python-headless)")
        return
    conti = {}
    for v in dentro:
        come = rileggi(v["righe"], v["testo"])
        conti[come] = conti.get(come, 0) + 1
        if come == "SBAGLIATO":
            sys.exit(f"un codice si rilegge diverso da com'e' stato scritto: {v['testo'][:30]}")
    print(
        f"riletti da OpenCV: {conti.get('riletto', 0)} su {len(dentro)}"
        + (f" ({conti['non trovato']} non trovati, nessuno sbagliato)" if conti.get("non trovato") else "")
    )


if __name__ == "__main__":
    prove = list(A_MANO)
    prove += [a_caso(n, f"piena {n}") for n in PIENE]
    vettori = [vettore(t) for t in prove]
    rileggi_tutti(vettori)
    scrivi(vettori)
