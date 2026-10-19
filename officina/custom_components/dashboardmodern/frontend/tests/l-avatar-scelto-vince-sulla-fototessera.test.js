/* «La prima, nonostante l'avatar, in Home prende la foto che arriva
 * dall'entita' di tracking.»
 *
 * La card della persona mette la fotografia davanti all'avatar, ed e' giusto:
 * una foto vera e' meglio di un'emoji. Ma la fotografia arrivava anche da
 * sola — Home Assistant e i tracker se la portano dietro — e quella
 * automatica stava davanti a una scelta fatta a mano. Chi si costruiva la
 * faccia pezzo per pezzo continuava a vedere la fototessera del telefono.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { personViewModel } from "../src/core/person-model.js";

const STATI = {
  "person.persona_8": {
    entity_id: "person.persona_8",
    state: "home",
    attributes: { friendly_name: "Persona 8", entity_picture: "/api/image/persona_8.jpg" },
  },
};

const persona = (extra) => ({
  id: "p1",
  name: "Persona 8",
  entity: "person.persona_8",
  photo: "",
  battery: "",
  avatar: { color: "#0ea5e9", emoji: "", face: null },
  ...extra,
});

test("senza avatar scelto la fototessera dell'entita' resta il ripiego", () => {
  const vista = personViewModel(persona({}), STATI);
  assert.equal(vista.photo, "/api/image/persona_8.jpg");
});

test("un'emoji scelta vince sulla fototessera", () => {
  const vista = personViewModel(persona({ avatar: { color: "#0ea5e9", emoji: "🧔", face: null } }), STATI);
  assert.equal(vista.photo, "");
});

test("una faccia costruita vince sulla fototessera", () => {
  const vista = personViewModel(
    persona({ avatar: { color: "#0ea5e9", emoji: "", face: { pelle: "chiara" } } }),
    STATI,
  );
  assert.equal(vista.photo, "");
});

test("la foto scritta a mano vince su tutto: e' la scelta piu' precisa", () => {
  const vista = personViewModel(
    persona({ photo: "/local/persona_8.png", avatar: { color: "#0ea5e9", emoji: "🧔", face: null } }),
    STATI,
  );
  assert.equal(vista.photo, "/local/persona_8.png");
});
