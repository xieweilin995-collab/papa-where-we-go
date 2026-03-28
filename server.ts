import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import {
  buildRealtimePlan,
  buildScopedLocationLabel,
  filterFamilyFriendlyPois,
  rankPoisForTrip,
  selectPlanningCandidates,
  type PlanItem,
  type PlanningContext,
  type RankedPoi,
  type ScheduleBlock,
  type ScheduleOption,
  type TripType,
} from "./src/lib/planning";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const DEFAULT_LOCATION = {
  name: "上海",
  lat: 31.2304,
  lng: 121.4737,
};

type WeatherStatus = "rain" | "sunny" | "cloudy";

interface PlanRequestBody {
  location?: {
    name?: string;
    lat?: number;
    lng?: number;
    city?: string;
    district?: string;
    province?: string;
  };
  weather?: {
    temp?: number;
    weather?: WeatherStatus;
    city?: string;
    district?: string;
    province?: string;
  };
  age?: string;
  duration?: string;
  tripType?: string;
  pois?: RankedPoi[];
}

interface PoiQueryContext {
  age?: string;
  weather?: WeatherStatus;
}

function buildLocationName(city?: string, region?: string, country?: string) {
  return [country === "China" ? undefined : country, region, city].filter(Boolean).join(" ").trim() || DEFAULT_LOCATION.name;
}

function normalizeAmapCity(value: unknown, fallback?: string) {
  if (Array.isArray(value)) return value[0] || fallback || "";
  if (typeof value === "string" && value.trim()) return value;
  return fallback || "";
}

async function reverseGeocodeWithAmap(lat: string | number, lng: string | number, amapKey?: string) {
  if (!amapKey || amapKey.trim() === "" || amapKey.includes("YOUR_")) {
    return null;
  }

  try {
    const response = await axios.get("https://restapi.amap.com/v3/geocode/regeo", {
      params: {
        key: amapKey,
        location: `${lng},${lat}`,
      },
      timeout: 5000,
    });

    if (response.data.status !== "1" || !response.data.regeocode?.addressComponent) {
      return null;
    }

    const component = response.data.regeocode.addressComponent;
    const province = component.province || "";
    const city = normalizeAmapCity(component.city, province);
    const district = component.district || component.township || "";

    return {
      city,
      district,
      province,
      formattedAddress: response.data.regeocode.formatted_address || "",
    };
  } catch (error) {
    console.warn("Amap Reverse Geocode Error:", error);
    return null;
  }
}

function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function isConfiguredKey(value?: string) {
  return Boolean(value && value.trim() !== "" && !value.includes("YOUR_"));
}

function extractJsonPayload(raw: string) {
  const fencedMatch = raw.match(/```json\s*([\s\S]*?)```/i);
  const source = fencedMatch?.[1] || raw;
  const trimmed = source.trim();
  const objectStart = trimmed.indexOf("{");
  const objectEnd = trimmed.lastIndexOf("}");
  if (objectStart === -1 || objectEnd === -1 || objectEnd <= objectStart) {
    throw new Error("No JSON object found");
  }

  return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
}

function normalizeTimeLabel(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const matched = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!matched) {
    return fallback;
  }

  return `${matched[1].padStart(2, "0")}:${matched[2]}`;
}

function sanitizeScheduleItems(items: unknown, fallbackItems: PlanItem[]): PlanItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    return fallbackItems;
  }

  return fallbackItems.map((fallbackItem, index) => {
    const candidate = items[index];
    const action = typeof candidate?.action === "string" && candidate.action.trim() ? candidate.action.trim() : fallbackItem.action;
    return {
      time: normalizeTimeLabel(candidate?.time, fallbackItem.time),
      action,
    };
  });
}

function sanitizeScheduleBlocks(blocks: unknown, fallbackBlocks: ScheduleBlock[]): ScheduleBlock[] {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return fallbackBlocks;
  }

  return fallbackBlocks.map((fallbackBlock, index) => {
    const candidate = blocks[index];
    return {
      title: typeof candidate?.title === "string" && candidate.title.trim() ? candidate.title.trim() : fallbackBlock.title,
      summary:
        typeof candidate?.summary === "string" && candidate.summary.trim() ? candidate.summary.trim() : fallbackBlock.summary,
      items: sanitizeScheduleItems(candidate?.items, fallbackBlock.items),
    };
  });
}

function sanitizeScheduleOption(option: unknown, fallbackOption: ScheduleOption): ScheduleOption {
  return {
    id: fallbackOption.id,
    label: fallbackOption.label,
    description:
      typeof (option as any)?.description === "string" && (option as any).description.trim()
        ? (option as any).description.trim()
        : fallbackOption.description,
    blocks: sanitizeScheduleBlocks((option as any)?.blocks, fallbackOption.blocks),
  };
}

function flattenScheduleBlocks(blocks: ScheduleBlock[]): PlanItem[] {
  return blocks.flatMap((block) =>
    blocks.length > 1
      ? block.items.map((item) => ({ ...item, action: `${block.title} · ${item.action}` }))
      : block.items,
  );
}

async function refineDepartNowScheduleWithGemini(
  context: PlanningContext,
  pois: RankedPoi[],
  fallbackOption: ScheduleOption,
): Promise<ScheduleOption | null> {
  if (!isConfiguredKey(process.env.GEMINI_API_KEY)) {
    return null;
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const poiDigest = pois
    .slice(0, 5)
    .map(
      (poi, index) =>
        `${index + 1}. ${poi.name} | ${poi.distanceKm.toFixed(1)}km | ${poi.address} | ${poi.types.join("/")}`,
    )
    .join("\n");
  const fallbackDigest = fallbackOption.blocks
    .map(
      (block) =>
        `${block.title} (${block.summary})\n${block.items.map((item) => `- ${item.time} ${item.action}`).join("\n")}`,
    )
    .join("\n\n");

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `
你是亲子出行规划编辑。请只改写“现在出发版”，让它更符合用户点击生成方案的当下时间，不要改写成“正常作息版”。

约束：
1. 只能使用我提供的 POI 名称，不能虚构新地点。
2. 时间必须是 24 小时制 HH:MM。
3. blocks 数量、每个 block 的 items 数量，必须和 fallback 完全一致。
4. 文案要具体、可执行，强调“现在出发更合适怎么走”，不要提模型、不要提高德、不要解释规则。
5. 如果当前时间已经偏晚，要主动缩短野心，优先安排最顺路、最容易落地的点。

用户条件：
- 出行类型: ${context.tripType}
- 孩子年龄: ${context.age}
- 时长: ${context.duration}
- 出发位置: ${context.locationLabel}
- 天气: ${context.weather.weather}, ${context.weather.temp}C
- 当前时间: ${context.currentTime || new Date().toISOString()}

可用 POI：
${poiDigest}

fallback:
${fallbackDigest}

请返回 JSON：
{
  "description": "一句话说明为什么这版更适合现在出发",
  "blocks": [
    {
      "title": "当日或D1",
      "summary": "一句话摘要",
      "items": [
        { "time": "18:30", "action": "..." }
      ]
    }
  ]
}
    `,
  });

  return sanitizeScheduleOption(extractJsonPayload(response.text || ""), fallbackOption);
}

async function refineDepartNowScheduleWithDeepSeek(
  context: PlanningContext,
  pois: RankedPoi[],
  fallbackOption: ScheduleOption,
): Promise<ScheduleOption | null> {
  if (!isConfiguredKey(process.env.DEEPSEEK_API_KEY)) {
    return null;
  }

  const poiDigest = pois
    .slice(0, 5)
    .map(
      (poi, index) =>
        `${index + 1}. ${poi.name} | ${poi.distanceKm.toFixed(1)}km | ${poi.address} | ${poi.types.join("/")}`,
    )
    .join("\n");

  const response = await axios.post(
    "https://api.deepseek.com/v1/chat/completions",
    {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            "你是亲子出行规划编辑，只输出 JSON。只能使用给定 POI，不能虚构新地点，必须保持 blocks 数量和每个 block 的 items 数量不变。",
        },
        {
          role: "user",
          content: `
请把“现在出发版”改写得更符合当前时间，不要改成正常作息版。

- 出行类型: ${context.tripType}
- 孩子年龄: ${context.age}
- 时长: ${context.duration}
- 出发位置: ${context.locationLabel}
- 天气: ${context.weather.weather}, ${context.weather.temp}C
- 当前时间: ${context.currentTime || new Date().toISOString()}

可用 POI：
${poiDigest}

fallback:
${JSON.stringify(fallbackOption)}

返回 JSON:
{
  "description": "一句话说明为什么这版更适合现在出发",
  "blocks": [
    {
      "title": "当日或D1",
      "summary": "一句话摘要",
      "items": [
        { "time": "18:30", "action": "..." }
      ]
    }
  ]
}
          `,
        },
      ],
      response_format: { type: "json_object" },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 4500,
    },
  );

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  return sanitizeScheduleOption(typeof content === "string" ? JSON.parse(content) : content, fallbackOption);
}

async function maybeRefineDepartNowSchedule(
  context: PlanningContext,
  pois: RankedPoi[],
  fallbackOption: ScheduleOption,
): Promise<ScheduleOption> {
  const timeoutMs = 3500;
  const timeoutPromise = new Promise<ScheduleOption | null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    const refined = await Promise.race([
      refineDepartNowScheduleWithDeepSeek(context, pois, fallbackOption),
      timeoutPromise,
    ]);
    if (refined) {
      return refined;
    }
  } catch (error) {
    console.warn("DeepSeek depart-now refine failed:", error);
  }

  try {
    const refined = await Promise.race([
      refineDepartNowScheduleWithGemini(context, pois, fallbackOption),
      timeoutPromise,
    ]);
    if (refined) {
      return refined;
    }
  } catch (error) {
    console.warn("Gemini depart-now refine failed:", error);
  }

  return fallbackOption;
}

interface BootstrapLocationResult {
  name: string;
  lat: number;
  lng: number;
  city?: string;
  district?: string;
  province?: string;
  source: string;
}

async function resolveBootstrapRegion(lat: number, lng: number, city?: string, province?: string) {
  const amapRegion = await reverseGeocodeWithAmap(lat, lng, process.env.AMAP_API_KEY);

  return {
    city: amapRegion?.city || city || province || DEFAULT_LOCATION.name,
    district: amapRegion?.district || "",
    province: amapRegion?.province || province || "",
  };
}

async function fetchBootstrapLocation(): Promise<BootstrapLocationResult | null> {
  const providers = [
    async (): Promise<BootstrapLocationResult | null> => {
      const response = await axios.get("https://ipwho.is/", {
        timeout: 4000,
        headers: {
          "User-Agent": "papa-where-we-go/0.1.0",
        },
      });

      if (!response.data?.success || !response.data?.latitude || !response.data?.longitude) {
        return null;
      }

      const lat = Number(response.data.latitude);
      const lng = Number(response.data.longitude);
      const region = await resolveBootstrapRegion(lat, lng, response.data.city, response.data.region);

      return {
        name: buildLocationName(response.data.city, response.data.region, response.data.country),
        lat,
        lng,
        city: region.city,
        district: region.district,
        province: region.province,
        source: "ipwho.is",
      };
    },
    async (): Promise<BootstrapLocationResult | null> => {
      const response = await axios.get("https://ipapi.co/json/", {
        timeout: 4000,
        headers: {
          "User-Agent": "papa-where-we-go/0.1.0",
        },
      });

      if (response.data?.error || !response.data?.latitude || !response.data?.longitude) {
        return null;
      }

      const lat = Number(response.data.latitude);
      const lng = Number(response.data.longitude);
      const region = await resolveBootstrapRegion(lat, lng, response.data.city, response.data.region);

      return {
        name: buildLocationName(response.data.city, response.data.region, response.data.country_name),
        lat,
        lng,
        city: region.city,
        district: region.district,
        province: region.province,
        source: "ipapi",
      };
    },
  ];

  for (const provider of providers) {
    try {
      const result = await provider();
      if (result) {
        return result;
      }
    } catch (error: any) {
      console.warn("Bootstrap Location Provider Error:", error.response?.status || error.message);
    }
  }

  return null;
}

async function fetchAmapPois(
  lat: number,
  lng: number,
  tripType: TripType,
  duration: string,
  queryContext: PoiQueryContext = {},
  timeout = 1000,
): Promise<RankedPoi[] | null> {
  const amapKey = process.env.AMAP_API_KEY;

  if (!isConfiguredKey(amapKey)) {
    return null;
  }

  const isRainy = queryContext.weather === "rain";
  const isToddler = queryContext.age === "0-3";
  const isBigKid = queryContext.age === "6+";
  const radius =
    tripType === "today"
      ? duration === "half-day" || isBigKid
        ? 12000
        : 7000
      : duration === "3d2n"
        ? 50000
        : duration === "2d1n"
          ? 32000
          : 18000;
  const offset = tripType === "today" ? 20 : duration === "3d2n" ? 40 : 30;
  const keywordGroups =
    tripType === "today"
      ? isRainy || isToddler
        ? [
            "室内|亲子|儿童|博物馆|科技馆|海洋馆|乐园",
            "公园|亲子|游乐|动物园|植物园",
          ]
        : isBigKid || duration === "half-day"
          ? [
              "博物馆|科技馆|海洋馆|遗址|自然|动物园|植物园|乐园",
              "公园|亲子|游乐|湿地|森林",
            ]
          : ["公园|儿童|亲子|游乐|博物馆|动物园|植物园|科技馆"]
      : duration === "3d2n"
        ? [
            "博物馆|博物院|科技馆|动物园|植物园|海洋馆|农场|古城|遗址|乐园",
            "湿地|森林|自然|景区|公园|营地|亲子|游乐",
          ]
        : duration === "2d1n"
          ? ["公园|博物馆|科技馆|动物园|植物园|海洋馆|农场|乐园|自然"]
          : ["公园|儿童|亲子|游乐|博物馆|动物园|植物园|科技馆|自然"];

  try {
    const responses = await Promise.all(
      keywordGroups.map((keywords) =>
        axios.get("https://restapi.amap.com/v3/place/around", {
          params: {
            key: amapKey,
            location: `${lng},${lat}`,
            keywords,
            radius,
            offset,
            page: 1,
            sortrule: duration === "3d2n" ? "weight" : "distance",
          },
          timeout,
        }),
      ),
    );

    const merged = new Map<string, RankedPoi>();

    for (const response of responses) {
      if (response.data.status !== "1" || !Array.isArray(response.data.pois)) {
        continue;
      }

      for (const poi of response.data.pois) {
        const [poiLng, poiLat] = String(poi.location || "").split(",");
        if (!poiLat || !poiLng) {
          continue;
        }

        const name = poi.name || "";
        const key = `${name}:${poi.location}`;
        if (merged.has(key)) {
          continue;
        }

        merged.set(key, {
          name,
          lat: Number(poiLat),
          lng: Number(poiLng),
          rating: Number.parseFloat(poi.biz_ext?.rating) || 4.5,
          address: poi.address || "附近区域",
          types: poi.type?.split(";") || ["point_of_interest"],
          district: poi.adname || "",
          distanceKm: haversineDistanceKm(lat, lng, Number(poiLat), Number(poiLng)),
        });
      }
    }

    return [...merged.values()];
  } catch (error: any) {
    console.warn("Amap POI Error:", error.response?.status || error.message);
    return null;
  }
}

async function fetchOverpassPois(lat: number, lng: number): Promise<RankedPoi[]> {
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

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

  const fetchFromEndpoint = async (endpoint: string) => {
    const response = await axios.post(endpoint, query, { timeout: 8000 });

    return response.data.elements.flatMap((element: any) => {
      const nextLat = Number(element.lat || element.center?.lat);
      const nextLng = Number(element.lon || element.center?.lon);

      if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) {
        return [];
      }

      const tags = element.tags || {};

      return [
        {
          name: tags.name || tags.operator || "未命名场所",
          lat: nextLat,
          lng: nextLng,
          rating: 4.5,
          address: tags["addr:full"] || tags["addr:street"] || "附近区域",
          types: [tags.leisure || tags.amenity || "point_of_interest"].filter(Boolean),
          district: tags["addr:district"] || "",
          distanceKm: haversineDistanceKm(lat, lng, nextLat, nextLng),
        },
      ];
    });
  };

  try {
    return await Promise.any(
      endpoints.map((endpoint) =>
        fetchFromEndpoint(endpoint).catch((error: any) => {
          console.warn(`POI API Error on ${endpoint}:`, error.response?.status || error.message);
          throw error;
        }),
      ),
    );
  } catch {
    for (const endpoint of endpoints) {
      try {
        return await fetchFromEndpoint(endpoint);
      } catch (error: any) {
        console.warn(`POI API Error on ${endpoint}:`, error.response?.status || error.message);
      }
    }
  }

  return [];
}

async function fetchPoisForLocation(
  lat: number,
  lng: number,
  tripType: TripType,
  duration: string,
  queryContext: PoiQueryContext = {},
  mode: "fast" | "full" = "full",
) {
  const amapPois = await fetchAmapPois(lat, lng, tripType, duration, queryContext, mode === "fast" ? 850 : 1500);
  if (amapPois?.length) {
    return filterFamilyFriendlyPois(amapPois);
  }

  if (mode === "fast") {
    return [];
  }

  return filterFamilyFriendlyPois(await fetchOverpassPois(lat, lng));
}

// --- API Routes ---

// 1. Weather API (OpenWeather with Open-Meteo Fallback)
app.get("/api/weather", async (req, res) => {
  const { lat, lng } = req.query;
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!lat || !lng) return res.status(400).json({ error: "Missing lat/lng" });

  // Try Amap for city name if key exists
  const amapKey = process.env.AMAP_API_KEY;
  const amapRegion = await reverseGeocodeWithAmap(String(lat), String(lng), amapKey);
  const cityName = amapRegion?.city || "";
  const districtName = amapRegion?.district || "";
  const provinceName = amapRegion?.province || "";

  // Try OpenWeather first if a valid-looking key exists
  const isValidApiKey = isConfiguredKey(apiKey);
  
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
        district: districtName,
        province: provinceName,
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
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code&daily=temperature_2m_min,temperature_2m_max&forecast_days=1`
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
      tempMin: Math.round(daily?.temperature_2m_min?.[0] ?? current.temperature_2m - 2),
      tempMax: Math.round(daily?.temperature_2m_max?.[0] ?? current.temperature_2m + 2),
      weather: weatherStatus,
      weatherDesc: weatherDesc,
      humidity: current.relative_humidity_2m || 50,
      city: cityName || "未知地点",
      district: districtName,
      province: provinceName,
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
  const tripType = req.query.tripType === "weekend" ? "weekend" : "today";
  const duration = String(req.query.duration || (tripType === "today" ? "2h" : "1d"));
  const age = String(req.query.age || "");
  const weather = (req.query.weather === "rain" ? "rain" : req.query.weather === "cloudy" ? "cloudy" : "sunny") as WeatherStatus;

  const pois = await fetchPoisForLocation(Number(lat), Number(lng), tripType, duration, { age, weather }, "full");
  res.json(pois);
});

// 3. Geocode API (Amap with Nominatim fallback)
app.get("/api/geocode", async (req, res) => {
  const query = String(req.query.q || "").trim();

  if (!query) {
    return res.status(400).json({ error: "Missing q" });
  }

  const amapKey = process.env.AMAP_API_KEY;

  if (amapKey && amapKey.trim() !== "" && !amapKey.includes("YOUR_")) {
    try {
      const response = await axios.get("https://restapi.amap.com/v3/geocode/geo", {
        params: {
          key: amapKey,
          address: query,
        },
      });

      if (response.data.status === "1" && response.data.geocodes?.length) {
        const firstMatch = response.data.geocodes[0];
        const [lng, lat] = String(firstMatch.location || "").split(",");
        const city = normalizeAmapCity(firstMatch.city || firstMatch.citycode, firstMatch.province);
        const district = firstMatch.district || "";

        if (lat && lng) {
          return res.json({
            name: firstMatch.formatted_address || query,
            lat: Number(lat),
            lng: Number(lng),
            city,
            district,
            province: firstMatch.province || city,
            source: "amap",
          });
        }
      }
    } catch (error: any) {
      console.warn("Amap Geocode Error:", error.response?.status || error.message);
    }
  }

  try {
    const response = await axios.get("https://nominatim.openstreetmap.org/search", {
      params: {
        q: query,
        format: "jsonv2",
        limit: 1,
      },
      headers: {
        "User-Agent": "papa-where-we-go/0.1.0",
      },
      timeout: 15000,
    });

    const firstMatch = response.data?.[0];

    if (firstMatch?.lat && firstMatch?.lon) {
      const address = firstMatch.address || {};
      return res.json({
        name: firstMatch.display_name || query,
        lat: Number(firstMatch.lat),
        lng: Number(firstMatch.lon),
        city: address.city || address.town || address.county || "",
        district: address.city_district || address.suburb || address.borough || "",
        province: address.state || "",
        source: "nominatim",
      });
    }
  } catch (error: any) {
    console.warn("Nominatim Geocode Error:", error.response?.status || error.message);
  }

  res.status(404).json({
    error: "Location not found",
    fallback: DEFAULT_LOCATION,
  });
});

app.get("/api/reverse-geocode", async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: "Missing lat/lng" });
  }

  const amapResult = await reverseGeocodeWithAmap(String(lat), String(lng), process.env.AMAP_API_KEY);
  if (amapResult) {
    return res.json({
      name: amapResult.formattedAddress || `${amapResult.city} ${amapResult.district}`.trim() || "当前位置",
      lat: Number(lat),
      lng: Number(lng),
      city: amapResult.city,
      district: amapResult.district,
      province: amapResult.province,
      source: "amap",
    });
  }

  try {
    const response = await axios.get("https://nominatim.openstreetmap.org/reverse", {
      params: {
        lat,
        lon: lng,
        format: "jsonv2",
      },
      headers: {
        "User-Agent": "papa-where-we-go/0.1.0",
      },
      timeout: 8000,
    });

    const address = response.data?.address || {};
    return res.json({
      name: response.data?.display_name || "当前位置",
      lat: Number(lat),
      lng: Number(lng),
      city: address.city || address.town || address.county || "",
      district: address.city_district || address.suburb || address.borough || "",
      province: address.state || "",
      source: "nominatim",
    });
  } catch (error: any) {
    console.warn("Reverse Geocode Error:", error.response?.status || error.message);
  }

  res.json({
    name: "当前位置",
    lat: Number(lat),
    lng: Number(lng),
    source: "fallback",
  });
});

// 4. Bootstrap location API (IP-based approximate location with fallback)
app.get("/api/bootstrap-location", async (_req, res) => {
  const bootstrapLocation = await fetchBootstrapLocation();

  if (bootstrapLocation) {
    return res.json(bootstrapLocation);
  }

  res.json({
    ...DEFAULT_LOCATION,
    source: "fallback",
  });
});

// 5. AI Plan Generation (DeepSeek)
app.post("/api/plan", async (req, res) => {
  const { location, weather, age, duration, tripType } = req.body as PlanRequestBody;
  const normalizedTripType: TripType = tripType === "weekend" ? "weekend" : "today";
  const planningLat = Number(location?.lat) || DEFAULT_LOCATION.lat;
  const planningLng = Number(location?.lng) || DEFAULT_LOCATION.lng;
  const normalizedWeather = {
    temp: Number(weather?.temp) || 24,
    weather: (weather?.weather || "sunny") as WeatherStatus,
    city: weather?.city,
    district: weather?.district,
    province: weather?.province,
  };
  const locationLabel = buildScopedLocationLabel(
    {
      name: location?.name || DEFAULT_LOCATION.name,
      city: location?.city || normalizedWeather.city,
      district: location?.district || normalizedWeather.district,
    },
    normalizedTripType,
  );

  const context = {
    tripType: normalizedTripType,
    age: age || "3-6",
    duration: duration || (normalizedTripType === "today" ? "2h" : "1d"),
    locationLabel,
    weather: normalizedWeather,
    district: normalizedTripType === "today" ? location?.district || normalizedWeather.district : undefined,
    currentTime: new Date().toISOString(),
  };
  const selectedDuration = duration || (normalizedTripType === "today" ? "2h" : "1d");
  const queryContext = { age: age || "3-6", weather: normalizedWeather.weather };
  const livePois = await fetchPoisForLocation(
    planningLat,
    planningLng,
    normalizedTripType,
    selectedDuration,
    queryContext,
    "fast",
  );
  const sourcePois = livePois.length
    ? livePois
    : await fetchPoisForLocation(planningLat, planningLng, normalizedTripType, selectedDuration, queryContext, "full");
  const rankedPois = rankPoisForTrip(
    sourcePois,
    context,
  );
  const candidateLimit = normalizedTripType === "today" ? 5 : 6;
  const candidatePois = selectPlanningCandidates(rankedPois, candidateLimit, context);
  const planningPois = candidatePois.length ? candidatePois : selectPlanningCandidates(rankedPois, candidateLimit);
  const realtimePlan = buildRealtimePlan(context, planningPois);
  const departNowOption = realtimePlan.scheduleOptions.find((option) => option.id === "depart-now");

  if (departNowOption) {
    const refinedDepartNow = await maybeRefineDepartNowSchedule(context, planningPois, departNowOption);
    realtimePlan.scheduleOptions = realtimePlan.scheduleOptions.map((option) =>
      option.id === "depart-now" ? refinedDepartNow : option,
    );
    realtimePlan.plan = flattenScheduleBlocks(refinedDepartNow.blocks);
  }

  res.json({
    ...realtimePlan,
    dataSource: livePois.length ? "amap-live" : sourcePois.length ? "fallback-live" : "none",
    generatedAt: new Date().toISOString(),
    poiCount: planningPois.length,
  });
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
