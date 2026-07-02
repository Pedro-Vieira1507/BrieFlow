import { n as createThread } from "./chat-storage-BZ8LiVhN.js";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { jsx } from "react/jsx-runtime";
//#region src/routes/index.tsx?tsr-split=component
function IndexRedirect() {
	const navigate = useNavigate();
	useEffect(() => {
		if (typeof window === "undefined") return;
		navigate({
			to: "/chat/$threadId",
			params: { threadId: createThread().id },
			replace: true
		});
	}, [navigate]);
	return /* @__PURE__ */ jsx("div", {
		className: "flex h-screen items-center justify-center text-sm text-muted-foreground",
		children: "Iniciando nova conversa…"
	});
}
//#endregion
export { IndexRedirect as component };
