"use client";

import { Field, Select } from "@/components/ui/Field";
import { PROVINCES } from "@/lib/ziwei/cities";
import { cn } from "@/lib/ui/cn";
import { longitudeOffsetMinutes } from "./birth-utils";

/** 出生地点：省 → 市联动，并显示用于真太阳时校正的经度与时差。 */
export default function BirthLocationFields({
  idPrefix,
  province,
  city,
  longitude,
  onProvinceChange,
  onCityChange,
  compact = false,
}: {
  idPrefix: string;
  province: string;
  city: string;
  longitude: number;
  onProvinceChange: (province: string) => void;
  onCityChange: (city: string) => void;
  compact?: boolean;
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

        <Field id={cityId} label="城市">
          <Select
            id={cityId}
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
        {province ? (
          <>
            {city || "请选择城市"} · 经度{" "}
            <span className="font-mono tabular-nums">{longitude.toFixed(1)}°E</span>{" "}
            · 时差{" "}
            <span className="font-mono tabular-nums">
              {offsetMinutes > 0 ? "+" : ""}
              {offsetMinutes}
            </span>{" "}
            分钟
          </>
        ) : (
          "出生地用于按经度换算真太阳时；不选则按北京时间对应时辰起盘。"
        )}
      </p>
    </div>
  );
}
