const client = require('../config/twilio'); // Konfigurasi Twilio

async function testTwilio() {
    try {
        const response = await client.messages.create({
            body: 'Test Message',
            from: 'whatsapp:+14155238886',
            to: 'whatsapp:+6285724498827',
        });
        console.log('Pesan terkirim:', response.sid);
    } catch (error) {
        console.error('Gagal mengirim pesan:', error.message);
    }
}

testTwilio();
