const express = require('express');
const { crawlerRoute } = require('./routes/crawler.js');
const app = express();
const PORT = process.env.PORT || 8000;
const cors = require('cors')
const bodyParser = require('body-parser');

app.use(cors());
app.use(bodyParser.json());

app.use("/api", crawlerRoute)

app.get('/api', (req, res) => {
    res.send('Hello World!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
