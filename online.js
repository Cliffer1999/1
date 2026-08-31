import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const $=id=>document.getElementById(id);
const esc=(value='')=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const cfg=window.WILD_AUSTRALIA_SUPABASE||{};
let supabase=null,user=null,currentRoom=null,currentPlayer=null,roomChannel=null;

function toast(message){const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),2800);}
function setBackend(kind,title,message){$('backendTitle').textContent=title;$('backendMessage').textContent=message;$('backendChip').textContent=kind.toUpperCase();$('backendChip').className=`status-chip backend-${kind}`;}
function enableLobby(enabled){$('createRoomBtn').disabled=!enabled;$('joinRoomBtn').disabled=!enabled;}
function randomCode(){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from({length:6},()=>alphabet[Math.floor(Math.random()*alphabet.length)]).join('');}

async function init(){
  if(!cfg.url||!cfg.anonKey){setBackend('pending','Realtime backend not connected yet','The Online Multiplayer UI is ready, but this deployment still needs the Supabase project URL and public anon key. Solo and Local modes remain fully playable.');enableLobby(false);return;}
  try{
    supabase=createClient(cfg.url,cfg.anonKey,{auth:{persistSession:true}});
    let {data:{session}}=await supabase.auth.getSession();
    if(!session){const result=await supabase.auth.signInAnonymously();if(result.error)throw result.error;session=result.data.session;}
    user=session.user;setBackend('live','Realtime service connected','Room creation, joining and discussion chat are connected to Supabase Realtime.');enableLobby(true);
  }catch(err){setBackend('error','Could not connect to realtime service',err.message);enableLobby(false);}
}

async function createRoom(){
  if(!supabase||!user)return;
  const name=$('hostName').value.trim().slice(0,24)||'Host';
  try{
    let room=null;
    for(let i=0;i<5&&!room;i++){
      const code=randomCode();
      const {data,error}=await supabase.from('rooms').insert({code,host_user_id:user.id,status:'lobby'}).select().single();
      if(!error)room=data;else if(error.code!=='23505')throw error;
    }
    if(!room)throw new Error('Could not generate a unique room code.');
    const {data:player,error:pError}=await supabase.from('room_players').insert({room_id:room.id,user_id:user.id,name,seat:1}).select().single();if(pError)throw pError;
    currentRoom=room;currentPlayer=player;await enterRoom();
  }catch(err){toast(err.message);}
}

async function joinRoom(){
  if(!supabase||!user)return;
  const name=$('joinName').value.trim().slice(0,24)||'Player',code=$('roomCodeInput').value.trim().toUpperCase();
  if(code.length!==6)return toast('Enter the six-character room code.');
  try{
    const {data:room,error}=await supabase.from('rooms').select('*').eq('code',code).single();if(error)throw new Error('Room not found.');
    const {data:existing}=await supabase.from('room_players').select('*').eq('room_id',room.id).eq('user_id',user.id).maybeSingle();
    if(existing){currentRoom=room;currentPlayer=existing;return enterRoom();}
    const {data:players,error:listError}=await supabase.from('room_players').select('seat').eq('room_id',room.id).order('seat');if(listError)throw listError;
    if(players.length>=10)throw new Error('This room is full.');
    const used=new Set(players.map(p=>p.seat));let seat=1;while(used.has(seat))seat++;
    const {data:player,error:pError}=await supabase.from('room_players').insert({room_id:room.id,user_id:user.id,name,seat}).select().single();if(pError)throw pError;
    currentRoom=room;currentPlayer=player;await enterRoom();
  }catch(err){toast(err.message);}
}

async function enterRoom(){
  $('onlineLobby').classList.add('hidden');$('roomView').classList.remove('hidden');$('roomCodeText').textContent=currentRoom.code;$('roomYouText').textContent=currentPlayer.name;
  await Promise.all([loadRoom(),loadPlayers(),loadMessages()]);subscribeRoom();
}
async function loadRoom(){const {data}=await supabase.from('rooms').select('*').eq('id',currentRoom.id).single();if(data){currentRoom=data;$('roomStatusText').textContent=data.status[0].toUpperCase()+data.status.slice(1);}}
async function loadPlayers(){
  const {data,error}=await supabase.from('room_players').select('*').eq('room_id',currentRoom.id).order('seat');if(error)return toast(error.message);
  $('roomPlayerCount').textContent=`${data.length} / 10`;
  const bySeat=new Map(data.map(p=>[p.seat,p]));$('onlinePlayers').innerHTML=Array.from({length:10},(_,i)=>{const seat=i+1,p=bySeat.get(seat);return p?`<article class="player-card ${p.user_id===user.id?'human-card':''}"><div class="player-head"><div><p class="player-name">${p.user_id===user.id?'⭐ ':''}${esc(p.name)}</p><span class="muted">Connected</span></div><span class="seat">${seat}</span></div><div class="life">❤️ ${p.life??20}</div><div class="status-row"><span class="status-chip">ONLINE</span></div></article>`:`<article class="player-card empty-seat"><div class="player-head"><p class="player-name muted">Waiting for player…</p><span class="seat">${seat}</span></div></article>`;}).join('');
  const isHost=currentRoom.host_user_id===user.id;$('startOnlineBtn').disabled=!(isHost&&data.length===10);$('startOnlineBtn').textContent=isHost?(data.length===10?'Start 10-player game':`Waiting for ${10-data.length} player(s)`):'Waiting for host';
}
async function loadMessages(){const {data,error}=await supabase.from('messages').select('*').eq('room_id',currentRoom.id).order('created_at',{ascending:true}).limit(100);if(error)return toast(error.message);renderMessages(data);}
function renderMessages(messages){$('onlineChat').innerHTML=messages.map(m=>`<div class="chat-line ${m.user_id===user.id?'human':'bot'}"><strong>${esc(m.sender_name)}</strong><span>${esc(m.body)}</span></div>`).join('')||'<p class="muted">Room chat is open. Start the discussion.</p>';$('onlineChat').scrollTop=$('onlineChat').scrollHeight;}
function subscribeRoom(){
  if(roomChannel)supabase.removeChannel(roomChannel);
  roomChannel=supabase.channel(`wild-room-${currentRoom.id}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'room_players',filter:`room_id=eq.${currentRoom.id}`},()=>loadPlayers())
    .on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:`room_id=eq.${currentRoom.id}`},()=>loadMessages())
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'rooms',filter:`id=eq.${currentRoom.id}`},()=>loadRoom())
    .subscribe();
}
async function sendMessage(text){const clean=String(text||'').trim().slice(0,220);if(!clean||!currentRoom||!currentPlayer)return;const {error}=await supabase.from('messages').insert({room_id:currentRoom.id,user_id:user.id,sender_name:currentPlayer.name,body:clean});if(error)toast(error.message);}
async function leaveRoom(){if(!currentRoom||!currentPlayer)return location.href='index.html';try{await supabase.from('room_players').delete().eq('id',currentPlayer.id).eq('user_id',user.id);}finally{location.href='index.html';}}
async function startRoom(){
  if(currentRoom.host_user_id!==user.id)return;
  const {data:players}=await supabase.from('room_players').select('id').eq('room_id',currentRoom.id);if(players.length!==10)return toast('All 10 players must join first.');
  const {error}=await supabase.from('rooms').update({status:'ready'}).eq('id',currentRoom.id).eq('host_user_id',user.id);if(error)return toast(error.message);
  $('onlineGamePanel').innerHTML='<h3>Room ready</h3><p class="muted">All 10 devices are connected. The next backend step is authoritative secret-role assignment and synchronized predation/evolution actions.</p>';
}

$('createRoomBtn').addEventListener('click',createRoom);$('joinRoomBtn').addEventListener('click',joinRoom);$('roomCodeInput').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);});
$('onlineChatForm').addEventListener('submit',e=>{e.preventDefault();sendMessage($('onlineChatInput').value);$('onlineChatInput').value='';});$('leaveRoomBtn').addEventListener('click',leaveRoom);$('startOnlineBtn').addEventListener('click',startRoom);
init();
