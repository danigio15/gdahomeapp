/* «Sul muro le persone non prendono il nome corretto.»
 *
 * La card Persone della Home chiama ognuno col nome scritto nella scheda
 * Persone, poi col `friendly_name` di Home Assistant, e solo per ultimo con
 * l'entita'. Il pannello a muro leggeva soltanto Home Assistant: chi aveva
 * dato un nome di casa alla persona sul tablet trovava quello dell'account.
 * Ora tutti e due passano dalla stessa regola (`nomeDellaPersona`). */
import assert from "node:assert/strict";
import test from "node:test";
import { nomeDellaPersona, normalizePeople, personViewModel } from "../src/core/person-model.js";
import {
  fonteDaiValori,
  nomeDellaPersonaDelMuro,
  personeDelMuro,
} from "../src/core/plancia-a-muro.js";

const STATI = {
  "person.account_uno": {
    state: "home",
    attributes: { friendly_name: "Account Uno" },
  },
  "person.account_due": {
    state: "home",
    attributes: { friendly_name: "Account Due" },
  },
  "person.ospite": { state: "not_home", attributes: { friendly_name: "Ospite" } },
  "person.senza_nome": { state: "home", attributes: {} },
};

const CD_PEOPLE = [
  { entity: "person.account_uno", name: "Mamma" },
  { entity: "person.account_due", name: "" },
  { entity: "person.ospite", name: "Zio" },
  { entity: "person.senza_nome", name: "" },
];

test("il nome di una persona: scheda Persone, poi friendly_name, poi entita'", () => {
  assert.equal(nomeDellaPersona(CD_PEOPLE[0], STATI), "Mamma");
  assert.equal(nomeDellaPersona(CD_PEOPLE[1], STATI), "Account Due");
  assert.equal(nomeDellaPersona(CD_PEOPLE[3], STATI), "person.senza_nome");
  assert.equal(
    nomeDellaPersona({ entity: "person.account_uno", name: "  " }, STATI),
    "Account Uno",
  );
});

test("il muro chiama chi e' in casa come lo chiama la card Persone della Home", () => {
  const fonte = fonteDaiValori({ cd_people: JSON.stringify(CD_PEOPLE) });
  const muro = personeDelMuro(fonte, STATI);
  const home = normalizePeople(CD_PEOPLE)
    .map((p) => personViewModel(p, STATI, 0))
    .filter((v) => v.presence === "home");

  assert.equal(muro.tutte, 4);
  assert.equal(muro.inCasa, 3);
  assert.deepEqual(muro.nomi, ["Mamma", "Account Due", "person.senza_nome"]);
  assert.deepEqual(
    muro.nomi,
    home.map((v) => v.name),
    "stessi nomi della Home",
  );
});

test("la card di una persona sul muro prende il nome di casa", () => {
  const fonte = fonteDaiValori({ cd_people: JSON.stringify(CD_PEOPLE) });
  assert.equal(nomeDellaPersonaDelMuro("person.account_uno", fonte, STATI), "Mamma");
  assert.equal(nomeDellaPersonaDelMuro("person.account_due", fonte, STATI), "Account Due");
  assert.equal(nomeDellaPersonaDelMuro("light.cucina", fonte, STATI), "");
});

test("una persona nascosta in Home non conta sul muro", () => {
  const fonte = fonteDaiValori({
    cd_people: JSON.stringify([...CD_PEOPLE.slice(0, 1), { ...CD_PEOPLE[1], nascosta: true }]),
  });
  assert.deepEqual(personeDelMuro(fonte, STATI).nomi, ["Mamma"]);
});

test("senza persone in elenco il muro prende tutte le person.* col loro nome", () => {
  const muro = personeDelMuro(fonteDaiValori({}), STATI);
  assert.equal(muro.tutte, 4);
  assert.deepEqual(muro.nomi, ["Account Uno", "Account Due", "person.senza_nome"]);
});

/* Le strade che restavano fuori dalla regola comune: la persona spenta in
 * Home che il tablet mostra lo stesso in una pagina, e la persona tenuta per
 * il telefono (`device_tracker.*`) che il tablet mostra per la `person.*`. */
test("una persona spenta in Home tiene il suo nome di casa sulla card del tablet", () => {
  const fonte = fonteDaiValori({
    cd_people: JSON.stringify([
      CD_PEOPLE[0],
      { entity: "person.ospite", name: "Zio", nascosta: true },
    ]),
  });
  assert.equal(nomeDellaPersonaDelMuro("person.ospite", fonte, STATI), "Zio");
  assert.deepEqual(personeDelMuro(fonte, STATI).entita, ["person.account_uno"]);
});

test("una scheda Persone con tutti spenti non riempie il muro di account", () => {
  const fonte = fonteDaiValori({
    cd_people: JSON.stringify([{ ...CD_PEOPLE[0], nascosta: true }]),
  });
  const muro = personeDelMuro(fonte, STATI);
  assert.equal(muro.tutte, 0);
  assert.deepEqual(muro.nomi, []);
});

test("persona e telefono si riconoscono: il nome di casa vale per tutti e due", () => {
  const stati = {
    ...STATI,
    "person.account_uno": {
      state: "home",
      attributes: {
        friendly_name: "Account Uno",
        device_trackers: ["device_tracker.telefono_uno"],
      },
    },
    "device_tracker.telefono_uno": { state: "home", attributes: { friendly_name: "Telefono" } },
  };
  const daTelefono = fonteDaiValori({
    cd_people: JSON.stringify([{ entity: "device_tracker.telefono_uno", name: "Mamma" }]),
  });
  assert.equal(nomeDellaPersonaDelMuro("person.account_uno", daTelefono, stati), "Mamma");
  const daPersona = fonteDaiValori({ cd_people: JSON.stringify([CD_PEOPLE[0]]) });
  assert.equal(nomeDellaPersonaDelMuro("device_tracker.telefono_uno", daPersona, stati), "Mamma");
  assert.equal(nomeDellaPersonaDelMuro("device_tracker.altro", daPersona, stati), "");
});
