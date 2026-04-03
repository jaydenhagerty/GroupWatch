const http = require("http");

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
	if (req.url === "/health") {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ ok: true }));
		return;
	}

	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(
		JSON.stringify({
			ok: true,
			service: "groupwatch-backend",
			message: "Server is running",
		})
	);
});

server.listen(port, () => {
	console.log("GroupWatch backend listening on port " + port);
});
