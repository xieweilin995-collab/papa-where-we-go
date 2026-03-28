import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// --- API Routes ---

// 1. Weather API (OpenWeather with Open-Meteo Fallback)
app.get("/api/weather", async (req, res) => {
  const { lat, lng } = req.query;
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!lat || !lng) return res.status(400).json({ error: "Missing lat/lng" });

  // Try Amap for city name if key exists
  const amapKey = process.env.AMAP_API_KEY;
  let cityName = "";
  if (amapKey && amapKey.trim() !== "" && !amapKey.includes("YOUR_")) {
    try {
      const amapRes = await axios.get(
        `https://restapi.amap.com/v3/geocode/regeo?key=${amapKey}&location=${lng},${lat}`
      );
      if (amapRes.data.status === "1") {
        const component = amapRes.data.regeocode.addressComponent;
        cityName = component.city || component.province;
        if (Array.isArray(cityName)) cityName = cityName[0];
        // If city is empty (like in municipalities), use province
        if (!cityName || cityName === "" || (typeof cityName === "object" && Object.keys(cityName).length === 0)) {
          cityName = component.province;
        }
      }
    } catch (e) {
      console.error("Amap Reverse Geocode Error:", e);
    }
  }

  // Try OpenWeather first if a valid-looking key exists
  const isValidApiKey = apiKey && apiKey.trim() !== "" && !apiKey.includes("YOUR_");
  
  if (isValidApiKey) {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`
      );
      const data = response.data;
      let weatherStatus: "sunny" | "cloudy" | "rain" = "sunny";
      let weatherDesc = "晴";
      const mainCode = data.weather[0].id;
      if (mainCode >= 200 && mainCode < 600) {
        weatherStatus = "rain";
        weatherDesc = "雨";
      } else if (mainCode > 800) {
        weatherStatus = "cloudy";
        weatherDesc = "多云";
      } else if (mainCode === 800) {
        weatherStatus = "sunny";
        weatherDesc = "晴";
      }

      return res.json({
        temp: Math.round(data.main.temp),
        tempMin: Math.round(data.main.temp_min),
        tempMax: Math.round(data.main.temp_max),
        weather: weatherStatus,
        weatherDesc: weatherDesc,
        humidity: data.main.humidity,
        city: cityName || data.name,
        source: "openweather"
      });
    } catch (error: any) {
      // If 401 (Unauthorized), it usually means the key is invalid or not yet active.
      // We log this as a warning and fall back silently to Open-Meteo.
      if (error.response?.status === 401) {
        console.warn("OpenWeather API key is invalid or inactive. Falling back to Open-Meteo.");
      } else {
        console.error("OpenWeather Error:", error.response?.status || error.message);
      }
    }
  }

  // Fallback to Open-Meteo (Free, No Key)
  try {
    const response = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
    );
    const current = response.data.current;
    const daily = response.data.daily;
    
    if (!current) {
      throw new Error("Open-Meteo response missing current data");
    }

    let weatherStatus: "sunny" | "cloudy" | "rain" = "sunny";
    let weatherDesc = "晴";
    const code = current.weather_code;
    // WMO Weather interpretation codes (WW)
    if (code >= 51) {
      weatherStatus = "rain";
      weatherDesc = "雨";
    } else if (code >= 1) {
      weatherStatus = "cloudy";
      weatherDesc = "多云";
    } else {
      weatherStatus = "sunny";
      weatherDesc = "晴";
    }

    res.json({
      temp: Math.round(current.temperature_2m),
      tempMin: daily ? Math.round(daily.temperature_2m_min[0]) : Math.round(current.temperature_2m - 2),
      tempMax: daily ? Math.round(daily.temperature_2m_max[0]) : Math.round(current.temperature_2m + 5),
      weather: weatherStatus,
      weatherDesc: weatherDesc,
      humidity: current.relative_humidity_2m || 50,
      city: cityName || "未知地点",
      source: "open-meteo"
    });
  } catch (error) {
    console.error("Weather Fallback Error:", error);
    res.status(500).json({ error: "Failed to fetch weather from all sources" });
  }
});

// 2. POI API (Amap with Overpass Fallback)
app.get("/api/pois", async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: "Missing lat/lng" });

  const amapKey = process.env.AMAP_API_KEY;

  // Try Amap first
  if (amapKey && amapKey.trim() !== "" && !amapKey.includes("YOUR_")) {
    try {
      // Amap Around Search: types for parks, playgrounds, kids-friendly spots
      // Types: 060500 (Park), 060600 (Playground), 141202 (Children's Park), 141204 (Amusement Park)
      const response = await axios.get(
        `https://restapi.amap.com/v3/place/around?key=${amapKey}&location=${lng},${lat}&types=060500|060600|141202|141204&radius=2000&offset=20&page=1&sortrule=distance`
      );

      if (response.data.status === "1" && response.data.pois) {
        const pois = response.data.pois.map((p: any) => ({
          name: p.name,
          lat: parseFloat(p.location.split(",")[1]),
          lng: parseFloat(p.location.split(",")[0]),
          rating: parseFloat(p.biz_ext?.rating) || 4.5,
          address: p.address || "附近区域",
          types: p.type?.split(";") || ["point_of_interest"],
        }));
        return res.json(pois);
      }
    } catch (error: any) {
      console.warn("Amap POI Error:", error.message);
    }
  }

  // Fallback to Overpass API
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
  ];

  // Search for playground, park, kids_cafe (amenity=cafe + kids), etc.
  // Reduced radius to 2000m to decrease server load and timeout risk.
  const query = `
    [out:json][timeout:15];
    (
      nwr["leisure"="playground"](around:2000, ${lat}, ${lng});
      nwr["leisure"="park"](around:2000, ${lat}, ${lng});
      nwr["leisure"="indoor_play"](around:2000, ${lat}, ${lng});
      nwr["amenity"="kindergarten"](around:2000, ${lat}, ${lng});
    );
    out center 20;
  `;

  for (const endpoint of endpoints) {
    try {
      const response = await axios.post(endpoint, query, { timeout: 30000 });
      
      const pois = response.data.elements.map((el: any) => {
        const tags = el.tags || {};
        return {
          name: tags.name || tags.operator || "未命名场所",
          lat: el.lat || el.center?.lat,
          lng: el.lon || el.center?.lon,
          rating: 4.5, // Overpass doesn't have ratings, defaulting to 4.5
          address: tags["addr:full"] || tags["addr:street"] || "附近区域",
          types: [tags.leisure || tags.amenity || "point_of_interest"].filter(Boolean),
        };
      });

      return res.json(pois);
    } catch (error: any) {
      console.warn(`POI API Error on ${endpoint}:`, error.response?.status || error.message);
      // Continue to next endpoint if this one fails
    }
  }

  // If all endpoints fail, return empty array instead of 500 to keep UI functional
  console.error("All POI API endpoints failed.");
  res.json([]);
});

// 3. AI Plan Generation (DeepSeek)
app.post("/api/plan", async (req, res) => {
  const { location, weather, age, duration, pois } = req.body;
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "DEEPSEEK_API_KEY not configured" });
  }

  try {
    const prompt = `
你是一个亲子出行规划助手。
产品名称：去哪遛娃
请基于以下信息生成一个“遛娃计划”：
- 城市坐标: ${location.lat}, ${location.lng}
- 天气: ${weather.weather}, 温度: ${weather.temp}°C
- 儿童年龄: ${age}
- 可用时间: ${duration}
- POI列表: ${JSON.stringify(pois)}

要求：
1. 输出必须是JSON格式。
2. 包含一个精简的遛娃计划（时间线形式，步骤不超过3-4步）。
3. 推荐1-3个地点。
4. 每个地点提供推荐理由。
5. 包含一个“summary”字段，用一段优美、专业、有审美感的话总结这个行程的亮点（约50-80字）。
6. 优先天气适配（如果是雨天或高温，优先室内）。
7. 优先距离。
8. 语气温和、专业、有审美感。

输出格式示例：
{
  "summary": "一段优美的总结文字...",
  "plan": [
    {"time": "14:00", "action": "出发前往XXX"},
    {"time": "15:30", "action": "在XXX游玩"},
    {"time": "17:00", "action": "结束回家"}
  ],
  "recommendations": [
    {
      "name": "地点名称",
      "reason": "推荐理由",
      "distance": "距离"
    }
  ]
}
    `;

    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "You are a helpful assistant that outputs JSON." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    const result = response.data.choices[0].message.content;
    res.json(JSON.parse(result));
  } catch (error) {
    console.error("AI Plan Error:", error);
    res.status(500).json({ error: "Failed to generate plan" });
  }
});

// --- Vite Integration ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
