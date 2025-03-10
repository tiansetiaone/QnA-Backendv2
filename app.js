const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const twilioRoutes = require('./routes/twilioRoutes');

dotenv.config();
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Routing
app.use('/twilio', twilioRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});
