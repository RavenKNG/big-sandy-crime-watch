const uppercaseMinorWords = new Set(["of", "and", "the"]);

export function titleCaseWords(value?: string | null) {
  if (!value) return "";

  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/\bN\/A\b/gi, "N/A")
    .trim();
  if (!cleaned) return "";

  return cleaned
    .split(" ")
    .map((segment, index) =>
      segment
        .split("-")
        .map((part, partIndex) => {
          const lower = part.toLowerCase();
          if (lower === "n/a") return "N/A";
          if (index > 0 && partIndex === 0 && uppercaseMinorWords.has(lower)) return lower;
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join("-"),
    )
    .join(" ");
}

export function formatCountyName(value?: string | null) {
  const cleaned = value?.replace(/\s+county$/i, "").trim();
  return titleCaseWords(cleaned);
}

export function formatCountyLabel(value?: string | null) {
  const county = formatCountyName(value);
  return county ? `${county} County` : "";
}

export function countySlug(value?: string | null) {
  const county = formatCountyName(value);
  return county ? county.toLowerCase().replace(/\s+/g, "-") : "";
}

type ExplicitDateParts = {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
};

function parseMmDdYyyy(value: string): ExplicitDateParts | undefined {
  const match = value.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AP]M))?)?$/i,
  );
  if (!match) return undefined;

  const [, month, day, year, hour = "0", minute = "0", second = "0", meridiem] = match;
  let normalizedHour = Number.parseInt(hour, 10);
  if (meridiem) {
    const upper = meridiem.toUpperCase();
    if (upper === "PM" && normalizedHour < 12) normalizedHour += 12;
    if (upper === "AM" && normalizedHour === 12) normalizedHour = 0;
  }

  return {
    year: Number.parseInt(year, 10),
    month: Number.parseInt(month, 10),
    day: Number.parseInt(day, 10),
    hour: normalizedHour,
    minute: Number.parseInt(minute, 10),
    second: Number.parseInt(second, 10),
  };
}

function parseIsoLike(value: string): ExplicitDateParts | undefined {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/,
  );
  if (!match) return undefined;

  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  return {
    year: Number.parseInt(year, 10),
    month: Number.parseInt(month, 10),
    day: Number.parseInt(day, 10),
    hour: Number.parseInt(hour, 10),
    minute: Number.parseInt(minute, 10),
    second: Number.parseInt(second, 10),
  };
}

function parseDateParts(value?: string | Date | null): ExplicitDateParts | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
      hour: value.getHours(),
      minute: value.getMinutes(),
      second: value.getSeconds(),
    };
  }

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  return parseMmDdYyyy(trimmed) ?? parseIsoLike(trimmed);
}

function parseDateLike(value?: string | Date | null) {
  if (!value) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function hasPlaceholderMidnightText(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return /\b00:00(?::00)?\b/.test(normalized) || /\b12:00(?::00)?\s*am\b/.test(normalized);
}

function formatExplicitDateOnly(parts: ExplicitDateParts) {
  return new Date(parts.year, parts.month - 1, parts.day, 12).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatBookingDateTime(
  value?: string | Date | null,
  bookingTimeKnown?: boolean | null,
) {
  const parts = parseDateParts(value);
  if (!parts) return undefined;

  const midnight =
    (parts.hour ?? 0) === 0 &&
    (parts.minute ?? 0) === 0 &&
    (parts.second ?? 0) === 0;
  const shouldHideTime =
    bookingTimeKnown === false ||
    midnight ||
    hasPlaceholderMidnightText(typeof value === "string" ? value : undefined);

  if (shouldHideTime) {
    return formatExplicitDateOnly(parts);
  }

  const parsed = parseDateLike(value);
  if (!parsed) {
    return formatExplicitDateOnly(parts);
  }

  const date = parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} at ${time}`;
}

export function absoluteSiteUrl(
  pathname: string,
  site = process.env.SITE_URL || "https://bigsandycrimewatch.com",
) {
  return new URL(pathname, site.replace(/\/$/, "") + "/").toString();
}
