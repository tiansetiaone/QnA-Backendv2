const qrcode = require('qrcode');
const testQR = 'Sample QR Code Data';

qrcode.toDataURL(testQR, (err, url) => {
    if (err) {
        console.error('QR Code generation failed:', err);
    } else {
        console.log('QR Code generated successfully:', url);
    }
});
