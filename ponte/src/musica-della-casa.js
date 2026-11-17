/* La musica della casa, da ascoltare in auto (GdANav dentro GdAHome).
 *
 * «Se ho playlist e stazioni radio salvate sulla casa, dall'auto devo avere
 * la possibilita' di riprodurle IN AUTO.» Quindi nel telefono, che le manda
 * alle casse dell'auto: non sui lettori di casa.
 *
 * Tre domande, dal filo di un telefono abbinato **con un utente** (senza,
 * `unauthorized`, come ogni commissione), sulla plancia che quell'utente
 * vede (la sceglie `commissioni.js`, con le stesse regole delle plance):
 *
 *  - `ponte/musica/della-casa`: le radio preferite (Config › Musica › Radio,
 *    e quelle di Alexa con TuneIn) e le playlist che si vedono nella pagina
 *    Musica, dai lettori configurati (`media_player/browse_media`, come la
 *    finestra «Sfoglia la libreria») e dai preferiti di Alexa. Per ogni voce:
 *    il titolo, l'immagine (letta qui, piccola: il telefono non va a cercarla
 *    in rete, tanto meno in chiaro), da dove viene, e **come si suona fuori
 *    casa** (`come`, vedi `comeSiSuona`);
 *  - `ponte/musica/flusso`: i brani di una voce da suonare col lettore del
 *    telefono, firmati adesso (un file di Home Assistant);
 *  - `ponte/musica/in-casa`: la fa partire sul suo lettore di casa, per
 *    quelle che al telefono non arrivano. Solo le voci dell'elenco di quella
 *    plancia: il telefono dice quale voce, non che servizio chiamare.
 *
 * Come si suona fuori casa, voce per voce:
 *
 *  - una radio di Radio Browser: Home Assistant da' l'indirizzo vero del
 *    flusso (`media_source/resolve_media`), che e' su internet, fuori casa.
 *    Solo `https`: il telefono la rete in chiaro non la apre (la regola
 *    dell'app GdAHome, e di iOS). Una radio che ha solo `http` si prova a
 *    chiedere in `https`; se non risponde, si suona solo in casa, e si dice;
 *  - una playlist di Spotify (l'integrazione Spotify, o Music Assistant con
 *    Spotify): l'URI `spotify:playlist:…`, che il telefono da' all'app;
 *  - un file di Home Assistant (`media-source://…`): solo se Home Assistant
 *    ha un indirizzo da fuori (`external_url`), e allora si firma al momento
 *    di suonarlo, per 24 ore (`ponte/musica/flusso`);
 *  - un preferito di Alexa («Hit della settimana» su Spotify): lo si cerca
 *    nell'app di quel servizio sul telefono, se c'e';
 *  - tutto il resto (Sonos, la libreria di Music Assistant, Chromecast):
 *    solo sui lettori di casa. Si mostra lo stesso, con scritto cosi'.
 *
 * Sfogliare costa (Music Assistant chiede a Spotify): l'elenco si tiene
 * dieci minuti per plancia, le immagini e i flussi risolti qualche ora. Niente
 * esce di casa se non verso i server delle radio e delle immagini, che il
 * telefono avrebbe contattato comunque; nel ponte non si vede niente.
 */

import { createHash } from "node:crypto";

import {
  CHIAVE_RADIO,
  RADIO_DEL_PAESE,
  domandaDelleRadio,
  normalizzaRadio,
  stazioneDalNome,
  stazioniDellaRisposta,
} from "../plancia/src/core/radio.js";
import { CHIAVE_MEDIA, lettoriConfigurati } from "../plancia/src/core/media-player.js";
import { laCartella, laDomandaPerSfogliare } from "../plancia/src/core/sfoglia-i-media.js";
import { CHIAVE_ALEXA, normalizzaAlexa } from "../plancia/src/core/alexa-annunci.js";
import { SERVIZI_MUSICA, chiamataPerSuonare } from "../plancia/src/core/alexa-musica.js";

export const DELLA_CASA = "ponte/musica/della-casa";
export const FLUSSO = "ponte/musica/flusso";
export const IN_CASA = "ponte/musica/in-casa";
const DOMANDE = new Set([DELLA_CASA, FLUSSO, IN_CASA]);

/** Quanto vale l'elenco di una plancia, e le cose lette fuori. */
export const ELENCO_VALE_MS = 10 * 60 * 1000;
const IMMAGINE_VALE_MS = 6 * 60 * 60 * 1000;
const FLUSSO_VALE_MS = 6 * 60 * 60 * 1000;

/** Quante al piu', e quanto grandi. */
export const PLAYLIST_AL_PIU = 40;
export const LETTORI_AL_PIU = 8;
const DOMANDE_PER_LETTORE = 6;
export const IMMAGINE_AL_PIU = 96 * 1024;
export const IMMAGINI_IN_TUTTO = 1536 * 1024;
const BRANI_AL_PIU = 50;

const pulito = (valore) => String(valore ?? "").trim();

/** Un id corto e stabile per una voce: la stessa voce, lo stesso id. */
export function idDellaVoce(tipo, ...parti) {
  return `${tipo}${createHash("sha1").update(parti.map(pulito).join("|")).digest("hex").slice(0, 14)}`;
}

/* Spotify, in tutte le forme in cui arriva: `spotify:playlist:…` (l'integrazione
 * Spotify, anche dentro `spotify://<voce>/spotify:playlist:…`), il link
 * `open.spotify.com/playlist/…`, e Music Assistant (`spotify://playlist/…`,
 * `spotify--abc://playlist/…`). */
const SPOTIFY_URI = /spotify:(playlist|album):([A-Za-z0-9]{10,40})(?![A-Za-z0-9])/;
const SPOTIFY_LINK = /^https?:\/\/open\.spotify\.com\/(playlist|album)\/([A-Za-z0-9]{10,40})/;
const SPOTIFY_MA = /^spotify(?:--[a-z0-9]+)?:\/\/(playlist|album)\/([A-Za-z0-9]{10,40})$/i;

/** L'URI di Spotify di quella voce, se e' di Spotify; altrimenti null. */
export function uriDiSpotify(id) {
  const testo = pulito(id);
  for (const forma of [SPOTIFY_URI, SPOTIFY_LINK, SPOTIFY_MA]) {
    const trovato = testo.match(forma);
    if (trovato) return `spotify:${trovato[1].toLowerCase()}:${trovato[2]}`;
  }
  return null;
}

/* Gli id di Music Assistant: `library://playlist/12`, `deezer://playlist/…`. */
const DI_MUSIC_ASSISTANT = /^[a-z][a-z0-9-]*:\/\/(playlist|album|track|artist|radio)\//i;

/** Da dove viene una voce, detto in parole: «Spotify», «Sonos», «Music Assistant». */
export function provenienzaDi(id) {
  const testo = pulito(id);
  if (!testo) return "";
  if (/^media-source:\/\//.test(testo)) return "Home Assistant";
  if (SPOTIFY_MA.test(testo)) return "Music Assistant · Spotify";
  if (DI_MUSIC_ASSISTANT.test(testo)) return "Music Assistant";
  if (uriDiSpotify(testo)) return "Spotify";
  if (/^(FV|SQ|S|x-rincon[a-z-]*):/i.test(testo)) return "Sonos";
  return "";
}

/**
 * Come si suona fuori casa una playlist dei lettori di casa:
 * `{come: "spotify", uri}`, `{come: "flusso"}` (un file di Home Assistant,
 * se Home Assistant si raggiunge da fuori: [esterno]) o `{come: "casa"}`.
 */
export function comeSiSuona(id, { esterno = "" } = {}) {
  const testo = pulito(id);
  const uri = uriDiSpotify(testo);
  if (uri) return { come: "spotify", uri };
  if (
    /^media-source:\/\//.test(testo) &&
    !/^media-source:\/\/radio_browser\//.test(testo) &&
    esterno
  )
    return { come: "flusso" };
  return { come: "casa" };
}

/** I servizi di Alexa per nome, come li vuole il telefono. */
const SERVIZIO_DEL_TELEFONO = Object.freeze({
  SPOTIFY: "spotify",
  AMAZON_MUSIC: "amazon",
  APPLE_MUSIC: "apple",
  DEEZER: "deezer",
});

/* Le cartelle in cui stanno le playlist, nell'albero di un lettore: le
 * «Playlists» di Music Assistant e di Spotify, i «Favorites» e la libreria di
 * Sonos. Le altre (artisti, album, generi) non si aprono: costano e non
 * portano playlist. */
const CARTELLA_DI_PLAYLIST = /playlist|favorit|preferit|library|libreri/i;

/** Le playlist di una cartella, e le cartelle in cui cercarne altre. */
export function playlistDellaCartella(risposta) {
  const cartella = laCartella(risposta);
  const playlist = cartella.voci.filter((voce) => voce.classe === "playlist" && voce.suonabile);
  const daAprire = cartella.voci.filter(
    (voce) =>
      voce.sfogliabile &&
      voce.classe !== "playlist" &&
      CARTELLA_DI_PLAYLIST.test(`${voce.titolo} ${voce.id} ${voce.tipo}`),
  );
  return { playlist, daAprire };
}

const MIME_AUDIO = /^(audio\/|application\/(ogg|x-mpegurl|vnd\.apple\.mpegurl|octet-stream))/i;

export class MusicaDellaCasa {
  constructor({ casa, registro = null, prendi = globalThis.fetch, adesso = Date.now } = {}) {
    this.casa = casa;
    this.registro = registro ?? { info() {}, attenzione() {}, errore() {} };
    this.prendi = prendi;
    this.adesso = adesso;
    /* Per plancia: l'elenco, quando, e le voci per id (con quello che serve
     * a suonarle: il lettore, l'id di Home Assistant). */
    this._elenchi = new Map();
    this._inCorso = new Map();
    this._immagini = new Map();
    this._flussi = new Map();
    this._sicuri = new Map();
  }

  riconosce(tipo) {
    return DOMANDE.has(tipo);
  }

  /* `valori`: la configurazione della plancia che chi chiede vede; `profilo`
   * la plancia. Chi chiede l'ha gia' controllato `commissioni.js`. */
  async rispondi(detto, { valori = {}, profilo = "" } = {}) {
    const id = detto?.id ?? null;
    try {
      if (detto?.type === DELLA_CASA)
        return si(id, await this.elenco(valori, profilo, detto?.forza === true));
      const voce = await this._voce(valori, profilo, pulito(detto?.voce));
      if (!voce) return no(id, "not_found", "quella voce non c'e' (piu')");
      if (detto?.type === FLUSSO) return si(id, { brani: await this._brani(voce) });
      if (detto?.type === IN_CASA) return si(id, await this._inCasa(voce));
      return no(id, "unknown_command", `non conosco ${detto?.type}`);
    } catch (errore) {
      this.registro.errore?.(`musica di casa: ${errore?.message || errore}`);
      return no(id, "ponte_musica", "non ha funzionato");
    }
  }

  async _voce(valori, profilo, id) {
    if (!id) return null;
    let tenuto = this._elenchi.get(profilo);
    if (!tenuto) {
      await this.elenco(valori, profilo);
      tenuto = this._elenchi.get(profilo);
    }
    return tenuto?.voci.get(id) ?? null;
  }

  /** L'elenco per il telefono: `{radio, playlist, letto}`. */
  async elenco(valori, profilo, forza = false) {
    const tenuto = this._elenchi.get(profilo);
    if (!forza && tenuto && this.adesso() - tenuto.letto < ELENCO_VALE_MS) return tenuto.risposta;
    /* Due telefoni insieme non sfogliano due volte la casa. */
    if (this._inCorso.has(profilo)) return this._inCorso.get(profilo);
    const lavoro = this._mettiInsieme(valori)
      .then((fatto) => {
        this._elenchi.set(profilo, fatto);
        return fatto.risposta;
      })
      .finally(() => this._inCorso.delete(profilo));
    this._inCorso.set(profilo, lavoro);
    return lavoro;
  }

  async _mettiInsieme(valori) {
    const voci = new Map();
    const letto = this.adesso();
    const esterno = await this._indirizzoDaFuori();
    const radio = await this._leRadio(valori, voci);
    const playlist = [
      ...(await this._lePlaylistDeiLettori(valori, voci, esterno)),
      ...this._iPreferitiDiAlexa(valori, voci),
    ].slice(0, PLAYLIST_AL_PIU);
    /* Le immagini, piccole e in tutto non troppe: prima le radio. */
    let spazio = IMMAGINI_IN_TUTTO;
    for (const una of [...radio, ...playlist]) {
      const sorgente = una._immagine;
      delete una._immagine;
      if (!sorgente || spazio <= 0) continue;
      const immagine = await this._immagine(sorgente);
      if (!immagine || immagine.dati.length > spazio) continue;
      spazio -= immagine.dati.length;
      una.immagine = immagine;
    }
    return { letto, voci, risposta: { letto, radio, playlist } };
  }

  /* Le radio preferite, coi flussi risolti da Home Assistant. */
  async _leRadio(valori, voci) {
    const preferite = normalizzaRadio(valori?.[CHIAVE_RADIO] ?? null).preferite;
    const viste = new Set(preferite.map((una) => una.nome.toLowerCase()));
    /* E quelle di Alexa con TuneIn, che hanno solo il nome: si cercano fra le
     * radio italiane di Radio Browser, come fa la pagina Musica. */
    const perNome = normalizzaAlexa(valori?.[CHIAVE_ALEXA] ?? null)
      .musica.filter((uno) => uno.servizio === "TUNEIN" && !viste.has(uno.cosa.toLowerCase()))
      .map((uno) => ({ nome: uno.cosa, id: "", tipo: "", logo: "" }));
    let delPaese = null;
    const risultato = [];
    for (const stazione of [...preferite, ...perNome]) {
      let una = stazione;
      if (!una.id) {
        delPaese ??= await this._radioDelPaese();
        const trovata = stazioneDalNome(delPaese, una.nome);
        if (trovata) una = { ...trovata, nome: una.nome };
      }
      const id = idDellaVoce("r", una.id || una.nome);
      const flusso = una.id ? await this._flussoDellaRadio(una.id) : null;
      const voce = {
        id,
        titolo: una.nome,
        provenienza: "Radio Browser",
        come: flusso ? "flusso" : "casa",
        ...(flusso ? { flusso: flusso.url, mime: flusso.mime } : {}),
        in_casa: false,
        _immagine: una.logo || "",
      };
      if (!flusso) voce.perche = una.id ? "solo-http" : "non-trovata";
      voci.set(id, { tipo: "radio", stazione: una });
      risultato.push(voce);
    }
    return risultato;
  }

  async _radioDelPaese() {
    try {
      const risposta = await this.casa.chiedi(domandaDelleRadio(RADIO_DEL_PAESE), { entro: 8000 });
      return stazioniDellaRisposta(risposta);
    } catch (_errore) {
      return [];
    }
  }

  /* L'indirizzo vero di una radio, in `https`. Home Assistant lo chiede a
   * Radio Browser; si tiene qualche ora (ogni domanda e' un «clic» per loro). */
  async _flussoDellaRadio(idRadio) {
    const tenuto = this._flussi.get(idRadio);
    if (tenuto && this.adesso() - tenuto.quando < FLUSSO_VALE_MS) return tenuto.flusso;
    let flusso = null;
    try {
      const r = await this.casa.chiedi(
        { type: "media_source/resolve_media", media_content_id: idRadio },
        { entro: 8000 },
      );
      const url = await this._inHttps(pulito(r?.url));
      if (url) flusso = { url, mime: pulito(r?.mime_type) || null };
    } catch (_errore) {
      flusso = null;
    }
    this._flussi.set(idRadio, { flusso, quando: this.adesso() });
    return flusso;
  }

  /* Un indirizzo che il telefono puo' aprire: `https`, o la stessa radio in
   * `https` se risponde con dell'audio. Altrimenti null. */
  async _inHttps(url) {
    if (/^https:\/\//i.test(url)) return url;
    if (!/^http:\/\//i.test(url)) return null;
    const sicuro = url.replace(/^http:/i, "https:");
    const tenuto = this._sicuri.get(sicuro);
    if (tenuto && this.adesso() - tenuto.quando < FLUSSO_VALE_MS) return tenuto.ok ? sicuro : null;
    let ok = false;
    try {
      const risposta = await this.prendi(sicuro, {
        headers: { "icy-metadata": "0" },
        signal: AbortSignal.timeout(5000),
      });
      const tipo = String(risposta.headers?.get?.("content-type") || "");
      ok = risposta.ok && (!tipo || MIME_AUDIO.test(tipo));
      await risposta.body?.cancel?.();
    } catch (_errore) {
      ok = false;
    }
    this._sicuri.set(sicuro, { ok, quando: this.adesso() });
    return ok ? sicuro : null;
  }

  /* Dove si raggiunge Home Assistant da fuori, se lo sa: serve ai suoi file. */
  async _indirizzoDaFuori() {
    try {
      const config = await this.casa.chiedi({ type: "get_config" }, { entro: 5000 });
      const fuori = pulito(config?.external_url);
      return /^https:\/\//i.test(fuori) ? fuori.replace(/\/+$/, "") : "";
    } catch (_errore) {
      return "";
    }
  }

  /* Le playlist dei lettori della pagina Musica: si apre la radice e le
   * cartelle delle playlist, al piu' due piani sotto. */
  async _lePlaylistDeiLettori(valori, voci, esterno) {
    const lettori = lettoriConfigurati(valori?.[CHIAVE_MEDIA] ?? null).slice(0, LETTORI_AL_PIU);
    const viste = new Set();
    const risultato = [];
    for (const lettore of lettori) {
      const nome = lettore.nome || (await this._nomeDi(lettore.entity));
      const coda = [{ id: "", tipo: "", piano: 0 }];
      let domande = 0;
      while (coda.length && domande < DOMANDE_PER_LETTORE && risultato.length < PLAYLIST_AL_PIU) {
        const dove = coda.shift();
        const domanda = laDomandaPerSfogliare(lettore.entity, dove);
        if (!domanda) break;
        domande += 1;
        let risposta;
        try {
          risposta = await this.casa.chiedi(domanda, { entro: 12000 });
        } catch (_errore) {
          /* Un lettore spento o che non sa sfogliare: si passa al prossimo. */
          break;
        }
        const { playlist, daAprire } = playlistDellaCartella(risposta);
        for (const una of playlist) {
          if (viste.has(una.id)) continue;
          viste.add(una.id);
          const id = idDellaVoce("p", lettore.entity, una.id);
          const come = comeSiSuona(una.id, { esterno });
          risultato.push({
            id,
            titolo: una.titolo,
            provenienza: provenienzaDi(una.id) || nome,
            lettore: nome,
            ...come,
            in_casa: true,
            _immagine: una.miniatura,
          });
          voci.set(id, {
            tipo: "playlist",
            entity: lettore.entity,
            mediaId: una.id,
            mediaTipo: una.tipo,
            esterno,
          });
        }
        if (dove.piano < 2)
          for (const una of daAprire)
            coda.push({ id: una.id, tipo: una.tipo, piano: dove.piano + 1 });
      }
    }
    return risultato;
  }

  /* Gli stati della casa, chiesti una volta al minuto al piu'. */
  async _stati() {
    if (this._statiLetti && this.adesso() - this._statiLetti.quando < 60_000)
      return this._statiLetti.stati;
    let stati = [];
    try {
      const r = await this.casa.chiedi({ type: "get_states" }, { entro: 8000 });
      stati = Array.isArray(r) ? r : [];
    } catch (_errore) {
      stati = [];
    }
    this._statiLetti = { stati, quando: this.adesso() };
    return stati;
  }

  async _nomeDi(entity) {
    const suo = (await this._stati()).find((uno) => uno?.entity_id === entity);
    return pulito(suo?.attributes?.friendly_name) || entity;
  }

  /* I preferiti di Alexa › Musica (non TuneIn: quelle sono radio): una
   * ricerca nel servizio, sul telefono nell'app di quel servizio. */
  _iPreferitiDiAlexa(valori, voci) {
    const alexa = normalizzaAlexa(valori?.[CHIAVE_ALEXA] ?? null);
    const nomeDi = (servizio) =>
      SERVIZI_MUSICA.find((uno) => uno.id === servizio)?.nome || servizio;
    return alexa.musica
      .filter((uno) => uno.servizio !== "TUNEIN")
      .map((uno) => {
        const id = idDellaVoce("a", uno.servizio, uno.cosa);
        voci.set(id, {
          tipo: "alexa",
          servizio: uno.servizio,
          cosa: uno.cosa,
          echo: alexa.altoparlanti,
        });
        const servizio = SERVIZIO_DEL_TELEFONO[uno.servizio];
        return {
          id,
          titolo: uno.cosa,
          provenienza: `Alexa · ${nomeDi(uno.servizio)}`,
          lettore: alexa.altoparlanti.length ? "Echo" : undefined,
          come: servizio ? "cerca" : "casa",
          ...(servizio ? { servizio, cerca: uno.cosa } : {}),
          in_casa: alexa.altoparlanti.length > 0,
        };
      });
  }

  /* Un'immagine piccola: `{tipo, dati}` in base64, o null. Le miniature di
   * Home Assistant (`/api/…`) le da' Home Assistant; le altre il loro server. */
  async _immagine(sorgente) {
    const tenuta = this._immagini.get(sorgente);
    if (tenuta && this.adesso() - tenuta.quando < IMMAGINE_VALE_MS) return tenuta.immagine;
    let immagine = null;
    try {
      let byte = null;
      let tipo = "";
      if (sorgente.startsWith("/api/")) {
        byte = await this.casa.immagine(sorgente.slice("/api/".length));
        tipo = "image/jpeg";
      } else if (/^https?:\/\//i.test(sorgente)) {
        const risposta = await this.prendi(sorgente, { signal: AbortSignal.timeout(6000) });
        tipo = String(risposta.headers?.get?.("content-type") || "")
          .split(";")[0]
          .trim();
        if (risposta.ok && tipo.startsWith("image/"))
          byte = Buffer.from(await risposta.arrayBuffer());
      }
      if (byte && byte.length > 0 && byte.length <= IMMAGINE_AL_PIU)
        immagine = { tipo: tipo || "image/jpeg", dati: byte.toString("base64") };
    } catch (_errore) {
      immagine = null;
    }
    this._immagini.set(sorgente, { immagine, quando: this.adesso() });
    return immagine;
  }

  /* I brani di un file (o di una cartella) di Home Assistant, firmati adesso
   * e con l'indirizzo da fuori: si suonano nel telefono. */
  async _brani(voce) {
    if (voce.tipo === "radio") {
      const flusso = voce.stazione?.id ? await this._flussoDellaRadio(voce.stazione.id) : null;
      return flusso ? [{ titolo: voce.stazione.nome, url: flusso.url, mime: flusso.mime }] : [];
    }
    if (
      voce.tipo !== "playlist" ||
      comeSiSuona(voce.mediaId, { esterno: voce.esterno }).come !== "flusso"
    )
      return [];
    const firma = async (id, titolo) => {
      const r = await this.casa.chiedi(
        { type: "media_source/resolve_media", media_content_id: id },
        { entro: 8000 },
      );
      const url = pulito(r?.url);
      const intero = url.startsWith("/") ? `${voce.esterno}${url}` : url;
      return /^https:\/\//i.test(intero)
        ? { titolo, url: intero, mime: pulito(r?.mime_type) || null }
        : null;
    };
    const cartella = await this.casa
      .chiedi(
        { type: "media_source/browse_media", media_content_id: voce.mediaId },
        { entro: 8000 },
      )
      .catch(() => null);
    const figli = Array.isArray(cartella?.children) ? cartella.children : [];
    if (!figli.length) return [await firma(voce.mediaId, pulito(cartella?.title))].filter(Boolean);
    const brani = [];
    for (const figlio of figli.filter(
      (uno) => uno?.can_play === true && uno?.can_expand !== true,
    )) {
      if (brani.length >= BRANI_AL_PIU) break;
      const uno = await firma(figlio.media_content_id, pulito(figlio.title)).catch(() => null);
      if (uno) brani.push(uno);
    }
    return brani;
  }

  /* La fa partire in casa, sul suo lettore (o sugli Echo, per Alexa). */
  async _inCasa(voce) {
    let chiamata = null;
    let lettore = "";
    if (voce.tipo === "playlist") {
      chiamata = {
        domain: "media_player",
        service: "play_media",
        data: {
          entity_id: voce.entity,
          media_content_id: voce.mediaId,
          media_content_type: voce.mediaTipo || "playlist",
        },
      };
      lettore = await this._nomeDi(voce.entity);
    } else if (voce.tipo === "alexa") {
      const stati = await this._stati();
      chiamata = chiamataPerSuonare(
        { echo: voce.echo, servizio: voce.servizio, cosa: voce.cosa },
        stati,
      );
      lettore = "Echo";
    }
    if (!chiamata) return { fatto: false };
    await this.casa.chiedi(
      {
        type: "call_service",
        domain: chiamata.domain,
        service: chiamata.service,
        service_data: chiamata.data,
      },
      { entro: 10000 },
    );
    return { fatto: true, lettore };
  }
}

function si(id, result) {
  return { id, type: "result", success: true, result };
}

function no(id, code, message) {
  return { id, type: "result", success: false, error: { code, message } };
}
