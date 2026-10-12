# Rapporto di audit — gdahomeapp: sicurezza e incongruenze

Data: 12 ottobre 2026.
Base esaminata: commit `0e24d26` (v1.11.9, il checkout di questa sessione), più il diff fino a `5d01baa` (v1.11.10, oggi in `main` e sul tag `tramite`): `ponte/src/chi-configura.js`, `commissioni.js`, `plance.js`, `plancia-nuova.js` e la parte di plancia che li accompagna sono stati letti nella versione 1.11.10.

## Come si è lavorato

- Letti per intero: `ponte/src` (tutti i 70 moduli), `ponte/console`, `ponte/carta`, `ponte/config.yaml`, `Dockerfile`, `run.sh`; `centralino/src` e `quadro/src` completi con i due `accendi.sh`; `app/lib`, `app/android`, `app/ios`, `app/web`; gli 11 workflow in `.github`; `strumenti/`, `collaudo/`; tutta la documentazione (`README.md`, `COME_PROVARLA.md`, `docs/*.md`, i README dei pezzi, `app/negozio`). La plancia (`ponte/plancia`, ~1500 file) è stata passata per sink (`innerHTML`, `eval`, `href`, `postMessage`, `srcdoc`…) e letta nei punti trovati; il legacy `officina/` solo per pattern rischiosi.
- Eseguito: `npm test` nei tre server Node (ponte 1082/1082, centralino 240/240, quadro 434/434, nessuna prova saltata), `prettier --check` (pulito), `sigilla-la-plancia.mjs --dimmi` (il sigillo torna, 1007 file), `strumenti/nessun-segreto.mjs` (nessun segreto), i vettori di `app/test/ponte/cifra_test.dart` ricalcolati contro `ponte/src/cifra.js` (identici byte per byte), un benchmark sul parser WebSocket (sotto, S5), e la storia git completa (905 commit) cercando credenziali.
- Risultato generale: **nessuna credenziale è mai finita nel repository**, l'architettura crittografica è solida e le superfici web sono scritte con disciplina (nessuna XSS confermata). I problemi veri stanno nei **confini di fiducia** (chi può muovere cosa in produzione, cosa condivide l'origine con cosa) e in alcune **difese di disponibilità** sui server pubblici. La documentazione ha diverse informazioni sbagliate rivolte all'utente, elencate nella Parte 2.

Scala: **Critico** = compromissione estesa realistica; **Alto** = furto di segreti/controllo di case con precondizioni concrete; **Medio** = disponibilità, abuso economico o escalation con precondizioni; **Basso** = hardening; **Info** = da sapere.

---

## Parte 1 — Sicurezza

### S1 · Critico · gdanav entra in `main` (e nei negozi) senza revisione umana, con il PAT esposto al suo codice

- `.github/workflows/aggiorna-gdanav.yml:39-41`: checkout con `secrets.GDAHOME_TOKEN` e senza `persist-credentials: false` → il PAT resta in `.git/config` per tutti gli step successivi.
- `:51-53` `flutter pub upgrade gdanav_app` prende **l'ultimo `main` di gdanav**; `:68-75` `flutter analyze` e `flutter test` eseguono codice di gdanav (`app/test/navigatore_test.dart` importa `package:gdanav_app`): un gdanav malevolo legge `../.git/config` e porta via il PAT.
- `:96-103` apre la PR e lancia `gh pr merge --auto --squash`. Il revisore CI ha letto via API il ruleset di `main` (solo `deletion` + `non_fast_forward`, bypass per gli admin, nessun check o review obbligatori) e `allow_auto_merge: true`. Evidenza coerente: PR #194 e #203 fuse con **zero review** dall'identità del PAT, #185 fusa con il check «La plancia» rosso.
- Scenario: chi compromette `main` di gdanav (un collaboratore, un'azione pinnata a tag dirottata — in gdanav le azioni sono `@v4`/`@v2` — o il PAT rubato) mette il suo codice in `app/pubspec.lock` di gdahome entro la notte; il rilascio successivo lo spedisce su Play Store e TestFlight. Con il PAT (admin) si spinge direttamente su `main`, si muove il tag `tramite` (S2) e si alza `ponte/config.yaml` → l'add-on aggiornato in tutte le case con i privilegi di S10.
- Fix: (1) togliere `gh pr merge --auto`, oppure ruleset su `main` con PR obbligatoria, required status checks (le Prove) e 1 approvazione senza bypass; (2) `persist-credentials: false` e token solo nello step che spinge (`git push https://x-access-token:$TOKEN@…`), mai prima di `pub upgrade`/`test`; (3) PAT fine-grained limitato a gdahomeapp (Contents + Pull requests), ruotarlo; (4) proteggere `main` di gdanav e pinnare a SHA le sue azioni; (5) in `app/pubspec.yaml:120-126` puntare `gdanav_app` a un tag firmato, non a `main`.

### S2 · Critico · Il tag `tramite` manda in produzione senza firma e non è protetto

- `centralino/accendi.sh:542-627` (`prepara.sh`) e `quadro/accendi.sh:366-430`: ogni 10 minuti chiedono a GitHub il commit del tag `tramite`, scaricano il tarball, eseguono le prove **contenute nel tarball**, poi `aggiorna.sh` (root, `:996-1047`) scambia le cartelle e riavvia il servizio. Nessuna firma del tag, nessuna attestazione dell'artefatto.
- Il tag è mosso da `il-tramite.yml:96-104` (`git tag -f tramite && git push -f`) dietro l'environment `produzione`, ma il ruleset `versioni` copre solo `refs/tags/v*`: `tramite` può essere spostato da chiunque abbia write e da ogni job con `contents: write` (`porta-l-app.yml`, `quante-case.yml`, `vetrina.yml`, `l-etichetta.yml`, `aggiorna-gdanav.yml`). Oggi `tramite` = `5d01baa` (v1.11.10).
- Scenario: con un write compromesso (o S1) → `git push -f origin <sha>:refs/tags/tramite` → entro 10 minuti codice arbitrario come utente `tramite`/`quadro`, con in ambiente `GITHUB_SEGNALAZIONI`, `POSTA_PASSWORD`, `CHIAVE_CONSOLE` e, sul quadro, la chiave privata Ed25519 delle licenze e le credenziali Apple/Google.
- Fix: ruleset su `refs/tags/tramite` (update + deletion + non_fast_forward) con bypass solo per `il-tramite` (GitHub App o deploy key dedicata); required reviewers sull'environment `produzione`; sulla macchina, verificare la firma del tag (`git verify-tag` con chiave fissata in `/etc/tramite`) o un'attestazione (`actions/attest-build-provenance` + `gh attestation verify`) prima dello scambio.

### S3 · Alto · La chiave di firma Android vera usata in un workflow non protetto, con gdanav non pinnato

- `.github/workflows/navigatore-in-prova.yml:14-16` parte a ogni push su `claude/**`; `:48` `flutter pub upgrade gdanav_app` (ultimo `main`); `:57-75` decodifica `secrets.CHIAVE_ANDROID` in `$RUNNER_TEMP/chiave.jks` e scrive le password in `android/chiave.properties`; il job non ha `environment:`; `:105-109` Gradle esegue anche `gdanav_app/android/build.gradle.kts`.
- Il revisore CI ha visto che le corse recenti **non** emettono l'avviso «Mancano i segreti della chiave vera» (`:65`): la chiave vera è quindi disponibile come repository secret, non solo nell'environment `negozio` (contraddizione con `docs/IPHONE.md:48` e `app/negozio/LEGGIMI.md:56`). Gli AAB/APK firmati con la chiave vera sono artefatti scaricabili (`:122-129`).
- Scenario: gdanav compromesso (o chiunque spinga su `claude/**`) legge keystore e password dal build Gradle e firma pacchetti `com.gdahome.gdahome` installabili sopra l'app vera.
- Fix: `environment: negozio` sul job, oppure firma di prova in questo workflow; mai `pub upgrade` in una build firmata; spostare `CHIAVE_ANDROID*` e `NEGOZIO_GOOGLE` in environment secrets e cancellare le copie a livello repository; pianificare la rotazione con Play App Signing.

### S4 · Alto (solo web, più case) · Nella web app la plancia gira sulla stessa origine dell'app e può leggere segno e chiave di tutte le case

- `app/lib/casa/cassaforte.dart:10-21` lo dichiara: nel browser i segreti stanno nel deposito della pagina e «tutto quello che gira sull'origine dell'app — l'app, e la plancia che le sta in un riquadro della stessa origine — può usare qualunque chiave l'app sappia usare». `app/lib/schermate/riquadro/sul_web.dart:478-483` monta la plancia in un iframe same-origin senza `sandbox`; i file della plancia arrivano dal ponte della casa **selezionata** (`app/web/plancia-sw.js`), che li verifica ma **non blocca** una copia modificata (`ponte/README.md`: «una copia modificata non viene bloccata: viene detta»).
- La configurazione della plancia non permette HTML/JS (escaping verificato, Parte 1 «Fatto bene»), quindi servono **file della plancia modificati**: una copia dell'add-on rimaneggiata o un Home Assistant compromesso. È lo scenario di un installatore (target esplicito del prodotto) che apre nella web app la casa di un cliente ostile: lo script esfiltra segno e chiave di **tutte le altre case** salvate in quel browser → controllo remoto di quelle case (dal centralino se Premium, comunque dalla LAN).
- Fix: isolare l'origine della plancia (servirla da un'altra origine, o `iframe sandbox` senza `allow-same-origin`, che richiede di ripensare il service worker), oppure non persistere segreti nel browser (sessione in memoria e riabbinamento), e far **bloccare** al ponte la plancia con impronta non valida quando la serve all'app. Sul telefono il problema non c'è (Keychain/Keystore), ma vale S20.

### S5 · Medio · Parser WebSocket con costo quadratico: DoS della CPU prima dell'autenticazione

- `ponte/src/presa.js:286` (`_arrivano`): `Buffer.concat([this._avanzo, pezzo])` a ogni pezzo TCP; un cliente annuncia un telaio da 1 MB e lo manda un byte alla volta. `centralino/src/presa.js` e `quadro/src/presa.js` sono copie byte-identiche: vale per la porta 8098 esposta, per l'ingress e per il centralino pubblico.
- Misurato (`scratchpad/bench/trickle.mjs`, Node 22, macchina veloce): telaio da 200 KB intero 0,3 ms; a 16 byte per pezzo 83 ms; a 1 byte 1341 ms (50 KB 218 ms, 100 KB 466 ms: crescita quadratica). Un telaio da 1 MB a goccia costa decine di secondi di event loop **bloccato** per connessione, moltiplicato per 20 connessioni per IP (`SENZA_NOME_PER_INDIRIZZO`) e per 5-10 su un Raspberry: la console, i telefoni e tutti i fili di tutte le case sul centralino si fermano.
- Fix: accumulare i pezzi in una lista e concatenare solo quando `lunghezzaTotale >= lunghezzaAttesa`; chiudere un telaio che non si completa entro N secondi; sul centralino anche un tetto di byte/secondo per IP.

### S6 · Medio · Sul quadro l'identità delle licenze è «del primo che arriva», senza via di recupero

- `quadro/src/licenze.js:477-492` (`riconosci`): la prima `POST /v1/licenze/{casa,riscatta,negozio}` vista per una `casa_…` ne salva l'impronta del segreto; da lì solo quel segreto passa (403 `segreto-sbagliato`). L'identificativo della casa non è segreto per scelta (`quadro/src/chiavi.js:28-38`): sta nelle intestazioni di ogni rapporto, negli URL dell'editor, nella console di ogni installatore e nella scheda «Licenza» dell'add-on.
- Scenario: un ex installatore (o chi ha visto la matricola) registra `{casa: "casa_<vittima>", segreto: "x"*16}` prima che quella casa chiami il quadro (case con add-on precedente alla 1.10.0, o mai collegate): la vittima non potrà mai diventare Premium, riscattare codici o far valere ricevute. Non esiste una via del gestore né un verbo di `le-licenze.mjs` per sbloccarla: si corregge a mano in `licenze.json`. Inoltre `soggetti` cresce senza tetto e ogni soggetto nuovo riscrive l'intero archivio in modo sincrono (`:487`).
- Fix: legare l'identità delle licenze a qualcosa che la casa già prova (l'impronta di `x-casa-segreto` imparata al primo `/rapporto` autenticato, `chiavi.js:306`) o alla chiave del quadro; aggiungere `DELETE /gestore/soggetti/:sog` e un verbo CLI; tetto su `soggetti` e scrittura incrementale.

### S7 · Medio · Le ricevute dei negozi sono credenziali al portatore che spostano l'abbonamento; sandbox e TestFlight danno Premium vero

- `quadro/src/negozi.js:463-485` (`_apple`): accetta anche un semplice `transactionId` numerico (`/^\d{1,40}$/`), lo chiede ad Apple con il JWT dello sviluppatore e, se produzione risponde 404, **riprova il sandbox**. `quadro/src/licenze.js:804-832` (`dalNegozio`) ritrova la licenza per `sha256(piattaforma:acquisto)` e fa `una.sog = sog`: chi presenta lo stesso id/purchase token prende l'abbonamento, e la casa di chi ha pagato torna Base entro 8 giorni. Lo spostamento è voluto («Ripristina abbonamento», `docs/LICENZE.md`), ma qui lo decide chiunque abbia l'id (ricevute per e-mail, cronologia acquisti, ticket di assistenza).
- Gli acquisti sandbox/`testPurchase` sono solo **marcati** (`negozi.js:435,562`, `licenze.js:862`), non rifiutati, e ogni periodo breve riceve i 3 giorni di `MARGINE_DEL_RINNOVO` (`licenze.js:145,510`): un tester TestFlight ha Premium vero, a oltranza.
- Fix: per Apple richiedere la JWS firmata di StoreKit 2 (si ha già `verificaLaJwsDiApple`) e non l'id nudo; rifiutare `environment === "Sandbox"`/`testPurchase` salvo case in una lista; non spostare una licenza su un altro `sog` senza conferma del titolare attuale (o almeno log e avviso).

### S8 · Medio · Esaurimento di risorse sul centralino (pubblico)

Tutti confermati nel codice; nessuno richiede credenziali.

- **Registro delle case senza tetto** — `centralino/src/case.js:45-52,139-151`: 20 case nuove/ora per IP (IPv6 per /64) e 500/ora in tutto, nessun tetto per le case vive (solo per le addormentate), riscrittura sincrona dell'intero `case.json` ogni 2 s. 25 IP → 12k case al giorno → dopo settimane decine di MB riscritti a ogni giro. Fix: tetto sulle case vive con espulsione di quelle giovani mai ritornate, conteggio IPv6 per /48, scrittura asincrona o SQLite come la chat.
- **Chat come pozzo su disco** — `centralino/src/chat.js:41-64,505-517`: una linea nasce con un `casa_` inventato e un segreto ≥32 caratteri; 60 linee nuove/ora globali, 5/ora per /64, poi 20 messaggi/ora × 4000 caratteri per linea, per 180 giorni. Fix: tetto totale di linee e di messaggi/ora globale; accendere `CHAT_SOLO_CASE_CONOSCIUTE=1` (esiste già); quota su disco.
- **Scritture su GitHub dalle case «anziane»** — `centralino/src/sportello.js:44-50,125-131`: il tetto globale di 600/ora vale solo per le case con meno di 7 giorni; case fabbricate gratis (punto sopra) dopo una settimana hanno solo i 90/ora per IP: issue, commenti e allegati da 10 MB committati per sempre sul ramo `allegati`, fino ai limiti secondari di GitHub per il token del manutentore. Fix: tetto globale per tutte (più alto), tetti giornalieri per casa, scrittura solo da una casa collegata sul filo.
- **Posti telefoni per casa** — `centralino/src/centralino.js:77,969-972`: `TELEFONI_PER_CASA = 20` contati per casa senza quota per IP; `/telefono/<casa>` non chiede credenziali e dopo la prima parola il canale non ha ping né scadenza. Chi conosce la matricola tiene occupati i 20 posti e i telefoni veri leggono «troppi telefoni su questa casa». Fix: quota per IP per casa (3), contare solo i canali che hanno completato la stretta col ponte, ping/idle timeout sui telefoni.
- **Buffer di uscita solo per presa** — `centralino.js:155,448-455`: 8 MiB per socket × 10.000 prese totali / 200 per IP. Fix: 1-2 MiB per socket più un budget globale; `socket.pause()` del mittente quando `writableLength` del destinatario è alto.

### S9 · Medio-basso · L'app crede a un «no» in chiaro e si blocca su «aggiornala»

- `app/lib/ponte/stretta.dart:196-199`: il rifiuto `{v:1, no, motivo:"aggiorna-l-app", minima}` arriva **prima** di qualunque chiave; `app/lib/aggiornamento_obbligatorio.dart:172-181` mette `_laCasa = true` (mai rimesso a `false`) e `:198-207` **persiste su disco** `versione_minima.json` se `minima > questa`; `bloccata = attiva && (questa < _minima || _laCasa)`.
- Scenario: su qualunque Wi-Fi l'app bussa in chiaro all'indirizzo LAN memorizzato (`sonda.dart`, `indirizzo.dart:27-51` considera «di casa» anche nomi `.local` → spoof mDNS/LLMNR banale); chi risponde su `ws://192.168.x.y:8098/casa` con quel rifiuto copre l'app con «aggiornala» finché `/versioni` del centralino (HTTPS) non corregge la minima e l'app viene riavviata. Variante: rispondere `pronto` e tacere lascia il filo in `chiamando` senza timeout (`filo.dart:517-597`).
- Fix: trattare ogni `no` in chiaro come intoppo da riprovare (come già per `riabbina`); non persistere mai `minima` dalla stretta; azzerare `_laCasa` a stretta riuscita; accettare `aggiorna-l-app` solo dentro il cifrato o da `/versioni` HTTPS; timeout fra `pronto` e `auth_ok`.

### S10 · Medio · L'add-on chiede più di quello che usa (amplifica S1/S2)

- `ponte/config.yaml:110` `homeassistant_config:rw` (tutta `/config`, con `secrets.yaml` e `.storage/auth*`) per scrivere `www/gdahome/plancia.js` e `LEGGIMI.txt` (`ponte/src/plance-in-casa.js:178-180`, tenuto fermo da `ponte/test/plance-in-casa.test.js:210`); `:158` `hassio_role: manager` (gestione add-on, opzioni Supervisor) per leggere `/addons` (`ponte/src/ferro.js:500-505`). Ben documentato nel manifesto, ma un add-on compromesso (S1/S2) ha in mano la casa intera.
- Fix: `homeassistant_config:ro` consegnando la cartina in altro modo (o almeno documentarlo nel README utente); verificare se `/addons` basta con un ruolo più basso; `panel_admin: true` esplicito.

### S11 · Medio-basso · Il logo dell'installatore si scarica senza tetto

- `ponte/src/installatore.js:326` `Buffer.from(await risposta.arrayBuffer())` legge tutto il corpo; `QUANTO_GROSSO` (128 KB, `:58`) non è mai usato; il controllo arriva dopo (`cheImmagineE`). Un quadro compromesso (o un MITM con CA) risponde gigabyte a `GET /marchio/inst_…` → OOM dell'add-on a ogni rapporto (ogni minuto). Precondizioni: `quadro` incollato e `quadro_marchio` acceso (di serie).
- Fix: `content-length` e lettura a flusso con tetto `QUANTO_GROSSO`, abortendo oltre.

### S12 · Medio-basso · Catena di rilascio: artefatti committati, dipendenze non pinnate, token persistiti

- `porta-l-app.yml:76-92` committa `ponte/app` (25 MB) via `strumenti/spingi.sh` anche su `main`; `ponte/Dockerfile:50` lo copia nell'add-on; nessuna verifica bundle↔sorgenti (a differenza di `ponte/plancia/pacco`, verificato da `improntaDeiSorgenti`). Alla 1.11.9 l'add-on serviva una web app **1.10.11** (vedi I-14).
- `dependabot.yml` non copre Gradle (AGP 9.1.0, Kotlin 2.4.0, `androidx.car.app`, `play-services-wearable`); base image per tag e non digest (`ponte/build.yaml:2-6`); `apk add nodejs` senza versione (`Dockerfile:7`); `gem install xcodeproj` senza versione (`orologi.yml:60`, `vetrina.yml:58`); `strumenti/gradle-orologio.sh:16-22` scarica Gradle senza `distributionSha256Sum`.
- Token di scrittura in `.git/config` mentre si esegue codice: `il-tramite.yml:46-49,93-94`, `l-etichetta.yml:80-82`, `porta-l-app.yml:40`.
- Fix: costruire la web app nel flusso di rilascio o attestarne la provenienza e verificarla in `ponte/test`; aggiungere `gradle` a Dependabot; pin a digest/versione; `persist-credentials: false` con token solo nello step di push.

### Bassi

- **B1 · dogana `auth/sign_path` senza tetto su `expires`** — `ponte/src/dogana.js` (`perche`, ramo `auth/sign_path`): HA non impone un massimo (`homeassistant/components/auth`, default 30 s). Un utente non admin, o un telefono della casa di prova, si fa firmare un URL di telecamera o media valido anni, legato al refresh token del Supervisor: sopravvive allo stacco del telefono. La plancia usa 4 ore (`live-ui-section.js:256`) e 30-60 s altrove. Fix: rifiutare `expires > 24*3600`.
- **B2 · Comandi Zigbee e registri aperti a chi non amministra** — `ponte/src/commissioni.js:291-311` (`SOLO_CHI_AMMINISTRA`) non include `ponte/zigbee/stato|elenco|mappa|dimmi`, `ponte/registri`, il catalogo: un familiare non admin o un revisore con il codice di prova legge l'inventario Zigbee (nomi, IEEE, modello, LQI) e lancia scansioni di topologia (`mappa {rifai:true}`, `zigbee.js:1555-1623`) che occupano la rete radio; in HA i comandi sottostanti sono `require_admin`. Fix: `mappa` con `rifai` fra gli admin; valutare `elenco|stato`; documentare il resto.
- **B3 · `quadro_marchio` lascia creare plance** — `ponte/src/installatore.js:105-107` accetta `nuova:true` nelle vesti e `plance.vesti` → `_nasce` (`plance.js:479-485`): con il solo interruttore del marchio (acceso di serie) il quadro crea fino a 8 plance e rinomina tutto; la doc dice «nome e logo». Fix: legare `nuova` a `quadro_configurazione`.
- **B4 · Il quadro può far produrre un rapporto al secondo** — `ponte/src/rapporto.js:165` `IL_FILO_ALMENO = 1_000`: ogni risposta `{rapporto:true}`/`fai` rifà `get_states` non cachato. Fix: pavimento 10-15 s, cache di `get_states`.
- **B5 · Console: nessun controllo di origine proprio** — `ponte/src/server.js:466-510`: `/api/*` guarda solo IP del proxy e `X-Remote-User-Id`; `corpoDiJson` accetta `text/plain`. Oggi protegge il cookie `ingress_session` (`SameSite=Strict`, impostato dal frontend HA, da confermare) e il token casuale nel percorso. Fix economico: `chiedi()` in `console.js:148-166` manda `X-Gdahome: console` e il server lo pretende sui metodi non GET, o controlla `Sec-Fetch-Site`.
- **B6 · Nessuna CSP `script-src` su console e plancia** — `PER_LA_CONSOLE` (`server.js:111-116`) è solo `frame-ancestors`; la plancia legge `window.parent.document.querySelector('home-assistant').hass` (`dashboard-runtime-it.js:1317-1324`): una XSS futura = token HA dell'utente. La console ha un solo script esterno: `script-src 'self'; object-src 'none'; base-uri 'none'` è gratis; per la plancia un nonce per risposta in `premesse.js`.
- **B7 · Quadro** — `server.js:1096` confronta il Bearer con `stessoSegreto` (lunghezza non costante) e senza `Freno` sui tentativi su `/gestore/*` e `/console/*`; `:2206-2212` `frame-ancestors *` anche per `/gestore/` quando `QUADRO_OSPITI` è vuoto; `chiavi.js:286-345` un invito valido + matricola nota lega una casa mai vista a un altro installatore; `segnalazioni.js:620` toglie i metadati solo ai JPEG (HEIC, PNG `eXIf`, WebP, MP4 conservano le coordinate GPS e finiscono per sempre in una repo pubblica); `/plancia-da-lontano/<casa>/<profilo>/` e i 503/426 di `/licenza/<casa>` sono oracoli di presenza (accettati per design, matricola a 128 bit).
- **B8 · App** — `servitore.dart:151-167` porta fissa 43117: tutte le case condividono l'origine e il `localStorage` della plancia nel WebView (configurazione, entity id, URL telecamere di un'altra casa leggibili da una plancia ostile; i segreti no). `la_guardia.dart:399-403` + `main.dart:620-622`: lucchetto fail-open quando la biometria non è disponibile. `stretta.dart:239`: il testo del `no` in chiaro va a schermo (social engineering). `gettone.dart:89-93`: senza `casaAlCentralino` basta un `sog` che inizi per `casa_` (bypass Premium solo lato client). `app/android/app/chiave-di-prova.jks` con password `gdahome` (`build.gradle.kts:60-66`): ben contenuta (release senza `chiave.properties` si ferma, `:137-148`; CI rifiuta i tag senza chiave vera, `app.yml:222-225`), ma chiunque può firmare pacchetti `.prova` installabili sopra quelli dei tester.
- **B9 · Ponte** — un telefono abbinato può aprire connessioni illimitate, ognuna con fino a 16 MB di pezzi `|` in memoria (`portiere.js`, `collegatiPerDispositivo` solo conta); `ponte.js:251-258` un telefono senza `utente` è amministratore (legacy voluto, ma «non si sa» = sì); `commissioni.js:1029-1041` doppio `_finito()` nel ramo redirect dei loghi svuota il semaforo `INSIEME`; `cucitura.js` non ha il secchio di `ponte.js` (un utente HA non admin può inondare HA via `ponte/http`); `chat.js:96-102` un nome con CR/LF rompe la chat (undici rifiuta l'intestazione); `home-widgets-section.js:7752` `href` con `release_url` dell'entità `update` senza filtro di schema (`javascript:`); `media-in-azioni-section.js:117` `url("${copertina}")` senza quoting; `renderers.js:99` fallback `innerHTML` latente; `plancia-sw.js:142` `includes()` invece di `startsWith()`, risposte senza `nosniff`/CSP; `console.js:2827-2850` `window.open` senza `opener = null`; Caddy per gdahome.org senza HSTS/CSP/`frame-ancestors` (`centralino/accendi.sh:925-958`).
- **B10 · 1.11.10, `chi-configura.js`** — il confronto con la casella «Utente admin» accetta anche il **nome visualizzato** (non univoco in HA), non solo l'id; un utente non admin nominato riscrive l'intera plancia (voluto). Preferire il solo id.

### Info

- `/data` in chiaro: `casa.json` (identità e segreto verso centralino), `quadro.json` (segreto verso il quadro), `dispositivi.json` (chiavi del filo), `casa-di-prova.json` (codice): finiscono nei backup di HA; solo `dispositivi.json` è documentato.
- `ponte/quadro/stato` consegna `chiaveDelCruscotto`/`chiaveDellaGestione` a ogni telefono amministratore (anche uno legacy senza utente) e `voci-nella-barra.js:194` le scrive in `.storage` di HA (voluto, commentato).
- Un timer clima (`spegnimento.js`) sopravvive alla revoca del telefono; `plance-in-casa.js:1020-1033` cancella al riavvio ogni dashboard HA con `url_path` `gdahome-*` non sua.
- `chiamata.js`: `detto.da` del centralino va nei registri senza sanitizzazione (iniezione nei log da un centralino malevolo) e nel conteggio dei tentativi.
- Chi tiene il centralino può fermare tutte le app con una minima enorme (`versione-minima.js`): kill-switch voluto.
- Chiavi TomTom/OCM murate con `--dart-define` negli APK pubblici: limitarle lato provider per package/SHA-1.

---

## Parte 2 — Incongruenze: cosa sistemare

### 2.A · Informazioni sbagliate rivolte all'utente (soldi, limiti, sicurezza)

| # | Dove | Cosa dice | Cosa c'è davvero | Correzione |
|---|------|-----------|------------------|------------|
| I-1 | `README.md:209` (tabella prezzi), `ponte/README.md:49,56`, `quadro/README.md:735`, `docs/BLINDATURA.md:318` | «fino a 8 plance per casa» | `ponte/src/plance.js:122` `QUANTE_AL_MASSIMO = 30`, `quadro/src/case.js:75`, `premium.dart:709`, sito, `docs/LICENZE.md:11`, e lo stesso `README.md:116` dicono 30 | scrivere 30 ovunque |
| I-2 | codice | `plancia-da-lontano.js:35` `PROFILI_AL_MASSIMO = 8` («le stesse di plance.js») e `installatore.js:74` `VESTI_AL_MASSIMO = 8` | `plance.js:122` = 30, `quadro/src/plance.js:46` = 30 | da lontano si configurano e vestono solo 8 plance su 30: allineare a un'unica costante |
| I-3 | `README.md:246-248,392-394` | il codice regalo si scrive «nell'app» | `premium.dart:119-125`: non nell'app per iPhone (regola 3.1.1); `docs/LICENZE.md:345`, `app-store.md:231` lo dicono | aggiungere l'eccezione iPhone |
| I-4 | `docs/BLINDATURA.md:97-100,230-231,243-244,281-288` | «la chiave pubblica di serie è vuota… tutto è sbloccato per tutti» | `ponte/src/chiave-licenze.js:23` e `app/lib/licenza/chiave.dart:22` hanno la chiave vera; solo il centralino è vuoto (`docs/ACCENDERE-GLI-ACQUISTI.md` è corretto) | aggiornare BLINDATURA §4 e §7 |
| I-5 | `README.md:94,398`, `ponte/README.md:7-8,22`, `COME_PROVARLA.md:37-38,195,291`, `ponte/config.yaml:14` | «Apri **gdahome** dalla barra laterale e premi Genera QR code» | `panel_title: Configura gdahome` (`config.yaml:75`); «gdahome» in barra è la plancia (`plance.js` `TITOLO_DELLA_PRIMA`) | «Configura gdahome» nei passi di abbinamento |
| I-6 | `ponte/README.md:328-333` «Cosa finisce sul disco» | 5 file | scrive anche `casa.json` (segreto in chiaro), `quadro.json`, `licenze.json`, `versioni.json`, `chat.json`, `vesti.json`, `spegnimenti.json`, `installatore/*`, `www/` | completare, e dire che i segreti verso centralino/quadro stanno in chiaro per necessità |
| I-7 | `quadro/README.md:661-674` | il codice dell'installatore è «`quadro\|1\|https://…\|K7M2-…`» | `ponte/src/rapporto.js:216-222` **rifiuta** ogni riga con `\|`; `config.yaml:189` dice «venti caratteri» (sono 16 + 3 trattini) | riscrivere il paragrafo |
| I-8 | `ponte/README.md:123` | con `da_fuori_casa` spento «la casa non chiama nessuno» | `opzioni.js:200-205`: chiede comunque `tramite.gdahome.org/versioni` ogni 6 h; la chat usa un centralino fisso (`chat.js:53`); i loghi vengono da `brands.home-assistant.io` | dire cosa parte comunque (privacy) |
| I-9 | `quadro/README.md:71-73` | il gestore vede «quanti impianti e non quali… una prova controlla che non finiscano nomi» | `/gestore/installatore/<id>/case` restituisce i nomi delle case (`quadro/src/server.js:87-94,1917-1925`) | aggiornare il paragrafo (privacy) |
| I-10 | `ponte/config.yaml:189-200`, traduzioni, `quadro/README.md` | il rapporto manda «poche righe di numeri» più nomi dei dispositivi giù e degli aggiornamenti | manda anche i **nomi dei nodi** scelti dall'abitante (`ferro.js:231-236`), nomi degli add-on, `release_summary` di terzi, titoli delle plance, IP LAN e segnale Wi-Fi | elencarli |
| I-11 | `quadro/README.md:654-659` | `quadro_ogni` 15 minuti; `chiave_console` nello schema | `rapporto.js:105` e `config.yaml:213` = 1; `chiave_console` non esiste più (`assistenza.chiave`); i conti «96 rapporti al giorno» (`:704-707,1103-1105`) sono sui 15 minuti | correggere |
| I-12 | `README.md:303` | «dieci controlli al giorno» | dieci controlli per casa, rapporto ogni minuto | correggere |
| I-13 | `ponte/README.md:160-171` «Le opzioni» | manca `quadro_marchio` | `config.yaml:274,371`, traduzioni, `opzioni.js:73` (accesa di serie, e lascia creare plance: B3) | aggiungere |

### 2.B · Codice ↔ codice

- **I-14 · La web app dentro l'add-on può restare indietro** — alla 1.11.9 `ponte/app/version.json` diceva `1.10.11` (`build 1101100`, commit `131b7cb`), con 25 file di `app/lib` cambiati nel frattempo; `docs/LICENZE.md:417` promette «sempre della sua stessa costruzione». Alla 1.11.10 è stata ricostruita, ma nessuna prova lo impone: `ponte/test/marchio.test.js:167-249` lega `config.yaml` ↔ `pubspec` ↔ `versione.dart` ↔ `plancia/ORIGINE.json`, non `ponte/app/version.json`; `porta-l-app.yml` parte solo a mano. Fix: asserzione `version.json.build_number == costruzione del pubspec` in `marchio.test.js`, o costruzione nel rilascio.
- **I-15 · `registro.errori24h` è un controllo morto** — `quadro/src/forma-del-rapporto.js:234` e `controlli.js:345-346,393-394` lo giudicano, ma `ponte/src/rapporto.js` (`fabbricaIlRapporto`, `:489-558`) non lo produce mai; l'esempio in `quadro/README.md:493-497,609` è stantio (`batterie.sotto20` invece di `scariche`, `fuori.daGiorni`). Fix: produrlo da `registri.js` o toglierlo.
- **I-16 · `premium-richiesto` nella stretta** — `portiere.js:272-276` lo manda «per l'app»; `stretta.dart:189-240` riconosce solo `aggiorna-l-app` e `riabbina` → errore generico in italiano. Oggi irraggiungibile (`licenze.limitata` è sempre falso), ma il giorno che si riaccende l'app non porta alla pagina Premium. Fix: `case 'premium-richiesto'` in `stretta.dart`.
- **I-17 · Il ponte finto dell'app è un «ponte di prima»** — `app/test/ponte/ponte_finto.dart:1398-1403` non manda `mucchio` né `da_casa`; i rami di `stretta.dart:274-275`/`collegamento.dart` per Base/fuori non sono mai esercitati. Fix: aggiungere i due campi configurabili.
- **I-18 · Copie dal ponte** — `centralino/src/PRESI_DAL_PONTE.md:1-4` dice «tre file», la prova (`copie.test.js:30-38`) ne copre sette (oggi tutte byte-identiche). `centralino/src/indirizzo.js` e `quadro/src/indirizzo.js` (e `freno.js`) hanno lo stesso nome ma implementazioni diverse senza prova: il centralino prende il **primo** elemento di `X-Forwarded-For` (`:19-22`), il quadro l'**ultimo** con `isIP` (`:30-35`). Innocuo dietro il Caddy del tramite (senza `trusted_proxies` riscrive l'intestazione); se un giorno ci fosse un CDN davanti, ogni limite per IP del centralino diventa aggirabile. Fix: allineare al quadro.
- **I-19 · Codice morto** — `ponte/chat/allega` servito (`commissioni.js:1716`), provato e imitato dal finto, ma nessuno lo manda; `cifra.js:308` `chiavePrivataDaDer` mai usata; `ponte/console/index.html:963` bottone «Aggiorna gdahome» nascosto con `POST /api/aggiornamento` che risponde 409; `sito/casa-in-pagina.js` non è più caricato da `index.html` ma `strumenti/porta-nel-sito.mjs:44,98`, `centralino/accendi.sh` e `il-sito.yml` continuano a copiare e provare la plancia nel sito; esportazioni inutilizzate in `licenze.js`, `ricevuta-da-fuori.js`, `rapporto.js`, `centralino.js`, `quadro/src/licenze.js`, `negozi.js`.
- **I-20 · Il sigillo della plancia è spento** — `ponte/plancia/ORIGINE.json` `firma: ""`, `ponte/src/provenienza.js:45` `CHIAVE_DI_CHI_PUBBLICA = ""`, `firma-la-plancia.mjs` non chiamato da nessun workflow: la console può dire al massimo «i file tornano, senza firma», mai «originale»; `docs/SVILUPPO.md` e `README` lo presentano come verifica di autenticità. Fix: fabbricare la coppia e firmare nel rilascio, oppure riscrivere la doc come «rilevamento di modifiche».
- **I-21 · Metadati** — `ponte/package.json:2-7` nome `dashboardmodern-ponte`, descrizione di DashboardModern, `engines.node >=20` contro `>=22` del resto; il commento in `chiamante.js` parla di «immagine con Node 20» ma la base è Alpine 3.22 (Node 22); `segni.js` è il modulo delle icone degli aggiornamenti mentre «segno» ovunque vuol dire token; `strumenti/centralino.mjs:1` «due posti» ma ne gestisce tre e `centralino-di-difetto.test.js` non asserisce la chat; `commissioni.js:1551-1557` commento sulla console chat superato; `collaudo/centralino-finto.js:134` versione «plancia 1.4.19 ponte 0.19.0».
- **I-22 · Vettori di cifra solo in Dart** — `cifra_test.dart:26` «come li ha stampati il Node», ma `ponte/test/cifra.test.js` non ha vettori fissi e il generatore non è nel deposito: una modifica a `cifra.js` non romperebbe nessuna prova Node (oggi tornano, verificato). Fix: incollare gli stessi vettori nella prova JS.

### 2.C · Documentazione stantia o contraddittoria

- `docs/SVILUPPO.md:18,107-111`: «nel sito gira la plancia vera con `casa-in-pagina.js`» — `sito/README.md:11-24` e `sito/index.html` (fotografie, nessun iframe) dicono il contrario; `collaudo/README.md:128-129` cita `listino.js`, che non esiste.
- `COME_PROVARLA.md:252-255` vs `:425-427` («Sostieni il progetto» c'è / non c'è: non c'è, `premesse.dart:338-345`); `:474` «l'indirizzo nelle opzioni» (casella rimossa); `:292,325-326` etichette della console («gdahome in un browser» → «gdahome nel browser»).
- `docs/PLANCIA-A-MURO.md:59`: mancano le griglie 4×4, 5×4, 6×4 (`plancia-a-muro.js:77-91`, `POSTI_AL_MASSIMO = 24`).
- Nome della scheda dell'installatore incoerente: «Installatore» (console) / «Il quadro» / «Il cruscotto» (`config.yaml:207,230-231`, `it.yaml:69,89`, `en.yaml:51`, `quadro/README.md:676,828`).
- `ponte/config.yaml:32-45` e `ponte/CHANGELOG.md:6-11`: «i due numeri camminano da soli… 1.5.0 e 1.4.32» — oggi `plancia/ORIGINE.json` porta la versione dell'app e `marchio.test.js:224-245` li lega.
- `strumenti/chiave-licenze.mjs:9-13` («fabbrica la coppia») vs `:28-32` («qui la coppia non si fabbrica») vs codice `:170-174` (la fabbrica senza `--pubblica`); `docs/BLINDATURA.md:285-288`; intestazione di `ponte/src/chiave-licenze.js:9-17` («vuota di serie… stessa riga in tutti e tre»).
- Variabili non documentate: centralino `GITHUB_SEGNALAZIONI`, `GITHUB_REPO`, `GITHUB_REPO_ALLEGATI`, `NOME_DEL_SITO`, `NOME_DELL_APP` (`centralino/src/index.js:35-44,84-85`); quadro `QUADRO_PLANCIA`, `QUADRO_TRAMITE_SALUTE` (`quadro/src/index.js:59,63`).
- Vie non in tabella: centralino `POST /licenza/<casa>`, `/casa/<casa>/segnalazioni[/n[/risposte|allegati]]`, chat, `WS /casa/<casa>`; quadro `PUT/DELETE /console/io/marchio`, `/console/note/<segno>`, `POST/DELETE /console/casa/<m>/(installa|riavvia|configura)`, `/gestore/installatore/<id>/case`, `…/congela`, `/gestore/salute`, `/attesa`, `/carattere/…`, `/marchio/<inst>`, `GET /v1/licenze/revocate`, errore `503 licenze-non-configurate`.
- Conteggi delle prove: `centralino/README.md:209` «diciotto» (sono ~240); `quadro/README.md:12` «sessantacinque… più di settecento» (sono ~434; i tre server ~1.750 più plancia e app).
- `ponte/translations/it.yaml:176` ed `en.yaml:137`: `network:` annidato sotto `assistenza` invece che al livello di `configuration` → HA lo ignora (innocuo per `ports_description`).
- `ponte/README.md:36-37` «con Base da quell'indirizzo la casa non si apre» contraddice `docs/LICENZE.md:329-332` (da casa, con indirizzo pubblico, si apre).
- `app/README.md` è il boilerplate Flutter linkato da `docs/SVILUPPO.md:12`; `docs/SVILUPPO.md:129-133` omette `npm run test:centralino`.

---

## Parte 3 — Fatto bene (da tenere)

- Protocollo: X25519 effimero + HKDF-SHA256 con etichette separate, AES-256-GCM, nonce con direzione e contatore, riordino e replay rifiutati, codice di abbinamento di 16 lettere (~79 bit) dentro la chiave, conferma delle due pubbliche, legame della trascrizione (`lega`), `riabbina` in chiaro non creduto e `auth_invalid` solo cifrato, tetti anti-bomba a 16 MB; vettori Dart/Node identici.
- Segreti: impronte SHA-256 e `timingSafeEqual` ovunque (anche il confronto del segno scorre tutto l'elenco); Keychain `this_device`/Keystore; `allowBackup=false`; `FLAG_SECURE`; cookie del servitore locale `httpOnly; SameSite=Strict`; TLS mai disattivata verso l'esterno.
- Dogana: liste chiuse per chi non amministra, Supervisor/credenziali/automazioni/risorse Lovelace/HACS chiusi per tutti, percorsi REST senza trucchi, telecamere delle plance riservate.
- Frontend: `textContent` nella console, `esc()/cdJs()` nella plancia, CSP con hash per script sulle console del centralino e del quadro, `postMessage` filtrato per origine e mittente, immagini con `sandbox`, SVG mai caricabili, path traversal coperto con `realpath` e allowlist.
- CI: azioni pinnate a SHA, nessun `pull_request_target`, nessuna `${{ }}` nei `run:`, environment per negozi e produzione, keystore solo in `$RUNNER_TEMP`, `nessun-segreto.mjs` nelle prove, lockfile committati.
- Server: `prepara` senza privilegi, systemd hardening, `LoadCredential`, `/salute` dettagliato solo da localhost, difese SSRF sui webhook del quadro, JWS Apple verificata fino alla radice fissata.

---

## Parte 4 — Da verificare (non confermabile da qui)

- Attributi del cookie `ingress_session` del frontend HA (`SameSite=Strict`): assunto da conoscenza upstream, non da questo repo (pesa su B5).
- Supervisor vecchi che non scrivono `X-Remote-User-*`: in quel caso un header mandato dal client passerebbe alla console (`server.js` `chiGuarda`); difesa: rifiutare quando mancano `X-Ingress-Path`/`X-Remote-User-Id` (già: `amministra()` è falso con `chi` vuoto).
- Con Docker `userland-proxy` l'IP sorgente sulla 8098 potrebbe apparire privato: `da_casa` vero da internet (solo gating Base).
- Scope reale del PAT `GDAHOME_TOKEN` e dove stanno davvero `CHIAVE_ANDROID*` (repository vs environment); se secret scanning e push protection sono attivi.
- Se `/addons` è leggibile con un ruolo Supervisor più basso di `manager`.
- Esistono route di protezione sui tag oltre `v*` non visibili dall'API usata.

---

## Parte 5 — Ordine consigliato

1. Oggi: S1 (togliere l'unione automatica, `persist-credentials: false`, ruleset con check e review), S2 (proteggere `refs/tags/tramite`, reviewer sull'environment), S3 (`environment: negozio` o firma di prova, segreti solo negli environment).
2. Questa settimana: S5 (parser WebSocket) nelle tre copie; S6 e S7 sul quadro; S8 sul centralino (tetti globali, `CHAT_SOLO_CASE_CONOSCIUTE`, quota per IP per casa); S9 nell'app; S11.
3. Prossimo ciclo: S4 (origine della plancia nella web app), S10, S12, i Bassi, e la pulizia documentale della Parte 2 partendo da 2.A (le righe che un utente legge prima di pagare o di fidarsi).
