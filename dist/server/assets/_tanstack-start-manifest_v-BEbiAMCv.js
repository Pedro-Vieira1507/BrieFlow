//#region \0tanstack-start-manifest:v
var tsrStartManifest = () => ({ routes: {
	__root__: {
		filePath: "/home/ubuntu/BrieFlow/src/routes/__root.tsx",
		children: ["/", "/chat/$threadId"],
		preloads: ["/assets/index-C37_e075.js", "/assets/rolldown-runtime-QTnfLwEv.js"],
		scripts: [{ attrs: {
			type: "module",
			async: !0,
			src: "/assets/index-C37_e075.js"
		} }]
	},
	"/": {
		filePath: "/home/ubuntu/BrieFlow/src/routes/index.tsx",
		children: void 0,
		preloads: ["/assets/routes-C4kcUMnm.js", "/assets/chat-storage-CigTcYWD.js"]
	},
	"/chat/$threadId": {
		filePath: "/home/ubuntu/BrieFlow/src/routes/chat.$threadId.tsx",
		children: void 0,
		preloads: ["/assets/chat._threadId-CVG9XHVR.js", "/assets/chat-storage-CigTcYWD.js"]
	}
} });
//#endregion
export { tsrStartManifest };
