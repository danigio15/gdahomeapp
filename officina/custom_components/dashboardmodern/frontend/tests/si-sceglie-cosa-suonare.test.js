/* Scegliere cosa suonare, e non solo alzare il volume a quello che suona.
 *
 * «Con Sonos e Music Assistant, dalla plancia non si riesce a scegliere cosa
 * suonare.» La scheda Musica sapeva la pausa, il brano avanti, il volume e la
 * sorgente: tutte cose che si fanno a qualcosa che qualcun altro ha fatto
 * partire da un'altra app. Adesso il lettore dichiara la sua libreria, la
 * finestra la sfoglia, e un tocco la fa partire.
 *
 * Questa prova tiene ferme tre cose, e sono le tre che, sbagliate, si vedono
 * subito in casa: che il tasto compaia SOLO dove il lettore sa davvero
 * sfogliare e ricevere un brano; che la domanda a Home Assistant sia quella
 * giusta, radice compresa; e che il filo per risalire non si allunghi da solo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { SA, letturaDelLettore } from "../src/core/media-player.js";
import {
  DOMANDA_SFOGLIA,
  ilComandoPerSuonare,
  ilFiloDallaRadice,
  ilFiloDopo,
  ilFiloFinoA,
  ilPassoDiAdesso,
  laCartella,
  laDomandaPerSfogliare,
  laMiniatura,
  unaVoceDaSfogliare,
} from "../src/core/sfoglia-i-media.js";

const lettura = (bandiere, stato = "playing") =>
  letturaDelLettore(
    { entity: "media_player.cucina" },
    {
      "media_player.cucina": {
        state: stato,
        attributes: { friendly_name: "Cucina", supported_features: bandiere },
      },
    },
  );

/* Quello che dichiarano davvero i lettori che contano qui. Non sono numeri
 * inventati: sono le somme delle bandiere di `MediaPlayerEntityFeature` come
 * le mandano quelle integrazioni. */
const MUSIC_ASSISTANT =
  SA.PAUSA |
  SA.VOLUME |
  SA.MUTO |
  SA.PRECEDENTE |
  SA.SUCCESSIVO |
  SA.SUONA |
  SA.SFOGLIA |
  SA.ACCODA;
const SONOS = SA.PAUSA | SA.VOLUME | SA.MUTO | SA.SUONA | SA.SFOGLIA | SA.ACCODA;
/* Un televisore LG: accende, spegne, cambia sorgente. Di libreria niente. */
const TELEVISORE = SA.ACCENDI | SA.SPEGNI | SA.SORGENTE | SA.VOLUME;
/* Una radio web: suona quello che le si manda, ma non ha niente da elencare. */
const RADIO = SA.VOLUME | SA.SUONA;

test("sfoglia solo chi sa elencare E ricevere un brano", () => {
  assert.equal(lettura(MUSIC_ASSISTANT).puo.sfoglia, true);
  assert.equal(lettura(SONOS).puo.sfoglia, true);
  assert.equal(lettura(TELEVISORE).puo.sfoglia, false);
  assert.equal(lettura(RADIO).puo.sfoglia, false);
  /* Il caso che conta: sa elencare ma non sa ricevere. La finestra si
   * aprirebbe su un elenco da cui non si esce con niente — che e' la stessa
   * cosa di un tasto rotto, e questa scheda i tasti rotti non li disegna. */
  assert.equal(lettura(SA.SFOGLIA | SA.VOLUME).puo.sfoglia, false);
});

test("la coda la sa solo chi l'ha dichiarata", () => {
  assert.equal(lettura(MUSIC_ASSISTANT).puo.accoda, true);
  /* Su un Chromecast «accoda» sostituisce quello che sta suonando: chi lo
   * premeva perdeva il brano, quindi quel tasto non c'e'. */
  assert.equal(lettura(SA.PAUSA | SA.SUONA | SA.SFOGLIA).puo.accoda, false);
});

test("la radice non si chiede mandando un contenuto vuoto", () => {
  /* Home Assistant distingue «non me l'hai detto» da «me l'hai detto vuoto»:
   * col vuoto risponde che quel contenuto non esiste, e la finestra si
   * aprirebbe su un errore invece che sulla libreria. */
  assert.deepEqual(laDomandaPerSfogliare("media_player.cucina"), {
    type: DOMANDA_SFOGLIA,
    entity_id: "media_player.cucina",
  });
  assert.deepEqual(laDomandaPerSfogliare("media_player.cucina", { id: "  ", tipo: "album" }), {
    type: DOMANDA_SFOGLIA,
    entity_id: "media_player.cucina",
  });
  /* E il tipo viaggia con l'id, perche' da solo non identifica niente. */
  assert.deepEqual(
    laDomandaPerSfogliare("media_player.cucina", { id: "library://playlist/3", tipo: "playlist" }),
    {
      type: DOMANDA_SFOGLIA,
      entity_id: "media_player.cucina",
      media_content_id: "library://playlist/3",
      media_content_type: "playlist",
    },
  );
  assert.equal(laDomandaPerSfogliare("cucina"), null);
  assert.equal(laDomandaPerSfogliare(""), null);
});

test("una voce su cui non si puo' fare niente non entra nell'elenco", () => {
  const sfogliabile = unaVoceDaSfogliare({
    media_content_id: "library://artist/9",
    media_content_type: "artist",
    media_class: "artist",
    title: "Paolo Conte",
    can_expand: true,
    can_play: false,
  });
  assert.equal(sfogliabile.sfogliabile, true);
  assert.equal(sfogliabile.suonabile, false);
  /* Ne' si apre ne' si suona: sarebbe una riga che non fa niente. */
  assert.equal(
    unaVoceDaSfogliare({ media_content_id: "x", can_expand: false, can_play: false }),
    null,
  );
  /* Senza id non si puo' rimandare indietro niente. */
  assert.equal(unaVoceDaSfogliare({ title: "Senza id", can_play: true }), null);
  /* Il titolo, quando manca, e' l'id: meglio una riga brutta che una vuota. */
  assert.equal(
    unaVoceDaSfogliare({ media_content_id: "library://track/1", can_play: true }).titolo,
    "library://track/1",
  );
});

test("le cartelle prima dei brani, e quelle lasciate fuori si contano", () => {
  const cartella = laCartella({
    title: "Musica",
    media_content_id: "library://",
    media_class: "directory",
    not_shown: 40,
    children: [
      { media_content_id: "t/1", title: "Via con me", can_play: true },
      { media_content_id: "p/1", title: "Playlist", can_expand: true, can_play: true },
      { media_content_id: "niente", title: "Ne' l'uno ne' l'altro" },
      { media_content_id: "a/1", title: "Artisti", can_expand: true },
    ],
  });
  assert.equal(cartella.titolo, "Musica");
  assert.deepEqual(
    cartella.voci.map((voce) => voce.titolo),
    ["Playlist", "Artisti", "Via con me"],
  );
  /* Le quaranta che ha lasciato fuori Home Assistant piu' l'una che abbiamo
   * lasciato fuori noi: dirlo e' meglio che far credere che la cartella
   * contenga solo questo. */
  assert.equal(cartella.nonMostrate, 41);
  assert.deepEqual(laCartella(null).voci, []);
  assert.equal(laCartella({ children: "no" }).nonMostrate, 0);
});

test("una miniatura che non e' un indirizzo non finisce in un url()", () => {
  assert.equal(laMiniatura("https://i.scdn.co/image/ab67.jpg"), "https://i.scdn.co/image/ab67.jpg");
  assert.equal(laMiniatura("/api/media_player_proxy/media_player.cucina"), "/api/media_player_proxy/media_player.cucina");
  /* Un riferimento interno in un «src» non ci va, e nemmeno del codice: una
   * miniatura arriva da fuori — da Spotify, da TuneIn — e non e' un posto da
   * cui accettare qualcosa da eseguire. */
  assert.equal(laMiniatura("media-source://media_source/local/x.jpg"), "");
  assert.equal(laMiniatura("javascript:alert(1)"), "");
  assert.equal(laMiniatura("//altrove.example/x.jpg"), "");
  assert.equal(laMiniatura(null), "");
});

test("il comando che fa partire, e quello che accoda", () => {
  const voce = { id: "library://playlist/3", tipo: "playlist", suonabile: true };
  assert.deepEqual(ilComandoPerSuonare("media_player.cucina", voce), {
    domain: "media_player",
    service: "play_media",
    data: {
      entity_id: "media_player.cucina",
      media_content_id: "library://playlist/3",
      media_content_type: "playlist",
    },
  });
  assert.equal(ilComandoPerSuonare("media_player.cucina", voce, "coda").data.enqueue, "add");
  /* Una cartella che non si suona non si manda: «play_media» su un artista di
   * Music Assistant non da' errore e non fa niente. */
  assert.equal(ilComandoPerSuonare("media_player.cucina", { id: "a/1", suonabile: false }), null);
  assert.equal(ilComandoPerSuonare("cucina", voce), null);
});

test("il filo per risalire non si allunga da solo", () => {
  let filo = ilFiloDallaRadice("Da ascoltare");
  assert.equal(filo.length, 1);
  assert.equal(ilPassoDiAdesso(filo).id, "");
  filo = ilFiloDopo(filo, { id: "p/1", tipo: "playlist", titolo: "Playlist" });
  filo = ilFiloDopo(filo, { id: "p/2", tipo: "playlist", titolo: "Serata" });
  assert.equal(filo.length, 3);
  assert.equal(ilPassoDiAdesso(filo).titolo, "Serata");
  /* Due tocchi sulla stessa cartella, o una cartella che contiene se' stessa:
   * il filo torna li' invece di crescere di una briciola identica. */
  filo = ilFiloDopo(filo, { id: "p/1", titolo: "Playlist" });
  assert.deepEqual(
    filo.map((passo) => passo.id),
    ["", "p/1"],
  );
  /* Tornare a un passo vuol dire quello e tutti quelli prima. */
  assert.deepEqual(ilFiloFinoA(filo, 0).length, 1);
  assert.deepEqual(ilFiloFinoA(filo, 9), filo, "un passo che non c'e' non cambia niente");
  assert.deepEqual(ilFiloFinoA(filo, -1), filo);
});
