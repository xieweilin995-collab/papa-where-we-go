export type TripType = "today" | "weekend";

export interface PlanningWeather {
  temp: number;
  weather: "rain" | "sunny" | "cloudy";
}

export interface PlanningContext {
  tripType: TripType;
  age: string;
  duration: string;
  locationLabel: string;
  weather: PlanningWeather;
  district?: string;
  currentTime?: string;
}

export interface RankedPoi {
  name: string;
  lat: number;
  lng: number;
  rating: number;
  address: string;
  types: string[];
  distanceKm: number;
  district?: string;
}

export interface LocationLike {
  name: string;
  city?: string;
  district?: string;
}

export interface PlanItem {
  time: string;
  action: string;
}

export interface ScheduleBlock {
  title: string;
  summary: string;
  items: PlanItem[];
}

export interface ScheduleOption {
  id: "depart-now" | "regular-rhythm";
  label: string;
  description: string;
  blocks: ScheduleBlock[];
}

export interface PlanResultShape {
  summary: string;
  plan: PlanItem[];
  scheduleOptions: ScheduleOption[];
  notice?: string;
  recommendations: Array<{ name: string; reason: string; distance: string; lat?: number; lng?: number; address?: string }>;
}

const COMMERCIAL_KEYWORDS = ["来福士", "万象城", "银泰", "广场", "购物", "mall", "商场"];
const OUTDOOR_KEYWORDS = ["park", "playground", "公园", "绿地", "滨江", "自然"];
const INDOOR_KEYWORDS = ["indoor", "室内", "乐园", "游乐", "mall"];
const TODDLER_KEYWORDS = ["室内", "亲子", "playground", "乐园", "儿童", "公园"];
const BIG_KID_KEYWORDS = ["科技馆", "博物馆", "自然", "探索", "海洋馆", "动物园", "museum", "science", "aquarium", "zoo", "camp", "露营"];
const FAMILY_POSITIVE_KEYWORDS = [
  "公园",
  "乐园",
  "游乐",
  "儿童",
  "亲子",
  "动物园",
  "植物园",
  "博物馆",
  "科技馆",
  "海洋馆",
  "自然馆",
  "农场",
  "营地",
  "park",
  "playground",
  "museum",
];
const DESTINATION_KEYWORDS = [
  "博物馆",
  "博物院",
  "科技馆",
  "动物园",
  "植物园",
  "海洋馆",
  "自然馆",
  "农场",
  "古城",
  "遗址",
  "湿地",
  "森林",
  "景区",
  "乐园",
  "营地",
  "museum",
  "science",
  "zoo",
  "aquarium",
  "farm",
];
const NEIGHBORHOOD_KEYWORDS = ["邻里", "社区", "口袋", "街心", "小区", "playground"];
const FAMILY_NEGATIVE_KEYWORDS = [
  "未命名场所",
  "证券",
  "营业部",
  "银行",
  "金融",
  "基金",
  "保险",
  "建材",
  "五金",
  "家具",
  "家居",
  "写字楼",
  "中学",
  "小学",
  "学校",
  "培训",
  "办公",
  "办事处",
  "街道办",
  "服务中心",
  "社区服务",
  "社区中心",
  "行政中心",
  "政务",
  "派出所",
  "居委会",
  "村委会",
  "工会",
  "社会团体",
  "石像",
  "雕像",
  "雕塑",
  "墓",
  "伞亭",
  "公厕",
  "厕所",
  "卫生间",
  "停车场",
  "游客中心",
  "暂停开放",
  "暂停营业",
  "mart",
  "便利店",
  "公交站",
  "地铁站",
  "路口",
  "交叉口",
  "丁字路口",
  "十字路口",
  "生活馆",
  "会所",
  "会员",
  "私享",
  "专属",
  "内部",
  "员工",
  "售楼处",
  "接待中心",
  "展示中心",
  "门岗",
  "入口",
  "出入口",
  "驿站",
  "服务处",
  "物业",
  "公寓",
  "民宿",
  "酒店",
  "宾馆",
  "客栈",
  "酒店式公寓",
  "新广场",
  "城市广场",
];

export function buildScopedLocationLabel(location: LocationLike, tripType: TripType): string {
  if (tripType === "today" && location.city && location.district) {
    return `${location.city} ${location.district}`;
  }

  return location.city || location.name;
}

function hasKeyword(target: string, keywords: string[]): boolean {
  const normalized = target.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function inferOutdoorScore(poi: RankedPoi): number {
  return hasKeyword(`${poi.name} ${poi.address} ${poi.types.join(" ")}`, OUTDOOR_KEYWORDS) ? 1.2 : 0;
}

function inferIndoorScore(poi: RankedPoi): number {
  return hasKeyword(`${poi.name} ${poi.address} ${poi.types.join(" ")}`, INDOOR_KEYWORDS) ? 1.2 : 0;
}

function inferCommercialPenalty(poi: RankedPoi): number {
  return hasKeyword(`${poi.name} ${poi.address}`, COMMERCIAL_KEYWORDS) ? 2.4 : 0;
}

function inferPrivatePenalty(poi: RankedPoi): number {
  return hasKeyword(`${poi.name} ${poi.address} ${poi.types.join(" ")}`, FAMILY_NEGATIVE_KEYWORDS) ? 3.4 : 0;
}

function inferToddlerScore(poi: RankedPoi): number {
  return hasKeyword(`${poi.name} ${poi.address} ${poi.types.join(" ")}`, TODDLER_KEYWORDS) ? 1.2 : 0;
}

function inferBigKidScore(poi: RankedPoi): number {
  return hasKeyword(`${poi.name} ${poi.address} ${poi.types.join(" ")}`, BIG_KID_KEYWORDS) ? 1.8 : 0;
}

function inferDestinationScore(poi: RankedPoi): number {
  return hasKeyword(`${poi.name} ${poi.types.join(" ")}`, DESTINATION_KEYWORDS) ? 1.9 : 0;
}

function inferNeighborhoodScore(poi: RankedPoi): number {
  const joinedText = `${poi.name} ${poi.address} ${poi.types.join(" ")}`;
  if (hasKeyword(joinedText, NEIGHBORHOOD_KEYWORDS)) {
    return 1.2;
  }

  return hasKeyword(joinedText, ["公园", "playground"]) && inferDestinationScore(poi) === 0 ? 0.8 : 0;
}

function isGenericNeighborhoodPark(poi: RankedPoi): boolean {
  return inferNeighborhoodScore(poi) >= 0.8 && inferDestinationScore(poi) === 0;
}

function parseDurationMinutes(duration: string): number {
  switch (duration) {
    case "1h":
      return 60;
    case "2h":
      return 120;
    case "half-day":
      return 240;
    case "1d":
      return 480;
    case "2d1n":
      return 900;
    case "3d2n":
      return 1440;
    default:
      return 120;
  }
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildScoreJitter(context: PlanningContext, poi: RankedPoi): number {
  if (!context.currentTime) {
    return 0;
  }

  const seed = `${context.age}|${context.duration}|${context.tripType}|${context.weather.weather}|${context.currentTime}|${poi.name}`;
  return ((hashString(seed) % 1000) / 1000 - 0.5) * 0.35;
}

function buildAgeBonus(context: PlanningContext, poi: RankedPoi): number {
  if (context.age === "0-3") {
    return inferToddlerScore(poi) + inferIndoorScore(poi) * 0.8 - inferBigKidScore(poi) * 0.6;
  }

  if (context.age === "6+") {
    return inferBigKidScore(poi) + inferOutdoorScore(poi) * 0.4 - inferToddlerScore(poi) * 0.2;
  }

  return inferToddlerScore(poi) * 0.8 + inferOutdoorScore(poi) * 0.3;
}

function buildDurationBias(context: PlanningContext, poi: RankedPoi): number {
  const destinationScore = inferDestinationScore(poi);
  const neighborhoodScore = inferNeighborhoodScore(poi);

  switch (context.duration) {
    case "1h":
      return poi.distanceKm <= 1.5 ? 1.4 : poi.distanceKm <= 3 ? 0.2 : -2.2 - poi.distanceKm * 0.3;
    case "2h":
      return poi.distanceKm <= 3 ? 0.9 : poi.distanceKm <= 5 ? 0.1 : -1.3;
    case "half-day":
      return destinationScore * 0.6 + inferOutdoorScore(poi) * 0.5 - neighborhoodScore * 0.15;
    case "1d":
      return destinationScore * 0.8 + inferOutdoorScore(poi) * 0.5 - (poi.distanceKm < 0.8 ? 0.4 : 0);
    case "2d1n":
      return destinationScore * 1.25 + (poi.distanceKm > 2 ? 0.5 : -0.2) - neighborhoodScore * 0.7;
    case "3d2n":
      return (
        destinationScore * 2.3 +
        inferBigKidScore(poi) * 0.6 +
        (poi.distanceKm >= 8 ? 3.2 : poi.distanceKm > 4 ? 1.2 : -1.3) -
        neighborhoodScore * 1.3
      );
    default:
      return 0;
  }
}

function isNeighborhoodOnlyPoi(poi: RankedPoi): boolean {
  return inferNeighborhoodScore(poi) > 0.9 && inferDestinationScore(poi) === 0;
}

function filterCandidatesByContext(pois: RankedPoi[], context: PlanningContext): RankedPoi[] {
  return pois.filter((poi) => {
    const destinationScore = inferDestinationScore(poi);

    if (inferPrivatePenalty(poi) > 0) {
      return false;
    }

    if (context.tripType === "today" && context.duration === "1h" && poi.distanceKm > 4) {
      return false;
    }

    if (context.tripType === "today" && context.duration === "2h" && poi.distanceKm > 6) {
      return false;
    }

    if (context.duration === "2d1n" && isNeighborhoodOnlyPoi(poi) && poi.distanceKm < 1.5) {
      return false;
    }

    if (context.duration === "3d2n" && destinationScore === 0) {
      return false;
    }

    return true;
  });
}

function getPoiClusterKey(poi: RankedPoi): string {
  const joinedText = `${poi.name} ${poi.address}`;
  const commercialKeyword = COMMERCIAL_KEYWORDS.find((keyword) =>
    joinedText.toLowerCase().includes(keyword.toLowerCase()),
  );

  if (commercialKeyword) {
    return `commercial:${commercialKeyword.toLowerCase()}`;
  }

  const landmarkCluster = poi.name.match(/(.+?(公园|博物馆|科技馆|乐园|营地|动物园|植物园|海洋馆|自然馆))/);
  if (landmarkCluster?.[1]) {
    return `cluster:${landmarkCluster[1].toLowerCase()}`;
  }

  const scenicBaseName = poi.name.split(/[-·•(（]/)[0]?.trim();
  if (scenicBaseName && scenicBaseName !== poi.name && hasKeyword(scenicBaseName, FAMILY_POSITIVE_KEYWORDS)) {
    return `cluster:${scenicBaseName.toLowerCase()}`;
  }

  return `poi:${poi.name.toLowerCase()}`;
}

export function rankPoisForTrip(pois: RankedPoi[], context: PlanningContext): RankedPoi[] {
  const weatherMode = context.weather.weather === "rain" || context.weather.temp >= 32 ? "indoor" : "outdoor";
  const durationMinutes = parseDurationMinutes(context.duration);

  return [...pois]
    .map((poi) => {
      const sameDistrictBonus =
        context.tripType === "today" && context.district && poi.district === context.district ? 1.8 : 0;
      const distancePenaltyBase = context.tripType === "today" ? 1.35 : context.duration === "3d2n" ? 0.25 : 0.55;
      const shortTripPenalty = durationMinutes <= 60 ? 1.3 : durationMinutes <= 120 ? 1.1 : 0.85;
      const ageDistancePenalty = context.age === "0-3" ? 1.2 : context.age === "6+" ? 0.9 : 1;
      const distancePenalty = poi.distanceKm * distancePenaltyBase * shortTripPenalty * ageDistancePenalty;
      const weatherBonus = weatherMode === "indoor" ? inferIndoorScore(poi) : inferOutdoorScore(poi);
      const ageBonus = buildAgeBonus(context, poi);
      const durationBonus = buildDurationBias(context, poi);
      const destinationBonus =
        context.tripType === "weekend" ? inferDestinationScore(poi) : inferDestinationScore(poi) * 0.2;
      const score =
        poi.rating * 1.4 +
        sameDistrictBonus +
        weatherBonus +
        ageBonus +
        destinationBonus +
        durationBonus -
        inferCommercialPenalty(poi) -
        inferPrivatePenalty(poi) -
        distancePenalty +
        buildScoreJitter(context, poi);
      return { poi, score };
    })
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.poi);
}

export function selectPlanningCandidates(pois: RankedPoi[], limit: number, context?: PlanningContext): RankedPoi[] {
  const scopedPois = context ? filterCandidatesByContext(pois, context) : pois;
  const selected: RankedPoi[] = [];
  const seenClusters = new Set<string>();

  for (const poi of scopedPois) {
    const clusterKey = getPoiClusterKey(poi);
    if (seenClusters.has(clusterKey)) {
      continue;
    }

    seenClusters.add(clusterKey);
    selected.push(poi);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

export function filterFamilyFriendlyPois(pois: RankedPoi[]): RankedPoi[] {
  return pois.filter((poi) => {
    const joinedText = `${poi.name} ${poi.address} ${poi.types.join(" ")}`;
    const signalText = `${poi.name} ${poi.types.join(" ")}`;
    if (inferPrivatePenalty(poi) > 0) {
      return false;
    }

    return hasKeyword(signalText, FAMILY_POSITIVE_KEYWORDS) || hasKeyword(joinedText, DESTINATION_KEYWORDS);
  });
}

function buildWeatherLead(weather: PlanningWeather): string {
  if (weather.weather === "rain") return "今天有雨，行程会更偏向室内、可停留和可避雨的亲子空间。";
  if (weather.temp >= 32) return "今天气温偏高，行程会优先兼顾遮阴、补水和室内休息节点。";
  if (weather.weather === "cloudy") return "今天云层柔和，适合把节奏放得更从容一些。";
  return "今天天气舒展明亮，适合安排更轻盈的亲子活动节奏。";
}

function shouldOfferDepartNow(context: PlanningContext): boolean {
  if (context.tripType === "weekend") {
    return false;
  }

  const hour = getReferenceTime(context).getHours();
  return hour >= 6 && hour < 21;
}

function buildPlanningNotice(context: PlanningContext): string | undefined {
  if (context.tripType !== "today") {
    return undefined;
  }

  const hour = getReferenceTime(context).getHours();
  if (hour >= 21 || hour < 6) {
    return "现在夜深了，宝宝应该进入梦乡。下面优先给你隔天白天更适合执行的方案。";
  }

  return undefined;
}

function formatDistance(distanceKm: number): string {
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`;
}

function roundToNextPlanningSlot(date: Date): Date {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const minutes = next.getMinutes();
  const roundedMinutes = minutes < 30 ? 30 : 60;
  if (roundedMinutes === 60) {
    next.setHours(next.getHours() + 1, 0, 0, 0);
  } else {
    next.setMinutes(roundedMinutes, 0, 0);
  }
  return next;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function clampToLatest(date: Date, hour: number, minute: number): Date {
  const latest = new Date(date);
  latest.setHours(hour, minute, 0, 0);
  return date.getTime() > latest.getTime() ? latest : date;
}

function clampToBaseDayLatest(date: Date, base: Date, hour: number, minute: number): Date {
  const latest = new Date(base);
  latest.setHours(hour, minute, 0, 0);
  return date.getTime() > latest.getTime() ? latest : date;
}

function buildRecommendationReason(context: PlanningContext, poi: RankedPoi): string {
  const isRainy = context.weather.weather === "rain";
  const isHot = context.weather.temp >= 32;
  const isIndoor = inferIndoorScore(poi) > 0;
  const isOutdoor = inferOutdoorScore(poi) > 0;

  if (isRainy && isIndoor) {
    return "更适合避雨停留，孩子活动和家长休息都能保持从容。";
  }

  if (isRainy) {
    return "距离更可控，遇到天气变化也更容易灵活收尾。";
  }

  if (isHot && isIndoor) {
    return "高温天更容易控制体感，适合安排更稳定的亲子停留。";
  }

  if (context.tripType === "today" && context.district && poi.district === context.district) {
    return "同区可达、折返压力更小，适合当天轻松遛娃。";
  }

  if (context.tripType === "weekend" && isOutdoor) {
    return "更适合留出完整时段慢慢玩，能把出行体验拉得更开。";
  }

  if (isOutdoor) {
    return "空间更舒展，适合边走边玩，把节奏放轻一些。";
  }

  return "距离合适、节奏轻松，比较符合短时间内高质量遛娃的体验。";
}

function getRecommendationReachLimit(context: PlanningContext): number {
  if (context.tripType === "weekend") {
    return context.duration === "3d2n" ? 50 : 28;
  }

  switch (context.duration) {
    case "1h":
      return 3.5;
    case "2h":
      return 6;
    case "half-day":
      return 10;
    default:
      return 8;
  }
}

function hasReachableDestinationAlternative(
  poi: RankedPoi,
  pois: RankedPoi[],
  context: PlanningContext,
): boolean {
  const reachLimit = getRecommendationReachLimit(context);

  return pois.some((candidate) => {
    if (candidate.name === poi.name) {
      return false;
    }

    return (
      inferDestinationScore(candidate) > 0 &&
      candidate.distanceKm <= reachLimit &&
      candidate.rating >= poi.rating - 0.6
    );
  });
}

function buildLeadPoiScore(context: PlanningContext, poi: RankedPoi, pois: RankedPoi[]): number {
  const weatherMode = context.weather.weather === "rain" || context.weather.temp >= 32 ? "indoor" : "outdoor";
  const destinationScore = inferDestinationScore(poi);
  const neighborhoodScore = inferNeighborhoodScore(poi);
  const sameDistrictBonus =
    context.tripType === "today" && context.district && poi.district === context.district ? 0.9 : 0;
  const distanceScore =
    context.tripType === "today"
      ? poi.distanceKm <= 1.5
        ? 1.3
        : poi.distanceKm <= 3.5
          ? 0.8
          : poi.distanceKm <= getRecommendationReachLimit(context)
            ? 0.2
            : -1.5
      : poi.distanceKm <= 12
        ? 0.7
        : poi.distanceKm <= 24
          ? 0.2
          : -0.5;
  const weatherFit =
    weatherMode === "indoor" ? inferIndoorScore(poi) * 1.5 : inferOutdoorScore(poi) * 0.7 + inferIndoorScore(poi) * 0.2;
  const destinationBoost =
    destinationScore *
    (context.tripType === "weekend" ? 2.9 : context.duration === "1h" ? 1.1 : context.duration === "2h" ? 2 : 2.5);
  const genericLeadPenalty =
    isGenericNeighborhoodPark(poi) && hasReachableDestinationAlternative(poi, pois, context)
      ? context.tripType === "weekend"
        ? 4.2
        : context.duration === "1h"
          ? 1.4
          : 3.2
      : 0;

  return (
    poi.rating * 1.1 +
    sameDistrictBonus +
    distanceScore +
    weatherFit +
    destinationBoost +
    buildAgeBonus(context, poi) * 0.35 -
    neighborhoodScore * (context.tripType === "weekend" ? 2.1 : 1.1) -
    genericLeadPenalty
  );
}

function prioritizeRecommendationPois(context: PlanningContext, pois: RankedPoi[]): RankedPoi[] {
  return [...pois].sort(
    (left, right) => buildLeadPoiScore(context, right, pois) - buildLeadPoiScore(context, left, pois),
  );
}

interface ScheduleBlueprint {
  title: string;
  summary: string;
  offsets: number[];
}

function getReferenceTime(context: PlanningContext): Date {
  return context.currentTime ? new Date(context.currentTime) : new Date();
}

function buildBaseStart(context: PlanningContext, mode: "depart-now" | "regular-rhythm", dayIndex: number): Date {
  const reference = getReferenceTime(context);

  if (mode === "depart-now" && dayIndex === 0) {
    return roundToNextPlanningSlot(reference);
  }

  const base = new Date(reference);
  base.setDate(base.getDate() + dayIndex);

  const hourMinute =
    context.tripType === "today"
      ? context.duration === "half-day"
        ? { hour: 9, minute: 30 }
        : { hour: 10, minute: 0 }
      : dayIndex === 0
        ? { hour: 10, minute: 0 }
        : { hour: 9, minute: 45 };

  base.setHours(hourMinute.hour, hourMinute.minute, 0, 0);
  return base;
}

function buildScheduleBlueprints(context: PlanningContext): ScheduleBlueprint[] {
  if (context.tripType === "today") {
    if (context.duration === "1h") {
      return [{ title: "当日", summary: "压缩成一条真正可执行的短时路线。", offsets: [0, 45] }];
    }

    if (context.duration === "half-day") {
      return [{ title: "当日", summary: "把可玩、可休息和收尾都留在同一条顺路动线上。", offsets: [0, 75, 165, 240] }];
    }

    return [{ title: "当日", summary: "优先保证主目的地停留质量，再补一站顺路玩法。", offsets: [0, 60, 120] }];
  }

  if (context.duration === "2d1n") {
    return [
      { title: "D1", summary: "先把第一天留给最值当的主场馆或主公园。", offsets: [0, 150, 330] },
      { title: "D2", summary: "第二天用更从容的节奏收口，避免最后一天太赶。", offsets: [0, 150, 300] },
    ];
  }

  if (context.duration === "3d2n") {
    return [
      { title: "D1", summary: "第一天以进入状态和主体验为主，不把行程铺得过满。", offsets: [0, 120, 300] },
      { title: "D2", summary: "第二天放最长的主体验时段，留足探索空间。", offsets: [0, 150, 330] },
      { title: "D3", summary: "第三天以轻量收尾和返程前的最后一站为主。", offsets: [0, 150, 300] },
    ];
  }

  return [{ title: "当日", summary: "适合完整留出一天，按天气和体力慢慢玩。", offsets: [0, 150, 300, 510] }];
}

function buildModeSpecificPoiList(
  context: PlanningContext,
  pois: RankedPoi[],
  mode: "depart-now" | "regular-rhythm",
): RankedPoi[] {
  const referenceHour = getReferenceTime(context).getHours();
  const isLateDeparture = referenceHour >= 17;
  const isRainyOrHot = context.weather.weather === "rain" || context.weather.temp >= 32;

  return [...pois].sort((left, right) => {
    const compare = (poi: RankedPoi) => {
      const destinationScore = inferDestinationScore(poi);
      const neighborhoodScore = inferNeighborhoodScore(poi);
      const indoorScore = inferIndoorScore(poi);
      const outdoorScore = inferOutdoorScore(poi);
      const sameDistrictBonus =
        context.tripType === "today" && context.district && poi.district === context.district ? 1.2 : 0;

      if (mode === "depart-now") {
        return (
          poi.rating * 0.6 +
          sameDistrictBonus +
          (poi.distanceKm <= 1 ? 2.4 : poi.distanceKm <= 2.5 ? 1.3 : -poi.distanceKm * 0.35) +
          (isRainyOrHot || isLateDeparture ? indoorScore * 1.7 : outdoorScore * 0.5) +
          (isLateDeparture ? neighborhoodScore * 0.8 - destinationScore * 0.35 : 0)
        );
      }

      return (
        poi.rating * 0.6 +
        destinationScore * 2.2 +
        buildDurationBias(context, poi) * 0.8 +
        (context.age === "6+" ? inferBigKidScore(poi) * 0.7 : inferToddlerScore(poi) * 0.2) +
        (context.tripType === "weekend" ? outdoorScore * 0.7 : 0) -
        neighborhoodScore * (context.duration === "3d2n" ? 1.3 : 0.3) +
        buildLeadPoiScore(context, poi, pois) * 0.35
      );
    };

    return compare(right) - compare(left);
  });
}

function buildLiveOffsets(
  context: PlanningContext,
  mode: "depart-now" | "regular-rhythm",
  offsets: number[],
  dayIndex: number,
): number[] {
  if (mode !== "depart-now" || dayIndex > 0) {
    return offsets;
  }

  const hour = getReferenceTime(context).getHours();

  if (hour >= 21) {
    return offsets.map((_, index) => index * 20);
  }

  if (hour >= 19) {
    return offsets.map((_, index) => index * 30);
  }

  if (hour >= 17) {
    return offsets.map((offset) => Math.round(offset * 0.6));
  }

  return offsets;
}

function pickPoi(pois: RankedPoi[], index: number): RankedPoi | undefined {
  if (!pois.length) {
    return undefined;
  }

  return pois[index];
}

function getBlockPoiIndexes(
  context: PlanningContext,
  dayIndex: number,
): [number, number, number] {
  if (context.tripType === "weekend") {
    const baseIndex = dayIndex * 3;
    return [baseIndex, baseIndex + 1, baseIndex + 2];
  }

  const baseIndex = dayIndex * 2;
  return [baseIndex, baseIndex + 1, baseIndex + 2];
}

function buildMultiStopText(primary: RankedPoi | undefined, secondary: RankedPoi | undefined, fallback: string): string {
  if (primary && secondary && primary.name !== secondary.name) {
    return `${primary.name} 和 ${secondary.name}`;
  }

  return primary?.name || secondary?.name || fallback;
}

function buildBlockItems(
  context: PlanningContext,
  block: ScheduleBlueprint,
  mode: "depart-now" | "regular-rhythm",
  dayIndex: number,
  pois: RankedPoi[],
): PlanItem[] {
  const start = buildBaseStart(context, mode, dayIndex);
  const modePois = buildModeSpecificPoiList(context, pois, mode);
  const liveOffsets = buildLiveOffsets(context, mode, block.offsets, dayIndex);
  const [primaryIndex, secondaryIndex, tertiaryIndex] = getBlockPoiIndexes(context, dayIndex);
  const primary = pickPoi(modePois, primaryIndex);
  const secondary = pickPoi(modePois, secondaryIndex);
  const tertiary = pickPoi(modePois, tertiaryIndex);
  const exploratoryStop = buildMultiStopText(secondary, tertiary, primary?.name || "附近合适地点");

  return liveOffsets.map((offset, itemIndex) => {
    const candidate = addMinutes(start, offset);
    const scheduled =
      mode === "depart-now" && dayIndex === 0
        ? clampToBaseDayLatest(candidate, start, 23, 30)
        : context.tripType === "weekend"
          ? clampToLatest(candidate, 21, 30)
          : clampToLatest(candidate, 23, 30);
    const time = formatClock(scheduled);

    if (context.tripType === "today") {
      if (block.offsets.length === 2) {
        return itemIndex === 0
          ? { time, action: `从${context.locationLabel}直接出发，优先把这一小时留给 ${primary?.name || "附近适合的亲子地点"}。` }
          : { time, action: `在 ${buildMultiStopText(primary, secondary, "附近可顺路停留的地点")} 一带轻松收尾，补水后返程。` };
      }

      if (block.offsets.length === 4) {
        const actions = [
          mode === "depart-now"
            ? `从${context.locationLabel}出发，先去 ${primary?.name || "附近适合的亲子地点"}，优先接住你现在这段最容易执行的时段。`
            : `从${context.locationLabel}出发，先去 ${primary?.name || "附近适合的亲子地点"}，把主体验拉开。`,
          secondary
            ? mode === "depart-now"
              ? `第二段切到 ${secondary.name}，尽量减少折返，把当下还来得及的一站接上。`
              : `状态稳定的话，把第二段留给 ${secondary.name}，让孩子在不同节奏里切换。`
            : "中段以补水、休息和自由探索为主，不额外压行程。",
          secondary
            ? `中后段预留给 ${exploratoryStop} 周边，安排吃饭或短休。`
            : "中后段以吃饭和短休为主，保持孩子体力。",
          tertiary
            ? `最后一段把 ${tertiary.name} 当作柔和收尾，别等到过度兴奋才结束。`
            : "在孩子还有余力时结束主行程，保持轻松返程。",
        ];

        return { time, action: actions[itemIndex] };
      }

      const actions = [
        mode === "depart-now"
          ? `从${context.locationLabel}出发，先去 ${primary?.name || "附近适合的亲子地点"}，优先走一条现在就能顺着执行的路线。`
          : `从${context.locationLabel}出发，先去 ${primary?.name || "附近适合的亲子地点"}。`,
        secondary
          ? mode === "depart-now"
            ? `如果现场状态还不错，再把 ${secondary.name} 作为补充一站，不强行把节奏拉太满。`
            : `如果孩子状态不错，再顺路补一站 ${secondary.name}，让体验更完整。`
          : "中段安排补水、休息和自由玩耍，不把节奏压得太满。",
        `在 ${buildMultiStopText(primary, secondary, "主地点周边")} 轻松收尾，保留返程体力。`,
      ];

      return { time, action: actions[itemIndex] };
    }

    const dayLabel = block.title;
    const actions = [
      dayIndex === 0
        ? mode === "depart-now"
          ? `从${context.locationLabel}出发，先把 ${primary?.name || "主目的地"} 作为 ${dayLabel} 里最适合你当前出发时段的核心体验。`
          : `从${context.locationLabel}出发，先把 ${primary?.name || "主目的地"} 作为 ${dayLabel} 的核心体验。`
        : mode === "depart-now"
          ? `今天先去 ${primary?.name || "主目的地"}，把更完整的白天时段留给当下更值得跑的一站。`
          : `今天先去 ${primary?.name || "主目的地"}，把更完整的白天时段留给它。`,
      secondary
        ? `中段切到 ${secondary.name}，把室内外或动静节奏拉开，不让孩子一直待在同一种场景里。`
        : `中段保留机动时间，在 ${primary?.name || "主地点"} 周边吃饭、休息和继续停留。`,
      tertiary
        ? `尾声留给 ${tertiary.name}，作为 ${dayLabel} 的柔和收尾，再从容返程或回酒店休息。`
        : `尾声以补给和回程为主，不强行塞满最后一段。`,
      tertiary
        ? `如果当天状态仍然轻松，可把 ${tertiary.name} 附近的餐食和散步一起并入收官时段。`
        : "晚段以吃饭和休息为主，让第二天还有充足体力。",
    ];

    return { time, action: actions[itemIndex] || actions[actions.length - 1] };
  });
}

function flattenBlocks(blocks: ScheduleBlock[]): PlanItem[] {
  return blocks.flatMap((block) =>
    blocks.length > 1
      ? block.items.map((item) => ({ ...item, action: `${block.title} · ${item.action}` }))
      : block.items,
  );
}

function buildScheduleOptions(context: PlanningContext, pois: RankedPoi[]): ScheduleOption[] {
  const blueprints = buildScheduleBlueprints(context);
  const regularOption: ScheduleOption = {
    id: "regular-rhythm",
    label: context.tripType === "weekend" ? "假期节奏版" : "正常作息版",
    description:
      context.tripType === "weekend"
        ? "按更适合小长假白天执行的节奏安排，不额外提供当前时段临时出发版。"
        : shouldOfferDepartNow(context)
          ? "按更常见的亲子出门节奏重排，方便改成明天或周末白天执行。"
          : "今晚更建议让孩子休息，这里优先给你隔天白天可执行的方案。",
    blocks: blueprints.map((block, dayIndex) => ({
      title: block.title,
      summary: block.summary,
      items: buildBlockItems(context, block, "regular-rhythm", dayIndex, pois),
    })),
  };

  if (!shouldOfferDepartNow(context)) {
    return [regularOption];
  }

  return [
    {
      id: "depart-now",
      label: "现在出发版",
      description: "按你点击生成方案的当下时间起步，优先保证接下来这段时间真的可执行。",
      blocks: blueprints.map((block, dayIndex) => ({
        title: block.title,
        summary: dayIndex === 0 ? "更贴合你现在的时间窗口。" : block.summary,
        items: buildBlockItems(context, block, "depart-now", dayIndex, pois),
      })),
    },
    regularOption,
  ];
}

export function buildRealtimePlan(context: PlanningContext, pois: RankedPoi[]): PlanResultShape {
  const recommendationLimit =
    context.tripType === "today" ? 3 : context.duration === "3d2n" ? 6 : context.duration === "2d1n" ? 5 : 4;
  const topPois = prioritizeRecommendationPois(context, pois).slice(0, recommendationLimit);
  const primary = topPois[0];
  const summaryLead = buildWeatherLead(context.weather);
  const notice = buildPlanningNotice(context);

  if (!topPois.length) {
    return buildFallbackPlan(context, []);
  }

  const scheduleOptions = buildScheduleOptions(context, topPois);
  const plan = flattenBlocks(scheduleOptions[0].blocks);

  return {
    summary:
      context.tripType === "weekend"
        ? `${summaryLead} 这次会按 ${context.duration} 的假期节奏来安排，每天的主体验和收尾顺序会更稳定。`
        : notice
          ? `${summaryLead} 今晚更适合先休息，下面优先给你隔天白天更合适执行的路线。`
          : `${summaryLead} 这次会同时兼顾你现在就出发是否顺路，以及明天白天正常出门时怎样更稳妥。`,
    plan,
    scheduleOptions,
    notice,
    recommendations: topPois.map((poi) => ({
      name: poi.name,
      reason: buildRecommendationReason(context, poi),
      distance: formatDistance(poi.distanceKm),
      lat: poi.lat,
      lng: poi.lng,
      address: poi.address,
    })),
  };
}

export function buildFallbackPlan(context: PlanningContext, pois: RankedPoi[]): PlanResultShape {
  const recommendationLimit =
    context.tripType === "today" ? 3 : context.duration === "3d2n" ? 6 : context.duration === "2d1n" ? 5 : 4;
  const topPois = prioritizeRecommendationPois(context, pois).slice(0, recommendationLimit);
  const primary = topPois[0];
  const notice = buildPlanningNotice(context);
  const recommendationReason =
    context.weather.weather === "rain" || context.weather.temp >= 32
      ? "更适合在天气不稳定时停留，孩子活动和家长休息都更从容。"
      : "距离合适、节奏轻松，比较符合短时间内高质量遛娃的体验。";
  const recommendations = topPois.length
    ? topPois.map((poi) => ({
        name: poi.name,
        reason: recommendationReason,
        distance: formatDistance(poi.distanceKm),
        lat: poi.lat,
        lng: poi.lng,
        address: poi.address,
      }))
    : [
        {
          name: `${context.locationLabel} 附近亲子空间`,
          reason: recommendationReason,
          distance: "就近",
          address: context.locationLabel,
        },
      ];
  const scheduleOptions = buildScheduleOptions(
    context,
    topPois.length
      ? topPois
      : [
          {
            name: `${context.locationLabel} 附近亲子空间`,
            lat: 0,
            lng: 0,
            rating: 4.5,
            address: context.locationLabel,
            types: ["fallback"],
            distanceKm: 0,
            district: context.district,
          },
        ],
  );

  return {
    summary: `${buildWeatherLead(context.weather)} 本次先围绕 ${context.locationLabel} 安排一条更稳妥的路线，尽量把路程、停留体验和孩子体力消耗控制在舒适区间。`,
    plan: flattenBlocks(scheduleOptions[0].blocks),
    scheduleOptions,
    notice,
    recommendations,
  };
}
