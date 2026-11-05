"use client";

import { Field, Select } from "@/components/ui/Field";
import { PROVINCES } from "@/lib/ziwei/cities";
import { cn } from "@/lib/ui/cn";
import { longitudeOffsetMinutes } from "./birth-utils";

/** 出生地点：省 → 市联动，地点校时启用时才显示经度时差。 */
export default function BirthLocationFields({
  idPrefix,
  province,
  city,
  longitude,
  onProvinceChange,
  onCityChange,
  compact = false,
  error,
  useTrueSolar = true,
}: {
  idPrefix: string;
  province: string;
  city: string;
  longitude: number;
  onProvinceChange: (province: string) => void;
  onCityChange: (city: string) => void;
  compact?: boolean;
  error?: string;
  useTrueSolar?: boolean;
}) {
  const provinceId = `${idPrefix}-province`;
  const cityId = `${idPrefix}-city`;
  const cities = PROVINCES.find((item) => item.name === province)?.cities ?? [];
  const offsetMinutes = longitudeOffsetMinutes(longitude);

  return (
    <div className={cn("space-y-2.5", compact && "space-y-2")}>
      <div className={cn("grid", compact ? "gap-2" : "gap-2 sm:grid-cols-2 sm:gap-3")}>
        <Field id={provinceId} label="省份 / 直辖市">
          <Select
            id={provinceId}
            value={province}
            onChange={(event) => onProvinceChange(event.target.value)}
          >
            <option value="">省份 / 直辖市</option>
            {PROVINCES.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field id={cityId} label="城市" error={error}>
          <Select
            id={cityId}
            invalid={!!error}
            aria-describedby={error ? `${cityId}-error` : undefined}
            value={city}
            disabled={!province}
            className={cn(!province && "opacity-40")}
            onChange={(event) => onCityChange(event.target.value)}
          >
            <option value="">{province ? "城市" : "先选省份"}</option>
            {cities.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <p className="text-[12px] leading-relaxed text-ink-3">
        {province && !city ? "请选择出生城市" : province ? (
          <>
            {city} · 经度{" "}
            <span className="font-mono tabular-nums">{longitude.toFixed(1)}°E</span>{" "}
            {useTrueSolar ? <>· 时差{" "}<span className="font-mono tabular-nums">{offsetMinutes > 0 ? "+" : ""}{offsetMinutes}</span> 分钟</> : '（未作地点校正）'}
          </>
        ) : (
          "出生地用于按经度校正时间；不选则按北京时间对应时辰起盘。"
        )}
      </p>
    </div>
  );
}
