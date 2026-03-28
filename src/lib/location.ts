export type LocationSource = "auto" | "manual" | "fallback" | "approximate";

export interface LocationState {
  lat: number;
  lng: number;
  name: string;
  source: LocationSource;
  city?: string;
  district?: string;
  province?: string;
}

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface NamedCoordinate {
  name: string;
  lat: number;
  lng: number;
  city?: string;
  district?: string;
  province?: string;
}

export interface MapMarker extends MapPoint {
  kind: "center" | "poi";
  label: string;
}

export interface RecommendationPointInput {
  name: string;
  lat?: number;
  lng?: number;
}

export const DEFAULT_FALLBACK_LOCATION: LocationState = {
  lat: 31.2304,
  lng: 121.4737,
  name: "上海",
  source: "fallback",
};

export function buildFallbackLocationState(): LocationState {
  return { ...DEFAULT_FALLBACK_LOCATION };
}

export function normalizeManualLocationResult(point: NamedCoordinate): LocationState {
  return {
    lat: point.lat,
    lng: point.lng,
    name: point.name,
    source: "manual",
    city: point.city,
    district: point.district,
    province: point.province,
  };
}

export function normalizeAutoLocationResult(point: NamedCoordinate): LocationState {
  return {
    lat: point.lat,
    lng: point.lng,
    name: point.name,
    source: "auto",
    city: point.city,
    district: point.district,
    province: point.province,
  };
}

export function normalizeBootstrapLocationResult(point: NamedCoordinate): LocationState {
  return {
    lat: point.lat,
    lng: point.lng,
    name: point.name,
    source: "approximate",
    city: point.city,
    district: point.district,
    province: point.province,
  };
}

function getLocationPriority(source: LocationSource): number {
  switch (source) {
    case "manual":
      return 4;
    case "auto":
      return 3;
    case "approximate":
      return 2;
    case "fallback":
    default:
      return 1;
  }
}

export function shouldReplaceLocation(current: LocationState | null, next: LocationState): boolean {
  if (!current) return true;

  const currentPriority = getLocationPriority(current.source);
  const nextPriority = getLocationPriority(next.source);

  if (nextPriority !== currentPriority) {
    return nextPriority > currentPriority;
  }

  return true;
}

export function shouldRestoreSavedLocation(location: LocationState): boolean {
  return location.source === "manual";
}

export function buildLocationLabel(location: LocationState | null): string {
  if (!location) return "正在准备位置...";
  return location.name;
}

export function createMapMarkers(
  center: LocationState,
  recommendations: MapPoint[],
): MapMarker[] {
  return [
    {
      id: "center",
      kind: "center",
      label: center.name,
      name: center.name,
      lat: center.lat,
      lng: center.lng,
    },
    ...recommendations
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
      .map((item) => ({
        id: item.id,
        kind: "poi" as const,
        label: item.name,
        name: item.name,
        lat: item.lat,
        lng: item.lng,
      })),
  ];
}

export function createRecommendationPoints(recommendations: RecommendationPointInput[]): MapPoint[] {
  return recommendations
    .flatMap((item, index) =>
      Number.isFinite(item.lat) && Number.isFinite(item.lng)
        ? [
            {
              id: `poi-${index}`,
              name: item.name,
              lat: item.lat as number,
              lng: item.lng as number,
            },
          ]
        : [],
    );
}

export function getPreferredMarkerId(markers: MapMarker[]): string {
  return markers.find((marker) => marker.kind === "poi")?.id || "center";
}
