/* La scheda di un'entita', aperta da dentro la plancia.
 *
 * Home Assistant ce l'ha gia': la finestra che dice tutto di un'entita' — la
 * storia, i comandi, gli attributi — e si apre annunciando `hass-more-info` a
 * chi ospita il pannello. La plancia non la rifa': chi tocca una cosa che qui
 * si vede in due parole e vuole saperne di piu' deve trovare la finestra che
 * conosce gia', non una nostra versione piu' povera.
 *
 * Sta in un file suo perche' la chiedono in due — la scheda di una persona,
 * che porta la sua mappa, e le pastiglie scelte a mano sotto il meteo (#7) —
 * e scritta due volte sarebbe due idee di come si attraversa il confine fra
 * la cornice e Home Assistant. Il giorno che quel confine cambia, una sola
 * delle due lo imparerebbe.
 */
import { clean, root } from "./shared.js";

/* Il pannello che ospita la plancia, dentro il documento di Home Assistant.
 * La cornice e' figlia della sua ombra: da li' un annuncio con `composed`
 * attraversa il confine e arriva a chi sta sopra. */
export function ospiteDellaPlancia() {
  try {
    const cornice = root.frameElement;
    if (!cornice) return null;
    return cornice.getRootNode?.()?.host || cornice;
  } catch (_error) {
    return null;
  }
}

/* Se intorno alla plancia c'e' davvero Home Assistant. Si guarda l'elemento
 * che fa da radice al suo pannello: senza quello non c'e' nessuno che ascolti,
 * e annunciare vorrebbe dire un tocco che non fa niente. */
export function dentroHomeAssistant() {
  try {
    return Boolean(root.parent?.document?.querySelector?.("home-assistant"));
  } catch (_error) {
    return false;
  }
}

/**
 * Apre la scheda dell'entita' in Home Assistant.
 *
 * Torna `false` quando non c'e' nessuno ad ascoltare — la plancia aperta da
 * sola, nell'app, in una scheda del browser — e chi chiama lo usa per non
 * promettere un tocco che non farebbe niente.
 */
export function apriLaSchedaDellEntita(entity) {
  const id = clean(entity);
  if (!id || !dentroHomeAssistant()) return false;
  const ospite = ospiteDellaPlancia();
  const vista = ospite?.ownerDocument?.defaultView;
  if (!ospite?.dispatchEvent || !vista?.CustomEvent) return false;
  try {
    ospite.dispatchEvent(
      new vista.CustomEvent("hass-more-info", {
        bubbles: true,
        composed: true,
        detail: { entityId: id },
      }),
    );
    return true;
  } catch (_error) {
    return false;
  }
}
