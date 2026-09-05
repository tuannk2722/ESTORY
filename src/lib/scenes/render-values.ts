import { z } from "zod";

// Self-contained CSS colors only: no variables, currentColor, CSS declarations or URLs.
const namedColors = new Set(("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato transparent turquoise violet wheat white whitesmoke yellow yellowgreen").split(" "));
const numeric = /^[+-]?(?:\d+\.?\d*|\.\d+)%?$/;

function bounded(token: string, max: number): boolean {
  if (!numeric.test(token)) return false;
  const value = Number.parseFloat(token);
  return Number.isFinite(value) && value >= 0 && value <= (token.endsWith("%") ? 100 : max);
}

export function isRenderColor(input: string): boolean {
  const value = input.trim().toLowerCase();
  if (namedColors.has(value) || /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/.test(value)) return true;
  const match = /^(rgba?|hsla?)\(([^()]+)\)$/.exec(value);
  if (!match) return false;
  const [, fn, body] = match;
  const comma = body.includes(",");
  if (comma && body.includes("/")) return false;
  if (!comma && ((body.match(/\//g)?.length ?? 0) > 1)) return false;
  const parts = comma ? body.split(",").map((part) => part.trim()) : body.trim().split(/\s*\/\s*|\s+/);
  if (parts.length !== 3 && parts.length !== 4) return false;
  if (!comma && (parts.length === 4) !== body.includes("/")) return false;
  if (parts.length === 4 && !bounded(parts[3], 1)) return false;
  if (fn.startsWith("rgb")) {
    if (comma && new Set(parts.slice(0, 3).map(part => part.endsWith("%"))).size > 1) return false;
    return parts.slice(0, 3).every((part) => bounded(part, 255));
  }
  return /^[+-]?(?:\d+\.?\d*|\.\d+)(?:deg)?$/.test(parts[0]) &&
    parts.slice(1, 3).every((part) => part.endsWith("%") && bounded(part, 100));
}

export const renderColorSchema = z.string().refine(isRenderColor, "Expected a self-contained hex, RGB, HSL or named CSS color");

export function isMediaUrl(value: string): boolean {
  if (!value || /[\s\\\u0000-\u001f]/.test(value)) return false;
  try {
    const decodedPath = decodeURIComponent(value.split(/[?#]/)[0]);
    if (decodedPath.includes("\\") || decodedPath.split("/").includes("..")) return false;
    if (value.startsWith("/")) return !value.startsWith("//");
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const mediaUrlSchema = z.string().refine(isMediaUrl, "Expected a root-relative or HTTPS media URL");
