/* «Casa 3D»: la scena col modello di chi abita (#440).
 *
 * Al posto della casa generata dalla pianta, quella fatta con un altro
 * programma — SweetHome3D, SketchUp, Blender, Planner 5D, Polycam — e
 * caricata come GLB, glTF o OBJ. Sopra ci vanno i dispositivi come nella
 * casa generata: col loro stato vero, la luce che fa luce, un tocco che
 * accende; chi amministra li mette toccando il modello dove stanno.
 *
 * Il modello si raddrizza con quello che dice il config (`core/modello-3d.js`:
 * unita', asse in alto, verso, scala) e si mette in mezzo al prato coi piedi
 * a terra. I dispositivi stanno nelle coordinate del file: correggere la
 * scala non li stacca dal muro dove sono stati messi.
 *
 * Un tetto copre tutto quello che c'e' dentro, e allora c'e' il «taglio»:
 * una lama orizzontale che si abbassa e lascia vedere il piano che serve.
 *
 * three e i suoi caricatori arrivano da chi chiama: questo modulo non li
 * importa. Il modello non porta niente di suo nella scena: le luci e le
 * telecamere del file si tolgono (la luce e' quella delle lampade vere), e
 * nessun indirizzo esce dal pacchetto (`setURLModifier`).
 */
import { DISPOSITIVI_3D, azioneDelTocco, entita, entitaCandidate, entitaProposta, statoDelDispositivo } from "../../core/casa-3d.js";
import { aByte, controllaIlModello, posaDelModello, puntoDelFile, puntoNelMondo } from "../../core/modello-3d.js";
import { installaLoStile as stileDellaScena } from "./scena.js";
import { creaLeScritte } from "./le-scritte.js";
import { memoriaDelDispositivo, qualitaDellaCasa3D } from "../../core/la-qualita-della-casa-3d.js";

const LUCI_ACCESE_AL_MASSIMO = 6;
const TONI = {
  luce: "245,158,11",
  movimento: "124,58,237",
  allarme: "239,68,68",
  telecamera: "14,165,233",
  clima: "234,88,12",
  ok: "22,163,74",
  lavora: "16,185,129",
  neutro: "100,116,139",
  spento: "71,85,105",
};
const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const copia = (v) => JSON.parse(JSON.stringify(v));

/**
 * Legge il modello e torna la sua radice, gia' pulita.
 *
 * Prima il controllo del contenuto (`controllaIlModello`): un file che chiede
 * qualcosa fuori, o un decodificatore che non c'e', si ferma qui con il suo
 * motivo (`errore.motivo`). Poi il caricatore di three, con un gestore che
 * lascia passare solo `data:` e `blob:` — non dovrebbe servire, dopo il
 * controllo, ed e' proprio per questo che c'e'.
 */
export async function caricaLaForma(THREE, caricatori, dati, formatoDetto = "") {
  const byte = aByte(dati);
  const esito = controllaIlModello(byte);
  if (!esito.ok) throw Object.assign(new Error(`modello: ${esito.errore}`), { motivo: esito.errore });
  const formato = esito.formato || formatoDetto;
  let radice;
  if (formato === "obj") {
    radice = new caricatori.OBJLoader().parse(new TextDecoder().decode(byte));
    /* Senza MTL un OBJ esce lucido e senza colore: un intonaco caldo, dai due lati. */
    const intonaco = new THREE.MeshStandardMaterial({ color: "#ddd5c8", roughness: 0.9, side: THREE.DoubleSide });
    radice.traverse((o) => {
      if (o.isMesh) o.material = intonaco;
    });
  } else {
    const gestore = new THREE.LoadingManager();
    gestore.setURLModifier((u) => (/^(?:data|blob):/i.test(String(u)) ? u : "data:,"));
    const caricatore = new caricatori.GLTFLoader(gestore);
    const corpo =
      formato === "gltf"
        ? new TextDecoder().decode(byte)
        : byte.byteOffset === 0 && byte.byteLength === byte.buffer.byteLength
          ? byte.buffer
          : byte.slice().buffer;
    const gltf = await new Promise((ok, ko) => caricatore.parse(corpo, "", ok, ko));
    radice = gltf.scene || gltf.scenes?.[0];
    if (!radice) throw Object.assign(new Error("modello: vuoto"), { motivo: "senza-facce" });
  }
  const via = [];
  radice.traverse((o) => {
    if (o.isLight || o.isCamera) via.push(o);
  });
  for (const o of via) o.parent?.remove(o);
  const ombre = esito.triangoli < 300_000;
  let lato = 0,
    trame = 0;
  const viste = new Set();
  radice.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = ombre;
    o.receiveShadow = true;
    for (const m of [].concat(o.material || []))
      for (const v of Object.values(m))
        if (v?.isTexture && !viste.has(v)) {
          viste.add(v);
          trame += 1;
          lato = Math.max(lato, v.image?.width || 0, v.image?.height || 0);
        }
  });
  radice.updateMatrixWorld(true);
  const b = new THREE.Box3().setFromObject(radice);
  const confini = b.isEmpty() ? esito.confini : { min: b.min.toArray(), max: b.max.toArray() };
  return { radice, formato, confini, triangoli: esito.triangoli, avvisi: esito.avvisi, trame, lato };
}

/** Libera la memoria di una forma (geometrie, materiali, trame). */
export function liberaLaForma(o) {
  const materiali = new Set(),
    trame = new Set();
  o?.traverse?.((x) => {
    x.geometry?.dispose?.();
    for (const m of [].concat(x.material || [])) materiali.add(m);
  });
  for (const m of materiali) {
    for (const v of Object.values(m)) if (v?.isTexture) trame.add(v);
    m.dispose?.();
  }
  for (const t of trame) t.dispose?.();
}

/** Mette la forma al suo posto nel mondo: torna la matrice usata e le misure. */
export function posaLaForma(THREE, gruppo, confini, impostazioni) {
  const posa = posaDelModello(confini, impostazioni);
  gruppo.matrixAutoUpdate = false;
  gruppo.matrix.fromArray(posa.matrice);
  gruppo.updateMatrixWorld(true);
  return posa;
}

/**
 * Costruisce la scena del modello dentro `contenitore`.
 *
 * opzioni: { contenitore, casa, forma (da `caricaLaForma`), stati, italiano,
 *   admin, quandoTocchi, quandoSalvi, quandoCade, aree, pannello, perLeProve }
 * Torna gli stessi comandi della scena della casa generata (`scena.js`).
 */
export function creaScenaDelModello(THREE, opzioni = {}) {
  const {
    contenitore,
    forma,
    stati = () => ({}),
    italiano = true,
    admin = false,
    quandoTocchi = () => {},
    quandoSalvi = () => {},
    quandoCade = () => {},
  } = opzioni;
  const L = (it, en) => (italiano ? it : en);
  const leggiStati = () => (typeof stati === "function" ? stati() : stati) || {};
  const C = copia(opzioni.casa || {});
  const M = C.modello;
  M.dispositivi ||= [];

  stileDellaScena();
  installaLoStile();
  const palco = document.createElement("div");
  palco.className = "c3-scena c3m-scena";
  palco.innerHTML = `<div class="c3-chip-strato"></div>
    <div class="c3-sugg" hidden></div>
    <label class="c3m-taglio" title="${esc(L("Taglia dall'alto per vedere dentro", "Cut from the top to look inside"))}"><span>✂️</span><input type="range" min="0" max="100" value="100" data-c3m-taglio></label>
    <div class="c3-zoom"><span data-c3-zoom="1.18">−</span><span data-c3-zoom="0.85">+</span><span data-c3-zoom="0">⌖</span></div>`;
  contenitore.appendChild(palco);
  const stratoChip = palco.querySelector(".c3-chip-strato");
  const sugg = palco.querySelector(".c3-sugg");
  const lama = palco.querySelector("[data-c3m-taglio]");
  /* Le scritte dei dispositivi, come nella casa generata (vedi `le-scritte.js`). */
  const scritte = creaLeScritte({ strato: stratoChip, perLeProve: Boolean(opzioni.perLeProve), richiedi: () => richiedi() });
  scritte.modo(opzioni.nomi);
  let pannello = opzioni.pannello || null;
  if (!pannello && admin) {
    pannello = document.createElement("div");
    pannello.className = "c3-pannello-sopra";
    palco.appendChild(pannello);
  }

  /* Quanto chiedere a questo schermo: come la casa generata (`scena.js`). */
  const memoria = memoriaDelDispositivo(window.navigator);
  const qualita = (w = 0, h = 0) =>
    qualitaDellaCasa3D({ dpr: window.devicePixelRatio || 1, larghezza: w, altezza: h, memoria, cadute: opzioni.cadute || 0 });
  const Q = qualita(contenitore?.clientWidth || 0, contenitore?.clientHeight || 0);
  const renderer = new THREE.WebGLRenderer({ antialias: Q.antialias, alpha: true, preserveDrawingBuffer: Boolean(opzioni.perLeProve) });
  renderer.setPixelRatio(Q.pixel);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const taglio = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
  renderer.clippingPlanes = [taglio];
  palco.prepend(renderer.domElement);
  const alPerso = (ev) => {
    ev.preventDefault();
    /* la caduta voluta di `distruggi` non e' un modello che non si regge */
    if (S.morto) return;
    quandoCade(new Error("webgl"));
  };
  renderer.domElement.addEventListener("webglcontextlost", alPerso);
  const scena = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, 1, 0.05, 2000);

  /* ── il modello, al suo posto ─────────────────────────────────────── */
  const gruppo = new THREE.Group();
  gruppo.add(forma.radice);
  scena.add(gruppo);
  const posa = posaLaForma(THREE, gruppo, forma.confini, M);
  const [LARGO, ALTO, FONDO] = posa.misure.map((v) => (Number.isFinite(v) && v > 0 ? v : 1));
  const MISURA = Math.max(LARGO, FONDO, ALTO, 1);
  /* un prato tondo sotto, e il sole che fa le ombre */
  const prato = new THREE.Mesh(
    new THREE.CircleGeometry(MISURA * 1.6 + 6, 64),
    new THREE.MeshStandardMaterial({ color: "#3d6b45", roughness: 1 }),
  );
  prato.rotation.x = -Math.PI / 2;
  prato.position.y = -0.01;
  prato.receiveShadow = true;
  scena.add(prato);
  const cielo = new THREE.HemisphereLight("#dbe7ff", "#2a3346", 1.2);
  scena.add(cielo);
  const sole = new THREE.DirectionalLight("#fff1d6", 2.4);
  sole.position.set(-MISURA, MISURA * 1.8 + 10, MISURA * 0.9);
  sole.castShadow = true;
  sole.shadow.mapSize.set(Q.ombra, Q.ombra);
  const ombra = MISURA + 4;
  Object.assign(sole.shadow.camera, { left: -ombra, right: ombra, top: ombra, bottom: -ombra, far: MISURA * 6 + 60 });
  sole.shadow.bias = -0.0006;
  scena.add(sole);
  const MUCCHIO = Array.from({ length: LUCI_ACCESE_AL_MASSIMO }, () => {
    const l = new THREE.PointLight("#ffc98a", 0, Math.max(6, MISURA * 0.5), 1.6);
    scena.add(l);
    return { l, Dv: null };
  });

  /* ── i dispositivi ────────────────────────────────────────────────── */
  const R = Math.max(0.08, Math.min(0.3, MISURA / 120));
  const sfera = new THREE.SphereGeometry(R, 18, 12);
  const DISP = [];
  function mettiDispositivo(dati) {
    const D = DISPOSITIVI_3D[dati.k];
    if (!D) return null;
    const m = new THREE.Mesh(sfera, new THREE.MeshStandardMaterial({ color: "#94a3b8", emissive: "#000000", roughness: 0.4 }));
    const [x, y, z] = puntoNelMondo(posa.matrice, dati);
    m.position.set(x, y, z);
    scena.add(m);
    const Dv = { dati, k: dati.k, D, m, stato: null, el: null };
    DISP.push(Dv);
    return Dv;
  }
  function togliDispositivo(Dv) {
    scena.remove(Dv.m);
    Dv.m.material.dispose();
    Dv.el?.remove();
    DISP.splice(DISP.indexOf(Dv), 1);
    const i = M.dispositivi.indexOf(Dv.dati);
    if (i >= 0) M.dispositivi.splice(i, 1);
  }
  for (const d of M.dispositivi) mettiDispositivo(d);

  /* ── lo stato ─────────────────────────────────────────────────────── */
  const VISTA = { az: 0.65, al: 0.5, d: MISURA * 1.9 + 4, tx: 0, ty: ALTO * 0.35, tz: 0 };
  const S = {
    cam: { ...VISTA },
    camVoluta: { ...VISTA },
    taglio: 1,
    arreda: false,
    scelto: null,
    daMettere: "",
    sposta: false,
    stati: {},
    raf: 0,
    morto: false,
    salvato: false,
  };

  let largo = 0,
    alto = 0;
  function inquadra() {
    const w = palco.clientWidth || 1,
      h = palco.clientHeight || 1;
    if (w !== largo || h !== alto) {
      largo = w;
      alto = h;
      const pixel = qualita(w, h).pixel;
      if (renderer.getPixelRatio() !== pixel) renderer.setPixelRatio(pixel);
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    }
    const { az, al, tx, ty, tz } = S.cam;
    const d = S.cam.d * Math.pow(Math.max(1, 1.1 / cam.aspect), 0.75);
    cam.position.set(tx + Math.sin(az) * Math.cos(al) * d, ty + Math.sin(al) * d, tz + Math.cos(az) * Math.cos(al) * d);
    cam.lookAt(tx, ty, tz);
  }
  const vettore = new THREE.Vector3();
  /* Chi sta dietro un muro o sotto il tetto si vede lo stesso, ma piu' tenue:
   * la pastiglia dice «c'e', di la'». Si guarda solo a vista ferma (un raggio
   * per dispositivo contro tutto il modello non e' una cosa da ogni fotogramma). */
  const nascosti = new Set();
  let daRivedere = true;
  const versoIl = new THREE.Raycaster();
  function rivediINascosti() {
    nascosti.clear();
    for (const Dv of DISP) {
      vettore.copy(Dv.m.position).sub(cam.position);
      const lontano = vettore.length();
      versoIl.set(cam.position, vettore.normalize());
      versoIl.far = lontano - R * 1.5;
      const colpo = versoIl.intersectObject(gruppo, true).find((c) => !(S.taglio < 1 && c.point.y > ALTO * S.taglio + 0.01));
      if (colpo) nascosti.add(Dv);
    }
  }
  function etichette() {
    const cima = S.taglio < 1 ? ALTO * S.taglio + 0.01 : Infinity;
    const visti = [];
    for (const Dv of DISP) {
      const el = chipDi(Dv);
      vettore.copy(Dv.m.position).project(cam);
      const x = ((vettore.x + 1) / 2) * largo,
        y = ((1 - vettore.y) / 2) * alto;
      const fuori = vettore.z > 1 || x < -40 || y < -40 || x > largo + 40 || y > alto + 40 || Dv.m.position.y > cima;
      Dv.m.visible = Dv.m.position.y <= cima;
      el.style.display = fuori ? "none" : "";
      if (fuori) continue;
      el.classList.toggle("c3m-dietro", nascosti.has(Dv));
      vestiChip(Dv, el);
      const st = Dv.stato;
      visti.push({
        Dv,
        el,
        x,
        y: y - 6,
        distanza: Dv.m.position.distanceTo(cam.position),
        acceso: Boolean(st?.attivo),
        primo: S.scelto === Dv,
        /* chi sta dietro un muro cede il posto a chi si vede; chi grida no */
        priorita: st?.attivo && ["movimento", "allarme"].includes(st.tono) ? 1 : nascosti.has(Dv) ? -1 : 0,
      });
    }
    const { az, al, d, tx, ty, tz } = S.cam;
    scritte.disponi(visti, [largo, alto, az, al, d, tx, ty, tz, S.taglio].map((v) => v.toFixed(3)).join("|"));
  }
  function disegna() {
    if (S.morto) return;
    inquadra();
    renderer.render(scena, cam);
    etichette();
  }
  function avanza(dt) {
    let muove = false;
    for (const k of ["az", "al", "d", "tx", "ty", "tz"]) {
      const a = S.cam[k],
        b = S.camVoluta[k];
      if (Math.abs(b - a) > 1e-4 * Math.max(1, Math.abs(b))) {
        S.cam[k] = a + (b - a) * Math.min(1, dt * 8);
        muove = true;
      } else S.cam[k] = b;
    }
    let pulsa = false;
    for (const Dv of DISP) {
      const st = Dv.stato;
      const vivo = st?.attivo && ["movimento", "allarme"].includes(st.tono);
      if (vivo) pulsa = true;
      const c = TONI[st?.tono] || TONI.spento;
      Dv.m.material.color.setRGB(...c.split(",").map((v) => Number(v) / 255));
      Dv.m.material.emissive.setRGB(...c.split(",").map((v) => (Number(v) / 255) * (st?.attivo ? 0.8 : 0.15)));
      const s = vivo ? 1 + 0.25 * Math.sin(performance.now() / 160) : S.scelto === Dv ? 1.35 : 1;
      Dv.m.scale.setScalar(s);
    }
    taglio.constant = S.taglio < 1 ? ALTO * S.taglio + 0.01 : 1e6;
    palco.dataset.fermo = String(!muove);
    return muove || pulsa;
  }
  let ultimo = 0;
  function giro(t) {
    S.raf = 0;
    if (S.morto) return;
    const dt = Math.min(0.1, Math.max(0, (t - ultimo) / 1000));
    ultimo = t;
    const ancora = avanza(dt);
    if (palco.dataset.fermo === "true" && daRivedere) {
      inquadra();
      rivediINascosti();
      daRivedere = false;
    } else if (palco.dataset.fermo !== "true") daRivedere = true;
    disegna();
    if (ancora || dita.size) S.raf = requestAnimationFrame(giro);
  }
  function richiedi() {
    if (S.morto || S.raf || opzioni.perLeProve) return;
    ultimo = performance.now();
    S.raf = requestAnimationFrame(giro);
  }

  /* ── le pastiglie ─────────────────────────────────────────────────── */
  function chipDi(Dv) {
    if (Dv.el) return Dv.el;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "c3-chip";
    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      /* un pallino dice anche chi e': poi fa quello che fa il suo tasto */
      scritte.toccato(Dv, el, `${nomeDi(Dv)} · ${Dv.stato?.testo || L("da collegare", "not linked")}`);
      tocca(Dv);
    });
    stratoChip.appendChild(el);
    Dv.el = el;
    return el;
  }
  function nomeDi(Dv) {
    return Dv.dati.nome || S.stati[Dv.dati.entity]?.attributes?.friendly_name || L(Dv.D.nome[0], Dv.D.nome[1]);
  }
  function vestiChip(Dv, el) {
    const st = Dv.stato || { testo: Dv.D.icona, tono: "neutro" };
    const scollegato = !Dv.dati.entity;
    const testo = scollegato ? `${Dv.D.icona} ?` : st.testo;
    if (el.textContent !== testo) el.textContent = testo;
    if (el.dataset.ic !== Dv.D.icona) el.dataset.ic = Dv.D.icona;
    const c = TONI[st.tono] || TONI.neutro;
    if (el.dataset.c !== c) {
      el.dataset.c = c;
      el.style.setProperty("--c", c);
    }
    el.title = nomeDi(Dv);
    el.classList.toggle("c3-vivo", Boolean(st.attivo) && ["movimento", "allarme"].includes(st.tono));
    el.classList.toggle("c3-scollegato", scollegato);
    el.classList.toggle("c3-scelto", S.scelto === Dv);
  }

  /* ── gli stati veri ───────────────────────────────────────────────── */
  function aggiornaStati(states) {
    S.stati = states || leggiStati();
    for (const Dv of DISP) {
      const st = Dv.dati.entity ? S.stati[Dv.dati.entity] : null;
      Dv.stato = st ? statoDelDispositivo(Dv.k, st, italiano) : null;
    }
    scritte.rifai();
    const accese = DISP.filter((Dv) => Dv.k === "luce" && Dv.stato?.attivo);
    MUCCHIO.forEach((Mu, i) => {
      const Dv = accese[i];
      Mu.Dv = Dv || null;
      Mu.l.intensity = Dv ? 6 * Math.max(0.25, Dv.stato.luminosita ?? 1) : 0;
      if (Dv) Mu.l.position.copy(Dv.m.position).add(new THREE.Vector3(0, -R * 2, 0));
    });
    const delSole = S.stati["sun.sun"]?.state;
    const giorno = delSole ? delSole === "above_horizon" : new Date().getHours() >= 7 && new Date().getHours() < 19;
    sole.intensity = giorno ? 2.4 : 0.35;
    cielo.intensity = giorno ? 1.2 : 0.35;
    if (S.arreda && !pannello?.contains(document.activeElement)) disegnaPannello();
    richiedi();
  }

  /* ── toccare ──────────────────────────────────────────────────────── */
  function tocca(Dv) {
    if (S.arreda) {
      S.scelto = Dv;
      S.sposta = false;
      S.daMettere = "";
      disegnaPannello();
      richiedi();
      return;
    }
    const entity = Dv.dati.entity;
    if (!entity) return quandoTocchi({ pagina: "scollegato", k: Dv.k });
    if (Dv.k === "telecamera") return quandoTocchi({ pagina: "telecamera", entity });
    const azione = azioneDelTocco(Dv.k, entity, S.stati[entity]);
    /* un clima chiede le sue modalita', come nella casa generata (scena.js) */
    if (String(entity).startsWith("climate.")) return quandoTocchi({ pagina: "clima", entity, azione });
    quandoTocchi(azione || { pagina: "entita", entity });
  }
  const raggio = new THREE.Raycaster(),
    pt = new THREE.Vector2();
  function punta(x, y) {
    const b = renderer.domElement.getBoundingClientRect();
    pt.set(((x - b.left) / b.width) * 2 - 1, -((y - b.top) / b.height) * 2 + 1);
    raggio.setFromCamera(pt, cam);
  }
  /** Dove si e' toccato il modello, nel mondo (un po' fuori dalla superficie). */
  function puntoSulModello(x, y) {
    punta(x, y);
    const colpo = raggio.intersectObject(gruppo, true).find((c) => !(S.taglio < 1 && c.point.y > ALTO * S.taglio + 0.01));
    if (!colpo) return null;
    const n = colpo.face?.normal?.clone().transformDirection(colpo.object.matrixWorld) || new THREE.Vector3(0, 1, 0);
    if (n.dot(raggio.ray.direction) > 0) n.negate();
    return colpo.point.clone().addScaledVector(n, R * 1.2);
  }
  function dispositivoSotto(x, y) {
    punta(x, y);
    const colpo = raggio.intersectObjects(DISP.map((Dv) => Dv.m), false)[0];
    return colpo ? DISP.find((Dv) => Dv.m === colpo.object) : null;
  }
  /** Mette (o sposta) un dispositivo nel punto toccato. Per la pagina e per le prove. */
  function mettiQui(punto) {
    if (!punto) return null;
    const dove = puntoDelFile(posa.matrice, [punto.x, punto.y, punto.z]);
    if (S.sposta && S.scelto) {
      Object.assign(S.scelto.dati, dove);
      S.scelto.m.position.copy(punto);
      S.sposta = false;
    } else if (S.daMettere) {
      const k = S.daMettere;
      const usate = M.dispositivi.map((d) => d.entity).filter(Boolean);
      const dati = { k, ...dove, entity: entitaProposta(k, { states: S.stati, usate }) || "", nome: "", da: "mano" };
      if (k === "telecamera") dati.fov = 100;
      M.dispositivi.push(dati);
      S.scelto = mettiDispositivo(dati);
      S.daMettere = "";
    } else return null;
    daRivedere = true;
    aggiornaStati(S.stati);
    salva();
    disegnaPannello();
    return S.scelto;
  }

  const tela3d = renderer.domElement;
  const dita = new Map();
  let gesto = null;
  tela3d.addEventListener("pointerdown", (ev) => {
    dita.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    tela3d.setPointerCapture?.(ev.pointerId);
    if (dita.size === 1) gesto = { x: ev.clientX, y: ev.clientY, mosso: false, cam: { ...S.camVoluta } };
    else if (dita.size === 2) {
      const [a, b] = [...dita.values()];
      gesto = { pinza: Math.hypot(a.x - b.x, a.y - b.y), d: S.camVoluta.d, mosso: true };
    }
    richiedi();
  });
  tela3d.addEventListener("pointermove", (ev) => {
    if (!dita.has(ev.pointerId) || !gesto) return;
    dita.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (dita.size >= 2 && gesto.pinza) {
      const [a, b] = [...dita.values()];
      const ora = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      S.camVoluta.d = Math.max(MISURA * 0.15, Math.min(MISURA * 6 + 40, (gesto.d * gesto.pinza) / ora));
    } else if (dita.size === 1 && gesto.cam) {
      const dx = ev.clientX - gesto.x,
        dy = ev.clientY - gesto.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) gesto.mosso = true;
      S.camVoluta.az = gesto.cam.az - dx * 0.008;
      S.camVoluta.al = Math.max(0.05, Math.min(1.5, gesto.cam.al + dy * 0.006));
    }
    richiedi();
  });
  const lascia = (ev) => {
    const g = gesto;
    dita.delete(ev.pointerId);
    if (!dita.size) gesto = null;
    if (!g || g.mosso || ev.type !== "pointerup") return;
    const Dv = dispositivoSotto(ev.clientX, ev.clientY);
    if (S.arreda && (S.daMettere || S.sposta)) {
      mettiQui(puntoSulModello(ev.clientX, ev.clientY));
      return;
    }
    if (Dv) tocca(Dv);
  };
  tela3d.addEventListener("pointerup", lascia);
  tela3d.addEventListener("pointercancel", lascia);
  tela3d.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      S.camVoluta.d = Math.max(MISURA * 0.15, Math.min(MISURA * 6 + 40, S.camVoluta.d * (ev.deltaY > 0 ? 1.1 : 0.9)));
      richiedi();
    },
    { passive: false },
  );
  palco.querySelector(".c3-zoom").addEventListener("click", (ev) => {
    const z = ev.target.closest("[data-c3-zoom]");
    if (!z) return;
    const f = Number(z.dataset.c3Zoom);
    if (f) S.camVoluta.d = Math.max(MISURA * 0.15, Math.min(MISURA * 6 + 40, S.camVoluta.d * f));
    else S.camVoluta = { ...VISTA };
    richiedi();
  });
  lama.addEventListener("input", () => {
    daRivedere = true;
    S.taglio = Math.max(0.02, Number(lama.value) / 100);
    if (Number(lama.value) >= 100) S.taglio = 1;
    richiedi();
  });

  /* ── arredare: i dispositivi sul modello ──────────────────────────── */
  let timerSalva = 0;
  function salva() {
    clearTimeout(timerSalva);
    timerSalva = setTimeout(() => {
      try {
        quandoSalvi(copia(C));
        S.salvato = true;
        const el = pannello?.querySelector("[data-c3-salvato]");
        if (el) el.textContent = L("✓ Salvato", "✓ Saved");
      } catch (_errore) {}
    }, opzioni.perLeProve ? 0 : 400);
  }
  function suggerisci() {
    const testo = S.daMettere
      ? L(`Tocca il modello dove sta: ${DISPOSITIVI_3D[S.daMettere].nome[0].toLowerCase()}`, `Tap the model where it is: ${DISPOSITIVI_3D[S.daMettere].nome[1].toLowerCase()}`)
      : S.sposta
        ? L("Tocca il modello dove spostarlo", "Tap the model where to move it")
        : "";
    sugg.hidden = !testo;
    sugg.textContent = testo;
  }
  function candidati(Dv) {
    const usate = DISP.filter((x) => x !== Dv && x.dati.entity).map((x) => x.dati.entity);
    return entitaCandidate(Dv.k, { states: S.stati, aree: opzioni.aree || {}, usate });
  }
  function disegnaPannello() {
    suggerisci();
    if (!pannello) return;
    if (!S.arreda) {
      pannello.innerHTML = "";
      pannello.hidden = true;
      return;
    }
    pannello.hidden = false;
    const Dv = S.scelto && DISP.includes(S.scelto) ? S.scelto : null;
    let scheda = "";
    if (Dv) {
      const cand = candidati(Dv).slice(0, 80);
      const ora = Dv.dati.entity;
      if (ora && !cand.some((c) => c.entity === ora)) cand.unshift({ entity: ora, nome: ora });
      scheda = `<div class="c3-pezzo"><b>${Dv.D.icona}</b><div><div class="c3-pn">${esc(nomeDi(Dv))}</div><div class="c3-pc">${esc(Dv.stato?.testo || (ora ? "" : L("da collegare", "not linked")))}</div></div></div>
        <div class="c3-cat">${esc(L("Collega a Home Assistant", "Link to Home Assistant"))}</div>
        <select class="c3-campo" data-c3m-entita><option value="">${esc(L("— nessuna —", "— none —"))}</option>${cand
          .map((c) => `<option value="${esc(c.entity)}"${c.entity === ora ? " selected" : ""}>${esc(c.nome === c.entity ? c.entity : `${c.nome} · ${c.entity}`)}</option>`)
          .join("")}</select>
        <div class="c3-riga"><input class="c3-campo" data-c3m-amano placeholder="${esc(L("entità a mano, es. light.salotto", "entity by hand, e.g. light.lounge"))}" value="${esc(ora)}"><button type="button" class="c3-ch" data-c3m-amano-ok>✓</button></div>
        <div class="c3-riga"><input class="c3-campo" data-c3m-nome placeholder="${esc(L("nome (facoltativo)", "name (optional)"))}" value="${esc(Dv.dati.nome)}"></div>
        <div class="c3-chips"><span class="c3-ch${S.sposta ? " c3-si" : ""}" data-c3m-sposta>📍 ${esc(L("Sposta", "Move"))}</span><span class="c3-ch" data-c3m-togli>🗑 ${esc(L("Togli", "Remove"))}</span></div>`;
    }
    pannello.innerHTML = `<div class="c3-ar">
      <div class="c3-ar-testa">🧊 <b>${esc(L("Il tuo modello", "Your model"))}</b><span class="c3-piccolo">${esc(`${DISP.length} ${L("dispositivi", "devices")}`)}</span></div>
      <div class="c3-salvato" data-c3-salvato>${esc(S.salvato ? L("✓ Salvato", "✓ Saved") : L("Le modifiche si salvano da sole", "Changes save themselves"))}</div>
      ${scheda}
      <div class="c3-cat">${esc(L("Sul modello", "On the model"))} · ${DISP.length}</div>
      <div class="c3-dentro">${DISP.map((x, i) => `<span data-c3m-scegli="${i}" class="${S.scelto === x ? "c3-si" : ""}">${x.D.icona} ${esc(nomeDi(x))}${x.dati.entity ? "" : " ?"}</span>`).join("") || `<span>${esc(L("nessuno", "none"))}</span>`}</div>
      <div class="c3-cat">${esc(L("Aggiungi: scegli, poi tocca il modello", "Add: pick, then tap the model"))}</div>
      <div class="c3-griglia">${Object.entries(DISPOSITIVI_3D)
        .map(([k, D]) => `<button type="button" class="c3-voce${S.daMettere === k ? " c3-si" : ""}" data-c3m-disp="${k}"><b>${D.icona}</b>${esc(L(D.nome[0], D.nome[1]))}</button>`)
        .join("")}</div>
      <p class="c3-piccolo">${esc(L("Con ✂️ abbassi il taglio e vedi dentro i piani: i dispositivi si mettono anche sul pavimento o sui muri di dentro.", "With ✂️ you lower the cut and see inside the floors: devices can go on inner floors and walls too."))}</p>
    </div>`;
  }
  function alClicDelPannello(ev) {
    const el = ev.target.closest("[data-c3m-disp],[data-c3m-scegli],[data-c3m-sposta],[data-c3m-togli],[data-c3m-amano-ok]");
    if (!el) return;
    const d = el.dataset;
    if (d.c3mDisp !== undefined) {
      S.daMettere = S.daMettere === d.c3mDisp ? "" : d.c3mDisp;
      S.sposta = false;
    } else if (d.c3mScegli !== undefined) {
      S.scelto = DISP[Number(d.c3mScegli)] || null;
      S.sposta = false;
    } else if (d.c3mSposta !== undefined) {
      S.sposta = !S.sposta;
      S.daMettere = "";
    } else if (d.c3mTogli !== undefined && S.scelto) {
      togliDispositivo(S.scelto);
      S.scelto = null;
      salva();
    } else if (d.c3mAmanoOk !== undefined) return collegaAMano();
    disegnaPannello();
    richiedi();
  }
  function collega(Dv, id) {
    Dv.dati.entity = id;
    aggiornaStati(S.stati);
    salva();
  }
  function collegaAMano() {
    const campo = pannello.querySelector("[data-c3m-amano]");
    const Dv = S.scelto;
    if (!campo || !Dv) return;
    const id = entita(campo.value);
    if (campo.value.trim() && !id) {
      campo.classList.add("c3-sbagliato");
      return;
    }
    collega(Dv, id);
    disegnaPannello();
  }
  function alCambioDelPannello(ev) {
    const Dv = S.scelto;
    if (!Dv) return;
    if (ev.target.matches("[data-c3m-entita]")) {
      collega(Dv, entita(ev.target.value));
      disegnaPannello();
    } else if (ev.target.matches("[data-c3m-nome]")) {
      Dv.dati.nome = ev.target.value.trim().slice(0, 40);
      salva();
    }
  }
  if (pannello) {
    pannello.addEventListener("click", alClicDelPannello);
    pannello.addEventListener("change", alCambioDelPannello);
  }
  function arreda(acceso) {
    if (!admin) return false;
    S.arreda = Boolean(acceso);
    palco.classList.toggle("c3-arreda", S.arreda);
    if (!S.arreda) {
      S.scelto = null;
      S.daMettere = "";
      S.sposta = false;
    }
    disegnaPannello();
    richiedi();
    return S.arreda;
  }

  /* ── la fine ──────────────────────────────────────────────────────── */
  function distruggi() {
    if (S.morto) return;
    S.morto = true;
    if (S.raf) cancelAnimationFrame(S.raf);
    clearTimeout(timerSalva);
    scritte.distruggi();
    osservatore?.disconnect();
    if (pannello) {
      pannello.removeEventListener("click", alClicDelPannello);
      pannello.removeEventListener("change", alCambioDelPannello);
      if (pannello !== opzioni.pannello) pannello.remove();
      else pannello.innerHTML = "";
    }
    liberaLaForma(scena);
    sfera.dispose();
    sole.shadow.map?.dispose?.();
    renderer.dispose();
    /* il contesto si restituisce subito: vedi `distruggi` in scena.js */
    try {
      renderer.forceContextLoss();
    } catch (_errore) {}
    renderer.domElement.removeEventListener("webglcontextlost", alPerso);
    palco.remove();
  }
  function ridimensiona() {
    largo = alto = 0;
    richiedi();
  }
  const osservatore = typeof ResizeObserver === "function" ? new ResizeObserver(() => ridimensiona()) : null;
  osservatore?.observe(palco);

  aggiornaStati(leggiStati());
  avanza(1);
  inquadra();
  rivediINascosti();
  disegna();

  return {
    aggiornaStati: (states) => aggiornaStati(states),
    /* Il modello e' uno: «esterno» e «modello» sono la stessa vista. */
    apri: (k) => k === "modello" || k === "esterno",
    arreda,
    distruggi,
    ridimensiona,
    /** Le scritte dei dispositivi: «tutti», «accesi» o «nessuno» (vedi le-scritte.js). */
    nomi: (modo) => scritte.modo(modo),
    fotogramma(dt = 1 / 60) {
      avanza(dt);
      disegna();
    },
    vista: () => "modello",
    arredando: () => S.arreda,
    misure: () => posa.misure.slice(),
    casa: () => copia(C),
    /** Per le prove: sceglie il tipo da mettere, poi «tocca» il modello in un punto del mondo. */
    metti(k, punto) {
      S.daMettere = DISPOSITIVI_3D[k] ? k : "";
      return mettiQui(punto ? new THREE.Vector3(...punto) : null)?.dati || null;
    },
    /** Per le prove: dove sta un dispositivo nel mondo. */
    nelMondo: (i) => DISP[i]?.m.position.toArray() || null,
    /** Per le prove: il punto del modello sotto un punto dello schermo. */
    puntoSotto: (x, y) => puntoSulModello(x, y)?.toArray() || null,
    taglia(f) {
      daRivedere = true;
      S.taglio = f >= 1 ? 1 : Math.max(0.02, f);
      lama.value = String(Math.round(S.taglio * 100));
      richiedi();
    },
  };
}

function installaLoStile() {
  if (document.getElementById("dm-casa3d-modello-stile")) return;
  const st = document.createElement("style");
  st.id = "dm-casa3d-modello-stile";
  st.textContent = `
  .c3m-taglio{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:38px;height:206px;border-radius:100px;
    background:rgba(15,23,42,.8);border:1px solid rgba(148,163,184,.3);color:#e6edf7;z-index:5}
  .c3m-taglio span{position:absolute;left:0;right:0;top:8px;text-align:center;font-size:15px}
  .c3m-taglio input{position:absolute;left:50%;top:calc(50% + 14px);width:150px;margin:0;transform:translate(-50%,-50%) rotate(-90deg);
    accent-color:#0ea5e9;cursor:pointer}
  .c3m-scena .c3-sugg[hidden]{display:none}
  .c3m-scena .c3-chip.c3m-dietro{opacity:.45;filter:saturate(.6)}
  `;
  document.head.appendChild(st);
}
