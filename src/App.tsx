import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MapPin, 
  Cloud, 
  Sun, 
  CloudRain, 
  Baby, 
  Clock, 
  ArrowRight, 
  ChevronRight,
  ChevronDown,
  Loader2,
  RefreshCw,
  Navigation,
  Map as MapIcon,
  Candy
} from "lucide-react";
import { cn } from "./lib/utils";

// --- Types ---

interface Weather {
  temp: number;
  tempMin?: number;
  tempMax?: number;
  weather: "rain" | "sunny" | "cloudy";
  weatherDesc?: string;
  humidity: number;
  city?: string;
}

interface POI {
  name: string;
  lat: number;
  lng: number;
  rating: number;
  address: string;
  types: string[];
}

interface PlanItem {
  time: string;
  action: string;
}

interface Recommendation {
  name: string;
  reason: string;
  distance: string;
}

interface PlanResult {
  summary: string;
  plan: PlanItem[];
  recommendations: Recommendation[];
}

// --- Components ---

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
    <div className="absolute inset-0 opacity-[0.03]" 
         style={{ backgroundImage: 'radial-gradient(#2D3436 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
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

const Header = ({ step, isScreen2 }: { step: "home" | "result", isScreen2?: boolean }) => {
  const getIcon = () => {
    if (step === "result") return <LollipopIcon size={24} className="text-brand-coral" />;
    if (isScreen2) return <MapIcon size={24} className="text-brand-coral" />;
    return <CarIcon size={24} className="text-brand-coral" />;
  };

  return (
    <header className={cn(
      "absolute top-0 left-0 right-0 z-50 px-10 py-10 flex justify-between items-center transition-colors duration-500",
      "text-ink"
    )}>
      <div className="flex items-center gap-3 group cursor-pointer">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform",
          "bg-brand-coral/10"
        )}>
          {getIcon()}
        </div>
        <div className="flex flex-col">
          <span className={cn(
            "text-[8px] uppercase tracking-[0.4em] font-black",
            "text-ink/20"
          )}>Editorial Guide</span>
        </div>
      </div>
      <div className={cn(
        "hidden md:flex gap-12 text-[10px] uppercase tracking-[0.4em] font-black",
        "text-ink/10"
      )}>
        <span>v2.5 High Fidelity</span>
      </div>
    </header>
  );
};

// Carousel Illustration (Using User-Provided Image)
const CarouselIllustration = () => (
  <div className="relative w-full h-full flex items-center justify-center illustration-float">
    <div className="relative w-[90%] lg:w-[100%] aspect-square">
      <img 
        src="/loading.png" 
        alt="Carousel Illustration" 
        className="w-full h-full object-contain rounded-[40px]"
        referrerPolicy="no-referrer"
      />
    </div>
  </div>
);

export default function App() {
  const [step, setStep] = useState<"home" | "result">("home");
  const [isLoading, setIsLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [age, setAge] = useState<string>("3-6");
  const [duration, setDuration] = useState<string>("2h");
  const [tripType, setTripType] = useState<string>("today");
  const [result, setResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tip, setTip] = useState<string>("别忘了带上宝宝最喜欢的玩具！今日紫外线较强，户外活动请做好防晒。");

  const tips = [
    "别忘了带上宝宝最喜欢的玩具！今日紫外线较强，户外活动请做好防晒。",
    "记得多带一套备用衣服，以防孩子玩耍时弄脏或弄湿。",
    "随身携带一些健康的小零食和充足的饮用水，随时补充能量。",
    "在户外活动时，注意观察孩子的体力情况，适时休息。",
    "如果去公园，可以带上野餐垫，享受一段悠闲的亲子时光。",
    "带上免洗洗手液，随时保持手部卫生。",
    "如果是去室内游乐场，记得给孩子穿上防滑袜。"
  ];

  // Get Location & Weather on Mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords({ lat, lng });
          fetchWeather(lat, lng);
        },
        () => setError("无法获取定位，请手动开启权限。")
      );
    }
  }, []);

  const fetchWeather = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      setWeather(data);
    } catch (e) {
      console.error(e);
    }
  };

  const generatePlan = async () => {
    if (!coords) return;
    setIsLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      const poiRes = await fetch(`/api/pois?lat=${coords.lat}&lng=${coords.lng}`);
      const pois: POI[] = await poiRes.json();
      const filteredPois = pois.filter(p => p.rating >= 4);

      const planRes = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: coords,
          weather,
          age,
          duration,
          pois: filteredPois.slice(0, 10)
        })
      });

      const planData = await planRes.json();
      if (planData.error) throw new Error(planData.error);
      
      // Ensure loading takes at least 0.3s but not more than 1s total
      const elapsed = Date.now() - startTime;
      const waitTime = Math.max(300 - elapsed, 0);
      await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 700)));

      setResult(planData);
      setTip(tips[Math.floor(Math.random() * tips.length)]);
      setStep("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setError(e.message || "生成计划失败，请重试。");
    } finally {
      setIsLoading(false);
    }
  };

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
            {/* Screen 1: Cover */}
            <section className="snap-section flex items-center px-10 lg:px-20 relative">
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
                  <motion.div 
                    whileHover={{ scale: 1.05, y: -10 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="w-full h-full rounded-[40px] overflow-hidden shadow-2xl shadow-ink/5 bg-ink/5 cursor-pointer flex items-center justify-center"
                  >
                    <img 
                      src="https://images.unsplash.com/photo-1533558701576-23c65e0272fb?q=80&w=1000&auto=format&fit=crop" 
                      alt="Carousel"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </motion.div>
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

            {/* Screen 2: Decision */}
            <section className="snap-section flex items-center px-10 lg:px-20 bg-paper text-ink relative overflow-hidden">
              <Header step="home" isScreen2 />
              
              {/* Vertical Rail Text (Editorial Style) */}
              <div className="absolute left-6 top-1/2 -translate-y-1/2 hidden xl:flex flex-col items-center gap-12 opacity-10 pointer-events-none">
                <span className="writing-vertical-rl rotate-180 text-[10px] font-black uppercase tracking-[0.8em]">Discovery Phase</span>
                <div className="w-px h-24 bg-ink" />
                <span className="text-[10px] font-black">02</span>
              </div>

              {/* Decorative background element */}
              <div className="absolute top-1/2 right-[-10%] -translate-y-1/2 w-[600px] h-[600px] bg-brand-coral/5 rounded-full blur-[120px] pointer-events-none" />

              <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 pt-16 lg:pt-24 relative z-10">
                {/* Left Side: Context & Title */}
                <div className="lg:col-span-5 space-y-8 lg:space-y-12 flex flex-col justify-center relative">
                  {/* Subtle background block for differentiation */}
                  <div className="absolute -inset-6 lg:-inset-10 bg-brand-coral/[0.01] rounded-[60px] -z-10 hidden lg:block" />
                  
                  {/* Vertical Rail Accent */}
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

                  {/* Weather Module - Moved to Left Side for better context */}
                  {weather && (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="inline-flex items-center gap-6 lg:gap-8 p-6 lg:p-8 bg-white rounded-[32px] border border-ink/5 shadow-xl shadow-ink/5"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-brand-coral/10 flex items-center justify-center text-brand-coral">
                          {weather.weather === "sunny" && <Sun size={32} />}
                          {weather.weather === "cloudy" && <Cloud size={32} />}
                          {weather.weather === "rain" && <CloudRain size={32} />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-widest font-black opacity-30">当前天气</span>
                          <span className="text-xl font-black font-serif italic">{weather.weatherDesc || (weather.weather === "sunny" ? "晴" : weather.weather === "cloudy" ? "多云" : "雨")}</span>
                        </div>
                      </div>
                      
                      <div className="h-12 w-px bg-ink/10" />

                      <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest font-black opacity-30">温度区间</span>
                        <span className="text-xl font-black font-serif italic">
                          {weather.tempMin !== undefined && weather.tempMax !== undefined 
                            ? `${weather.tempMin}° / ${weather.tempMax}°` 
                            : `${weather.temp}°C`}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Right Side: Selection Controls */}
                <div className="lg:col-span-7 relative">
                  {/* Floating decorative card background */}
                  <div className="absolute inset-0 bg-brand-coral/[0.02] rounded-[60px] -rotate-2 scale-105 pointer-events-none" />
                  
                  <div className="relative bg-white p-8 lg:p-16 rounded-[48px] border border-ink/5 shadow-2xl shadow-ink/5 space-y-8 lg:space-y-12">
                    {/* Location */}
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-[0.4em] font-black opacity-30 block">Starting Point / 出发地点</label>
                      <div className="flex items-center gap-4 text-2xl font-black group cursor-pointer">
                        <div className="w-10 h-10 rounded-full bg-ink flex items-center justify-center text-white group-hover:bg-brand-coral transition-colors">
                          <MapPin size={18} />
                        </div>
                        <span className="border-b-2 border-ink/10 group-hover:border-brand-coral transition-colors font-serif italic">
                          {weather?.city || (coords ? "定位中..." : "获取定位中...")}
                        </span>
                      </div>
                    </div>

                    {/* Age */}
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-[0.3em] font-black opacity-30">孩子年龄</label>
                      <div className="flex flex-wrap gap-10 text-2xl font-black font-serif italic">
                        {["0-3", "3-6", "6+"].map((a) => (
                          <button
                            key={a}
                            onClick={() => setAge(a)}
                            className={cn(
                              "transition-all relative py-2",
                              age === a ? "text-ink" : "text-ink/20 hover:text-ink/40"
                            )}
                          >
                            {a}岁
                            {age === a && (
                              <motion.div layoutId="age-dot" className="absolute -bottom-1 left-0 right-0 h-1 bg-brand-coral rounded-full" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Trip Type & Duration Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      {/* Trip Type */}
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-[0.3em] font-black opacity-30">行程类型</label>
                        <div className="flex flex-col gap-4 text-xl font-black font-serif italic">
                          {[
                            { id: "today", label: "当天遛娃" },
                            { id: "weekend", label: "小长假" }
                          ].map((t) => (
                            <button
                              key={t.id}
                              onClick={() => setTripType(t.id)}
                              className={cn(
                                "flex items-center gap-3 transition-all",
                                tripType === t.id ? "text-ink" : "text-ink/20 hover:text-ink/40"
                              )}
                            >
                              <div className={cn(
                                "w-2 h-2 rounded-full transition-all",
                                tripType === t.id ? "bg-brand-coral scale-125" : "bg-ink/10"
                              )} />
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-[0.3em] font-black opacity-30">预计时长</label>
                        <div className="flex flex-col gap-4 text-xl font-black font-serif italic">
                          {(tripType === "today" ? ["1h", "2h", "half-day"] : ["1d", "2d1n", "3d2n"]).map((d) => (
                            <button
                              key={d}
                              onClick={() => setDuration(d)}
                              className={cn(
                                "flex items-center gap-3 transition-all",
                                duration === d ? "text-ink" : "text-ink/20 hover:text-ink/40"
                              )}
                            >
                              <div className={cn(
                                "w-2 h-2 rounded-full transition-all",
                                duration === d ? "bg-brand-coral scale-125" : "bg-ink/10"
                              )} />
                              {d === "half-day" ? "半天" : d}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={generatePlan}
                      disabled={!coords || isLoading}
                      className="w-full py-8 bg-ink text-white flex items-center justify-center gap-6 group disabled:opacity-30 transition-all hover:bg-brand-coral rounded-[24px] shadow-xl shadow-ink/10"
                    >
                      {isLoading ? (
                        <Loader2 className="animate-spin" size={24} />
                      ) : (
                        <>
                          <span className="text-xl font-black uppercase tracking-tight font-serif italic">去遛娃</span>
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
            {/* Verdict & Full Plan */}
            <div className="space-y-12">
              <div className="space-y-8">
                <h2 className="text-[8vw] lg:text-[6vw] font-black tracking-tighter text-ink leading-tight font-serif italic">
                  建议前往：{result.recommendations[0]?.name || "附近的公园"}
                </h2>
                <p className="text-2xl lg:text-3xl text-ink/60 max-w-4xl leading-relaxed font-black font-serif italic">
                  {result.summary || (weather?.weather === "sunny" ? "阳光温和，适合前往开阔的户外场所。建议保持轻盈的节奏，在午后进行一场自然探索。" : "天气多云，光线柔和，非常适合户外摄影或长时间的公园漫步。")}
                </p>
              </div>

              {/* Full Plan Summary */}
              <div className="p-12 bg-brand-coral/5 border border-brand-coral/20 text-ink rounded-[40px] shadow-sm space-y-10">
                <label className="text-xs uppercase tracking-[0.4em] font-black opacity-30 block">建议完整方案</label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                  {result.plan.map((item, idx) => (
                    <div key={idx} className="space-y-2 border-l-2 border-brand-coral/20 pl-6">
                      <span className="text-sm font-black text-ink/30 uppercase tracking-[0.2em] font-serif italic">{item.time}</span>
                      <p className="text-xl font-bold text-ink leading-tight font-serif italic">{item.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommendations Tiled */}
            <div className="space-y-16">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-ink/10 pb-12 relative">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-brand-coral flex items-center justify-center text-white shadow-xl shadow-brand-coral/20">
                    <Navigation size={32} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-[0.5em] font-black text-ink/40">精选推荐地点</label>
                    <h3 className="text-3xl lg:text-4xl font-black tracking-tight font-serif italic">
                      Kids <span className="text-brand-coral">Playground</span>
                    </h3>
                  </div>
                </div>
                
                <div className="hidden md:flex items-center gap-4">
                  <span className="text-[10px] uppercase tracking-[0.5em] font-black opacity-20">Trendy Selection</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-brand-coral/20" />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                {result.recommendations.map((rec, idx) => (
                  <div key={idx} className="group space-y-6 bg-white p-10 rounded-[40px] border border-ink/5 hover:shadow-xl transition-all font-serif italic">
                    <div className="flex justify-between items-start">
                      <h4 className="text-2xl font-black tracking-normal text-ink group-hover:text-brand-coral transition-colors">{rec.name}</h4>
                      <span className="text-[10px] font-black uppercase tracking-widest text-ink/30">
                        {rec.distance}
                      </span>
                    </div>
                    <p className="text-base text-ink/50 leading-relaxed font-black">
                      {rec.reason}
                    </p>
                    <button className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-brand-blue hover:gap-6 transition-all">
                      <Navigation size={14} /> 导航前往
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Section: Tips & Replan */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-stretch">
              {/* Tips */}
              <div className="p-12 bg-brand-yellow/5 rounded-[40px] border border-brand-yellow/20 relative overflow-hidden flex flex-col justify-center">
                <div className="relative z-10 space-y-4">
                  <h5 className="text-[10px] uppercase tracking-[0.3em] font-black text-ink/40">遛娃小贴士</h5>
                  <p className="text-lg text-ink/70 font-black leading-relaxed font-serif italic">
                    {tip}
                  </p>
                </div>
                <div className="absolute -bottom-8 -right-8 opacity-[0.03] text-ink">
                  <Baby size={160} />
                </div>
              </div>

              {/* Replan */}
              <button 
                onClick={() => {
                  setStep("home");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full h-full p-12 bg-white border border-ink/10 text-ink rounded-[40px] flex flex-col items-center justify-center gap-6 group hover:bg-brand-coral hover:text-white hover:border-brand-coral transition-all font-serif italic shadow-sm"
              >
                <RefreshCw size={40} className="group-hover:rotate-180 transition-transform duration-500" />
                <span className="text-xl font-black uppercase tracking-widest">重新规划行程</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="fixed bottom-0 left-0 right-0 z-50 px-10 py-10 flex justify-between items-center text-[8px] uppercase tracking-[0.5em] font-black text-ink/20 pointer-events-none">
      </footer>
    </div>
  );
}
