const userAgent = process.env.npm_config_user_agent ?? "";

if (!userAgent.startsWith("pnpm/")) {
  console.error(
    "\nDự án này chỉ sử dụng pnpm 11.19.0. Hãy chạy: corepack enable && corepack prepare pnpm@11.19.0 --activate",
  );
  process.exit(1);
}
