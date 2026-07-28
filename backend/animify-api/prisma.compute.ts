import { defineComputeConfig } from "@prisma/compute-sdk/config";

export default defineComputeConfig({
  app: {
    name: "animify-api",
    framework: "nestjs",
    httpPort: 3000,
  },
});
