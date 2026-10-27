// GitHub Pages 等子路径部署时通过 NEXT_PUBLIC_BASE_PATH 注入，如 /shudu；根路径部署不设此变量
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
export default {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};
