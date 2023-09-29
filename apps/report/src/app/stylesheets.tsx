"use client";

import ReactDOM from "react-dom";

export function StyleSheets() {
	ReactDOM.preload("https://cdnjs.cloudflare.com/ajax/libs/Primer/20.4.1/base.min.css", {
		as: "style",
		crossOrigin: "anonymous",
		integrity: "sha512-Y3BvSXIyScMEFBi2QYvDc12tw0MpND6sYYKqdObiNlE432O1fv0/jeCbuuVeSNjd2ZuAM3EJbeVBFe/b0rKoYg==",
	});
	ReactDOM.preload("https://cdnjs.cloudflare.com/ajax/libs/Primer/20.4.1/color-modes.min.css", {
		as: "style",
		crossOrigin: "anonymous",
		integrity: "sha512-XTbUut8Rc/r06Iif/K7xDOub5F4TO2vTCV4InexCz5RvpGMaSfUf2tMRxYX6ha0zzFy+UfKdb94ehR+dOKYPhg==",
	});
	ReactDOM.preload("https://cdnjs.cloudflare.com/ajax/libs/Primer/20.4.1/utilities.min.css", {
		as: "style",
		crossOrigin: "anonymous",
		integrity: "sha512-OS48DOZqdQdDDxUfXtTx/xv8SjfIwc/k8gf75MaFh6uNb7xA50neIEvAi68wzvGJrW646ZVZH0AQXHSsvwMvpw==",
	});
	ReactDOM.preload("https://cdnjs.cloudflare.com/ajax/libs/Primer/20.4.1/markdown.min.css", {
		as: "style",
		crossOrigin: "anonymous",
		integrity: "sha512-z9fESt0h0bJJwWXYjGCV8v/SLbIkxgEIRBvt9d4xw+xSNUT+D1RpA/BUu8FBu6RqRWetBNaKeCC9Tr16/hPBhw==",
	});
	ReactDOM.preload("https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.6.0/styles/github-dark.min.css", {
		as: "style",
		crossOrigin: "anonymous",
		integrity: "sha512-rO+olRTkcf304DQBxSWxln8JXCzTHlKnIdnMUwYvQa9/Jd4cQaNkItIUj6Z4nvW1dqK0SKXLbn9h4KwZTNtAyw==",
	});

	return null;
}
