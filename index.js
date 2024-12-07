const express = require('express');
const { crawlerRoute } = require('./routes/crawler');
const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors')
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const getAllCnrDetails = require('./routes/getCnrDetails.route');
const getUnsavedCnrRoute = require('./routes/getUnsavedCnr.route');

connectDB()
app.use(cors());
app.use(bodyParser.json());

app.use("/api", crawlerRoute)
app.use("/api", getAllCnrDetails)
app.use("/api", getUnsavedCnrRoute)

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
