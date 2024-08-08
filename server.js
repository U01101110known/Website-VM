const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const tmp = require("tmp");
const app = express();
const port = 3000;

// Set up EJS as the view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up multer with temporary storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create a temporary directory for storing the file
    tmp.dir({ keep: true }, (err, directory) => {
      if (err) return cb(err);
      cb(null, directory);
    });
  },
  filename: function (req, file, cb) {
    // Keep original file name
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// Serve index page
app.get("/", (req, res) => {
  res.render("index");
});

// Serve the list of uploaded ISOs
app.get("/list", (req, res) => {
  const uploadsDir = path.join(__dirname, "uploads");
  let isos = [];

  function readDirSync(dir) {
    fs.readdirSync(dir).forEach((file) => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        const subDirs = fs.readdirSync(filePath);
        subDirs.forEach((subFile) => {
          const subFilePath = path.join(filePath, subFile);
          if (
            fs.statSync(subFilePath).isFile() &&
            subFile === "metadata.json"
          ) {
            const metadata = JSON.parse(fs.readFileSync(subFilePath, "utf8"));
            isos.push({
              name: metadata.osName,
              version: metadata.osVersion,
              description: metadata.description,
              uploader: metadata.uploader,
              filePath: metadata.filePath,
            });
          }
        });
      }
    });
  }

  readDirSync(uploadsDir);

  res.render("list", {
    title: "List of Uploaded ISOs",
    body: `<section>
            <input type="text" id="searchInput" placeholder="Search ISOs" oninput="filterIsos()">
            <button onclick="reloadIsos()">Reload</button>
        </section>
        <ul id="isoList">
            ${isos
              .map(
                (iso) => `
                <li>
                    <h2>${iso.name}</h2>
                    <p><strong>Version:</strong> ${iso.version}</p>
                    <p><strong>Description:</strong> ${iso.description}</p>
                    <p><strong>Uploader:</strong> ${iso.uploader}</p>
                    <a href="${iso.filePath}" download>Download ISO</a>
                </li>
            `
              )
              .join("")}
        </ul>`,
  });
});

// Handle file upload
app.post("/upload", upload.single("isoFile"), (req, res) => {
  // Retrieve and trim the OS name and version from the form
  const osName = req.body.osName ? req.body.osName.trim() : "unknown";
  const osVersion = req.body.osVersion ? req.body.osVersion.trim() : "none";
  const description = req.body.description ? req.body.description.trim() : "";
  const uploader = req.body.uploader ? req.body.uploader.trim() : "unknown";

  // Define paths
  const baseDir = path.join(__dirname, "uploads", osName, osVersion);
  const metadataFilePath = path.join(baseDir, "metadata.json");

  // Ensure directory exists
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // Move file from temp directory to final destination
  const tempFilePath = req.file.path;
  const finalFilePath = path.join(baseDir, req.file.originalname);
  fs.renameSync(tempFilePath, finalFilePath);

  // Save metadata in JSON file
  const metadata = {
    osName: osName,
    osVersion: osVersion,
    description: description,
    uploader: uploader,
    filePath: finalFilePath,
  };

  fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2), "utf8");

  res.status(200).send("File uploaded successfully.");
});

// Start server
app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
