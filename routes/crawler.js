const express = require("express");

const crawlerRoute = express.Router();
const { getCaseDetailsProcess } = require("../utils/getCaseDetailsProcess.js");
const cnrDetailsCollection = require("../models/cnrDetailsSchema.js");
const UnsaveCnrCollection = require("../models/unsavedCnrSchema.js");

crawlerRoute.post("/crawler/caseDetails", async (req, res) => {
  const { cnr_number, userID } = req.body;

  if(!userID){
    return res
    .status(400)
    .json({
      error:
        "Not a valid userID !",
    });
  }

  if (!cnr_number || !/^[A-Za-z0-9]{16}$/.test(cnr_number)) {
    return res
      .status(400)
      .json({
        error:
          "Invalid CNR number. It must be 16 alphanumeric characters long.",
      });
  }

  try {
    const isCnrNumberFound = await cnrDetailsCollection.findOne({
      cnrNumber: cnr_number,
    });

    console.log("isCnrNumberFound:", isCnrNumberFound)
    if(isCnrNumberFound){
      return res.status(200).json({
        status: true,
        message: `Cnr details already exists for : ${cnr_number}`,
      }); 
    }

    const result = await getCaseDetailsProcess(cnr_number);

    // if(result.status === true){
    //   const savedCnrDetails = new cnrDetailsCollection({
    //     cnrNumber: result.cnr_number,
    //     cnrDetails: result,
    //     userID: userID
    //   })
    //   await savedCnrDetails.save();

    //   res.status(201).json({staus:true, message:`Details saved for : ${result.cnr_number}`, savedData: result})
    // }
    // else{
    //   const isCnrNumberFound = await cnrDetailsCollection.find({cnrNumber:cnr_number });

    //   if(!isCnrNumberFound){
    //     const saveUnsavedCnrNumber =  new UnsaveCnrCollection({
    //       cnrNumber: cnr_number
    //     })

    //     await saveUnsavedCnrNumber.save();
    //     res.status(201).json({staus:true, message:`Unsaved cnr number added : ${result.cnr_number}`, savedData: result})
    //   }

    // }

    if (result.status === true) {
      const savedCnrDetails = new cnrDetailsCollection({
        cnrNumber: result.cnr_number,
        cnrDetails: result,
        userID: userID,
      });
      await savedCnrDetails.save();

      return res.status(201).json({
        status: true,
        message: `Details saved for: ${result.cnr_number}`,
        savedData: result,
      });
    } else {
      const isCnrNumberFound = await cnrDetailsCollection.findOne({
        cnrNumber: cnr_number,
      });

      console.log("------isCnrNumberFound:", isCnrNumberFound)

      if (!isCnrNumberFound) {
        const unsavedCnrExists = await UnsaveCnrCollection.findOne({
          cnrNumber: cnr_number,
        });

        if (!unsavedCnrExists) {
          const saveUnsavedCnrNumber = new UnsaveCnrCollection({
            cnrNumber: cnr_number,
          });

          await saveUnsavedCnrNumber.save();
          return res.status(201).json({
            status: true,
            message: `Unsaved CNR number added: ${cnr_number}`,
            savedData: result,
          });
        } else {
          return res.status(200).json({
            status: false,
            message: `CNR number already exists in unsaved collection: ${cnr_number}`,
          });
        }
      } else {
        return res.status(200).json({
          status: false,
          message: `CNR number already exists in saved collection: ${cnr_number}`,
        });
      }
    }
  } catch (err) {
    console.log("err::", err)
    res.status(500).json({ error: "An unexpected error occurred.",message:err.message });
  }
});

module.exports = { crawlerRoute };
