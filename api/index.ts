import { handle } from "@hono/node-server/vercel";
import app from "../apps/api/src/server.js";

export default handle(app);
