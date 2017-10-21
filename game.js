const WebSocket = require('ws');
const wss = new WebSocket.Server( { port : 4242 } );

const [CONNECT, UPDATE, SHOOT, DAMAGE, SPECTATE, PARTICLE] = [0,1,2,3,4,5];

const pi = Math.PI;
const tau = 2*pi;
const PSIZE = 20;
const R = 625;

var pause = 10;
var colori = 0;

var bullets = [];
var squares = [];
var walls = [];
var spawnTimer = 100;
var bulletSpawnTimer = 100;

function newPacket(type, obj){
	return JSON.stringify({'type': type, 'obj': obj});
}

function newSquare() {
    return {
        x: 0,
        y: 0,
        r: 25,
        v: .5 + Math.random() * .5,
        color: "black",
        theta: Math.random() * tau
    }
}

function newWall(s){
    let timer = 500;
    if (s.color == "black") {
        timer = 200;
        if (Math.random() < .1) {
            s.color = "white";
        }
    }
    return {
        x: s.x,
        y: s.y,
        r: s.r,
        color: s.color,
        theta: s.theta,
        timer: timer
    }
}

function newBullet(){
    let th = Math.random() * tau;
    return {
        x: Math.cos(th) * 1000,
        y: -Math.sin(th) * 1000,
        v: 4 + Math.random(),
        color: "black",
        theta: th + pi,
    }
}

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(data) {
        data = JSON.parse(data);
        if (data.type == CONNECT) {
            ws.name = data.obj.name;
            console.log("Connection:  " + ws._socket.remoteAddress + " " + ws.name);
            let lightness = 40 + Math.floor(Math.random() * 20);
    		let hue = 700 + Math.floor(Math.random() * 30);
    		let color = 'hsl('+colori+','+hue+'%,'+lightness+'%)';
            colori += 137.5;
    		colori %= 360;

            let th = Math.random() * tau;
            ws.p = {};
            ws.p.theta = th;
            ws.p.color = color;
            ws.p.x = 625*Math.cos(th);
            ws.p.y = 625*Math.sin(th);
            ws.p.damage = [];
            ws.send(newPacket(CONNECT, ws.p));
            return;
        } else if (data.type == SPECTATE) {
            console.log("Connection (Spectator):  " + ws._socket.remoteAddress);
            ws.send(newPacket(SPECTATE));
        } else if (data.type == UPDATE) {
            ws.p = data.obj;
        } else if (data.type == SHOOT){
            //console.log(data.obj)
            bullets.push(data.obj);
        }
    });

    ws.on('close', function closing(data) {
        console.log('Disconnect: ' + ws.name);
    });
});

function tick() {
    let ps = [];
    let bs = [];

    wss.clients.forEach(function each(client){
        if (client.p && client.p.damage.length < 3){
            ps.push(client.p);
        }
    });

    spawnTimer --;
    if (spawnTimer <= 0) {
        squares.push(newSquare());
        spawnTimer = 150 + Math.floor(90*Math.random());
    }
    bulletSpawnTimer --;
    if (bulletSpawnTimer <= 0) {
        bullets.push(newBullet());
        bulletSpawnTimer = 10 + Math.floor(30*Math.random());
    }


    for (let i in squares) {
        let s = squares[i];
        if (s.x > 1200 || s.x < -1200 || s.y > 1200 || s.y < -1200) {
            squares.splice(i--, 1);
        }
        if (s.x*s.x + s.y*s.y < R*R){
            s.x += s.v*Math.cos(s.theta);
            s.y -= s.v*Math.sin(s.theta);
        }
        else{
            squares.splice(i--, 1);
            walls.push(newWall(s));
        }
    }
    for (let i in walls) {
        let w = walls[i];
        w.timer --;
        if (w.timer <= 0) {
            walls.splice(i--, 1);
        }
    }



    for (let i in bullets) {
        let b = bullets[i];
        b.x += b.v*Math.cos(b.theta);
        b.y -= b.v*Math.sin(b.theta);
        if (b.x > 1200 || b.x < -1200 || b.y > 1200 || b.y < -1200) {
            bullets.splice(i--, 1);
            continue;
        }
        for (let s of squares){
            let dx = b.x - s.x;
            let dy = b.y - s.y;
            if (dx*dx + dy*dy < s.r*s.r && s.x*s.x + s.y*s.y < R*R) {
                s.color = b.color;
                bullets.splice(i--, 1);
                continue;
            }
        }

        wss.clients.forEach(function each(client){
            if (client.p){
                let dpx = b.x - client.p.x;
                let dpy = b.y + client.p.y;
                if (dpx*dpx + dpy*dpy < PSIZE*PSIZE && b.color !== client.p.color) {
                    client.p.damage.push(b.color);
                    client.send(newPacket(DAMAGE, {color:b.color}));
                    if (client.p.damage.length >= 3) {
                        client.p = null;
                    }
                    bullets.splice(i--, 1);
                }
            }
        });

        bs.push(bullets[i]);
    }

    wss.clients.forEach(function each(client){
        if (client.readyState === WebSocket.OPEN) {
            client.send(newPacket(UPDATE,
                {players: ps, bullets: bs, squares: squares, walls: walls}
            ));
        }
    });
}

var serveInt = setInterval(tick, pause);
