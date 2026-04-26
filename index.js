const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const SUPABASE_URL = 'https://supabase.co';
const SUPABASE_KEY = 'sb_publishable_-H6KAVzkf8O0Xk9Oao2JUA_6AygHQtP';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let db = { users: {}, messages: [] };

async function loadCloudData() {
    try {
        const { data } = await supabase.from('Basedate').select('content').eq('id', 1).single();
        if (data && data.content) db = data.content;
    } catch (e) { console.error(e); }
}

async function saveCloudData() {
    try { await supabase.from('Basedate').update({ content: db }).eq('id', 1); } catch (e) { console.error(e); }
}

app.use(express.json());

app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>Liquid Glass Chat</title>
    <style>
        :root { --glass: rgba(255, 255, 255, 0.12); --border: rgba(255, 255, 255, 0.18); }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        
        body { 
            background: #000; 
            background-image: radial-gradient(circle at 50% 0%, #333 0%, #000 70%);
            color: #fff; font-family: -apple-system, system-ui, sans-serif; 
            margin: 0; display: flex; height: 100dvh; overflow: hidden; 
            justify-content: center; align-items: center;
        }

        /* АНИМАЦИИ КАПЛИ */
        @keyframes blobIn {
            0% { transform: scale(0.3); opacity: 0; filter: blur(15px); }
            60% { transform: scale(1.1); filter: blur(0px); }
            100% { transform: scale(1); opacity: 1; }
        }

        @keyframes blobOut {
            0% { transform: scale(1); opacity: 1; }
            40% { transform: scale(1.1); }
            100% { transform: scale(0.2); opacity: 0; filter: blur(10px); }
        }

        #auth-screen {
            position: fixed; inset: 0; background: rgba(0,0,0,0.8);
            display: flex; align-items: center; justify-content: center;
            z-index: 1000; backdrop-filter: blur(25px);
        }

        .glass-card {
            background: var(--glass); border: 1px solid var(--border);
            border-radius: 35px; padding: 30px; width: 85%; max-width: 350px;
            animation: blobIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .container {
            display: none; width: 100%; height: 100%; padding: 15px;
            position: relative; overflow: hidden;
        }

        /* Стили панелей */
        .panel {
            position: absolute; inset: 15px;
            background: var(--glass); backdrop-filter: blur(30px);
            border-radius: 40px; border: 1px solid var(--border);
            display: flex; flex-direction: column; padding: 20px;
            transition: 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        #sidebar { z-index: 10; }
        #chat-area { z-index: 20; opacity: 0; transform: scale(0.5); pointer-events: none; }

        /* Состояния выпрыгивания */
        body.chat-active #sidebar { transform: scale(0.5); opacity: 0; pointer-events: none; }
        body.chat-active #chat-area { opacity: 1; transform: scale(1); pointer-events: auto; animation: blobIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }

        body.show-sidebar #sidebar { animation: blobIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
        body.pop-chat #chat-area { animation: blobOut 0.5s cubic-bezier(0.36, 0, 0.66, -0.56) forwards; }

        #messages {
            flex-grow: 1; overflow-y: auto; margin: 15px 0;
            display: flex; flex-direction: column; gap: 10px;
            padding-right: 5px;
        }

        .bubble {
            background: rgba(255,255,255,0.07); padding: 12px 16px;
            border-radius: 22px; max-width: 85%; align-self: flex-start;
            border: 1px solid var(--border);
        }
        .bubble.own { align-self: flex-end; background: #fff; color: #000; border: none; }

        input {
            background: rgba(255,255,255,0.1); border: 1px solid var(--border);
            border-radius: 20px; padding: 15px; color: #fff; outline: none; width: 100%;
        }
        
        button {
            background: #fff; color: #000; border: none; border-radius: 20px;
            padding: 15px; font-weight: bold; cursor: pointer;
        }

        .item {
            padding: 15px; margin-bottom: 10px; border-radius: 20px;
            background: rgba(255,255,255,0.05); cursor: pointer;
        }
    </style>
</head>
<body id="app-body">
    <div id="auth-screen">
        <div class="glass-card">
            <h1 style="text-align: center; margin-bottom: 25px;">Liquid Chat</h1>
            <input type="text" id="nick" placeholder="Username" autocomplete="off">
            <div style="height:10px"></div>
            <input type="password" id="pass" placeholder="Password">
            <div style="height:20px"></div>
            <button onclick="auth()" style="width: 100%;">ACCESS</button>
        </div>
    </div>

    <div class="container" id="main-ui">
        <!-- СПИСОК ЧАТОВ -->
        <div id="sidebar" class="panel">
            <h2 style="margin: 0 0 20px 10px;">Chats</h2>
            <div class="item" onclick="switchChat('global')" style="background: #fff; color: #000; font-weight: bold;">🌏 Global Room</div>
            <div id="friend-list" style="flex-grow:1; overflow-y:auto;"></div>
            <div style="padding-top: 15px;">
                <input type="text" id="snick" placeholder="Find user..." style="margin-bottom:8px;">
                <button onclick="addF()" style="width: 100%;">Add Friend</button>
                <div id="request-list"></div>
            </div>
        </div>

        <!-- ОКНО ЧАТА -->
        <div id="chat-area" class="panel">
            <div style="display:flex; align-items:center; gap:15px; margin-bottom: 10px;">
                <button onclick="closeChat()" style="background: transparent; color: #fff; border: 1px solid var(--border); padding: 10px 15px;">←</button>
                <h3 id="chat-title" style="margin:0;">Global</h3>
            </div>
            <div id="messages"></div>
            <div style="display:flex; gap:10px;">
                <input type="text" id="m" placeholder="Message..." autocomplete="off">
                <button onclick="send()" style="width: 60px;">OK</button>
            </div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io(); let myNick = '', currentChat = 'global';
        const body = document.getElementById('app-body');

        async function auth() {
            const username = document.getElementById('nick').value.trim();
            const password = document.getElementById('pass').value;
            if(!username) return;
            const res = await fetch('/auth', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username, password}) });
            if (res.ok) {
                myNick = username;
                document.getElementById('auth-screen').style.display = 'none';
                document.getElementById('main-ui').style.display = 'block';
                socket.emit('join', myNick); refreshUI(); setInterval(refreshUI, 5000);
            }
        }

        function switchChat(t) { 
            currentChat = t;
            document.getElementById('chat-title').innerText = t === 'global' ? 'Global' : t;
            body.classList.remove('show-sidebar', 'pop-chat');
            body.classList.add('chat-active');
            loadH(); 
        }

        function closeChat() {
            body.classList.add('pop-chat');
            setTimeout(() => {
                body.classList.remove('chat-active', 'pop-chat');
                body.classList.add('show-sidebar');
            }, 400);
        }

        async function refreshUI() {
            const res = await fetch('/user/' + myNick); if(!res.ok) return;
            const user = await res.json();
            const fl = document.getElementById('friend-list'); fl.innerHTML = '';
            (user.friends || []).forEach(f => {
                const div = document.createElement('div'); div.className = 'item';
                div.innerText = '👤 ' + f; div.onclick = () => switchChat(f); fl.appendChild(div);
            });
            const rl = document.getElementById('request-list'); rl.innerHTML = '';
            (user.requests || []).forEach(r => {
                rl.innerHTML += \`<div class="item" style="font-size:12px; border:1px dashed #fff;">\${r} <button onclick="accept('\${r}')" style="padding:5px 10px; border-radius:10px; float:right;">OK</button></div>\`;
            });
        }

        async function loadH() {
            const res = await fetch(\`/history/\${myNick}/\${currentChat}\`); const msgs = await res.json();
            document.getElementById('messages').innerHTML = msgs.map(m => \`
                <div class="bubble \${m.from === myNick ? 'own' : ''}">
                    <div style="font-size: 10px; opacity: 0.5;">\${m.from}</div>
                    \${m.text}
                </div>\`).join('');
            const box = document.getElementById('messages'); box.scrollTop = box.scrollHeight;
        }

        function send() { const i = document.getElementById('m'); if(!i.value.trim()) return; socket.emit('msg', {to:currentChat, text:i.value}); i.value=''; }
        socket.on('msg', () => loadH());
        document.getElementById('m').onkeypress = (e) => { if(e.key==='Enter') send() };
        async function addF() { const t = document.getElementById('snick').value.trim(); await fetch('/add-friend', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({myNick, targetNick:t}) }); alert('Sent!'); }
        async function accept(t) { await fetch('/accept-friend', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({myNick, targetNick:t}) }); refreshUI(); }
    </script>
</body>
</html>
    `);
});

// API (Оставляем без изменений)
app.post('/auth', async (req, res) => {
    const { username, password } = req.body;
    if (!db.users[username]) { db.users[username] = { password, friends: [], requests: [] }; await saveCloudData(); }
    else if (db.users[username].password !== password) return res.status(401).send();
    res.json(db.users[username]);
});
app.get('/user/:nick', (req, res) => res.json(db.users[req.params.nick] || {friends:[], requests:[]}));
app.post('/add-friend', async (req, res) => {
    const { myNick, targetNick } = req.body;
    if (db.users[targetNick]) {
        if (!db.users[targetNick].requests) db.users[targetNick].requests = [];
        if (!db.users[targetNick].requests.includes(myNick)) { db.users[targetNick].requests.push(myNick); await saveCloudData(); }
    }
    res.send();
});
app.post('/accept-friend', async (req, res) => {
    const { myNick, targetNick } = req.body;
    db.users[myNick].requests = (db.users[myNick].requests || []).filter(n => n !== targetNick);
    if(!db.users[myNick].friends) db.users[myNick].friends = [];
    if(!db.users[targetNick].friends) db.users[targetNick].friends = [];
    db.users[myNick].friends.push(targetNick); db.users[targetNick].friends.push(myNick);
    await saveCloudData(); res.send();
});
app.get('/history/:me/:target', (req, res) => {
    const { me, target } = req.params;
    let f = (db.messages || []).filter(m => target === 'global' ? m.to === 'global' : (m.from === me && m.to === target) || (m.from === target && m.to === me));
    res.json(f.slice(-50));
});
io.on('connection', (socket) => {
    socket.on('join', (n) => { socket.join(n); socket.nick = n; });
    socket.on('msg', async (d) => {
        if(!socket.nick || !d.text) return;
        const m = { from: socket.nick, to: d.to, text: d.text };
        db.messages.push(m); if (db.messages.length > 500) db.messages.shift();
        await saveCloudData();
        if (d.to === 'global') io.emit('msg', m); else io.to(d.to).to(socket.nick).emit('msg', m);
    });
});
async function init() {
    await loadCloudData();
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, '0.0.0.0', () => console.log('v7.0 Liquid Glass Live'));
}
init();
