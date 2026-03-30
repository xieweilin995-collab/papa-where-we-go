import {
  buildRealtimePlan,
  resolvePlanningCurrentTime,
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
} from "../../src/lib/planning";

type WeatherStatus = "rain" | "sunny" | "cloudy";

interface Env {
  AMAP_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  GEMINI_API_KEY?: string;
  OPENWEATHER_API_KEY?: string;
}

interface PagesContext<TEnv> {
  request: Request;
  env: TEnv;
}

type PagesFunction<TEnv> = (context: PagesContext<TEnv>) => Response | Promise<Response>;

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
  currentTime?: string;
}

interface PoiQueryContext {
  age?: string;
  weather?: WeatherStatus;
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

const DEFAULT_LOCATION = {
  name: "上海",
  lat: 31.2304,
  lng: 121.4737,
};

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

function isConfiguredKey(value?: string) {
  return Boolean(value && value.trim() !== "" && !value.includes("YOUR_"));
}

async function requestJson<T>(input: string, init: RequestInit = {}, timeoutMs = 5000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      headers: {
        "User-Agent": "papa-where-we-go/0.1.0",
        ...(init.headers || {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
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
  if (!isConfiguredKey(amapKey)) {
    return null;
  }

  const params = new URLSearchParams({
    key: amapKey!,
    location: `${lng},${lat}`,
  });

  try {
    const response = await requestJson<any>(`https://restapi.amap.com/v3/geocode/regeo?${params.toString()}`);
    if (response.status !== "1" || !response.regeocode?.addressComponent) {
      return null;
    }

    const component = response.regeocode.addressComponent;
    const province = component.province || "";
    const city = normalizeAmapCity(component.city, province);
    const district = component.district || component.township || "";

    return {
      city,
      district,
      province,
      formattedAddress: response.regeocode.formatted_address || "",
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

function uniqueStrings(values: string[], limit = values.length) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
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

function sanitizeText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function sanitizeFocusStops(value: unknown, fallbackStops: string[], allowedStops: Set<string>) {
  if (!Array.isArray(value) || value.length === 0) {
    return fallbackStops;
  }

  const sanitized = uniqueStrings(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => allowedStops.has(item)),
    Math.max(2, fallbackStops.length),
  );

  return sanitized.length ? sanitized : fallbackStops;
}

function sanitizeScheduleItems(items: unknown, fallbackItems: PlanItem[]): PlanItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    return fallbackItems;
  }

  return fallbackItems.map((fallbackItem, index) => {
    const candidate = items[index] as { time?: unknown; action?: unknown } | undefined;
    const action =
      typeof candidate?.action === "string" && candidate.action.trim() ? candidate.action.trim() : fallbackItem.action;
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
    const candidate = blocks[index] as { title?: unknown; summary?: unknown; items?: unknown } | undefined;
    return {
      title: typeof candidate?.title === "string" && candidate.title.trim() ? candidate.title.trim() : fallbackBlock.title,
      summary:
        typeof candidate?.summary === "string" && candidate.summary.trim()
          ? candidate.summary.trim()
          : fallbackBlock.summary,
      items: sanitizeScheduleItems(candidate?.items, fallbackBlock.items),
    };
  });
}

function sanitizeScheduleOption(
  option: unknown,
  fallbackOption: ScheduleOption,
  allowedStops: Set<string>,
): ScheduleOption {
  const candidate = (option || {}) as { description?: unknown; blocks?: unknown };

  return {
    id: fallbackOption.id,
    label: fallbackOption.label,
    description: sanitizeText(candidate.description, fallbackOption.description),
    packageHeadline: sanitizeText((candidate as any).packageHeadline, fallbackOption.packageHeadline),
    packageSummary: sanitizeText((candidate as any).packageSummary, fallbackOption.packageSummary),
    focusStops: sanitizeFocusStops((candidate as any).focusStops, fallbackOption.focusStops, allowedStops),
    blocks: sanitizeScheduleBlocks(candidate.blocks, fallbackOption.blocks),
  };
}

function sanitizeScheduleOptions(
  options: unknown,
  fallbackOptions: ScheduleOption[],
  pois: RankedPoi[],
): ScheduleOption[] {
  if (!Array.isArray(options) || options.length === 0) {
    return fallbackOptions;
  }

  const allowedStops = new Set<string>([
    ...pois.map((poi) => poi.name),
    ...fallbackOptions.flatMap((option) => option.focusStops),
  ]);

  return fallbackOptions.map((fallbackOption, index) => {
    const matched =
      options.find((option) => (option as { id?: unknown })?.id === fallbackOption.id) ??
      options[index];
    return sanitizeScheduleOption(matched, fallbackOption, allowedStops);
  });
}

function flattenScheduleBlocks(blocks: ScheduleBlock[]): PlanItem[] {
  return blocks.flatMap((block) =>
    blocks.length > 1
      ? block.items.map((item) => ({ ...item, action: `${block.title} · ${item.action}` }))
      : block.items,
  );
}

interface RefinedScheduleOptionsResult {
  summary?: string;
  scheduleOptions: ScheduleOption[];
}

function reorderRecommendationsByFocusStops(
  recommendations: Array<{ name: string; reason: string; distance: string; lat?: number; lng?: number; address?: string }>,
  scheduleOptions: ScheduleOption[],
) {
  const focusOrder = uniqueStrings(scheduleOptions.flatMap((option) => option.focusStops));
  if (!focusOrder.length) {
    return recommendations;
  }

  const orderMap = new Map(focusOrder.map((name, index) => [name, index]));

  return [...recommendations].sort((left, right) => {
    const leftRank = orderMap.get(left.name) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = orderMap.get(right.name) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
}

async function refineScheduleOptionsWithDeepSeek(
  env: Env,
  context: PlanningContext,
  pois: RankedPoi[],
  fallbackOptions: ScheduleOption[],
): Promise<RefinedScheduleOptionsResult | null> {
  if (!isConfiguredKey(env.DEEPSEEK_API_KEY)) {
    return null;
  }

  const poiDigest = pois
    .slice(0, 6)
    .map(
      (poi, index) =>
        `${index + 1}. ${poi.name} | ${poi.distanceKm.toFixed(1)}km | ${poi.address} | ${poi.types.join("/")}`,
    )
    .join("\n");
  const fallbackDigest = fallbackOptions
    .map(
      (option) =>
        `${option.id}\nlabel: ${option.label}\ndescription: ${option.description}\npackageHeadline: ${option.packageHeadline}\npackageSummary: ${option.packageSummary}\nfocusStops: ${option.focusStops.join("、")}\nleadAction: ${option.blocks[0]?.items[0]?.action || ""}`,
    )
    .join("\n\n");

  const response = await requestJson<any>(
    "https://api.deepseek.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "你是亲子出行规划编辑，只输出 JSON。只能使用给定 POI，不能虚构新地点，必须保持每个方案包的 option id、blocks 数量和每个 block 的 items 数量不变。",
          },
          {
            role: "user",
            content: `
请把整组方案包一起改写得更符合用户当前场景，而不是只润色其中一个版本。

关键要求：
- 如果同时存在 depart-now 和 regular-rhythm：
  - depart-now 必须强调从当前时间出发还能顺利执行的路线
  - regular-rhythm 必须强调白天正常作息或隔天执行时更合适的路线
  - 两套方案尽量不要共用同一个第一站，除非候选池太小确实没有合理替代
- 如果是 weekend：
  - 这是完整的假期亲子方案，不要写成单点推荐
  - packageHeadline 和 focusStops 必须体现多站组合
- 优先选择真正适合亲子遛娃的地点，避免把证券营业部、公寓、纯餐饮、路口这类地点写进 focusStops 或主行程，除非候选池里完全没有别的可用选项

硬约束：
1. 只能使用我提供的 POI 名称，不能虚构新地点。
2. 时间必须是 24 小时制 HH:MM。
3. options 数量、每个 option 的 id 必须和 fallback 完全一致。
4. packageHeadline 不能只写一个地点名，优先写成多站组合。
5. focusStops 只返回真正的地点名数组，不要写解释句子。
6. 文案要自然、具体、可执行，不要提模型、不要提高德、不要解释规则。

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

返回 JSON:
{
  "summary": "一句整体摘要",
  "options": [
    {
      "id": "depart-now或regular-rhythm",
      "description": "一句话说明这套方案为什么适合这个场景",
      "packageHeadline": "多站组合标题",
      "packageSummary": "一句话解释这套组合为什么成立",
      "focusStops": ["地点A", "地点B", "地点C"]
    }
  ]
}
            `,
          },
        ],
        response_format: { type: "json_object" },
      }),
    },
    12000,
  );

  const content = response?.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  const payload = typeof content === "string" ? JSON.parse(content) : content;
  return {
    summary: typeof payload?.summary === "string" && payload.summary.trim() ? payload.summary.trim() : undefined,
    scheduleOptions: sanitizeScheduleOptions(payload?.options, fallbackOptions, pois),
  };
}

async function maybeRefineScheduleOptions(
  env: Env,
  context: PlanningContext,
  pois: RankedPoi[],
  fallbackOptions: ScheduleOption[],
): Promise<RefinedScheduleOptionsResult> {
  const timeoutMs = 10000;
  const timeoutPromise = new Promise<RefinedScheduleOptionsResult | null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    const refined = await Promise.race([
      refineScheduleOptionsWithDeepSeek(env, context, pois, fallbackOptions),
      timeoutPromise,
    ]);
    if (refined) {
      return refined;
    }
  } catch (error) {
    console.warn("DeepSeek schedule refinement failed:", error);
  }

  return { scheduleOptions: fallbackOptions };
}

async function resolveBootstrapRegion(env: Env, lat: number, lng: number, city?: string, province?: string) {
  const amapRegion = await reverseGeocodeWithAmap(lat, lng, env.AMAP_API_KEY);

  return {
    city: amapRegion?.city || city || province || DEFAULT_LOCATION.name,
    district: amapRegion?.district || "",
    province: amapRegion?.province || province || "",
  };
}

async function fetchBootstrapLocation(env: Env): Promise<BootstrapLocationResult | null> {
  const providers = [
    async (): Promise<BootstrapLocationResult | null> => {
      const response = await requestJson<any>("https://ipwho.is/", {}, 4000);

      if (!response?.success || !response.latitude || !response.longitude) {
        return null;
      }

      const lat = Number(response.latitude);
      const lng = Number(response.longitude);
      const region = await resolveBootstrapRegion(env, lat, lng, response.city, response.region);

      return {
        name: buildLocationName(response.city, response.region, response.country),
        lat,
        lng,
        city: region.city,
        district: region.district,
        province: region.province,
        source: "ipwho.is",
      };
    },
    async (): Promise<BootstrapLocationResult | null> => {
      const response = await requestJson<any>("https://ipapi.co/json/", {}, 4000);

      if (response?.error || !response?.latitude || !response?.longitude) {
        return null;
      }

      const lat = Number(response.latitude);
      const lng = Number(response.longitude);
      const region = await resolveBootstrapRegion(env, lat, lng, response.city, response.region);

      return {
        name: buildLocationName(response.city, response.region, response.country_name),
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
    } catch (error) {
      console.warn("Bootstrap Location Provider Error:", error);
    }
  }

  return null;
}

async function fetchAmapPois(
  env: Env,
  lat: number,
  lng: number,
  tripType: TripType,
  duration: string,
  queryContext: PoiQueryContext = {},
  timeout = 1000,
): Promise<RankedPoi[] | null> {
  if (!isConfiguredKey(env.AMAP_API_KEY)) {
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
      keywordGroups.map((keywords) => {
        const params = new URLSearchParams({
          key: env.AMAP_API_KEY!,
          location: `${lng},${lat}`,
          keywords,
          radius: String(radius),
          offset: String(offset),
          page: "1",
          sortrule: duration === "3d2n" ? "weight" : "distance",
        });
        return requestJson<any>(`https://restapi.amap.com/v3/place/around?${params.toString()}`, {}, timeout);
      }),
    );

    const merged = new Map<string, RankedPoi>();

    for (const response of responses) {
      if (response.status !== "1" || !Array.isArray(response.pois)) {
        continue;
      }

      for (const poi of response.pois) {
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
  } catch (error) {
    console.warn("Amap POI Error:", error);
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
    const response = await requestJson<any>(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
        },
        body: query,
      },
      8000,
    );

    return response.elements.flatMap((element: any) => {
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
        fetchFromEndpoint(endpoint).catch((error) => {
          console.warn(`POI API Error on ${endpoint}:`, error);
          throw error;
        }),
      ),
    );
  } catch {
    for (const endpoint of endpoints) {
      try {
        return await fetchFromEndpoint(endpoint);
      } catch (error) {
        console.warn(`POI API Error on ${endpoint}:`, error);
      }
    }
  }

  return [];
}

async function fetchPoisForLocation(
  env: Env,
  lat: number,
  lng: number,
  tripType: TripType,
  duration: string,
  queryContext: PoiQueryContext = {},
  mode: "fast" | "full" = "full",
) {
  const amapPois = await fetchAmapPois(env, lat, lng, tripType, duration, queryContext, mode === "fast" ? 850 : 1500);
  if (amapPois?.length) {
    return filterFamilyFriendlyPois(amapPois);
  }

  if (mode === "fast") {
    return [];
  }

  return filterFamilyFriendlyPois(await fetchOverpassPois(lat, lng));
}

async function handleWeather(request: Request, env: Env) {
  const url = new URL(request.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const apiKey = env.OPENWEATHER_API_KEY;

  if (!lat || !lng) return json({ error: "Missing lat/lng" }, { status: 400 });

  const amapRegion = await reverseGeocodeWithAmap(lat, lng, env.AMAP_API_KEY);
  const cityName = amapRegion?.city || "";
  const districtName = amapRegion?.district || "";
  const provinceName = amapRegion?.province || "";

  if (isConfiguredKey(apiKey)) {
    try {
      const data = await requestJson<any>(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`,
      );
      let weatherStatus: WeatherStatus = "sunny";
      let weatherDesc = "晴";
      const mainCode = data.weather[0].id;
      if (mainCode >= 200 && mainCode < 600) {
        weatherStatus = "rain";
        weatherDesc = "雨";
      } else if (mainCode > 800) {
        weatherStatus = "cloudy";
        weatherDesc = "多云";
      }

      return json({
        temp: Math.round(data.main.temp),
        tempMin: Math.round(data.main.temp_min),
        tempMax: Math.round(data.main.temp_max),
        weather: weatherStatus,
        weatherDesc,
        humidity: data.main.humidity,
        city: cityName || data.name,
        district: districtName,
        province: provinceName,
        source: "openweather",
      });
    } catch (error) {
      console.warn("OpenWeather failed, falling back to Open-Meteo:", error);
    }
  }

  try {
    const data = await requestJson<any>(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code&daily=temperature_2m_min,temperature_2m_max&forecast_days=1`,
    );
    const current = data.current;
    const daily = data.daily;

    if (!current) {
      throw new Error("Open-Meteo response missing current data");
    }

    let weatherStatus: WeatherStatus = "sunny";
    let weatherDesc = "晴";
    const code = current.weather_code;
    if (code >= 51) {
      weatherStatus = "rain";
      weatherDesc = "雨";
    } else if (code >= 1) {
      weatherStatus = "cloudy";
      weatherDesc = "多云";
    }

    return json({
      temp: Math.round(current.temperature_2m),
      tempMin: Math.round(daily?.temperature_2m_min?.[0] ?? current.temperature_2m - 2),
      tempMax: Math.round(daily?.temperature_2m_max?.[0] ?? current.temperature_2m + 2),
      weather: weatherStatus,
      weatherDesc,
      humidity: current.relative_humidity_2m || 50,
      city: cityName || "未知地点",
      district: districtName,
      province: provinceName,
      source: "open-meteo",
    });
  } catch (error) {
    console.error("Weather Fallback Error:", error);
    return json({ error: "Failed to fetch weather from all sources" }, { status: 500 });
  }
}

async function handlePois(request: Request, env: Env) {
  const url = new URL(request.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  if (!lat || !lng) return json({ error: "Missing lat/lng" }, { status: 400 });

  const tripType = url.searchParams.get("tripType") === "weekend" ? "weekend" : "today";
  const duration = String(url.searchParams.get("duration") || (tripType === "today" ? "2h" : "1d"));
  const age = String(url.searchParams.get("age") || "");
  const weather = (url.searchParams.get("weather") === "rain"
    ? "rain"
    : url.searchParams.get("weather") === "cloudy"
      ? "cloudy"
      : "sunny") as WeatherStatus;

  const pois = await fetchPoisForLocation(env, Number(lat), Number(lng), tripType, duration, { age, weather }, "full");
  return json(pois);
}

async function handleGeocode(request: Request, env: Env) {
  const url = new URL(request.url);
  const query = String(url.searchParams.get("q") || "").trim();

  if (!query) {
    return json({ error: "Missing q" }, { status: 400 });
  }

  if (isConfiguredKey(env.AMAP_API_KEY)) {
    try {
      const params = new URLSearchParams({
        key: env.AMAP_API_KEY!,
        address: query,
      });
      const response = await requestJson<any>(`https://restapi.amap.com/v3/geocode/geo?${params.toString()}`);

      if (response.status === "1" && response.geocodes?.length) {
        const firstMatch = response.geocodes[0];
        const [lng, lat] = String(firstMatch.location || "").split(",");
        const city = normalizeAmapCity(firstMatch.city || firstMatch.citycode, firstMatch.province);
        const district = firstMatch.district || "";

        if (lat && lng) {
          return json({
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
    } catch (error) {
      console.warn("Amap Geocode Error:", error);
    }
  }

  try {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      limit: "1",
    });
    const response = await requestJson<any[]>(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {}, 15000);
    const firstMatch = response?.[0];

    if (firstMatch?.lat && firstMatch?.lon) {
      const address = firstMatch.address || {};
      return json({
        name: firstMatch.display_name || query,
        lat: Number(firstMatch.lat),
        lng: Number(firstMatch.lon),
        city: address.city || address.town || address.county || "",
        district: address.city_district || address.suburb || address.borough || "",
        province: address.state || "",
        source: "nominatim",
      });
    }
  } catch (error) {
    console.warn("Nominatim Geocode Error:", error);
  }

  return json(
    {
      error: "Location not found",
      fallback: DEFAULT_LOCATION,
    },
    { status: 404 },
  );
}

async function handleReverseGeocode(request: Request, env: Env) {
  const url = new URL(request.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");

  if (!lat || !lng) {
    return json({ error: "Missing lat/lng" }, { status: 400 });
  }

  const amapResult = await reverseGeocodeWithAmap(lat, lng, env.AMAP_API_KEY);
  if (amapResult) {
    return json({
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
    const params = new URLSearchParams({
      lat,
      lon: lng,
      format: "jsonv2",
    });
    const response = await requestJson<any>(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {}, 8000);
    const address = response?.address || {};

    return json({
      name: response?.display_name || "当前位置",
      lat: Number(lat),
      lng: Number(lng),
      city: address.city || address.town || address.county || "",
      district: address.city_district || address.suburb || address.borough || "",
      province: address.state || "",
      source: "nominatim",
    });
  } catch (error) {
    console.warn("Reverse Geocode Error:", error);
  }

  return json({
    name: "当前位置",
    lat: Number(lat),
    lng: Number(lng),
    source: "fallback",
  });
}

async function handleBootstrapLocation(env: Env) {
  const bootstrapLocation = await fetchBootstrapLocation(env);

  if (bootstrapLocation) {
    return json(bootstrapLocation);
  }

  return json({
    ...DEFAULT_LOCATION,
    source: "fallback",
  });
}

async function handlePlan(request: Request, env: Env) {
  const { location, weather, age, duration, tripType, currentTime } = (await request.json()) as PlanRequestBody;
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

  const context: PlanningContext = {
    tripType: normalizedTripType,
    age: age || "3-6",
    duration: duration || (normalizedTripType === "today" ? "2h" : "1d"),
    locationLabel,
    weather: normalizedWeather,
    district: normalizedTripType === "today" ? location?.district || normalizedWeather.district : undefined,
    currentTime: resolvePlanningCurrentTime(currentTime, new Date()),
  };
  const selectedDuration = duration || (normalizedTripType === "today" ? "2h" : "1d");
  const queryContext = { age: age || "3-6", weather: normalizedWeather.weather };
  const livePois = await fetchPoisForLocation(
    env,
    planningLat,
    planningLng,
    normalizedTripType,
    selectedDuration,
    queryContext,
    "fast",
  );
  const sourcePois = livePois.length
    ? livePois
    : await fetchPoisForLocation(env, planningLat, planningLng, normalizedTripType, selectedDuration, queryContext, "full");
  const rankedPois = rankPoisForTrip(sourcePois, context);
  const candidateLimit = normalizedTripType === "today" ? 5 : 6;
  const candidatePois = selectPlanningCandidates(rankedPois, candidateLimit, context);
  const planningPois = candidatePois.length ? candidatePois : selectPlanningCandidates(rankedPois, candidateLimit);
  const realtimePlan = buildRealtimePlan(context, planningPois);
  const refinedResult = await maybeRefineScheduleOptions(env, context, planningPois, realtimePlan.scheduleOptions);
  realtimePlan.scheduleOptions = refinedResult.scheduleOptions;
  realtimePlan.plan = flattenScheduleBlocks(realtimePlan.scheduleOptions[0].blocks);
  realtimePlan.recommendations = reorderRecommendationsByFocusStops(
    realtimePlan.recommendations,
    realtimePlan.scheduleOptions,
  );
  if (refinedResult.summary) {
    realtimePlan.summary = refinedResult.summary;
  }

  return json({
    ...realtimePlan,
    dataSource: livePois.length ? "amap-live" : sourcePois.length ? "fallback-live" : "none",
    generatedAt: new Date().toISOString(),
    poiCount: planningPois.length,
  });
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const request = context.request;
  const env = context.env;
  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/?/, "");

  try {
    if (route === "weather" && request.method === "GET") {
      return await handleWeather(request, env);
    }
    if (route === "pois" && request.method === "GET") {
      return await handlePois(request, env);
    }
    if (route === "geocode" && request.method === "GET") {
      return await handleGeocode(request, env);
    }
    if (route === "reverse-geocode" && request.method === "GET") {
      return await handleReverseGeocode(request, env);
    }
    if (route === "bootstrap-location" && request.method === "GET") {
      return await handleBootstrapLocation(env);
    }
    if (route === "plan" && request.method === "POST") {
      return await handlePlan(request, env);
    }

    return json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    console.error("Pages Function error:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};
