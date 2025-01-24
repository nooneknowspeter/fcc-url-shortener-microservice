require("dotenv").config();
const express = require("express");
const cors = require("cors");

// initialize express app
const app = express();

// do not forget to use a body parsing middleware to handle the post requests. also, you can use the function dns.lookup(host, cb) from the dns core module to verify a submitted url.
const dns = require("dns");
const { URL } = require("url");

const mongoose = require("mongoose");

// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// database connection
mongoose.connect(process.env.MONGOOSE_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
  console.log("successfully connected to mongodb");
});

// url schema and model
const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: Number, required: true, unique: true },
});
const Url = mongoose.model("Url", urlSchema);

// serve static files
app.use("/public", express.static(`${process.cwd()}/public`));

// routes
app.get("/", (req, res) => {
  res.sendFile(process.cwd() + "/views/index.html");
});

// api to create a short url
app.post("/api/shorturl", async (req, res) => {
  const { url } = req.body;

  try {
    const validUrl = new URL(url);

    dns.lookup(validUrl.hostname, async (err) => {
      if (err) return res.json({ error: "invalid url" });

      // check if url already exists in the database
      let existingUrl = await Url.findOne({ original_url: url });
      if (existingUrl) {
        return res.json({
          original_url: existingUrl.original_url,
          short_url: existingUrl.short_url,
        });
      }

      // create a new short url
      const count = await Url.countDocuments();
      const newUrl = new Url({
        original_url: url,
        short_url: count + 1,
      });

      await newUrl.save();
      res.json({
        original_url: newUrl.original_url,
        short_url: newUrl.short_url,
      });
    });
  } catch (err) {
    res.json({ error: "invalid url" });
  }
});

// api to redirect to the original url
app.get("/api/shorturl/:short_url", async (req, res) => {
  const shortUrl = req.params.short_url;

  try {
    const urlDoc = await Url.findOne({ short_url: shortUrl });
    if (!urlDoc) return res.status(404).json({ error: "no short url found" });

    res.redirect(urlDoc.original_url);
  } catch (err) {
    res.status(500).json({ error: "server error" });
  }
});

// listen to the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
