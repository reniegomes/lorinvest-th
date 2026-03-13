import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // SerpApi News Endpoint
  app.get("/api/news", async (req, res) => {
    const { q, gl = "br", hl = "pt" } = req.query;
    const apiKey = process.env.SERPAPI_KEY || "4ba053d1ad55b7657026b48ddd037c0fa5faca3e8a7ed36ac3063b5ac25ed608";

    if (!q) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    try {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.append("engine", "google_news");
      url.searchParams.append("q", q as string);
      url.searchParams.append("gl", gl as string);
      url.searchParams.append("hl", hl as string);
      url.searchParams.append("api_key", apiKey);

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.error) {
        return res.status(500).json({ error: data.error });
      }

      res.json(data);
    } catch (error) {
      console.error("SerpApi Error:", error);
      res.status(500).json({ error: "Failed to fetch news from SerpApi" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
