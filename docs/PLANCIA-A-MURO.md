# La plancia a muro

Un tablet fisso (o un NSPanel) che mostra una schermata sola, con comandi
grandi. Non è una plancia da riempire da capo: è una plancia della casa che si
accende «a muro» dal suo config (`cd_muro`) e che stanze, luci, clima,
tapparelle, azioni e antifurto li prende da un'altra plancia, di solito la
principale. Solo Premium.

| | File |
| --- | --- |
| Il modello (cosa si salva, cosa si propone) | `ponte/plancia/src/core/plancia-a-muro.js` |
| Il pannello sul tablet | `ponte/plancia/src/sections/plancia-a-muro-section.js` |
| La scheda «A muro» del config | `ponte/plancia/src/sections/plancia-a-muro-editor-section.js` |
| Il cancello degli stati | `ponte/plancia/src/core/state-event-gate.js` |
| Le revisioni delle plance (ponte) | `ponte/src/commissioni.js` → `ponte/config/revisioni` |

## In tempo reale

Due cose diverse arrivano sul tablet, e tutte e due devono arrivare subito.

**Gli stati di Home Assistant.** Passano dal cancello degli stati, che scarta
le entità che la configurazione di *questa* plancia non nomina. La plancia a
muro mostra entità di un'altra plancia, e quelle venivano scartate: il tablet
cambiava solo al suo battito, ogni 15 secondi. Adesso il pannello segna ogni
entità che legge mentre si disegna (e i domini che guarda interi: finestre,
meteo) e il cancello le lascia passare dopo 40 ms invece del mezzo secondo del
mazzetto (`__DM_ENTITA_IN_VISTA__`). I mazzetti che non toccano niente di
quello che si vede non ridisegnano il pannello.

**Il tocco sul tablet.** La card cambia subito (luci, interruttori, clima,
cursore, livelli); la risposta vera di Home Assistant chiude l'attesa appena
arriva. Se Home Assistant non risponde, dopo 4 secondi torna lo stato vero.

**La configurazione.** La plancia rilegge il config quando riprende il fuoco, e
un tablet a muro non lo perde mai. Ogni 10 secondi il pannello chiede al ponte
`ponte/config/revisioni` per la sua plancia e per quella da cui legge (pochi
byte) e scarica lo scatto solo se una revisione è cambiata. Un ponte che non
conosce la domanda fa ricadere il tablet su una rilettura al minuto.

**L'orologio** cambia al minuto giusto, non fino a 15 secondi dopo.

## Le pagine

Fino a **8 pagine**, ognuna con nome, icona, colore e griglia.

| Tipo | Cosa mostra |
| --- | --- |
| Stanza | i comandi di una stanza; li propone la stanza finché nessuno li sceglie |
| Scene | tasti grandi: azioni della plancia o entità qualunque |
| Ingresso | antifurto, citofono, due tasti «apri», esco/rientro, chi è in casa |
| Personalizzata | posti tutti tuoi, con qualunque entità o azione |
| Tutte le luci | le luci della plancia di origine; scorre |
| Clima | linguette Freddo e Caldo, come la sezione Clima |
| Tutte le tapparelle | su, stop, giù per ognuna; scorre |
| Ambienti | una tessera per stanza: temperatura, umidità, luci accese |
| Telecamere | le telecamere della plancia di origine; un tocco apre a tutto schermo |
| Energia | consumo della casa, solare, rete (preleva/cede), batteria |

**La griglia** si sceglie: 2×2, 3×2 (di serie), 4×2, 3×3, 4×3. In verticale
colonne e righe si scambiano. Quando le card diventano strette (meno di 340 px
sul disegno di riferimento) il pannello passa alla forma fitta: disco piccolo,
nome su due righe, niente etichette accessorie. Sul pannello piccolo (NSPanel)
al massimo 3×3, e il resto scorre.

Con più di 4 pagine le linguette mostrano solo il disegno, e il nome di quella
aperta.

## Il config

- **Anteprima dal vivo** della pagina aperta, disegnata come sul tablet e con
  gli stati veri di adesso; segue ogni modifica, anche le scritte.
- La **bozza non si perde** cambiando scheda: un avviso dice che ci sono
  modifiche non salvate finché non si salva.
- **Duplica** una pagina (⧉): si cambia la stanza e si è fatto.
- **Colore** della pagina dalla tavolozza, o quello del suo tipo.
- **Energia**: quattro campi entità; vuoti, si prendono dalla sezione Energia
  della plancia di origine.
- In «Altre impostazioni»: il **meteo** da mostrare, se al riposo il tablet
  **torna alla prima pagina** o resta dov'era, e la **temperatura del riposo**.

## Prove

- `officina/.../tests/la-plancia-a-muro.test.js`: il modello.
- `officina/.../tests/state-event-gate.test.js`: il cancello e le entità in vista.
- `ponte/test/commissioni.test.js`: `ponte/config/revisioni`.
- `officina/.../e2e/la-plancia-a-muro*.spec.js`: il pannello e il config nel
  browser, fra cui la luce spenta da un'altra parte che sul tablet cambia in
  meno di un secondo e mezzo.

Dopo ogni modifica ai sorgenti della plancia: `node strumenti/sigilla-la-plancia.mjs`
(rifà il pacchetto e il sigillo).

## Cosa manca ancora

- **Posti larghi**: una card che prende due colonne (il clima, una telecamera
  in mezzo ai comandi).
- **Ambienti scelti**: oggi la pagina mostra tutte le stanze con sonde o luci;
  scegliere quali e in che ordine.
- **Media**: una pagina per la musica (copertina, play, volume).
- **Un config per tablet**: oggi vale per ogni tablet che apre la plancia; per
  due tablet diversi servono due plance.
- **Spinta dal ponte** invece della domanda ogni 10 secondi, se un giorno il
  filo del ponte saprà mandare avvisi alla plancia.
