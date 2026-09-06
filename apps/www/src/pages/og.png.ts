import sharp from "sharp";
import { socialSvg } from "../content/social";

export async function GET() {
  const image = await sharp(Buffer.from(socialSvg())).png().toBuffer();
  return new Response(new Uint8Array(image), { headers: { "Content-Type": "image/png" } });
}
