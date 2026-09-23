#!/usr/bin/env bash
#
# Accende il quadro, di fianco al tramite o su una macchina sua.
#
# Il quadro e' uno solo e sta da gdahome: le case installate ci depositano
# poche righe di numeri, e chi le ha installate le guarda. Chi installa non
# accende niente: lo si aggiunge da `/gestore/` e gli si da' una chiave.
#
# Come si lancia, da `root`:
#
#     read -rsp 'gettone: ' G && echo && curl -fsSL \
#       --config <(printf 'header = "Authorization: Bearer %s"\n' "$G") \
#       -H 'Accept: application/vnd.github.raw' \
#       https://api.github.com/repos/danigio15/gdahomeapp/contents/quadro/accendi.sh \
#       | GETTONE_LETTURA="$G" bash
#
#   --controlla   guarda se tutto quadra e non installa niente.
#
# Cosa fa, nell'ordine:
#
#   1. controlla di stare su un Debian/Ubuntu, da root, e che il nome del
#      quadro punti a questa macchina;
#   2. si rilegge il gettone di lettura — se sulla macchina c'e' gia' il
#      tramite, e' lo stesso e non si richiede — e genera la chiave dello
#      gestione, una volta sola;
#   3. installa Node (dal repository di NodeSource, con la sua chiave) e
#      Caddy, se non ci sono gia', e accende il firewall: SSH, 80 e 443;
#   4. scarica il quadro e lo prova **senza privilegi** (`quadro-prepara`), e
#      solo se le prove passano root lo copia al suo posto;
#   5. lo accende come servizio, e lo segna perche' riparta da solo;
#   6. mette un innesto in Caddy — non riscrive il suo file, ci mette dentro un
#      pezzo — cosi' il tramite e il quadro stanno sulla stessa macchina senza
#      cancellarsi a vicenda;
#   7. accende il giro che lo tiene aggiornato, con la stessa divisione:
#      scarica e prova chi non ha privilegi, root scambia e riavvia;
#   8. prova che `/salute` risponda da fuori, e dice la chiave di gestione.
#
# **E rilanciarlo non porta via niente.** La chiave di gestione, se c'e'
# gia', resta quella: e' nel gestore di password di chi tiene il quadro, e
# cambiarla a sua insaputa vuol dire chiudergli la porta in faccia — e con lui
# a tutti gli installatori, che non potrebbero piu' essere iscritti.

set -euo pipefail

# ─── Le cose che questa macchina deve sapere ─────────────────────────────────

REPO_DEL_QUADRO="${REPO_DEL_QUADRO:-danigio15/gdahomeapp}"

# Lo stesso segno del tramite, e per lo stesso motivo: su `main` si spinge dieci
# volte al giorno, e una macchina che seguisse main si riavvierebbe dieci volte
# al giorno, a volte su un commit scritto a meta'.
SEGNO="${SEGNO_DEL_QUADRO:-tramite}"

# **Questo nome deve stare anche dentro l'add-on.** Il ponte non ha nessuna
# casella per l'indirizzo del quadro: ce l'ha scritto dentro
# (`ponte/src/rapporto.js`, `QUADRO_DI_DIFETTO`), come per il centralino e per
# lo stesso motivo — una casella che non va toccata e' una casella che prima o
# poi qualcuno tocca. Cambiare qui e non li' vuol dire un quadro che nessuna
# casa trova.
NOME_DEL_QUADRO="${NOME_DEL_QUADRO:-quadro.gdahome.org}"

PORTA="${QUADRO_PORTA:-8100}"

DOVE="/opt/quadro"
DATI="/var/lib/quadro"
CONFIGURAZIONE="/etc/quadro"
UTENTE="quadro"

# Chi scarica e prova le versioni nuove: un utente suo, senza privilegi, che
# nei dati del quadro non entra. Root scambia le cartelle e riavvia, e basta.
AGGIORNATORE="quadro-aggiorna"
LAVORO="/var/lib/quadro-aggiorna"

# Il firewall lo si accende, se non ce n'e' gia' uno. `QUADRO_FIREWALL=no` lo
# lascia stare a chi lo tiene per conto suo.
FIREWALL="${QUADRO_FIREWALL:-si}"

# Dove il tramite tiene le sue cose. Serve a due cose sole: rileggere il
# gettone di lettura invece di richiederlo, e sapere che su questa macchina
# c'e' anche lui.
CASA_DEL_TRAMITE="/etc/tramite"

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

[[ "$SOLO_CONTROLLO" == si || "$(id -u)" == 0 ]] || male \
  "Questo va lanciato da root." \
  "Sulla console del fornitore ci sei gia'; da un terminale: sudo -i"

if [[ "$SOLO_CONTROLLO" != si ]]; then
  . /etc/os-release 2>/dev/null || male "Non riesco a capire che sistema e' questo."
  case "${ID:-}${ID_LIKE:-}" in
    *debian* | *ubuntu*) bene "sistema: ${PRETTY_NAME:-$ID}" ;;
    *) male "Questo script conosce Debian e Ubuntu, e qui c'e' ${PRETTY_NAME:-$ID}." ;;
  esac
fi

# systemd almeno 247: chi scarica e prova le versioni nuove riceve il gettone
# di lettura con `LoadCredential`, che prima non c'era. Con uno piu' vecchio il
# servizio `quadro-prepara` non partirebbe, e il giro degli aggiornamenti
# resterebbe fermo per sempre. Si guarda **qui**, prima di toccare niente:
# l'`aggiorna.sh` di prima resta al suo posto e continua a fare il suo lavoro.
SYSTEMD="$(systemctl --version 2>/dev/null | awk 'NR == 1 { print $2 }' | grep -Eo '^[0-9]+' || true)"
if [[ -z "$SYSTEMD" ]]; then
  male "Qui non trovo systemd, e il quadro gira come suo servizio."
elif ((SYSTEMD < 247)); then
  male "Qui c'e' systemd $SYSTEMD, e serve almeno il 247." \
    "Lo scaricamento delle versioni nuove gira senza privilegi e riceve il" \
    "gettone con LoadCredential, che prima del 247 non c'e'. Debian 11 e" \
    "Ubuntu 22.04 vanno gia' bene. Non ho toccato niente."
else
  bene "systemd $SYSTEMD"
fi

# Il nome punta qui?
#
# Si controlla **prima** di installare, perche' senza questo Caddy non riesce a
# prendere il certificato e si ferma a meta' — lasciando una macchina mezza
# fatta e un errore che parla di ACME invece che di DNS.
mio_indirizzo() { curl -fsS --max-time 10 https://api.ipify.org 2>/dev/null || true; }

QUI="$(mio_indirizzo)"
SUO="$(getent ahostsv4 "$NOME_DEL_QUADRO" 2>/dev/null | awk '{print $1}' | head -1 || true)"

if [[ -z "$SUO" ]]; then
  male "«$NOME_DEL_QUADRO» non risolve." \
    "Va creato un record A che punti a ${QUI:-questa macchina}." \
    "La zona di gdahome.org sta su Cloudflare: dash.cloudflare.com, DNS," \
    "Aggiungi record. Tipo A, Nome «${NOME_DEL_QUADRO%%.*}», e soprattutto" \
    "Stato proxy su «Solo DNS» — la nuvola grigia. Cloudflare parte arancione" \
    "e va spento a mano: col proxy davanti il certificato non arriva, e" \
    "l'errore che si legge dopo parla di ACME invece che di questo."
elif [[ -n "$QUI" && "$SUO" != "$QUI" ]]; then
  male "«$NOME_DEL_QUADRO» punta a $SUO, e questa macchina e' $QUI." \
    "Si aggiusta il record A, e si aspetta che il cambio giri."
else
  bene "«$NOME_DEL_QUADRO» punta qui"
fi

if [[ "$SOLO_CONTROLLO" == si ]]; then
  printf '\n%sQuadra tutto.%s Per accenderlo davvero, senza --controlla.\n' "$verde" "$spento"
  exit 0
fi

# ─── 2. Le cose che non posso sapere ─────────────────────────────────────────

passo "Le due cose che servono"

# Quello che e' gia' scritto su questa macchina si rilegge, non si richiede.
gia_scritto() {
  local file="$1" chiave="$2"
  [[ -r "$file" ]] || return 0
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

# Il gettone di lettura: e' la **stessa** repository del tramite, quindi se lui
# c'e' gia' su questa macchina il suo gettone va bene e non si richiede niente.
GETTONE_LETTURA="${GETTONE_LETTURA:-$(gia_scritto "$CONFIGURAZIONE/lettura" GETTONE_LETTURA)}"
if [[ -z "$GETTONE_LETTURA" ]]; then
  GETTONE_LETTURA="$(gia_scritto "$CASA_DEL_TRAMITE/lettura" GETTONE_LETTURA)"
  [[ -n "$GETTONE_LETTURA" ]] && bene "il gettone di lettura lo prendo dal tramite, che sta gia' qui"
fi
if [[ -z "$GETTONE_LETTURA" ]]; then
  nota "Il gettone che legge la repository (sola lettura)."
  chiedi_zitto "gettone di lettura: " GETTONE_LETTURA
else
  bene "il gettone di lettura c'e' gia'"
fi

# La chiave di gestione: quarantotto byte di caso, e **una volta sola**.
#
# Da li' si aggiungono gli installatori e si mettono i limiti. Rifarla a
# ogni giro vorrebbe dire che chi reincolla la riga per aggiornare si ritrova
# fuori dal suo quadro — e senza quella chiave non si puo' aggiungere nessuno.
CHIAVE_GESTORE="$(gia_scritto "$CONFIGURAZIONE/ambiente" QUADRO_GESTORE)"
CHIAVE_APPENA_FATTA=no
if [[ -z "$CHIAVE_GESTORE" ]]; then
  CHIAVE_GESTORE="$(head -c 48 /dev/urandom | base64 | tr -d '=+/' | cut -c1-48)"
  CHIAVE_APPENA_FATTA=si
  bene "chiave della gestione generata (la dico alla fine)"
else
  bene "la chiave di gestione e' quella che c'era: non la tocco"
fi

# ─── 3. Quello che serve sulla macchina ──────────────────────────────────────

passo "Installo quello che serve"

export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg tar >/dev/null

# Node dal repository di NodeSource, con la sua chiave, come dice la loro
# «installazione a mano». Prima si scaricava il loro script e lo si dava a
# bash da root: qualunque cosa ci fosse dentro quel giorno, girava. Cosi'
# invece si scarica una chiave, e apt controlla con quella ogni pacchetto.
if ! command -v node >/dev/null 2>&1; then
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

# Il firewall: si entra da SSH e dal web, e basta. Il quadro ascolta solo su
# questa macchina (`QUADRO_ASCOLTO`, di serie 127.0.0.1), ma una macchina
# appena nata puo' avere altre porte aperte che nessuno ha scelto.
#
# Le stesse tre regole del tramite, che puo' stare sulla stessa macchina:
#   - la porta di SSH si apre **prima** di accendere il resto, e si legge da
#     sshd invece di supporla: chi sta installando da SSH non resta fuori;
#   - se un firewall c'e' gia' — ufw acceso, o regole di nftables/iptables
#     scritte da qualcun altro — non si tocca: si aggiungono le porte a ufw se
#     e' lui, e se non e' lui si dice cosa aprire;
#   - `QUADRO_FIREWALL=no` lo lascia stare del tutto.
porte_ssh() {
  local trovate=""
  if command -v sshd >/dev/null 2>&1; then
    trovate="$(sshd -T 2>/dev/null | awk '$1 == "port" { print $2 }' | sort -u | tr '\n' ' ')"
  fi
  # E quella da cui si e' collegati adesso, se si e' su SSH: fosse anche una
  # che sshd non dice, chiudere quella vuol dire chiudersi fuori.
  if [[ -n "${SSH_CONNECTION:-}" ]]; then
    trovate="$trovate $(awk '{ print $4 }' <<<"$SSH_CONNECTION")"
  fi
  trovate="$(tr ' ' '\n' <<<"$trovate" | grep -E '^[0-9]+$' | sort -u | tr '\n' ' ')"
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
  nota "il firewall lo lascio stare, come chiesto (QUADRO_FIREWALL=no)"
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
  # Prima le porte, poi l'accensione: al contrario, fra le due righe chi e' su
  # SSH sarebbe gia' fuori.
  for porta_ssh in $(porte_ssh); do ufw allow "$porta_ssh/tcp" >/dev/null; done
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw --force enable >/dev/null
  bene "firewall acceso: entrano solo SSH ($(porte_ssh)), 80 e 443"
fi

# ─── 4. Il quadro ────────────────────────────────────────────────────────────

passo "Scarico il quadro"

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

printf 'GETTONE_LETTURA=%s\n' "$GETTONE_LETTURA" >"$CONFIGURAZIONE/lettura"
chmod 600 "$CONFIGURAZIONE/lettura"

# Quale repository, quale segno, quali cartelle: scritto in un file, cosi' gli
# script che aggiornano non hanno dentro niente che dipenda da questa macchina.
{
  printf 'REPO=%s\n' "$REPO_DEL_QUADRO"
  printf 'SEGNO=%s\n' "$SEGNO"
  printf 'DOVE=%s\n' "$DOVE"
  printf 'LAVORO=%s\n' "$LAVORO"
  printf 'DATI=%s\n' "$DATI"
} >"$CONFIGURAZIONE/quale"
chmod 600 "$CONFIGURAZIONE/quale"

# Gli script di prima, di quando si scaricava e si provava da root: non
# servono piu', e un file che nessuno usa e' un file che qualcuno rilancia.
rm -f "$DOVE/sha.sh" "$DOVE/scarica.sh"

# Prepara una versione: chiede a GitHub quale c'e', la scarica, la prova, e
# solo se le prove passano la lascia pronta in `uscita/pronto`.
#
# Gira come `quadro-aggiorna`, dentro il servizio `quadro-prepara`, e **non
# come root**: le prove sono codice appena arrivato da fuori, e prima
# giravano con tutti i permessi della macchina. I due file di /etc/quadro che
# le servono — il gettone di lettura e il «quale» — non li legge lei:
# glieli passa systemd (`LoadCredential`), e restano chiusi a 600.
#
# Se GitHub non risponde non esce zitta: lo scrive in `uscita/esito`, e il
# giro — che e' root e puo' scrivere nei dati del quadro — lo riporta su
# `/salute` (vedi `aggiorna.sh`).
#
# L'ordine e' la cosa che conta: prima si prova, poi si scambia. Al contrario,
# una versione rotta avrebbe gia' preso il posto di una che funzionava.
cat >"$DOVE/prepara.sh" <<'FINE'
#!/usr/bin/env bash
set -euo pipefail
umask 022
CREDENZIALI="${CREDENTIALS_DIRECTORY:?gira solo dentro il servizio quadro-prepara}"
. "$CREDENZIALI/quale"
. "$CREDENZIALI/lettura"
USCITA="$LAVORO/uscita"

# Il gettone passa a curl in un file, non fra gli argomenti: la riga di comando
# di un processo la legge chiunque sia sulla macchina.
adesso="$(curl -fsS --max-time 20 --retry 2 \
  --config <(printf 'header = "Authorization: Bearer %s"\n' "$GETTONE_LETTURA") \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/commits/$SEGNO" |
  sed -n 's/.*"sha"[[:space:]]*:[[:space:]]*"\([0-9a-f]\{40\}\)".*/\1/p' | head -1 || true)"
if [ -z "$adesso" ]; then
  printf '%s\n' "GitHub non risponde, o il segno non c'e' piu'" >"$USCITA/esito"
  exit 0
fi
rm -f "$USCITA/esito"

qui="$(cat "$DOVE/versione" 2>/dev/null || true)"
if [ "$adesso" = "$qui" ]; then
  rm -rf "$USCITA/pronto"
  exit 0
fi
if [ "$(cat "$USCITA/pronto/versione" 2>/dev/null || true)" = "$adesso" ]; then
  exit 0
fi

tmp="$(mktemp -d "$LAVORO/lavoro/giro.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

curl -fsSL --max-time 120 --retry 3 --retry-delay 2 \
  --config <(printf 'header = "Authorization: Bearer %s"\n' "$GETTONE_LETTURA") \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/tarball/$adesso" | tar xz --no-same-owner -C "$tmp"

radice="$(find "$tmp" -maxdepth 1 -mindepth 1 -type d | head -1)"
[ -d "$radice/quadro" ] || {
  echo "nel pacchetto non c'e' il quadro" >&2
  exit 1
}

( cd "$radice/quadro" && node --test test/*.test.js >/dev/null 2>&1 ) || {
  echo "le prove della ${adesso:0:8} non passano: non la preparo" >&2
  exit 2
}

nuovo="$USCITA/pronto.nuovo"
rm -rf "$nuovo"
mkdir -p "$nuovo"
cp -a "$radice/quadro" "$nuovo/quadro"
# E la plancia dell'add-on, accanto a `src/`: e' quella che il cruscotto apre
# nell'editor della Configurazione (`src/plancia-servita.js`). Senza, il
# quadro parte lo stesso e la Configurazione dal cruscotto non si apre.
if [ -d "$radice/ponte/plancia" ]; then
  cp -a "$radice/ponte/plancia" "$nuovo/quadro/plancia"
fi
printf '%s' "$adesso" >"$nuovo/versione"
rm -rf "$USCITA/pronto"
mv "$nuovo" "$USCITA/pronto"
echo "la ${adesso:0:8} e' provata e pronta"
FINE

# Lo scambio: l'unico pezzo che deve essere root, perche' scrive in $DOVE.
#
# Non esegue niente di quello che e' arrivato: copia. E copia senza seguire
# nessun collegamento simbolico (`cp -P`), dentro una cartella sua, e poi
# guarda che nella copia di collegamenti non ce ne siano: in una versione vera
# non ce ne sono, e uno solo vorrebbe dire far copiare a root un file che chi
# prepara non poteva leggere. I file copiati sono di root, non di chi li ha
# preparati: chi prepara non puo' cambiare il quadro che gira.
#
# Si scambiano solo `quadro` e `versione`. Gli script stanno di fianco e non si
# toccano: un aggiornamento che si portasse via chi lo sta eseguendo e' un
# aggiornamento che non finisce.
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
chown -R root:root "$arrivo"
chmod -R go-w "$arrivo"
SHA="$(head -c 40 "$arrivo/versione" 2>/dev/null || true)"
case "$SHA" in
  *[!0-9a-f]* | "")
    rm -rf "$arrivo"
    echo "la versione pronta non dice che versione e'" >&2
    exit 1
    ;;
esac
[ "${#SHA}" -eq 40 ] && [ -d "$arrivo/quadro/src" ] || {
  rm -rf "$arrivo"
  echo "la versione pronta non e' intera" >&2
  exit 1
}

rm -rf "$DOVE/quadro.vecchio"
[ -d "$DOVE/quadro" ] && mv "$DOVE/quadro" "$DOVE/quadro.vecchio"
mv "$arrivo/quadro" "$DOVE/quadro"
printf '%s\n' "$SHA" >"$DOVE/versione"
rm -rf "$DOVE/quadro.vecchio" "$arrivo"
rm -rf "$USCITA/pronto"
FINE

chmod 755 "$DOVE/prepara.sh"
chmod 700 "$DOVE/scambia.sh"

# Il servizio che prepara: non root, e con addosso solo quello che gli serve.
# Scrive in due cartelle sue e basta; legge i due segreti che systemd gli
# passa; va in rete, perche' deve parlare con GitHub. Nei dati del quadro —
# le chiavi, le case — non entra.
cat >/etc/systemd/system/quadro-prepara.service <<FINE
[Unit]
Description=Scarica e prova il quadro nuovo, senza privilegi
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
InaccessiblePaths=$DATI $CONFIGURAZIONE
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
systemctl start quadro-prepara.service || male \
  "Il quadro non si e' installato." \
  "Se ha detto che le prove non passano, quella versione e' rotta: non la" \
  "accendo, ed e' giusto. Il perche' lo dice:" \
  "  journalctl -u quadro-prepara -n 40 --no-pager"

[[ ! -s "$LAVORO/uscita/esito" ]] || male \
  "Non riesco a chiedere a GitHub qual e' l'ultima versione." \
  "Di solito e' il gettone: deve poter leggere «$REPO_DEL_QUADRO»."

"$DOVE/scambia.sh" "$LAVORO/uscita" "$DOVE" || male \
  "La versione scaricata non si lascia portare dentro." \
  "Non ho toccato quello che c'era." \
  "  journalctl -u quadro-prepara -n 40 --no-pager"

VERSIONE="$(cat "$DOVE/versione" 2>/dev/null || true)"
[[ -n "$VERSIONE" ]] || male "GitHub non mi dice quale versione c'e' su «$SEGNO»."
bene "quadro scaricato e provato, versione ${VERSIONE:0:8}"

# ─── 5. Il servizio ──────────────────────────────────────────────────────────

passo "Accendo il servizio"

{
  printf 'QUADRO_PORTA=%s\n' "$PORTA"
  # Solo su questa macchina: davanti c'e' Caddy.
  printf 'QUADRO_ASCOLTO=%s\n' "127.0.0.1"
  printf 'QUADRO_DATI=%s\n' "$DATI"
  printf 'QUADRO_GESTORE=%s\n' "$CHIAVE_GESTORE"
  printf 'QUADRO_REGISTRO=%s\n' "info"
} >"$CONFIGURAZIONE/ambiente"
chmod 600 "$CONFIGURAZIONE/ambiente"

cat >/etc/systemd/system/quadro.service <<FINE
[Unit]
Description=Il quadro di gdahome
Documentation=https://github.com/$REPO_DEL_QUADRO
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$UTENTE
Group=$UTENTE
WorkingDirectory=$DOVE/quadro
EnvironmentFile=$CONFIGURAZIONE/ambiente
ExecStart=/usr/bin/node $DOVE/quadro/src/index.js
Restart=always
RestartSec=2
# Il quadro non ha bisogno di niente della macchina: riceve numeri e scrive in
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
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
LockPersonality=yes
# Qui NON ci va MemoryDenyWriteExecute: Node compila il JavaScript in
# istruzioni vere mentre gira, ed e' il suo mestiere.

[Install]
WantedBy=multi-user.target
FINE

systemctl daemon-reload
systemctl enable quadro >/dev/null 2>&1 || true
systemctl restart quadro
bene "il quadro ascolta sulla $PORTA, e ripartira' da solo a ogni riavvio"

# ─── 6. Caddy davanti ────────────────────────────────────────────────────────

passo "Metto Caddy davanti, e prendo il certificato"

# **Non si riscrive il Caddyfile: ci si mette dentro un innesto.**
#
# E' la riga che permette al tramite e al quadro di stare sulla stessa
# macchina. `centralino/accendi.sh` il suo Caddyfile lo scrive tutto, da capo,
# a ogni giro: se anche questo facesse lo stesso, l'ultimo lanciato
# cancellerebbe l'altro — e il primo a spegnersi sarebbe quello che nessuno
# guarda, cioe' il quadro, che si scoprirebbe quando una casa smette di
# depositare.
#
# Quindi ognuno scrive un file suo qui dentro, e il Caddyfile li legge tutti.
install -d -m 755 /etc/caddy/conf.d

cat >/etc/caddy/conf.d/quadro.caddy <<FINE
# Il quadro. Le case depositano su /rapporto, gli installatori guardano su
# /console/, e chi tiene il quadro aggiunge gli installatori su /gestore/.
$NOME_DEL_QUADRO {
	encode zstd gzip
	# Solo HTTPS, e il browser se lo ricorda per un anno: la chiave di un
	# installatore non deve mai passare in chiaro, nemmeno la prima volta di
	# un collegamento scritto a mano senza la «s».
	header Strict-Transport-Security "max-age=31536000"
	header -Server
	reverse_proxy 127.0.0.1:$PORTA
}
FINE

# La riga che fa leggere questa cartella. Ce la mette questo script se non c'e'
# gia': cosi' funziona anche su una macchina dove il tramite e' stato acceso con
# una versione vecchia del suo script, che quella riga non la scriveva.
if [[ ! -f /etc/caddy/Caddyfile ]]; then
  printf 'import /etc/caddy/conf.d/*.caddy\n' >/etc/caddy/Caddyfile
  bene "Caddyfile creato: qui c'e' solo il quadro"
elif ! grep -q 'conf\.d/\*\.caddy' /etc/caddy/Caddyfile; then
  printf '\n# Gli innesti degli altri pezzi di gdahome su questa macchina.\nimport /etc/caddy/conf.d/*.caddy\n' \
    >>/etc/caddy/Caddyfile
  bene "aggiunta la riga che legge gli innesti, senza toccare il resto"
else
  bene "il Caddyfile legge gia' gli innesti"
fi

caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 || male \
  "La configurazione di Caddy non va bene." \
  "Si guarda cosi': caddy validate --config /etc/caddy/Caddyfile"

systemctl enable caddy >/dev/null 2>&1 || true
systemctl reload caddy 2>/dev/null || systemctl restart caddy
bene "Caddy in piedi"

# ─── 7. Il giro che tiene tutto aggiornato ───────────────────────────────────

passo "Accendo il giro degli aggiornamenti"

# Il giro: chiede a `quadro-prepara` di preparare — lui, senza privilegi,
# scarica e prova — e se trova una versione pronta la scambia e riavvia. Qui,
# da root, non si esegue niente di quello che arriva da fuori: si copia e si
# riavvia. Prima invece scaricare, provare e scambiare giravano tutti da root,
# e le prove di una versione nuova erano codice appena arrivato con in mano
# tutta la macchina.
cat >"$DOVE/aggiorna.sh" <<'FINE'
#!/usr/bin/env bash
set -euo pipefail
. /etc/quadro/quale

# Il foglietto: c'e' solo quando questo giro non ce la fa.
#
# Prima, se non si sapeva la versione, il giro usciva **zitto**. Il quadro restava sull'ultima versione
# che aveva — funzionante, quindi identico a uno che sta bene — e le correzioni
# smettevano di arrivare senza che niente lo dicesse. Ci si accorge il giorno
# che serve una correzione, che e' il giorno peggiore.
#
# Adesso lo scrive: nel registro della macchina ogni volta, e in un foglietto
# che il quadro legge e riporta su `/salute`. La' pero' compare solo dopo
# un'ora — sei giri di fila a vuoto — perche' un tentativo storto non vuol dire
# niente e un avviso che si accende da solo ogni settimana si smette di
# guardare.
FOGLIETTO="$DATI/non-mi-aggiorno"

non_ce_la_faccio() {
  logger -t quadro "non riesco a sapere che versione c'e' su «$SEGNO»: $1"
  # La data e' quella del **primo** fallimento di fila: se il foglietto c'e'
  # gia', non la si tocca, se no ogni giro azzererebbe il conto e l'ora non
  # arriverebbe mai.
  if [ -s "$FOGLIETTO" ]; then
    da="$(head -1 "$FOGLIETTO")"
  else
    da="$(date +%s)"
  fi
  printf '%s\n%s\n' "$da" "$1" >"$FOGLIETTO"
  chmod 644 "$FOGLIETTO" 2>/dev/null || true
  exit 0
}

if ! systemctl start quadro-prepara.service; then
  logger -t quadro "la preparazione non e' andata: il perche' e' in journalctl -u quadro-prepara"
  exit 1
fi

# Chi prepara lascia scritto se GitHub non ha risposto: il foglietto lo
# scrive questo giro, che e' root e puo' scrivere nei dati del quadro.
if [ -s "$LAVORO/uscita/esito" ]; then
  non_ce_la_faccio "$(head -c 200 "$LAVORO/uscita/esito" | head -1)"
fi

# Ce l'ha fatta: il foglietto se ne va. Un avviso che resta dopo che la cosa si
# e' aggiustata e' peggio di nessun avviso.
rm -f "$FOGLIETTO"

pronta="$(cat "$LAVORO/uscita/pronto/versione" 2>/dev/null || true)"
[ -n "$pronta" ] || exit 0
# Se le prove della versione nuova non passano, `prepara.sh` non la lascia
# pronta: la macchina resta su quella di prima, che funziona.
"$DOVE/scambia.sh" "$LAVORO/uscita" "$DOVE"
systemctl restart quadro
logger -t quadro "aggiornato a ${pronta:0:8}"
FINE
chmod 700 "$DOVE/aggiorna.sh"

cat >/etc/systemd/system/quadro-aggiorna.service <<FINE
[Unit]
Description=Porta dentro il quadro nuovo, se c'e'

[Service]
Type=oneshot
ExecStart=$DOVE/aggiorna.sh
# Questo resta root — scambia le cartelle e riavvia il servizio — ma non
# esegue niente di quello che arriva da fuori: lo scarica e lo prova
# quadro-prepara, senza privilegi. E non ha bisogno di guardare nelle case
# degli utenti ne' nella /tmp degli altri.
PrivateTmp=yes
ProtectHome=yes
FINE

cat >/etc/systemd/system/quadro-aggiorna.timer <<'FINE'
[Unit]
Description=Ogni dieci minuti guarda se c'e' un quadro nuovo

[Timer]
OnBootSec=5min
OnUnitActiveSec=10min
# Non tutte le macchine allo stesso secondo: se un giorno ce ne fosse piu'
# d'una, non si presentano tutte insieme da GitHub.
RandomizedDelaySec=120

[Install]
WantedBy=timers.target
FINE

systemctl daemon-reload
systemctl enable --now quadro-aggiorna.timer >/dev/null 2>&1 || true
bene "ogni dieci minuti guarda se c'e' una versione nuova"

# ─── 8. La prova ─────────────────────────────────────────────────────────────

passo "Provo che risponda"

for _ in $(seq 1 20); do
  curl -fsS --max-time 3 "http://127.0.0.1:$PORTA/salute" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS --max-time 3 "http://127.0.0.1:$PORTA/salute" >/dev/null 2>&1 ||
  male "Il quadro non risponde sulla $PORTA." \
    "Si guarda cosi': journalctl -u quadro -n 50 --no-pager"
bene "risponde da dentro"

# Da fuori ci vuole il certificato, e Caddy lo prende al primo che bussa: il
# primo giro puo' metterci qualche secondo.
DA_FUORI=no
for _ in $(seq 1 30); do
  if curl -fsS --max-time 5 "https://$NOME_DEL_QUADRO/salute" >/dev/null 2>&1; then
    DA_FUORI=si
    break
  fi
  sleep 2
done

if [[ "$DA_FUORI" == si ]]; then
  bene "risponde da fuori, su https://$NOME_DEL_QUADRO/salute"
else
  nota "Da fuori non risponde ancora: il certificato puo' metterci un minuto."
  nota "Si riprova cosi': curl https://$NOME_DEL_QUADRO/salute"
fi

# ─── E adesso ────────────────────────────────────────────────────────────────

printf '\n%sIl quadro e in piedi.%s\n\n' "$verde" "$spento"
printf '  Gestione:         https://%s/gestore/\n' "$NOME_DEL_QUADRO"
printf '  Console installatori: https://%s/console/\n\n' "$NOME_DEL_QUADRO"

if [[ "$CHIAVE_APPENA_FATTA" == si ]]; then
  printf '  La chiave di gestione, che si vede adesso e mai piu:\n\n'
  printf '    %s\n\n' "$CHIAVE_GESTORE"
  printf '  Mettila nel gestore di password. Da qui si rilegge cosi:\n'
  printf '    sed -n "s/^QUADRO_GESTORE=//p" %s/ambiente\n\n' "$CONFIGURAZIONE"
else
  printf '  La chiave di gestione e quella di prima. Si rilegge cosi:\n'
  printf '    sed -n "s/^QUADRO_GESTORE=//p" %s/ambiente\n\n' "$CONFIGURAZIONE"
fi

printf '  Perche una casa arrivi qui, «%s» deve stare anche\n' "$NOME_DEL_QUADRO"
printf '  dentro l add-on: ponte/src/rapporto.js, QUADRO_DI_DIFETTO.\n\n'
