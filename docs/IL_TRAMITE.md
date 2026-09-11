# Il tramite su una macchina nostra: come si mette in piedi

Passo per passo, dal dominio all'accensione. Si fa **tutto dal browser del
telefono**: non serve un computer, non serve un terminale, non serve SSH.

Leggilo prima per intero, poi rifallo cliccando: sono quattro cose, e le prime
tre sono acquisti.

---

## Perché si fa

Oggi il tramite fra il telefono e la casa è un Worker di Cloudflare, e
Cloudflare **conta i messaggi**: centomila al giorno sul piano gratuito, poi si
spegne per tutti. Un filo aperto di messaggi ne fa migliaia all'ora, quindi il
costo cresce con le **ore di uso** — e cresce per sempre, a qualunque prezzo si
parta.

Su una macchina nostra i messaggi non li conta nessuno. Cinquecento case aperte
insieme sono un problema di memoria, non di fattura: il conto è **fisso**.

| | oggi | con la macchina |
|---|---|---|
| chi paga | a messaggio | al mese, sempre uguale |
| 10 case | gratis | ~5 €/mese |
| 500 case | ~100 €/mese | ~5 €/mese |
| 5.000 case | non ci sta | ~5 €/mese |

Quello che **non** cambia: l'app, il ponte, la cifratura, l'abbinamento, le
segnalazioni, la chat. Il protocollo resta identico — cambia solo dove le case
vanno a bussare.

---

## Quanto costa in tutto

| cosa | quanto |
|---|---|
| la macchina | ~4,50 €/mese |
| il backup automatico (consigliato) | ~0,90 €/mese |
| il dominio | ~12 €/anno |

**Circa 77 € l'anno**, e non si muovono con gli utenti.

---

## 1. Il dominio

### Perché serve davvero

Senza un nome non c'è certificato, e senza certificato non si va da nessuna
parte: l'app web sta su `https` e una pagina sicura non apre fili in chiaro;
Android, dalla sua parte, i collegamenti non cifrati li blocca di suo. Non è
una questione di eleganza — senza il nome non funziona.

### Comprarlo

Da un qualunque registrar (Namecheap, Porkbun, Aruba, Netsons: cambia poco).
Un `.it` o un `.com` stanno sui dieci-quindici euro l'anno.

Compra **solo il nome**. Quando ti propongono hosting, caselle di posta,
certificati, «protezione della privacy a pagamento», costruttori di siti: no.
Non ti serve niente di tutto quello.

### Portarlo su Cloudflare (gratis)

1. Fai un account su `dash.cloudflare.com` — o usa quello che hai già.
2. **Add a site**, scrivi il tuo dominio, scegli il piano **Free**.
3. Cloudflare ti mostra **due nomi di server DNS** (tipo `dana.ns.cloudflare.com`).
4. Torni nel pannello del registrar, cerchi la voce dei **nameserver** (a volte
   «DNS», a volte «Gestione DNS»), togli quelli suoi e metti quei due.
5. Aspetti. Di solito minuti; a volte qualche ora. Cloudflare ti manda una mail
   quando è fatto.

**Perché passare da Cloudflare invece di usare il DNS del registrar:** perché
così hai, gratis, lo scudo davanti alla macchina — quello che filtra gli
attacchi — e i record li cambi in un secondo da telefono. E attenzione: quello
scudo è il proxy normale, **non** i Worker. Lì i messaggi non si contano.

---

## 2. La macchina

Il riferimento è **Hetzner Cloud**, che costa poco ed è in Germania (venti-trenta
millesimi di secondo dall'Italia: non si sentono). Vanno bene anche altri —
Contabo, OVH, Scaleway — cambia solo dove clicchi.

1. Account su `console.hetzner.cloud`, e un **nuovo progetto** (chiamalo
   `gdahome`).
2. **Add Server**, e queste scelte:
   - **Location**: Falkenstein o Nuremberg.
   - **Image**: Ubuntu (l'ultima versione con scritto LTS).
   - **Type**: la più piccola x86 con 2 processori e 4 GB — oggi si chiama
     **CX22**. Non serve di più: il tramite gira le buste, non le apre.
   - **Volume, Firewall, Placement**: niente.
   - **Backups**: **accendilo**. Costa il venti per cento in più, meno di un
     euro al mese, e più sotto è spiegato perché conviene.
   - **SSH keys**: se non ne hai, **saltale**. Hetzner ti manda la password di
     `root` per mail, e a noi serve solo quella: si entra dalla **console nel
     browser**, che è un terminale dentro la pagina.
3. Crea. Dopo un minuto la macchina c'è, e nel pannello vedi il suo
   **indirizzo IPv4**: segnatelo, serve al passo dopo.

> **La console nel browser** è il bottone `Console` nella pagina del server. Si
> apre un riquadro nero: quello è il terminale della macchina. Attento a una
> cosa sola: la tastiera lì dentro è quella americana, quindi i simboli stanno
> in posti diversi. Non ti serve scriverli — ti serve **incollare**, e la
> console ha il suo bottone per farlo.

---

## 3. Il nome punta alla macchina

Su Cloudflare, nel tuo dominio, **DNS → Add record**:

| campo | valore |
|---|---|
| Type | `A` |
| Name | `centralino` |
| IPv4 address | l'indirizzo della macchina |
| Proxy status | **DNS only** (la nuvola **grigia**) |

**Perché grigia e non arancione:** il certificato se lo prende la macchina da
sola, e con il proxy acceso al primo giro non ci riesce. Si accende dopo, se
vuoi, a cose funzionanti.

**Come sai che ha preso:** apri dal telefono `http://centralino.iltuodominio.it`.
Deve dare un errore di **connessione rifiutata**, non «sito non trovato». Vuol
dire che il nome arriva alla macchina, e che sulla macchina non c'è ancora
niente in ascolto. È giusto così: il pezzo dopo è quello.

---

## 4. Accendere il tramite

Apri la **Console** del server, entri come `root` con la password arrivata per
mail (la prima volta te la fa cambiare), e **incolli una riga**.

Quella riga è uno script che sto preparando io, e fa tutto da solo:

- installa quello che serve (Node, e il pezzo che prende il certificato);
- scarica il tramite dalla repository privata, con una chiave di **sola
  lettura**;
- chiede tre cose: il nome (`centralino.iltuodominio.it`), la chiave della
  console e il gettone di GitHub delle segnalazioni;
- prende il certificato, accende il servizio, e lo segna perché **riparta da
  solo** a ogni riavvio della macchina;
- accende gli aggiornamenti di sicurezza automatici del sistema.

Alla fine stampa una riga che dice che sta in ascolto. Da quel momento la
macchina fa il suo lavoro, e tu quella console non la riapri più.

---

## 5. La prova

Dal telefono, apri:

```
https://centralino.iltuodominio.it/salute
```

Deve rispondere che sta bene, e dire da quanto è acceso. Se risponde, il
tramite c'è, il certificato è valido, il nome è giusto.

Se invece:

- **non si apre proprio**: il nome non punta ancora. Rifai il passo 3 e aspetta.
- **dice che il certificato non è valido**: il proxy di Cloudflare è acceso
  (nuvola arancione). Rimettilo grigio e riprova.
- **dice «connessione rifiutata»**: il servizio non è partito. Nella console,
  il comando che lo script ti lascia scritto mostra l'ultimo errore.

---

## 6. Passare le case

Questo lo faccio io da qui, e sono tre cose:

1. lancio `strumenti/centralino.mjs wss://centralino.iltuodominio.it`. Quello
   strumento esiste apposta: l'indirizzo sta scritto in **due** file — uno che
   finisce nell'add-on e uno che finisce nell'app — e cambiarne uno solo
   vorrebbe dire telefoni che cercano le case in un posto e case che aspettano
   in un altro;
2. pubblico l'add-on nuovo e l'app nuova;
3. tu aggiorni l'add-on (il bottone nella sua console) e l'app.

**Come sai che è passata:** nel registro dell'add-on compare
`il centralino ci conosce: casa_…`, e da fuori casa l'app entra come prima.

Il Worker vecchio resta acceso due o tre settimane, così se qualcuno aggiorna
tardi non resta fuori. Poi si spegne.

---

## 7. La spia

Oggi, se il tramite morisse, lo scopriresti da un utente arrabbiato. Con una
macchina tua serve una spia, ed è gratis:

1. account su **UptimeRobot** (o simile);
2. nuovo monitor di tipo **HTTP(s)** sull'indirizzo `/salute`, ogni 5 minuti;
3. la tua mail come avviso.

Ti scrive quando cade e quando torna. Quelle richieste le fa alla **tua**
macchina, dove non le conta nessuno.

---

## 8. Cosa succede dopo

### Aggiornare il tramite

Resta il bottone **«Il centralino»** su Actions, come adesso: cambia solo dove
punta. Tu premi, la macchina si riscarica il codice nuovo e riparte. Le case si
ricollegano da sole in pochi secondi.

### Aggiornare il sistema

Lo script accende gli aggiornamenti di sicurezza automatici. Ogni tanto — due
volte l'anno — conviene un riavvio: dal pannello, un bottone.

### Se la macchina si spegne

Da fuori casa non entra più nessuno finché non torna. **Dentro casa continua a
funzionare tutto**, perché lì il filo è locale e non passa dal tramite: la
plancia, i dispositivi, la configurazione. Questo è il prezzo vero del costo
fisso, ed è giusto saperlo prima.

Per ripartire: dal pannello si riavvia la macchina. Se fosse persa del tutto,
se ne crea un'altra e si reincolla la riga del passo 4.

### Il backup, e perché l'ho consigliato

Il tramite tiene poca roba: per ogni casa **l'impronta** del suo segreto (non
il segreto: l'impronta, che non si può girare al contrario), un contatore, e
l'elenco delle segnalazioni.

Se quell'archivio si perdesse, **non dovresti riabbinare niente**: il ponte si
ripresenta e il tramite lo riconosce da capo, perché la prima casa che si
presenta con un certo identificativo se lo prende. Ma per quella finestra di
tempo l'identificativo di una casa sarebbe libero, e chi lo conoscesse potrebbe
prenderselo. Sono centoventotto bit presi a caso, quindi indovinarlo non si
indovina — però un backup da novanta centesimi al mese toglie il problema
invece di ragionarci sopra.

---

## 9. Come si torna indietro

Il Worker su Cloudflare resta dov'è finché non lo spegni tu. Se qualcosa non
va, si rilancia `strumenti/centralino.mjs` con l'indirizzo vecchio, si
ripubblicano add-on e app, e le case tornano lì. Non si perde nessuno, e non
si riabbina niente.

Per questo il Worker si spegne **dopo** qualche settimana, e non il giorno
stesso.

---

## 10. Quello che serve da te

Solo queste, e nell'ordine:

1. il dominio comprato e portato su Cloudflare (passo 1);
2. la macchina creata, e il suo indirizzo IP (passo 2);
3. il record `centralino` che punta lì (passo 3);
4. la riga incollata nella console (passo 4) — quella te la do io;
5. `/salute` che risponde (passo 5).

Il resto — il tramite, le sue prove, lo script, il bottone che aggiorna, il
`/salute` — lo preparo io da qui, prima che tu accenda qualunque cosa. La
macchina la crei quando c'è già tutto pronto da accendere.
