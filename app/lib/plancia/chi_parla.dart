/// Chi puo' parlare col servitore del browser, e come.
///
/// Nel browser la plancia e l'app si parlano con dei messaggi fra finestre:
/// il riquadro della plancia manda su i messaggi del suo WebSocket, il
/// service worker chiede i file. Dall'altra parte di quei messaggi c'e' il
/// filo con la casa, gia' aperto e gia' riconosciuto. Una finestra qualunque
/// — una pagina che ha aperto l'app, o che l'app ha aperto — puo' mandare un
/// messaggio a questa, e se venisse ascoltato parlerebbe con la casa a nome
/// di chi e' entrato.
///
/// Percio' un messaggio si ascolta solo se arriva **dalla stessa origine**
/// dell'app, e **da chi deve**: le domande dei file dal service worker, il
/// WebSocket dal riquadro della plancia. Le regole stanno qui, senza niente
/// del browser, perche' si possano provare; chi le applica e'
/// `servitore_qui/sul_web.dart`.
library;

/// Da dove arriva un messaggio.
enum DaChi {
  /// Il service worker della plancia (`plancia-sw.js`).
  lavoratore,

  /// Il riquadro della plancia, dentro questa pagina.
  riquadro,

  /// Chiunque altro: un'altra finestra, un'altra scheda, un riquadro che non
  /// e' il nostro.
  altro,
}

/// Se il messaggio [che], arrivato da [chi] con l'origine [origine], si
/// ascolta. [mia] e' l'origine dell'app.
bool siAscolta({
  required Object? che,
  required DaChi chi,
  required String origine,
  required String mia,
}) {
  /* Un'origine opaca («null») non e' di nessuno, e non vale nemmeno se lo
   * e' anche la nostra. */
  if (mia.isEmpty || mia == 'null' || origine != mia) return false;
  return switch (che) {
    'gdahome/chiedi' => chi == DaChi.lavoratore,
    'gdahome/ws-apri' || 'gdahome/ws-su' => chi == DaChi.riquadro,
    _ => false,
  };
}

/// Il WebSocket finto, che la plancia usa credendo sia quello vero.
///
/// La plancia ospitata apre il filo e aspetta `auth_ok`; qui `send` e
/// `onmessage` passano dalla pagina che ospita. Si dichiarano anche
/// `addEventListener` e le costanti, perche' la plancia usa tutti e due i
/// modi — le proprieta' `on*` in un punto, gli ascoltatori in un altro — e
/// mancarne uno vuol dire una plancia che parte e non riceve mai niente.
///
/// **A chi parla, e chi ascolta.** Manda solo a chi la ospita e solo sulla
/// sua stessa origine — non a `"*"`, che vorrebbe dire a chiunque la stia
/// ospitando — e ascolta solo i messaggi che arrivano da li': dalla finestra
/// che la contiene, con la sua stessa origine. Una pagina di fuori che le
/// mandasse un finto «ws-giu» non verrebbe ascoltata.
const String ilWebSocketDelRiquadro =
    '(function(){'
    'var mia=location.origin;'
    'function Finto(_indirizzo,_protocolli){'
    'var io=this;'
    'this.readyState=0;this.url="gdahome://plancia";'
    'this.onopen=null;this.onmessage=null;this.onclose=null;this.onerror=null;'
    'this._ascolti={};'
    'Finto._aperti.push(this);'
    'this._chiama=function(che,evento){'
    'var suo=io["on"+che];if(suo)try{suo.call(io,evento);}catch(e){}'
    'var altri=io._ascolti[che]||[];'
    'for(var i=0;i<altri.length;i++)try{altri[i].call(io,evento);}catch(e){}'
    '};'
    'setTimeout(function(){'
    'if(io.readyState!==0)return;'
    'io.readyState=1;io._chiama("open",{type:"open"});'
    'parent.postMessage({che:"gdahome/ws-apri"},mia);'
    '},0);'
    '}'
    'Finto._aperti=[];'
    'Finto.prototype.addEventListener=function(che,quale){'
    '(this._ascolti[che]=this._ascolti[che]||[]).push(quale);};'
    'Finto.prototype.removeEventListener=function(che,quale){'
    'var altri=this._ascolti[che]||[];var dove=altri.indexOf(quale);'
    'if(dove>=0)altri.splice(dove,1);};'
    'Finto.prototype.send=function(testo){'
    'if(this.readyState!==1)return;'
    'parent.postMessage({che:"gdahome/ws-su",testo:String(testo)},mia);};'
    'Finto.prototype.close=function(){'
    'if(this.readyState>=2)return;'
    'this.readyState=3;'
    'this._chiama("close",{type:"close",code:1000,wasClean:true});};'
    'Finto.CONNECTING=0;Finto.OPEN=1;Finto.CLOSING=2;Finto.CLOSED=3;'
    'Finto.prototype.CONNECTING=0;Finto.prototype.OPEN=1;'
    'Finto.prototype.CLOSING=2;Finto.prototype.CLOSED=3;'
    'window.addEventListener("message",function(evento){'
    'if(evento.source!==parent||evento.origin!==mia)return;'
    'var detto=evento.data;if(!detto)return;'
    'if(detto.che==="gdahome/ws-giu"){'
    'for(var i=0;i<Finto._aperti.length;i++){'
    'var uno=Finto._aperti[i];if(uno.readyState!==1)continue;'
    'uno._chiama("message",{type:"message",data:detto.testo});}}'
    'else if(detto.che==="gdahome/ws-chiudi"){'
    'for(var j=0;j<Finto._aperti.length;j++){'
    'var due=Finto._aperti[j];if(due.readyState>=2)continue;'
    'due.readyState=3;'
    'due._chiama("close",{type:"close",code:1006,wasClean:false});}}'
    '});'
    'return Finto;})()';
