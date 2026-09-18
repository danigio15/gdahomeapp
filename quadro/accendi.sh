#!/usr/bin/env bash
#
# Accende il quadro, di fianco al tramite o su una macchina sua.
#
# Il quadro e' uno solo e sta da gdahome: le case installate ci depositano
# poche righe di numeri, e chi le ha installate le guarda. Chi installa non
# accende niente — gli si apre un conto da `/gestore/` e gli si da' una chiave.
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
#      sgabuzzino, una volta sola;
#   3. installa Node e Caddy, se non ci sono gia';
#   4. scarica il quadro, lo prova, e solo se le prove passano lo mette;
#   5. lo accende come servizio, e lo segna perche' riparta da solo;
#   6. mette un innesto in Caddy — non riscrive il suo file, ci mette dentro un
#      pezzo — cosi' il tramite e il quadro stanno sulla stessa macchina senza
#      cancellarsi a vicenda;
#   7. accende il giro che lo tiene aggiornato;
#   8. prova che `/salute` risponda da fuori, e dice la chiave dello sgabuzzino.
#
# **E rilanciarlo non porta via niente.** La chiave dello sgabuzzino, se c'e'
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
# (`ponte/src/cartolina.js`, `QUADRO_DI_DIFETTO`), come per il centralino e per
# lo stesso motivo — una casella che non va toccata e' una casella che prima o
# poi qualcuno tocca. Cambiare qui e non li' vuol dire un quadro che nessuna
# casa trova.
NOME_DEL_QUADRO="${NOME_DEL_QUADRO:-quadro.gdahome.org}"

PORTA="${QUADRO_PORTA:-8100}"

DOVE="/opt/quadro"
DATI="/var/lib/quadro"
CONFIGURAZIONE="/etc/quadro"
UTENTE="quadro"

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
    "Se il DNS e' su Cloudflare, il proxy arancione va spento: il certificato" \
    "se lo prende Caddy, e con la nuvola davanti non ci riesce."
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

# La chiave dello sgabuzzino: quarantotto byte di caso, e **una volta sola**.
#
# Da li' si aprono i conti degli installatori e si mettono i tetti. Rifarla a
# ogni giro vorrebbe dire che chi reincolla la riga per aggiornare si ritrova
# fuori dal suo quadro — e senza quella chiave non si puo' iscrivere nessuno.
CHIAVE_GESTORE="$(gia_scritto "$CONFIGURAZIONE/ambiente" QUADRO_GESTORE)"
CHIAVE_APPENA_FATTA=no
if [[ -z "$CHIAVE_GESTORE" ]]; then
  CHIAVE_GESTORE="$(head -c 48 /dev/urandom | base64 | tr -d '=+/' | cut -c1-48)"
  CHIAVE_APPENA_FATTA=si
  bene "chiave dello sgabuzzino generata (la dico alla fine)"
else
  bene "la chiave dello sgabuzzino e' quella che c'era: non la tocco"
fi

# ─── 3. Quello che serve sulla macchina ──────────────────────────────────────

passo "Installo quello che serve"

export DEBIAN_FRONTEND=noninteractive

if ! command -v node >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq curl ca-certificates gnupg >/dev/null
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
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

# ─── 4. Il quadro ────────────────────────────────────────────────────────────

passo "Scarico il quadro"

id -u "$UTENTE" >/dev/null 2>&1 || useradd --system --home "$DATI" --shell /usr/sbin/nologin "$UTENTE"
install -d -m 755 "$DOVE"
install -d -m 700 -o "$UTENTE" -g "$UTENTE" "$DATI"
install -d -m 700 "$CONFIGURAZIONE"

printf 'GETTONE_LETTURA=%s\n' "$GETTONE_LETTURA" >"$CONFIGURAZIONE/lettura"
chmod 600 "$CONFIGURAZIONE/lettura"

cat >"$DOVE/sha.sh" <<'FINE'
#!/usr/bin/env bash
set -euo pipefail
. /etc/quadro/lettura
# Il gettone passa a curl in un file, non fra gli argomenti: la riga di comando
# di un processo la legge chiunque sia sulla macchina.
curl -fsS --max-time 20 --retry 2 \
  --config <(printf 'header = "Authorization: Bearer %s"\n' "$GETTONE_LETTURA") \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${1:?repository}/commits/${2:?segno}" |
  sed -n 's/.*"sha"[[:space:]]*:[[:space:]]*"\([0-9a-f]\{40\}\)".*/\1/p' | head -1
FINE

# Prima si prova, poi si scambia. Al contrario, una versione rotta avrebbe gia'
# preso il posto di una che funzionava.
cat >"$DOVE/scarica.sh" <<'FINE'
#!/usr/bin/env bash
set -euo pipefail
. /etc/quadro/lettura
REPO="${1:?repository}"
SHA="${2:?sha}"
DOVE="${3:?dove}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -fsSL --max-time 120 --retry 3 --retry-delay 2 \
  --config <(printf 'header = "Authorization: Bearer %s"\n' "$GETTONE_LETTURA") \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$REPO/tarball/$SHA" | tar xz -C "$tmp"

radice="$(find "$tmp" -maxdepth 1 -mindepth 1 -type d | head -1)"
[ -d "$radice/quadro" ] || {
  echo "nel pacchetto non c'e' il quadro" >&2
  exit 1
}

( cd "$radice/quadro" && node --test test/*.test.js >/dev/null 2>&1 ) || {
  echo "le prove di questa versione non passano" >&2
  exit 2
}

# Si scambia solo quello che cambia. Gli script stanno di fianco e non si
# toccano: un aggiornamento che si portasse via chi lo sta eseguendo e' un
# aggiornamento che non finisce.
rm -rf "$DOVE/quadro.nuovo"
cp -a "$radice/quadro" "$DOVE/quadro.nuovo"
rm -rf "$DOVE/quadro.vecchio"
[ -d "$DOVE/quadro" ] && mv "$DOVE/quadro" "$DOVE/quadro.vecchio"
mv "$DOVE/quadro.nuovo" "$DOVE/quadro"
rm -rf "$DOVE/quadro.vecchio"
printf '%s\n' "$SHA" >"$DOVE/versione"
FINE

chmod 700 "$DOVE/sha.sh" "$DOVE/scarica.sh"

VERSIONE="$("$DOVE/sha.sh" "$REPO_DEL_QUADRO" "$SEGNO")" ||
  male "Non riesco a chiedere a GitHub qual e' l'ultima versione." \
    "Di solito e' il gettone: deve poter leggere «$REPO_DEL_QUADRO»."
[[ -n "$VERSIONE" ]] || male "GitHub non mi dice quale versione c'e' su «$SEGNO»."

"$DOVE/scarica.sh" "$REPO_DEL_QUADRO" "$VERSIONE" "$DOVE" ||
  male "Il quadro non si e' installato: le prove di questa versione non passano." \
    "Non ho toccato quello che c'era."
bene "quadro scaricato e provato, versione ${VERSIONE:0:8}"

# ─── 5. Il servizio ──────────────────────────────────────────────────────────

passo "Accendo il servizio"

{
  printf 'QUADRO_PORTA=%s\n' "$PORTA"
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
# Il quadro. Le case depositano su /cartolina, gli installatori guardano su
# /console/, e chi tiene il quadro apre i conti su /gestore/.
$NOME_DEL_QUADRO {
	encode zstd gzip
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

cat >"$DOVE/aggiorna.sh" <<FINE
#!/usr/bin/env bash
set -euo pipefail
vecchia="\$(cat "$DOVE/versione" 2>/dev/null || true)"
nuova="\$("$DOVE/sha.sh" "$REPO_DEL_QUADRO" "$SEGNO" 2>/dev/null || true)"
[ -n "\$nuova" ] || exit 0
[ "\$nuova" != "\$vecchia" ] || exit 0
# Se le prove della versione nuova non passano, \`scarica.sh\` si ferma e non
# tocca niente: la macchina resta su quella di prima, che funziona.
"$DOVE/scarica.sh" "$REPO_DEL_QUADRO" "\$nuova" "$DOVE"
systemctl restart quadro
logger -t quadro "aggiornato a \${nuova:0:8}"
FINE
chmod 700 "$DOVE/aggiorna.sh"

cat >/etc/systemd/system/quadro-aggiorna.service <<FINE
[Unit]
Description=Porta dentro il quadro nuovo, se c'e'

[Service]
Type=oneshot
ExecStart=$DOVE/aggiorna.sh
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
printf '  Lo sgabuzzino:   https://%s/gestore/\n' "$NOME_DEL_QUADRO"
printf '  Gli installatori: https://%s/console/\n\n' "$NOME_DEL_QUADRO"

if [[ "$CHIAVE_APPENA_FATTA" == si ]]; then
  printf '  La chiave dello sgabuzzino, che si vede adesso e mai piu:\n\n'
  printf '    %s\n\n' "$CHIAVE_GESTORE"
  printf '  Mettila nel gestore di password. Da qui si rilegge cosi:\n'
  printf '    sed -n "s/^QUADRO_GESTORE=//p" %s/ambiente\n\n' "$CONFIGURAZIONE"
else
  printf '  La chiave dello sgabuzzino e quella di prima. Si rilegge cosi:\n'
  printf '    sed -n "s/^QUADRO_GESTORE=//p" %s/ambiente\n\n' "$CONFIGURAZIONE"
fi

printf '  Perche una casa arrivi qui, «%s» deve stare anche\n' "$NOME_DEL_QUADRO"
printf '  dentro l add-on: ponte/src/cartolina.js, QUADRO_DI_DIFETTO.\n\n'
