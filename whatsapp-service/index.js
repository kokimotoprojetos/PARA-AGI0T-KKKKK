const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcodeStr = require('qrcode-terminal');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

let qrCodeData = null;
let isConnected = false;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }
});

client.on('qr', (qr) => {
  console.log('QR Code recebido. Escaneie-o para conectar:');
  qrcodeStr.generate(qr, { small: true });
  qrCodeData = qr;
});

client.on('ready', () => {
  console.log('Cliente WhatsApp está pronto!');
  isConnected = true;
  qrCodeData = null;
});

client.on('disconnected', () => {
  console.log('Cliente WhatsApp desconectado.');
  isConnected = false;
});

client.initialize();

app.get('/status', (req, res) => {
  res.json({ isConnected, qrCodeData });
});

app.post('/send-message', async (req, res) => {
  const { number, message } = req.body;
  if (!isConnected) {
    return res.status(503).json({ error: 'WhatsApp não está conectado' });
  }

  try {
    const formattedNumber = `${number.replace(/\D/g, '')}@c.us`;
    await client.sendMessage(formattedNumber, message);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`WhatsApp Service rodando na porta ${PORT}`);
});
