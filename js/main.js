// A global variable to hold the hierarchical data
let chartData = null;
// A global variable to hold the original flat CSV data
let originalFlatData = null;

// rendering function (remains the same as before)
function renderChart(d3, data) {
    // Remove the existing SVG element ==> clear state
    d3.select("body").select("svg").remove();

    // Define core chart creation logic (shifting within rendering)
    function createChart(d3, data) {
        // Specify the chart’s dimensions. (These change on resize)

        // colours
        var bg = "hsla(97, 49%, 68%, 1.00)";
        var colour_in = "hsla(235, 48%, 43%, 1.00)";

        var height = window.innerHeight;
        var width = window.innerWidth / 1.2;

        // Create the color scale.
        const color = d3.scaleLinear()
            .domain([0, 5])
            .range([bg, colour_in])
            .interpolate(d3.interpolateHcl);

        // Compute the layout. ( relies on new width/height)
        const pack = data => d3.pack()
            .size([width, height])
            .padding(24)
            (d3.hierarchy(data)
                .sum(d => d.value)
                .sort((a, b) => b.value - a.value));

        const root = pack(data);

        // changing the background as well
        d3.select("body").style("background-color", bg);

        // Create the SVG container.

        const svg = d3.create("svg")
            .attr("viewBox", `-${width / 2}, -${height / 2}, ${width}, ${height}`)
            .style("display", "block")
            .style("margin", "0 -14px")
            .style("background", bg)
            .style("cursor", "pointer")
            .on("click", (event) => zoom(event, root));

        // Add a circle for each node.
        const node = svg.append("g")
            .selectAll("circle")
            .data(root.descendants().slice(1))
            .join("circle")
            .attr("fill", d => d.children ? color(d.depth) : "white")
            .attr("pointer-events", "all") // Keep all interactive
            .on("mouseover", function () { d3.select(this).attr("stroke", "#000"); })
            .on("mouseout", function () { d3.select(this).attr("stroke", null); })
            .on("click", (event, d) => focus !== d && (zoom(event, d), event.stopPropagation()));

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
                if (d.depth === 0) return "5px";
                if (d.depth === 1) return "10px";
                return "8px";
            })
            .style("font-weight", d => d.depth === 1 ? "bold" : "normal")
            .style("fill", d => d.depth === 1 ? "#111" : "#444")
            .text(d => d.data.name).each(function (d) {

                const textWidth = this.getComputedTextLength();
                if (textWidth > d.r * 1.8) d3.select(this).style("display", "none");
            });

        // Create the zoom behavior and zoom immediately in to the initial focus node.
        svg.on("click", (event) => zoom(event, root));
        let focus = root;
        let view;
        zoomTo([focus.x, focus.y, focus.r * 2]);

        function zoomTo(v) {
            const k = width / v[2];
            view = v;
            label.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
            node.attr("transform", d => `translate(${(d.x - v[0]) * k},${(d.y - v[1]) * k})`);
            node.attr("r", d => d.r * k);
        }

        function zoom(event, d) {
            focus = d;
            const transition = svg.transition()
                .duration(event.altKey ? 7500 : 750)
                .tween("zoom", d => {
                    const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
                    return t => zoomTo(i(t));
                });
            label
                .filter(function (d) { return d.parent === focus || this.style.display === "inline"; })
                .transition(transition)
                .style("fill-opacity", d => d.parent === focus ? 1 : 0)
                .on("start", function (d) { if (d.parent === focus) this.style.display = "inline"; })
                .on("end", function (d) { if (d.parent !== focus) this.style.display = "none"; });
        }

        return svg.node();
    }

    // Append the newly created chart to the body
    const chart = createChart(d3, data);
    document.body.appendChild(chart);
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