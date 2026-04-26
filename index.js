const express = require('express');  
const http = require('http');  
const { Server } = require('socket.io');  
  
const app = express();  
const server = http.createServer(app);  
const io = new Server(server);  
  
app.use(express.json());  
  
// Хранилище (очистится при перезагрузке Render)  
let users = {};   
let messages = [];   
  
app.get('/', (req, res) => {  
    res.send(`  
<!DOCTYPE html>  
<html>  
<head>  
    <meta charset="UTF-8">  
    <meta name="viewport" content="width=device-width, initial-scale=1.0">  
    <title>Chat 1997 v2.0</title>  
    <style>  
        body { background: #000; color: #fff; font-family: monospace; margin: 0; display: flex; height: 100vh; overflow: hidden; }  
        #auth-screen { position: fixed; inset: 0; background: #000; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100; padding: 20px; text-align: center; border: 5px double #fff; }  
        #sidebar { width: 220px; border-right: 1px solid #fff; display: flex; flex-direction: column; padding: 10px; flex-shrink: 0; background: #080808; }  
        #chat-area { flex-grow: 1; display: flex; flex-direction: column; padding: 10px; min-width: 0; }  
        #messages { flex-grow: 1; overflow-y: auto; border: 1px solid #fff; margin-bottom: 10px; padding: 10px; font-size: 14px; background: #050505; }  
        input, button { background: #000; color: #fff; border: 1px solid #fff; padding: 10px; margin: 5px 0; outline: none; font-family: monospace; }  
        button { background: #fff; color: #000; cursor: pointer; font-weight: bold; text-transform: uppercase; }  
        button:hover { background: #aaa; }  
        .friend-item { cursor: pointer; padding: 10px; border: 1px solid #444; margin-bottom: 5px; transition: 0.2s; }  
        .active-chat { background: #fff !important; color: #000 !important; font-weight: bold; }  
        .req-item { font-size: 12px; border: 1px dashed #fff; padding: 8px; margin-bottom: 10px; background: #111; }  
        .msg-line { margin-bottom: 8px; line-height: 1.4; border-bottom: 1px solid #111; padding-bottom: 4px; }  
        .msg-line b { color: #aaa; text-transform: uppercase; margin-right: 8px; }  
        @media (max-width: 600px) { #sidebar { width: 120px; font-size: 11px; } }  
    </style>  
</head>  
<body>  
    <div id="auth-screen">  
        <h1 style="letter-spacing: 5px;">CHAT 1997</h1>  
        <p style="color: #666;">-- SECURE VERSION 2.0 --</p>  
        <input type="text" id="nick" placeholder="LOGIN" maxlength="15">  
        <input type="password" id="pass" placeholder="PASSWORD">  
        <button onclick="auth()" style="width: 200px;">CONNECT</button>  
    </div>  
  
    <div id="sidebar">  
        <div class="friend-item active-chat" id="target-global" onclick="switchChat('global')">[#] GLOBAL_HALL</div>  
        <p style="font-size:10px; color:#666; margin-top:20px;">CONTACTS:</p>  
        <div id="friend-list"></div>  
        <hr style="width:100%; border:0; border-top:1px solid #333;">  
        <p style="font-size:10px; color:#666;">SEARCH USER:</p>  
        <input type="text" id="search-nick" placeholder="NICK..." style="width:calc(100% - 22px); font-size:12px;">  
        <button onclick="addFriend()" style="font-size:10px;">SEND REQUEST</button>  
        <div id="request-list"></div>  
    </div>  
  
    <div id="chat-area">  
        <h3 id="chat-title" style="margin:0 0 10px 0; color:#fff; border-bottom: 1px solid #fff;"># GLOBAL_HALL</h3>  
        <div id="messages"></div>  
        <div style="display:flex; gap:5px">  
            <input type="text" id="m" style="flex-grow:1" placeholder="ENTER MESSAGE..." autocomplete="off">  
            <button onclick="send()" id="send-btn">OK</button>  
        </div>  
    </div>  
  
    <script src="/socket.io/socket.io.js"></script>  
    <script>  
        const socket = io();  
        let myNick = '';  
        let currentChat = 'global';  
  
        async function auth() {  
            const username = document.getElementById('nick').value.trim();  
            const password = document.getElementById('pass').value;  
            if(!username) return;  
  
            const res = await fetch('/auth', {  
                method: 'POST',  
                headers: {'Content-Type': 'application/json'},  
                body: JSON.stringify({ username, password })  
            });  
              
            if (res.ok) {  
                const user = await res.json();  
                myNick = username;  
                document.getElementById('auth-screen').style.display = 'none';  
                socket.emit('join', myNick);  
                renderUI(user);  
                loadHistory();  
                setInterval(refreshData, 3000);  
            } else {   
                alert('ACCESS DENIED: INCORRECT PASSWORD FOR THIS NICKNAME');   
            }  
        }  
  
        async function refreshData() {  
            const res = await fetch('/user/' + myNick);  
            if(res.ok) {  
                const user = await res.json();  
                renderUI(user);  
            }  
        }  
  
        function renderUI(user) {  
            const fl = document.getElementById('friend-list');  
            fl.innerHTML = '';  
            user.friends.forEach(f => {  
                const div = document.createElement('div');  
                div.className = 'friend-item' + (currentChat === f ? ' active-chat' : '');  
                div.innerText = f;  
                div.onclick = () => switchChat(f);  
                fl.appendChild(div);  
            });  
  
            const rl = document.getElementById('request-list');  
            rl.innerHTML = user.requests.length ? '<p style="font-size:10px; color:yellow;">NEW REQUESTS:</p>' : '';  
            user.requests.forEach(r => {  
                const div = document.createElement('div');  
                div.className = 'req-item';  
                div.innerHTML = \`FROM: \${r}<br><button onclick="accept('\${r}')" style="padding:2px 5px; font-size:9px; margin-top:5px;">ACCEPT</button>\`;  
                rl.appendChild(div);  
            });  
        }  
  
        function switchChat(target) {  
            currentChat = target;  
            document.getElementById('chat-title').innerText = target === 'global' ? '# GLOBAL_HALL' : '@ PRIVATE: ' + target;  
            document.querySelectorAll('.friend-item').forEach(el => el.classList.remove('active-chat'));  
            if(target === 'global') document.getElementById('target-global').classList.add('active-chat');  
            loadHistory();  
        }  
  
        async function addFriend() {  
            const targetNick = document.getElementById('search-nick').value.trim();  
            if(!targetNick || targetNick === myNick) return;  
            await fetch('/add-friend', {  
                method: 'POST',  
                headers: {'Content-Type': 'application/json'},  
                body: JSON.stringify({ myNick, targetNick })  
            });  
            document.getElementById('search-nick').value = '';  
            alert('SYSTEM: REQUEST SENT TO ' + targetNick);  
        }  
  
        async function accept(targetNick) {  
            await fetch('/accept-friend', {  
                method: 'POST',  
                headers: {'Content-Type': 'application/json'},  
                body: JSON.stringify({ myNick, targetNick })  
            });  
            refreshData();  
        }  
  
        async function loadHistory() {  
            const res = await fetch(\`/history/\${myNick}/\${currentChat}\`);  
            const msgs = await res.json();  
            const box = document.getElementById('messages');  
            box.innerHTML = msgs.map(m => \`<div class="msg-line"><b>\${m.from}:</b> \${m.text}</div>\`).join('');  
            box.scrollTop = box.scrollHeight;  
        }  
  
        function send() {  
            const i = document.getElementById('m');  
            const txt = i.value.trim();  
            if(!txt) return;  
            if(txt.length > 500) { alert('TOO LONG!'); return; }  
            socket.emit('msg', { to: currentChat, text: txt });  
            i.value = '';  
        }  
  
        socket.on('msg', (data) => {  
            const isGlobal = data.to === 'global' && currentChat === 'global';  
            const isPrivate = (data.to === myNick && data.from === currentChat) || (data.from === myNick && data.to === currentChat);  
            if (isGlobal || isPrivate) {  
                const box = document.getElementById('messages');  
                box.innerHTML += \`<div class="msg-line"><b>\${data.from}:</b> \${data.text}</div>\`;  
                box.scrollTop = box.scrollHeight;  
            }  
        });  
  
        document.getElementById('m').onkeypress = (e) => { if(e.key === 'Enter') send() };  
    </script>  
</body>  
</html>  
    `);  
});  
  
// API ЭНДПОИНТЫ  
app.post('/auth', (req, res) => {  
    const { username, password } = req.body;  
    if (!users[username]) {  
        users[username] = { password, friends: [], requests: [] };  
    } else if (users[username].password !== password) {  
        return res.status(401).send();  
    }  
    res.json(users[username]);  
});  
  
app.get('/user/:nick', (req, res) => res.json(users[req.params.nick] || {friends:[], requests:[]}));  
  
app.post('/add-friend', (req, res) => {  
    const { myNick, targetNick } = req.body;  
    if (users[targetNick] && !users[targetNick].friends.includes(myNick)) {  
        if (!users[targetNick].requests.includes(myNick)) users[targetNick].requests.push(myNick);  
    }  
    res.send();  
});  
  
app.post('/accept-friend', (req, res) => {  
    const { myNick, targetNick } = req.body;  
    if (users[myNick] && users[targetNick]) {  
        users[myNick].requests = users[myNick].requests.filter(n => n !== targetNick);  
        if(!users[myNick].friends.includes(targetNick)) users[myNick].friends.push(targetNick);  
        if(!users[targetNick].friends.includes(myNick)) users[targetNick].friends.push(myNick);  
    }  
    res.send();  
});  
  
app.get('/history/:me/:target', (req, res) => {  
    const { me, target } = req.params;  
    let filtered = messages.filter(m =>   
        target === 'global' ? m.to === 'global' :   
        (m.from === me && m.to === target) || (m.from === target && m.to === me)  
    );  
    res.json(filtered.slice(-50));  
});  
  
io.on('connection', (socket) => {  
    socket.on('join', (nick) => { socket.join(nick); socket.nick = nick; });  
    socket.on('msg', (data) => {  
        if(!socket.nick) return;  
        const newMsg = { from: socket.nick, to: data.to, text: data.text };  
        messages.push(newMsg);  
        if (messages.length > 1000) messages.shift();  
          
        if (data.to === 'global') io.emit('msg', newMsg);  
        else io.to(data.to).to(socket.nick).emit('msg', newMsg);  
    });  
});  
  
const PORT = process.env.PORT || 3000;  
server.listen(PORT, '0.0.0.0', () => console.log('v2.0 LIVE')); 
