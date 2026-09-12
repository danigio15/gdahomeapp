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
#   1. controlla di stare su un Debian/Ubuntu, da root, e che i due nomi
#      puntino a questa macchina;
#   2. chiede le due cose che non puo' sapere — il gettone delle segnalazioni e
#      la repository dove finiscono — e genera da sola la chiave della console;
#   3. installa Node, Caddy, il blocco di chi prova le password e gli
#      aggiornamenti di sicurezza automatici;
#   4. scarica il tramite dalla repository privata, in sola lettura;
#   5. lo accende come servizio, e lo segna perche' riparta da solo;
#   6. mette Caddy davanti, che si prende i certificati per i due nomi;
#   7. accende il giro che tiene il tramite aggiornato da solo;
#   8. prova che `/salute` risponda da fuori, e stampa la chiave della console.
#
# Se qualcosa va storto si fermerà dicendo cosa, e non a metà: ogni passo e'
# scritto per poter essere rifatto — si può reincollare la riga senza pulire
# niente.

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

PORTA="${CENTRALINO_PORTA:-8099}"

DOVE="/opt/tramite"
DATI="/var/lib/tramite"
CONFIGURAZIONE="/etc/tramite"
UTENTE="tramite"

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

for nome in "$NOME_DEL_TRAMITE" "$NOME_DELL_APP"; do
  punta="$(dove_punta "$nome" || true)"
  if [[ -z "$punta" ]]; then
    male "«$nome» non punta a niente." \
      "Il record non c'e' ancora, o non si e' ancora propagato." \
      "Mettilo cosi': tipo A, nome «${nome%%.*}», valore ${IO:-quello di questa macchina}, senza proxy."
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
    printf '%s✓ i due nomi arrivano su questa macchina.%s\n' "$verde" "$spento"
  else
    printf '%s! i due nomi esistono, ma non ho potuto confrontarli con questa macchina.%s\n' \
      "$giallo" "$spento"
    printf '  Lanciato sulla macchina vera, e con la rete aperta, il confronto lo fa.\n'
  fi
  exit 0
fi

# ─── 2. Le cose che non posso sapere ─────────────────────────────────────────

passo "Le tre cose che servono"

chiedi_zitto() {
  local domanda="$1" dove="$2" risposta=""
  while [[ -z "$risposta" ]]; do
    printf '  %s' "$domanda" >&2
    IFS= read -rs risposta </dev/tty || true
    printf '\n' >&2
  done
  printf -v "$dove" '%s' "$risposta"
}

GETTONE_LETTURA="${GETTONE_LETTURA:-}"
if [[ -z "$GETTONE_LETTURA" ]]; then
  nota "Il gettone che legge la repository del tramite (sola lettura)."
  chiedi_zitto "gettone di lettura: " GETTONE_LETTURA
fi

GETTONE_SEGNALAZIONI="${GETTONE_SEGNALAZIONI:-}"
if [[ -z "$GETTONE_SEGNALAZIONI" ]]; then
  nota "Il gettone con cui il tramite apre le segnalazioni su GitHub."
  nota "Se lo lasci vuoto le segnalazioni restano spente: si accendono dopo."
  printf '  gettone delle segnalazioni (invio per saltare): ' >&2
  IFS= read -rs GETTONE_SEGNALAZIONI </dev/tty || true
  printf '\n' >&2
fi

REPO_SEGNALAZIONI="${REPO_SEGNALAZIONI:-}"
if [[ -n "$GETTONE_SEGNALAZIONI" && -z "$REPO_SEGNALAZIONI" ]]; then
  printf '  repository delle segnalazioni [danigio15/gdahome-segnalazioni]: ' >&2
  IFS= read -r REPO_SEGNALAZIONI </dev/tty || true
  REPO_SEGNALAZIONI="${REPO_SEGNALAZIONI:-danigio15/gdahome-segnalazioni}"
fi

# La chiave della console non la scegliamo noi e non la scegli tu: quarantotto
# byte di caso. Una chiave scelta a mano e' una chiave indovinabile, e questa
# apre tutte le conversazioni.
CHIAVE_CONSOLE="$(head -c 48 /dev/urandom | base64 | tr -d '=+/' | cut -c1-48)"
bene "chiave della console generata (la stampo alla fine)"

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

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
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

# ─── 4. Il tramite ───────────────────────────────────────────────────────────

passo "Scarico il tramite"

id -u "$UTENTE" >/dev/null 2>&1 || useradd --system --home "$DATI" --shell /usr/sbin/nologin "$UTENTE"
install -d -m 755 "$DOVE"
install -d -m 700 -o "$UTENTE" -g "$UTENTE" "$DATI"
install -d -m 700 "$CONFIGURAZIONE"

# Il gettone di lettura sta in un file, non in un comando e non in un remoto di
# git: i comandi si leggono da fuori, i file no.
printf 'GETTONE_LETTURA=%s\n' "$GETTONE_LETTURA" >"$CONFIGURAZIONE/lettura"
chmod 600 "$CONFIGURAZIONE/lettura"

# Quale versione c'e' la' fuori. Il numero intero, non quello corto: si
# scarica esattamente quello che si e' confrontato, e il confronto della
# prossima volta guarda la stessa cosa.
cat >"$DOVE/sha.sh" <<'FINE'
#!/usr/bin/env bash
set -euo pipefail
. /etc/tramite/lettura
# Il gettone passa a curl in un file, non fra gli argomenti: la riga di
# comando di un processo la legge chiunque sia sulla macchina, e questo script
# gira da root mentre di fianco c'e' l'utente del servizio. `printf` e'
# integrato nella shell, quindi nemmeno lui apre un processo che lo mostri.
curl -fsS --max-time 20 --retry 2 \
  --config <(printf 'header = "Authorization: Bearer %s"\n' "$GETTONE_LETTURA") \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${1:?repository}/commits/${2:?segno}" |
  sed -n 's/.*"sha"[[:space:]]*:[[:space:]]*"\([0-9a-f]\{40\}\)".*/\1/p' | head -1
FINE

# Scarica una versione precisa, la prova, e solo se le prove passano la mette
# al posto di quella che c'e'.
#
# L'ordine e' la cosa che conta: prima si prova, poi si scambia. Al contrario —
# scambia e poi prova — una versione rotta avrebbe gia' preso il posto di una
# che funzionava, e per tornare indietro servirebbe un'altra rete.
#
# E si scambiano solo le tre cose che cambiano: `centralino`, `app`, `versione`.
# Gli script stanno di fianco e non si toccano, se no un aggiornamento si
# porterebbe via anche chi lo sta eseguendo.
cat >"$DOVE/scarica.sh" <<'FINE'
#!/usr/bin/env bash
set -euo pipefail
. /etc/tramite/lettura
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
[ -d "$radice/centralino" ] || {
  echo "nel pacchetto non c'e' il centralino" >&2
  exit 1
}

( cd "$radice/centralino" && node --test test/*.test.js >/dev/null 2>&1 ) || {
  echo "le prove di questa versione non passano" >&2
  exit 2
}

rm -rf "$DOVE/centralino.nuovo" "$DOVE/app.nuovo"
cp -a "$radice/centralino" "$DOVE/centralino.nuovo"
if [ -d "$radice/ponte/app" ]; then
  cp -a "$radice/ponte/app" "$DOVE/app.nuovo"
else
  mkdir -p "$DOVE/app.nuovo"
fi

rm -rf "$DOVE/centralino.via" "$DOVE/app.via"
[ -d "$DOVE/centralino" ] && mv "$DOVE/centralino" "$DOVE/centralino.via"
[ -d "$DOVE/app" ] && mv "$DOVE/app" "$DOVE/app.via"
mv "$DOVE/centralino.nuovo" "$DOVE/centralino"
mv "$DOVE/app.nuovo" "$DOVE/app"
printf '%s' "$SHA" >"$DOVE/versione"
rm -rf "$DOVE/centralino.via" "$DOVE/app.via"
FINE

chmod 700 "$DOVE/sha.sh" "$DOVE/scarica.sh"

VERSIONE="$("$DOVE/sha.sh" "$REPO_DEL_TRAMITE" "$SEGNO" || true)"
[[ -n "$VERSIONE" ]] || male \
  "Non riesco a chiedere a GitHub che versione c'e'." \
  "Il gettone di lettura non va bene, o il segno «$SEGNO» non esiste ancora." \
  "Il gettone deve vedere «$REPO_DEL_TRAMITE» con Contents: Read."

"$DOVE/scarica.sh" "$REPO_DEL_TRAMITE" "$VERSIONE" "$DOVE" || male \
  "Non riesco a mettere in piedi il tramite." \
  "Se ha detto che le prove non passano, quella versione e' rotta: non la" \
  "accendo, ed e' giusto. Si guarda cosa dicono cosi':" \
  "  curl -fsSL -H \"Authorization: Bearer <gettone>\" \\" \
  "    https://api.github.com/repos/$REPO_DEL_TRAMITE/tarball/$SEGNO | tar tz | head"

bene "tramite scaricato e provato, versione ${VERSIONE:0:8}"

# ─── 5. Il servizio ──────────────────────────────────────────────────────────

passo "Accendo il servizio"

{
  printf 'CENTRALINO_PORTA=%s\n' "$PORTA"
  printf 'CENTRALINO_DATI=%s\n' "$DATI"
  printf 'CHIAVE_CONSOLE=%s\n' "$CHIAVE_CONSOLE"
  printf 'GITHUB_SEGNALAZIONI=%s\n' "$GETTONE_SEGNALAZIONI"
  printf 'GITHUB_REPO=%s\n' "$REPO_SEGNALAZIONI"
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
RestrictAddressFamilies=AF_INET AF_INET6
LockPersonality=yes
MemoryDenyWriteExecute=yes

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

cat >/etc/caddy/Caddyfile <<FINE
# Davanti al tramite.
#
# Caddy fa una cosa sola e la fa bene: si prende i certificati per questi due
# nomi, li rinnova da solo, e passa quello che arriva a chi di dovere. I fili
# WebSocket li passa senza toccarli.

$NOME_DEL_TRAMITE {
	encode zstd gzip
	reverse_proxy 127.0.0.1:$PORTA
}

# I file dell'app, quelli compilati per il browser. Li serve Caddy e non il
# tramite: sono file fermi, e il tramite ha altro da fare.
#
# \`try_files\` manda all'indice quello che non e' un file: l'app decide le sue
# schermate da sola, e chi ricarica una pagina interna non deve trovare un 404.
$NOME_DELL_APP {
	encode zstd gzip
	root * $DOVE/app
	try_files {path} /index.html
	file_server
}
FINE

caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1 || male \
  "La configurazione di Caddy non va bene." \
  "Si guarda cosi': caddy validate --config /etc/caddy/Caddyfile"

systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy
bene "Caddy in piedi"

# ─── 7. Il giro che tiene tutto aggiornato ───────────────────────────────────

passo "Accendo il giro degli aggiornamenti"

# Quale repository, quale segno, quale cartella: scritto in un file, cosi' lo
# script che aggiorna non ha niente dentro che dipenda da questa macchina.
{
  printf 'REPO=%s\n' "$REPO_DEL_TRAMITE"
  printf 'SEGNO=%s\n' "$SEGNO"
  printf 'DOVE=%s\n' "$DOVE"
} >"$CONFIGURAZIONE/quale"
chmod 600 "$CONFIGURAZIONE/quale"

cat >"$DOVE/aggiorna.sh" <<'FINE'
#!/usr/bin/env bash
#
# Guarda se il segno si e' spostato, e in quel caso porta dentro la versione
# nuova. Se le sue prove non passano, non la porta dentro: meglio un tramite
# vecchio che funziona di uno nuovo che non parte.
set -euo pipefail
. /etc/tramite/quale

adesso="$("$DOVE/sha.sh" "$REPO" "$SEGNO" || true)"
if [ -z "$adesso" ]; then
  echo "non riesco a chiedere a GitHub che versione c'e': riprovo al giro dopo"
  exit 0
fi

qui="$(cat "$DOVE/versione" 2>/dev/null || true)"
[ "$adesso" != "$qui" ] || exit 0

echo "si passa da ${qui:0:8} a ${adesso:0:8}"
"$DOVE/scarica.sh" "$REPO" "$adesso" "$DOVE"
systemctl restart tramite
echo "acceso sulla ${adesso:0:8}"
FINE
chmod 700 "$DOVE/aggiorna.sh"

cat >/etc/systemd/system/tramite-aggiorna.service <<FINE
[Unit]
Description=Porta dentro il tramite nuovo, se c'e'

[Service]
Type=oneshot
ExecStart=$DOVE/aggiorna.sh
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

cat <<FINE

  L'app da browser:   https://$NOME_DELL_APP
  La chat, per rispondere:  https://$NOME_DEL_TRAMITE/console/

  ${giallo}La chiave della console — mettila nel gestore di password, questa e' la
  sola volta che la vedi:${spento}

      $CHIAVE_CONSOLE

  Se la perdi non e' un disastro: si rifa' con
      tramite-chiave-nuova

FINE

# Un comando per rifare la chiave, cosi' non serve ricordare dove sta scritta.
cat >/usr/local/bin/tramite-chiave-nuova <<'FINE'
#!/usr/bin/env bash
set -euo pipefail
nuova="$(head -c 48 /dev/urandom | base64 | tr -d '=+/' | cut -c1-48)"
sed -i "s|^CHIAVE_CONSOLE=.*|CHIAVE_CONSOLE=$nuova|" /etc/tramite/ambiente
systemctl restart tramite
printf '\nla chiave nuova e:\n\n    %s\n\n' "$nuova"
FINE
chmod 700 /usr/local/bin/tramite-chiave-nuova
