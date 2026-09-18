/* «Inserisci nome ed entità climate valida» su un'entità valida (#10).
 *
 * > Sto provando a configurare il Trial Hisense ma ogni qualvolta che seleziono
 * > l'entità "climate.condizionatore_sala" mi da questo errore "Inserisci nome
 * > ed entità climate valida". Non so se sbaglio io ma non riesco a farlo
 * > andare.
 *
 * Non sbagliava lui. Il controllo del guscio è uno solo per due cose —
 * `if (!name || !ent.includes('.'))` — e quell'entità il punto ce l'ha:
 * mancava il NOME, e il messaggio dava la colpa all'unica cosa che era giusta.
 *
 * Qui si tiene fermo il conto: cosa manca davvero, e che un nome che Home
 * Assistant sa già non è una cosa da chiedere a chi configura.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const { cosaMancaAlClima } = await import("../src/sections/il-clima-dice-cosa-manca-section.js");

test("un'entità climate vera non è mai quella che manca", () => {
  /* Il caso della segnalazione, esattamente. */
  assert.equal(
    cosaMancaAlClima({ nome: "", entita: "climate.condizionatore_sala", proposto: "" }),
    "nome",
  );
  assert.equal(
    cosaMancaAlClima({ nome: "Sala", entita: "climate.condizionatore_sala", proposto: "" }),
    "",
  );
});

test("il nome che sa Home Assistant vale come nome: non si chiede due volte", () => {
  /* «Condizionatore Sala» ce l'ha già la casa. Chiederlo a chi sta
   * configurando vuol dire chiedergli di ribattere una cosa che è già scritta,
   * ed è il contrario di facilitare. */
  assert.equal(
    cosaMancaAlClima({
      nome: "",
      entita: "climate.condizionatore_sala",
      proposto: "Condizionatore Sala",
    }),
    "",
  );
});

test("quando manca l'entità si dice l'entità, e non «nome ed entità»", () => {
  for (const entita of ["", "condizionatore", "climate", "climate.", ".sala"])
    assert.equal(cosaMancaAlClima({ nome: "Sala", entita }), "entita", `con «${entita}»`);
  assert.equal(cosaMancaAlClima({}), "entita");
});

test("l'entità sbagliata vince sul nome mancante: si sistema quella per prima", () => {
  /* Due messaggi in fila sarebbero due giri di prove. Il primo che si legge è
   * quello della casella che si sta compilando. */
  assert.equal(cosaMancaAlClima({ nome: "", entita: "" }), "entita");
});

test("il messaggio del guscio non arriva più prima del nostro", () => {
  /* Il guscio controlla le stesse due cose dopo di noi: la regola è fermarsi
   * PRIMA, se no il suo alert dice di nuovo la cosa sbagliata. */
  const sezione = readFileSync(
    new URL("../src/sections/il-clima-dice-cosa-manca-section.js", import.meta.url),
    "utf8",
  );
  assert.match(sezione, /root\.edAddClima = dicendoCosaManca/);
  assert.match(sezione, /if \(manca\) \{\s*avvisa\(manca\);\s*return undefined;/);
  /* E il nome proposto si scrive nella casella prima di passare la mano, se no
   * il guscio troverebbe la casella vuota e si fermerebbe lui. */
  assert.match(sezione, /proponiIlNome\(\);\s*return originale\.apply/);
});
