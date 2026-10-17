# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Chi ha una casa con Home Assistant** e vuole guardarla e comandarla dal telefono senza il lavoro di configurare pagine, token e accessi da fuori. Arriva sul sito da un link del README, da un negozio o da un forum, spesso dal telefono, e vuole sapere in pochi secondi com'è l'app, cosa costa e come si installa.
- **Chi non sa cos'è Home Assistant** e cerca «un'app per la casa»: il sito è per tutti, quindi deve dire cosa fa senza dare per scontato il gergo (confermato dall'utente: «il sito è per tutti»).
- **Chi installa impianti per altri** (installatori): cerca il cruscotto, le licenze da dare ai clienti e un contatto.
- **Chi guida** e arriva per gdanav, il navigatore, anche senza casa domotica.

## Product Purpose

gdahome porta la plancia di Home Assistant sul telefono (Android, iPhone, browser) con un add-on che si installa dal negozio degli add-on. Il sito gdahome.org racconta il prodotto, fa vedere l'app con fotografie vere, dice i prezzi, spiega come si installa e raccoglie i contatti. Successo: chi arriva capisce cosa è, installa l'add-on e scarica l'app; chi installa chiede un accesso al cruscotto.

## Positioning

- **La casa chiama fuori.** Da fuori casa si entra senza aprire porte sul router, senza indirizzo pubblico, senza VPN: è l'add-on ad aprire e tenere un filo verso il centralino, e i messaggi sono cifrati punta a punta (il centralino instrada e non può leggere; una prova automatica lo verifica).
- **Un QR code e basta.** L'abbinamento del telefono avviene inquadrando un QR code mostrato dall'add-on: nessun indirizzo, nessuna credenziale di Home Assistant. Senza fotocamera si digita un codice di **sedici** caratteri in quattro gruppi.
- **La plancia è quella vera** (DashboardModern): l'app non la riscrive, la mostra, con le sue trenta sezioni e la configurazione dal telefono.
- **Premium è della casa, non del telefono.** Tutti i telefoni abbinati sono Premium insieme.
- **Due app dello stesso produttore:** gdahome e gdanav (il navigatore per l'auto elettrica, che va bene anche per la termica), con gdanav Premium compreso in gdahome Premium.

## Operating Context

- Il sito è fatto di **file fermi** in `sito/` (`index.html`, `privacy.html`, `stile.css`, `privacy.css`, `sito.js`, `statico/`), serviti da Caddy sulla stessa macchina del centralino. Si guarda in locale con `cd sito && python3 -m http.server 8099`.
- **Niente da fuori:** nessun carattere, libreria o contatore scaricato da altri domini. I caratteri si servono da `statico/font/`. Una prova (`centralino/test/sito.test.js`) lo verifica, insieme a: titolo presente, tasti lingua `IT`/`EN` senza `data-en`, nessun `data-en` vuoto, ogni file chiamato esiste dentro `sito/` e in git, le sezioni `#plancia` (≥3 foto), `#app` (≥4 foto), `#gdanav` (≥6 foto) con `src="statico/..."`, il menu `nav.navigazione` con voci per `plancia`, `app`, `gdanav`, `prezzi`, `contatti`, nessun `<iframe>`, il link `href="privacy.html"`, la parola «sedici»/«sixteen» per il codice e nessun'altra lunghezza, e l'informativa con le stesse sezioni e data di `docs/PRIVACY.md`.
- **Due lingue nella stessa pagina:** l'italiano nel DOM, l'inglese in `data-en` e `data-en-<attributo>`; `sito.js` le scambia senza ricaricare. Il meccanismo resta (confermato dall'utente).
- Il modulo dei contatti fa `POST /contatto` al centralino; senza JavaScript funziona lo stesso; con JavaScript l'esito compare sotto il tasto. Campo trappola `sito`, campo nascosto `lingua`, `data-scrivi` con l'indirizzo.
- Il collaudo (`collaudo/guarda-il-sito.mjs`) apre il sito con Playwright a tre larghezze e controlla fotografie, menu del telefono, lingua, nessuno scorrimento laterale.
- Prettier formatta `sito/*.html|css|js` (`npm run format:check`).

## Capabilities and Constraints

- **Prezzi e regole (`docs/LICENZE.md`, README):** gdahome Base gratis per sempre (una plancia, una casa, rete di casa, segnalazioni e chat di assistenza, gdanav gratis, nessun account). gdahome Premium **4,99 € al mese · 49,99 € all'anno**, primi 14 giorni gratis la prima volta: fino a 30 plance e 10 case, da fuori casa cifrato, configurazione della plancia e Zigbee dall'app con «Dove lo metto?», plancia a muro (tablet/NSPanel, fino a 8 pagine), al polso (Apple Watch, Wear OS), in auto (Android Auto, CarPlay), gdanav Premium compreso, per tutti i telefoni della casa e il browser. gdanav gratis (auto termica completa con distributori e prezzi MIMIT, elettrica con batteria scritta a mano e percorso senza soste, traffico, autovelox, meteo, mappe offline, Siri/«Ok Google»). gdanav Premium **2,99 € al mese · 29,99 € all'anno**, 14 giorni gratis: Home Assistant e batteria letta dall'auto (Android Auto, OBD, gdahome), soste alle colonnine con stato in tempo reale, Android Auto e CarPlay. Codice regalo `GDA-XXXX-XXXX-XXXX`, una volta sola. Si compra dal telefono (Play Store / App Store), non dal browser. Quando Premium finisce la casa torna Base e le plance in più restano salvate.
- **Installazione:** serve Home Assistant OS o Supervised (Supervisor); su Container e Core non esistono add-on. Archivio da incollare: `https://github.com/danigio15/gdahomeapp`. App sul Play Store (`com.gdahome.gdahome`), App Store (si cerca gdahome), browser `https://webapp.gdahome.org`.
- **Installatori:** cruscotto con tutti gli impianti, dieci controlli al giorno per casa, avviso quando una casa smette di parlare; pacchetto di licenze per durata (mese, anno, per sempre), assegnate alla casa o trasformate in codice regalo; aggiornare, riavviare e configurare la plancia da lontano solo con tre interruttori accesi dal cliente; non vede plancia, stanze, persone, telecamere: numeri, non nomi. Accesso chiedendolo dai contatti.
- **Contatti:** `domotica@crvgroup.it`. Nel sito i testi e i fatti di oggi restano (confermato dall'utente): cambia la forma, non le promesse.
- **In arrivo** (dichiarato nel sito di oggi): gli aiutanti di Home Assistant nativi nell'app, le automazioni guidate.
- Il codice è pubblico ma non open source: Licenza d'uso di gdahome 2.0 (`LICENSE`, in italiano con la traduzione inglese). Titolare Giovanni d'Aniello, distributore CRV Immobiliare S.r.l.; uso permesso anche nella propria attività, installazioni per i clienti solo con l'autorizzazione della società; vale anche per la plancia (già DashboardModern).

## Brand Commitments

- Nome **gdahome** (minuscolo) e **gdanav** (minuscolo).
- **Il marchio dei negozi** (`sito/statico/marchio.png`, `docs/immagini/banner.png`: icona 3D blu/ambra con la casa) resta ed è lo stesso dell'app; nel sito si usa piccolo e senza bagliori intorno (confermato dall'utente).
- Colori dell'app (`app/lib/vestito/tema.dart`): blu `#2563EB`/`#1D4ED8` come «premi qui», ambra `#F59E0B` come luce accesa, notte `#0F172A`. Non sono pinnati per il sito; sono un fatto dell'app da cui il sito può partire.
- Caratteri: non pinnati. Il sito di oggi usa Archivo per il testo (`sito/caratteri/`) e Oswald, quello dei numeri della plancia, per i prezzi (`sito/statico/font/`). Qualunque carattere nuovo va servito dal sito, mai da Google.
- Voce: italiana, piana, senza gergo da marketing; le frasi dicono cosa succede davvero. Le parole «plancia», «add-on», «centralino», «ponte», «quadro» sono i nomi di casa.
- Preferenza dichiarata dall'utente (14 ottobre 2026) sul sito: **moderno e colorato, da app**. Il primo rifacimento «a catalogo» (carta bianca, righe sottili, tavole numerate) gli è sembrato «troppo bianco e vuoto». Vuole il blu di gdahome come colore vero, fondi colorati a sezioni, le schermate dentro un telefono con un'ombra vera, tasti arrotondati, più aria: un sito di prodotto come quelli delle app che conosce, fatto con cura. Restano esclusi gli effetti da modello: fondi a sfumature, vetro sfocato, aloni, testo sfumato.
- Vincolo esplicito dell'utente: **eliminare l'effetto «AI slop»** dal sito, dall'app e dagli add-on: niente fondi a nuvole sfocate, aloni, vetro sfocato decorativo, testo sfumato, griglie di schede tutte uguali con icona+titolo+testo, numeroni da vetrina, occhielli sopra i titoli.

## Evidence on Hand

- Fotografie vere della plancia, configurata con la casa demo, in `sito/statico/schermate/plancia-*.jpg` (sul telefono: casa, luci, clima, energia con fotovoltaico, rete e batteria, finestre, sicurezza, auto, stanze; sul computer: casa ed energia), fatte da `collaudo/fotografa-la-plancia.mjs` e tenute in `docs/immagini/`. Dell'app in `sito/statico/app/` (menu, plance, premium, plancia a muro, Apple Watch, Wear OS, fuori casa, codice regalo) e di gdanav in `sito/statico/gdanav/` (guida con corsie, svincolo 3D, segnala, viaggio con soste, distributori coi prezzi, la tua auto, premium).
- Il sito non fa vedere i cruscotti (installatori, quadro di chi vende) né la scheda dell'add-on: le loro fotografie restano in `docs/immagini/` per i README (scelta dell'utente, 17 ottobre 2026: «togli dal sito le immagini che riguardano il cruscotto installatore e il cruscotto mio … mostra la dashboard e il navigatore»).
- Icone delle sezioni della plancia in `sito/statico/oggetti/*.svg` (46 icone).
- Nessuna testimonianza, nessun numero di utenti, nessuna recensione: non si inventano.
- Il diagramma «la casa chiama fuori» esiste come SVG nell'`index.html` di oggi.

## Product Principles

1. Far vedere, non raccontare: la fotografia dell'app prima della frase sull'app.
2. Dire la verità anche quando è un limite (serve il Supervisor; dal browser non si compra; Premium finisce e la casa torna Base).
3. Niente che venga da fuori: il sito di un prodotto che non parla con nessuno non scarica niente da nessuno.
4. Una copertina si presenta sempre allo stesso modo: una luce sola, chiara, anche a chi ha il tema scuro.
5. La stessa cosa si dice una volta sola: prezzi, promesse e nomi vengono da README e LICENZE.md.

## Accessibility & Inclusion

Due lingue (italiano e inglese) a parità di contenuto, pagina leggibile senza JavaScript, menu del telefono che funziona senza script, contrasto da testo di lettura, nessun movimento obbligatorio (si rispetta `prefers-reduced-motion`).
