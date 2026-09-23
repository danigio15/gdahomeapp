#!/usr/bin/env bash
#
# Accende il tramite su una macchina appena creata.
#
# Si incolla nella console del fornitore — il riquadro nero dentro la pagina —
# e non serve nient'altro: ne' un computer, ne' un terminale, ne' una chiave
# SSH. Quando ha finito, le case e i telefoni hanno un posto dove incontrarsi
# che non conta i messaggi.
#
# Come si lancia, da `root`:
#
#     read -rsp 'gettone: ' G && echo && curl -fsSL \
#       --config <(printf 'header = "Authorization: Bearer %s"\n' "$G") \
#       -H 'Accept: application/vnd.github.raw' \
#       https://api.github.com/repos/danigio15/gdahomeapp/contents/centralino/accendi.sh \
#       | GETTONE_LETTURA="$G" bash
#
# Il gettone si batte al prompt e non finisce da nessuna parte dove si possa
# rileggere: non nella riga di comando — quella la vede chiunque sia sulla
# macchina, con un `ps` — e non nella cronologia della shell.
#
#   --controlla   guarda se tutto quadra e non installa niente. Si puo' lanciare
#                 anche da un'altra macchina qualunque, per vedere se i nomi
#                 puntano dove devono.
#
# Cosa fa, nell'ordine:
#
#   1. controlla di stare su un Debian/Ubuntu, da root, e che i nomi puntino
#      a questa macchina;
#   2. chiede le due cose che non puo' sapere — il gettone delle segnalazioni e
#      la repository dove finiscono — e genera da sola la chiave della console;
#   3. installa Node, Caddy, il blocco di chi prova le password e gli
#      aggiornamenti di sicurezza automatici, e chiude le porte che non servono;
#   4. scarica il tramite dalla repository, in sola lettura, e lo prova con un
#      utente senza privilegi;
#   5. lo accende come servizio, e lo segna perche' riparta da solo;
#   6. mette Caddy davanti, che si prende i certificati per tutti i nomi;
#   7. accende il giro che tiene il tramite aggiornato da solo;
#   8. prova che `/salute` risponda da fuori, e dice la chiave della console.
#
# Se qualcosa va storto si fermerà dicendo cosa, e non a metà: ogni passo e'
# scritto per poter essere rifatto — si può reincollare la riga senza pulire
# niente.
#
# **E rilanciarlo non porta via niente.** I segreti che stanno gia' sulla
# macchina — la chiave della console, il gettone delle segnalazioni, quello di
# lettura — se li rilegge da dove sono scritti, invece di rifarli. Prima non lo
# faceva: chi reincollava la riga per aggiungere un pezzo si ritrovava la
# chiave della console cambiata sotto i piedi, e la chat non si apriva piu'.

set -euo pipefail

# ─── Le cose che questa macchina deve sapere ─────────────────────────────────

REPO_DEL_TRAMITE="${REPO_DEL_TRAMITE:-danigio15/gdahomeapp}"

# Il segno che dice **quale** versione va in produzione.
#
# Non `main`: su main si spinge dieci volte al giorno, e la macchina che
# seguisse main si riavvierebbe dieci volte al giorno — a volte su un commit
# scritto a meta'. Questo e' un segno che si sposta quando si vuole: finche' non
# si sposta, la macchina non si muove.
SEGNO="${SEGNO_DEL_TRAMITE:-tramite}"

NOME_DEL_TRAMITE="${NOME_DEL_TRAMITE:-tramite.gdahome.org}"
NOME_DELL_APP="${NOME_DELL_APP:-webapp.gdahome.org}"

# Il nome nudo, quello che si dice a voce e si scrive su un negozio: una pagina
# sola che racconta cos'e' gdahome e da dove si comincia. Sta sulla stessa
# macchina perche' il certificato ce l'ha gia', e perche' un file fermo non
# costa niente a nessuno.
NOME_DEL_SITO="${NOME_DEL_SITO:-gdahome.org}"

PORTA="${CENTRALINO_PORTA:-8099}"

DOVE="/opt/tramite"
DATI="/var/lib/tramite"
CONFIGURAZIONE="/etc/tramite"
UTENTE="tramite"

# Chi scarica, prova e prepara le versioni nuove. Non e' root e non e'
# nemmeno l'utente del servizio: quello che fa girare — le prove, e lo
# strumento che finisce il sito — e' codice appena arrivato da fuori, e se un
# giorno fosse sbagliato deve trovarsi in mano meno cose possibile.
AGGIORNATORE="tramite-aggiorna"
LAVORO="/var/lib/tramite-aggiorna"

# Le porte che si aprono verso fuori: SSH, e il web. Tutto il resto resta
# chiuso. `TRAMITE_FIREWALL=no` lascia stare il firewall a chi lo tiene per
# conto suo.
FIREWALL="${TRAMITE_FIREWALL:-si}"

SOLO_CONTROLLO=no
[[ "${1:-}" == "--controlla" ]] && SOLO_CONTROLLO=si

# ─── Come si parla a chi guarda ──────────────────────────────────────────────

rosso=$'\033[31m'
verde=$'\033[32m'
giallo=$'\033[33m'
spento=$'\033[0m'

passo() { printf '\n%s▸ %s%s\n' "$giallo" "$1" "$spento"; }
bene() { printf '  %s✓%s %s\n' "$verde" "$spento" "$1"; }
nota() { printf '    %s\n' "$1"; }

male() {
  printf '\n%s✗ %s%s\n' "$rosso" "$1" "$spento" >&2
  shift || true
  for riga in "$@"; do printf '  %s\n' "$riga" >&2; done
  exit 1
}

# ─── 1. Quadra tutto? ────────────────────────────────────────────────────────

passo "Guardo se questa macchina va bene"

if [[ "$SOLO_CONTROLLO" == no ]]; then
  [[ $EUID -eq 0 ]] || male "Questo va lanciato come root." \
    "Nella console del fornitore ci sei gia'; da un terminale, «sudo -i» prima."

  command -v apt-get >/dev/null 2>&1 || male \
    "Questa macchina non e' un Debian ne' un Ubuntu." \
    "Lo script installa i pacchetti con apt, e qui apt non c'e'." \
    "Rifai la macchina scegliendo Ubuntu, l'ultima con scritto LTS."
  bene "Debian o Ubuntu, e sono root"
fi

# L'indirizzo di questa macchina visto da fuori. Serve a confrontarlo coi nomi:
# un record che punta altrove e' il difetto piu' comune, e senza questo
# controllo lo si scopre dopo, quando il certificato non arriva.
mio_indirizzo() {
  local trovato=""
  for dove in "https://api.ipify.org" "https://ifconfig.me/ip" "https://icanhazip.com"; do
    trovato="$(curl -fsS --max-time 8 "$dove" 2>/dev/null | tr -d '[:space:]')" || true
    [[ "$trovato" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] && {
      printf '%s' "$trovato"
      return 0
    }
  done
  return 1
}

dove_punta() {
  getent ahostsv4 "$1" 2>/dev/null | awk '{print $1; exit}'
}

# Come si chiama, nella tabella del DNS, la casella di questo nome. La zona di
# gdahome.org sta su Cloudflare, dove la colonna si chiama «Nome» e il nome
# nudo — `gdahome.org` — si puo' scrivere `@`. Su altri pannelli la colonna si
# chiama «Host» e il nome intero non si scrive: il record finirebbe su
# `gdahome.org.gdahome.org`, e nessuno capirebbe perche' non risponde.
la_casella() {
  local nome="$1"
  if [[ "$(printf '%s' "$nome" | tr -cd . | wc -c)" -le 1 ]]; then
    printf '@'
  else
    printf '%s' "${nome%.*.*}"
  fi
}

if [[ "$SOLO_CONTROLLO" == si ]]; then
  nota "(solo controllo: non installo niente)"
fi

IO="$(mio_indirizzo || true)"
CONFRONTATI=no

if [[ -z "$IO" ]]; then
  nota "Non riesco a sapere qual e' il mio indirizzo visto da fuori."
  nota "Controllo solo che i nomi puntino a qualcosa."
else
  bene "il mio indirizzo e' $IO"
fi

for nome in "$NOME_DEL_TRAMITE" "$NOME_DELL_APP" "$NOME_DEL_SITO" "www.$NOME_DEL_SITO"; do
  punta="$(dove_punta "$nome" || true)"
  if [[ -z "$punta" ]]; then
    male "«$nome» non punta a niente." \
      "Il record non c'e' ancora, o non si e' ancora propagato." \
      "Mettilo cosi': tipo A, Host «$(la_casella "$nome")», valore ${IO:-quello di questa macchina}, senza proxy." \
      "Se al suo posto c'e' una riga del parcheggio del registrar — un CNAME o" \
      "un «URL Redirect» — va cancellata: quelle due cose non stanno insieme."
  fi
  if [[ -n "$IO" && "$punta" != "$IO" ]]; then
    male "«$nome» punta a $punta, non a me ($IO)." \
      "Se davanti c'e' un proxy — la nuvola arancione di Cloudflare —" \
      "spegnilo: il certificato lo prende questa macchina, e col proxy" \
      "davanti non ci riesce. Poi riprova." \
      "Se invece l'indirizzo e' semplicemente sbagliato, correggi il record."
  fi
  if [[ -n "$IO" ]]; then
    CONFRONTATI=si
    bene "«$nome» arriva qui"
  else
    bene "«$nome» punta a $punta"
  fi
done

if [[ "$SOLO_CONTROLLO" == si ]]; then
  printf '\n'
  if [[ "$CONFRONTATI" == si ]]; then
    printf '%s✓ i nomi arrivano tutti su questa macchina.%s\n' "$verde" "$spento"
  else
    printf '%s! i nomi esistono, ma non ho potuto confrontarli con questa macchina.%s\n' \
      "$giallo" "$spento"
    printf '  Lanciato sulla macchina vera, e con la rete aperta, il confronto lo fa.\n'
  fi
  exit 0
fi

# ─── 2. Le cose che non posso sapere ─────────────────────────────────────────

passo "Le tre cose che servono"

# Quello che e' gia' scritto su questa macchina si rilegge, non si richiede.
#
# Alla prima accensione non c'e' niente e si chiede tutto. Ma una seconda volta
# ci sara' — si reincolla la riga per aggiungere un pezzo, o per riportare
# dentro una configurazione — e in quel giro chiedere di nuovo un segreto
# significa, nella pratica, cambiarlo: chi non ce l'ha sotto mano tira avanti,
# e quello di prima smette di valere.
gia_scritto() {
  local file="$1" chiave="$2"
  [[ -r "$file" ]] || return 0
  # `sed` col valore come dato e non come programma: la riga che cerca la
  # scrive lei, non arriva da fuori.
  sed -n "s/^$chiave=//p" "$file" | head -1
}

chiedi_zitto() {
  local domanda="$1" dove="$2" risposta=""
  while [[ -z "$risposta" ]]; do
    printf '  %s' "$domanda" >&2
    IFS= read -rs risposta </dev/tty || true
    printf '\n' >&2
  done
  printf -v "$dove" '%s' "$risposta"
}

GETTONE_LETTURA="${GETTONE_LETTURA:-$(gia_scritto "$CONFIGURAZIONE/lettura" GETTONE_LETTURA)}"
if [[ -z "$GETTONE_LETTURA" ]]; then
  nota "Il gettone che legge la repository del tramite (sola lettura)."
  chiedi_zitto "gettone di lettura: " GETTONE_LETTURA
else
  bene "il gettone di lettura c'e' gia'"
fi

GETTONE_SEGNALAZIONI="${GETTONE_SEGNALAZIONI:-$(gia_scritto "$CONFIGURAZIONE/ambiente" GITHUB_SEGNALAZIONI)}"
REPO_SEGNALAZIONI="${REPO_SEGNALAZIONI:-$(gia_scritto "$CONFIGURAZIONE/ambiente" GITHUB_REPO)}"
# Dove vanno le foto e i video. Vuota vuol dire «la stessa delle issue», ed e'
# come sta oggi: si vedono dentro la segnalazione senza andarle a cercare
# altrove. Si riempie il giorno che convenisse spostarle — gli allegati si
# committano, e restano nella storia di git — senza toccare il programma.
REPO_ALLEGATI="${REPO_ALLEGATI:-$(gia_scritto "$CONFIGURAZIONE/ambiente" GITHUB_REPO_ALLEGATI)}"
# E su quale ramo. Di serie `allegati`, e non il ramo principale: se le foto
# stanno nella repository del progetto, il ramo principale e' quello che Home
# Assistant scarica per installare l'add-on, e ogni foto finita li' se la
# porterebbe dietro chiunque installi. Il ramo si crea da solo al primo
# allegato. Meglio ancora una repository a parte, solo per gli allegati:
# quella si sceglie qui sopra, e il gettone deve poterci scrivere.
RAMO_ALLEGATI="${RAMO_ALLEGATI:-$(gia_scritto "$CONFIGURAZIONE/ambiente" GITHUB_RAMO_ALLEGATI)}"
RAMO_ALLEGATI="${RAMO_ALLEGATI:-allegati}"
if [[ -n "$GETTONE_SEGNALAZIONI" ]]; then
  bene "le segnalazioni sono gia' accese, su ${REPO_SEGNALAZIONI:-?}"
fi

if [[ -z "$GETTONE_SEGNALAZIONI" ]]; then
  nota "Il gettone con cui il tramite apre le segnalazioni su GitHub."
  nota "Se lo lasci vuoto le segnalazioni restano spente: si accendono dopo."
  printf '  gettone delle segnalazioni (invio per saltare): ' >&2
  IFS= read -rs GETTONE_SEGNALAZIONI </dev/tty || true
  printf '\n' >&2
fi

if [[ -n "$GETTONE_SEGNALAZIONI" && -z "$REPO_SEGNALAZIONI" ]]; then
  printf '  repository delle segnalazioni [danigio15/gdahome-segnalazioni]: ' >&2
  IFS= read -r REPO_SEGNALAZIONI </dev/tty || true
  REPO_SEGNALAZIONI="${REPO_SEGNALAZIONI:-danigio15/gdahome-segnalazioni}"
fi

# La chiave della console non la scegliamo noi e non la scegli tu: quarantotto
# byte di caso. Una chiave scelta a mano e' una chiave indovinabile, e questa
# apre tutte le conversazioni.
#
# Ma si genera **una volta sola**. Se su questa macchina c'e' gia', resta
# quella: e' nel gestore di password di chi risponde alla chat, e cambiarla a
# sua insaputa vuol dire chiudergli la porta. Per cambiarla c'e' un comando
# fatto per quello — `tramite-chiave --nuova` — e li' e' una scelta, non un
# effetto collaterale.
CHIAVE_CONSOLE="$(gia_scritto "$CONFIGURAZIONE/ambiente" CHIAVE_CONSOLE)"
CHIAVE_APPENA_FATTA=no
if [[ -z "$CHIAVE_CONSOLE" ]]; then
  CHIAVE_CONSOLE="$(head -c 48 /dev/urandom | base64 | tr -d '=+/' | cut -c1-48)"
  CHIAVE_APPENA_FATTA=si
  bene "chiave della console generata (la dico alla fine)"
else
  bene "la chiave della console e' quella che c'era: non la tocco"
fi

# La posta del modulo «Contatti» del sito. E' l'unica cosa del sito che non e'
# un file: il messaggio arriva al tramite e parte come una mail, consegnata a
# un server di posta che esiste gia' — quello della casella che risponde — con
# utente e password, come farebbe un programma di posta qualunque. Non si
# tiene in piedi nessun server di posta. Senza, il modulo non fa finta: dice a
# chi scrive di scrivere direttamente all'indirizzo.
#
# La password si chiede a tastiera spenta e finisce solo in `ambiente`, chiuso
# a 600: come gli altri segreti, mai in un argomento di riga di comando.
POSTA_SERVER="${POSTA_SERVER:-$(gia_scritto "$CONFIGURAZIONE/ambiente" POSTA_SERVER)}"
POSTA_PORTA="${POSTA_PORTA:-$(gia_scritto "$CONFIGURAZIONE/ambiente" POSTA_PORTA)}"
POSTA_UTENTE="${POSTA_UTENTE:-$(gia_scritto "$CONFIGURAZIONE/ambiente" POSTA_UTENTE)}"
POSTA_PASSWORD="${POSTA_PASSWORD:-$(gia_scritto "$CONFIGURAZIONE/ambiente" POSTA_PASSWORD)}"
POSTA_DA="${POSTA_DA:-$(gia_scritto "$CONFIGURAZIONE/ambiente" POSTA_DA)}"
POSTA_A="${POSTA_A:-$(gia_scritto "$CONFIGURAZIONE/ambiente" POSTA_A)}"
if [[ -n "$POSTA_SERVER" ]]; then
  bene "il modulo dei contatti spedisce da $POSTA_SERVER a ${POSTA_A:-?}"
else
  nota "Il server di posta con cui il modulo «Contatti» del sito spedisce (es. smtp.mail.me.com)."
  nota "Se lo lasci vuoto il modulo dice di scrivere direttamente all'indirizzo: si accende dopo."
  printf '  server di posta (invio per saltare): ' >&2
  IFS= read -r POSTA_SERVER </dev/tty || true
  if [[ -n "$POSTA_SERVER" ]]; then
    printf '  porta [587]: ' >&2
    IFS= read -r POSTA_PORTA </dev/tty || true
    POSTA_PORTA="${POSTA_PORTA:-587}"
    printf '  utente (la casella con cui si entra): ' >&2
    IFS= read -r POSTA_UTENTE </dev/tty || true
    chiedi_zitto "password della casella: " POSTA_PASSWORD
    printf '  mittente [%s]: ' "$POSTA_UTENTE" >&2
    IFS= read -r POSTA_DA </dev/tty || true
    POSTA_DA="${POSTA_DA:-$POSTA_UTENTE}"
    printf '  a chi arriva [assistenza@%s]: ' "$NOME_DEL_SITO" >&2
    IFS= read -r POSTA_A </dev/tty || true
    POSTA_A="${POSTA_A:-assistenza@$NOME_DEL_SITO}"
  fi
fi

# ─── 3. Quello che serve sulla macchina ──────────────────────────────────────

passo "Installo quello che serve"

export DEBIAN_FRONTEND=noninteractive

# Ubuntu 24.04 dopo ogni installazione passa `needrestart`, che riavvia i
# servizi collegati alle librerie aggiornate. Fra quelli c'e' **ssh**, e
# riavviare ssh mentre si e' collegati da ssh butta fuori chi sta guardando: lo
# script muore a meta', nel punto peggiore, e chi lo aveva lanciato non sa
# nemmeno a che punto era arrivato.
#
# Qui non serve riavviare niente: quello che installiamo lo accendiamo noi piu'
# sotto, e per il resto la macchina e' appena nata. Quindi si sospende, e si
# lascia scritto perche' non ricapiti agli aggiornamenti automatici.
export NEEDRESTART_SUSPEND=1
export NEEDRESTART_MODE=l

apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg tar fail2ban unattended-upgrades >/dev/null
bene "pacchetti di base, blocco delle password a raffica, aggiornamenti automatici"

# Node dal repository di NodeSource, con la sua chiave, come dice la loro
# «installazione a mano». Prima si scaricava il loro script e lo si dava a
# bash da root: qualunque cosa ci fosse dentro quel giorno, girava. Cosi'
# invece si scarica una chiave, e apt controlla con quella ogni pacchetto.
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -lt 22 ]]; then
  install -d -m 755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
    gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  chmod 644 /etc/apt/keyrings/nodesource.gpg
  printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main\n' \
    >/etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs >/dev/null
fi
bene "Node $(node --version)"

if ! command -v caddy >/dev/null 2>&1; then
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key |
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt |
    tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy >/dev/null
fi
bene "Caddy $(caddy version | head -1)"

# Gli aggiornamenti di sicurezza da soli, senza riavvii a sorpresa: un riavvio
# mentre qualcuno e' fuori casa gli chiude la porta in faccia. Il riavvio lo si
# fa a mano, due volte l'anno.
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'FINE'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
FINE

# E `needrestart` non riavvia piu' niente da solo, nemmeno domani: elenca e
# basta. Un servizio riavviato a sorpresa, su una macchina che fa da tramite,
# vuol dire qualcuno che resta fuori casa senza che nessuno abbia toccato
# niente. I riavvii si fanno quando li decidiamo noi.
if [[ -d /etc/needrestart/conf.d ]]; then
  printf '$nrconf{restart} = %s;\n' "'l'" >/etc/needrestart/conf.d/tramite.conf
fi
bene "gli aggiornamenti di sicurezza si installano da soli, senza riavvii a sorpresa"

# Il firewall: si entra da SSH e dal web, e basta. Il tramite ascolta solo su
# questa macchina, ma una macchina appena nata puo' avere altre porte aperte
# che nessuno ha scelto.
#
# Tre regole, per non fare danni:
#   - la porta di SSH si apre **prima** di accendere il resto, e si legge da
#     sshd invece di supporla: chi sta installando da SSH non resta fuori;
#   - se un firewall c'e' gia' — ufw acceso, o regole di nftables/iptables
#     scritte da qualcun altro — non si tocca: si aggiungono le tre porte a ufw
#     se e' lui, e se non e' lui si dice cosa aprire;
#   - `TRAMITE_FIREWALL=no` lo lascia stare del tutto.
porte_ssh() {
  local trovate=""
  if command -v sshd >/dev/null 2>&1; then
    trovate="$(sshd -T 2>/dev/null | awk '$1 == "port" { print $2 }' | sort -u | tr '\n' ' ')"
  fi
  printf '%s' "${trovate:-22}"
}

altre_regole() {
  # Regole che non sono di ufw: un firewall scritto da qualcun altro.
  if command -v nft >/dev/null 2>&1; then
    nft list ruleset 2>/dev/null | grep -vqE '^\s*$|^table|^\s*(chain|type|policy|\})' && return 0
  fi
  if command -v iptables >/dev/null 2>&1; then
    iptables -S 2>/dev/null | grep -vqE '^-P ' && return 0
  fi
  return 1
}

if [[ "$FIREWALL" == no ]]; then
  nota "il firewall lo lascio stare, come chiesto (TRAMITE_FIREWALL=no)"
elif command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q '^Status: active'; then
  for porta_ssh in $(porte_ssh); do ufw allow "$porta_ssh/tcp" >/dev/null; done
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
  bene "il firewall c'era gia': ho aggiunto SSH, 80 e 443, il resto e' come prima"
elif altre_regole; then
  printf '  %s!%s %s\n' "$giallo" "$spento" "qui c'e' gia' un firewall che non e' ufw: non lo tocco."
  nota "Deve lasciar passare SSH ($(porte_ssh)), 80/tcp e 443 (tcp e udp)."
else
  apt-get install -y -qq ufw >/dev/null
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  for porta_ssh in $(porte_ssh); do ufw allow "$porta_ssh/tcp" >/dev/null; done
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
  ufw --force enable >/dev/null
  bene "firewall acceso: entrano solo SSH ($(porte_ssh)), 80 e 443"
fi

# ─── 4. Il tramite ───────────────────────────────────────────────────────────

passo "Scarico il tramite"

id -u "$UTENTE" >/dev/null 2>&1 || useradd --system --home "$DATI" --shell /usr/sbin/nologin "$UTENTE"
id -u "$AGGIORNATORE" >/dev/null 2>&1 ||
  useradd --system --home "$LAVORO/lavoro" --shell /usr/sbin/nologin "$AGGIORNATORE"
install -d -m 755 "$DOVE"
install -d -m 700 -o "$UTENTE" -g "$UTENTE" "$DATI"
install -d -m 700 "$CONFIGURAZIONE"

# La cartella di chi prepara. Lei e' di root, e dentro ce ne sono due sue:
# `lavoro`, dove scarica e prova, e `uscita`, dove lascia la versione pronta.
# Che la cartella di sopra sia di root non e' un dettaglio: cosi' chi prepara
# non puo' mettere al posto di `uscita` un collegamento a un'altra parte della
# macchina, e root, quando va a prendere la versione pronta, prende quella.
install -d -m 755 "$LAVORO"
install -d -m 700 -o "$AGGIORNATORE" -g "$AGGIORNATORE" "$LAVORO/lavoro"
install -d -m 755 -o "$AGGIORNATORE" -g "$AGGIORNATORE" "$LAVORO/uscita"

# Il gettone di lettura sta in un file, non in un comando e non in un remoto di
# git: i comandi si leggono da fuori, i file no.
printf 'GETTONE_LETTURA=%s\n' "$GETTONE_LETTURA" >"$CONFIGURAZIONE/lettura"
chmod 600 "$CONFIGURAZIONE/lettura"

# Quale repository, quale segno, quale cartella: scritto in un file, cosi' gli
# script che aggiornano non hanno niente dentro che dipenda da questa macchina.
{
  printf 'REPO=%s\n' "$REPO_DEL_TRAMITE"
  printf 'SEGNO=%s\n' "$SEGNO"
  printf 'DOVE=%s\n' "$DOVE"
  printf 'LAVORO=%s\n' "$LAVORO"
} >"$CONFIGURAZIONE/quale"
chmod 600 "$CONFIGURAZIONE/quale"

# Gli script di prima, di quando si scaricava e si provava da root: non
# servono piu', e un file che nessuno usa e' un file che qualcuno rilancia.
rm -f "$DOVE/sha.sh" "$DOVE/scarica.sh"

# Prepara una versione: chiede a GitHub quale c'e', la scarica, la prova, e
# solo se le prove passano la lascia pronta in `uscita/pronto`.
#
# Gira come `tramite-aggiorna`, dentro il servizio `tramite-prepara`, e non
# come root: le prove e lo strumento che finisce il sito sono codice appena
# arrivato da fuori. I due file di /etc/tramite che le servono — il gettone di
# lettura e il «quale» — non li legge lei: glieli passa systemd
# (`LoadCredential`), e restano chiusi a 600 per tutti gli altri.
#
# L'ordine e' la cosa che conta: prima si prova, poi si scambia. Al contrario —
# scambia e poi prova — una versione rotta avrebbe gia' preso il posto di una
# che funzionava, e per tornare indietro servirebbe un'altra rete.
cat >"$DOVE/prepara.sh" <<'FINE'
#!/usr/bin/env bash
set -euo pipefail
umask 022
CREDENZIALI="${CREDENTIALS_DIRECTORY:?gira solo dentro il servizio tramite-prepara}"
. "$CREDENZIALI/quale"
. "$CREDENZIALI/lettura"
USCITA="$LAVORO/uscita"

# Il gettone passa a curl in un file, non fra gli argomenti: la riga di
# comando di un processo la legge chiunque sia sulla macchina. `printf` e'
# integrato nella shell, quindi nemmeno lui apre un processo che lo mostri.
adesso="$(curl -fsS --max-time 20 --retry 2 \
  --config <(printf 'header = "Authorization: Bearer %s"\n' "$GETTONE_LETTURA") \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/commits/$SEGNO" |
  sed -n 's/.*"sha"[[:space:]]*:[[:space:]]*"\([0-9a-f]\{40\}\)".*/\1/p' | head -1 || true)"
if [ -z "$adesso" ]; then
  echo "non riesco a chiedere a GitHub che versione c'e': riprovo al giro dopo"
  exit 0
fi

qui="$(cat "$DOVE/versione" 2>/dev/null || true)"
if [ "$adesso" = "$qui" ]; then
  rm -rf "$USCITA/pronto"
  exit 0
fi
if [ "$(cat "$USCITA/pronto/versione" 2>/dev/null || true)" = "$adesso" ]; then
  echo "la ${adesso:0:8} e' gia' pronta: aspetta solo lo scambio"
  exit 0
fi

tmp="$(mktemp -d "$LAVORO/lavoro/giro.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

curl -fsSL --max-time 120 --retry 3 --retry-delay 2 \
  --config <(printf 'header = "Authorization: Bearer %s"\n' "$GETTONE_LETTURA") \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/tarball/$adesso" | tar xz --no-same-owner -C "$tmp"

radice="$(find "$tmp" -maxdepth 1 -mindepth 1 -type d | head -1)"
[ -d "$radice/centralino" ] || {
  echo "nel pacchetto non c'e' il centralino" >&2
  exit 1
}

( cd "$radice/centralino" && node --test test/*.test.js >/dev/null 2>&1 ) || {
  echo "le prove della ${adesso:0:8} non passano: non la preparo" >&2
  exit 2
}

nuovo="$USCITA/pronto.nuovo"
rm -rf "$nuovo"
mkdir -p "$nuovo"
cp -a "$radice/centralino" "$nuovo/centralino"
if [ -d "$radice/ponte/app" ]; then
  cp -a "$radice/ponte/app" "$nuovo/app"
fi
# Il sito che racconta cos'e' gdahome. Se in questa versione non c'e', resta
# quello di prima: una cartella vuota davanti a un nome pubblico vuol dire un
# sito che smette di esistere perche' qualcuno ha spostato un file.
#
# Prima di copiarlo bisogna finirlo. Nel pacchetto il sito arriva senza la sua
# parte piu' grossa — la plancia vera, che nella pagina gira dentro un riquadro
# — perche' nella repository non c'e': sarebbe una seconda copia, identica,
# di quella che sta in `ponte/plancia/`. Ce la mette questo comando, pescandola
# proprio da li'. E' la stessa cosa che si fa in locale prima di guardare il
# sito.
#
# Se non riesce, il sito **non si scambia**: resta quello di prima, intero,
# invece di diventare una pagina col buco al posto della plancia. Il resto
# dell'aggiornamento va avanti lo stesso: il tramite e' un servizio, il sito e'
# una pagina, e non si tiene fermo il primo per la seconda.
if [ -d "$radice/sito" ]; then
  if node "$radice/strumenti/porta-nel-sito.mjs" >/dev/null 2>&1 &&
    [ -s "$radice/sito/dashboardmodern_static/legacy/dashboard.html" ]; then
    cp -a "$radice/sito" "$nuovo/sito"
  else
    echo "la plancia non e' entrata nel sito: lascio quello di prima" >&2
  fi
fi
printf '%s' "$adesso" >"$nuovo/versione"
rm -rf "$USCITA/pronto"
mv "$nuovo" "$USCITA/pronto"
echo "la ${adesso:0:8} e' provata e pronta"
FINE

# Lo scambio: l'unico pezzo che deve essere root, perche' scrive in $DOVE.
#
# Non esegue niente di quello che e' arrivato: copia. E copia in un modo
# preciso — senza seguire nessun collegamento simbolico (`cp -P`), dentro una
# cartella sua, e poi guarda che nella copia di collegamenti non ce ne siano.
# Un collegamento dentro la versione pronta vorrebbe dire far copiare a root
# un file che chi prepara non poteva leggere; in una versione vera non ce ne
# sono, quindi se ce n'e' uno la versione non entra.
#
# E si scambiano solo le cose che cambiano: `centralino`, `app`, `sito`,
# `versione`. Gli script stanno di fianco e non si toccano, se no un
# aggiornamento si porterebbe via anche chi lo sta eseguendo.
cat >"$DOVE/scambia.sh" <<'FINE'
#!/usr/bin/env bash
set -euo pipefail
umask 022
USCITA="${1:?uscita}"
DOVE="${2:?dove}"

[ -e "$USCITA/pronto" ] || exit 0

arrivo="$DOVE/.arrivo"
rm -rf "$arrivo"
cp -R -P "$USCITA/pronto" "$arrivo"
if [ -L "$arrivo" ] || [ -n "$(find "$arrivo" -type l -print -quit)" ]; then
  rm -rf "$arrivo"
  echo "nella versione pronta ci sono collegamenti simbolici: non la porto dentro" >&2
  exit 1
fi
SHA="$(head -c 40 "$arrivo/versione" 2>/dev/null || true)"
case "$SHA" in
  *[!0-9a-f]* | "")
    rm -rf "$arrivo"
    echo "la versione pronta non dice che versione e'" >&2
    exit 1
    ;;
esac
[ "${#SHA}" -eq 40 ] && [ -d "$arrivo/centralino" ] || {
  rm -rf "$arrivo"
  echo "la versione pronta non e' intera" >&2
  exit 1
}
[ -d "$arrivo/app" ] || mkdir -p "$arrivo/app"

rm -rf "$DOVE/centralino.via" "$DOVE/app.via" "$DOVE/sito.via"
[ -d "$DOVE/centralino" ] && mv "$DOVE/centralino" "$DOVE/centralino.via"
[ -d "$DOVE/app" ] && mv "$DOVE/app" "$DOVE/app.via"
mv "$arrivo/centralino" "$DOVE/centralino"
mv "$arrivo/app" "$DOVE/app"
if [ -d "$arrivo/sito" ]; then
  [ -d "$DOVE/sito" ] && mv "$DOVE/sito" "$DOVE/sito.via"
  mv "$arrivo/sito" "$DOVE/sito"
fi
printf '%s' "$SHA" >"$DOVE/versione"
rm -rf "$DOVE/centralino.via" "$DOVE/app.via" "$DOVE/sito.via" "$arrivo"
rm -rf "$USCITA/pronto"
FINE

chmod 755 "$DOVE/prepara.sh"
chmod 700 "$DOVE/scambia.sh"

# Il servizio che prepara: non root, e con addosso solo quello che gli serve.
# Scrive in due cartelle sue e basta; legge i due segreti che systemd gli
# passa; va in rete, perche' deve parlare con GitHub.
cat >/etc/systemd/system/tramite-prepara.service <<FINE
[Unit]
Description=Scarica e prova il tramite nuovo, senza privilegi
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$AGGIORNATORE
Group=$AGGIORNATORE
LoadCredential=lettura:$CONFIGURAZIONE/lettura
LoadCredential=quale:$CONFIGURAZIONE/quale
Environment=HOME=$LAVORO/lavoro
WorkingDirectory=$LAVORO/lavoro
ExecStart=$DOVE/prepara.sh
TimeoutStartSec=20min
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$LAVORO/lavoro $LAVORO/uscita
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
RestrictSUIDSGID=yes
RestrictNamespaces=yes
RestrictRealtime=yes
CapabilityBoundingSet=
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
LockPersonality=yes
FINE

systemctl daemon-reload
systemctl start tramite-prepara.service || male \
  "Non riesco a mettere in piedi il tramite." \
  "Se ha detto che le prove non passano, quella versione e' rotta: non la" \
  "accendo, ed e' giusto. Il perche' lo dice:" \
  "  journalctl -u tramite-prepara -n 40 --no-pager" \
  "Se invece non riesce a chiedere a GitHub, il gettone di lettura deve" \
  "vedere «$REPO_DEL_TRAMITE» con Contents: Read, e il segno «$SEGNO» deve esistere."

"$DOVE/scambia.sh" "$LAVORO/uscita" "$DOVE" || male \
  "La versione scaricata non si lascia portare dentro." \
  "  journalctl -u tramite-prepara -n 40 --no-pager"

VERSIONE="$(cat "$DOVE/versione" 2>/dev/null || true)"
[[ -n "$VERSIONE" ]] || male \
  "Non riesco a chiedere a GitHub che versione c'e'." \
  "Il gettone di lettura non va bene, o il segno «$SEGNO» non esiste ancora." \
  "Il gettone deve vedere «$REPO_DEL_TRAMITE» con Contents: Read." \
  "  journalctl -u tramite-prepara -n 40 --no-pager"

bene "tramite scaricato e provato, versione ${VERSIONE:0:8}"

# ─── 5. Il servizio ──────────────────────────────────────────────────────────

passo "Accendo il servizio"

{
  printf 'CENTRALINO_PORTA=%s\n' "$PORTA"
  printf 'CENTRALINO_DATI=%s\n' "$DATI"
  printf 'CHIAVE_CONSOLE=%s\n' "$CHIAVE_CONSOLE"
  printf 'GITHUB_SEGNALAZIONI=%s\n' "$GETTONE_SEGNALAZIONI"
  printf 'GITHUB_REPO=%s\n' "$REPO_SEGNALAZIONI"
  printf 'GITHUB_REPO_ALLEGATI=%s\n' "$REPO_ALLEGATI"
  printf 'GITHUB_RAMO_ALLEGATI=%s\n' "$RAMO_ALLEGATI"
  # I due nomi per la soglia: chi apre l'indirizzo nudo del tramite va mandato
  # da qualche parte, e questa macchina da sola non sa come si chiama il sito.
  printf 'NOME_DEL_SITO=%s\n' "$NOME_DEL_SITO"
  printf 'NOME_DELL_APP=%s\n' "$NOME_DELL_APP"
  # La posta del modulo dei contatti: vuote, il modulo e' spento e lo dice.
  printf 'POSTA_SERVER=%s\n' "$POSTA_SERVER"
  printf 'POSTA_PORTA=%s\n' "$POSTA_PORTA"
  printf 'POSTA_UTENTE=%s\n' "$POSTA_UTENTE"
  printf 'POSTA_PASSWORD=%s\n' "$POSTA_PASSWORD"
  printf 'POSTA_DA=%s\n' "$POSTA_DA"
  printf 'POSTA_A=%s\n' "$POSTA_A"
  printf 'NODE_OPTIONS=--disable-warning=ExperimentalWarning\n'
} >"$CONFIGURAZIONE/ambiente"
chmod 600 "$CONFIGURAZIONE/ambiente"

cat >/etc/systemd/system/tramite.service <<FINE
[Unit]
Description=Il tramite di gdahome
Documentation=https://github.com/$REPO_DEL_TRAMITE
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$UTENTE
Group=$UTENTE
WorkingDirectory=$DOVE/centralino
EnvironmentFile=$CONFIGURAZIONE/ambiente
ExecStart=/usr/bin/node $DOVE/centralino/src/index.js
Restart=always
RestartSec=2
# Il tramite non ha bisogno di niente della macchina: gira le buste e scrive in
# una cartella sola. Quello che non gli serve, non ce l'ha.
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=strict
ProtectHome=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
ReadWritePaths=$DATI
# AF_UNIX e AF_NETLINK non sono un di piu': Node li usa per parlare col
# sistema — i socket interni, e la lista delle interfacce di rete. Senza, non
# parte.
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
LockPersonality=yes
# Qui NON ci va MemoryDenyWriteExecute.
#
# Vieterebbe alla memoria di essere scrivibile ed eseguibile insieme, che su
# quasi tutti i servizi e' una buona idea. Ma Node compila il JavaScript in
# istruzioni vere mentre gira — e' il suo mestiere — e quelle istruzioni le
# scrive in memoria che poi esegue. Con quel divieto non si avvia: muore con un
# segnale, senza un messaggio che spieghi niente, e chi guarda vede solo «a
# fatal signal was delivered».
#
# E' successo davvero, alla prima accensione.

[Install]
WantedBy=multi-user.target
FINE

systemctl daemon-reload
systemctl enable --now tramite.service >/dev/null
sleep 2
systemctl is-active --quiet tramite.service || male \
  "Il tramite non e' partito." \
  "L'ultimo errore si vede cosi':" \
  "  journalctl -u tramite -n 40 --no-pager"
bene "il tramite ascolta sulla $PORTA, e ripartira' da solo a ogni riavvio"

# ─── 6. Caddy davanti ────────────────────────────────────────────────────────

passo "Metto Caddy davanti, e prendo i certificati"

install -d -m 755 /etc/caddy/conf.d

cat >/etc/caddy/Caddyfile <<FINE
# Davanti al tramite.
#
# Caddy fa una cosa sola e la fa bene: si prende i certificati per questi
# nomi, li rinnova da solo, e passa quello che arriva a chi di dovere. I fili
# WebSocket li passa senza toccarli.

$NOME_DEL_TRAMITE {
	encode zstd gzip

	# L'app anche da qui, sotto \`/app/\`.
	#
	# Non e' un doppione per comodita': e' l'indirizzo che la console
	# dell'add-on fabbrica da se'. Lei sa una cosa sola del centralino — quello
	# che ha in configurazione, \`wss://<nome>\` — e il link per il browser lo
	# ricava da quello: stesso nome, \`/app/\` in fondo. Sulla nuvola e' cosi'
	# da sempre; qui l'app stava solo sul nome corto, e quel link finiva su
	# «qui non c'e' niente».
	#
	# **Ed e' l'unico posto da cui l'app si serve.** Il nome corto rimanda qui
	# invece di servire una seconda copia: il browser tiene l'abbinamento per
	# indirizzo, e due indirizzi vorrebbero dire due abbinamenti da fare.
	# Quello che il browser non deve fare con queste pagine: indovinare il tipo
	# di un file invece di credere a quello detto, mettere l'app o la console
	# dentro un riquadro di un altro sito, lasciare che una finestra aperta da
	# qui metta le mani su questa. Alla console il tramite aggiunge da se' le
	# regole sugli script; all'app no, perche' Flutter nel browser ne ha
	# bisogno di larghe, e qui si mette solo quello che non la rompe.
	header /app/* {
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Content-Security-Policy "frame-ancestors 'none'"
		Cross-Origin-Opener-Policy same-origin
	}
	header /console* {
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy no-referrer
	}

	handle /app {
		redir https://$NOME_DEL_TRAMITE/app/ permanent
	}
	handle /app/* {
		root * $DOVE
		try_files {path} /app/index.html
		file_server
	}

	# Tutto il resto e' del tramite: i fili, le segnalazioni, la console.
	handle {
		reverse_proxy 127.0.0.1:$PORTA
	}
}

# Il nome corto dell'app **rimanda**, e non serve una seconda copia.
#
# Prima serviva gli stessi file, e sembrava comodo: due indirizzi per la stessa
# app. Non lo era, e il motivo e' il browser. L'abbinamento di un telefono — il
# segno che apre casa — il browser lo tiene **per indirizzo**: quello che si
# abbina su un nome non esiste sull'altro. Con due nomi che servono la stessa
# app, chi ci arriva dal bottone della console (\`<tramite>/app/\`) e chi ci
# arriva dal preferito sono due app diverse per il browser, e a ognuna tocca
# abbinarsi di nuovo — bruciando ogni volta uno degli otto posti dei telefoni.
#
# Quindi uno solo conta, e l'altro ci porta. Quello che conta e' quello **sotto
# il tramite**: e' l'unico che la console sa fabbricare da se', sapendo del
# centralino solo il nome che ha in configurazione. Il nome corto resta valido
# per sempre — chi l'ha scritto su un biglietto non ha sbagliato — ma ci
# rimanda, portandosi dietro il pezzo di strada che segue.
$NOME_DELL_APP {
	redir https://$NOME_DEL_TRAMITE/app{uri} permanent
}

# Il nome nudo: una pagina sola, ferma, che dice cos'e' gdahome e da dove si
# comincia. E' l'indirizzo che si scrive su un negozio o su un biglietto, e
# quindi non deve dipendere da niente che possa essere spento: qui non c'e'
# \`try_files\`, perche' una pagina che non esiste deve dire che non esiste.
$NOME_DEL_SITO {
	encode zstd gzip
	root * $DOVE/sito

	# Dentro il sito ci sono due cose diverse, e vanno tenute in cache in due
	# modi diversi. La plancia e' novecento file e diciassette megabyte, e non
	# cambiano finche' non cambia la versione: tenerli un giorno vuol dire che
	# chi torna sul sito, o chi apre la seconda pagina, non se li riscarica.
	# La pagina invece si rivede ogni volta: un testo corretto che resta in
	# cache e' un testo corretto che nessuno legge.
	header /dashboardmodern_static/* Cache-Control "public, max-age=86400"
	header /statico/* Cache-Control "public, max-age=86400"
	header /*.html Cache-Control "no-cache"
	header / Cache-Control "no-cache"

	# Due righe che non cambiano niente di quello che si vede, e tolgono di
	# mezzo due modi vecchi di fare danno: un file servito per quello che e' e
	# non per quello che il browser indovina, e l'indirizzo di questa pagina
	# che non viene raccontato ai siti dove si va cliccando via.
	header X-Content-Type-Options nosniff
	header Referrer-Policy strict-origin-when-cross-origin

	# Il modulo «Contatti» della pagina e' l'unica cosa del sito che non e'
	# un file: il messaggio va al tramite, sulla stessa macchina, che lo
	# spedisce per posta. Qui non c'e' PHP e non c'e' niente da scrivere su
	# disco. Tutto il resto resta com'era, servito cosi' com'e'.
	handle /contatto {
		reverse_proxy 127.0.0.1:$PORTA
	}
	handle {
		file_server
	}
}

# E \`www\` non e' un secondo sito: e' lo stesso, detto come lo dice chi ha
# imparato a scrivere gli indirizzi vent'anni fa.
www.$NOME_DEL_SITO {
	redir https://$NOME_DEL_SITO{uri} permanent
}

# Gli altri pezzi di gdahome che stanno su questa macchina.
#
# Questo file si riscrive da capo a ogni giro di questo script, e finche' il
# tramite era solo andava bene. Adesso di fianco puo' esserci il quadro
# (\`quadro/accendi.sh\`), che scrive il suo pezzo in \`conf.d\`: senza questa
# riga, il primo rilancio del tramite lo spegnerebbe — e nessuno se ne
# accorgerebbe, perche' a smettere di funzionare sarebbe la cosa che nessuno
# sta guardando.
#
# La cartella puo' anche essere vuota: \`import\` di zero file non e' un errore.
import /etc/caddy/conf.d/*.caddy
FINE

caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 || male \
  "La configurazione di Caddy non va bene." \
  "Si guarda cosi': caddy validate --config /etc/caddy/Caddyfile"

systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy
bene "Caddy in piedi"

# ─── 7. Il giro che tiene tutto aggiornato ───────────────────────────────────

passo "Accendo il giro degli aggiornamenti"

# Il giro: chiede a `tramite-prepara` di preparare — lui, senza privilegi,
# scarica e prova — e se trova una versione pronta la scambia e riavvia. Qui,
# da root, non si esegue niente di quello che arriva da fuori: si copia e si
# riavvia. Meglio un tramite vecchio che funziona di uno nuovo che non parte.
cat >"$DOVE/aggiorna.sh" <<'FINE'
#!/usr/bin/env bash
set -euo pipefail
. /etc/tramite/quale

if ! systemctl start tramite-prepara.service; then
  echo "la preparazione non e' andata: il perche' e' in journalctl -u tramite-prepara"
  exit 1
fi

pronta="$(cat "$LAVORO/uscita/pronto/versione" 2>/dev/null || true)"
[ -n "$pronta" ] || exit 0
qui="$(cat "$DOVE/versione" 2>/dev/null || true)"

echo "si passa da ${qui:0:8} a ${pronta:0:8}"
"$DOVE/scambia.sh" "$LAVORO/uscita" "$DOVE"
systemctl restart tramite
echo "acceso sulla ${pronta:0:8}"
FINE
chmod 700 "$DOVE/aggiorna.sh"

cat >/etc/systemd/system/tramite-aggiorna.service <<FINE
[Unit]
Description=Porta dentro il tramite nuovo, se c'e'

[Service]
Type=oneshot
ExecStart=$DOVE/aggiorna.sh
# Questo resta root — scambia le cartelle e riavvia il servizio — ma non ha
# bisogno di guardare nelle case degli utenti ne' nella /tmp degli altri.
PrivateTmp=yes
ProtectHome=yes
FINE

cat >/etc/systemd/system/tramite-aggiorna.timer <<'FINE'
[Unit]
Description=Guarda ogni dieci minuti se c'e' un tramite nuovo

[Timer]
OnBootSec=3min
OnUnitActiveSec=10min
# Non tutti insieme allo scoccare del minuto: se un giorno le macchine fossero
# piu' di una, chiederebbero a GitHub nello stesso istante.
RandomizedDelaySec=60

[Install]
WantedBy=timers.target
FINE

systemctl daemon-reload
systemctl enable --now tramite-aggiorna.timer >/dev/null
bene "ogni dieci minuti guarda se c'e' una versione nuova"

# ─── 8. La prova ─────────────────────────────────────────────────────────────

passo "Provo che risponda da fuori"

salute() { curl -fsS --max-time 10 "$1" 2>/dev/null; }

detto=""
for _ in $(seq 1 30); do
  detto="$(salute "http://127.0.0.1:$PORTA/salute" || true)"
  [[ -n "$detto" ]] && break
  sleep 1
done
[[ -n "$detto" ]] || male "Il tramite non risponde nemmeno da qui." \
  "  journalctl -u tramite -n 40 --no-pager"
bene "risponde da dentro"

# Il certificato ci mette qualche secondo: Caddy lo chiede al primo giro.
fuori=""
for _ in $(seq 1 60); do
  fuori="$(salute "https://$NOME_DEL_TRAMITE/salute" || true)"
  [[ -n "$fuori" ]] && break
  sleep 2
done

# Il sito e' una cartella di file fermi: non c'e' niente da interrogare, c'e'
# da guardare che ci siano. Sono quasi mille, perche' la parte grossa e' la
# plancia vera che gira dentro la pagina.
if [[ -s "$DOVE/sito/index.html" ]]; then
  quanti="$(find "$DOVE/sito" -type f | wc -l)"
  bene "il sito c'e': $quanti file"
  # Senza la plancia la pagina si apre lo stesso, e il riquadro in mezzo resta
  # vuoto: e' il guasto peggiore, perche' non si vede da nessun'altra parte.
  if [[ ! -s "$DOVE/sito/dashboardmodern_static/legacy/dashboard.html" ]]; then
    printf '  %s!%s %s\n' "$giallo" "$spento" "il sito c'e' ma la plancia dentro no: il riquadro restera' vuoto."
    nota "La rimette «node strumenti/porta-nel-sito.mjs», che gira da se' al"
    nota "prossimo giro. Se non ci riesce, il motivo lo dice:  journalctl -u tramite-aggiorna -n 40 --no-pager"
  fi
else
  printf '  %s!%s %s\n' "$giallo" "$spento" "la cartella del sito e' vuota: https://$NOME_DEL_SITO dara' 404."
  nota "O in questa versione «$SEGNO» il sito non c'era, o la plancia non e'"
  nota "entrata e il sito non si e' scambiato apposta. Si sposta il segno"
  nota "(Actions → «Il tramite»), e al giro dopo arriva da solo."
fi

printf '\n'
if [[ -n "$fuori" ]]; then
  printf '%s✓ Il tramite e'"'"' acceso.%s\n' "$verde" "$spento"
  printf '\n  %s\n' "https://$NOME_DEL_TRAMITE/salute"
  printf '  %s\n' "$fuori"
else
  printf '%s! Il tramite gira, ma da fuori non risponde ancora.%s\n' "$giallo" "$spento"
  printf '  Quasi sempre e'"'"' il certificato che sta arrivando: riprova fra un minuto\n'
  printf '  aprendo https://%s/salute dal telefono.\n' "$NOME_DEL_TRAMITE"
  printf '  Se non arriva, il motivo lo dice:  journalctl -u caddy -n 40 --no-pager\n'
fi

# La chiave si dice in due modi diversi, e la differenza conta: la prima volta
# e' una cosa da mettere via, le altre e' solo un promemoria di quella che c'e'
# gia'. Detto sempre allo stesso modo, chi rilancia lo script crede di doverla
# ricambiare da qualche parte.
if [[ "$CHIAVE_APPENA_FATTA" == si ]]; then
  DETTO_DELLA_CHIAVE="La chiave della console, appena fatta — mettila nel gestore di password:"
else
  DETTO_DELLA_CHIAVE="La chiave della console e' quella di prima, non l'ho toccata:"
fi

cat <<FINE

  Il sito:                  https://$NOME_DEL_SITO
  L'app da browser:         https://$NOME_DEL_TRAMITE/app/
  (e https://$NOME_DELL_APP ci rimanda)
  La chat, per rispondere:  https://$NOME_DEL_TRAMITE/console/

  ${giallo}$DETTO_DELLA_CHIAVE${spento}

      $CHIAVE_CONSOLE

  Se la perdi non serve rifarla: e' scritta sulla macchina, e si rilegge.

      tramite-chiave            la dice
      tramite-chiave --nuova    ne fa una nuova
      tramite-chiave <la tua>   mette quella che scegli tu

  E il gettone con cui si aprono le segnalazioni su GitHub scade da se', un
  giorno, senza dirlo a nessuno. Questo lo chiede a GitHub:

      tramite-gettone           dice se lo accetta ancora
      tramite-gettone --metti   ne mette uno nuovo, provandolo prima

FINE

# Tre cose sole sulla chiave della console: dirla, cambiarla, rifarla.
#
# La prima e' quella che conta. Prima si vedeva una volta e basta, e chi la
# perdeva doveva rifarla — una scomodita' inventata, perche' quella chiave sta
# gia' scritta sulla macchina, in un file che legge solo root. Bastava poterla
# rileggere.
cat >/usr/local/bin/tramite-chiave <<'FINE'
#!/usr/bin/env bash
#
# La chiave della console della chat.
#
#   tramite-chiave              la dice
#   tramite-chiave --nuova      ne fa una nuova, presa dal caso
#   tramite-chiave <la tua>     mette quella che scegli tu
#
# Sta in /etc/tramite/ambiente, che legge solo root: non c'e' niente da
# ricordare a memoria, e niente da perdere.
set -euo pipefail
AMBIENTE=/etc/tramite/ambiente

[ -r "$AMBIENTE" ] || {
  echo "non trovo $AMBIENTE: il tramite e' installato su questa macchina?" >&2
  exit 1
}

dilla() { sed -n 's/^CHIAVE_CONSOLE=//p' "$AMBIENTE"; }

mettila() {
  nuova="$1"
  # Non con `sed`: una chiave puo' contenere caratteri che sed interpreta come
  # parte del comando. Con awk il valore entra come dato, non come programma.
  tmp="$(mktemp)"
  awk -v chiave="$nuova" '
    /^CHIAVE_CONSOLE=/ { print "CHIAVE_CONSOLE=" chiave; fatto = 1; next }
    { print }
    END { if (!fatto) print "CHIAVE_CONSOLE=" chiave }
  ' "$AMBIENTE" >"$tmp"
  chmod 600 "$tmp"
  # Il file provvisorio e' gia' di chi gira, e chi gira qui e' root: questo e'
  # un fermo in piu', non il fermo. Se non riesce non si smette — sulla
  # macchina vera, se non fossimo root, sarebbe il `mv` dentro `/etc` a dire
  # no, ed e' li' che deve dirlo.
  chown root:root "$tmp" 2>/dev/null || true
  mv "$tmp" "$AMBIENTE"
  systemctl restart tramite
}

case "${1:-}" in
  "")
    printf '\nla chiave della console e:\n\n    %s\n\nsi apre qui:  https://%s/console/\n\n' \
      "$(dilla)" "$(sed -n 's/^NOME_DEL_TRAMITE=//p' "$AMBIENTE" 2>/dev/null || true)"
    ;;
  --nuova)
    nuova="$(head -c 48 /dev/urandom | base64 | tr -d '=+/' | cut -c1-48)"
    mettila "$nuova"
    printf '\nla chiave nuova e:\n\n    %s\n\nquella di prima non apre piu nulla.\n\n' "$nuova"
    ;;
  -h | --aiuto | --help)
    sed -n '3,12p' "$0" | sed 's/^# \{0,1\}//'
    ;;
  *)
    scelta="$1"
    # Almeno sedici caratteri, e niente che rompa il file dove va scritta.
    if [ "${#scelta}" -lt 32 ]; then
      echo "troppo corta: almeno 32 caratteri (questa ne ha ${#scelta})." >&2
      echo "Una chiave che si prova a indovinare va provata: corta, cade." >&2
      exit 1
    fi
    case "$scelta" in
      *[[:space:]]* | *\\*)
        echo "niente spazi e niente barre rovesciate: la chiave finisce in un file" >&2
        echo "di configurazione, e li' quei caratteri vogliono dire un'altra cosa." >&2
        exit 1
        ;;
    esac
    mettila "$scelta"
    printf '\nfatto: da adesso si entra con quella che hai scelto.\n\n'
    ;;
esac
FINE
chmod 700 /usr/local/bin/tramite-chiave

# Il nome vecchio continua a funzionare: e' scritto in giro, e un comando che
# sparisce e' un comando che qualcuno cerchera' invano.
cat >/usr/local/bin/tramite-chiave-nuova <<'FINE'
#!/usr/bin/env bash
exec /usr/local/bin/tramite-chiave --nuova
FINE
chmod 700 /usr/local/bin/tramite-chiave-nuova
# Il gettone delle segnalazioni: guardarlo, cambiarlo, spegnerlo.
#
# Prima si metteva una volta, quando si accendeva la macchina, e poi si
# cambiava a mano dentro `ambiente` — con `sed`, che su un token e' un modo di
# rompere il file. E soprattutto: non c'era modo di sapere se quel gettone
# funzionava ancora. Un token a grana fine **scade**, e quando scade le
# segnalazioni smettono di arrivare senza che nessuno dica niente.
#
# Questo lo chiede a GitHub, che e' l'unica risposta che conta.
cat >/usr/local/bin/tramite-gettone <<'FINE'
#!/usr/bin/env bash
#
# Il gettone con cui il tramite apre le segnalazioni su GitHub.
#
#   tramite-gettone             dice come sta: dove vanno le segnalazioni, e se
#                               GitHub accetta ancora il gettone
#   tramite-gettone --metti     lo chiede senza mostrarlo, lo prova, e lo mette
#   tramite-gettone --togli     lo toglie: le segnalazioni si spengono
#
# Il gettone non si stampa mai, e non si scrive fra gli argomenti: la riga di
# comando di un processo la legge chiunque sia sulla macchina, e questo gira da
# root. Di lui si dice com'e' fatto — quanti caratteri, che inizio — e quello
# che serve sapere davvero, cioe' se GitHub lo accetta.
set -euo pipefail
AMBIENTE=/etc/tramite/ambiente

[ -r "$AMBIENTE" ] || {
  echo "non trovo $AMBIENTE: il tramite e' installato su questa macchina?" >&2
  exit 1
}

valore() { sed -n "s/^$1=//p" "$AMBIENTE" | head -1; }

REPO="$(valore GITHUB_REPO)"
ALLEGATI="$(valore GITHUB_REPO_ALLEGATI)"
[ -n "$ALLEGATI" ] || ALLEGATI="$REPO"

# Cosa dice GitHub di un gettone.
#
# Torna il codice, e «000» quando non si e' riusciti nemmeno a chiedere — che
# e' una cosa diversa da un gettone che non va, e non va confusa con quella.
#
# Il gettone passa a curl in un file, non fra gli argomenti; `printf` e'
# integrato nella shell, quindi nemmeno lui apre un processo che lo mostri.
chiedi() {
  detto="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 \
    --config <(printf 'header = "Authorization: Bearer %s"\n' "$1") \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/$2/issues?per_page=1&state=all" 2>/dev/null || true)"
  case "$detto" in
    [1-9][0-9][0-9]) printf '%s' "$detto" ;;
    *) printf '000' ;;
  esac
}

# E se puo' scrivere i file dove vanno le foto e i video.
#
# Gli allegati non sono allegati di GitHub: si committano, e vogliono
# «Contents: Read and write» su quella repository — che puo' essere un'altra.
puo_scrivere() {
  curl -sS --max-time 20 \
    --config <(printf 'header = "Authorization: Bearer %s"\n' "$1") \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$2" 2>/dev/null |
    grep -qE '"push"[[:space:]]*:[[:space:]]*true'
}

# Com'e' fatto, senza dire com'e'.
com_e() {
  quanto=${#1}
  case "$1" in
    github_pat_*) printf "%s caratteri, comincia con github_pat_" "$quanto" ;;
    ghp_*) printf "%s caratteri, comincia con ghp_ (e' un token di stile vecchio)" "$quanto" ;;
    *) printf "%s caratteri, e NON comincia con github_pat_" "$quanto" ;;
  esac
}

# Il perche' di un no, detto dove si puo' fare qualcosa.
spiega() {
  case "$1" in
    401)
      echo "      GitHub non lo riconosce: non e' un token valido, o e' scaduto, o e' stato revocato."
      echo "      Uno nuovo si fa su GitHub, in Settings -> Developer settings ->"
      echo "      Personal access tokens -> Fine-grained tokens. Ne serve uno con, su $REPO,"
      echo "      «Issues: Read and write»; e su $ALLEGATI anche «Contents: Read and write»." ;;
    403)
      echo "      GitHub lo riconosce ma non gli lascia toccare le issue di $REPO."
      echo "      Nel token, sotto «Repository permissions», Issues deve essere «Read and write»." ;;
    404)
      echo "      Il gettone non vede $REPO: in «Repository access» deve esserci proprio quella."
      echo "      (O il nome nella riga GITHUB_REPO di $AMBIENTE non e' quello giusto.)" ;;
    000)
      echo "      Non si e' riusciti a chiedere a GitHub: la macchina non ci arriva adesso." ;;
    *)
      echo "      GitHub ha risposto $1, che non e' una risposta che ci si aspetta qui." ;;
  esac
}

mettilo() {
  tmp="$(mktemp)"
  awk -v g="$1" '
    /^GITHUB_SEGNALAZIONI=/ { print "GITHUB_SEGNALAZIONI=" g; fatto = 1; next }
    { print }
    END { if (!fatto) print "GITHUB_SEGNALAZIONI=" g }
  ' "$AMBIENTE" >"$tmp"
  chmod 600 "$tmp"
  # Il file provvisorio e' gia' di chi gira, e chi gira qui e' root: questo e'
  # un fermo in piu', non il fermo. Se non riesce non si smette — sulla
  # macchina vera, se non fossimo root, sarebbe il `mv` dentro `/etc` a dire
  # no, ed e' li' che deve dirlo.
  chown root:root "$tmp" 2>/dev/null || true
  mv "$tmp" "$AMBIENTE"
  systemctl restart tramite
}

# Quello che il tramite dice di se' appena riacceso: e' la conferma vera.
cosa_dice() {
  sleep 1
  detto="$(journalctl -u tramite -n 40 --no-pager 2>/dev/null |
    grep -i segnalazioni | tail -1 || true)"
  if [ -n "$detto" ]; then
    printf "      %s\n" "${detto#*]: }"
  else
    echo "      (il registro non lo dice ancora:  journalctl -u tramite -n 20 --no-pager)"
  fi
}

case "${1:-}" in
  "")
    gettone="$(valore GITHUB_SEGNALAZIONI)"
    printf "\n"
    if [ -z "$REPO" ]; then
      printf "  le segnalazioni non hanno una repository dove andare: manca la riga\n"
      printf "  GITHUB_REPO in %s.\n\n" "$AMBIENTE"
      exit 0
    fi
    printf "  le segnalazioni vanno in:   %s\n" "$REPO"
    printf "  le foto e i video in:       %s\n" "$ALLEGATI"
    if [ -z "$gettone" ]; then
      printf "\n  gettone: non c'e'. Le segnalazioni sono spente, e lo sportello\n"
      printf "  risponde che non sono configurate.\n\n"
      printf "      tramite-gettone --metti    per metterlo\n\n"
      exit 0
    fi
    printf "  gettone:                    %s\n\n" "$(com_e "$gettone")"
    esito="$(chiedi "$gettone" "$REPO")"
    if [ "$esito" = "200" ]; then
      printf "  GitHub lo accetta, e gli lascia aprire le issue di %s.\n" "$REPO"
      if puo_scrivere "$gettone" "$ALLEGATI"; then
        printf "  E puo' scrivere i file di %s: gli allegati funzionano.\n\n" "$ALLEGATI"
      else
        printf "  Ma NON puo' scrivere i file di %s: le segnalazioni arrivano,\n" "$ALLEGATI"
        printf "  le foto e i video allegati no.\n\n"
      fi
    else
      printf "  GitHub NON lo accetta (%s).\n" "$esito"
      spiega "$esito"
      printf "\n      tramite-gettone --metti    per cambiarlo\n\n"
    fi
    ;;

  --metti)
    [ -n "$REPO" ] || {
      echo "manca la riga GITHUB_REPO in $AMBIENTE: non si sa dove mandarle." >&2
      exit 1
    }
    printf "\nSi incolla e si preme invio. Non si vede mentre si scrive, ed e' voluto.\n\n"
    printf "  gettone: "
    read -rs nuovo || true
    printf "\n\n"
    # Gli spazi e gli a capo intorno — o in mezzo, perche' un token incollato
    # da un telefono puo' arrivare spezzato su due righe — non fanno parte del
    # token, che e' una riga sola. Le virgolette nemmeno.
    nuovo="$(printf '%s' "$nuovo" | tr -d '[:space:]"'"'"'')"
    [ -n "$nuovo" ] || {
      echo "non hai incollato niente: non cambio nulla." >&2
      exit 1
    }
    # Un token a grana fine e' «github_pat_» piu' 82 caratteri, e nel copiarlo
    # da un telefono capita di prendere solo la seconda parte.
    if printf '%s' "$nuovo" | grep -qE '^[A-Za-z0-9]{22}_[A-Za-z0-9]{59}$'; then
      echo "  (era senza «github_pat_» davanti: rimesso)"
      nuovo="github_pat_${nuovo}"
    fi
    printf "  lo provo su GitHub, prima di metterlo...\n\n"
    esito="$(chiedi "$nuovo" "$REPO")"
    case "$esito" in
      200)
        mettilo "$nuovo"
        printf "  fatto: GitHub lo accetta, ed e' sulla macchina.\n\n"
        cosa_dice
        if puo_scrivere "$nuovo" "$ALLEGATI"; then
          printf "\n  E puo' scrivere i file di %s: anche gli allegati.\n\n" "$ALLEGATI"
        else
          printf "\n  Nota: non puo' scrivere i file di %s, quindi le foto e i video\n" "$ALLEGATI"
          printf "  allegati non partiranno. Le segnalazioni si'.\n\n"
        fi ;;
      000)
        # Non riuscire a chiedere non vuol dire che il gettone sia sbagliato.
        # Si mette, e si dice di controllare dopo.
        mettilo "$nuovo"
        printf "  messo, ma senza averlo potuto provare: da qui GitHub non si raggiunge.\n"
        printf "  Quando la rete torna:  tramite-gettone\n\n"
        cosa_dice
        printf "\n" ;;
      *)
        printf "  NON lo metto: quello di prima, qualunque sia, funziona meglio di uno\n"
        printf "  che GitHub rifiuta.\n\n"
        spiega "$esito"
        printf "\n"
        exit 1 ;;
    esac
    ;;

  --togli)
    mettilo ""
    printf "\n  gettone togliato: le segnalazioni sono spente, e lo sportello risponde\n"
    printf "  che non sono configurate. Il resto del tramite lavora come prima.\n\n"
    cosa_dice
    printf "\n"
    ;;

  -h | --aiuto | --help)
    sed -n '3,8p' "$0" | sed 's/^# \{0,1\}//'
    ;;

  *)
    echo "non conosco «$1». C'e' --metti, --togli, o niente per sapere come sta." >&2
    echo "Il gettone non si scrive qui: la riga di comando la legge chiunque." >&2
    exit 1
    ;;
esac
FINE
chmod 700 /usr/local/bin/tramite-gettone
