const puppeteer = require("puppeteer");
const sharp = require("sharp");
const tesseract = require("tesseract.js");
const path = require("path");
const fs = require("fs");
const os = require('os');
const https = require("https");
const { URL } = require("url");
const {uploadFileToS3} = require("./s2")


const retryWithDelay = async (operation, retries = 3, delay = 5000) => {
  while (retries > 0) {
    try {
      return await operation();
    } catch (err) {
      retries -= 1;
      if (retries === 0) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function processCaptcha() {
  let attempts = 8;
  let captchaText = "";
  while (attempts > 0) {
    try {
      // console.log("Processing captcha...");
      const { data: { text } } = await tesseract.recognize("captcha.png", "eng");

      captchaText = text.trim();

      if (captchaText) {
        // console.log(`Captcha text: ${captchaText}`);
        return captchaText;
      } else {
        // console.log("Captcha text is empty. Retrying...");
      }
    } catch (error) {
      // console.error("Error processing captcha:", error);
    }
    attempts--;
    if (attempts > 0) {
      // console.log(`Retrying captcha... (${8 - attempts} attempt(s) left)`);
    } else {
      console.error("Failed to process captcha after multiple attempts.");
    }
  }
  return "";
}


const extractTableData = async (page, tableSelector, isObject = false, isSingleRes = false) => {
  try {
    // Wait for the table element to appear on the page
    const table = await retryWithDelay(async () => {
      await page.waitForSelector(tableSelector, { timeout: 6000 });
      return await page.$(tableSelector);
    }).catch(() => null);

    // If table isn't found, return an empty object or array based on `isObject`
    if (!table) {
      return isObject ? {} : [];
    }

    // Extract rows from the table
    const rows = await page.$$eval(`${tableSelector} tr`, (rows) => {
      return rows.map((row) => {
        const cells = Array.from(row.querySelectorAll("td"));
        return cells.map((cell) => cell.innerText.trim());
      });
    });

    const tableData = isObject ? {} : []; // Initialize data structure based on `isObject`

    for (const rowData of rows) {
      if (rowData.length > 0) {
        if (isObject) {
          // For key-value pairs (assume the row has exactly 2 cells)
          if (rowData.length === 2) {
            tableData[rowData[0]] = rowData[1];
          }
        } else {
          // For array of rows
          if (isSingleRes) {
            tableData.push(rowData[0]); // Only take the first cell
          } else {
            tableData.push(rowData); // Include the entire row
          }
        }
      }
    }

    return tableData;
  } catch (error) {
    console.error(`Error extracting table data for selector "${tableSelector}":`, error.message);
    return isObject ? {} : [];
  }
};

// Function to create directory structure
function createDirectoryStructure(basePath, cnrNumber) {
  const intrimFolder = path.join(basePath, "intrim_orders");
  if (!fs.existsSync(intrimFolder)) {
    fs.mkdirSync(intrimFolder, { recursive: false });
  }

  const cnrDirectory = path.join(intrimFolder, cnrNumber);
  if (!fs.existsSync(cnrDirectory)) {
    fs.mkdirSync(cnrDirectory, { recursive: true });
    return { cnrDirectory, cnrExists: false };
  }
  return { cnrDirectory, cnrExists: true };
}

// Function to get existing order files
function getExistingOrderFiles(cnrDirectory) {
  return fs.readdirSync(cnrDirectory).filter((file) => file.endsWith(".pdf"));
}

const downloadPdf = (url, outputPath, cookies) => {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      headers: {
        Cookie: cookies,
      },
    };

    const file = fs.createWriteStream(outputPath);
    https
      .get(url, requestOptions, (response) => {
        if (response.statusCode === 200) {
          response.pipe(file);
          file.on("finish", () => {
            file.close(resolve);
          });
        } else {
          reject(new Error(`Failed to download file: ${response.statusCode}`));
        }
      })
      .on("error", (err) => {
        fs.unlink(outputPath, () => reject(err));
      });
  });
};

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

const extractTableDataCase2 = async (page, tableSelector) => {
  try {
    // Wait for the table element to appear on the page
    const table = await retryWithDelay(async () => {
      await page.waitForSelector(tableSelector, { timeout: 10000 });
      return await page.$(tableSelector);
    }).catch(() => null);

    // If table isn't found, return an empty object
    if (!table) {
      return {};
    }

    // Extract data from the table
    const data = {};
    const rows = await page.evaluate((tableSelector) => {
      const table = document.querySelector(tableSelector);
      return Array.from(table.querySelectorAll("tr")).map((row) => {
        const cells = Array.from(row.querySelectorAll("th, td"));
        return cells.map((cell) => cell.innerText.trim());
      });
    }, tableSelector);

    // Populate the data object with key-value pairs
    rows.forEach((row) => {
      if (row.length === 2) {
        const key = row[0]; // Header
        const value = row[1]; // Corresponding value
        data[key] = value;
      }
    });

    return data; // Return the populated object
  } catch (error) {
    console.error("Error extracting table data:", error);
    return {};
  }
};


// Utility function to launch Puppeteer with Linux-specific configurations
const launchBrowser = async (headless = true) => {
  let executablePath;

  if (process.platform === "win32") {
    executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  } else if (process.platform === "linux") {
    executablePath = "/usr/bin/google-chrome"; // Adjust if using Chromium

    // Start Xvfb for headless environments
    const { exec } = require("child_process");
    exec("Xvfb :99 -screen 0 1280x720x24 &", (err) => {
      if (err) {
        console.error("Error starting Xvfb:", err);
      }
    });

    // Ensure DISPLAY environment variable is set
    process.env.DISPLAY = process.env.DISPLAY || ":99";
  } else if (process.platform === "darwin") {
    executablePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  } else {
    throw new Error("Unsupported operating system");
  }
  return puppeteer.launch({
    headless,
    executablePath,
    // userDataDir,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-popup-blocking",
      "--disable-dev-shm-usage",
       '--headless',  // Ensure headless mode is enforced

    ],
  });
};


const getCaseDetailsProcess = async (cnrNumber) => {
  let browser; 

  try {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'puppeteer-profile-'));
    // browser=await puppeteer.launch({
    //   headless: false, // for deploy
    //   args: [
    //     "--no-sandbox",
    //     "--disable-setuid-sandbox",
    //     "--disable-dev-shm-usage", // Prevents issues in limited memory environments
    //     "--disable-accelerated-2d-canvas",
    //     "--disable-gpu", // Optional, if no GPU is available
    //     "--disable-blink-features=AutomationControlled",
    //     `--user-data-dir=${userDataDir}`,
    //     "--incognito",
    //   ],
    // });

    browser = await launchBrowser(false);

    const page = await browser.newPage();

    // Set a higher navigation timeout for slower network environments
    page.setDefaultNavigationTimeout(60000);

    await page.goto("https://services.ecourts.gov.in/ecourtindia_v6/",{
      waitUntil: "load"
  });

    await page.type("#cino", cnrNumber);

    const invalidCRNMessage = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("body"))
        .some((el) => el.innerText.includes("This Case Code does not exists"));
    });

    if (invalidCRNMessage) {
      console.error("Wrong CRN number.");
      // return { error: "Wrong CRN number. Please check the CRN and try again." };
      return {status: false, message: "Wrong CRN number. Please check the CRN and try again." }
    }

    // console.log("Waiting for captcha to load...");
    await delay(2000); // Wait for 2 seconds

    const captchaImage = await page.$("#captcha_image");
    if (captchaImage) {
      await captchaImage.screenshot({ path: "captcha.png" });
      // console.log("Captcha image captured.");
    } else {
      console.error("Captcha image element not found.");
      return { status: false, message: "Captcha image element not found" };
    }

    // Process the captcha
    let captchaText = await processCaptcha();
    if (!captchaText) {
      console.error("Failed to process captcha. Exiting.");
      return { status: false, message: "Failed to process captcha. Exiting." };
    }

    // console.log(`Captcha text processed: ${captchaText}`);

    await page.type("#fcaptcha_code", captchaText);
    // console.log(`Filled captcha code: ${captchaText}`);

    if (captchaText) {
      // console.log("Waiting for the search button...");
      await page.waitForSelector("#searchbtn", { timeout: 30000 });
      await page.click("#searchbtn");
      const details = {};
      const LinkArr = []

      await delay(3000); // Wait for 3 seconds

      const isInvalidCaptcha = await page.evaluate(() => {
        const errorModal = document.querySelector("#validateError");
        const errorMessage = errorModal ? errorModal.innerText : "";
        return errorMessage.includes("Invalid Captcha...");
      });

      if (isInvalidCaptcha) {
        console.error("Invalid Captcha.");
        return { status: false, message: "Invalid Captcha" };
      }

      const caseDetailsTable = await retryWithDelay(async () => {
        await page.waitForSelector("table.case_details_table", { timeout: 6000 });
        return await page.$("table.case_details_table");
      }).catch(() => null);

      if (caseDetailsTable) {
        const rows = await page.$$eval(
          "table.case_details_table tr",
          (rows) => {
            return rows.map((row) => {
              const cells = row.querySelectorAll("td");
              return Array.from(cells).map((cell) => cell.innerText.trim());
            });
          }
        );
        for (const row of rows) {
          for (let i = 0; i < row.length; i += 2) {
            if (i + 1 < row.length) {
              details[row[i]] = row[i + 1];
            }
          }
        }
      } else {
        await delay(3000);
        const tableSelector = "table.table";
        await page.waitForSelector(tableSelector, { timeout: 5000 });

        // Check if "Case Code" exists in the <th> tags of the table
        const hasCaseCode = await page.evaluate((tableSelector) => {
          const table = document.querySelector(tableSelector);
          if (!table) return false;

          // Check all <th> tags inside the table
          return Array.from(table.querySelectorAll("th")).some((th) =>
            th.textContent.trim().includes("Case Code")
          );
        }, "table.table");

        if (hasCaseCode) {
          const caseDetails = await extractTableDataCase2(
            page,
            "#history_cnr > table.table:first-of-type"
          );
          const acts = await extractTableData(
            page,
            "table.Acts_table",
            false,
            false
          );

          const petitionerAdvocate = await extractTableData(
            page,
            "#history_cnr > table.table:nth-of-type(2)",
            false,
            true
          );

          let petitioner = [];
          petitioner.push(petitionerAdvocate[0]);
          let respondent = [];
          respondent.push(petitionerAdvocate[2]);

          const res = {
            status: true,
            Acts: acts,
            "Case Details": caseDetails,
            "Case History": {},
            "Case Status": {},
            "FIR Details": [],
            "Petitioner and Advocate": petitioner,
            "Respondent and Advocate": respondent,
            Links: LinkArr,
            cnr_number: cnrNumber,
          };

          return res;
        }
        return { status: false, message: "Case Details table not found." };
      }

      await delay(1000);
      const title = await page.evaluate(() => {
        const heading = document.querySelector('h2#chHeading');
        return heading ? heading.textContent.trim() : "Not Available";
      });
      const acts = await extractTableData(page, "table.acts_table", false, false);
      const caseHistory = await extractTableData(page, "table.history_table", false, false);
      const caseStatus = await extractTableData(page, "table.case_status_table", false, false);
      const firDetails = await extractTableData(page, "table.FIR_details_table", true, false);

      const petitionerAdvocate = await extractTableData(page, "table.Petitioner_Advocate_table", false, true);
      const respondentAdvocate = await extractTableData(page, "table.Respondent_Advocate_table", false, true);


      // console.log("Links for order table to load...");
      try {
        await page.waitForSelector(".order_table", { timeout: 10000 }); // 10 sec for order sheet
      } catch (err) {
        console.error("Error: Timeout waiting for order table", err);
        await page.screenshot({ path: "error_screenshot.png" });
        // LinkArr.push("Order Sheet not found !")
      }

      const rows = await page.$$eval(".order_table tr", (rows) =>
        rows.map((row) => row.innerText)
      );

      if (rows.length <= 1){
        // LinkArr.push("Order Sheet not found !")
        // console.log("No orders found for the provided CNR number")
      }
        // throw new Error("No orders found for the provided CNR number.");
  
      let basePath = "./"
      const { cnrDirectory, cnrExists } = createDirectoryStructure(
        basePath,
        cnrNumber
      );
      const existingFiles = getExistingOrderFiles(cnrDirectory);
  
      if (cnrExists && existingFiles.length === rows.length - 1) {
        // console.log(
        //   `CNR number '${cnrNumber}' already exists with all order files.`
        // );
        // return true;
      }
  
      for (let i = 1; i < rows.length; i++) {
        if (existingFiles.length >= i) continue; // Skip already processed files
  
        const row = rows[i].split("\n");
        let orderNumber = row[0] || `${i}`;
        let orderDate = row[1] || "Unknown_Date";
  
        // console.log("Processing order:", orderNumber);
        await delay(5000); // Wait to ensure page is loaded
  
        const orderLink = await page.$(
          `.order_table tr:nth-child(${i + 1}) td:nth-child(3) a`
        );
  
        if (orderLink) {
          // console.log(`Clicking on order link for order ${orderNumber}`);
          await orderLink.click();
  
          try {
            // console.log("Waiting for order modal...");
            await page.waitForSelector("#modal_order_body", { timeout: 30000 });
            await delay(3000);
            const pdfLink = await page.$eval("#modal_order_body object", (obj) =>
              obj.getAttribute("data")
            );
            if (pdfLink) {
              const fullPdfLink = pdfLink.startsWith("http")
                ? pdfLink
                : new URL(
                    pdfLink,
                    "https://services.ecourts.gov.in/ecourtindia_v6/"
                  ).href;
              // console.log(`Full PDF link: ${fullPdfLink}`);
  
              // Define path for saving the downloaded PDF
              const sanitizedOrderNumber = orderNumber.replace(/[^\w\-_.]/g, "_");
              const pdfPath = path.join(
                cnrDirectory,
                `order_${sanitizedOrderNumber}.pdf`
              );
  
              // Get cookies for authentication
              const cookies = (await page.cookies())
                .map((cookie) => `${cookie.name}=${cookie.value}`)
                .join("; ");
  
              // Download the PDF file
              try {
                // console.log(`Downloading PDF for order ${orderNumber}...`);
                await downloadPdf(fullPdfLink, pdfPath, cookies);
                // console.log(`Downloaded order to ${pdfPath}`);
  
                // Upload the downloaded PDF to S3
                const s3Response = await uploadFileToS3(
                  pdfPath,
                  path.basename(pdfPath)
                );
                LinkArr.push(s3Response.Location);
                // console.log(`File uploaded to S3: ${s3Response.Location}`);
              } catch (downloadError) {
                // console.error(
                //   `Error downloading PDF for order ${orderNumber}:`,
                //   downloadError
                // );
              }
  
              await page.waitForSelector(".modal.fade.show", { visible: true });
  
              // Close modal after download
              await page.click(".modal.fade.show .btn-close");
              await page.waitForSelector(".modal.fade.show", { hidden: true });
            } else {
              console.error(`PDF link not found for order ${orderNumber}`);
            }
          } catch (modalError) {
            console.error("Error waiting for the order modal:", modalError);
            await page.screenshot({ path: "modal_error_screenshot.png" });
          }
        } else {
          console.error(`Order link not found for row ${i}`);
        }
      }

      // console.log("LinkArr:::::", LinkArr)

      const res = {
        status: true,
        "CourtPlace": title,
        Acts: acts,
        "Case Details": details,
        "Case History": caseHistory,
        "Case Status": caseStatus,
        "FIR Details": firDetails,
        "Petitioner and Advocate": petitionerAdvocate,
        "Respondent and Advocate": respondentAdvocate,
        "Links": LinkArr,
        cnr_number: cnrNumber,
      };

      return res;
    } else {
      return { status: false, message: "Captcha not found." };
    }
  } catch (err) {
    console.error("Error:", err.message);
    return { staus:false, error: "An unexpected error occurred." };
  } finally {
    await browser.close();
  }
};

module.exports = { getCaseDetailsProcess };

