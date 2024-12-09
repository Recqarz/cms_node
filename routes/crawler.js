const express = require("express");

const crawlerRoute = express.Router();
const { getCaseDetailsProcess } = require("../utils/getCaseDetailsProcess.js");

crawlerRoute.post("/standard/ecourt", async (req, res) => {
  const { cnr_number } = req.body;

  if (!cnr_number || !/^[A-Za-z0-9]{16}$/.test(cnr_number)) {
    return res.status(400).json({
      error: "Invalid CNR number. It must be 16 alphanumeric characters long.",
    });
  }

  try {
    const result = await getCaseDetailsProcess(cnr_number);

     return res.status(200).json(result)

  } catch (err) {
    console.log("err::", err);
    res
      .status(500)
      .json({ error: "An unexpected error occurred.", message: err.message });
  }
});

module.exports = { crawlerRoute };
