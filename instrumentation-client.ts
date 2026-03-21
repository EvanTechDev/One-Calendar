import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    { path: "/api/botid", method: "POST" },
    { path: "/api/share", method: "GET" },
    { path: "/api/share", method: "POST" },
    { path: "/api/share/public", method: "GET" },
  ],
});
