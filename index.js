const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const Lx = 'bedrock_server'
const Wx = Lx + '.exe';
const isWx = process.platform === "win32";
const exe = isWx ? Wx : Lx;

const port = 8000;
const code = 'lts6cloudybridge';
const readline = require('readline');

let p;
let i;

const app = express();
app.use(express.json());

function start() {
    const game = path.join(__dirname, exe);
    const folder = path.dirname(game);

    if (!fs.existsSync(game)) {
        console.error(`${exe} Tidak Ditemukan Di ${folder}...\n`);
        process.exit(1);
    }

    p = spawn(game, [], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    p.stdout.on('data', (data) => {
        console.log(data.toString());

        if (data.toString().includes('Server started.')) {
            console.log(`[ ] Server Ready...\n`);
        }
    });

    p.stderr.on('data', (data) => {
        console.error(`STDERR: ${data.toString()}`);
    });

    p.on('exit', (code) => {
        console.log(`Exit Code -> ${code}.\n`);
        p = null;
    });
};

function stop() {
    p.stdin.write('stop\n');

    p.on('exit', () => {
        console.log(`[ ] Server Dihentikan...\n`);
        p = null;
    });
};

async function reg(n, g) {
    const l = 'players.json';
    const b = 'banned.json';

    const newPlayer = {
        "no": n,
        "gt": g,
        "gt-log": []
    };

    if (!fs.existsSync(l)) {
        const players = [newPlayer];
        return new Promise((resolve) => {
            p.stdin.write(`allowlist add ${g}\n`);
            p.stdout.once('data', (data) => {
                const output = data.toString();
                if (output.includes('Syntax error: Unexpected')) {
                    resolve({ status: 5, player: newPlayer });
                } else {
                    fs.writeFileSync(l, JSON.stringify(players, null, 2));
                    resolve({ status: 1, player: newPlayer });
                }
            });
        });
    }

    try {
        const data = fs.readFileSync(l, 'utf8');
        let players = [];
        let banned = [];
        try {
            players = JSON.parse(data);
            if (fs.existsSync(b)) {
                const bans = fs.readFileSync(b, 'utf8');
                banned = JSON.parse(bans);
                const xPlayer = banned.find(player => player.no === n);
                if (xPlayer) {
                    return { status: 6 }
                }
            }
        } catch (err) {
            console.error(err);
            return { status: 500 };
        }

        const xPlayer = players.find(player => player.no === n);
        const bGT = banned.find(player =>
            player.gt === g || (player['gt-log'] && player['gt-log'].includes(g))
        );
        const claim = players.find(player => player.gt === g && player.no !== n);

        if (bGT) {
            return { status: 7, player: bGT };
        } else if (claim) {
            return { status: 2, player: claim };
        } else if (xPlayer) {
            if (!xPlayer['gt-log']) {
                xPlayer['gt-log'] = [];
            }
            if (xPlayer.gt !== g) {
                xPlayer['gt-log'].unshift(xPlayer.gt);
                xPlayer['gt-log'] = Array.from(new Set(xPlayer['gt-log']));
            }
            xPlayer.gt = g;

            return new Promise((resolve) => {
                p.stdin.write(`allowlist add ${g}\n`);
                p.stdout.once('data', (data) => {
                    const output = data.toString();
                    if (output.includes('Player already in allowlist')) {
                        resolve({ status: 4, player: xPlayer });
                    } else if (output.includes('Syntax error: Unexpected')) {
                        resolve({ status: 5, player: xPlayer });
                    } else {
                        fs.writeFileSync(l, JSON.stringify(players, null, 2));
                        p.stdin.write(`allowlist remove ${xPlayer["gt-log"][0]}\n`);
                        resolve({ status: 3, player: xPlayer });
                    }
                });
            });
        } else {
            return new Promise((resolve) => {
                players.push(newPlayer);
                p.stdin.write(`allowlist add ${g}\n`); p.stdout.once('data', (data) => {
                    const output = data.toString();
                    if (output.includes('Syntax error: Unexpected')) {
                        resolve({ status: 5, player: newPlayer });
                    } else {
                        fs.writeFileSync(l, JSON.stringify(players, null, 2));
                        resolve({ status: 1, player: newPlayer });
                    }
                });
            });
        }
    } catch (err) {
        console.error(err);
        return { status: 500 };
    }
};

async function ban(g) {
    const l = 'players.json';
    const b = 'banned.json';

    if (!fs.existsSync(l)) {
        return { status: 2 };
    }

    try {
        const data = fs.readFileSync(l, 'utf8');
        let players = [];
        let banned = [];
        try {
            players = JSON.parse(data);
            if (fs.existsSync(b)) {
                const bans = fs.readFileSync(b, 'utf8');
                banned = JSON.parse(bans);

                const bGT = banned.find(player =>
                    player.gt === g || (player['gt-log'] && player['gt-log'].includes(g))
                );

                if (bGT) {
                    return { status: 4, player: bGT };
                }
            }
        } catch (err) {
            console.error(err);
            return { status: 500 };
        }

        const xPlayer = players.findIndex(player =>
            player.gt === g || (player['gt-log'] && player['gt-log'].includes(g))
        );

        if (xPlayer === -1) {
            return { status: 3, player: g };
        }

        const [pBan] = players.splice(xPlayer, 1);

        banned.push(pBan);

        try {
            fs.writeFileSync(l, JSON.stringify(players, null, 2), 'utf8');
            fs.writeFileSync(b, JSON.stringify(banned, null, 2), 'utf8');
            p.stdin.write(`allowlist remove ${pBan.gt}\n`);
            return { status: 1, player: pBan };
        } catch (err) {
            console.error(err);
            return { status: 500 };
        }

    } catch (err) {
        console.error(err);
        return { status: 500 };
    }
}


async function unban(g) {
    const l = 'players.json';
    const b = 'banned.json';

    if (!fs.existsSync(l)) {
        return { status: 2 };
    } else if (!fs.existsSync(b)) {
        return { status: 3 };
    }

    try {
        const data = fs.readFileSync(l, 'utf8');
        const bans = fs.readFileSync(b, 'utf8');
        let players = [];
        let banned = [];
        try {
            players = JSON.parse(data);
            banned = JSON.parse(bans);
        } catch (err) {
            console.error(err);
            return { status: 500 };
        }

        const xPlayer = banned.findIndex(player =>
            player.gt === g || (player['gt-log'] && player['gt-log'].includes(g))
        );

        if (xPlayer === -1) {
            return { status: 3, player: g };
        }

        const [pUnban] = banned.splice(xPlayer, 1);

        players.push(pUnban);

        try {
            fs.writeFileSync(l, JSON.stringify(players, null, 2), 'utf8');
            fs.writeFileSync(b, JSON.stringify(banned, null, 2), 'utf8');
            p.stdin.write(`allowlist add ${g}\n`);
            return { status: 1, player: pUnban };
        } catch (err) {
            console.error(err);
            return { status: 500 };
        }

    } catch (err) {
        console.error(err);
        return { status: 500 };
    }
}


app.get('/', (req, res) => {
    res.status(200).send('Online');
});


app.post('/cmd', async (req, res) => {

    const auth = req.headers['auth'];

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    let { no, cmd } = req.body;
    no = no || ip;

    if (auth !== code) {
        console.error(`[ ${no} ] Autentikasi Tidak Valid...\n`);
        res.status(403).send('Forbidden');
    }

    if (!cmd || cmd === "{}") {
        res.status(400).send('Command Tidak Valid...');
    }

    cmd = cmd.trim();
    console.log(`[ ${no} ] </> - ${cmd}\n`);

    if (cmd === 'stop') {
        if (!p) {
            i = '[ ] Server Belum Dijalankan...\n';
            console.log(i);
            res.status(400).send(i);
        } else {
            stop();
            res.status(200).send('OK');
        }
    }

    else if (cmd === 'start') {
        if (!p) {
            start();
            res.status(200).send('OK');
        } else {
            i = '[ ] Server Sudah Dijalankan...\n';
            console.log(i);
            res.status(400).send(i);
        }
    }

    else if (cmd === 'restart') {
        if (!p) {
            i = '[ ] Server Belum Dijalankan...\n';
            console.log(i);
            res.status(400).send(i);
        } else {
            i = '[ ] Memuat Ulang Server...\n';
            console.log(i);
            p.stdin.write('stop\n');
            p.on('exit', () => {
                start();
            });
            res.status(200).send(i);
        }
    }

    else if (cmd.startsWith('reg')) {
        const gt = cmd.slice(4).trim();
        const maxChar = 20;
        if (!p) {
            i = '[ ] Server Belum Dijalankan...\n';
            console.log(i);
            res.status(400).send(i);
        } else if (!gt) {
            res.status(400).send('Masukkan Game Tag...');
        } else if (gt.length > maxChar) {
            res.status(400).send('Game Tag Terlalu Panjang...');
        } else {
            const { status, player } = await reg(no, gt);
            switch (status) {
                case 1:
                    res.status(200).send(`${player.gt} Berhasil Didaftarkan, Selamat Bermain :>`);
                    break;
                case 2:
                    res.status(400).send(`${gt} Sudah Ditautkan Di Player ${player.no}`);
                    break;
                case 3:
                    res.status(200).send(`${player["gt-log"][0]} Diupdate Ke ${gt}...`);
                    break;
                case 4:
                    res.status(400).send(`${gt} Sudah Terdaftar`);
                    break;
                case 5:
                    res.status(400).send(`Game Tag ${gt} Tidak Valid`);
                    break;
                case 6:
                    res.status(400).send('Kamu Dibanned');
                    break;
                case 7:
                    res.status(400).send(`GT ${gt} Tidak Bisa Digunakan Karena Dibanned, Player: ${player.no}`);
                    break;
                default:
                    res.status(500).send('Terjadi Kesalahan, Silakan Coba Lagi...');
                    break;
            }

        }
    }

    else if (cmd.startsWith('ban')) {
        const query = cmd.slice(4).trim();
        const op = query.split(',');
        const gt = op[0]
        let r = op[1] || '';
        if (r) {
            r = 'Karena: ' + r;
            r.trim();
        }

        if (!p) {
            i = '[ ] Server Belum Dijalankan...\n';
            console.log(i);
            res.status(400).send(i);
        } else if (!gt) {
            res.status(400).send('Masukkan Game Tag...');
        } else {
            const { status, player } = await ban(gt);
            switch (status) {
                case 1:
                    res.status(200).send(`Player ${player.no} Dengan GT ${gt} Dibanned\n${r}`);
                    break;
                case 2:
                    res.status(400).send('Belum Ada Member Yang Registrasi');
                    break;
                case 3:
                    res.status(200).send(`${player} Belum Registrasi...`);
                    break;
                case 4:
                    res.status(400).send(`GT ${gt} Sedang Dibanned, Player: ${player.no}`);
                    break;
                default:
                    res.status(500).send('Terjadi Kesalahan, Silakan Coba Lagi...');
                    break;
            }
        }
    }

    else if (cmd.startsWith('unban')) {
        const query = cmd.slice(6).trim();
        const op = query.split(',');
        const gt = op[0]
        let r = op[1] || '';
        if (r) {
            r = 'Karena: ' + r;
            r.trim();
        }

        if (!p) {
            i = '[ ] Server Belum Dijalankan...\n';
            console.log(i);
            res.status(400).send(i);
        } else if (!gt) {
            res.status(400).send('Masukkan Game Tag...');
        } else {
            const { status, player } = await unban(gt);
            switch (status) {
                case 1:
                    res.status(200).send(`Player ${player.no} Dengan GT ${gt} Unbanned, Silahkan Main Kembali, Tetap Patuhi Aturan Group Dan Nasehat Dari Admin !!!\n${r}`);
                    break;
                case 2:
                    res.status(400).send('Belum Ada Player Yang Registrasi');
                    break;
                case 3:
                    res.status(200).send(`${gt} Tidak Sedang Dibanned`);
                    break;
                default:
                    res.status(500).send('Terjadi Kesalahan, Silakan Coba Lagi...');
                    break;
            }
        }
    }

    else if (p && p.stdin) {
        p.stdin.write(`${cmd}\n`);
        p.stdout.once('data', (data) => {
            const output = data.toString();
            if (output.includes('ERROR')) {
                res.status(400).send(output);
            } else {
                res.status(200).send(output);
            }
        });
    } else {
        console.log('[ ] Pastikan Server Start...');
        res.status(500).send(':> Died');
    }
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rl.on('line', async input => {
    if (input.trim() === 'start') {
        if (!p) {
            start();
        } else {
            console.log('[ ] Server Sudah Dijalankan...\n');
        }
    } else if (input.trim() === 'stop') {
        if (!p) {
            console.log('[ ] Server Belum Dijalankan...\n');
        } else {
            stop();
        }
    } else if (input.trim() === 'restart') {
        if (!p) {
            console.log('[ ] Server Belum Dijalankan...\n');
        } else {
            p.stdin.write('stop\n');
            p.on('exit', () => {
                start();
            });
        }
    } else if (input.startsWith('ban')) {
        const query = input.slice(4).trim();
        const op = query.split(',');
        const gt = op[0]
        let r = op[1] || '';
        if (r) {
            r = 'Karena: ' + r;
            r.trim();
        }

        if (!p) {
            console.log('[ ] Server Belum Dijalankan...\n');
        } else if (!gt) {
            console.log('[ ] Masukkan Game Tag...\n');
        } else {
            const { status, player } = await ban(gt);
            switch (status) {
                case 1:
                    console.log(`[ ] Player ${player.no} Dengan GT ${gt} Dibanned\n${r}`);
                    break;
                case 2:
                    console.log('[ ] Belum Ada Member Yang Registrasi\n');
                    break;
                case 3:
                    console.log(`[ ] ${player} Belum Registrasi...\n`);
                    break;
                case 4:
                    console.log(`GT ${gt} Sedang Dibanned, Player: ${player.no}\n`);
                    break;
                default:
                    console.log('[ ] Terjadi Kesalahan...\n');
                    break;
            }
        }
    } else if (input.startsWith('unban')) {
        const query = input.slice(6).trim();
        const op = query.split(',');
        const gt = op[0]
        let r = op[1] || '';
        if (r) {
            r = 'Karena: ' + r;
            r.trim();
        }

        if (!p) {
            console.log('[ ] Server Belum Dijalankan...\n');
        } else if (!gt) {
            console.log('[ ] Masukkan Game Tag...\n');
        } else {
            const { status, player } = await unban(gt);
            switch (status) {
                case 1:
                    console.log(`[ ] Player ${player.no} Dengan GT ${gt} Unbanned, Silahkan Main Kembali, Tetap Patuhi Aturan Group Dan Nasehat Dari Admin !!!\n${r}\n`);
                    break;
                case 2:
                    console.log('[ ] Belum Ada Player Yang Registrasi\n');
                    break;
                case 3:
                    console.log(`[ ] ${gt} Tidak Sedang Dibanned\n`);
                    break;
                default:
                    console.log('[ ] Terjadi Kesalahan...\n');
                    break;
            }
        }
    } else if (input.trim() === 'clear') {
        if (isWx) {
            spawn('cmd', ['/c', 'cls'], { stdio: 'inherit' });
        } else {
            spawn('clear', [], { stdio: 'inherit' });
        }
    } else if (p && p.stdin) {
        p.stdin.write(`${input.trim()}\n`);
    } else {
        console.log(':> Died');
    }
});

app.listen(port, () => {
    console.log(`Cloudy Bridge Ready Di Port ${port}...\n`);
    start();
});