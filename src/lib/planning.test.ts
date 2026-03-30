import { describe, expect, it } from "vitest";
import {
  buildFallbackPlan,
  buildPlanningCurrentTime,
  buildRealtimePlan,
  resolvePlanningCurrentTime,
  buildScopedLocationLabel,
  filterFamilyFriendlyPois,
  rankPoisForTrip,
  selectPlanningCandidates,
  type PlanningContext,
} from "./planning";

const context: PlanningContext = {
  tripType: "today",
  age: "3-6",
  duration: "2h",
  locationLabel: "杭州市 西湖区",
  weather: {
    temp: 28,
    weather: "sunny",
  },
};

describe("planning helpers", () => {
  it("uses city and district for same-day labels", () => {
    expect(
      buildScopedLocationLabel(
        {
          name: "浙江省 杭州市 西湖区",
          city: "杭州市",
          district: "西湖区",
        },
        "today",
      ),
    ).toBe("杭州市 西湖区");
  });

  it("uses city only for weekend labels", () => {
    expect(
      buildScopedLocationLabel(
        {
          name: "浙江省 杭州市 西湖区",
          city: "杭州市",
          district: "西湖区",
        },
        "weekend",
      ),
    ).toBe("杭州市");
  });

  it("down-ranks commercial-heavy nearby options for same-day trips", () => {
    const ranked = rankPoisForTrip(
      [
        {
          name: "来福士亲子乐园",
          lat: 30.27,
          lng: 120.16,
          rating: 4.8,
          address: "上城区来福士广场",
          types: ["indoor_play"],
          distanceKm: 0.4,
          district: "上城区",
        },
        {
          name: "西湖区儿童公园",
          lat: 30.28,
          lng: 120.12,
          rating: 4.6,
          address: "西湖区少年路",
          types: ["park", "playground"],
          distanceKm: 1.8,
          district: "西湖区",
        },
      ],
      { ...context, district: "西湖区" },
    );

    expect(ranked[0].name).toBe("西湖区儿童公园");
  });

  it("builds a fallback plan with valid plan and recommendations", () => {
    const result = buildFallbackPlan(
      {
        ...context,
        tripType: "weekend",
        duration: "1d",
        locationLabel: "杭州市",
        district: undefined,
      },
      [
        {
          name: "杭州少年儿童公园",
          lat: 30.24,
          lng: 120.15,
          rating: 4.7,
          address: "杭州市西湖区虎跑路",
          types: ["park", "playground"],
          distanceKm: 6.2,
          district: "西湖区",
        },
      ],
    );

    expect(result.summary).toContain("杭州市");
    expect(result.plan.length).toBeGreaterThan(0);
    expect(result.recommendations[0].name).toBe("杭州少年儿童公园");
  });

  it("keeps planning candidates diverse instead of clustering in one mall", () => {
    const candidates = selectPlanningCandidates(
      [
        {
          name: "来福士亲子乐园",
          lat: 30.27,
          lng: 120.16,
          rating: 4.8,
          address: "上城区来福士广场",
          types: ["indoor_play"],
          distanceKm: 0.4,
          district: "上城区",
        },
        {
          name: "来福士儿童剧场",
          lat: 30.271,
          lng: 120.161,
          rating: 4.7,
          address: "上城区来福士广场",
          types: ["indoor_play"],
          distanceKm: 0.5,
          district: "上城区",
        },
        {
          name: "杭州少年儿童公园",
          lat: 30.24,
          lng: 120.15,
          rating: 4.7,
          address: "杭州市西湖区虎跑路",
          types: ["park", "playground"],
          distanceKm: 6.2,
          district: "西湖区",
        },
      ],
      3,
    );

    expect(candidates).toHaveLength(2);
    expect(candidates[0].name).toBe("来福士亲子乐园");
    expect(candidates[1].name).toBe("杭州少年儿童公园");
  });

  it("deduplicates sub-spots within the same park cluster", () => {
    const candidates = selectPlanningCandidates(
      [
        {
          name: "美丽洲公园",
          lat: 30.37,
          lng: 120.02,
          rating: 4.8,
          address: "余杭区美丽洲路",
          types: ["park"],
          distanceKm: 1.2,
          district: "余杭区",
        },
        {
          name: "美丽洲公园-观复台",
          lat: 30.371,
          lng: 120.021,
          rating: 4.7,
          address: "余杭区美丽洲路",
          types: ["park"],
          distanceKm: 1.3,
          district: "余杭区",
        },
        {
          name: "玉鸟集原野公园",
          lat: 30.38,
          lng: 120.04,
          rating: 4.6,
          address: "余杭区良渚街道",
          types: ["park"],
          distanceKm: 1.9,
          district: "余杭区",
        },
      ],
      3,
    );

    expect(candidates).toHaveLength(2);
    expect(candidates.map((item) => item.name)).toEqual(["美丽洲公园", "玉鸟集原野公园"]);
  });

  it("still returns one recommendation when no POIs are available", () => {
    const result = buildFallbackPlan(context, []);

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].name).toContain("附近亲子空间");
  });

  it("filters out non-family-friendly places before planning", () => {
    const filtered = filterFamilyFriendlyPois([
      {
        name: "红峰建材批发",
        lat: 31.18,
        lng: 121.43,
        rating: 4.1,
        address: "徐汇区建材市场",
        types: ["购物服务", "建材五金市场"],
        distanceKm: 0.3,
        district: "徐汇区",
      },
      {
        name: "徐汇滨江儿童公园",
        lat: 31.18,
        lng: 121.44,
        rating: 4.7,
        address: "徐汇区滨江路",
        types: ["park", "playground"],
        distanceKm: 1.2,
        district: "徐汇区",
      },
      {
        name: "光启公园公厕",
        lat: 31.18,
        lng: 121.44,
        rating: 4.5,
        address: "徐汇区南丹路",
        types: ["公共设施", "公共厕所"],
        distanceKm: 0.2,
        district: "徐汇区",
      },
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("徐汇滨江儿童公园");
  });

  it("filters out private or internal venues even if they look family-related", () => {
    const filtered = filterFamilyFriendlyPois([
      {
        name: "良渚亲子会员会所",
        lat: 30.37,
        lng: 120.03,
        rating: 4.6,
        address: "余杭区良渚文化村会所",
        types: ["indoor_play"],
        distanceKm: 0.6,
        district: "余杭区",
      },
      {
        name: "良渚儿童公园",
        lat: 30.38,
        lng: 120.04,
        rating: 4.7,
        address: "余杭区良渚街道",
        types: ["park", "playground"],
        distanceKm: 1.2,
        district: "余杭区",
      },
    ]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("良渚儿童公园");
  });

  it("filters unnamed or generic square-like places from recommendations", () => {
    const filtered = filterFamilyFriendlyPois([
      {
        name: "未命名场所",
        lat: 30.37,
        lng: 120.03,
        rating: 4.2,
        address: "附近区域",
        types: ["park"],
        distanceKm: 0.6,
        district: "余杭区",
      },
      {
        name: "良渚十六街区新广场",
        lat: 30.38,
        lng: 120.04,
        rating: 4.3,
        address: "余杭区良渚街道",
        types: ["park"],
        distanceKm: 1.2,
        district: "余杭区",
      },
      {
        name: "良渚博物院",
        lat: 30.39,
        lng: 120.05,
        rating: 4.8,
        address: "余杭区美丽洲路",
        types: ["museum"],
        distanceKm: 2.8,
        district: "余杭区",
      },
    ]);

    expect(filtered.map((item) => item.name)).toEqual(["良渚博物院"]);
  });

  it("filters out office, junction, and lodging POIs even when nearby streets sound kid-friendly", () => {
    const filtered = filterFamilyFriendlyPois([
      {
        name: "国泰海通证券杭州滨江科技馆街营业部",
        lat: 30.21,
        lng: 120.21,
        rating: 4.6,
        address: "滨江区科技馆街88号",
        types: ["金融保险服务", "证券公司"],
        distanceKm: 0.8,
        district: "滨江区",
      },
      {
        name: "江陵路与科技馆街交叉口",
        lat: 30.212,
        lng: 120.212,
        rating: 4.5,
        address: "滨江区科技馆街",
        types: ["地名地址信息", "交通地名"],
        distanceKm: 0.9,
        district: "滨江区",
      },
      {
        name: "隐宿公寓露民宿(科技馆街分店)",
        lat: 30.213,
        lng: 120.214,
        rating: 4.7,
        address: "滨江区科技馆街116号",
        types: ["住宿服务", "民宿"],
        distanceKm: 1.2,
        district: "滨江区",
      },
      {
        name: "杭州低碳科技馆",
        lat: 30.215,
        lng: 120.215,
        rating: 4.8,
        address: "滨江区江汉路1888号",
        types: ["科教文化服务", "科技馆"],
        distanceKm: 1.5,
        district: "滨江区",
      },
    ]);

    expect(filtered.map((item) => item.name)).toEqual(["杭州低碳科技馆"]);
  });

  it("applies the same family-friendly filtering rules across other cities too", () => {
    const filtered = filterFamilyFriendlyPois([
      {
        name: "深圳科技馆街道办事处",
        lat: 22.54,
        lng: 114.06,
        rating: 4.5,
        address: "福田区科技馆路18号",
        types: ["政府机构及社会团体", "街道办事处"],
        distanceKm: 0.7,
        district: "福田区",
      },
      {
        name: "广州动物园路社区服务中心",
        lat: 23.15,
        lng: 113.33,
        rating: 4.4,
        address: "越秀区动物园路66号",
        types: ["生活服务", "社区服务"],
        distanceKm: 0.9,
        district: "越秀区",
      },
      {
        name: "上海自然博物馆",
        lat: 31.23,
        lng: 121.46,
        rating: 4.8,
        address: "静安区北京西路510号",
        types: ["科教文化服务", "博物馆"],
        distanceKm: 1.4,
        district: "静安区",
      },
      {
        name: "成都海昌极地海洋公园",
        lat: 30.52,
        lng: 104.07,
        rating: 4.8,
        address: "天府新区华阳海洋路68号",
        types: ["风景名胜", "海洋馆"],
        distanceKm: 6.5,
        district: "双流区",
      },
    ]);

    expect(filtered.map((item) => item.name)).toEqual(["上海自然博物馆", "成都海昌极地海洋公园"]);
  });

  it("builds deterministic recommendations directly from the ranked realtime POIs", () => {
    const result = buildRealtimePlan(
      {
        ...context,
        currentTime: "2026-03-28T14:18:00+08:00",
      },
      [
        {
          name: "徐汇滨江儿童公园",
          lat: 31.18,
          lng: 121.44,
          rating: 4.7,
          address: "徐汇区滨江路",
          types: ["park", "playground"],
          distanceKm: 1.2,
          district: "徐汇区",
        },
        {
          name: "徐家汇公园",
          lat: 31.19,
          lng: 121.43,
          rating: 4.6,
          address: "徐汇区肇嘉浜路",
          types: ["park"],
          distanceKm: 1.5,
          district: "徐汇区",
        },
      ],
    );

    expect(result.recommendations.map((item) => item.name)).toHaveLength(2);
    expect(new Set(result.recommendations.map((item) => item.name))).toEqual(
      new Set(["徐汇滨江儿童公园", "徐家汇公园"]),
    );
    expect(
      ["徐汇滨江儿童公园", "徐家汇公园"].some((name) => result.plan[0].action.includes(name)),
    ).toBe(true);
  });

  it("uses indoor-oriented reasons for rainy realtime plans", () => {
    const result = buildRealtimePlan(
      {
        ...context,
        weather: {
          temp: 19,
          weather: "rain",
        },
      },
      [
        {
          name: "亲子室内乐园",
          lat: 31.18,
          lng: 121.44,
          rating: 4.8,
          address: "徐汇区室内馆",
          types: ["indoor_play"],
          distanceKm: 0.8,
          district: "徐汇区",
        },
      ],
    );

    expect(result.recommendations[0].reason).toContain("避雨");
    expect(result.summary).toContain("室内");
  });

  it("changes ranking when age and duration preferences change", () => {
    const pois = [
      {
        name: "亲子室内乐园",
        lat: 31.18,
        lng: 121.44,
        rating: 4.6,
        address: "徐汇区室内馆",
        types: ["indoor_play"],
        distanceKm: 0.8,
        district: "西湖区",
      },
      {
        name: "自然科学探索馆",
        lat: 31.2,
        lng: 121.46,
        rating: 4.8,
        address: "西湖区科创路",
        types: ["museum", "science"],
        distanceKm: 3.2,
        district: "西湖区",
      },
    ];

    const toddlerShortTrip = rankPoisForTrip(pois, {
      ...context,
      age: "0-3",
      duration: "1h",
      weather: { temp: 31, weather: "sunny" },
      district: "西湖区",
    });

    const olderLongTrip = rankPoisForTrip(pois, {
      ...context,
      age: "6+",
      duration: "half-day",
      weather: { temp: 24, weather: "sunny" },
      district: "西湖区",
    });

    expect(toddlerShortTrip[0].name).toBe("亲子室内乐园");
    expect(olderLongTrip[0].name).toBe("自然科学探索馆");
  });

  it("builds timeline from the current request time instead of fixed morning slots", () => {
    const result = buildRealtimePlan(
      {
        ...context,
        duration: "2h",
        currentTime: "2026-03-28T14:18:00+08:00",
      },
      [
        {
          name: "徐汇滨江儿童公园",
          lat: 31.18,
          lng: 121.44,
          rating: 4.7,
          address: "徐汇区滨江路",
          types: ["park", "playground"],
          distanceKm: 1.2,
          district: "西湖区",
        },
      ],
    );

    expect(result.plan[0].time).toBe("14:30");
    expect(result.plan[1].time).not.toBe("11:00");
    expect(result.plan[2].time).not.toBe("12:30");
  });

  it("compresses late-night depart-now timelines instead of spilling into deep night", () => {
    const result = buildRealtimePlan(
      {
        ...context,
        duration: "half-day",
        currentTime: "2026-03-28T22:18:00+08:00",
        locationLabel: "杭州市 余杭区",
        district: "余杭区",
      },
      [
        {
          name: "余杭邻里儿童公园",
          lat: 30.38,
          lng: 120.04,
          rating: 4.6,
          address: "余杭区良渚街道",
          types: ["park", "playground"],
          distanceKm: 0.7,
          district: "余杭区",
        },
        {
          name: "亲子室内乐园",
          lat: 30.385,
          lng: 120.045,
          rating: 4.7,
          address: "余杭区商业街",
          types: ["indoor_play"],
          distanceKm: 1.3,
          district: "余杭区",
        },
      ],
    );

    expect(result.scheduleOptions?.[0].blocks[0].items.every((item) => item.time <= "23:30")).toBe(true);
  });

  it("shows a rest advisory and only next-day planning after 21:00 for same-day trips", () => {
    const result = buildRealtimePlan(
      {
        ...context,
        duration: "2h",
        currentTime: "2026-03-28T21:18:00+08:00",
        locationLabel: "杭州市 余杭区",
        district: "余杭区",
      },
      [
        {
          name: "余杭邻里儿童公园",
          lat: 30.38,
          lng: 120.04,
          rating: 4.6,
          address: "余杭区良渚街道",
          types: ["park", "playground"],
          distanceKm: 0.7,
          district: "余杭区",
        },
        {
          name: "亲子室内乐园",
          lat: 30.385,
          lng: 120.045,
          rating: 4.7,
          address: "余杭区商业街",
          types: ["indoor_play"],
          distanceKm: 1.3,
          district: "余杭区",
        },
      ],
    );

    expect(result.notice).toContain("现在夜深了");
    expect(result.notice).toContain("宝宝应该进入梦乡");
    expect(result.scheduleOptions).toHaveLength(1);
    expect(result.scheduleOptions[0].id).toBe("regular-rhythm");
    expect(result.scheduleOptions[0].description).toContain("隔天");
  });

  it("treats after-midnight same-day requests as night rest time too", () => {
    const result = buildRealtimePlan(
      {
        ...context,
        duration: "2h",
        currentTime: "2026-03-29T00:18:00+08:00",
        locationLabel: "杭州市 滨江区",
        district: "滨江区",
      },
      [
        {
          name: "杭州低碳科技馆",
          lat: 30.215,
          lng: 120.215,
          rating: 4.8,
          address: "滨江区江汉路1888号",
          types: ["museum", "science"],
          distanceKm: 1.5,
          district: "滨江区",
        },
        {
          name: "滨江儿童公园",
          lat: 30.214,
          lng: 120.216,
          rating: 4.7,
          address: "滨江区闻涛路",
          types: ["park", "playground"],
          distanceKm: 1.7,
          district: "滨江区",
        },
      ],
    );

    expect(result.notice).toContain("现在夜深了");
    expect(result.scheduleOptions).toHaveLength(1);
    expect(result.scheduleOptions[0].id).toBe("regular-rhythm");
  });

  it("formats server planning timestamps in Asia/Shanghai instead of raw UTC", () => {
    expect(buildPlanningCurrentTime(new Date("2026-03-29T15:07:32.899Z"))).toBe("2026-03-29T23:07:32+08:00");
  });

  it("keeps an explicit planning time override when it is valid", () => {
    expect(resolvePlanningCurrentTime("2026-03-30T21:18:00+08:00", new Date("2026-03-30T10:00:00Z"))).toBe(
      "2026-03-30T21:18:00+08:00",
    );
  });

  it("falls back to Shanghai planning time when an override is invalid", () => {
    expect(resolvePlanningCurrentTime("not-a-time", new Date("2026-03-30T15:07:32.899Z"))).toBe(
      "2026-03-30T23:07:32+08:00",
    );
  });

  it("returns two schedule options for realtime plans", () => {
    const result = buildRealtimePlan(
      {
        ...context,
        duration: "half-day",
        currentTime: "2026-03-28T14:18:00+08:00",
      },
      [
        {
          name: "良渚儿童公园",
          lat: 30.38,
          lng: 120.04,
          rating: 4.7,
          address: "余杭区良渚街道",
          types: ["park", "playground"],
          distanceKm: 1.2,
          district: "余杭区",
        },
        {
          name: "良渚博物院",
          lat: 30.39,
          lng: 120.05,
          rating: 4.8,
          address: "余杭区美丽洲路",
          types: ["museum"],
          distanceKm: 2.8,
          district: "余杭区",
        },
      ],
    );

    expect(result.scheduleOptions).toHaveLength(2);
    expect(result.scheduleOptions?.map((option) => option.id)).toEqual(["depart-now", "regular-rhythm"]);
    expect(result.scheduleOptions?.[0].blocks[0].items[0].time).toBe("14:30");
    expect(result.scheduleOptions?.[1].blocks[0].items[0].time).not.toBe("14:30");
  });

  it("returns only the regular holiday schedule for weekend trips", () => {
    const result = buildRealtimePlan(
      {
        ...context,
        tripType: "weekend",
        duration: "2d1n",
        locationLabel: "杭州市",
        district: undefined,
        currentTime: "2026-03-28T14:18:00+08:00",
      },
      [
        {
          name: "良渚博物院",
          lat: 30.39,
          lng: 120.05,
          rating: 4.8,
          address: "余杭区美丽洲路",
          types: ["museum"],
          distanceKm: 2.8,
          district: "余杭区",
        },
        {
          name: "良渚古城遗址公园",
          lat: 30.4,
          lng: 120.02,
          rating: 4.9,
          address: "余杭区瓶窑镇",
          types: ["park", "heritage"],
          distanceKm: 7.8,
          district: "余杭区",
        },
      ],
    );

    expect(result.scheduleOptions).toHaveLength(1);
    expect(result.scheduleOptions[0].id).toBe("regular-rhythm");
  });

  it("builds meaningfully different lead plans for depart-now and regular-rhythm", () => {
    const result = buildRealtimePlan(
      {
        ...context,
        tripType: "today",
        duration: "half-day",
        currentTime: "2026-03-28T18:18:00+08:00",
        district: "余杭区",
        locationLabel: "杭州市 余杭区",
      },
      [
        {
          name: "余杭邻里儿童公园",
          lat: 30.38,
          lng: 120.04,
          rating: 4.6,
          address: "余杭区良渚街道",
          types: ["park", "playground"],
          distanceKm: 0.7,
          district: "余杭区",
        },
        {
          name: "良渚博物院",
          lat: 30.39,
          lng: 120.05,
          rating: 4.8,
          address: "余杭区美丽洲路",
          types: ["museum"],
          distanceKm: 2.8,
          district: "余杭区",
        },
        {
          name: "亲子室内乐园",
          lat: 30.385,
          lng: 120.045,
          rating: 4.7,
          address: "余杭区商业街",
          types: ["indoor_play"],
          distanceKm: 1.3,
          district: "余杭区",
        },
      ],
    );

    expect(result.scheduleOptions?.[0].blocks[0].items[0].action).not.toBe(
      result.scheduleOptions?.[1].blocks[0].items[0].action,
    );
  });

  it("builds a true three-day itinerary for 3d2n trips", () => {
    const result = buildRealtimePlan(
      {
        ...context,
        tripType: "weekend",
        duration: "3d2n",
        locationLabel: "杭州市",
        district: undefined,
        currentTime: "2026-03-28T16:18:00+08:00",
      },
      [
        {
          name: "良渚古城遗址公园",
          lat: 30.4,
          lng: 120.02,
          rating: 4.9,
          address: "余杭区瓶窑镇",
          types: ["park", "heritage"],
          distanceKm: 7.8,
          district: "余杭区",
        },
        {
          name: "良渚博物院",
          lat: 30.39,
          lng: 120.05,
          rating: 4.8,
          address: "余杭区美丽洲路",
          types: ["museum"],
          distanceKm: 6.2,
          district: "余杭区",
        },
        {
          name: "杭州长乔极地海洋公园",
          lat: 30.15,
          lng: 120.25,
          rating: 4.8,
          address: "萧山区湘湖路",
          types: ["aquarium"],
          distanceKm: 18,
          district: "萧山区",
        },
        {
          name: "杭州动物园",
          lat: 30.22,
          lng: 120.14,
          rating: 4.7,
          address: "西湖区虎跑路",
          types: ["zoo"],
          distanceKm: 16,
          district: "西湖区",
        },
      ],
    );

    expect(result.scheduleOptions?.[0].blocks).toHaveLength(3);
    expect(result.scheduleOptions?.[0].blocks.map((block) => block.title)).toEqual(["D1", "D2", "D3"]);
    expect(result.scheduleOptions?.[0].blocks.every((block) => block.items.length >= 2)).toBe(true);
  });

  it("does not wrap the first day lead POI back into the tail of a 2d1n itinerary", () => {
    const result = buildRealtimePlan(
      {
        ...context,
        tripType: "weekend",
        duration: "2d1n",
        locationLabel: "杭州市 滨江区",
        district: undefined,
        currentTime: "2026-03-29T11:18:00+08:00",
      },
      [
        {
          name: "杭州低碳科技馆",
          lat: 30.215,
          lng: 120.215,
          rating: 4.8,
          address: "滨江区江汉路1888号",
          types: ["museum", "science"],
          distanceKm: 1.5,
          district: "滨江区",
        },
        {
          name: "杭州长乔极地海洋公园",
          lat: 30.15,
          lng: 120.25,
          rating: 4.8,
          address: "萧山区湘湖路",
          types: ["aquarium"],
          distanceKm: 15,
          district: "萧山区",
        },
        {
          name: "杭州少年儿童公园",
          lat: 30.24,
          lng: 120.15,
          rating: 4.7,
          address: "西湖区虎跑路",
          types: ["park", "playground"],
          distanceKm: 13,
          district: "西湖区",
        },
        {
          name: "中国动漫博物馆",
          lat: 30.19,
          lng: 120.2,
          rating: 4.7,
          address: "滨江区白马湖路",
          types: ["museum"],
          distanceKm: 4.3,
          district: "滨江区",
        },
      ],
    );

    const firstAction = result.scheduleOptions?.[0].blocks[0].items[0].action ?? "";
    const lastBlockItems = result.scheduleOptions?.[0].blocks.at(-1)?.items ?? [];
    const lastAction = lastBlockItems.at(-1)?.action ?? "";
    const namedDestinations = [
      "杭州低碳科技馆",
      "杭州长乔极地海洋公园",
      "杭州少年儿童公园",
      "中国动漫博物馆",
    ];
    const leadDestination = namedDestinations.find((name) => firstAction.includes(name));

    expect(leadDestination).toBeDefined();
    expect(lastAction).not.toContain(leadDestination as string);
  });

  it("shifts destination focus when the trip changes from a short local outing to 3d2n", () => {
    const pois = [
      {
        name: "良渚邻里儿童公园",
        lat: 30.38,
        lng: 120.04,
        rating: 4.7,
        address: "余杭区良渚街道",
        types: ["park", "playground"],
        distanceKm: 0.8,
        district: "余杭区",
      },
      {
        name: "良渚博物院",
        lat: 30.39,
        lng: 120.05,
        rating: 4.8,
        address: "余杭区美丽洲路",
        types: ["museum"],
        distanceKm: 4.8,
        district: "余杭区",
      },
      {
        name: "杭州长乔极地海洋公园",
        lat: 30.15,
        lng: 120.25,
        rating: 4.8,
        address: "萧山区湘湖路",
        types: ["aquarium"],
        distanceKm: 17,
        district: "萧山区",
      },
    ];

    const shortTrip = rankPoisForTrip(pois, {
      ...context,
      tripType: "today",
      duration: "1h",
      district: "余杭区",
    });

    const longHoliday = rankPoisForTrip(pois, {
      ...context,
      tripType: "weekend",
      duration: "3d2n",
      locationLabel: "杭州市",
      district: undefined,
    });

    expect(shortTrip[0].name).toBe("良渚邻里儿童公园");
    expect(longHoliday[0].name).not.toBe("良渚邻里儿童公园");
  });

  it("filters neighborhood parks out of 3d2n candidate pools", () => {
    const candidates = selectPlanningCandidates(
      [
        {
          name: "美丽洲公园",
          lat: 30.37,
          lng: 120.02,
          rating: 4.8,
          address: "良渚街道美丽洲路1号(近良渚博物院)",
          types: ["park"],
          distanceKm: 0.8,
          district: "余杭区",
        },
        {
          name: "良渚博物院",
          lat: 30.39,
          lng: 120.05,
          rating: 4.8,
          address: "余杭区美丽洲路",
          types: ["museum"],
          distanceKm: 4.8,
          district: "余杭区",
        },
      ],
      3,
      {
        ...context,
        tripType: "weekend",
        duration: "3d2n",
        locationLabel: "杭州市",
        district: undefined,
      },
    );

    expect(candidates.map((item) => item.name)).toEqual(["良渚博物院"]);
  });

  it("does not pin a generic nearby park as the first recommendation when stronger destinations are available", () => {
    const result = buildRealtimePlan(
      {
        ...context,
        tripType: "today",
        duration: "2h",
        currentTime: "2026-03-28T15:08:00+08:00",
        locationLabel: "杭州市 余杭区",
        district: "余杭区",
      },
      [
        {
          name: "美丽洲公园",
          lat: 30.37,
          lng: 120.02,
          rating: 4.8,
          address: "良渚街道美丽洲路1号",
          types: ["park"],
          distanceKm: 0.8,
          district: "余杭区",
        },
        {
          name: "良渚博物院",
          lat: 30.39,
          lng: 120.05,
          rating: 4.8,
          address: "余杭区美丽洲路",
          types: ["museum"],
          distanceKm: 2.4,
          district: "余杭区",
        },
        {
          name: "良渚古城遗址公园",
          lat: 30.4,
          lng: 120.02,
          rating: 4.9,
          address: "余杭区瓶窑镇",
          types: ["park", "heritage"],
          distanceKm: 5.2,
          district: "余杭区",
        },
      ],
    );

    expect(result.recommendations[0].name).not.toBe("美丽洲公园");
    expect(["良渚博物院", "良渚古城遗址公园"]).toContain(result.recommendations[0].name);
  });

  it("separates short toddler rainy picks from long holiday exploration picks", () => {
    const pois = [
      {
        name: "亲子室内乐园",
        lat: 31.18,
        lng: 121.44,
        rating: 4.6,
        address: "徐汇区室内馆",
        types: ["indoor_play"],
        distanceKm: 0.8,
        district: "徐汇区",
      },
      {
        name: "社区儿童公园",
        lat: 31.18,
        lng: 121.43,
        rating: 4.7,
        address: "徐汇区街心公园",
        types: ["park", "playground"],
        distanceKm: 0.6,
        district: "徐汇区",
      },
      {
        name: "自然科学探索馆",
        lat: 31.2,
        lng: 121.46,
        rating: 4.8,
        address: "徐汇区科创路",
        types: ["museum", "science"],
        distanceKm: 3.2,
        district: "徐汇区",
      },
      {
        name: "城市海洋馆",
        lat: 31.24,
        lng: 121.49,
        rating: 4.8,
        address: "浦东新区海洋大道",
        types: ["aquarium"],
        distanceKm: 11,
        district: "浦东新区",
      },
    ];

    const rainyToddler = selectPlanningCandidates(
      rankPoisForTrip(pois, {
        ...context,
        age: "0-3",
        tripType: "today",
        duration: "1h",
        weather: { temp: 18, weather: "rain" },
        district: "徐汇区",
      }),
      3,
      {
        ...context,
        age: "0-3",
        tripType: "today",
        duration: "1h",
        weather: { temp: 18, weather: "rain" },
        district: "徐汇区",
      },
    );

    const holidayExplorer = selectPlanningCandidates(
      rankPoisForTrip(pois, {
        ...context,
        age: "6+",
        tripType: "weekend",
        duration: "3d2n",
        weather: { temp: 24, weather: "sunny" },
        locationLabel: "上海市",
        district: undefined,
      }),
      3,
      {
        ...context,
        age: "6+",
        tripType: "weekend",
        duration: "3d2n",
        weather: { temp: 24, weather: "sunny" },
        locationLabel: "上海市",
        district: undefined,
      },
    );

    expect(rainyToddler[0].name).toBe("亲子室内乐园");
    expect(holidayExplorer[0].name).toBe("城市海洋馆");
  });
});
