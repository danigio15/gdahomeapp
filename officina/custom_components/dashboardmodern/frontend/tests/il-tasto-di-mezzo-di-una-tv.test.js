/* Il tasto in mezzo ai comandi di un lettore, quando il lettore e' una TV
 * (#132).
 *
 * «Ho collegato le TV a Home Assistant, sarebbe possibile usarle anche qua per
 * spegnerle, accenderle ed usare il loro telecomando virtuale se disponibile?»
 *
 * Spegnerle e accenderle si poteva gia': il tasto centrale su un lettore spento
 * chiama `turn_on`. Ma portava il triangolo della musica e diceva «Riproduci»,
 * e su un televisore spento quel triangolo non si legge come «accendi» — si
 * legge come un tasto che riprendera' qualcosa, e chi non sa cosa riprendera'
 * non lo preme.
 *
 * E il caso peggiore era l'altro. Un televisore che dichiara di saper solo
 * accendersi, spegnersi e cambiare sorgente — cioe' quasi tutti — di pausa non
 * ne ha, e li' il triangolo chiamava `media_play_pause`: un servizio che non
 * da' errore e non fa niente. Un tasto rotto, che e' esattamente quello che la
 * testa di `media-player-section.js` dice di non voler disegnare mai: «i tasti
 * che compaiono sono quelli che il lettore sa eseguire davvero». La regola
 * c'era, e il tasto centrale ne era fuori.
 *
 * Il telecomando virtuale e' un'altra cosa e non sta qui: vuole un'entita'
 * `remote.*` e `remote.send_command`, che questa plancia ancora non tocca.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { SA, ilTastoCentrale, letturaDelLettore } from "../src/core/media-player.js";

const TV = "media_player.tv_salotto";

/* Quello che dichiara un televisore normale: si accende, si spegne, cambia
 * sorgente e volume. Di pausa non ne ha, perche' non sta riproducendo niente
 * di suo — fa vedere quello che gli arriva dall'HDMI. */
const SOLO_TV = SA.ACCENDI | SA.SPEGNI | SA.SORGENTE | SA.VOLUME;

/* E quello che dichiara una cassa: sa anche mettersi in pausa. */
const CASSA = SOLO_TV | SA.PAUSA | SA.PRECEDENTE | SA.SUCCESSIVO;

const lettore = (stato, bandiere) =>
  letturaDelLettore(
    { id: "uno", entity: TV },
    { [TV]: { state: stato, attributes: { supported_features: bandiere } } },
  );

test("la TV spenta offre ACCENDI, non «Riproduci»", () => {
  assert.equal(ilTastoCentrale(lettore("off", SOLO_TV)), "accendi");
});

test("la TV accesa che non sa la pausa non offre niente in mezzo", () => {
  /* Il tasto rotto, tolto. Spegnerla si puo' lo stesso: il tasto accanto c'e'
   * gia', ed e' quello che `puo.spegni` accende. */
  const accesa = lettore("on", SOLO_TV);
  assert.equal(ilTastoCentrale(accesa), "");
  assert.equal(accesa.puo.spegni, true);
});

test("una cassa continua a fare quello che faceva", () => {
  /* La correzione non deve cambiare niente a chi la pausa ce l'ha: e' la
   * musica, ed e' il motivo per cui questa pagina esiste (#269). */
  assert.equal(ilTastoCentrale(lettore("playing", CASSA)), "pausa");
  assert.equal(ilTastoCentrale(lettore("paused", CASSA)), "suona");
  assert.equal(ilTastoCentrale(lettore("idle", CASSA)), "suona");
  assert.equal(ilTastoCentrale(lettore("off", CASSA)), "accendi");
});

test("un lettore che non sa nemmeno accendersi non promette di accenderlo", () => {
  /* Una radio via rete che sta spenta e non ha `TURN_ON`: il tasto che la
   * accende non c'e', perche' premendolo non succederebbe niente. */
  assert.equal(ilTastoCentrale(lettore("off", SA.PAUSA)), "");
});

test("senza lettura non si disegna un tasto", () => {
  assert.equal(ilTastoCentrale(null), "");
  assert.equal(ilTastoCentrale(undefined), "");
});

test("un lettore che non risponde non offre tasti che non funzionerebbero", () => {
  /* `unavailable` non e' «spento»: non si sa com'e' messo, e `supported_features`
   * non arriva. Un tasto disegnato su un'ipotesi e' un tasto rotto a meta'. */
  const muto = lettore("unavailable", SOLO_TV);
  assert.equal(muto.muto, true);
  assert.equal(ilTastoCentrale(muto), "");
});
