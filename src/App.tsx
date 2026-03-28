import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  Navigation,
  MapPin,
  Search,
} from "lucide-react";
import { cn } from "./lib/utils";
import {
  buildFallbackLocationState,
  buildLocationLabel,
  normalizeAutoLocationResult,
  normalizeBootstrapLocationResult,
  normalizeManualLocationResult,
  shouldRestoreSavedLocation,
  shouldReplaceLocation,
  type LocationState,
} from "./lib/location";
import { buildScopedLocationLabel, type TripType } from "./lib/planning";

interface Weather {
  temp: number;
  tempMin?: number;
  tempMax?: number;
  weather: "rain" | "sunny" | "cloudy";
  weatherDesc?: string;
  humidity: number;
  city?: string;
  district?: string;
  province?: string;
  source?: string;
}

interface PlanItem {
  time: string;
  action: string;
}

interface ScheduleBlock {
  title: string;
  summary: string;
  items: PlanItem[];
}

interface ScheduleOption {
  id: "depart-now" | "regular-rhythm";
  label: string;
  description: string;
  blocks: ScheduleBlock[];
}

interface Recommendation {
  name: string;
  reason: string;
  distance: string;
  lat?: number;
  lng?: number;
  address?: string;
}

interface PlanResult {
  summary: string;
  plan: PlanItem[];
  scheduleOptions?: ScheduleOption[];
  notice?: string;
  recommendations: Recommendation[];
  dataSource?: string;
  generatedAt?: string;
  poiCount?: number;
}

interface GeocodeResponse {
  name: string;
  lat: number;
  lng: number;
  city?: string;
  district?: string;
  province?: string;
  source: string;
}

interface ReverseGeocodeResponse extends GeocodeResponse {}

const DEFAULT_WEATHER: Weather = {
  temp: 23,
  tempMin: 20,
  tempMax: 26,
  weather: "sunny",
  humidity: 50,
  city: "上海",
  district: "黄浦区",
  source: "fallback",
};

// --- Constants ---

const COPY_SCHEMES = [
  {
    title: <>周末<br /><span className="text-brand-coral">逃离计划</span></>,
    desc: "暂别繁琐的家务，关掉不停响动的手机。这个周末，只负责和孩子一起大笑。"
  },
  {
    title: <>小小<br /><span className="text-brand-coral">探险家</span></>,
    desc: "世界很大，好奇心是最好的指南针。带上水壶和梦想，出发去发现藏在城市里的秘密。"
  },
  {
    title: <>自然<br /><span className="text-brand-coral">的拥抱</span></>,
    desc: "泥土的味道，草地的触感。让孩子在自然的怀抱中，学会尊重生命，感受万物生长的力量。"
  },
  {
    title: <>创意<br /><span className="text-brand-coral">实验室</span></>,
    desc: "没有标准答案，只有无限可能。在玩耍中碰撞灵感，让每一个奇思妙想都闪闪发光。"
  },
  {
    title: <>成长<br /><span className="text-brand-coral">日记本</span></>,
    desc: "记录下每一次勇敢的迈步，每一个灿烂的笑容。这些平凡的瞬间，终将汇成最动人的成长史诗。"
  },
  {
    title: <>纯真<br /><span className="text-brand-coral">童年</span></>,
    desc: "守护那份最原始的好奇，珍藏那颗最纯净的童心。在陪伴中，我们也重新做回了孩子。"
  }
];

const GridBackground = () => (
  <div className="absolute inset-0 z-[-1] pointer-events-none overflow-hidden h-full">
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{ backgroundImage: "radial-gradient(#2D3436 1px, transparent 1px)", backgroundSize: "60px 60px" }}
    />
  </div>
);

const CarIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 13.1V16c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" />
    <path d="M9 17h6" />
    <circle cx="17" cy="17" r="2" />
  </svg>
);

const LollipopIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="8" r="6" />
    <path d="M12 14v8" />
    <path d="M12 8a3 3 0 0 1 3 3" />
    <path d="M12 8a3 3 0 0 0-3 3" />
  </svg>
);

const Header = ({ step, isScreen2 }: { step: "home" | "result"; isScreen2?: boolean }) => {
  const getIcon = () => {
    if (step === "result") return <LollipopIcon size={24} className="text-brand-coral" />;
    if (isScreen2) return <MapPin size={24} className="text-brand-coral" />;
    return <CarIcon size={24} className="text-brand-coral" />;
  };

  return (
    <header
      className={cn(
        "absolute top-0 left-0 right-0 z-50 px-10 py-10 flex justify-between items-center transition-colors duration-500",
        "text-ink",
      )}
    >
      <div className="flex items-center gap-3 group cursor-pointer">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform",
            "bg-brand-coral/10",
          )}
        >
          {getIcon()}
        </div>
        <div className="flex flex-col">
          <span className={cn("text-[8px] uppercase tracking-[0.4em] font-black", "text-ink/20")}>
            Editorial Guide
          </span>
        </div>
      </div>
      <div
        className={cn(
          "hidden md:flex gap-12 text-[10px] uppercase tracking-[0.4em] font-black",
          "text-ink/10",
        )}
      >
        <span>v2.5 High Fidelity</span>
      </div>
    </header>
  );
};

const CarouselIllustration = () => (
  <div className="relative w-full h-full flex items-center justify-center">
    <div className="relative w-[92%] lg:w-[100%] aspect-square">
      <video
        src="/carousel-reference.mp4"
        className="w-full h-full object-contain"
        autoPlay
        muted
        loop
        playsInline
      />
    </div>
  </div>
);

function buildNavigationUrl(rec: Recommendation, location: LocationState): string {
  if (Number.isFinite(rec.lat) && Number.isFinite(rec.lng)) {
    const fromLabel = encodeURIComponent(location.name || "当前位置");
    const toLabel = encodeURIComponent(rec.name);
    return `https://uri.amap.com/navigation?from=${location.lng},${location.lat},${fromLabel}&to=${rec.lng},${rec.lat},${toLabel}&mode=car&src=去哪遛娃&coordinate=gaode&callnative=0`;
  }

  return `https://www.amap.com/search?query=${encodeURIComponent(rec.name)}`;
}

function getWeatherLabel(weather: Weather | null) {
  if (!weather) return "天气载入中";
  if (weather.weather === "rain") return "有雨";
  if (weather.weather === "cloudy") return "多云";
  return "晴朗";
}

function getWeatherRange(weather: Weather | null) {
  if (!weather) return `${DEFAULT_WEATHER.tempMin}-${DEFAULT_WEATHER.tempMax}°C`;

  const min = weather.tempMin ?? weather.temp - 2;
  const max = weather.tempMax ?? weather.temp + 2;
  return `${Math.min(min, max)}-${Math.max(min, max)}°C`;
}

function getDurationLabel(duration: string) {
  if (duration === "half-day") return "半天";
  if (duration === "1d") return "1天";
  if (duration === "2d1n") return "2天1晚";
  if (duration === "3d2n") return "3天2晚";
  return duration;
}

function getDisplayLocationLabel(location: LocationState, weather: Weather | null, tripType: TripType) {
  if (location.source === "fallback" && weather?.source === "fallback") {
    return "请开启实时定位";
  }

  return buildScopedLocationLabel(
    {
      name: location.name,
      city: location.city || (location.source === "auto" && weather?.source !== "fallback" ? weather?.city : undefined),
      district:
        location.district ||
        (location.source === "auto" && weather?.source !== "fallback" ? weather?.district : undefined),
    },
    tripType,
  );
}

function EditorialWeatherIcon({ weather }: { weather: Weather | null }) {
  const stroke =
    weather?.weather === "rain" ? "text-brand-blue" : weather?.weather === "sunny" ? "text-brand-coral" : "text-ink/55";

  if (weather?.weather === "rain") {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className={stroke}>
        <path d="M8 17.5C5.79086 17.5 4 15.7091 4 13.5C4 11.2909 5.79086 9.5 8 9.5C8.45439 9.5 8.89109 9.57577 9.29798 9.7155C10.2988 7.50335 12.5262 6 15.1044 6C18.5427 6 21.3308 8.78815 21.3308 12.2264C21.3308 12.3195 21.3288 12.4121 21.3248 12.5042C23.3289 12.8077 24.8636 14.5368 24.8636 16.625C24.8636 18.9262 22.9973 20.7925 20.6961 20.7925H8.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 21.5L8.7 24" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M15 20.8L13.7 23.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M20 21.5L18.7 24" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (weather?.weather === "cloudy") {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className={stroke}>
        <path d="M8 18.5C5.79086 18.5 4 16.7091 4 14.5C4 12.2909 5.79086 10.5 8 10.5C8.45439 10.5 8.89109 10.5758 9.29798 10.7155C10.2988 8.50335 12.5262 7 15.1044 7C18.5427 7 21.3308 9.78815 21.3308 13.2264C21.3308 13.3195 21.3288 13.4121 21.3248 13.5042C23.3289 13.8077 24.8636 15.5368 24.8636 17.625C24.8636 19.9262 22.9973 21.7925 20.6961 21.7925H8.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.2 8.4L9.4 7.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M14 5.6V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M19.8 8.4L18.6 7.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className={stroke}>
      <circle cx="14" cy="14" r="4.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M14 4V6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M14 21.5V24" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M24 14H21.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M6.5 14H4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20.9 7.1L19.1 8.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8.9 19.1L7.1 20.9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20.9 20.9L19.1 19.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M8.9 8.9L7.1 7.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function WeatherPanel({ weather }: { weather: Weather | null }) {
  return (
    <div className="rounded-[28px] border border-ink/8 bg-white/80 px-5 py-5 lg:px-6 lg:py-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-coral/6">
            <EditorialWeatherIcon weather={weather} />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.35em] font-black text-ink/35">Weather Window</p>
            <p className="text-xl lg:text-2xl font-black font-serif italic text-ink">
              {getWeatherLabel(weather)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-2 text-ink">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.28em] font-black text-ink/30">温度区间</p>
            <p className="text-xl font-black font-serif italic">{getWeatherRange(weather)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.28em] font-black text-ink/30">当前温度</p>
            <p className="text-base font-black">{weather?.temp ?? DEFAULT_WEATHER.temp}°C</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.28em] font-black text-ink/30">湿度</p>
            <p className="text-base font-black">{weather?.humidity ?? DEFAULT_WEATHER.humidity}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState<"home" | "result">("home");
  const [isLoading, setIsLoading] = useState(false);
  const [location, setLocation] = useState<LocationState>(() => buildFallbackLocationState());
  const [weather, setWeather] = useState<Weather | null>(null);
  const [age, setAge] = useState<string>("3-6");
  const [duration, setDuration] = useState<string>("2h");
  const [tripType, setTripType] = useState<string>("today");
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationQuery, setLocationQuery] = useState<string>("");
  const [locationNotice, setLocationNotice] = useState<string>(
    "正在为你获取所在城市附近的位置。",
  );
  const [showManualLocation, setShowManualLocation] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [, setIsRequestingPreciseLocation] = useState(false);
  const locationRef = useRef<LocationState>(location);

  async function fetchWeather(lat: number, lng: number) {
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);
      if (!res.ok) {
        throw new Error("weather unavailable");
      }
      const data = await res.json();
      setWeather(data);
    } catch (fetchError) {
      console.error(fetchError);
      setWeather((prev) => prev ?? DEFAULT_WEATHER);
    }
  }

  function commitLocation(nextLocation: LocationState, notice?: string) {
    if (!shouldReplaceLocation(locationRef.current, nextLocation)) {
      return;
    }

    locationRef.current = nextLocation;
    setLocation(nextLocation);
    if (notice) {
      setLocationNotice(notice);
    }
    setLocationQuery(nextLocation.name);
  }

  async function reverseGeocodeCurrentLocation(lat: number, lng: number) {
    const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`);
    if (!res.ok) {
      throw new Error("reverse geocode unavailable");
    }

    return (await res.json()) as ReverseGeocodeResponse;
  }

  async function bootstrapLocation() {
    try {
      const res = await fetch("/api/bootstrap-location");
      const data = await res.json();

      if (!res.ok || !data?.lat || !data?.lng) {
        throw new Error("bootstrap location unavailable");
      }

      const nextLocation = normalizeBootstrapLocationResult({
        name: data.name,
        lat: Number(data.lat),
        lng: Number(data.lng),
        city: data.city,
        district: data.district,
        province: data.province,
      });

      if (data.source === "fallback") {
        setLocationNotice("暂时无法获取默认位置，请使用实时定位，或手动输入更准确的城市与区域。");
        setShowManualLocation(true);
        return;
      }

      if (shouldReplaceLocation(locationRef.current, nextLocation)) {
        commitLocation(nextLocation, `已为你默认定位到 ${nextLocation.name} 附近，可直接生成方案，也可手动切换。`);
      }
    } catch (bootstrapError) {
      console.warn("Unable to bootstrap location:", bootstrapError);
      const fallbackLocation = buildFallbackLocationState();
      if (shouldReplaceLocation(locationRef.current, fallbackLocation)) {
        commitLocation(fallbackLocation, "暂时无法判断你所在城市，已先使用上海，也可以手动输入更准确的位置。");
      }
      setShowManualLocation(true);
    }
  }

  function requestCurrentLocation() {
    return new Promise<boolean>((resolve) => {
      setIsRequestingPreciseLocation(true);

      if (!("geolocation" in navigator)) {
        setLocationNotice("当前浏览器无法读取定位，已先使用默认位置，也可以手动输入城市、商圈或具体地址。");
        setShowManualLocation(true);
        setIsRequestingPreciseLocation(false);
        resolve(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const preciseLocation = await reverseGeocodeCurrentLocation(pos.coords.latitude, pos.coords.longitude);
            const nextLocation = normalizeAutoLocationResult({
              name:
                [preciseLocation.city, preciseLocation.district].filter(Boolean).join(" ") ||
                preciseLocation.name ||
                "当前位置",
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              city: preciseLocation.city,
              district: preciseLocation.district,
              province: preciseLocation.province,
            });

            commitLocation(nextLocation, `已切换到你当前更精确的位置：${nextLocation.name}`);
          } catch (reverseError) {
            console.warn("Unable to reverse geocode current location:", reverseError);
            const nextLocation = normalizeAutoLocationResult({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              name: "当前位置",
            });
            commitLocation(nextLocation, "已切换到你的精确位置。");
          }

          setShowManualLocation(false);
          setIsRequestingPreciseLocation(false);
          resolve(true);
        },
        () => {
          setLocationNotice((current) =>
            current.includes("默认定位")
              ? `${current} 如果你愿意授权精确定位，结果会更贴近你当下的位置。`
              : "定位未开启也没关系，已先使用默认位置。你仍然可以手动输入更准确的位置。",
          );
          setIsRequestingPreciseLocation(false);
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 120000,
        },
      );
    });
  }

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    async function initializeLocation() {
      let savedManualLocation: LocationState | null = null;

      try {
        const saved = window.localStorage.getItem("papa-where-we-go:location");
        if (saved) {
          const parsed = JSON.parse(saved) as LocationState;
          if (
            Number.isFinite(parsed.lat) &&
            Number.isFinite(parsed.lng) &&
            parsed.name &&
            shouldRestoreSavedLocation(parsed)
          ) {
            savedManualLocation = parsed;
          }
        }
      } catch (storageError) {
        console.warn("Unable to read saved location:", storageError);
      }

      const locatedPrecisely = await requestCurrentLocation();
      if (locatedPrecisely) {
        return;
      }

      if (savedManualLocation) {
        commitLocation(savedManualLocation, `继续使用上次的位置：${savedManualLocation.name}`);
        setShowManualLocation(false);
        return;
      }

      void bootstrapLocation();
    }

    void initializeLocation();
  }, []);

  useEffect(() => {
    fetchWeather(location.lat, location.lng);

    try {
      window.localStorage.setItem("papa-where-we-go:location", JSON.stringify(location));
    } catch (storageError) {
      console.warn("Unable to save location:", storageError);
    }
  }, [location]);

  useEffect(() => {
    setDuration(tripType === "today" ? "2h" : "1d");
  }, [tripType]);

  async function handleManualLocationSubmit() {
    const query = locationQuery.trim();
    if (!query) {
      setError("请输入城市、商圈或具体地址，例如“上海 徐汇”或“上海徐汇滨江绿地”。");
      return;
    }

    setIsResolvingLocation(true);
    setError(null);

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "无法解析该位置");
      }

      const nextLocation = normalizeManualLocationResult(data as GeocodeResponse);
      commitLocation(nextLocation, `已切换到 ${nextLocation.name}`);
      setShowManualLocation(false);
    } catch (submitError: any) {
      setError(submitError.message || "没有识别出这个位置，已继续使用当前出发点。");
    } finally {
      setIsResolvingLocation(false);
    }
  }

  async function generatePlan() {
    setIsLoading(true);
    setError(null);

    const safeWeather = weather ?? { ...DEFAULT_WEATHER, city: buildLocationLabel(location) };

    try {
      const planRes = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location,
          weather: safeWeather,
          age,
          duration,
          tripType,
        }),
      });

      const planData = await planRes.json();
      if (planData.error) throw new Error(planData.error);

      setResult(planData);
      setStep("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (planError: any) {
      setError(planError.message || "生成计划失败，请重试。");
    } finally {
      setIsLoading(false);
    }
  }

  const scopedLocationLabel = getDisplayLocationLabel(location, weather, tripType as TripType);

  return (
    <div className="min-h-screen bg-paper text-ink font-sans selection:bg-brand-coral/10 relative">
      <GridBackground />
      {step === "result" && <Header step="result" />}

      <AnimatePresence mode="wait">
        {step === "home" && (
          <motion.div
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="snap-container relative"
          >
            <section className="snap-section flex items-center px-6 lg:px-20 relative">
              <Header step="home" />
              <div className="grid grid-cols-1 lg:grid-cols-12 w-full items-center gap-10 lg:gap-20">
                <div className="lg:col-span-6 space-y-12 text-left">
                  <div className="space-y-8">
                    <h2 className="text-[10vw] lg:text-[7vw] font-black leading-tight tracking-tighter text-ink font-serif italic">
                      去哪遛娃
                    </h2>
                    <div className="space-y-8 max-w-xl">
                      <p className="text-xl lg:text-2xl text-ink/60 leading-relaxed font-black font-serif italic">
                        为每位家长提供<span className="text-brand-coral">不同场景</span>的遛娃方案，<br />
                        为每个孩子寻找<span className="text-brand-coral">快乐源泉</span>。
                      </p>
                      <div className="flex items-center gap-4 pt-4">
                        <span className="text-[10px] uppercase tracking-[0.4em] font-black opacity-30">Age Range</span>
                        <div className="flex gap-4 text-sm font-black text-brand-coral font-serif italic">
                          <span>0-3</span>
                          <span className="opacity-20">/</span>
                          <span>3-6</span>
                          <span className="opacity-20">/</span>
                          <span>6+</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-6 h-[40vh] lg:h-[60vh] relative flex items-center justify-center">
                  <div className="w-full h-full rounded-[40px] overflow-hidden shadow-2xl shadow-ink/5 bg-[radial-gradient(circle_at_top,_rgba(255,118,118,0.14),_rgba(255,254,251,0.88)_62%)] border border-brand-coral/10 flex items-center justify-center p-6 lg:p-8">
                    <CarouselIllustration />
                  </div>
                </div>
              </div>

              <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-ink/20"
                >
                  <ChevronDown size={32} />
                </motion.div>
              </div>
            </section>

            <section className="snap-section flex items-start lg:items-center px-6 lg:px-20 bg-paper text-ink relative overflow-hidden py-24 lg:py-0">
              <Header step="home" isScreen2 />
              
              {/* Vertical Rail Text (Editorial Style) */}
              <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden xl:flex flex-col items-center gap-12 opacity-10 pointer-events-none">
                <span className="writing-vertical-rl rotate-180 text-[10px] font-black uppercase tracking-[0.8em]">Discovery Phase</span>
                <div className="w-px h-24 bg-ink" />
                <span className="text-[10px] font-black">02</span>
              </div>

              {/* Decorative background element */}
              <div className="absolute top-1/2 right-[-10%] -translate-y-1/2 w-[600px] h-[600px] bg-brand-coral/5 rounded-full blur-[120px] pointer-events-none" />

              <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 pt-20 lg:pt-24 pb-20 lg:pb-12 relative z-10">
                <div className="lg:col-span-5 space-y-6 lg:space-y-8 flex flex-col justify-center relative">
                  <div className="absolute -inset-6 lg:-inset-10 bg-brand-coral/[0.01] rounded-[60px] -z-10 hidden lg:block" />
                  <div className="absolute -left-10 top-0 bottom-0 w-px bg-brand-coral/20 hidden lg:block" />
                  <div className="space-y-6 lg:space-y-8">
                    <div className="space-y-3 lg:space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-px bg-brand-coral" />
                        <span className="text-[10px] uppercase tracking-[0.5em] font-black text-brand-coral">Discovery</span>
                      </div>
                      <h3 className="text-5xl lg:text-7xl font-black tracking-tight font-serif italic leading-[1.1]">
                        专属<br /><span className="text-brand-coral">遛娃方案</span>
                      </h3>
                    </div>
                    <p className="text-lg lg:text-xl text-ink/60 font-black font-serif italic max-w-md leading-relaxed">
                      守护那份最原始的好奇，珍藏那颗最纯净的童心。在陪伴中，我们也重新做回了孩子。
                    </p>
                  </div>

                  <div className="rounded-[32px] border border-ink/8 bg-white/82 px-6 py-6 lg:px-7 lg:py-7 shadow-sm space-y-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3 min-w-0">
                        <span className="text-[10px] uppercase tracking-[0.35em] font-black text-ink/30 block">
                          Starting Point
                        </span>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <div className="flex items-center gap-3 text-xl lg:text-2xl font-black min-w-0">
                            <span className="border-b-2 border-ink/20 font-serif italic break-words">
                              {scopedLocationLabel}
                            </span>
                            <MapPin className="text-brand-coral shrink-0" size={22} />
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowManualLocation((prev) => !prev)}
                            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-black text-ink/40 transition-colors hover:text-brand-coral"
                          >
                            <Search size={14} />
                            切换位置
                          </button>
                        </div>
                        <p className="text-sm lg:text-base text-ink/45 leading-relaxed font-black">
                          {locationNotice}
                        </p>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "grid transition-all duration-300",
                        showManualLocation ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="pt-1 space-y-3">
                          <div className="flex flex-col md:flex-row gap-4">
                            <input
                              value={locationQuery}
                              onChange={(event) => setLocationQuery(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  void handleManualLocationSubmit();
                                }
                              }}
                              placeholder="输入城市、商圈或具体地址"
                              className="flex-1 rounded-2xl border border-ink/10 bg-paper px-5 py-4 text-lg text-ink placeholder:text-ink/25 outline-none transition-colors focus:border-brand-coral/40"
                            />
                            <button
                              type="button"
                              onClick={() => void handleManualLocationSubmit()}
                              disabled={isResolvingLocation}
                              className="inline-flex items-center justify-center gap-3 rounded-2xl bg-ink px-6 py-4 text-sm uppercase tracking-[0.2em] font-black text-white transition-colors hover:bg-brand-coral disabled:opacity-50"
                            >
                              {isResolvingLocation ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                              更新位置
                            </button>
                          </div>
                          <p className="text-sm text-ink/40 leading-relaxed font-black">
                            支持输入城市、商圈、具体地址或地标，例如“杭州 良渚”或“杭州良渚国家考古遗址公园”。
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <WeatherPanel weather={weather} />
                </div>

                <div className="lg:col-span-7 relative">
                  <div className="absolute inset-0 bg-brand-coral/[0.02] rounded-[60px] -rotate-2 scale-105 pointer-events-none" />
                  <div className="relative bg-white p-8 lg:p-14 rounded-[40px] border border-ink/5 shadow-2xl shadow-ink/5 space-y-10">
                    <div className="space-y-3">
                      <span className="text-[10px] uppercase tracking-[0.45em] font-black text-ink/30 block">
                        Decision Section
                      </span>
                      <h3 className="text-4xl lg:text-5xl font-black tracking-tight font-serif italic">
                        开启行程
                      </h3>
                    </div>

                    <div className="space-y-8">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-10">
                        <span className="text-xl lg:text-2xl font-black opacity-60 font-serif italic min-w-[120px]">
                          孩子年龄
                        </span>
                        <div className="flex flex-wrap gap-4 lg:gap-5 text-lg lg:text-xl font-black font-serif italic">
                          {["0-3", "3-6", "6+"].map((currentAge) => (
                            <button
                              key={currentAge}
                              onClick={() => setAge(currentAge)}
                              className={cn(
                                "transition-all relative rounded-full px-4 py-3 lg:px-5 lg:py-3 border text-left",
                                age === currentAge
                                  ? "text-ink border-brand-coral/30 bg-brand-coral/5"
                                  : "text-ink/50 border-ink/10 hover:text-ink/70 hover:border-ink/20",
                              )}
                            >
                              {currentAge}岁
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:gap-10">
                        <div className="space-y-4">
                          <span className="text-xl lg:text-2xl font-black opacity-60 font-serif italic block">
                            出行类型
                          </span>
                          <div className="flex flex-wrap gap-4 lg:gap-5 text-lg lg:text-xl font-black font-serif italic">
                            {[
                              { id: "today", label: "当天遛娃" },
                              { id: "weekend", label: "小长假" },
                            ].map((type) => (
                              <button
                                key={type.id}
                                onClick={() => setTripType(type.id)}
                                className={cn(
                                  "transition-all relative rounded-full px-4 py-3 lg:px-5 lg:py-3 border text-left",
                                  tripType === type.id
                                    ? "text-ink border-brand-coral/30 bg-brand-coral/5"
                                    : "text-ink/50 border-ink/10 hover:text-ink/70 hover:border-ink/20",
                                )}
                              >
                                {type.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <span className="text-xl lg:text-2xl font-black opacity-60 font-serif italic block">
                            预计时长
                          </span>
                          <div className="flex flex-wrap gap-4 lg:gap-5 text-lg lg:text-xl font-black font-serif italic">
                            {(tripType === "today" ? ["1h", "2h", "half-day"] : ["1d", "2d1n", "3d2n"]).map((currentDuration) => (
                              <button
                                key={currentDuration}
                                onClick={() => setDuration(currentDuration)}
                                className={cn(
                                  "transition-all relative rounded-full px-4 py-3 lg:px-5 lg:py-3 border text-left",
                                  duration === currentDuration
                                    ? "text-ink border-brand-coral/30 bg-brand-coral/5"
                                    : "text-ink/50 border-ink/10 hover:text-ink/70 hover:border-ink/20",
                                )}
                              >
                                {currentDuration === "half-day" ? "半天" : currentDuration}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {error && (
                      <div className="rounded-[28px] border border-brand-coral/20 bg-brand-coral/5 px-6 py-5 text-base font-black text-brand-coral">
                        {error}
                      </div>
                    )}

                    <button
                      onClick={() => void generatePlan()}
                      disabled={isLoading || isResolvingLocation}
                      className="w-full py-8 bg-ink text-white flex items-center justify-center gap-6 group disabled:opacity-30 transition-all hover:bg-brand-coral rounded-[24px] shadow-xl shadow-ink/10"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="animate-spin" size={24} />
                          <span className="text-lg font-black uppercase tracking-[0.18em]">正在快速生成方案</span>
                        </>
                      ) : (
                        <>
                          <span className="text-xl font-black uppercase tracking-tight font-serif italic">
                            看看行程怎么安排更合适
                          </span>
                          <ArrowRight className="group-hover:translate-x-4 transition-transform" size={24} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {step === "result" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="pt-40 pb-40 px-10 lg:px-20 max-w-7xl mx-auto space-y-24"
          >
            <div className="space-y-12">
              <div className="space-y-6">
                <p className="text-[11px] uppercase tracking-[0.35em] font-black text-ink/35">
                  {tripType === "today" ? "当天遛娃" : "小长假遛娃"} · {getDurationLabel(duration)} · {scopedLocationLabel}
                </p>
                <h2 className="text-[8vw] lg:text-[6vw] font-black tracking-tighter text-ink leading-tight font-serif italic">
                  建议前往：{result.recommendations[0]?.name || "附近的公园"}
                </h2>
                {result.notice && (
                  <div className="max-w-4xl rounded-[28px] border border-brand-coral/20 bg-brand-coral/6 px-6 py-5 text-base lg:text-lg font-black text-brand-coral leading-relaxed">
                    {result.notice}
                  </div>
                )}
              </div>

              <div className="p-8 lg:p-10 bg-white/88 border border-ink/8 text-ink rounded-[32px] shadow-sm space-y-8">
                <div className="space-y-3">
                  <label className="text-xs uppercase tracking-[0.4em] font-black opacity-30 block">建议完整方案</label>
                </div>
                <div
                  className={cn(
                    "grid gap-8",
                    (result.scheduleOptions?.length ?? 0) > 1 ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1 max-w-4xl",
                  )}
                >
                  {(result.scheduleOptions?.length
                    ? result.scheduleOptions
                    : [
                        {
                          id: "depart-now" as const,
                          label: "当前方案",
                          description: "当前返回的默认行程。",
                          blocks: [{ title: "当日", summary: "默认行程", items: result.plan }],
                        },
                      ]).map((option) => (
                    <div
                      key={option.id}
                      className="rounded-[28px] border border-ink/8 bg-paper/55 px-6 py-6 lg:px-7 lg:py-7 space-y-6"
                    >
                      <div className="space-y-2">
                        <p className="text-xl lg:text-2xl font-black text-ink font-serif italic">{option.label}</p>
                        <p className="text-base lg:text-lg font-black text-ink/60 leading-relaxed">
                          {option.description}
                        </p>
                      </div>

                      <div className="space-y-5">
                        {option.blocks.map((block, blockIndex) => (
                          <div
                            key={`${option.id}-${block.title}-${blockIndex}`}
                            className={cn(
                              "space-y-4",
                              blockIndex > 0 ? "border-t border-ink/8 pt-5" : "",
                            )}
                          >
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                              <div className="space-y-1">
                                <p className="text-sm uppercase tracking-[0.28em] font-black text-ink/30">
                                  {block.title}
                                </p>
                                <p className="text-base font-black text-ink/55 leading-relaxed">{block.summary}</p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              {block.items.map((item, idx) => (
                                <div key={`${option.id}-${block.title}-${idx}`} className="space-y-2 border-l-2 border-brand-coral/20 pl-5">
                                  <span className="text-sm font-black text-ink/30 uppercase tracking-[0.2em] font-serif italic">
                                    {item.time}
                                  </span>
                                  <p className="text-lg lg:text-xl font-bold text-ink leading-tight font-serif italic">
                                    {item.action}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-10">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.5em] font-black text-ink/40">精选推荐地点</label>
                <h3 className="text-3xl lg:text-4xl font-black tracking-tight font-serif italic text-ink">
                  再挑几处顺路可去的地方
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {result.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="group space-y-5 bg-white p-8 rounded-[28px] border border-ink/8 hover:shadow-lg transition-all font-serif italic"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <h4 className="text-2xl font-black tracking-normal text-ink group-hover:text-brand-coral transition-colors">
                        {rec.name}
                      </h4>
                      <span className="text-[10px] font-black uppercase tracking-widest text-ink/30 shrink-0">
                        {rec.distance}
                      </span>
                    </div>
                    {rec.address && <p className="text-sm text-ink/45 font-black not-italic">{rec.address}</p>}
                    <a
                      href={buildNavigationUrl(rec, location)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-brand-blue hover:gap-6 transition-all"
                    >
                      <Navigation size={14} /> 导航前往
                    </a>
                  </div>
                ))}
              </div>
            </div>

            <div className="max-w-xl">
              <button
                onClick={() => {
                  setStep("home");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full p-10 bg-white border border-ink/10 text-ink rounded-[28px] flex flex-col items-center justify-center gap-5 group hover:bg-brand-coral hover:text-white hover:border-brand-coral transition-all font-serif italic shadow-sm"
              >
                <RefreshCw size={40} className="group-hover:rotate-180 transition-transform duration-500" />
                <span className="text-xl font-black uppercase tracking-widest">重新规划行程</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="fixed bottom-0 left-0 right-0 z-50 px-10 py-10 flex justify-between items-center text-[8px] uppercase tracking-[0.5em] font-black text-ink/20 pointer-events-none" />
    </div>
  );
}
