import { describe, expect, it } from "vitest";
import {
  buildFallbackPlan,
  buildRealtimePlan,
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

    expect(result.recommendations.map((item) => item.name)).toEqual([
      "徐汇滨江儿童公园",
      "徐家汇公园",
    ]);
    expect(result.plan[0].action).toContain("徐汇滨江儿童公园");
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

    expect(result.notice).toContain("21:00");
    expect(result.scheduleOptions).toHaveLength(1);
    expect(result.scheduleOptions[0].id).toBe("regular-rhythm");
    expect(result.scheduleOptions[0].description).toContain("隔天");
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
