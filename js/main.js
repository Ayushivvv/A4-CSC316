
let chartData = null;

function renderChart(d3, data) {
    const mount = document.getElementById("viz");
    if (!mount) return;

    d3.select(mount).select("svg").remove();

    // One-time HTML tooltip (styled in css as #viz-tooltip)
    let tip = document.getElementById("viz-tooltip");
    if (!tip) {
        tip = document.createElement("div");
        tip.id = "viz-tooltip";
        document.body.appendChild(tip);
    }
    const showTip = (text, x, y) => {
        tip.textContent = text;
        tip.style.left = `${x}px`;
        tip.style.top = `${y}px`;
        tip.style.display = "block";
    };
    const hideTip = () => (tip.style.display = "none");

    // Keep track of pinned song nodes (by uid)
    const pinned = new Set();

    function createChart(d3, data) {
        // Size
        const rect = mount.getBoundingClientRect();
        const width  = Math.max(360, rect.width);
        const height = Math.max(480, rect.height);

        // Drawing area
        const M = 24;
        const innerW = width - 2 * M;
        const innerH = height - 2 * M;

        // Palette
        const RED = "#ff4d4f";
        const RED_STROKE = "#ff6b6b";
        const WHITE = "#ffffff";

        // ---------- text helpers ----------
        function prepareBreakableText(text, maxTokenLen = 12) {
            let spaced = text.replace(/\//g, " / ").replace(/-/g, " - ");
            spaced = spaced.replace(/([a-z])([A-Z])/g, "$1\u200b$2");
            const parts = spaced.trim().split(/\s+/);
            const out = [];
            for (const w of parts) {
                if (w.length <= maxTokenLen) { out.push(w); continue; }
                const chunks = [];
                for (let i = 0; i < w.length; i += maxTokenLen) chunks.push(w.slice(i, i + maxTokenLen));
                out.push(chunks.join("\u200b"));
            }
            return out;
        }

        /**
         * Wrap text into tspans that fit within a circle of radius r.
         * Options:
         *  - depth (1=artist, >=2=song)
         *  - maxLines, minFont, maxFont
         *  - requireFull: if true, hide unless the full text fits (no forced token cuts)
         *  - neverHide: if true, keep shrinking/adding lines (down to 5px, up to 6 lines) to always show
         */
        function wrapAndFit(el, text, r, {
            depth,
            maxLines = 3,
            minFont  = (depth >= 2 ? 7 : 9),
            maxFont  = Math.min(32, r * 0.45),
            requireFull = false,
            neverHide = false,
            _attempt = 0
        } = {}) {
            const sel = d3.select(el);

            if (r < 12 && !neverHide) {
                sel.text("").style("display", "none").attr("data-hidden", "1");
                return { fitted:false, full:false };
            }

            const maxWidth  = r * 1.8;
            const maxHeight = r * 1.2;

            if (depth === 1) maxFont = Math.min(maxFont, 22);

            const words = prepareBreakableText(text);
            let usedForcedBreak = false;

            for (let fontSize = maxFont; fontSize >= minFont; fontSize -= 1.5) {
                sel.text(null).style("display", "inline").style("font-size", fontSize + "px");

                const measure = d3.select(el.ownerSVGElement)
                    .append("text").style("font-size", fontSize + "px").attr("visibility", "hidden");

                let lineWords = [];
                let lineCount = 0;

                for (let i = 0; i < words.length; i++) {
                    lineWords.push(words[i]);
                    measure.text(lineWords.join(" "));
                    const tooWide = measure.node().getComputedTextLength() > maxWidth;

                    if (tooWide) {
                        if (lineWords.length === 1) {
                            const raw = lineWords[0].replace(/\u200b/g, "");
                            const cut = Math.max(1, Math.floor(raw.length * 0.6));
                            const left = raw.slice(0, cut) + "—";
                            const right = raw.slice(cut);
                            sel.append("tspan").text(left).attr("x", 0).attr("dy", lineCount ? fontSize * 1.1 : 0);
                            lineCount++;
                            if (lineCount >= maxLines) { measure.remove(); sel.text(""); break; }
                            lineWords = [right];
                            usedForcedBreak = true;
                        } else {
                            lineWords.pop();
                            sel.append("tspan").text(lineWords.join(" ")).attr("x", 0).attr("dy", lineCount ? fontSize * 1.1 : 0);
                            lineCount++;
                            if (lineCount >= maxLines) { measure.remove(); sel.text(""); break; }
                            lineWords = [words[i]];
                        }
                    }
                }

                if (sel.text() !== "") {
                    if (lineWords.length && lineCount < maxLines) {
                        sel.append("tspan").text(lineWords.join(" ")).attr("x", 0).attr("dy", lineCount ? fontSize * 1.1 : 0);
                        lineCount++;
                    }
                } else if (lineWords.length && lineCount < maxLines) {
                    sel.append("tspan").text(lineWords.join(" ")).attr("x", 0).attr("dy", lineCount ? fontSize * 1.1 : 0);
                    lineCount++;
                }

                measure.remove();
                if (lineCount === 0) { sel.text(""); continue; }

                // vertical center
                const tsp = sel.selectAll("tspan").nodes();
                if (tsp.length) {
                    const totalH = fontSize * 1.1 * (tsp.length - 1);
                    d3.select(tsp[0]).attr("dy", -totalH / 2);
                }

                // bounds + full check
                const bbox = el.getBBox();
                const fits = bbox.width <= maxWidth && bbox.height <= maxHeight;
                const full = !usedForcedBreak;

                if (fits && (!requireFull || full)) {
                    sel.attr("data-hidden", null);
                    return { fitted:true, full };
                }

                sel.text("");
                usedForcedBreak = false; // reset
            }

            if (neverHide && _attempt < 1) {
                // try harder once: more lines + smaller font
                return wrapAndFit(el, text, r, {
                    depth,
                    maxLines: Math.max(6, maxLines),
                    minFont: Math.min(5, minFont),
                    maxFont: Math.min(22, r * 0.40),
                    requireFull: true,
                    neverHide: true,
                    _attempt: _attempt + 1
                });
            }

            if (neverHide) {
                // last resort: squeeze to width at min font
                const minF = Math.min(5, minFont);
                sel.text(null).style("display", "inline").style("font-size", minF + "px");
                sel.append("tspan")
                    .attr("x", 0)
                    .text(text)
                    .attr("textLength", Math.max(1, maxWidth))
                    .attr("lengthAdjust", "spacingAndGlyphs");
                sel.attr("data-hidden", null);
                return { fitted:true, full:true };
            }

            sel.text("").style("display", "none").attr("data-hidden", "1");
            return { fitted:false, full:false };
        }
        // -----------------------------------

        // Layout
        const pack = data =>
            d3.pack()
                .size([innerW, innerH])
                .padding(20)(
                    d3.hierarchy(data)
                        .sum(d => d.value)
                        .sort((a, b) => b.value - a.value)
                );

        const root = pack(data);

        // Give every node a stable uid for pinning
        root.each((d, i) => d.uid = i);

        // SVG + group
        const svg = d3.create("svg")
            .attr("viewBox", `0 0 ${width} ${height}`)
            .attr("width", width)
            .attr("height", height)
            .style("display", "block")
            .style("cursor", "pointer");

        const g = svg.append("g").attr("transform", `translate(${M},${M})`);

        // Circles
        const node = g.selectAll("circle")
            .data(root.descendants().slice(1))
            .join("circle")
            .attr("transform", d => `translate(${d.x},${d.y})`)
            .attr("r", d => d.r)
            .attr("fill", d => (d.children ? RED : WHITE))              // artists red, songs white
            .attr("stroke", d => (d.children ? WHITE : RED_STROKE))
            .attr("stroke-width", 1)
            .attr("pointer-events", "auto");

        // Labels
        const label = g.append("g")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .selectAll("text")
            .data(root.descendants())
            .join("text")
            .attr("class", d => `d3-label depth-${d.depth}`)
            .attr("data-uid", d => d.uid)
            .style("fill-opacity", d => (d.parent === root ? 1 : 0))
            .style("display", d => (d.parent === root ? "inline" : "none"))
            .each(function(d){
                // Top level initial: artists wrap to 2 lines; must fully fit or hide
                const requireFull = (d.depth === 1);
                const maxLines = (d.depth === 1) ? 2 : 3;
                wrapAndFit(this, d.data.name, d.r, { depth: d.depth, maxLines, requireFull });
            });

        // Helper to (re)fit a single label at current zoom
        function refitLabel(el, d, k, contextFocus) {
            const atTop = (contextFocus === root);
            if (atTop) {
                const requireFull = (d.depth === 1);
                const maxLines = (d.depth === 1) ? 2 : 3;
                wrapAndFit(el, d.data.name, d.r * k, { depth: d.depth, maxLines, requireFull });
            } else if (contextFocus && contextFocus.depth === 1) {
                if (d.depth >= 2 && d.parent === contextFocus) {
                    // song inside current artist: always try to show
                    const forced = pinned.has(d.uid);
                    wrapAndFit(el, d.data.name, d.r * k, {
                        depth: d.depth,
                        maxLines: 6,
                        minFont: 5,
                        requireFull: true,
                        neverHide: true // ensures it will appear
                    });
                    el.style.display = "inline";
                    el.style.fillOpacity = 1;
                } else if (d === contextFocus) {
                    // hide the artist label while inside
                    el.style.display = "none";
                    el.textContent = "";
                } else {
                    el.style.display = "none";
                }
            } else {
                const maxLines = (d.depth === 1) ? 2 : 3;
                wrapAndFit(el, d.data.name, d.r * k, { depth: d.depth, maxLines, requireFull: d.depth === 1 });
            }
        }

        // Tooltips ONLY for artists at top level
        node
            .on("mousemove", (event, d) => {
                if (d.depth === 1 && focus === root) showTip(d.data.name, event.clientX, event.clientY);
                else hideTip();
            })
            .on("mouseleave", hideTip)
            .on("click", (event, d) => {
                hideTip();
                // If it's a song (leaf), toggle pin instead of zooming
                if (d.depth >= 2) {
                    event.stopPropagation();
                    if (pinned.has(d.uid)) pinned.delete(d.uid);
                    else pinned.add(d.uid);

                    // Force its label to (re)render now using current zoom factor
                    const k = currentK;
                    const textEl = g.select(`text[data-uid="${d.uid}"]`).node();
                    if (textEl) {
                        wrapAndFit(textEl, d.data.name, d.r * k, {
                            depth: d.depth,
                            maxLines: 6,
                            minFont: 5,
                            requireFull: true,
                            neverHide: true
                        });
                        textEl.style.display = "inline";
                        textEl.style.fillOpacity = 1;
                    }
                    return; // do not zoom on leaf
                }

                // Otherwise (artist), zoom
                if (focus !== d) { zoom(event, d); event.stopPropagation(); }
            });

        // Native title for artists (fallback)
        node.filter(d => d.depth === 1).append("title").text(d => d.data.name);

        // Fit + zoom
        svg.on("click", (event) => zoom(event, root));
        let focus = root, view;
        let currentK = 1;

        function zoomTo(v) {
            hideTip();
            const k = Math.min(innerW, innerH) / v[2];
            currentK = k;
            view = v;

            const cx = innerW / 2;
            const cy = innerH / 2;

            label.attr("transform", d => `translate(${(d.x - v[0]) * k + cx},${(d.y - v[1]) * k + cy})`);
            node
                .attr("transform", d => `translate(${(d.x - v[0]) * k + cx},${(d.y - v[1]) * k + cy})`)
                .attr("r", d => d.r * k);

            // Refit labels for current zoom state
            label.each(function(d){ refitLabel(this, d, k, focus); });

            // Ensure any pinned song labels are visible
            if (focus && focus.depth === 1) {
                pinned.forEach(uid => {
                    const n = root.descendants().find(nd => nd.uid === uid);
                    if (n && n.parent === focus) {
                        const el = g.select(`text[data-uid="${uid}"]`).node();
                        if (el) {
                            wrapAndFit(el, n.data.name, n.r * k, {
                                depth: n.depth, maxLines: 6, minFont: 5, requireFull: true, neverHide: true
                            });
                            el.style.display = "inline";
                            el.style.fillOpacity = 1;
                        }
                    }
                });
            }
        }

        function zoom(event, d) {
            focus = d;
            const t = svg.transition().duration(event.altKey ? 7500 : 750)
                .tween("zoom", () => {
                    const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
                    return (tt) => zoomTo(i(tt));
                });

            // reveal children of focus (songs) and hide artist label itself
            label
                .transition(t)
                .style("fill-opacity", n => (n.parent === focus ? 1 : 0))
                .on("start", function (n) {
                    if (n.parent === focus) this.style.display = "inline";
                    if (n === focus) { this.style.display = "none"; this.textContent = ""; }
                })
                .on("end", function (n) {
                    if (n.parent !== focus && focus !== root) this.style.display = "none";
                    if (n === focus) { this.style.display = "none"; this.textContent = ""; }
                });
        }

        // Initial view + font-ready fixes (consistent first paint)
        const initialView = [root.x, root.y, root.r * 2];
        zoomTo(initialView);
        requestAnimationFrame(() => zoomTo(initialView));
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => zoomTo(initialView));
        }
        window.addEventListener("load", () => zoomTo(initialView), { once: true });

        return svg.node();
    }

    mount.appendChild(createChart(d3, data));
}

// Load data (update path if needed)
d3.csv("data/youtube-top-100-songs-2025.csv").then((flatData) => {
    const grouped = d3.group(flatData, d => d.channel);

    chartData = {
        name: "YouTube Top 100",
        children: Array.from(grouped, ([key, values]) => ({
            name: key,
            children: values.map(d => ({ name: d.title, value: +d.view_count }))
        }))
    };

    renderChart(d3, chartData);

    // Re-render on resize (debounced)
    let timer;
    window.addEventListener("resize", () => {
        clearTimeout(timer);
        timer = setTimeout(() => renderChart(d3, chartData), 150);
    });
});