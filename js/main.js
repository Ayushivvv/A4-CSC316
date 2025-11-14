// A global variable to hold the hierarchical data
let chartData = null;
// A global variable to hold the original flat CSV data
let originalFlatData = null;

// rendering function (remains the same as before)
function renderChart(d3, data) {
    const mount = document.getElementById("viz");
    if (!mount) return;

    // Remove the existing SVG element ==> clear state
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


    // Define core chart creation logic (shifting within rendering)
    function createChart(d3, data) {
        // Specify the chart’s dimensions. (These change on resize)
        const rect = mount.getBoundingClientRect();
        const width = Math.max(360, rect.width);
        const height = Math.max(480, rect.height);

        // colours (from new CSS)
        const RED = "#ff4d4f";
        const RED_STROKE = "#ff6b6b";
        const WHITE = "#ffffff";

        // Compute the layout. ( relies on new width/height)
        const pack = data => d3.pack()
            .size([width, height])
            .padding(24)
            (d3.hierarchy(data)
                .sum(d => d.value)
                .sort((a, b) => b.value - a.value));

        const root = pack(data);

        // Create the SVG container.
        const svg = d3.create("svg")
            .attr("viewBox", `-${width} -${height} ${width * 2} ${height * 2}`) // Zoom-out change
            .attr("width", width)
            .attr("height", height)
            .attr("style", `max-width:100%;
                 height: ${height}px;
                 display: block; 
                 margin: auto; 
                 background: transparent; 
                 cursor: pointer;`);

        // Reposition some child nodes (Original logic)
        root.each(d => {
            if (d.children && d.children.length === 2) {
                const [a, b] = d.children;
                const offset = a.r + b.r + 10;
                a.x = d.x;
                b.x = d.x;
                a.y = d.y - offset / 2;
                b.y = d.y + offset / 2;
            }
            if (d.children && d.children.length === 4) {
                const [a, b] = d.children;
                const offset = a.r + b.r + 10;
                a.x = d.x - 20;
                b.x = d.x + 20;
                a.y = d.y - offset / 4;
                b.y = d.y + offset / 4;
            }
        });

        // Add a circle for each node.
        const node = svg.append("g")
            .selectAll("circle")
            .data(root.descendants().slice(1))
            .join("circle")
            .attr("transform", d => `translate(${d.x},${d.y})`)
            .attr("fill", d => (d.children ? RED : WHITE)) // New colors
            .attr("stroke", d => (d.children ? WHITE : RED_STROKE)) // New stroke
            .attr("stroke-width", 1) // New stroke-width
            .attr("pointer-events", d => !d.children ? "none" : null)
            .on("mouseover", function (event, d) {
                d3.select(this).attr("stroke", "#000");
                // Show tooltip logic
                if (d.depth === 1 && focus === root) {
                    showTip(d.data.name, event.clientX, event.clientY);
                }
            })
            .on("mouseout", function () {
                d3.select(this).attr("stroke", null);
                // Hide tooltip logic
                hideTip();
            })
            .on("click", (event, d) => {
                // Hide tooltip on click
                hideTip();
                if (focus !== d) (zoom(event, d), event.stopPropagation());
            });

        // Add a label for each node.
        const label = svg.append("g")
            .style("font", "10px sans-serif")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .selectAll("text")
            .data(root.descendants())
            .join("text")
            .style("fill-opacity", d => d.parent === root ? 1 : 0)
            .style("display", d => d.parent === root ? "inline" : "none")
            .text(d => d.data.name)
            .style("font-size", d => {
                if (d.depth === 0) return "10px"; // Root
                if (d.depth === 1) return "24px"; // Artist
                return "27px"; // Song
            })
            .style("font-weight", d => d.depth === 1 ? "bold" : "normal")
            // --- Styles for readability ---
            .style("fill", d => {
                if (d.depth === 2) return "#000"; // Songs = black
                if (d.depth === 1) return "#111"; // Artists = dark
                return "#444"; // Root = gray
            })
            .style("stroke", d => d.depth === 2 ? "#fff" : "none") // White stroke for songs
            .style("stroke-width", d => d.depth === 2 ? "3px" : "0px") // 3px stroke for songs
            .style("paint-order", "stroke") // Paint stroke behind fill
            // --- End of new styles ---
            .text(d => d.data.name).each(function (d) {

                const textWidth = this.getComputedTextLength();
                if (textWidth > d.r * 1.8) d3.select(this).style("display", "none");
            });

        // Create the zoom behavior and zoom immediately in to the initial focus node. (Original logic)
        svg.on("click", (event) => zoom(event, root));
        let focus = root;
        let view;
        zoomTo([focus.x, focus.y, focus.r * 2]);

        function zoomTo(v) {
            // --- THIS IS THE MODIFIED LINE ---
            const k = Math.min(width, height) * 2 / v[2];
            // --- END OF MODIFIED LINE ---

            view = v;
            label.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
            node.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
            node.attr("r", d => d.r * k);
        }

        // --- THIS IS THE MODIFIED ZOOM FUNCTION ---
        function zoom(event, d) {
            // 1. If clicking on the same spot, do nothing
            if (focus === d) return;

            focus = d; // Set new focus

            // 2. Immediately hide all currently visible labels
            label
                .filter(function() { return this.style.display === "inline"; })
                .style("fill-opacity", 0)
                .style("display", "none");

            // 3. Start the zoom transition for circles and labels
            const transition = svg.transition()
                .duration(event.altKey ? 5500 : 500)
                .tween("zoom", d => {
                    const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
                    return t => zoomTo(i(t));
                });

            // 4. At the end of the zoom, show the new labels
            transition.on("end", () => {
                // After zoom is complete, show the new labels
                label
                    .filter(function(d) { return d.parent === focus; }) // Get new labels
                    .style("display", "inline") // Set to display
                    .style("fill-opacity", 0) // Start invisible
                    .transition().duration(50) // FASTER fade-in
                    .style("fill-opacity", 1);

                // Ensure old labels are definitely hidden
                label
                    .filter(function(d) { return d.parent !== focus; })
                    .style("display", "none");
            });
        }
        // --- END OF MODIFIED ZOOM FUNCTION ---

        return svg.node();
    }

    // Append the newly created chart to the #viz mount point
    const chart = createChart(d3, data);
    mount.appendChild(chart);
}


// New function to process flat data into hierarchical data and render the chart
function processAndRender(d3, dataToProcess, metricForValue) {
    // Group data by channel (artist)
    const grouped = d3.group(dataToProcess, d => d.channel);

    // Convert flat CSV to hierarchical structure for the chart
    chartData = {
        name: "Youtube Top 100",
        children: Array.from(grouped, ([key, values]) => ({
            name: key,
            children: values.map(d => ({
                name: d.title,
                // FIX: Use the selected metricForValue to set the size of the bubble
                value: +d[metricForValue]
            }))
        }))
    };

    // Chart render
    renderChart(d3, chartData);
}

// New filtering function
function applyFiltersAndRender(d3) {
    if (!originalFlatData) return;

    // 1. Get filter values from UI
    const filterMetric = document.getElementById('filter-metric-selector').value;
    const categoryFilter = document.getElementById('category-filter').value;
    const liveStatusFilter = document.getElementById('live-status-filter').value;

    // 2. Apply filters
    let filteredData = originalFlatData.filter(d => {
        // Quantitative filter (dynamic)
        if (filterMetric !== 'none') {
            // Filter out any row where the value for that metric is 0 or less.
            // This also handles invalid/empty data for the selected metric.
            if (+d[filterMetric] <= 0 || isNaN(+d[filterMetric])) return false;
        }

        // Categorical filter (Dropdown filter based on substring match)
        if (categoryFilter !== 'All') {
            // Check if the row's categories field does NOT contain the selected category string (case-insensitive)
            if (d.categories && d.categories.toLowerCase().indexOf(categoryFilter.toLowerCase()) === -1) return false;
        }

        // Boolean filter ('live_status' column is a string "TRUE" or "FALSE")
        if (liveStatusFilter !== 'All' && d.live_status !== liveStatusFilter) return false;

        return true;
    });

    // 3. Process and Render - PASS THE METRIC
    processAndRender(d3, filteredData, filterMetric);
}

// Load and process the CSV data
d3.csv("data/youtube-top-100-songs-2025.csv").then(flatData => {
    // Store the original data globally
    originalFlatData = flatData;

    // Initial chart render (calling the filter function to apply any default filters from the HTML)
    applyFiltersAndRender(d3);

    // Add the resize event listener
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (chartData) {
                // Rerender with the current chartData on resize
                renderChart(d3, chartData);
            }
        }, 150);
    });

    // Add event listener for the filter button
    document.getElementById('apply-filter').addEventListener('click', () => {
        applyFiltersAndRender(d3);
    });
});
