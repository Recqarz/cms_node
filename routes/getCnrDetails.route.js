const express = require("express");
const cnrDetailsCollection = require("../models/cnrDetailsSchema");

const getAllCnrDetails = express.Router();

getAllCnrDetails.get("/getCnrDetails/:userID", async(req, res) => {
    const {userID} = req.params;
    try{

        const cnrDetails = await cnrDetailsCollection.find({
            userID: userID,
          });
      
          console.log("cnrDetails:", cnrDetails)
          if(cnrDetails){
            return res.status(200).json({
              status: true,
              cnrDetails: cnrDetails,
            }); 
          }else{
            return res.status(200).json({
                status: false,
                messages: `Data not found for userId : ${userID}`,
              });  
          }        

    }catch(err){
        console.log("err:", err)
        res.status(500).json({status: false, message:"Internal server error", err:err.message})
    }
})

module.exports = getAllCnrDetails;