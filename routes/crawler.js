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

      if(!isCnrNumberFound.userIDs.includes(userID)){
        isCnrNumberFound.userIDs.push(userID)
        await isCnrNumberFound.save();
      }else{
        return res.status(200).json({
          status: true,
          message: `CNR details already uploaded : ${cnr_number}`,
        });
      }

    return res.status(200).json({
        status: true,
        message: `Access granted to CNR details for : ${cnr_number}`,
      }); 
    }else{

   

    const result = await getCaseDetailsProcess(cnr_number);

    if (result.status === true) {
      const savedCnrDetails = new cnrDetailsCollection({
        cnrNumber: result.cnr_number,
        cnrDetails: result,
        userIDs: [userID],
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
      // cnrDetailsCollection

      console.log("------isCnrNumberFound:", isCnrNumberFound)

      if (!isCnrNumberFound) {
        const unsavedCnrExists = await UnsaveCnrCollection.findOne({
          cnrNumber: cnr_number,
        });

        if (!unsavedCnrExists) {
          const saveUnsavedCnrNumber = new UnsaveCnrCollection({
            cnrNumber: cnr_number,
            userIDs: [userID]
          });

          await saveUnsavedCnrNumber.save();
          return res.status(201).json({
            status: true,
            message: `Unsaved CNR number added: ${cnr_number}`,
            savedData: result,
          });
        } else {

          if(!unsavedCnrExists.userIDs.includes(userID)){
            unsavedCnrExists.userIDs.push(userID)
            await unsavedCnrExists.save();
          }
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
  }

  } catch (err) {
    console.log("err::", err)
    res.status(500).json({ error: "An unexpected error occurred.",message:err.message });
  }
});

module.exports = { crawlerRoute };
