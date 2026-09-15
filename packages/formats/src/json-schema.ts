import { z } from "zod";
import { portableBundleSchema } from "./bundle.js";

export const portableBundleJsonSchema = z.toJSONSchema(portableBundleSchema);
