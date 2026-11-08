import type { MetadataRoute } from "next";
import { publicRoutes, siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: new URL(route, siteConfig.url).toString(),
    changeFrequency: route.startsWith("/guides/") ? "monthly" : "yearly",
    priority: route === "/" ? 1 : route.startsWith("/guides/") ? 0.7 : 0.8,
  }));
}
