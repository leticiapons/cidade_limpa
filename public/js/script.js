(function(){
var $=function(i){return document.getElementById(i)};
var STAT=["Recebido","Em Andamento","Concluído"];
var pollT=null;
function esc(s){var d=document.createElement("div");d.textContent=s==null?"":String(s);return d.innerHTML}
// ---------- API (servidor Node + PostgreSQL) ----------
function api(url,opt){
  opt=opt||{};opt.credentials="same-origin";
  opt.headers=Object.assign({"Content-Type":"application/json"},opt.headers||{});
  return fetch(url,opt).then(function(r){
    return r.json().catch(function(){return{}}).then(function(j){
      if(!r.ok){var e=new Error(j.erro||"Erro no servidor.");e.status=r.status;throw e}
      return j;
    });
  });
}
var subs=[];
function render(){
  var tb=$("tb");if(!tb)return;
  var l=subs.slice().sort(function(a,b){return b.ts-a.ts});
  if(!l.length){tb.innerHTML='<tr><td colspan="10" style="text-align:center;padding:28px">Nenhum registro enviado até o momento.</td></tr>';return}
  tb.innerHTML=l.map(function(s){
    var img=!s.foto?"—":s.foto.indexOf("data:image")===0?'<a href="'+s.foto+'" target="_blank" rel="noopener"><img src="'+s.foto+'" alt="Foto do lixo"></a>':'PDF'+(s.fotoNome?'<br><small>'+esc(s.fotoNome)+'</small>':'');
    var opt=STAT.map(function(x){return'<option'+(x===s.status?' selected':'')+'>'+x+'</option>'}).join("");
    return'<tr><td>'+esc(s.idv)+'</td><td>'+esc(String(s.data||"").split(/[ ,]/)[0])+'</td><td><select data-id="'+esc(s.id)+'" aria-label="Status">'+opt+'</select></td><td>'+esc(s.tipo)+'</td><td>'+esc(s.rua)+'</td><td>'+esc(s.num)+'</td><td>'+esc(s.bairro)+'</td><td>'+esc(s.cidade)+'/'+esc(s.uf)+'</td><td>'+esc(s.cep)+'</td><td>'+img+'</td></tr>';
  }).join("");applyF();
}
function applyF(){var f=document.querySelectorAll(".flt [data-c]");Array.prototype.forEach.call($("tb").rows,function(r){if(r.cells.length<10){r.hidden=false;return}var ok=true;Array.prototype.forEach.call(f,function(el){var v=el.value.trim().toLowerCase();if(!v)return;var c=r.cells[+el.dataset.c],s=c.querySelector("select"),t=s?s.value:c.textContent;if(t.toLowerCase().indexOf(v)<0)ok=false});r.hidden=!ok})}
function carregar(){
  api("/api/submissoes").then(function(l){subs=l;render()}).catch(function(e){
    if(e.status===401)sair();
  });
}
function watch(){
  if(pollT)clearInterval(pollT);
  carregar();pollT=setInterval(carregar,15000);
}
function save(s){return api("/api/submissoes",{method:"POST",body:JSON.stringify(s)})}
function setStatus(id,st){return api("/api/submissoes/"+encodeURIComponent(id)+"/status",{method:"PATCH",body:JSON.stringify({status:st})})}
// ---------- formulário ----------
$("cep").addEventListener("input",function(){this.value=this.value.replace(/\D/g,"").slice(0,8)});
$("uf").addEventListener("input",function(){this.value=this.value.replace(/[^a-zA-Z]/g,"").toUpperCase()});
function lerFoto(f){
  return new Promise(function(res,rej){
    var ok=/\.(jpe?g|pdf)$/i.test(f.name);if(!ok)return rej(new Error("Formato não permitido. Use jpeg, jpg ou pdf."));
    var r=new FileReader();
    r.onerror=function(){rej(new Error("Não foi possível ler o arquivo."))};
    if(/\.pdf$/i.test(f.name)){
      r.onload=function(){res({foto:f.size<140000?r.result:"data:application/pdf;name",fotoNome:f.name})};r.readAsDataURL(f);return;
    }
    r.onload=function(){
      var im=new Image();
      im.onerror=function(){rej(new Error("Imagem inválida."))};
      im.onload=function(){
        var m=800,k=Math.min(1,m/Math.max(im.width,im.height)),c=document.createElement("canvas");
        c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);
        c.getContext("2d").drawImage(im,0,0,c.width,c.height);
        res({foto:c.toDataURL("image/jpeg",.7),fotoNome:f.name});
      };im.src=r.result;
    };r.readAsDataURL(f);
  });
}
$("frm").addEventListener("submit",function(e){
  e.preventDefault();var er=$("ferr");er.textContent="";
  var t=document.querySelector('input[name="tipo"]:checked');
  var v={rua:$("rua").value.trim(),num:$("num").value.trim(),bairro:$("bai").value.trim(),cidade:$("cid").value.trim(),uf:$("uf").value.trim(),cep:$("cep").value.trim()};
  var f=$("foto").files[0];
  if(!t)return er.textContent="Selecione o tipo de lixo descartado.";
  if(!v.rua||!v.num||!v.bairro||!v.cidade)return er.textContent="Preencha rua, número (ou SN), bairro e cidade.";
  if(v.uf.length!==2)return er.textContent="Informe a UF com 2 letras.";
  if(!/^\d{8}$/.test(v.cep))return er.textContent="Informe o CEP com 8 dígitos, sem pontos e traços.";
  if(!f)return er.textContent="Anexe a foto do lixo descartado.";
  if(!$("decl").checked)return er.textContent="Marque a declaração de que as informações são verdadeiras.";
  var btn=e.target.querySelector("button");btn.disabled=true;
  lerFoto(f).then(function(ft){
    return save({tipo:t.value,rua:v.rua,num:v.num,bairro:v.bairro,cidade:v.cidade,uf:v.uf,cep:v.cep,foto:ft.foto,fotoNome:ft.fotoNome});
  }).then(function(){
    e.target.reset();$("ok").classList.remove("hide");$("fecha").focus();
  }).catch(function(x){er.textContent=(x&&x.message)||"Não foi possível enviar. Tente novamente."}).then(function(){btn.disabled=false});
});
$("fecha").addEventListener("click",function(){$("ok").classList.add("hide")});
// ---------- área do agente fiscal ----------
function abrir(){$("loginBox").classList.add("hide");$("painel").classList.remove("hide");watch()}
function sair(){
  if(pollT){clearInterval(pollT);pollT=null}
  $("painel").classList.add("hide");$("loginBox").classList.remove("hide");$("pwd").value="";
}
$("lgn").addEventListener("submit",function(e){
  e.preventDefault();var er=$("lerr");er.textContent="";
  var m=$("mat").value.replace(/\D/g,""),p=$("pwd").value;
  if(!m||!p)return er.textContent="Informe matrícula e senha.";
  api("/api/login",{method:"POST",body:JSON.stringify({matricula:m,senha:p})})
    .then(function(){$("pwd").value="";abrir()})
    .catch(function(x){er.textContent=(x&&x.message)||"Não foi possível validar o acesso agora."});
});
$("sair").addEventListener("click",function(){api("/api/logout",{method:"POST"}).catch(function(){}).then(sair)});
(function(){var h=document.querySelector(".flt");h.addEventListener("input",applyF);h.addEventListener("change",applyF)})();
$("tb").addEventListener("change",function(e){
  var s=e.target;if(s.tagName==="SELECT"&&s.dataset.id)setStatus(s.dataset.id,s.value).catch(function(){});
});
// ---------- CEP automático (ViaCEP): CEP -> endereço e endereço -> CEP ----------
(function(){
  var VIA="https://viacep.com.br/ws/",reqN=0,cepAuto=false,tmr=null;
  var msg=$("cepmsg"),sel=$("cepsel");
  function aviso(t){msg.textContent=t||""}
  function limpaLista(){sel.classList.add("hide");sel.innerHTML=""}
  function get(u){return fetch(u).then(function(r){if(!r.ok)throw new Error("http");return r.json()})}
  function setCep(c){$("cep").value=String(c).replace(/\D/g,"").slice(0,8);cepAuto=true}

  // CEP -> endereço (o número fica em branco para a pessoa preencher)
  function porCep(){
    var c=$("cep").value;
    limpaLista();
    if(c.length!==8){aviso("");return}
    var n=++reqN;aviso("Buscando endereço...");
    get(VIA+c+"/json/").then(function(d){
      if(n!==reqN)return;
      if(d.erro){aviso("CEP não encontrado. Confira os números ou preencha o endereço.");return}
      if(d.logradouro)$("rua").value=d.logradouro;
      if(d.bairro)$("bai").value=d.bairro;
      if(d.localidade)$("cid").value=d.localidade;
      if(d.uf)$("uf").value=d.uf;
      if(!d.logradouro){aviso("Este CEP não informa a rua. Preencha rua e bairro.");$("rua").focus();return}
      aviso("Endereço preenchido. Informe o número.");
      if(!$("num").value.trim())$("num").focus();
    }).catch(function(){if(n===reqN)aviso("Não foi possível consultar o CEP agora. Preencha o endereço manualmente.")});
  }

  // endereço (UF + cidade + rua) -> CEP
  function porEndereco(){
    var uf=$("uf").value.trim(),cid=$("cid").value.trim(),rua=$("rua").value.trim();
    if($("cep").value&&!cepAuto)return;            // CEP digitado pela pessoa não é sobrescrito
    if(!/^[A-Za-z]{2}$/.test(uf)||cid.length<3||rua.length<3)return;
    var n=++reqN;aviso("Buscando CEP...");limpaLista();
    get(VIA+uf.toUpperCase()+"/"+encodeURIComponent(cid)+"/"+encodeURIComponent(rua)+"/json/").then(function(l){
      if(n!==reqN)return;
      if(!Array.isArray(l)||!l.length){aviso("Nenhum CEP encontrado para este endereço. Digite o CEP.");return}
      if(l.length===1){setCep(l[0].cep);aviso("CEP preenchido automaticamente.");return}
      sel.innerHTML='<option value="">Escolha o CEP da sua rua</option>'+l.map(function(x){
        var c=String(x.cep).replace(/\D/g,"");
        return'<option value="'+c+'">'+c+" - "+esc(x.logradouro)+(x.bairro?" - "+esc(x.bairro):"")+'</option>';
      }).join("");
      sel.classList.remove("hide");
      aviso("Encontramos mais de um CEP. Escolha o seu:");
    }).catch(function(){if(n===reqN)aviso("Não foi possível consultar o CEP agora. Digite o CEP.")});
  }

  function agenda(){clearTimeout(tmr);tmr=setTimeout(porEndereco,800)}
  ["rua","cid","uf"].forEach(function(id){$(id).addEventListener("input",agenda)});
  $("cep").addEventListener("input",function(){cepAuto=false;clearTimeout(tmr);if(this.value.length===8)porCep();else{limpaLista();aviso("")}});
  sel.addEventListener("change",function(){
    if(!sel.value)return;
    setCep(sel.value);
    var o=sel.options[sel.selectedIndex].text.split(" - ");
    if(o[2]&&!$("bai").value.trim())$("bai").value=o[2];
    limpaLista();aviso("CEP preenchido automaticamente.");
  });
  $("frm").addEventListener("reset",function(){clearTimeout(tmr);reqN++;cepAuto=false;limpaLista();aviso("")});
})();
api("/api/me").then(abrir).catch(function(){});
})();
