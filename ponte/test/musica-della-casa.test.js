/* Le prove della musica della casa in auto (`musica-della-casa.js`): come si
 * suona fuori casa ogni voce, l'elenco messo insieme dalla configurazione
 * della plancia e dai lettori, le radio che hanno solo `http`, le playlist
 * che si suonano solo in casa, «falla partire in casa», i file di Home
 * Assistant firmati, e la porta: solo chi e' entrato. Case, stazioni e
 * playlist inventate.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { Commissioni } from "../src/commissioni.js";
import {
  DELLA_CASA,
  FLUSSO,
  IN_CASA,
  MusicaDellaCasa,
  comeSiSuona,
  playlistDellaCartella,
  provenienzaDi,
  uriDiSpotify,
} from "../src/musica-della-casa.js";

const UTENTE = "c0ffee00c0ffee00c0ffee00c0ffee00";
const RB = "media-source://radio_browser";

/* Una plancia con due radio preferite, due lettori e i preferiti di Alexa. */
const VALORI = {
  cd_radio: JSON.stringify({
    preferite: [
      {
        nome: "Radio Lungomare",
        id: `${RB}/aaaa-1111`,
        tipo: "audio/mpeg",
        logo: "https://loghi.esempio.it/rl.png",
      },
      { nome: "Onda Vesuviana", id: `${RB}/bbbb-2222`, logo: "http://loghi.esempio.it/ov.png" },
      { nome: "Radio Collina 98", id: `${RB}/cccc-3333` },
    ],
  }),
  cd_media_player: [
    { entity: "media_player.studio", nome: "Studio" },
    { entity: "media_player.sonos_soggiorno" },
  ],
  cd_alexa: JSON.stringify({
    altoparlanti: ["media_player.echo_cucina"],
    musica: [
      { servizio: "SPOTIFY", cosa: "Hit della settimana" },
      { servizio: "TUNEIN", cosa: "Radio Campanile" },
    ],
  }),
};

/* Gli alberi dei due lettori: Music Assistant e Sonos. */
const ALBERI = {
  "media_player.studio|": {
    title: "Music Assistant",
    children: [
      {
        title: "Artists",
        media_class: "directory",
        media_content_id: "artists",
        media_content_type: "music",
        can_expand: true,
      },
      {
        title: "Playlists",
        media_class: "directory",
        media_content_id: "playlists",
        media_content_type: "music",
        can_expand: true,
      },
    ],
  },
  "media_player.studio|playlists": {
    title: "Playlists",
    children: [
      {
        title: "Domenica mattina",
        media_class: "playlist",
        media_content_id: "spotify://playlist/37i9dQZF1DXaaaaaaaaaaa",
        media_content_type: "playlist",
        can_play: true,
        can_expand: true,
        thumbnail: "https://copertine.esempio.it/dm.jpg",
      },
      {
        title: "Classici italiani",
        media_class: "playlist",
        media_content_id: "library://playlist/12",
        media_content_type: "playlist",
        can_play: true,
        can_expand: true,
        thumbnail: "/api/media_player_proxy/media_player.studio/browse_media/playlist/12?token=x",
      },
      {
        title: "Ninne nanne",
        media_class: "playlist",
        media_content_id: "media-source://media_source/local/ninne",
        media_content_type: "playlist",
        can_play: true,
        can_expand: true,
      },
    ],
  },
};
ALBERI["media_player.sonos_soggiorno|"] = {
  title: "Sonos",
  children: [
    {
      title: "Favorites",
      media_class: "directory",
      media_content_id: "",
      media_content_type: "favorites",
      can_expand: true,
    },
  ],
};
ALBERI["media_player.sonos_soggiorno|favorites"] = {
  title: "Favorites",
  children: [
    {
      title: "Cena tranquilla",
      media_class: "playlist",
      media_content_id: "FV:2/12",
      media_content_type: "favorite_item_id",
      can_play: true,
    },
    /* La stessa di Spotify vista da un altro lettore: una volta sola. */
    {
      title: "Domenica mattina",
      media_class: "playlist",
      media_content_id: "spotify://playlist/37i9dQZF1DXaaaaaaaaaaa",
      media_content_type: "playlist",
      can_play: true,
    },
  ],
};

function casaFinta({ esterno = "https://casa.esempio.it" } = {}) {
  const chieste = [];
  return {
    chieste,
    async chiedi(comando) {
      chieste.push(comando);
      switch (comando.type) {
        case "get_config":
          return { external_url: esterno };
        case "get_states":
          return [
            {
              entity_id: "media_player.sonos_soggiorno",
              attributes: { friendly_name: "Sonos Soggiorno" },
            },
            {
              entity_id: "media_player.echo_cucina",
              attributes: { friendly_name: "Echo Cucina", last_called: true },
            },
          ];
        case "media_source/resolve_media": {
          const id = comando.media_content_id;
          if (id === `${RB}/aaaa-1111`)
            return { url: "https://flussi.esempio.it/rl.mp3", mime_type: "audio/mpeg" };
          if (id === `${RB}/bbbb-2222`)
            return { url: "http://flussi.esempio.it/ov.aac", mime_type: "audio/aac" };
          if (id === `${RB}/cccc-3333`)
            return { url: "http://vecchio.esempio.it/98", mime_type: "audio/mpeg" };
          if (id === `${RB}/dddd-4444`)
            return { url: "https://flussi.esempio.it/rc.mp3", mime_type: "audio/mpeg" };
          if (id.startsWith("media-source://media_source/local/ninne/"))
            return {
              url: `/media/local/ninne/${id.split("/").pop()}?authSig=firma`,
              mime_type: "audio/mpeg",
            };
          throw new Error("non risolvibile");
        }
        case "media_source/browse_media":
          if (comando.media_content_id === `${RB}/country/IT`)
            return {
              children: [
                {
                  title: "Radio Campanile",
                  media_content_id: `${RB}/dddd-4444`,
                  media_content_type: "audio/mpeg",
                  can_play: true,
                },
              ],
            };
          if (comando.media_content_id === "media-source://media_source/local/ninne")
            return {
              title: "Ninne nanne",
              children: [
                {
                  title: "Stella stellina",
                  media_content_id: "media-source://media_source/local/ninne/1.mp3",
                  can_play: true,
                },
                {
                  title: "Fa' la nanna",
                  media_content_id: "media-source://media_source/local/ninne/2.mp3",
                  can_play: true,
                },
              ],
            };
          return null;
        case "media_player/browse_media": {
          const chiave = `${comando.entity_id}|${comando.media_content_id || comando.media_content_type || ""}`;
          const albero = ALBERI[chiave];
          if (!albero) throw new Error("niente");
          return albero;
        }
        case "call_service":
          return {};
        default:
          throw new Error(`non so ${comando.type}`);
      }
    },
    async immagine(percorso) {
      return percorso.startsWith("media_player_proxy/") ? Buffer.from("jpeg-di-casa") : null;
    },
  };
}

/* Internet finto: i loghi, e l'`https` di una radio che risponde (ov) e di
 * una che non risponde (98). */
function reteFinta() {
  const chieste = [];
  const prendi = async (url) => {
    chieste.push(url);
    const risposta = (tipo, corpo, ok = true) => ({
      ok,
      headers: { get: (k) => (k === "content-type" ? tipo : null) },
      arrayBuffer: async () => Buffer.from(corpo),
      body: { cancel: async () => {} },
    });
    if (url === "https://flussi.esempio.it/ov.aac") return risposta("audio/aac", "");
    if (url.startsWith("https://vecchio.esempio.it")) throw new Error("niente https");
    if (url.endsWith(".png") || url.endsWith(".jpg")) return risposta("image/png", `img:${url}`);
    return risposta("text/html", "", false);
  };
  return { prendi, chieste };
}

test("Spotify in tutte le forme, e da dove viene una voce", () => {
  assert.equal(
    uriDiSpotify("spotify:playlist:37i9dQZF1DXaaaaaaaaaaa"),
    "spotify:playlist:37i9dQZF1DXaaaaaaaaaaa",
  );
  assert.equal(
    uriDiSpotify("spotify://0123abcd/spotify:playlist:37i9dQZF1DXaaaaaaaaaaa"),
    "spotify:playlist:37i9dQZF1DXaaaaaaaaaaa",
  );
  assert.equal(
    uriDiSpotify("https://open.spotify.com/playlist/37i9dQZF1DXaaaaaaaaaaa?si=x"),
    "spotify:playlist:37i9dQZF1DXaaaaaaaaaaa",
  );
  assert.equal(
    uriDiSpotify("spotify--a1b2://playlist/37i9dQZF1DXaaaaaaaaaaa"),
    "spotify:playlist:37i9dQZF1DXaaaaaaaaaaa",
  );
  assert.equal(uriDiSpotify("library://playlist/12"), null);
  assert.equal(uriDiSpotify("FV:2/12"), null);
  assert.equal(
    provenienzaDi("spotify://playlist/37i9dQZF1DXaaaaaaaaaaa"),
    "Music Assistant · Spotify",
  );
  assert.equal(provenienzaDi("library://playlist/12"), "Music Assistant");
  assert.equal(provenienzaDi("FV:2/12"), "Sonos");
  assert.equal(provenienzaDi("spotify:playlist:37i9dQZF1DXaaaaaaaaaaa"), "Spotify");
  assert.equal(provenienzaDi("media-source://media_source/local/x"), "Home Assistant");
});

test("come si suona fuori casa: Spotify nell'app, i file di casa solo con l'indirizzo da fuori, il resto in casa", () => {
  assert.deepEqual(comeSiSuona("spotify:playlist:37i9dQZF1DXaaaaaaaaaaa"), {
    come: "spotify",
    uri: "spotify:playlist:37i9dQZF1DXaaaaaaaaaaa",
  });
  assert.deepEqual(
    comeSiSuona("media-source://media_source/local/x", { esterno: "https://casa.esempio.it" }),
    {
      come: "flusso",
    },
  );
  assert.deepEqual(comeSiSuona("media-source://media_source/local/x"), { come: "casa" });
  assert.deepEqual(comeSiSuona("FV:2/12", { esterno: "https://casa.esempio.it" }), {
    come: "casa",
  });
  assert.deepEqual(comeSiSuona("library://playlist/12"), { come: "casa" });
});

test("nelle cartelle si prendono le playlist e si aprono solo le cartelle delle playlist", () => {
  const { playlist, daAprire } = playlistDellaCartella(ALBERI["media_player.studio|"]);
  assert.equal(playlist.length, 0);
  assert.deepEqual(
    daAprire.map((v) => v.titolo),
    ["Playlists"],
  );
});

test("l'elenco: radio in https, quelle solo http dette, playlist di ogni provenienza, Alexa", async () => {
  const casa = casaFinta();
  const rete = reteFinta();
  const m = new MusicaDellaCasa({ casa, prendi: rete.prendi });
  const r = await m.rispondi(
    { id: 1, type: DELLA_CASA },
    { valori: VALORI, profilo: "principale" },
  );
  assert.equal(r.success, true);
  const { radio, playlist } = r.result;

  assert.deepEqual(
    radio.map((v) => [v.titolo, v.come, v.flusso ?? null]),
    [
      ["Radio Lungomare", "flusso", "https://flussi.esempio.it/rl.mp3"],
      /* Solo http, ma risponde anche in https: si usa quello. */
      ["Onda Vesuviana", "flusso", "https://flussi.esempio.it/ov.aac"],
      /* Solo http, e in https non risponde: in auto no, e si dice perche'. */
      ["Radio Collina 98", "casa", null],
      /* Quella di Alexa con TuneIn, trovata per nome fra le radio italiane. */
      ["Radio Campanile", "flusso", "https://flussi.esempio.it/rc.mp3"],
    ],
  );
  assert.equal(radio[2].perche, "solo-http");
  /* I loghi letti qui, anche quello in http: al telefono arrivano i byte. */
  assert.equal(
    Buffer.from(radio[0].immagine.dati, "base64").toString(),
    "img:https://loghi.esempio.it/rl.png",
  );
  assert.equal(
    Buffer.from(radio[1].immagine.dati, "base64").toString(),
    "img:http://loghi.esempio.it/ov.png",
  );

  assert.deepEqual(
    playlist.map((v) => [v.titolo, v.come, v.provenienza, v.lettore, v.in_casa]),
    [
      ["Domenica mattina", "spotify", "Music Assistant · Spotify", "Studio", true],
      ["Classici italiani", "casa", "Music Assistant", "Studio", true],
      ["Ninne nanne", "flusso", "Home Assistant", "Studio", true],
      /* Sonos: solo in casa; il nome del lettore da Home Assistant. */
      ["Cena tranquilla", "casa", "Sonos", "Sonos Soggiorno", true],
      ["Hit della settimana", "cerca", "Alexa · Spotify", "Echo", true],
    ],
  );
  assert.equal(playlist[0].uri, "spotify:playlist:37i9dQZF1DXaaaaaaaaaaa");
  assert.equal(playlist[4].servizio, "spotify");
  assert.equal(playlist[4].cerca, "Hit della settimana");
  /* La miniatura di Home Assistant la da' Home Assistant. */
  assert.equal(Buffer.from(playlist[1].immagine.dati, "base64").toString(), "jpeg-di-casa");
  /* Gli artisti non si aprono: costano e non portano playlist. */
  assert.equal(
    casa.chieste.some(
      (c) => c.type === "media_player/browse_media" && c.media_content_id === "artists",
    ),
    false,
  );
  /* Nessun id di Home Assistant al telefono: solo gli id della voce. */
  assert.equal(JSON.stringify(r.result).includes("media_player."), false);
});

test("l'elenco si tiene dieci minuti: la seconda domanda non sfoglia la casa", async () => {
  let ora = 1_000_000;
  const casa = casaFinta();
  const m = new MusicaDellaCasa({ casa, prendi: reteFinta().prendi, adesso: () => ora });
  await m.elenco(VALORI, "principale");
  const prima = casa.chieste.length;
  ora += 60_000;
  await m.elenco(VALORI, "principale");
  assert.equal(casa.chieste.length, prima);
  ora += 11 * 60_000;
  await m.elenco(VALORI, "principale");
  assert.ok(casa.chieste.length > prima);
});

test("senza un indirizzo da fuori, i file di Home Assistant si suonano solo in casa", async () => {
  const m = new MusicaDellaCasa({ casa: casaFinta({ esterno: "" }), prendi: reteFinta().prendi });
  const { playlist } = await m.elenco(VALORI, "principale");
  assert.equal(playlist.find((v) => v.titolo === "Ninne nanne").come, "casa");
});

test("i brani di un file di casa, firmati adesso, con l'indirizzo da fuori", async () => {
  const m = new MusicaDellaCasa({ casa: casaFinta(), prendi: reteFinta().prendi });
  const { playlist } = await m.elenco(VALORI, "principale");
  const ninne = playlist.find((v) => v.titolo === "Ninne nanne");
  const r = await m.rispondi(
    { id: 2, type: FLUSSO, voce: ninne.id },
    { valori: VALORI, profilo: "principale" },
  );
  assert.deepEqual(r.result.brani, [
    {
      titolo: "Stella stellina",
      url: "https://casa.esempio.it/media/local/ninne/1.mp3?authSig=firma",
      mime: "audio/mpeg",
    },
    {
      titolo: "Fa' la nanna",
      url: "https://casa.esempio.it/media/local/ninne/2.mp3?authSig=firma",
      mime: "audio/mpeg",
    },
  ]);
  /* Una playlist di Sonos non da' brani: non si suona fuori casa. */
  const sonos = playlist.find((v) => v.titolo === "Cena tranquilla");
  const r2 = await m.rispondi(
    { id: 3, type: FLUSSO, voce: sonos.id },
    { valori: VALORI, profilo: "principale" },
  );
  assert.deepEqual(r2.result.brani, []);
});

test("«falla partire in casa»: il suo lettore, o gli Echo; una voce che non c'e' no", async () => {
  const casa = casaFinta();
  const m = new MusicaDellaCasa({ casa, prendi: reteFinta().prendi });
  const { playlist } = await m.elenco(VALORI, "principale");
  const sonos = playlist.find((v) => v.titolo === "Cena tranquilla");
  const r = await m.rispondi(
    { id: 4, type: IN_CASA, voce: sonos.id },
    { valori: VALORI, profilo: "principale" },
  );
  assert.deepEqual(r.result, { fatto: true, lettore: "Sonos Soggiorno" });
  const chiamata = casa.chieste.findLast((c) => c.type === "call_service");
  assert.deepEqual(chiamata, {
    type: "call_service",
    domain: "media_player",
    service: "play_media",
    service_data: {
      entity_id: "media_player.sonos_soggiorno",
      media_content_id: "FV:2/12",
      media_content_type: "favorite_item_id",
    },
  });
  const alexa = playlist.find((v) => v.come === "cerca");
  const r2 = await m.rispondi(
    { id: 5, type: IN_CASA, voce: alexa.id },
    { valori: VALORI, profilo: "principale" },
  );
  assert.equal(r2.result.fatto, true);
  assert.deepEqual(casa.chieste.findLast((c) => c.type === "call_service").service_data, {
    entity_id: ["media_player.echo_cucina"],
    media_content_id: "Hit della settimana",
    media_content_type: "SPOTIFY",
  });
  const r3 = await m.rispondi(
    { id: 6, type: IN_CASA, voce: "pinventato" },
    { valori: VALORI, profilo: "principale" },
  );
  assert.equal(r3.success, false);
  assert.equal(r3.error.code, "not_found");
});

test("dalla porta delle commissioni: solo chi e' entrato, sulla plancia che vede", async () => {
  const casa = casaFinta();
  const configurazione = {
    leggi: () => ({ snapshot: { values: VALORI } }),
  };
  const commissioni = new Commissioni({
    casa,
    configurazione,
    musica: new MusicaDellaCasa({ casa, prendi: reteFinta().prendi }),
  });
  commissioni._nienteIntegrazione = true;
  const senza = await commissioni.rispondi(
    { id: 7, type: DELLA_CASA },
    { chiChiede: "", dalTelefono: true },
  );
  assert.equal(senza.success, false);
  assert.equal(senza.error.code, "unauthorized");
  const con = await commissioni.rispondi(
    { id: 8, type: DELLA_CASA },
    { chiChiede: UTENTE, dalTelefono: true },
  );
  assert.equal(con.success, true);
  assert.equal(con.result.radio[0].titolo, "Radio Lungomare");
  const altro = await commissioni.rispondi(
    { id: 9, type: "ponte/musica/inventato" },
    { chiChiede: UTENTE },
  );
  assert.equal(altro.error.code, "unknown_command");
});
