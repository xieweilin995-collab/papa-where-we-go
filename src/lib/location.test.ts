import { describe, expect, it } from "vitest";
import {
  DEFAULT_FALLBACK_LOCATION,
  buildFallbackLocationState,
  buildLocationLabel,
  createRecommendationPoints,
  createMapMarkers,
  getPreferredMarkerId,
  normalizeAutoLocationResult,
  normalizeBootstrapLocationResult,
  normalizeManualLocationResult,
  shouldRestoreSavedLocation,
  shouldReplaceLocation,
} from "./location";

describe("location helpers", () => {
  it("falls back to the default city when geolocation is unavailable", () => {
    const location = buildFallbackLocationState();

    expect(location.lat).toBe(DEFAULT_FALLBACK_LOCATION.lat);
    expect(location.lng).toBe(DEFAULT_FALLBACK_LOCATION.lng);
    expect(location.name).toBe(DEFAULT_FALLBACK_LOCATION.name);
    expect(location.source).toBe("fallback");
  });

  it("normalizes a manual geocode result into displayable location state", () => {
    const location = normalizeManualLocationResult({
      lat: 31.2304,
      lng: 121.4737,
      name: "上海 徐汇滨江",
    });

    expect(location.name).toBe("上海 徐汇滨江");
    expect(location.source).toBe("manual");
    expect(buildLocationLabel(location)).toBe("上海 徐汇滨江");
  });

  it("normalizes an approximate bootstrap location without requiring geolocation permission", () => {
    const location = normalizeBootstrapLocationResult({
      lat: 30.2741,
      lng: 120.1551,
      name: "杭州",
    });

    expect(location.name).toBe("杭州");
    expect(location.source).toBe("approximate");
  });

  it("normalizes an exact geolocation result into auto location state", () => {
    const location = normalizeAutoLocationResult({
      lat: 30.361,
      lng: 120.041,
      name: "杭州市 余杭区",
      city: "杭州市",
      district: "余杭区",
    });

    expect(location.name).toBe("杭州市 余杭区");
    expect(location.source).toBe("auto");
    expect(location.district).toBe("余杭区");
  });

  it("does not let approximate location override a more precise auto location", () => {
    const current = normalizeAutoLocationResult({
      lat: 30.361,
      lng: 120.041,
      name: "杭州市 余杭区",
    });
    const next = normalizeBootstrapLocationResult({
      lat: 30.29,
      lng: 120.16,
      name: "杭州市 拱墅区",
    });

    expect(shouldReplaceLocation(current, next)).toBe(false);
  });

  it("allows precise auto location to replace approximate bootstrap location", () => {
    const current = normalizeBootstrapLocationResult({
      lat: 30.29,
      lng: 120.16,
      name: "杭州市 拱墅区",
    });
    const next = normalizeAutoLocationResult({
      lat: 30.361,
      lng: 120.041,
      name: "杭州市 余杭区",
    });

    expect(shouldReplaceLocation(current, next)).toBe(true);
  });

  it("only restores saved manual locations on startup", () => {
    expect(
      shouldRestoreSavedLocation({
        lat: 30.36,
        lng: 120.04,
        name: "良渚",
        source: "manual",
      }),
    ).toBe(true);

    expect(
      shouldRestoreSavedLocation({
        lat: 31.23,
        lng: 121.47,
        name: "上海 黄浦区",
        source: "auto",
      }),
    ).toBe(false);
  });

  it("creates a center marker and recommendation markers safely", () => {
    const recommendationPoints = createRecommendationPoints([
      { name: "西岸梦中心", lat: 31.1822, lng: 121.4543 },
      { name: "徐汇滨江公园", lat: 31.1888, lng: 121.4521 },
      { name: "无坐标地点" },
    ]);

    const markers = createMapMarkers(
      { lat: 31.2304, lng: 121.4737, name: "上海 徐汇滨江", source: "manual" },
      recommendationPoints,
    );

    expect(recommendationPoints).toHaveLength(2);
    expect(recommendationPoints[0].id).toBe("poi-0");
    expect(markers[0].kind).toBe("center");
    expect(markers).toHaveLength(3);
    expect(markers[1].label).toBe("西岸梦中心");
    expect(markers[2].kind).toBe("poi");
    expect(getPreferredMarkerId(markers)).toBe("poi-0");
  });
});
